import { findShortestPath, generateWordPair, isOneLetterDiff } from '../engine/wordLadder';
import {
  broadcastSupabaseRoomUpdate,
  broadcastSupabaseTyping,
  CAROLE_PARTNER_ID,
  claimRemoteRoomByCode,
  createMiyuPresence,
  createOrUpsertRemoteRoom,
  createWaitingPartnerPresence,
  ensureSupabaseSession,
  fetchProfileRemote,
  getSupabaseClient,
  hydrateLocalProfileFromRemote,
  isBotPartner,
  isWaitingPartner,
  loadRemoteRooms,
  MIYU_BOT_ID,
  pushRemoteMove,
  type RoomUpdateMeta,
  STARTER_ROOM_CODE,
  subscribeSupabaseSync,
  updateRemoteRoomState,
  upsertProfileRemote,
  WAITING_PARTNER_ID,
} from './supabaseClient';
import type {
  AvatarId,
  GameMode,
  GameRoom,
  Language,
  PlayerPresence,
  PlayerProfile,
  WordLength,
  WordMove,
} from '../types/game';

const PROFILE_KEY = 'lets_turn_profile_v1';
const ROOMS_KEY = 'lets_turn_rooms_v1';
const CHANNEL_NAME = 'lets_turn_realtime_v1';
const STREAK_ZERO_MIGRATION_KEY = 'lets_turn_streak_zero_v1';

export const TURN_TIMEOUT_MS = 30_000;
export const BOT_PROPOSAL_DELAY_MS = 20_000;

export function passTurnIfExpired(
  room: GameRoom,
  now = Date.now(),
  graceMs = 0
): GameRoom | null {
  if (room.status !== 'active') return null;
  if (
    room.autoPartnerEnabled ||
    isBotPartner(room.partnerPlayer.playerId) ||
    isWaitingPartner(room.partnerPlayer.playerId)
  ) {
    return null;
  }
  if (room.hostPlayer.playerId === room.partnerPlayer.playerId) return null;
  const turnStart = room.turnStartedAt ?? room.startedAt;
  if (now - turnStart < TURN_TIMEOUT_MS + graceMs) return null;

  const isHostTurn = room.hostPlayer.playerId === room.currentTurnPlayerId;
  const timedOutPlayer = isHostTurn ? room.hostPlayer : room.partnerPlayer;
  const nextPlayer = isHostTurn ? room.partnerPlayer : room.hostPlayer;
  if (timedOutPlayer.playerId === nextPlayer.playerId) return null;

  return {
    ...room,
    currentTurnPlayerId: nextPlayer.playerId,
    turnStartedAt: now,
    hostPlayer: { ...room.hostPlayer, isTyping: false },
    partnerPlayer: { ...room.partnerPlayer, isTyping: false },
    lastTurnPass: {
      id: `turn-pass-${now}-${Math.random().toString(36).slice(2, 6)}`,
      fromPlayerId: timedOutPlayer.playerId,
      fromPlayerName: timedOutPlayer.name,
      toPlayerId: nextPlayer.playerId,
      toPlayerName: nextPlayer.name,
      timestamp: now,
    },
  };
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function loadProfile(): PlayerProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerProfile;
    if (!localStorage.getItem(STREAK_ZERO_MIGRATION_KEY)) {
      parsed.streak = 0;
      parsed.lastPlayedDate = null;
      parsed.unlockedBadges = (parsed.unlockedBadges ?? []).filter(
        (id) => id !== 'inseparable'
      );
      saveProfile(parsed);
      localStorage.setItem(STREAK_ZERO_MIGRATION_KEY, '1');
    }
    return parsed;
  } catch {
    return null;
  }
}

export function createInitialProfile(
  name: string,
  avatarId: AvatarId,
  color: string,
  explicitPlayerId?: string
): PlayerProfile {
  const profile: PlayerProfile = {
    playerId: explicitPlayerId || generateUuid(),
    name: name.trim() || 'Alex',
    avatarId,
    color,
    xp: 420,
    stars: 18,
    streak: 0,
    lastPlayedDate: null,
    gamesPlayed: 12,
    gamesWon: 11,
    optimalWins: 4,
    noHintWins: 3,
    fastestWinSeconds: 52,
    longestWordSolved: 4,
    uniqueWordsUsed: ['WINE', 'WING', 'SING', 'COLD', 'WARM', 'LOVE', 'HATE'],
    unlockedBadges: [],
    unlockedThemes: ['classic'],
    activeTheme: 'classic',
    unlockedAvatars: [0, 1, 2, 3, 4, 5],
    unlockedParticles: ['confetti'],
    activeParticle: 'confetti',
    savedBestChains: [
      {
        id: 'seed-chain-1',
        startWord: 'COLD',
        targetWord: 'WARM',
        words: ['COLD', 'WOLD', 'WORD', 'WARD', 'WARM'],
        optimalSteps: 4,
        actualSteps: 4,
        partnerName: 'Carole',
        language: 'EN',
        completedAt: Date.now() - 86400 * 1000,
      },
    ],
  };
  saveProfile(profile);
  localStorage.setItem(STREAK_ZERO_MIGRATION_KEY, '1');
  return profile;
}

export function saveProfile(profile: PlayerProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  void upsertProfileRemote(profile);
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseClient() !== null;
}

export {
  createMiyuPresence,
  createOrUpsertRemoteRoom,
  createWaitingPartnerPresence,
  ensureSupabaseSession,
  isBotPartner,
  isWaitingPartner,
  MIYU_BOT_ID,
  pushRemoteMove,
  type RoomUpdateMeta,
  updateRemoteRoomState,
  WAITING_PARTNER_ID,
};

function migrateLocalPlayerId(
  profile: PlayerProfile,
  rooms: Record<string, GameRoom>,
  newId: string
): { profile: PlayerProfile; rooms: Record<string, GameRoom> } {
  const oldId = profile.playerId;
  if (oldId === newId) return { profile, rooms };

  const updatedProfile: PlayerProfile = { ...profile, playerId: newId };
  const updatedRooms: Record<string, GameRoom> = {};

  for (const [code, room] of Object.entries(rooms)) {
    const isHost = room.hostPlayer.playerId === oldId;
    const isPartner = room.partnerPlayer.playerId === oldId;
    updatedRooms[code] = {
      ...room,
      hostPlayer: isHost ? { ...room.hostPlayer, playerId: newId } : room.hostPlayer,
      partnerPlayer: isPartner
        ? { ...room.partnerPlayer, playerId: newId }
        : room.partnerPlayer,
      currentTurnPlayerId:
        room.currentTurnPlayerId === oldId ? newId : room.currentTurnPlayerId,
      winnerPlayerId: room.winnerPlayerId === oldId ? newId : room.winnerPlayerId,
      moves: room.moves.map((m) =>
        m.playerId === oldId ? { ...m, playerId: newId } : m
      ),
    };
  }

  localStorage.setItem(PROFILE_KEY, JSON.stringify(updatedProfile));
  saveRooms(updatedRooms);
  return { profile: updatedProfile, rooms: updatedRooms };
}

export async function bootstrapSupabaseState(
  localProfile: PlayerProfile | null,
  localRooms: Record<string, GameRoom>
): Promise<{ profile: PlayerProfile | null; rooms: Record<string, GameRoom> }> {
  const uid = await ensureSupabaseSession();
  if (!uid) return { profile: localProfile, rooms: localRooms };

  if (!localProfile) {
    const remoteProfile = await fetchProfileRemote(uid);
    if (!remoteProfile) return { profile: null, rooms: localRooms };
    const hydrated = hydrateLocalProfileFromRemote(remoteProfile);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(hydrated));
    const baseRooms = loadRooms(hydrated);
    const remoteRooms = await loadRemoteRooms(uid, baseRooms);
    const merged = { ...baseRooms, ...remoteRooms };
    saveRooms(merged);
    return { profile: hydrated, rooms: merged };
  }

  const migrated = migrateLocalPlayerId(localProfile, localRooms, uid);
  await upsertProfileRemote(migrated.profile);

  const remoteRooms = await loadRemoteRooms(uid, migrated.rooms);
  const mergedRooms: Record<string, GameRoom> = { ...migrated.rooms };

  for (const [code, remoteRoom] of Object.entries(remoteRooms)) {
    const existing = mergedRooms[code];
    if (!existing) {
      mergedRooms[code] = remoteRoom;
      continue;
    }
    const existingAuto = existing.autoPartnerEnabled;
    const remoteHasRealPartner = !remoteRoom.autoPartnerEnabled;
    if (
      remoteRoom.status === 'completed' ||
      remoteRoom.moves.length > existing.moves.length ||
      (existingAuto && remoteHasRealPartner)
    ) {
      mergedRooms[code] = remoteRoom;
    }
  }

  // Push any local custom rooms hosted by this user that aren't in Supabase yet
  for (const room of Object.values(mergedRooms)) {
    if (
      room.code !== STARTER_ROOM_CODE &&
      !remoteRooms[room.code] &&
      room.hostPlayer.playerId === uid
    ) {
      void createOrUpsertRemoteRoom(room);
    }
  }

  saveRooms(mergedRooms);
  return { profile: migrated.profile, rooms: mergedRooms };
}

export function createFigmaStarterRoom(host: PlayerProfile): GameRoom {
  const optimalPath = findShortestPath('WINE', 'SLIM', 'EN') ?? [
    'WINE',
    'SINE',
    'SANE',
    'SAND',
    'SAID',
    'SLID',
    'SLIM',
  ];

  const partner: PlayerPresence = createMiyuPresence();

  const hostPresence: PlayerPresence = {
    playerId: host.playerId,
    name: host.name,
    avatarId: host.avatarId,
    color: host.color,
    online: true,
    isTyping: false,
    lastSeen: Date.now(),
  };

  // Initial state matching Figma frame 1:5:
  // WINE -> WING (so active tiles show WING and it's user's turn to play next, e.g. SING!)
  const firstMove: WordMove = {
    id: 'move-seed-1',
    word: 'WING',
    previousWord: 'WINE',
    changedIndex: 3,
    fromChar: 'E',
    toChar: 'G',
    playerId: MIYU_BOT_ID,
    playerName: 'Miyu',
    playerAvatarId: 5,
    playerColor: '#ff9600',
    timestamp: Date.now() - 95 * 1000,
  };

  return {
    code: 'WINE-42',
    language: 'EN',
    wordLength: 4,
    mode: 'coop',
    startWord: 'WINE',
    targetWord: 'SLIM',
    currentWord: 'WING',
    optimalPar: optimalPath.length - 1,
    optimalPath,
    moves: [firstMove],
    undoPenaltyCount: 0,
    hintsUsed: 0,
    currentTurnPlayerId: host.playerId,
    turnStartedAt: Date.now(),
    hostPlayer: hostPresence,
    partnerPlayer: partner,
    autoPartnerEnabled: true,
    status: 'active',
    startedAt: Date.now() - 120 * 1000,
  };
}

export function loadRooms(profile: PlayerProfile): Record<string, GameRoom> {
  try {
    const raw = localStorage.getItem(ROOMS_KEY);
    if (!raw) {
      const starter = createFigmaStarterRoom(profile);
      const initial = { [starter.code]: starter };
      saveRooms(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as Record<string, GameRoom>;
    if (Object.keys(parsed).length === 0) {
      const starter = createFigmaStarterRoom(profile);
      const initial = { [starter.code]: starter };
      saveRooms(initial);
      return initial;
    }
    const now = Date.now();
    const normalized: Record<string, GameRoom> = {};
    for (const [code, room] of Object.entries(parsed)) {
      const isBot = isBotPartner(room.partnerPlayer.playerId);
      const waiting = isWaitingPartner(room.partnerPlayer.playerId);
      const autoPartnerEnabled = isBot;
      const partnerPlayer = isBot
        ? createMiyuPresence()
        : waiting
        ? createWaitingPartnerPresence()
        : room.partnerPlayer;
      const moves = isBot
        ? room.moves.map((m) =>
            m.playerId === CAROLE_PARTNER_ID
              ? { ...m, playerId: MIYU_BOT_ID, playerName: 'Miyu', playerColor: '#ff9600' }
              : m
          )
        : room.moves;
      const currentTurnPlayerId =
        isBot && room.currentTurnPlayerId === CAROLE_PARTNER_ID
          ? MIYU_BOT_ID
          : room.currentTurnPlayerId;

      const lastMoveTs = moves[moves.length - 1]?.timestamp;
      const baseTurnStart = room.turnStartedAt ?? lastMoveTs ?? room.startedAt;
      let nextRoom: GameRoom = {
        ...room,
        partnerPlayer,
        moves,
        currentTurnPlayerId,
        autoPartnerEnabled,
        turnStartedAt: baseTurnStart,
      };
      if (nextRoom.status === 'active' && !isBot && !waiting) {
        if (nextRoom.currentTurnPlayerId !== profile.playerId) {
          const passed = passTurnIfExpired(nextRoom, now);
          if (passed) nextRoom = passed;
        } else if (now - baseTurnStart >= TURN_TIMEOUT_MS) {
          nextRoom = { ...nextRoom, turnStartedAt: now };
        }
      }
      normalized[code] = nextRoom;
    }
    return normalized;
  } catch {
    const starter = createFigmaStarterRoom(profile);
    return { [starter.code]: starter };
  }
}

export function saveRooms(rooms: Record<string, GameRoom>): void {
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
}

export function generateRoomCode(startWord: string): string {
  const num = Math.floor(10 + Math.random() * 89);
  return `${startWord.slice(0, 4).toUpperCase()}-${num}`;
}

export function createNewRoom(
  profile: PlayerProfile,
  language: Language,
  wordLength: WordLength,
  mode: GameMode,
  avoidStartWord?: string
): GameRoom {
  const pair = generateWordPair(language, wordLength, mode, avoidStartWord);
  const code =
    mode === 'daily'
      ? `DAY-${language}${wordLength}-${profile.playerId.slice(0, 4).toUpperCase()}`
      : generateRoomCode(pair.startWord);

  const hostPresence: PlayerPresence = {
    playerId: profile.playerId,
    name: profile.name,
    avatarId: profile.avatarId,
    color: profile.color,
    online: true,
    isTyping: false,
    lastSeen: Date.now(),
  };

  const partnerPresence: PlayerPresence = createWaitingPartnerPresence();

  return {
    code,
    language,
    wordLength,
    mode,
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
    hostPlayer: hostPresence,
    partnerPlayer: partnerPresence,
    autoPartnerEnabled: false,
    status: 'active',
    startedAt: Date.now(),
  };
}

export function joinOrCreateRoomByCode(codeRaw: string, player: PlayerProfile): GameRoom {
  const cleanCode = codeRaw.trim().toUpperCase();
  const rooms = loadRooms(player);
  if (rooms[cleanCode]) {
    const existing = rooms[cleanCode];
    // If another tab/device joins as player 2, attach them as partner if they have a different playerId
    if (
      existing.hostPlayer.playerId !== player.playerId &&
      (isWaitingPartner(existing.partnerPlayer.playerId) ||
        isBotPartner(existing.partnerPlayer.playerId))
    ) {
      const nextTurn =
        existing.currentTurnPlayerId === existing.hostPlayer.playerId
          ? existing.hostPlayer.playerId
          : player.playerId;
      const updated: GameRoom = {
        ...existing,
        autoPartnerEnabled: false,
        currentTurnPlayerId: nextTurn,
        turnStartedAt: Date.now(),
        partnerPlayer: {
          playerId: player.playerId,
          name: player.name,
          avatarId: player.avatarId,
          color: player.color,
          online: true,
          isTyping: false,
          lastSeen: Date.now(),
        },
      };
      rooms[cleanCode] = updated;
      saveRooms(rooms);
      broadcastRoomUpdate(updated);
      return updated;
    }
    return existing;
  }

  // Create a room with this custom code if it didn't exist locally yet
  const fresh = createNewRoom(player, 'EN', 4, 'coop');
  fresh.code = cleanCode;
  rooms[cleanCode] = fresh;
  saveRooms(rooms);
  broadcastRoomUpdate(fresh);
  return fresh;
}

export async function joinRoomRemoteOrLocal(
  codeRaw: string,
  player: PlayerProfile
): Promise<GameRoom> {
  const cleanCode = codeRaw.trim().toUpperCase();
  const uid = await ensureSupabaseSession();
  const resolvedPlayer = uid && player.playerId !== uid ? { ...player, playerId: uid } : player;

  if (cleanCode !== STARTER_ROOM_CODE) {
    const remoteRoom = await claimRemoteRoomByCode(cleanCode, resolvedPlayer);
    if (remoteRoom) {
      const rooms = loadRooms(resolvedPlayer);
      rooms[cleanCode] = remoteRoom;
      saveRooms(rooms);
      broadcastRoomUpdate(remoteRoom, resolvedPlayer.playerId);
      return remoteRoom;
    }
  }
  const localRoom = joinOrCreateRoomByCode(cleanCode, resolvedPlayer);
  if (
    cleanCode !== STARTER_ROOM_CODE &&
    localRoom.hostPlayer.playerId === resolvedPlayer.playerId
  ) {
    void createOrUpsertRemoteRoom(localRoom);
  }
  return localRoom;
}

export function pickSmartPartnerMove(room: GameRoom, partner: PlayerPresence): WordMove | null {
  const path = findShortestPath(room.currentWord, room.targetWord, room.language);
  if (!path || path.length < 2) return null;

  const nextWord = path[1];
  const diff = isOneLetterDiff(room.currentWord, nextWord);
  if (!diff.valid) return null;

  return {
    id: generateUuid(),
    word: nextWord,
    previousWord: room.currentWord,
    changedIndex: diff.changedIndex,
    fromChar: diff.fromChar,
    toChar: diff.toChar,
    playerId: partner.playerId,
    playerName: partner.name,
    playerAvatarId: partner.avatarId,
    playerColor: partner.color,
    timestamp: Date.now(),
  };
}

// BroadcastChannel + localStorage + Supabase Realtime sync
type SyncEvent =
  | { type: 'ROOM_UPDATED'; room: GameRoom; senderId: string; rematchFromCode?: string }
  | { type: 'TYPING_STATE'; roomCode: string; playerId: string; isTyping: boolean };

let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

export function broadcastRoomUpdate(
  room: GameRoom,
  senderId = '',
  rematchFromCode?: string
): void {
  try {
    getChannel()?.postMessage({
      type: 'ROOM_UPDATED',
      room,
      senderId,
      ...(rematchFromCode ? { rematchFromCode } : {}),
    } satisfies SyncEvent);
  } catch {
    // Ignore channel errors
  }
  broadcastSupabaseRoomUpdate(room, senderId, rematchFromCode);
}

export function broadcastTypingState(
  roomCode: string,
  playerId: string,
  isTyping: boolean
): void {
  try {
    getChannel()?.postMessage({
      type: 'TYPING_STATE',
      roomCode,
      playerId,
      isTyping,
    } satisfies SyncEvent);
  } catch {
    // Ignore
  }
  broadcastSupabaseTyping(roomCode, playerId, isTyping);
}

export function subscribeRealtimeSync(
  playerId: string,
  onRoomUpdate: (room: GameRoom, meta?: RoomUpdateMeta) => void,
  onTypingChange?: (roomCode: string, playerId: string, isTyping: boolean) => void
): () => void {
  const ch = getChannel();
  const handleMessage = (ev: MessageEvent<SyncEvent>) => {
    const data = ev.data;
    if (!data) return;
    if (data.type === 'ROOM_UPDATED') {
      onRoomUpdate(
        data.room,
        data.rematchFromCode ? { rematchFromCode: data.rematchFromCode } : undefined
      );
    } else if (data.type === 'TYPING_STATE' && onTypingChange) {
      onTypingChange(data.roomCode, data.playerId, data.isTyping);
    }
  };
  ch?.addEventListener('message', handleMessage);

  const handleStorage = (ev: StorageEvent) => {
    if (ev.key === ROOMS_KEY && ev.newValue) {
      try {
        const rooms = JSON.parse(ev.newValue) as Record<string, GameRoom>;
        Object.values(rooms).forEach((room) => onRoomUpdate(room));
      } catch {
        // Ignore parse error
      }
    }
  };
  window.addEventListener('storage', handleStorage);

  const unsubscribeSupabase = subscribeSupabaseSync(playerId, onRoomUpdate, onTypingChange);

  return () => {
    ch?.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
    unsubscribeSupabase();
  };
}

export async function requestPushPermissionAndNotify(title: string, body: string): Promise<void> {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      return;
    }
  }
  if (Notification.permission === 'granted' && document.hidden) {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
        });
      } else {
        new Notification(title, { body, icon: '/icon-192.png' });
      }
    } catch {
      // Ignore notification failure in restricted environments
    }
  }
}
