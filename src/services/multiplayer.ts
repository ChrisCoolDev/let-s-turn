import {
  findShortestPath,
  findShortestPathExcluding,
  findValidNeighbors,
  generateWordPair,
  isOneLetterDiff,
} from '../engine/wordLadder';
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
const CLEAN_SEED_STATS_MIGRATION_KEY = 'lets_turn_clean_seed_v1';

export const TURN_TIMEOUT_MS = 30_000;
export const BOT_PROPOSAL_DELAY_MS = 20_000;

export function passTurnIfExpired(
  room: GameRoom,
  now = Date.now(),
  graceMs = 0
): GameRoom | null {
  if (room.status !== 'active') return null;
  if (isWaitingPartner(room.partnerPlayer.playerId)) {
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
    let dirty = false;

    if (!localStorage.getItem(STREAK_ZERO_MIGRATION_KEY)) {
      parsed.streak = 0;
      parsed.lastPlayedDate = null;
      parsed.unlockedBadges = (parsed.unlockedBadges ?? []).filter(
        (id) => id !== 'inseparable'
      );
      localStorage.setItem(STREAK_ZERO_MIGRATION_KEY, '1');
      dirty = true;
    }

    // Remove legacy fake seed stats ("Carole" COLD->WARM, 12 fake games, 420 fake XP)
    if (!localStorage.getItem(CLEAN_SEED_STATS_MIGRATION_KEY)) {
      const hadSeedChain = (parsed.savedBestChains ?? []).some((c) => c.id === 'seed-chain-1');
      if (hadSeedChain) {
        parsed.savedBestChains = (parsed.savedBestChains ?? []).filter(
          (c) => c.id !== 'seed-chain-1'
        );
        const realGamesPlayed = Math.max(0, (parsed.gamesPlayed ?? 0) - 12);
        const realGamesWon = Math.max(0, (parsed.gamesWon ?? 0) - 11);
        parsed.gamesPlayed = realGamesPlayed;
        parsed.gamesWon = realGamesWon;
        parsed.optimalWins = Math.max(0, (parsed.optimalWins ?? 0) - 4);
        parsed.noHintWins = Math.max(0, (parsed.noHintWins ?? 0) - 3);
        parsed.xp = Math.max(0, (parsed.xp ?? 0) - 420);
        if (realGamesWon === 0) {
          parsed.fastestWinSeconds = null;
          parsed.uniqueWordsUsed = [];
        }
        dirty = true;
      }
      localStorage.setItem(CLEAN_SEED_STATS_MIGRATION_KEY, '1');
    }

    if (dirty) {
      saveProfile(parsed);
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
    xp: 0,
    stars: 5,
    streak: 0,
    lastPlayedDate: null,
    gamesPlayed: 0,
    gamesWon: 0,
    optimalWins: 0,
    noHintWins: 0,
    fastestWinSeconds: null,
    longestWordSolved: 4,
    uniqueWordsUsed: [],
    unlockedBadges: [],
    unlockedThemes: ['classic'],
    activeTheme: 'classic',
    unlockedAvatars: [0, 1, 2, 3, 4, 5],
    unlockedParticles: ['confetti'],
    activeParticle: 'confetti',
    savedBestChains: [],
  };
  saveProfile(profile);
  localStorage.setItem(STREAK_ZERO_MIGRATION_KEY, '1');
  localStorage.setItem(CLEAN_SEED_STATS_MIGRATION_KEY, '1');
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
  upsertProfileRemote,
  WAITING_PARTNER_ID,
};

export interface ResolvedParticipants {
  isHost: boolean;
  me: PlayerPresence;
  partner: PlayerPresence;
  waitingForPartner: boolean;
  isBot: boolean;
  isMyTurn: boolean;
}

export function resolveRoomParticipants(
  room: GameRoom,
  profile: Pick<PlayerProfile, 'playerId' | 'name'>
): ResolvedParticipants {
  const sameBothSlots = room.hostPlayer.playerId === room.partnerPlayer.playerId;

  let isHost: boolean;
  if (room.hostPlayer.playerId === profile.playerId) {
    isHost = true;
  } else if (room.partnerPlayer.playerId === profile.playerId) {
    isHost = false;
  } else {
    const myName = profile.name.trim().toLowerCase();
    const hostNameMatch = room.hostPlayer.name.trim().toLowerCase() === myName;
    const partnerNameMatch = room.partnerPlayer.name.trim().toLowerCase() === myName;
    isHost = hostNameMatch && !partnerNameMatch;
  }

  const me = isHost ? room.hostPlayer : room.partnerPlayer;
  const rawPartner = isHost ? room.partnerPlayer : room.hostPlayer;
  const waitingForPartner =
    sameBothSlots ||
    isWaitingPartner(rawPartner.playerId) ||
    rawPartner.playerId === profile.playerId;
  const partner = waitingForPartner ? createWaitingPartnerPresence() : rawPartner;
  const isBot = !waitingForPartner && isBotPartner(partner.playerId);

  const matchedById =
    room.hostPlayer.playerId === profile.playerId ||
    room.partnerPlayer.playerId === profile.playerId;
  const isMyTurn = matchedById
    ? room.currentTurnPlayerId === profile.playerId
    : room.currentTurnPlayerId === me.playerId;

  return {
    isHost,
    me,
    partner,
    waitingForPartner,
    isBot,
    isMyTurn,
  };
}

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
    if (existing.status === 'completed' && remoteRoom.status !== 'completed') {
      continue;
    }
    const existingWaitingOrBot =
      existing.autoPartnerEnabled ||
      isWaitingPartner(existing.partnerPlayer.playerId) ||
      isBotPartner(existing.partnerPlayer.playerId);
    const remoteHasRealPartner =
      !remoteRoom.autoPartnerEnabled &&
      !isWaitingPartner(remoteRoom.partnerPlayer.playerId) &&
      !isBotPartner(remoteRoom.partnerPlayer.playerId);
    if (
      remoteRoom.status === 'completed' ||
      remoteRoom.moves.length > existing.moves.length ||
      remoteRoom.undoPenaltyCount > existing.undoPenaltyCount ||
      (existingWaitingOrBot && remoteHasRealPartner) ||
      (remoteRoom.moves.length === existing.moves.length &&
        remoteRoom.currentTurnPlayerId !== existing.currentTurnPlayerId)
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

const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomCodeSegment(length: number): string {
  const out: string[] = [];
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      out.push(ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length]);
    }
  } else {
    for (let i = 0; i < length; i++) {
      out.push(ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]);
    }
  }
  return out.join('');
}

function formatDailyDateStamp(date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

export function generateRoomCode(
  startWord: string,
  existingCodes?: Iterable<string>
): string {
  const taken = new Set(
    existingCodes ? Array.from(existingCodes, (c) => c.toUpperCase()) : []
  );
  taken.add(STARTER_ROOM_CODE);

  const prefix = startWord.slice(0, 4).toUpperCase();
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = `${prefix}-${randomCodeSegment(4)}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${prefix}-${randomCodeSegment(6)}`;
}

export function createNewRoom(
  profile: PlayerProfile,
  language: Language,
  wordLength: WordLength,
  mode: GameMode,
  avoidStartWord?: string,
  existingCodes?: Iterable<string>
): GameRoom {
  const pair = generateWordPair(language, wordLength, mode, avoidStartWord);
  const taken = new Set(
    existingCodes ? Array.from(existingCodes, (c) => c.toUpperCase()) : []
  );
  taken.add(STARTER_ROOM_CODE);

  let code: string;
  if (mode === 'daily') {
    const dayStamp = formatDailyDateStamp();
    const base = `D${dayStamp}-${language}${wordLength}`;
    let candidate = `${base}-${randomCodeSegment(4)}`;
    let guard = 0;
    while (taken.has(candidate) && guard < 50) {
      candidate = `${base}-${randomCodeSegment(4)}`;
      guard++;
    }
    code = candidate;
  } else {
    code = generateRoomCode(pair.startWord, taken);
  }

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

export type JoinRoomResult =
  | { status: 'ok'; room: GameRoom; migratedProfile?: PlayerProfile }
  | { status: 'full'; migratedProfile?: PlayerProfile };

export async function joinRoomRemoteOrLocal(
  codeRaw: string,
  player: PlayerProfile
): Promise<JoinRoomResult> {
  const cleanCode = codeRaw.trim().toUpperCase();
  const uid = await ensureSupabaseSession();

  let resolvedPlayer = player;
  let migratedProfile: PlayerProfile | undefined;
  if (uid && player.playerId !== uid) {
    const migrated = migrateLocalPlayerId(player, loadRooms(player), uid);
    resolvedPlayer = migrated.profile;
    migratedProfile = migrated.profile;
  }

  if (cleanCode !== STARTER_ROOM_CODE) {
    const claimResult = await claimRemoteRoomByCode(cleanCode, resolvedPlayer);
    if (claimResult.status === 'full') {
      return { status: 'full', migratedProfile };
    }
    if (claimResult.status === 'ok') {
      const rooms = loadRooms(resolvedPlayer);
      rooms[cleanCode] = claimResult.room;
      saveRooms(rooms);
      broadcastRoomUpdate(claimResult.room, resolvedPlayer.playerId);
      return { status: 'ok', room: claimResult.room, migratedProfile };
    }
  }

  const localRoom = joinOrCreateRoomByCode(cleanCode, resolvedPlayer);
  if (
    cleanCode !== STARTER_ROOM_CODE &&
    localRoom.hostPlayer.playerId === resolvedPlayer.playerId
  ) {
    void createOrUpsertRemoteRoom(localRoom);
  }
  return { status: 'ok', room: localRoom, migratedProfile };
}

function hammingDistance(a: string, b: string): number {
  let diff = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) diff++;
  }
  return diff + Math.abs(a.length - b.length);
}

export function pickSmartPartnerMove(room: GameRoom, partner: PlayerPresence): WordMove | null {
  const currentUpper = room.currentWord.trim().toUpperCase();
  const targetUpper = room.targetWord.trim().toUpperCase();
  const visited = new Set<string>([
    room.startWord.trim().toUpperCase(),
    ...room.moves.map((m) => m.word.trim().toUpperCase()),
  ]);
  visited.delete(currentUpper);
  visited.delete(targetUpper);

  let nextWord: string | null = null;

  const cleanPath = findShortestPathExcluding(
    room.currentWord,
    room.targetWord,
    room.language,
    visited
  );
  if (cleanPath && cleanPath.length >= 2) {
    nextWord = cleanPath[1];
  } else {
    const fallbackPath = findShortestPath(room.currentWord, room.targetWord, room.language);
    if (fallbackPath && fallbackPath.length >= 2) {
      nextWord = fallbackPath[1];
    } else {
      const neighbors = findValidNeighbors(room.currentWord, room.language);
      if (neighbors.length > 0) {
        const unvisitedNeighbors = neighbors.filter((w) => !visited.has(w));
        const pool = unvisitedNeighbors.length > 0 ? unvisitedNeighbors : neighbors;
        pool.sort((a, b) => hammingDistance(a, targetUpper) - hammingDistance(b, targetUpper));
        nextWord = pool[0];
      }
    }
  }

  if (!nextWord) return null;

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

export interface BotTurnPlan {
  willTimeout: boolean;
  thinkMs: number;
  typingPulses: Array<{ startMs: number; endMs: number }>;
}

export function planBotTurnBehavior(
  room: GameRoom,
  rng: () => number = Math.random
): BotTurnPlan {
  const path = findShortestPath(room.currentWord, room.targetWord, room.language);
  const remainingSteps = path ? Math.max(0, path.length - 1) : 5;

  let timeoutChance = room.wordLength === 5 ? 0.36 : 0.26;
  if (remainingSteps <= 1) {
    timeoutChance -= 0.1;
  } else if (remainingSteps >= 4) {
    timeoutChance += 0.08;
  }
  if (room.lastTurnPass && isBotPartner(room.lastTurnPass.toPlayerId)) {
    timeoutChance += 0.12;
  }
  timeoutChance = Math.min(0.55, Math.max(0.15, timeoutChance));

  const willTimeout = rng() < timeoutChance;
  if (willTimeout) {
    const s1 = Math.round(1500 + rng() * 1500);
    const e1 = s1 + Math.round(2500 + rng() * 1700);
    const s2 = Math.round(10500 + rng() * 3000);
    const e2 = s2 + Math.round(3000 + rng() * 1800);
    const s3 = Math.round(20500 + rng() * 2500);
    const e3 = Math.min(27800, s3 + Math.round(2800 + rng() * 1400));

    return {
      willTimeout: true,
      thinkMs: TURN_TIMEOUT_MS + 5_000,
      typingPulses: [
        { startMs: s1, endMs: e1 },
        { startMs: s2, endMs: e2 },
        { startMs: s3, endMs: e3 },
      ],
    };
  }

  const hardThink = rng() < 0.42;
  if (!hardThink) {
    const thinkMs = Math.round(2800 + rng() * 5700);
    const typingStart = Math.max(600, thinkMs - Math.round(1400 + rng() * 1200));
    return {
      willTimeout: false,
      thinkMs,
      typingPulses: [{ startMs: typingStart, endMs: thinkMs }],
    };
  }

  const thinkMs = Math.round(11500 + rng() * 12500);
  const s1 = Math.round(1800 + rng() * 1400);
  const e1 = s1 + Math.round(2400 + rng() * 1400);
  const s2 = Math.max(e1 + 1500, thinkMs - Math.round(1800 + rng() * 1500));
  return {
    willTimeout: false,
    thinkMs,
    typingPulses: [
      { startMs: s1, endMs: e1 },
      { startMs: s2, endMs: thinkMs },
    ],
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
      onRoomUpdate(data.room, {
        ...(data.rematchFromCode ? { rematchFromCode: data.rematchFromCode } : {}),
        source: 'local',
      });
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

export async function refreshRemoteRooms(
  profile: PlayerProfile,
  currentRooms: Record<string, GameRoom>
): Promise<Record<string, GameRoom> | null> {
  const uid = await ensureSupabaseSession();
  if (!uid) return null;

  const remoteRooms = await loadRemoteRooms(uid, currentRooms);
  if (Object.keys(remoteRooms).length === 0) return null;

  const mergedRooms: Record<string, GameRoom> = { ...currentRooms };
  let changed = false;

  for (const [code, remoteRoom] of Object.entries(remoteRooms)) {
    const existing = mergedRooms[code];
    if (!existing) {
      mergedRooms[code] = remoteRoom;
      changed = true;
      continue;
    }
    if (existing.status === 'completed' && remoteRoom.status !== 'completed') {
      continue;
    }
    const existingWaitingOrBot =
      existing.autoPartnerEnabled ||
      isWaitingPartner(existing.partnerPlayer.playerId) ||
      isBotPartner(existing.partnerPlayer.playerId);
    const remoteHasRealPartner =
      !remoteRoom.autoPartnerEnabled &&
      !isWaitingPartner(remoteRoom.partnerPlayer.playerId) &&
      !isBotPartner(remoteRoom.partnerPlayer.playerId);
    if (
      (remoteRoom.status === 'completed' && existing.status !== 'completed') ||
      remoteRoom.moves.length > existing.moves.length ||
      remoteRoom.undoPenaltyCount > existing.undoPenaltyCount ||
      (existingWaitingOrBot && remoteHasRealPartner) ||
      (remoteRoom.moves.length === existing.moves.length &&
        remoteRoom.currentTurnPlayerId !== existing.currentTurnPlayerId)
    ) {
      mergedRooms[code] = {
        ...remoteRoom,
        turnStartedAt:
          remoteRoom.currentTurnPlayerId !== existing.currentTurnPlayerId ||
          remoteRoom.moves.length > existing.moves.length
            ? Date.now()
            : existing.turnStartedAt ?? remoteRoom.turnStartedAt,
      };
      changed = true;
    }
  }

  if (changed) {
    saveRooms(mergedRooms);
    return mergedRooms;
  }
  return null;
}

export async function requestNotificationPermissionOnGesture(): Promise<void> {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      // Ignore permission rejection
    }
  }
}

export async function requestPushPermissionAndNotify(title: string, body: string): Promise<void> {
  if (typeof Notification === 'undefined') return;
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
