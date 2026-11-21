import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppTour, type TourStep } from './components/AppTour';
import { CollectionProfileScreen } from './components/CollectionProfileScreen';
import { CreateDuelSheet } from './components/CreateDuelSheet';
import { GameBoardScreen } from './components/GameBoardScreen';
import { HubScreen } from './components/HubScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { VictoryScreen } from './components/VictoryScreen';
import { evaluateNewBadges } from './engine/gamification';
import { generateWordPair, isOneLetterDiff } from './engine/wordLadder';
import { translate, useI18n } from './i18n';
import { loadTourState, markTourDone, type TourState } from './services/tour';
import {
  bootstrapSupabaseState,
  broadcastRoomUpdate,
  createInitialProfile,
  createMiyuPresence,
  createNewRoom,
  createOrUpsertRemoteRoom,
  createWaitingPartnerPresence,
  ensureSupabaseSession,
  generateRoomCode,
  generateUuid,
  isBotPartner,
  isWaitingPartner,
  joinRoomRemoteOrLocal,
  loadProfile,
  loadRooms,
  MIYU_BOT_ID,
  passTurnIfExpired,
  pickSmartPartnerMove,
  planBotTurnBehavior,
  pushRemoteMove,
  refreshRemoteRooms,
  requestPushPermissionAndNotify,
  resolveRoomParticipants,
  type RoomUpdateMeta,
  saveProfile,
  saveRooms,
  subscribeRealtimeSync,
  updateRemoteRoomState,
  upsertProfileRemote,
  WAITING_PARTNER_ID,
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

function isSameDuo(a: GameRoom, b: GameRoom): boolean {
  const pairA = [a.hostPlayer.playerId, a.partnerPlayer.playerId].sort();
  const pairB = [b.hostPlayer.playerId, b.partnerPlayer.playerId].sort();
  return pairA[0] === pairB[0] && pairA[1] === pairB[1];
}

const GENERIC_FALLBACK_NAMES = new Set([
  'hôte',
  'host',
  'partenaire',
  'partner',
  'en attente...',
  'waiting...',
]);

function isGenericFallbackName(name: string | null | undefined): boolean {
  if (!name) return true;
  return GENERIC_FALLBACK_NAMES.has(name.trim().toLowerCase());
}

export function App() {
  const { t } = useI18n();
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
  const [hubNotice, setHubNotice] = useState<string | null>(null);

  const [lastVictoryMeta, setLastVictoryMeta] = useState<{
    roomCode: string;
    newlyUnlockedBadges: string[];
    earnedXp: number;
    earnedStars: number;
  } | null>(null);

  const bootstrappedRef = useRef(false);
  const rewardedRoomsRef = useRef<Set<string>>(new Set());
  const lastLocalMutationRef = useRef<Record<string, number>>({});
  const hubNoticeTimerRef = useRef<number | null>(null);
  const [authBootstrapped, setAuthBootstrapped] = useState(false);
  const [tourState, setTourState] = useState<TourState>(() => loadTourState());
  const [activeTour, setActiveTour] = useState<'hub' | 'board' | null>(null);

  const showHubNotice = useCallback((message: string) => {
    if (hubNoticeTimerRef.current) window.clearTimeout(hubNoticeTimerRef.current);
    setHubNotice(message);
    hubNoticeTimerRef.current = window.setTimeout(() => setHubNotice(null), 4000);
  }, []);

  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;
  const activeRoomCodeRef = useRef(activeRoomCode);
  activeRoomCodeRef.current = activeRoomCode;
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const profileRef = useRef(profile);
  profileRef.current = profile;

  // Sync theme attribute to <html> + mobile PWA status bar theme-color
  useEffect(() => {
    const theme = profile?.activeTheme ?? 'classic';
    document.documentElement.setAttribute('data-theme', theme);
    const themeColors: Record<ThemeId, string> = {
      classic: '#ffffff',
      oled: '#000000',
      cyberpunk: '#0d0f1a',
      nyt: '#f7f4ec',
      pastel: '#fff6f9',
    };
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', themeColors[theme] ?? '#ffffff');
    }
    const metaAppleBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (metaAppleBar) {
      metaAppleBar.setAttribute(
        'content',
        theme === 'oled' || theme === 'cyberpunk' ? 'black-translucent' : 'default'
      );
    }
  }, [profile?.activeTheme]);

  // Mobile Back button / swipe-back gesture navigation (prevents accidental PWA exit on Android/iOS)
  const isPoppingHistoryRef = useRef(false);
  const showCreateSheetRef = useRef(showCreateSheet);
  showCreateSheetRef.current = showCreateSheet;
  const activeTourRef = useRef(activeTour);
  activeTourRef.current = activeTour;

  useEffect(() => {
    if (!profile) return;
    if (isPoppingHistoryRef.current) {
      isPoppingHistoryRef.current = false;
      return;
    }
    if (screen !== 'hub' || showCreateSheet) {
      window.history.pushState(
        { letsTurnScreen: screen, roomCode: activeRoomCode, sheet: showCreateSheet },
        ''
      );
    }
  }, [profile, screen, activeRoomCode, showCreateSheet]);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if (activeTourRef.current !== null) {
        setActiveTour(null);
        return;
      }
      if (showCreateSheetRef.current) {
        isPoppingHistoryRef.current = true;
        setShowCreateSheet(false);
        return;
      }
      const targetScreen = (e.state as { letsTurnScreen?: Screen } | null)?.letsTurnScreen;
      if (targetScreen && targetScreen !== screenRef.current) {
        isPoppingHistoryRef.current = true;
        setScreen(targetScreen);
        return;
      }
      if (screenRef.current !== 'hub') {
        isPoppingHistoryRef.current = true;
        setScreen('hub');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Re-sync rooms from Supabase when mobile device wakes from sleep, returns from WhatsApp, or regains network
  useEffect(() => {
    if (!profile?.playerId) return;
    let syncInFlight = false;

    const syncFromRemoteOnWake = async () => {
      if (syncInFlight || document.visibilityState === 'hidden') return;
      const activeProfile = profileRef.current;
      if (!activeProfile) return;
      syncInFlight = true;
      try {
        const updatedRooms = await refreshRemoteRooms(activeProfile, roomsRef.current);
        if (updatedRooms) {
          roomsRef.current = updatedRooms;
          setRooms(updatedRooms);
        }
      } finally {
        syncInFlight = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncFromRemoteOnWake();
      }
    };
    const onOnline = () => {
      void syncFromRemoteOnWake();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
    };
  }, [profile?.playerId]);

  // Bootstrap Supabase anonymous session & sync existing profile / rooms
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    void (async () => {
      try {
        const localProfile = loadProfile();
        const localRooms = localProfile ? loadRooms(localProfile) : {};
        const synced = await bootstrapSupabaseState(localProfile, localRooms);
        if (synced.profile && (localProfile || !loadProfile())) {
          profileRef.current = synced.profile;
          roomsRef.current = synced.rooms;
          setProfile(synced.profile);
          setRooms(synced.rooms);
        }
      } finally {
        setAuthBootstrapped(true);
      }
    })();
  }, []);

  // If returning user arrived via /join/CODE, wait until Supabase UID sync finishes then join
  useEffect(() => {
    if (!authBootstrapped || !profile || !pendingJoinCode) return;
    const codeToJoin = pendingJoinCode;
    setPendingJoinCode(null);
    if (window.location.pathname.startsWith('/join/')) {
      window.history.replaceState({}, '', '/');
    }

    void (async () => {
      const joined = await joinRoomRemoteOrLocal(codeToJoin, profile);
      const effectiveProfile = joined.migratedProfile ?? profile;
      if (joined.migratedProfile) {
        profileRef.current = joined.migratedProfile;
        setProfile(joined.migratedProfile);
      }
      if (joined.status === 'full') {
        const syncedRooms = joined.migratedProfile
          ? loadRooms(effectiveProfile)
          : roomsRef.current;
        roomsRef.current = syncedRooms;
        setRooms(syncedRooms);
        setScreen('hub');
        showHubNotice(translate('hub.roomFull'));
        return;
      }
      const baseRooms = joined.migratedProfile ? loadRooms(effectiveProfile) : roomsRef.current;
      const next = { ...baseRooms, [joined.room.code]: joined.room };
      roomsRef.current = next;
      saveRooms(next);
      setRooms(next);
      setActiveRoomCode(joined.room.code);
      setScreen(joined.room.status === 'completed' ? 'victory' : 'board');
    })();
  }, [authBootstrapped, profile, pendingJoinCode, showHubNotice]);

  const completeRoomVictory = useCallback((completedRoom: GameRoom) => {
    const activeProfile = profileRef.current;
    if (!activeProfile) return;
    const rewardKey = `${completedRoom.code}:${completedRoom.startWord}:${completedRoom.targetWord}`;
    if (rewardedRoomsRef.current.has(rewardKey)) {
      setActiveRoomCode(completedRoom.code);
      setScreen('victory');
      return;
    }
    rewardedRoomsRef.current.add(rewardKey);

    const isAbandoned = Boolean(
      completedRoom.abandoned || completedRoom.currentWord !== completedRoom.targetWord
    );

    if (isAbandoned) {
      if (completedRoom.moves.length > 0) {
        const updatedProfile: PlayerProfile = {
          ...activeProfile,
          gamesPlayed: activeProfile.gamesPlayed + 1,
        };
        profileRef.current = updatedProfile;
        saveProfile(updatedProfile);
        setProfile(updatedProfile);
      }
      setLastVictoryMeta({
        roomCode: completedRoom.code,
        newlyUnlockedBadges: [],
        earnedXp: 0,
        earnedStars: 0,
      });
      setActiveRoomCode(completedRoom.code);
      setScreen('victory');
      return;
    }

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
    const uniqueWords = Array.from(new Set([...activeProfile.uniqueWordsUsed, ...wordsInGame]));

    const { partner } = resolveRoomParticipants(completedRoom, activeProfile);

    const todayStr = new Date().toISOString().slice(0, 10);
    const shouldIncrementStreak = activeProfile.lastPlayedDate !== todayStr;

    const updatedProfile: PlayerProfile = {
      ...activeProfile,
      xp: activeProfile.xp + xpEarned,
      stars: activeProfile.stars + starsEarned,
      streak: shouldIncrementStreak ? activeProfile.streak + 1 : activeProfile.streak,
      lastPlayedDate: todayStr,
      gamesPlayed: activeProfile.gamesPlayed + 1,
      gamesWon: activeProfile.gamesWon + 1,
      optimalWins:
        actualSteps <= completedRoom.optimalPar
          ? activeProfile.optimalWins + 1
          : activeProfile.optimalWins,
      noHintWins:
        completedRoom.hintsUsed === 0 ? activeProfile.noHintWins + 1 : activeProfile.noHintWins,
      fastestWinSeconds:
        activeProfile.fastestWinSeconds === null
          ? durationSeconds
          : Math.min(activeProfile.fastestWinSeconds, durationSeconds),
      longestWordSolved: Math.max(activeProfile.longestWordSolved, completedRoom.wordLength),
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
        ...activeProfile.savedBestChains,
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

    profileRef.current = updatedProfile;
    saveProfile(updatedProfile);
    setProfile(updatedProfile);
    setLastVictoryMeta({
      roomCode: completedRoom.code,
      newlyUnlockedBadges: newlyUnlocked,
      earnedXp: xpEarned,
      earnedStars: starsEarned,
    });
    setActiveRoomCode(completedRoom.code);
    setScreen('victory');
  }, []);

  const completeRoomVictoryRef = useRef(completeRoomVictory);
  completeRoomVictoryRef.current = completeRoomVictory;

  // Subscribe to real-time updates (BroadcastChannel + Supabase Realtime)
  const playerId = profile?.playerId ?? null;
  useEffect(() => {
    if (!playerId) return;
    return subscribeRealtimeSync(
      playerId,
      (updatedRoom: GameRoom, meta?: RoomUpdateMeta) => {
        const prev = roomsRef.current;
        const existing = prev[updatedRoom.code];
        if (
          existing &&
          existing.status === 'active' &&
          updatedRoom.status === 'active' &&
          existing.moves.length > updatedRoom.moves.length &&
          existing.undoPenaltyCount >= updatedRoom.undoPenaltyCount
        ) {
          return;
        }
        if (
          existing &&
          existing.status === 'completed' &&
          updatedRoom.status === 'completed' &&
          existing.moves.length > updatedRoom.moves.length
        ) {
          return;
        }
        if (existing && existing.status === 'completed' && updatedRoom.status === 'active') {
          return;
        }
        if (
          existing &&
          meta?.source === 'postgres' &&
          existing.status === updatedRoom.status &&
          existing.moves.length === updatedRoom.moves.length &&
          existing.undoPenaltyCount === updatedRoom.undoPenaltyCount &&
          existing.partnerPlayer.playerId === updatedRoom.partnerPlayer.playerId &&
          Date.now() - (lastLocalMutationRef.current[updatedRoom.code] ?? 0) < 2500
        ) {
          return;
        }

        let mergedRoom = updatedRoom;
        if (existing) {
          const keepMiyuBot =
            isBotPartner(existing.partnerPlayer.playerId) &&
            isWaitingPartner(updatedRoom.partnerPlayer.playerId);
          const friendJustJoined =
            isWaitingPartner(existing.partnerPlayer.playerId) &&
            !isWaitingPartner(updatedRoom.partnerPlayer.playerId) &&
            !isBotPartner(updatedRoom.partnerPlayer.playerId);

          if (keepMiyuBot) {
            mergedRoom = {
              ...updatedRoom,
              partnerPlayer: existing.partnerPlayer,
              autoPartnerEnabled: true,
              currentTurnPlayerId:
                updatedRoom.currentTurnPlayerId === WAITING_PARTNER_ID
                  ? MIYU_BOT_ID
                  : updatedRoom.currentTurnPlayerId,
            };
          } else if (
            friendJustJoined ||
            (existing.autoPartnerEnabled && !updatedRoom.autoPartnerEnabled)
          ) {
            mergedRoom = { ...updatedRoom, turnStartedAt: Date.now() };
          } else if (
            existing.currentTurnPlayerId !== updatedRoom.currentTurnPlayerId ||
            updatedRoom.moves.length > existing.moves.length
          ) {
            // Anchor the new turn to this device's local clock to eliminate cross-device clock skew
            mergedRoom = { ...updatedRoom, turnStartedAt: Date.now() };
          } else if (
            existing.currentTurnPlayerId === updatedRoom.currentTurnPlayerId &&
            existing.currentWord === updatedRoom.currentWord &&
            existing.moves.length === updatedRoom.moves.length
          ) {
            mergedRoom = {
              ...updatedRoom,
              turnStartedAt: existing.turnStartedAt ?? updatedRoom.turnStartedAt ?? Date.now(),
              lastTurnPass: updatedRoom.lastTurnPass ?? existing.lastTurnPass,
            };
          }

          if (
            mergedRoom.hostPlayer.playerId === existing.hostPlayer.playerId &&
            isGenericFallbackName(mergedRoom.hostPlayer.name) &&
            !isGenericFallbackName(existing.hostPlayer.name)
          ) {
            mergedRoom = {
              ...mergedRoom,
              hostPlayer: { ...mergedRoom.hostPlayer, name: existing.hostPlayer.name },
            };
          }
          if (
            mergedRoom.partnerPlayer.playerId === existing.partnerPlayer.playerId &&
            isGenericFallbackName(mergedRoom.partnerPlayer.name) &&
            !isGenericFallbackName(existing.partnerPlayer.name)
          ) {
            mergedRoom = {
              ...mergedRoom,
              partnerPlayer: { ...mergedRoom.partnerPlayer, name: existing.partnerPlayer.name },
            };
          }

          if (mergedRoom.abandoned) {
            mergedRoom = {
              ...mergedRoom,
              abandonedByPlayerId: mergedRoom.abandonedByPlayerId ?? existing.abandonedByPlayerId,
              abandonedByName: mergedRoom.abandonedByName ?? existing.abandonedByName,
            };
          }
        }

        const next = { ...prev, [mergedRoom.code]: mergedRoom };
        roomsRef.current = next;
        saveRooms(next);
        setRooms(next);

        if (mergedRoom.status === 'completed' && existing?.status !== 'completed') {
          if (activeRoomCodeRef.current === mergedRoom.code || screenRef.current === 'hub') {
            if (mergedRoom.abandoned) {
              completeRoomVictoryRef.current(mergedRoom);
            } else {
              window.setTimeout(() => completeRoomVictoryRef.current(mergedRoom), 380);
            }
          }
        }

        const currentActive = activeRoomCodeRef.current ? next[activeRoomCodeRef.current] : null;
        if (
          screenRef.current === 'victory' &&
          currentActive &&
          mergedRoom.status === 'active' &&
          mergedRoom.code !== currentActive.code &&
          (meta?.rematchFromCode === currentActive.code ||
            (!existing && isSameDuo(currentActive, mergedRoom)))
        ) {
          setActiveRoomCode(mergedRoom.code);
          setScreen('board');
        }
      },
      (roomCode, senderPlayerId, isTyping) => {
        if (senderPlayerId === playerId) return;
        setRooms((prev) => {
          const room = prev[roomCode];
          if (!room) return prev;
          const isPartnerHost = room.hostPlayer.playerId === senderPlayerId;
          const next = {
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
          roomsRef.current = next;
          return next;
        });
      }
    );
  }, [playerId]);

  const handleSubmitMove = useCallback((roomCode: string, nextWord: string) => {
    const activeProfile = profileRef.current;
    if (!activeProfile) return;

    const prev = roomsRef.current;
    const room = prev[roomCode];
    if (!room || room.status === 'completed') return;

    const { me, partner, isMyTurn } = resolveRoomParticipants(room, activeProfile);
    if (!isMyTurn) return;

    const diff = isOneLetterDiff(room.currentWord, nextWord);
    if (!diff.valid) return;

    const actor = me;
    const nextTurnPlayerId =
      partner.playerId === me.playerId ? WAITING_PARTNER_ID : partner.playerId;

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
    const now = Date.now();
    const updatedRoom: GameRoom = {
      ...room,
      currentWord: nextWord,
      moves: [...room.moves, move],
      currentTurnPlayerId: reachedTarget ? room.currentTurnPlayerId : nextTurnPlayerId,
      turnStartedAt: now,
      lastTurnPass: undefined,
      status: reachedTarget ? 'completed' : 'active',
      completedAt: reachedTarget ? now : undefined,
      winnerPlayerId: reachedTarget ? actor.playerId : undefined,
      hostPlayer: { ...room.hostPlayer, isTyping: false },
      partnerPlayer: { ...room.partnerPlayer, isTyping: false },
    };

    lastLocalMutationRef.current[roomCode] = now;
    const nextRooms = { ...prev, [roomCode]: updatedRoom };
    roomsRef.current = nextRooms;
    saveRooms(nextRooms);
    setRooms(nextRooms);
    broadcastRoomUpdate(updatedRoom, activeProfile.playerId);
    void pushRemoteMove(updatedRoom, move);

    if (reachedTarget) {
      window.setTimeout(() => completeRoomVictoryRef.current(updatedRoom), 380);
    }
  }, []);

  const activeBotRoom = activeRoomCode ? rooms[activeRoomCode] : null;
  const activeBotRoomStatus = activeBotRoom?.status;
  const activeBotRoomAuto = activeBotRoom?.autoPartnerEnabled ?? false;
  const activeBotRoomPartnerId = activeBotRoom?.partnerPlayer.playerId;
  const activeBotRoomTurnId = activeBotRoom?.currentTurnPlayerId;
  const activeBotRoomWord = activeBotRoom?.currentWord;
  const activeBotRoomMovesLen = activeBotRoom?.moves.length ?? 0;

  const isBoardTourOpen = activeTour === 'board';
  const isBoardTourOpenRef = useRef(isBoardTourOpen);
  isBoardTourOpenRef.current = isBoardTourOpen;

  // Automatic smart partner response (Miyu) when it's her turn & partner is Miyu
  useEffect(() => {
    const activeProfile = profileRef.current;
    const room = activeRoomCode ? roomsRef.current[activeRoomCode] : null;
    if (!activeProfile || !activeRoomCode || screen !== 'board' || isBoardTourOpen) return;
    if (!room || room.status !== 'active') return;

    const { isBot, isMyTurn } = resolveRoomParticipants(room, activeProfile);
    if (isMyTurn || !isBot) return;

    const roomCode = activeRoomCode;
    const plan = planBotTurnBehavior(room);
    const timers: number[] = [];

    const setBotTyping = (isTyping: boolean) => {
      setRooms((prev) => {
        const cur = prev[roomCode];
        if (!cur || cur.status !== 'active') return prev;
        const latestProfile = profileRef.current;
        if (!latestProfile) return prev;
        const stateNow = resolveRoomParticipants(cur, latestProfile);
        if (stateNow.isMyTurn || !stateNow.isBot || cur.partnerPlayer.isTyping === isTyping) {
          return prev;
        }
        const nextRooms = {
          ...prev,
          [roomCode]: {
            ...cur,
            partnerPlayer: { ...cur.partnerPlayer, isTyping },
          },
        };
        roomsRef.current = nextRooms;
        return nextRooms;
      });
    };

    for (const { startMs, endMs } of plan.typingPulses) {
      timers.push(window.setTimeout(() => setBotTyping(true), startMs));
      if (plan.willTimeout || endMs < plan.thinkMs) {
        timers.push(window.setTimeout(() => setBotTyping(false), endMs));
      }
    }

    // Execute optimal BFS step outside setRooms updater (StrictMode-safe) unless bot times out
    if (!plan.willTimeout) {
      timers.push(
        window.setTimeout(() => {
          const latestProfile = profileRef.current;
          const prevRooms = roomsRef.current;
          const cur = prevRooms[roomCode];
          if (!latestProfile || !cur || cur.status !== 'active') return;

          const {
            me,
            partner: curPartner,
            isBot: curIsBot,
            isMyTurn: curIsMyTurn,
          } = resolveRoomParticipants(cur, latestProfile);
          if (curIsMyTurn || !curIsBot) return;

          const move = pickSmartPartnerMove(cur, curPartner);
          const now = Date.now();
          if (!move) {
            const resetTurn: GameRoom = {
              ...cur,
              currentTurnPlayerId: me.playerId,
              turnStartedAt: now,
              hostPlayer: { ...cur.hostPlayer, isTyping: false },
              partnerPlayer: { ...cur.partnerPlayer, isTyping: false },
            };
            lastLocalMutationRef.current[roomCode] = now;
            const nextRooms = { ...prevRooms, [roomCode]: resetTurn };
            roomsRef.current = nextRooms;
            saveRooms(nextRooms);
            setRooms(nextRooms);
            return;
          }

          const reachedTarget = move.word === cur.targetWord;
          const updated: GameRoom = {
            ...cur,
            currentWord: move.word,
            moves: [...cur.moves, move],
            currentTurnPlayerId: me.playerId,
            turnStartedAt: now,
            lastTurnPass: undefined,
            status: reachedTarget ? 'completed' : 'active',
            completedAt: reachedTarget ? now : undefined,
            winnerPlayerId: reachedTarget ? curPartner.playerId : undefined,
            autoPartnerEnabled: true,
            hostPlayer: { ...cur.hostPlayer, isTyping: false },
            partnerPlayer: { ...cur.partnerPlayer, isTyping: false },
          };

          lastLocalMutationRef.current[roomCode] = now;
          const nextRooms = { ...prevRooms, [roomCode]: updated };
          roomsRef.current = nextRooms;
          saveRooms(nextRooms);
          setRooms(nextRooms);
          broadcastRoomUpdate(updated, curPartner.playerId);
          void updateRemoteRoomState(updated);

          requestPushPermissionAndNotify(
            translate('notifications.partnerMovedTitle', {
              name: curPartner.name,
              word: move.word,
            }),
            translate('notifications.partnerMovedBody', {
              name: curPartner.name,
              from: move.fromChar,
              to: move.toChar,
            })
          );

          if (reachedTarget) {
            window.setTimeout(() => completeRoomVictoryRef.current(updated), 380);
          }
        }, plan.thinkMs)
      );
    }

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [
    profile?.playerId,
    activeRoomCode,
    screen,
    activeBotRoomStatus,
    activeBotRoomAuto,
    activeBotRoomPartnerId,
    activeBotRoomTurnId,
    activeBotRoomWord,
    activeBotRoomMovesLen,
    isBoardTourOpen,
  ]);

  const hasTimeoutCandidate = Boolean(
    profile &&
      (Object.values(rooms).some(
        (r) =>
          r.status === 'active' &&
          !r.autoPartnerEnabled &&
          !isBotPartner(r.partnerPlayer.playerId) &&
          !isWaitingPartner(r.partnerPlayer.playerId)
      ) ||
        (screen === 'board' &&
          activeBotRoom &&
          activeBotRoom.status === 'active' &&
          isBotPartner(activeBotRoom.partnerPlayer.playerId)))
  );

  // Automatic turn pass when the current turn player (human or Miyu) takes too long to play
  useEffect(() => {
    if (!profile?.playerId || !hasTimeoutCandidate) return;

    const checkExpiredTurns = () => {
      const activeProfile = profileRef.current;
      const prev = roomsRef.current;
      if (!activeProfile) return;

      const now = Date.now();
      let changed = false;
      const next = { ...prev };
      const notifications: Array<{ timeoutName: string; updated: GameRoom }> = [];

      for (const room of Object.values(prev)) {
        if (room.status !== 'active') continue;
        if (isBoardTourOpenRef.current && room.code === activeRoomCodeRef.current) continue;
        const { me, partner, waitingForPartner, isBot, isMyTurn } = resolveRoomParticipants(
          room,
          activeProfile
        );
        if (waitingForPartner) continue;
        // Bot rooms sitting idle in the Hub should not expire in the background
        if (isBot && (screenRef.current !== 'board' || activeRoomCodeRef.current !== room.code)) {
          continue;
        }
        // Waiting player handles primary expiry at 30s; active human yields after +1.5s fallback; bot expires cleanly at 30s
        const graceMs = isBot ? 0 : isMyTurn ? 1500 : 0;
        const updated = passTurnIfExpired(room, now, graceMs);
        if (updated) {
          lastLocalMutationRef.current[room.code] = now;
          next[room.code] = updated;
          changed = true;
          broadcastRoomUpdate(updated, activeProfile.playerId);
          void updateRemoteRoomState(updated);

          if (
            (updated.currentTurnPlayerId === activeProfile.playerId ||
              updated.currentTurnPlayerId === me.playerId) &&
            updated.lastTurnPass &&
            updated.lastTurnPass.fromPlayerId !== activeProfile.playerId &&
            updated.lastTurnPass.fromPlayerId !== me.playerId
          ) {
            const timeoutName =
              updated.lastTurnPass.fromPlayerName === activeProfile.name
                ? partner.name
                : updated.lastTurnPass.fromPlayerName;
            notifications.push({ timeoutName, updated });
          }
        }
      }

      if (changed) {
        roomsRef.current = next;
        saveRooms(next);
        setRooms(next);
        for (const { timeoutName, updated } of notifications) {
          requestPushPermissionAndNotify(
            translate('notifications.timeoutTitle', {
              name: timeoutName,
            }),
            translate('notifications.timeoutBody', {
              current: updated.currentWord,
              target: updated.targetWord,
            })
          );
        }
      }
    };

    checkExpiredTurns();
    const intervalId = window.setInterval(checkExpiredTurns, 500);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkExpiredTurns();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [profile?.playerId, hasTimeoutCandidate, screen, activeRoomCode]);

  const handleOnboardingComplete = async (name: string, avatarId: AvatarId, color: string) => {
    const uid = await ensureSupabaseSession();
    const newProfile = createInitialProfile(name, avatarId, color, uid ?? undefined);
    await upsertProfileRemote(newProfile);
    profileRef.current = newProfile;
    setProfile(newProfile);
    const loadedRooms = loadRooms(newProfile);

    if (pendingJoinCode) {
      const codeToJoin = pendingJoinCode;
      setPendingJoinCode(null);
      if (window.location.pathname.startsWith('/join/')) {
        window.history.replaceState({}, '', '/');
      }
      const joined = await joinRoomRemoteOrLocal(codeToJoin, newProfile);
      const effectiveProfile = joined.migratedProfile ?? newProfile;
      if (joined.migratedProfile) {
        profileRef.current = joined.migratedProfile;
        setProfile(joined.migratedProfile);
      }
      if (joined.status === 'full') {
        const baseRooms = joined.migratedProfile ? loadRooms(effectiveProfile) : loadedRooms;
        roomsRef.current = baseRooms;
        setRooms(baseRooms);
        setScreen('hub');
        showHubNotice(translate('hub.roomFull'));
        return;
      }
      const baseRooms = joined.migratedProfile ? loadRooms(effectiveProfile) : loadedRooms;
      const merged = { ...baseRooms, [joined.room.code]: joined.room };
      roomsRef.current = merged;
      saveRooms(merged);
      setRooms(merged);
      setActiveRoomCode(joined.room.code);
      setScreen(joined.room.status === 'completed' ? 'victory' : 'board');
    } else {
      roomsRef.current = loadedRooms;
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
    const newRoom = createNewRoom(
      profile,
      language,
      wordLength,
      mode,
      undefined,
      Object.keys(roomsRef.current)
    );
    lastLocalMutationRef.current[newRoom.code] = Date.now();
    const next = { ...roomsRef.current, [newRoom.code]: newRoom };
    roomsRef.current = next;
    saveRooms(next);
    setRooms(next);
    broadcastRoomUpdate(newRoom, profile.playerId);
    void createOrUpsertRemoteRoom(newRoom);
    return newRoom;
  };

  const handleJoinByCode = async (code: string) => {
    if (!profile) return;
    const joined = await joinRoomRemoteOrLocal(code, profile);
    const effectiveProfile = joined.migratedProfile ?? profile;
    if (joined.migratedProfile) {
      profileRef.current = joined.migratedProfile;
      setProfile(joined.migratedProfile);
    }
    if (joined.status === 'full') {
      const baseRooms = joined.migratedProfile
        ? loadRooms(effectiveProfile)
        : roomsRef.current;
      roomsRef.current = baseRooms;
      setRooms(baseRooms);
      setScreen('hub');
      showHubNotice(translate('hub.roomFull'));
      return;
    }
    const baseRooms = joined.migratedProfile
      ? loadRooms(effectiveProfile)
      : roomsRef.current;
    const next = { ...baseRooms, [joined.room.code]: joined.room };
    roomsRef.current = next;
    saveRooms(next);
    setRooms(next);
    setActiveRoomCode(joined.room.code);
    setScreen(joined.room.status === 'completed' ? 'victory' : 'board');
  };

  const handleUndoMove = (roomCode: string) => {
    if (!profile) return;
    const prev = roomsRef.current;
    const room = prev[roomCode];
    if (!room || room.moves.length === 0 || room.status === 'completed') return;

    const { me } = resolveRoomParticipants(room, profile);
    const matchedById =
      room.hostPlayer.playerId === profile.playerId ||
      room.partnerPlayer.playerId === profile.playerId;

    const trimmedMoves = room.moves.slice(0, -1);
    const revertedWord =
      trimmedMoves.length > 0 ? trimmedMoves[trimmedMoves.length - 1].word : room.startWord;

    const now = Date.now();
    const updated: GameRoom = {
      ...room,
      currentWord: revertedWord,
      moves: trimmedMoves,
      undoPenaltyCount: room.undoPenaltyCount + 1,
      currentTurnPlayerId: matchedById ? profile.playerId : me.playerId,
      turnStartedAt: now,
      lastTurnPass: undefined,
      hostPlayer: { ...room.hostPlayer, isTyping: false },
      partnerPlayer: { ...room.partnerPlayer, isTyping: false },
    };
    lastLocalMutationRef.current[roomCode] = now;
    const next = { ...prev, [roomCode]: updated };
    roomsRef.current = next;
    saveRooms(next);
    setRooms(next);
    broadcastRoomUpdate(updated, profile.playerId);
    void updateRemoteRoomState(updated);
  };

  const handleUseHint = (roomCode: string): boolean => {
    if (!profile || profile.stars < 1) return false;

    const updatedProfile = { ...profile, stars: profile.stars - 1 };
    profileRef.current = updatedProfile;
    saveProfile(updatedProfile);
    setProfile(updatedProfile);

    const prev = roomsRef.current;
    const room = prev[roomCode];
    if (room) {
      const updated = { ...room, hintsUsed: room.hintsUsed + 1 };
      const next = { ...prev, [roomCode]: updated };
      roomsRef.current = next;
      saveRooms(next);
      setRooms(next);
      void updateRemoteRoomState(updated);
    }
    return true;
  };

  const handleRematch = (oldRoomCode: string) => {
    if (!profile) return;
    const oldRoom = roomsRef.current[oldRoomCode];
    if (!oldRoom) return;

    const { partner: otherPlayer } = resolveRoomParticipants(oldRoom, profile);
    const rematchMode: GameMode = oldRoom.mode === 'daily' ? 'coop' : oldRoom.mode;

    const pair = generateWordPair(
      oldRoom.language,
      oldRoom.wordLength,
      rematchMode,
      oldRoom.startWord
    );

    const newCode = generateRoomCode(pair.startWord, Object.keys(roomsRef.current));

    const nextPartner =
      isWaitingPartner(otherPlayer.playerId) || otherPlayer.playerId === profile.playerId
        ? createWaitingPartnerPresence()
        : isBotPartner(otherPlayer.playerId)
        ? createMiyuPresence()
        : { ...otherPlayer, isTyping: false };
    const nextAutoBot = isBotPartner(nextPartner.playerId);

    const now = Date.now();
    const freshRoom: GameRoom = {
      code: newCode,
      language: oldRoom.language,
      wordLength: oldRoom.wordLength,
      mode: rematchMode,
      startWord: pair.startWord,
      targetWord: pair.targetWord,
      currentWord: pair.startWord,
      optimalPar: pair.optimalPar,
      optimalPath: pair.optimalPath,
      moves: [],
      undoPenaltyCount: 0,
      hintsUsed: 0,
      currentTurnPlayerId: profile.playerId,
      turnStartedAt: now,
      lastTurnPass: undefined,
      hostPlayer: {
        playerId: profile.playerId,
        name: profile.name,
        avatarId: profile.avatarId,
        color: profile.color,
        online: true,
        isTyping: false,
        lastSeen: now,
      },
      partnerPlayer: nextPartner,
      autoPartnerEnabled: nextAutoBot,
      status: 'active',
      startedAt: now,
      completedAt: undefined,
      winnerPlayerId: undefined,
      abandoned: undefined,
      abandonedByPlayerId: undefined,
      abandonedByName: undefined,
    };

    lastLocalMutationRef.current[newCode] = now;
    const next = { ...roomsRef.current, [newCode]: freshRoom };
    roomsRef.current = next;
    saveRooms(next);
    setRooms(next);
    void createOrUpsertRemoteRoom(freshRoom);
    broadcastRoomUpdate(freshRoom, profile.playerId, oldRoom.code);
    setActiveRoomCode(newCode);
    setScreen('board');
  };

  const handleEnableBot = useCallback((roomCode: string) => {
    const activeProfile = profileRef.current;
    const room = roomsRef.current[roomCode];
    if (!activeProfile || !room || room.status !== 'active') return;
    if (!isWaitingPartner(room.partnerPlayer.playerId)) return;

    const now = Date.now();
    lastLocalMutationRef.current[roomCode] = now;
    const updated: GameRoom = {
      ...room,
      partnerPlayer: createMiyuPresence(),
      autoPartnerEnabled: true,
      currentTurnPlayerId:
        room.currentTurnPlayerId === WAITING_PARTNER_ID ? MIYU_BOT_ID : room.currentTurnPlayerId,
      turnStartedAt: now,
    };
    const next = { ...roomsRef.current, [roomCode]: updated };
    roomsRef.current = next;
    saveRooms(next);
    setRooms(next);
  }, []);

  const handleEndGame = useCallback((roomCode: string) => {
    const activeProfile = profileRef.current;
    const room = roomsRef.current[roomCode];
    if (!activeProfile || !room || room.status === 'completed') return;

    const now = Date.now();
    lastLocalMutationRef.current[roomCode] = now;
    const endedRoom: GameRoom = {
      ...room,
      status: 'completed',
      completedAt: now,
      winnerPlayerId: undefined,
      abandoned: true,
      abandonedByPlayerId: activeProfile.playerId,
      abandonedByName: activeProfile.name,
      hostPlayer: { ...room.hostPlayer, isTyping: false },
      partnerPlayer: { ...room.partnerPlayer, isTyping: false },
    };

    const next = { ...roomsRef.current, [roomCode]: endedRoom };
    roomsRef.current = next;
    saveRooms(next);
    setRooms(next);
    broadcastRoomUpdate(endedRoom, activeProfile.playerId);
    void updateRemoteRoomState(endedRoom);
    completeRoomVictoryRef.current(endedRoom);
  }, []);

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
    profileRef.current = updated;
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
    profileRef.current = updated;
    saveProfile(updated);
    setProfile(updated);
    return true;
  };

  const activeRoom = activeRoomCode ? rooms[activeRoomCode] : null;

  useEffect(() => {
    if (screen === 'board' && activeRoom && activeRoom.status === 'completed') {
      const delay = activeRoom.abandoned ? 0 : 380;
      const timer = window.setTimeout(() => completeRoomVictoryRef.current(activeRoom), delay);
      return () => window.clearTimeout(timer);
    }
  }, [screen, activeRoom?.code, activeRoom?.status, activeRoom?.abandoned]);

  // Auto-launch Hub & Board Duolingo App Tour once on first visit
  useEffect(() => {
    if (!profile || showCreateSheet) {
      if (activeTour) setActiveTour(null);
      return;
    }

    if (screen !== 'hub' && activeTour === 'hub') {
      setActiveTour(null);
      return;
    }
    if (screen !== 'board' && activeTour === 'board') {
      setActiveTour(null);
      return;
    }

    if (screen === 'hub' && !tourState.hubDone && activeTour === null) {
      const timer = window.setTimeout(() => setActiveTour('hub'), 380);
      return () => window.clearTimeout(timer);
    }

    if (
      screen === 'board' &&
      activeRoom &&
      activeRoom.status === 'active' &&
      !tourState.boardDone &&
      activeTour === null
    ) {
      const timer = window.setTimeout(() => setActiveTour('board'), 380);
      return () => window.clearTimeout(timer);
    }
  }, [
    profile?.playerId,
    showCreateSheet,
    screen,
    activeRoom?.code,
    activeRoom?.status,
    tourState.hubDone,
    tourState.boardDone,
    activeTour,
  ]);

  const handleFinishTour = useCallback(() => {
    const closing = activeTour;
    if (!closing) return;
    setTourState(markTourDone(closing));
    setActiveTour(null);

    if (closing === 'board' && activeRoomCode) {
      const prevRooms = roomsRef.current;
      const room = prevRooms[activeRoomCode];
      if (room && room.status === 'active' && isBotPartner(room.partnerPlayer.playerId)) {
        const refreshed: GameRoom = {
          ...room,
          turnStartedAt: Date.now(),
        };
        const nextRooms = { ...prevRooms, [activeRoomCode]: refreshed };
        roomsRef.current = nextRooms;
        saveRooms(nextRooms);
        setRooms(nextRooms);
      }
    }
  }, [activeTour, activeRoomCode]);

  const tourSteps = useMemo<TourStep[]>(() => {
    if (activeTour === 'hub') {
      return [
        {
          id: 'hub-profile',
          targetSelector: '[data-tour="hub-profile"]',
          title: t('tour.hub.profile.title'),
          description: t('tour.hub.profile.desc'),
          preferredPlacement: 'bottom',
          highlightRadius: 18,
          padding: 6,
        },
        {
          id: 'hub-active-games',
          targetSelector: '[data-tour="hub-active-games"]',
          title: t('tour.hub.activeGames.title'),
          description: t('tour.hub.activeGames.desc'),
          preferredPlacement: 'bottom',
          highlightRadius: 18,
          padding: 6,
        },
        {
          id: 'hub-start-duel',
          targetSelector: '[data-tour="hub-start-duel"]',
          title: t('tour.hub.startDuel.title'),
          description: t('tour.hub.startDuel.desc'),
          preferredPlacement: 'top',
          highlightRadius: 16,
          padding: 6,
        },
        {
          id: 'hub-daily',
          targetSelector: '[data-tour="hub-daily"]',
          title: t('tour.hub.daily.title'),
          description: t('tour.hub.daily.desc'),
          preferredPlacement: 'top',
          highlightRadius: 18,
          padding: 6,
        },
      ];
    }
    if (activeTour === 'board') {
      return [
        {
          id: 'board-goal',
          targetSelector: '[data-tour="board-goal"]',
          title: t('tour.board.goal.title'),
          description: t('tour.board.goal.desc'),
          preferredPlacement: 'bottom',
          highlightRadius: 14,
          padding: 8,
        },
        {
          id: 'board-tiles',
          targetSelector: '[data-tour="board-tiles"]',
          title: t('tour.board.tiles.title'),
          description: t('tour.board.tiles.desc'),
          preferredPlacement: 'bottom',
          highlightRadius: 16,
          padding: 8,
        },
        {
          id: 'board-turn-status',
          targetSelector: '[data-tour="board-turn-status"]',
          title: t('tour.board.turnStatus.title'),
          description: t('tour.board.turnStatus.desc'),
          preferredPlacement: 'bottom',
          highlightRadius: 16,
          padding: 6,
        },
        {
          id: 'board-tools',
          targetSelector: '[data-tour="board-tools"]',
          title: t('tour.board.tools.title'),
          description: t('tour.board.tools.desc'),
          preferredPlacement: 'top',
          highlightRadius: 14,
          padding: 6,
        },
        {
          id: 'board-submit',
          targetSelector: '[data-tour="board-submit"]',
          title: t('tour.board.submit.title'),
          description: t('tour.board.submit.desc'),
          preferredPlacement: 'top',
          highlightRadius: 16,
          padding: 6,
        },
      ];
    }
    return [];
  }, [activeTour, t]);

  const handleOpenRoom = useCallback((code: string) => {
    const prevRooms = roomsRef.current;
    const room = prevRooms[code];
    if (room && room.status === 'active' && isBotPartner(room.partnerPlayer.playerId)) {
      const now = Date.now();
      const refreshed: GameRoom = {
        ...room,
        turnStartedAt: now,
        hostPlayer: { ...room.hostPlayer, isTyping: false },
        partnerPlayer: { ...room.partnerPlayer, isTyping: false },
      };
      const nextRooms = { ...prevRooms, [code]: refreshed };
      roomsRef.current = nextRooms;
      saveRooms(nextRooms);
      setRooms(nextRooms);
    }
    setActiveRoomCode(code);
    setScreen(room?.status === 'completed' ? 'victory' : 'board');
  }, []);

  if (!profile) {
    return (
      <OnboardingScreen
        pendingJoinCode={pendingJoinCode}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  return (
    <div className="min-h-dvh w-full" style={{ backgroundColor: 'var(--bg-app)' }}>
      {screen === 'hub' && (
        <HubScreen
          profile={profile}
          rooms={Object.values(rooms)}
          joinNotice={hubNotice}
          onDismissJoinNotice={() => setHubNotice(null)}
          onOpenRoom={handleOpenRoom}
          onOpenCreateDuel={(daily = false) => {
            setCreateSheetDaily(daily);
            setShowCreateSheet(true);
          }}
          onJoinByCode={handleJoinByCode}
          onOpenCollection={() => setScreen('collection')}
          onStartTour={() => setActiveTour('hub')}
        />
      )}

      {screen === 'board' && activeRoom && (
        <GameBoardScreen
          key={activeRoom.code}
          room={activeRoom}
          profile={profile}
          onBackToHub={() => setScreen('hub')}
          onSubmitMove={handleSubmitMove}
          onUndoMove={handleUndoMove}
          onUseHint={handleUseHint}
          onEnableBot={handleEnableBot}
          onEndGame={handleEndGame}
          onOpenVictory={(code) => {
            setActiveRoomCode(code);
            setScreen('victory');
          }}
          onStartTour={() => setActiveTour('board')}
          tourPaused={isBoardTourOpen}
        />
      )}

      {screen === 'victory' && activeRoom && (
        <VictoryScreen
          key={activeRoom.code}
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

      <AppTour
        open={activeTour !== null}
        steps={tourSteps}
        onComplete={handleFinishTour}
        onSkip={handleFinishTour}
      />
    </div>
  );
}

export default App;
