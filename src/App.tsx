import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CollectionProfileScreen } from './components/CollectionProfileScreen';
import { CreateDuelSheet } from './components/CreateDuelSheet';
import { GameBoardScreen } from './components/GameBoardScreen';
import { HubScreen } from './components/HubScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { VictoryScreen } from './components/VictoryScreen';
import { evaluateNewBadges } from './engine/gamification';
import { generateWordPair, isOneLetterDiff } from './engine/wordLadder';
import {
  bootstrapSupabaseState,
  broadcastRoomUpdate,
  createInitialProfile,
  createNewRoom,
  createOrUpsertRemoteRoom,
  ensureSupabaseSession,
  generateUuid,
  joinRoomRemoteOrLocal,
  loadProfile,
  loadRooms,
  passTurnIfExpired,
  pickSmartPartnerMove,
  pushRemoteMove,
  requestPushPermissionAndNotify,
  saveProfile,
  saveRooms,
  subscribeRealtimeSync,
  updateRemoteRoomState,
} from './services/multiplayer';
import type {
  AvatarId,
  GameMode,
  GameRoom,
  Language,
  ParticleEffectId,
  PlayerProfile,
  ThemeId,
  WordLength,
  WordMove,
} from './types/game';

type Screen = 'hub' | 'board' | 'victory' | 'collection';

function parsePendingJoinCode(): string | null {
  try {
    const pathMatch = window.location.pathname.match(/\/join\/([A-Za-z0-9-]+)/i);
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1].toUpperCase();
    }
    const params = new URLSearchParams(window.location.search);
    const q = params.get('join');
    if (q) return q.trim().toUpperCase();
  } catch {
    // Ignore URL errors
  }
  return null;
}

export function App() {
  const [profile, setProfile] = useState<PlayerProfile | null>(() => loadProfile());
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(() =>
    parsePendingJoinCode()
  );
  const [rooms, setRooms] = useState<Record<string, GameRoom>>(() =>
    profile ? loadRooms(profile) : {}
  );
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('hub');
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [createSheetDaily, setCreateSheetDaily] = useState(false);

  const [lastVictoryMeta, setLastVictoryMeta] = useState<{
    roomCode: string;
    newlyUnlockedBadges: string[];
    earnedXp: number;
    earnedStars: number;
  } | null>(null);

  const partnerTimerRef = useRef<number | null>(null);
  const bootstrappedRef = useRef(false);
  const rewardedRoomsRef = useRef<Set<string>>(new Set());

  // Sync theme attribute to <html>
  useEffect(() => {
    const theme = profile?.activeTheme ?? 'classic';
    document.documentElement.setAttribute('data-theme', theme);
  }, [profile?.activeTheme]);

  // Bootstrap Supabase anonymous session & sync existing profile / rooms
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    void (async () => {
      const localProfile = loadProfile();
      const localRooms = localProfile ? loadRooms(localProfile) : {};
      const synced = await bootstrapSupabaseState(localProfile, localRooms);
      if (synced.profile && (localProfile || !loadProfile())) {
        setProfile(synced.profile);
        setRooms(synced.rooms);
      }
    })();
  }, []);

  // If returning user arrived via /join/CODE, fetch/join the room immediately
  useEffect(() => {
    if (!profile || !pendingJoinCode) return;
    const codeToJoin = pendingJoinCode;
    setPendingJoinCode(null);
    if (window.location.pathname.startsWith('/join/')) {
      window.history.replaceState({}, '', '/');
    }

    void (async () => {
      const joined = await joinRoomRemoteOrLocal(codeToJoin, profile);
      setRooms((prev) => {
        const next = { ...prev, [joined.code]: joined };
        saveRooms(next);
        return next;
      });
      setActiveRoomCode(joined.code);
      setScreen(joined.status === 'completed' ? 'victory' : 'board');
    })();
  }, [profile, pendingJoinCode]);

  const completeRoomVictory = useCallback(
    (completedRoom: GameRoom) => {
      if (!profile) return;
      const rewardKey = `${completedRoom.code}:${completedRoom.startedAt}`;
      if (rewardedRoomsRef.current.has(rewardKey)) {
        setScreen('victory');
        return;
      }
      rewardedRoomsRef.current.add(rewardKey);

      const actualSteps = completedRoom.moves.length + completedRoom.undoPenaltyCount;
      const durationSeconds = completedRoom.completedAt
        ? Math.max(1, Math.round((completedRoom.completedAt - completedRoom.startedAt) / 1000))
        : 45;
      const starsEarned =
        actualSteps <= completedRoom.optimalPar
          ? 3
          : actualSteps <= completedRoom.optimalPar + 2
          ? 2
          : 1;
      const xpEarned = 40 + starsEarned * 20;

      const wordsInGame = [
        completedRoom.startWord,
        ...completedRoom.moves.map((m) => m.word),
      ];
      const uniqueWords = Array.from(new Set([...profile.uniqueWordsUsed, ...wordsInGame]));

      const isHost = completedRoom.hostPlayer.playerId === profile.playerId;
      const partner = isHost ? completedRoom.partnerPlayer : completedRoom.hostPlayer;

      const todayStr = new Date().toISOString().slice(0, 10);
      const shouldIncrementStreak = profile.lastPlayedDate !== todayStr;

      const updatedProfile: PlayerProfile = {
        ...profile,
        xp: profile.xp + xpEarned,
        stars: profile.stars + starsEarned,
        streak: shouldIncrementStreak ? profile.streak + 1 : profile.streak,
        lastPlayedDate: todayStr,
        gamesPlayed: profile.gamesPlayed + 1,
        gamesWon: profile.gamesWon + 1,
        optimalWins:
          actualSteps <= completedRoom.optimalPar
            ? profile.optimalWins + 1
            : profile.optimalWins,
        noHintWins:
          completedRoom.hintsUsed === 0 ? profile.noHintWins + 1 : profile.noHintWins,
        fastestWinSeconds:
          profile.fastestWinSeconds === null
            ? durationSeconds
            : Math.min(profile.fastestWinSeconds, durationSeconds),
        longestWordSolved: Math.max(profile.longestWordSolved, completedRoom.wordLength),
        uniqueWordsUsed: uniqueWords,
        savedBestChains: [
          {
            id: `chain-${Date.now()}`,
            startWord: completedRoom.startWord,
            targetWord: completedRoom.targetWord,
            words: wordsInGame,
            optimalSteps: completedRoom.optimalPar,
            actualSteps,
            partnerName: partner.name,
            language: completedRoom.language,
            completedAt: Date.now(),
          },
          ...profile.savedBestChains,
        ].slice(0, 15),
      };

      const newlyUnlocked = evaluateNewBadges(updatedProfile, {
        durationSeconds,
        actualSteps,
        optimalPar: completedRoom.optimalPar,
        hintsUsed: completedRoom.hintsUsed,
        wordLength: completedRoom.wordLength,
      });

      if (newlyUnlocked.length > 0) {
        updatedProfile.unlockedBadges = [
          ...updatedProfile.unlockedBadges,
          ...newlyUnlocked,
        ];
      }

      saveProfile(updatedProfile);
      setProfile(updatedProfile);
      setLastVictoryMeta({
        roomCode: completedRoom.code,
        newlyUnlockedBadges: newlyUnlocked,
        earnedXp: xpEarned,
        earnedStars: starsEarned,
      });
      setScreen('victory');
    },
    [profile]
  );

  // Subscribe to real-time updates (BroadcastChannel + Supabase Realtime)
  useEffect(() => {
    if (!profile) return;
    return subscribeRealtimeSync(
      profile.playerId,
      (updatedRoom) => {
        let shouldTriggerVictory = false;
        setRooms((prev) => {
          const existing = prev[updatedRoom.code];
          if (
            existing &&
            existing.status === 'active' &&
            updatedRoom.status === 'active' &&
            existing.moves.length > updatedRoom.moves.length &&
            existing.undoPenaltyCount >= updatedRoom.undoPenaltyCount
          ) {
            return prev;
          }

          let mergedRoom = updatedRoom;
          if (existing) {
            if (existing.autoPartnerEnabled && !updatedRoom.autoPartnerEnabled) {
              mergedRoom = { ...updatedRoom, turnStartedAt: Date.now() };
            } else if (
              existing.currentTurnPlayerId === updatedRoom.currentTurnPlayerId &&
              existing.currentWord === updatedRoom.currentWord &&
              existing.moves.length === updatedRoom.moves.length
            ) {
              mergedRoom = {
                ...updatedRoom,
                turnStartedAt: Math.max(
                  existing.turnStartedAt ?? 0,
                  updatedRoom.turnStartedAt ?? 0
                ),
                lastTurnPass: updatedRoom.lastTurnPass ?? existing.lastTurnPass,
              };
            }
          }

          if (updatedRoom.status === 'completed' && existing?.status !== 'completed') {
            shouldTriggerVictory = true;
          }

          const next = { ...prev, [mergedRoom.code]: mergedRoom };
          saveRooms(next);
          return next;
        });

        if (shouldTriggerVictory) {
          window.setTimeout(() => completeRoomVictory(updatedRoom), 380);
        }
      },
      (roomCode, senderPlayerId, isTyping) => {
        if (senderPlayerId === profile.playerId) return;
        setRooms((prev) => {
          const room = prev[roomCode];
          if (!room) return prev;
          const isPartnerHost = room.hostPlayer.playerId === senderPlayerId;
          return {
            ...prev,
            [roomCode]: {
              ...room,
              hostPlayer: isPartnerHost
                ? { ...room.hostPlayer, isTyping, online: true }
                : room.hostPlayer,
              partnerPlayer: !isPartnerHost
                ? { ...room.partnerPlayer, isTyping, online: true }
                : room.partnerPlayer,
            },
          };
        });
      }
    );
  }, [profile, completeRoomVictory]);

  const handleSubmitMove = useCallback(
    (roomCode: string, nextWord: string) => {
      if (!profile) return;

      setRooms((prev) => {
        const room = prev[roomCode];
        if (!room || room.status === 'completed') return prev;
        if (room.currentTurnPlayerId !== profile.playerId) return prev;

        const diff = isOneLetterDiff(room.currentWord, nextWord);
        if (!diff.valid) return prev;

        const isHost = room.hostPlayer.playerId === profile.playerId;
        const actor = isHost ? room.hostPlayer : room.partnerPlayer;
        const partnerPresence = isHost ? room.partnerPlayer : room.hostPlayer;
        const nextTurnPlayerId = partnerPresence.playerId;

        const move: WordMove = {
          id: generateUuid(),
          word: nextWord,
          previousWord: room.currentWord,
          changedIndex: diff.changedIndex,
          fromChar: diff.fromChar,
          toChar: diff.toChar,
          playerId: actor.playerId,
          playerName: actor.name,
          playerAvatarId: actor.avatarId,
          playerColor: actor.color,
          timestamp: Date.now(),
        };

        const reachedTarget = nextWord === room.targetWord;
        const updatedRoom: GameRoom = {
          ...room,
          currentWord: nextWord,
          moves: [...room.moves, move],
          currentTurnPlayerId: reachedTarget ? room.currentTurnPlayerId : nextTurnPlayerId,
          turnStartedAt: Date.now(),
          lastTurnPass: undefined,
          status: reachedTarget ? 'completed' : 'active',
          completedAt: reachedTarget ? Date.now() : undefined,
          winnerPlayerId: reachedTarget ? actor.playerId : undefined,
          hostPlayer: { ...room.hostPlayer, isTyping: false },
          partnerPlayer: { ...room.partnerPlayer, isTyping: false },
        };

        const nextRooms = { ...prev, [roomCode]: updatedRoom };
        saveRooms(nextRooms);
        broadcastRoomUpdate(updatedRoom, profile.playerId);
        void pushRemoteMove(updatedRoom, move);

        if (reachedTarget) {
          window.setTimeout(() => completeRoomVictory(updatedRoom), 380);
        }

        return nextRooms;
      });
    },
    [profile, completeRoomVictory]
  );

  // Automatic smart partner response (Carole) when it's her turn & autoPartnerEnabled is true
  useEffect(() => {
    if (!profile || !activeRoomCode || screen !== 'board') return;
    const room = rooms[activeRoomCode];
    if (!room || room.status !== 'active' || !room.autoPartnerEnabled) return;
    if (room.currentTurnPlayerId === profile.playerId) return;

    const isHost = room.hostPlayer.playerId === profile.playerId;
    const partner = isHost ? room.partnerPlayer : room.hostPlayer;

    if (partnerTimerRef.current) window.clearTimeout(partnerTimerRef.current);

    // Phase 1: show "Carole tape..."
    const typingTimer = window.setTimeout(() => {
      setRooms((prev) => {
        const cur = prev[activeRoomCode];
        if (!cur || cur.status !== 'active') return prev;
        return {
          ...prev,
          [activeRoomCode]: {
            ...cur,
            partnerPlayer: { ...cur.partnerPlayer, isTyping: true },
          },
        };
      });
    }, 450);

    // Phase 2: Carole executes optimal BFS step
    partnerTimerRef.current = window.setTimeout(() => {
      setRooms((prev) => {
        const cur = prev[activeRoomCode];
        if (!cur || cur.status !== 'active' || !cur.autoPartnerEnabled) return prev;
        if (cur.currentTurnPlayerId === profile.playerId) return prev;

        const move = pickSmartPartnerMove(cur, partner);
        if (!move) return prev;

        const reachedTarget = move.word === cur.targetWord;
        const updated: GameRoom = {
          ...cur,
          currentWord: move.word,
          moves: [...cur.moves, move],
          currentTurnPlayerId: profile.playerId,
          turnStartedAt: Date.now(),
          lastTurnPass: undefined,
          status: reachedTarget ? 'completed' : 'active',
          completedAt: reachedTarget ? Date.now() : undefined,
          winnerPlayerId: reachedTarget ? partner.playerId : undefined,
          hostPlayer: { ...cur.hostPlayer, isTyping: false },
          partnerPlayer: { ...cur.partnerPlayer, isTyping: false },
        };

        const nextRooms = { ...prev, [activeRoomCode]: updated };
        saveRooms(nextRooms);
        broadcastRoomUpdate(updated, partner.playerId);
        void updateRemoteRoomState(updated);

        requestPushPermissionAndNotify(
          `${partner.name} a joué ${move.word} !`,
          `Elle a changé ${move.fromChar} en ${move.toChar}. À ton tour !`
        );

        if (reachedTarget) {
          window.setTimeout(() => completeRoomVictory(updated), 380);
        }

        return nextRooms;
      });
    }, 1350);

    return () => {
      window.clearTimeout(typingTimer);
      if (partnerTimerRef.current) window.clearTimeout(partnerTimerRef.current);
    };
  }, [rooms, activeRoomCode, screen, profile, completeRoomVictory]);

  const hasTimeoutCandidate = Boolean(
    profile &&
      Object.values(rooms).some(
        (r) =>
          r.status === 'active' &&
          (!r.autoPartnerEnabled || r.currentTurnPlayerId !== profile.playerId)
      )
  );

  // Automatic turn pass when the current turn player takes too long to play
  useEffect(() => {
    if (!profile || !hasTimeoutCandidate) return;

    const checkExpiredTurns = () => {
      const now = Date.now();
      setRooms((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const room of Object.values(prev)) {
          if (room.status !== 'active') continue;
          if (room.autoPartnerEnabled && room.currentTurnPlayerId === profile.playerId) {
            continue;
          }
          const updated = passTurnIfExpired(room, now);
          if (updated) {
            next[room.code] = updated;
            changed = true;
            broadcastRoomUpdate(updated, profile.playerId);
            void updateRemoteRoomState(updated);
            if (updated.currentTurnPlayerId === profile.playerId && updated.lastTurnPass) {
              requestPushPermissionAndNotify(
                `${updated.lastTurnPass.fromPlayerName} a trop tardé`,
                `Le tour passe à toi (${updated.currentWord} → ${updated.targetWord}) !`
              );
            }
          }
        }
        if (changed) {
          saveRooms(next);
          return next;
        }
        return prev;
      });
    };

    checkExpiredTurns();
    const intervalId = window.setInterval(checkExpiredTurns, 1000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkExpiredTurns();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [profile, hasTimeoutCandidate]);

  const handleOnboardingComplete = async (name: string, avatarId: AvatarId, color: string) => {
    const uid = await ensureSupabaseSession();
    const newProfile = createInitialProfile(name, avatarId, color, uid ?? undefined);
    setProfile(newProfile);
    const loadedRooms = loadRooms(newProfile);

    if (pendingJoinCode) {
      const codeToJoin = pendingJoinCode;
      setPendingJoinCode(null);
      if (window.location.pathname.startsWith('/join/')) {
        window.history.replaceState({}, '', '/');
      }
      const joined = await joinRoomRemoteOrLocal(codeToJoin, newProfile);
      const merged = { ...loadedRooms, [joined.code]: joined };
      saveRooms(merged);
      setRooms(merged);
      setActiveRoomCode(joined.code);
      setScreen(joined.status === 'completed' ? 'victory' : 'board');
    } else {
      setRooms(loadedRooms);
      setScreen('hub');
    }
  };

  const handleCreateRoom = (
    language: Language,
    wordLength: WordLength,
    mode: GameMode
  ): GameRoom => {
    if (!profile) throw new Error('Profile required');
    const newRoom = createNewRoom(profile, language, wordLength, mode);
    setRooms((prev) => {
      const next = { ...prev, [newRoom.code]: newRoom };
      saveRooms(next);
      return next;
    });
    broadcastRoomUpdate(newRoom, profile.playerId);
    void createOrUpsertRemoteRoom(newRoom);
    return newRoom;
  };

  const handleJoinByCode = async (code: string) => {
    if (!profile) return;
    const room = await joinRoomRemoteOrLocal(code, profile);
    setRooms((prev) => {
      const next = { ...prev, [room.code]: room };
      saveRooms(next);
      return next;
    });
    setActiveRoomCode(room.code);
    setScreen(room.status === 'completed' ? 'victory' : 'board');
  };

  const handleUndoMove = (roomCode: string) => {
    if (!profile) return;
    setRooms((prev) => {
      const room = prev[roomCode];
      if (!room || room.moves.length === 0 || room.status === 'completed') return prev;

      const trimmedMoves = room.moves.slice(0, -1);
      const revertedWord =
        trimmedMoves.length > 0 ? trimmedMoves[trimmedMoves.length - 1].word : room.startWord;

      const updated: GameRoom = {
        ...room,
        currentWord: revertedWord,
        moves: trimmedMoves,
        undoPenaltyCount: room.undoPenaltyCount + 1,
        currentTurnPlayerId: profile.playerId,
        turnStartedAt: Date.now(),
        lastTurnPass: undefined,
        hostPlayer: { ...room.hostPlayer, isTyping: false },
        partnerPlayer: { ...room.partnerPlayer, isTyping: false },
      };
      const next = { ...prev, [roomCode]: updated };
      saveRooms(next);
      broadcastRoomUpdate(updated, profile.playerId);
      void updateRemoteRoomState(updated);
      return next;
    });
  };

  const handleUseHint = (roomCode: string): boolean => {
    if (!profile || profile.stars < 1) return false;

    const updatedProfile = { ...profile, stars: profile.stars - 1 };
    saveProfile(updatedProfile);
    setProfile(updatedProfile);

    setRooms((prev) => {
      const room = prev[roomCode];
      if (!room) return prev;
      const updated = { ...room, hintsUsed: room.hintsUsed + 1 };
      const next = { ...prev, [roomCode]: updated };
      saveRooms(next);
      void updateRemoteRoomState(updated);
      return next;
    });
    return true;
  };

  const handleRematch = (roomCode: string) => {
    if (!profile) return;
    const oldRoom = rooms[roomCode];
    if (!oldRoom) return;

    const pair = generateWordPair(
      oldRoom.language,
      oldRoom.wordLength,
      oldRoom.mode,
      oldRoom.startWord
    );
    const freshRoom: GameRoom = {
      ...oldRoom,
      startWord: pair.startWord,
      targetWord: pair.targetWord,
      currentWord: pair.startWord,
      optimalPar: pair.optimalPar,
      optimalPath: pair.optimalPath,
      moves: [],
      undoPenaltyCount: 0,
      hintsUsed: 0,
      currentTurnPlayerId: profile.playerId,
      turnStartedAt: Date.now(),
      lastTurnPass: undefined,
      status: 'active',
      startedAt: Date.now(),
      completedAt: undefined,
      winnerPlayerId: undefined,
      hostPlayer: { ...oldRoom.hostPlayer, isTyping: false },
      partnerPlayer: { ...oldRoom.partnerPlayer, isTyping: false },
    };

    setRooms((prev) => {
      const next = { ...prev, [roomCode]: freshRoom };
      saveRooms(next);
      return next;
    });
    broadcastRoomUpdate(freshRoom, profile.playerId);
    void updateRemoteRoomState(freshRoom);
    setActiveRoomCode(roomCode);
    setScreen('board');
  };

  const handleBuyOrActivateTheme = (themeId: ThemeId, priceStars: number): boolean => {
    if (!profile) return false;
    const alreadyOwned = profile.unlockedThemes.includes(themeId);
    if (!alreadyOwned && profile.stars < priceStars) return false;

    const updated: PlayerProfile = {
      ...profile,
      stars: alreadyOwned ? profile.stars : profile.stars - priceStars,
      unlockedThemes: alreadyOwned
        ? profile.unlockedThemes
        : [...profile.unlockedThemes, themeId],
      activeTheme: themeId,
    };
    saveProfile(updated);
    setProfile(updated);
    return true;
  };

  const handleBuyOrActivateParticle = (
    particleId: ParticleEffectId,
    priceStars: number
  ): boolean => {
    if (!profile) return false;
    const alreadyOwned = profile.unlockedParticles.includes(particleId);
    if (!alreadyOwned && profile.stars < priceStars) return false;

    const updated: PlayerProfile = {
      ...profile,
      stars: alreadyOwned ? profile.stars : profile.stars - priceStars,
      unlockedParticles: alreadyOwned
        ? profile.unlockedParticles
        : [...profile.unlockedParticles, particleId],
      activeParticle: particleId,
    };
    saveProfile(updated);
    setProfile(updated);
    return true;
  };

  if (!profile) {
    return (
      <OnboardingScreen
        pendingJoinCode={pendingJoinCode}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  const activeRoom = activeRoomCode ? rooms[activeRoomCode] : null;

  return (
    <div className="min-h-dvh w-full" style={{ backgroundColor: 'var(--bg-app)' }}>
      {screen === 'hub' && (
        <HubScreen
          profile={profile}
          rooms={Object.values(rooms)}
          onOpenRoom={(code) => {
            setActiveRoomCode(code);
            setScreen(rooms[code]?.status === 'completed' ? 'victory' : 'board');
          }}
          onOpenCreateDuel={(daily = false) => {
            setCreateSheetDaily(daily);
            setShowCreateSheet(true);
          }}
          onJoinByCode={handleJoinByCode}
          onOpenCollection={() => setScreen('collection')}
        />
      )}

      {screen === 'board' && activeRoom && (
        <GameBoardScreen
          room={activeRoom}
          profile={profile}
          onBackToHub={() => setScreen('hub')}
          onSubmitMove={handleSubmitMove}
          onUndoMove={handleUndoMove}
          onUseHint={handleUseHint}
          onOpenVictory={(code) => {
            setActiveRoomCode(code);
            setScreen('victory');
          }}
        />
      )}

      {screen === 'victory' && activeRoom && (
        <VictoryScreen
          room={activeRoom}
          profile={profile}
          newlyUnlockedBadgeIds={
            lastVictoryMeta?.roomCode === activeRoom.code
              ? lastVictoryMeta.newlyUnlockedBadges
              : []
          }
          earnedXp={lastVictoryMeta?.roomCode === activeRoom.code ? lastVictoryMeta.earnedXp : 80}
          earnedStars={
            lastVictoryMeta?.roomCode === activeRoom.code ? lastVictoryMeta.earnedStars : 3
          }
          onRematch={handleRematch}
          onBackToHub={() => setScreen('hub')}
        />
      )}

      {screen === 'collection' && (
        <CollectionProfileScreen
          profile={profile}
          onBack={() => setScreen('hub')}
          onBuyOrActivateTheme={handleBuyOrActivateTheme}
          onBuyOrActivateParticle={handleBuyOrActivateParticle}
        />
      )}

      {showCreateSheet && (
        <CreateDuelSheet
          defaultDaily={createSheetDaily}
          onClose={() => setShowCreateSheet(false)}
          onCreateRoom={handleCreateRoom}
          onEnterRoom={(code) => {
            setShowCreateSheet(false);
            setActiveRoomCode(code);
            setScreen('board');
          }}
        />
      )}
    </div>
  );
}

export default App;
