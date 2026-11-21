import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { translate } from '../i18n';
import { getSupabaseConfig } from './supabaseConfig';
import type {
  AvatarId,
  GameMode,
  GameRoom,
  Language,
  NudgeEvent,
  PlayerPresence,
  PlayerProfile,
  QuickReactionEvent,
  ThemeId,
  WordLength,
  WordMove,
} from '../types/game';

export const WAITING_PARTNER_ID = '00000000-0000-0000-0000-000000000000';
export const MIYU_BOT_ID = 'bot-miyu-fixed';
export const CAROLE_PARTNER_ID = 'partner-carole-fixed'; // legacy localStorage compatibility
export const STARTER_ROOM_CODE = 'WINE-42';

export function isWaitingPartner(playerId: string | null | undefined): boolean {
  return !playerId || playerId === WAITING_PARTNER_ID;
}

export function isBotPartner(playerId: string | null | undefined): boolean {
  return playerId === MIYU_BOT_ID || playerId === CAROLE_PARTNER_ID;
}

export interface RoomUpdateMeta {
  rematchFromCode?: string;
  isInsert?: boolean;
  source?: 'broadcast' | 'postgres' | 'local';
}

export type ClaimRemoteRoomResult =
  | { status: 'ok'; room: GameRoom }
  | { status: 'not_found' }
  | { status: 'full' };

interface DbProfileRow {
  id: string;
  name: string;
  avatar_id: number;
  color: string;
  xp: number;
  stars: number;
  streak: number;
  last_played_date: string | null;
  unlocked_badges: string[] | null;
  unlocked_themes: ThemeId[] | null;
  active_theme: ThemeId | null;
}

interface DbRoomRow {
  code: string;
  language: Language;
  word_length: WordLength;
  mode: GameMode;
  start_word: string;
  target_word: string;
  current_word: string;
  optimal_par: number;
  optimal_path: string[] | null;
  host_player_id: string;
  partner_player_id: string | null;
  current_turn_player_id: string;
  undo_penalty_count: number;
  hints_used: number;
  status: 'active' | 'completed';
  winner_player_id: string | null;
  started_at: string;
  completed_at: string | null;
}

interface DbMoveRow {
  id: string;
  room_code: string;
  step_number: number;
  word: string;
  previous_word: string;
  changed_index: number;
  from_char: string;
  to_char: string;
  player_id: string;
  is_undo_penalty: boolean;
  created_at: string;
}

let cachedClient: SupabaseClient | null | undefined;
let authInFlight: Promise<string | null> | null = null;
const profileCache = new Map<string, DbProfileRow>();
const pendingRoomCreates = new Map<string, Promise<boolean>>();

export function isValidUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;
  const config = getSupabaseConfig();
  if (!config.isConfigured || !config.url || !config.anonKey) {
    cachedClient = null;
    return null;
  }
  cachedClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return cachedClient;
}

export async function ensureSupabaseSession(): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  if (authInFlight) return authInFlight;

  authInFlight = (async () => {
    try {
      const { data: sessionData, error: sessionErr } = await client.auth.getSession();
      if (!sessionErr && sessionData.session?.user?.id) {
        return sessionData.session.user.id;
      }
      const { data, error } = await client.auth.signInAnonymously();
      if (error) {
        console.warn('[Supabase] Anonymous sign-in failed:', error.message);
        return null;
      }
      return data.user?.id ?? null;
    } catch (err) {
      console.warn('[Supabase] Auth unavailable, falling back to local mode:', err);
      return null;
    } finally {
      authInFlight = null;
    }
  })();

  return authInFlight;
}

function clampAvatarId(value: number | null | undefined): AvatarId {
  if (typeof value === 'number' && value >= 0 && value <= 5) {
    return value as AvatarId;
  }
  return 1;
}

export function createWaitingPartnerPresence(): PlayerPresence {
  return {
    playerId: WAITING_PARTNER_ID,
    name: translate('common.waiting'),
    avatarId: 5,
    color: '#cbd5e1',
    online: false,
    isTyping: false,
    lastSeen: Date.now(),
  };
}

export function createMiyuPresence(): PlayerPresence {
  return {
    playerId: MIYU_BOT_ID,
    name: 'Miyu',
    avatarId: 5,
    color: '#ff9600',
    online: true,
    isTyping: false,
    lastSeen: Date.now(),
  };
}

export function createCarolePresence(): PlayerPresence {
  return createMiyuPresence();
}

function toPresence(
  row: DbProfileRow | null,
  fallbackId: string,
  fallbackName = translate('common.partner')
): PlayerPresence {
  if (!row) {
    return {
      playerId: fallbackId,
      name: fallbackName,
      avatarId: 2,
      color: '#1cb0f6',
      online: true,
      isTyping: false,
      lastSeen: Date.now(),
    };
  }
  return {
    playerId: row.id,
    name: row.name,
    avatarId: clampAvatarId(row.avatar_id),
    color: row.color || '#58cc02',
    online: true,
    isTyping: false,
    lastSeen: Date.now(),
  };
}

export async function fetchProfileRemote(userId: string): Promise<DbProfileRow | null> {
  if (!isValidUuid(userId)) return null;
  const cached = profileCache.get(userId);
  if (cached) return cached;

  const client = getSupabaseClient();
  if (!client) return null;

  const uid = await ensureSupabaseSession();
  if (!uid) return null;

  const { data, error } = await client
    .from('profiles')
    .select(
      'id, name, avatar_id, color, xp, stars, streak, last_played_date, unlocked_badges, unlocked_themes, active_theme'
    )
    .eq('id', userId)
    .maybeSingle<DbProfileRow>();

  if (error || !data) return null;
  profileCache.set(userId, data);
  return data;
}

export async function upsertProfileRemote(profile: PlayerProfile): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const uid = await ensureSupabaseSession();
  if (!uid || profile.playerId !== uid) return false;

  const payload = {
    id: uid,
    name: profile.name,
    avatar_id: profile.avatarId,
    color: profile.color,
    xp: profile.xp,
    stars: profile.stars,
    streak: profile.streak,
    last_played_date: profile.lastPlayedDate,
    unlocked_badges: profile.unlockedBadges,
    unlocked_themes: profile.unlockedThemes,
    active_theme: profile.activeTheme,
    updated_at: new Date().toISOString(),
  };

  profileCache.set(uid, payload);

  const { error } = await client.from('profiles').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.warn('[Supabase] Failed to upsert profile:', error.message);
    return false;
  }
  return true;
}

async function ensureHostProfileRow(uid: string, host: PlayerPresence): Promise<void> {
  if (profileCache.has(uid)) return;
  const existing = await fetchProfileRemote(uid);
  if (existing) return;

  const client = getSupabaseClient();
  if (!client) return;

  const { data, error } = await client
    .from('profiles')
    .upsert(
      {
        id: uid,
        name: host.name,
        avatar_id: host.avatarId,
        color: host.color,
        stars: 5,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select(
      'id, name, avatar_id, color, xp, stars, streak, last_played_date, unlocked_badges, unlocked_themes, active_theme'
    )
    .maybeSingle<DbProfileRow>();

  if (!error && data) {
    profileCache.set(uid, data);
  }
}

export function hydrateLocalProfileFromRemote(
  remote: DbProfileRow
): PlayerProfile {
  return {
    playerId: remote.id,
    name: remote.name,
    avatarId: clampAvatarId(remote.avatar_id),
    color: remote.color || '#58cc02',
    xp: remote.xp ?? 0,
    stars: remote.stars ?? 5,
    streak: remote.streak ?? 0,
    lastPlayedDate: remote.last_played_date ?? null,
    gamesPlayed: 0,
    gamesWon: 0,
    optimalWins: 0,
    noHintWins: 0,
    fastestWinSeconds: null,
    longestWordSolved: 4,
    uniqueWordsUsed: [],
    unlockedBadges: Array.isArray(remote.unlocked_badges) ? remote.unlocked_badges : [],
    badgeTiers: {},
    bestStreak: remote.streak ?? 0,
    fastWins: 0,
    fiveLetterWins: 0,
    clutchMoves: 0,
    miyuWins: 0,
    streakFreezes: 0,
    lastFreezeUsedDate: null,
    unlockedThemes:
      Array.isArray(remote.unlocked_themes) && remote.unlocked_themes.length > 0
        ? remote.unlocked_themes
        : ['classic'],
    activeTheme: remote.active_theme ?? 'classic',
    unlockedAvatars: [0, 1, 2, 3, 4, 5],
    unlockedParticles: ['confetti'],
    activeParticle: 'confetti',
    savedBestChains: [],
  };
}

function mapDbMoves(
  rows: DbMoveRow[],
  hostPresence: PlayerPresence,
  partnerPresence: PlayerPresence,
  currentWord: string,
  startWord: string,
  undoPenaltyCount: number
): WordMove[] {
  // 1. Deduplicate by step_number (when Undo + new move inserts a second row at the same step_number)
  const latestByStep = new Map<number, DbMoveRow>();
  for (const row of rows) {
    const prev = latestByStep.get(row.step_number);
    if (!prev) {
      latestByStep.set(row.step_number, row);
    } else {
      const prevTs = Date.parse(prev.created_at) || 0;
      const curTs = Date.parse(row.created_at) || 0;
      if (curTs >= prevTs) {
        latestByStep.set(row.step_number, row);
      }
    }
  }

  let mapped = Array.from(latestByStep.values())
    .sort((a, b) => a.step_number - b.step_number)
    .map((row): WordMove => {
      const actor =
        row.player_id === hostPresence.playerId ? hostPresence : partnerPresence;
      return {
        id: row.id,
        word: row.word,
        previousWord: row.previous_word,
        changedIndex: row.changed_index,
        fromChar: row.from_char.trim().toUpperCase(),
        toChar: row.to_char.trim().toUpperCase(),
        playerId: row.player_id,
        playerName: actor.name,
        playerAvatarId: actor.avatarId,
        playerColor: actor.color,
        timestamp: Date.parse(row.created_at) || Date.now(),
        isUndoPenalty: row.is_undo_penalty || undefined,
      };
    });

  // 2. If moves table contains trailing undone moves (no DELETE RLS policy), align chain tail with current_word
  if (currentWord === startWord) {
    mapped = [];
  } else if (mapped.length > 0 && (undoPenaltyCount > 0 || mapped[mapped.length - 1].word !== currentWord)) {
    const matchIdx = mapped.map((m) => m.word).lastIndexOf(currentWord);
    if (matchIdx !== -1) {
      mapped = mapped.slice(0, matchIdx + 1);
    }
  }

  return mapped;
}

async function assembleGameRoom(
  dbRoom: DbRoomRow,
  movesRows?: DbMoveRow[],
  existingLocal?: GameRoom
): Promise<GameRoom> {
  const client = getSupabaseClient();
  const [hostProf, partnerProf, fetchedMoves] = await Promise.all([
    fetchProfileRemote(dbRoom.host_player_id),
    dbRoom.partner_player_id ? fetchProfileRemote(dbRoom.partner_player_id) : Promise.resolve(null),
    movesRows
      ? Promise.resolve(movesRows)
      : client
      ? client
          .from('moves')
          .select(
            'id, room_code, step_number, word, previous_word, changed_index, from_char, to_char, player_id, is_undo_penalty, created_at'
          )
          .eq('room_code', dbRoom.code)
          .order('step_number', { ascending: true })
          .then(({ data }) => (data as DbMoveRow[] | null) ?? [])
      : Promise.resolve([] as DbMoveRow[]),
  ]);

  const hostPresence = toPresence(
    hostProf,
    dbRoom.host_player_id,
    existingLocal?.hostPlayer.name ?? translate('common.host')
  );
  const keepMiyuBot =
    !dbRoom.partner_player_id &&
    Boolean(existingLocal && isBotPartner(existingLocal.partnerPlayer.playerId));
  const partnerFallbackName =
    existingLocal && !isWaitingPartner(existingLocal.partnerPlayer.playerId)
      ? existingLocal.partnerPlayer.name
      : translate('common.partner');
  const partnerPresence = dbRoom.partner_player_id
    ? toPresence(partnerProf, dbRoom.partner_player_id, partnerFallbackName)
    : keepMiyuBot
    ? createMiyuPresence()
    : createWaitingPartnerPresence();

  const autoPartnerEnabled = keepMiyuBot;
  const moves =
    existingLocal &&
    existingLocal.undoPenaltyCount === dbRoom.undo_penalty_count &&
    existingLocal.currentWord === dbRoom.current_word &&
    existingLocal.moves.length >= fetchedMoves.length
      ? existingLocal.moves
      : mapDbMoves(
          fetchedMoves,
          hostPresence,
          partnerPresence,
          dbRoom.current_word,
          dbRoom.start_word,
          dbRoom.undo_penalty_count
        );

  const startedAt = Date.parse(dbRoom.started_at) || existingLocal?.startedAt || Date.now();
  const completedAt = dbRoom.completed_at ? Date.parse(dbRoom.completed_at) : undefined;
  const abandoned = dbRoom.status === 'completed' && dbRoom.current_word !== dbRoom.target_word;

  const resolvedTurnId =
    keepMiyuBot && dbRoom.current_turn_player_id === WAITING_PARTNER_ID
      ? MIYU_BOT_ID
      : dbRoom.current_turn_player_id;

  const unchangedTurn =
    existingLocal &&
    existingLocal.currentTurnPlayerId === resolvedTurnId &&
    existingLocal.currentWord === dbRoom.current_word &&
    existingLocal.autoPartnerEnabled === autoPartnerEnabled;

  return {
    code: dbRoom.code,
    language: dbRoom.language,
    wordLength: dbRoom.word_length,
    mode: dbRoom.mode,
    startWord: dbRoom.start_word,
    targetWord: dbRoom.target_word,
    currentWord: dbRoom.current_word,
    optimalPar: dbRoom.optimal_par,
    optimalPath: Array.isArray(dbRoom.optimal_path) ? dbRoom.optimal_path : [],
    moves,
    undoPenaltyCount: dbRoom.undo_penalty_count,
    hintsUsed: dbRoom.hints_used,
    currentTurnPlayerId: resolvedTurnId,
    turnStartedAt: unchangedTurn
      ? existingLocal.turnStartedAt
      : moves[moves.length - 1]?.timestamp ?? startedAt,
    lastTurnPass: unchangedTurn ? existingLocal.lastTurnPass : undefined,
    hostPlayer: hostPresence,
    partnerPlayer: partnerPresence,
    autoPartnerEnabled,
    status: dbRoom.status,
    startedAt,
    completedAt,
    winnerPlayerId: dbRoom.winner_player_id ?? undefined,
    ...(abandoned
      ? {
          abandoned: true,
          abandonedByPlayerId: existingLocal?.abandonedByPlayerId,
          abandonedByName: existingLocal?.abandonedByName,
        }
      : {}),
  };
}

export async function loadRemoteRooms(
  playerId: string,
  localRooms: Record<string, GameRoom>
): Promise<Record<string, GameRoom>> {
  if (!isValidUuid(playerId)) return {};
  const client = getSupabaseClient();
  if (!client) return {};

  const uid = await ensureSupabaseSession();
  if (!uid) return {};

  const { data: roomRows, error } = await client
    .from('rooms')
    .select('*')
    .or(`host_player_id.eq.${uid},partner_player_id.eq.${uid}`)
    .order('started_at', { ascending: false })
    .limit(30)
    .returns<DbRoomRow[]>();

  if (error || !roomRows || roomRows.length === 0) return {};

  const codes = roomRows.map((r) => r.code);
  const { data: allMoves } = await client
    .from('moves')
    .select(
      'id, room_code, step_number, word, previous_word, changed_index, from_char, to_char, player_id, is_undo_penalty, created_at'
    )
    .in('room_code', codes)
    .order('step_number', { ascending: true })
    .returns<DbMoveRow[]>();

  const movesByRoom = new Map<string, DbMoveRow[]>();
  for (const mv of allMoves ?? []) {
    const arr = movesByRoom.get(mv.room_code) ?? [];
    arr.push(mv);
    movesByRoom.set(mv.room_code, arr);
  }

  const assembledEntries = await Promise.all(
    roomRows.map(async (row) => {
      const room = await assembleGameRoom(
        row,
        movesByRoom.get(row.code) ?? [],
        localRooms[row.code]
      );
      return [room.code, room] as const;
    })
  );

  return Object.fromEntries(assembledEntries);
}

export async function createOrUpsertRemoteRoom(room: GameRoom): Promise<boolean> {
  if (room.code === STARTER_ROOM_CODE) return false;
  const client = getSupabaseClient();
  if (!client) return false;

  const p = (async () => {
    const uid = await ensureSupabaseSession();
    if (!uid || !isValidUuid(room.hostPlayer.playerId) || room.hostPlayer.playerId !== uid) {
      return false;
    }

    await ensureHostProfileRow(uid, room.hostPlayer);

    const partnerId =
      isValidUuid(room.partnerPlayer.playerId) && !isWaitingPartner(room.partnerPlayer.playerId)
        ? room.partnerPlayer.playerId
        : null;
    const dbTurnId = isValidUuid(room.currentTurnPlayerId) ? room.currentTurnPlayerId : uid;

    const { error } = await client.from('rooms').insert({
      code: room.code,
      language: room.language,
      word_length: room.wordLength,
      mode: room.mode,
      start_word: room.startWord,
      target_word: room.targetWord,
      current_word: room.currentWord,
      optimal_par: room.optimalPar,
      optimal_path: room.optimalPath,
      host_player_id: room.hostPlayer.playerId,
      partner_player_id: partnerId,
      current_turn_player_id: dbTurnId,
      undo_penalty_count: room.undoPenaltyCount,
      hints_used: room.hintsUsed,
      status: room.status,
      winner_player_id: isValidUuid(room.winnerPlayerId) ? room.winnerPlayerId : null,
      started_at: new Date(room.startedAt).toISOString(),
      completed_at: room.completedAt ? new Date(room.completedAt).toISOString() : null,
    });

    if (error) {
      if (error.code === '23505') {
        console.warn('[Supabase] Room code collision, insert skipped:', room.code);
      } else {
        console.warn('[Supabase] Failed to save room:', error.message);
      }
      return false;
    }
    return true;
  })();

  pendingRoomCreates.set(room.code, p);
  try {
    return await p;
  } finally {
    if (pendingRoomCreates.get(room.code) === p) {
      pendingRoomCreates.delete(room.code);
    }
  }
}

export async function claimRemoteRoomByCode(
  code: string,
  player: PlayerProfile
): Promise<ClaimRemoteRoomResult> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode || cleanCode === STARTER_ROOM_CODE) return { status: 'not_found' };

  const client = getSupabaseClient();
  if (!client) return { status: 'not_found' };

  const uid = await ensureSupabaseSession();
  if (!uid) return { status: 'not_found' };

  const { data: dbRoom, error } = await client
    .from('rooms')
    .select('*')
    .eq('code', cleanCode)
    .maybeSingle<DbRoomRow>();

  if (error || !dbRoom) return { status: 'not_found' };

  if (
    dbRoom.host_player_id !== uid &&
    dbRoom.partner_player_id &&
    dbRoom.partner_player_id !== uid
  ) {
    return { status: 'full' };
  }

  let resolvedRoom = dbRoom;
  if (dbRoom.host_player_id !== uid && !dbRoom.partner_player_id) {
    await upsertProfileRemote({ ...player, playerId: uid });
    const nextTurn =
      dbRoom.current_turn_player_id === dbRoom.host_player_id
        ? dbRoom.host_player_id
        : uid;

    const { data: updatedRow, error: updateErr } = await client
      .from('rooms')
      .update({
        partner_player_id: uid,
        current_turn_player_id: nextTurn,
      })
      .eq('code', cleanCode)
      .is('partner_player_id', null)
      .select('*')
      .maybeSingle<DbRoomRow>();

    if (!updateErr && updatedRow) {
      resolvedRoom = updatedRow;
    } else {
      const { data: refetched } = await client
        .from('rooms')
        .select('*')
        .eq('code', cleanCode)
        .maybeSingle<DbRoomRow>();
      if (!refetched) return { status: 'not_found' };
      if (refetched.host_player_id !== uid && refetched.partner_player_id !== uid) {
        return { status: 'full' };
      }
      resolvedRoom = refetched;
    }
  }

  const assembled = await assembleGameRoom(resolvedRoom);
  return {
    status: 'ok',
    room: {
      ...assembled,
      turnStartedAt: Date.now(),
    },
  };
}

export async function updateRemoteRoomState(room: GameRoom): Promise<void> {
  if (room.code === STARTER_ROOM_CODE) return;
  const pendingCreate = pendingRoomCreates.get(room.code);
  if (pendingCreate) await pendingCreate;

  const client = getSupabaseClient();
  if (!client) return;

  const uid = await ensureSupabaseSession();
  if (!uid) return;

  const partnerId =
    isValidUuid(room.partnerPlayer.playerId) && !isWaitingPartner(room.partnerPlayer.playerId)
      ? room.partnerPlayer.playerId
      : null;
  const dbTurnId = isValidUuid(room.currentTurnPlayerId)
    ? room.currentTurnPlayerId
    : isBotPartner(room.currentTurnPlayerId)
    ? partnerId ?? WAITING_PARTNER_ID
    : room.hostPlayer.playerId;

  if (!isValidUuid(dbTurnId)) return;

  const updatePayload: Record<string, unknown> = {
    start_word: room.startWord,
    target_word: room.targetWord,
    optimal_par: room.optimalPar,
    optimal_path: room.optimalPath,
    current_word: room.currentWord,
    current_turn_player_id: dbTurnId,
    undo_penalty_count: room.undoPenaltyCount,
    hints_used: room.hintsUsed,
    status: room.status,
    winner_player_id: isValidUuid(room.winnerPlayerId) ? room.winnerPlayerId : null,
    started_at: new Date(room.startedAt).toISOString(),
    completed_at: room.completedAt ? new Date(room.completedAt).toISOString() : null,
  };
  if (partnerId !== null) {
    updatePayload.partner_player_id = partnerId;
  }

  const { error } = await client
    .from('rooms')
    .update(updatePayload)
    .eq('code', room.code);

  if (error) {
    console.warn('[Supabase] Failed to update room:', error.message);
  }
}

export async function pushRemoteMove(room: GameRoom, move: WordMove): Promise<void> {
  if (room.code === STARTER_ROOM_CODE) return;
  const pendingCreate = pendingRoomCreates.get(room.code);
  if (pendingCreate) await pendingCreate;

  const client = getSupabaseClient();
  if (!client) return;

  const uid = await ensureSupabaseSession();
  if (!uid) return;

  if (move.playerId === uid && isValidUuid(move.playerId)) {
    const { error } = await client.from('moves').upsert(
      {
        id: isValidUuid(move.id) ? move.id : undefined,
        room_code: room.code,
        step_number: room.moves.length,
        word: move.word,
        previous_word: move.previousWord,
        changed_index: move.changedIndex,
        from_char: move.fromChar.slice(0, 1),
        to_char: move.toChar.slice(0, 1),
        player_id: uid,
        is_undo_penalty: Boolean(move.isUndoPenalty),
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );

    if (error) {
      console.warn('[Supabase] Failed to insert move:', error.message);
    }
  }

  await updateRemoteRoomState(room);
}

// Shared Realtime channel for instant Broadcast + Postgres Changes
let realtimeChannel: RealtimeChannel | null = null;
const roomListeners = new Set<(room: GameRoom, meta?: RoomUpdateMeta) => void>();
const typingListeners = new Set<(roomCode: string, playerId: string, isTyping: boolean) => void>();
const reactionListeners = new Set<(event: QuickReactionEvent) => void>();
const nudgeListeners = new Set<(event: NudgeEvent) => void>();
let boundPlayerId: string | null = null;

function ensureRealtimeSubscription(playerId: string): void {
  const client = getSupabaseClient();
  if (!client || !isValidUuid(playerId)) return;

  if (realtimeChannel && boundPlayerId === playerId) return;

  if (realtimeChannel) {
    void client.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  boundPlayerId = playerId;
  realtimeChannel = client
    .channel('lets-turn-realtime-v1', {
      config: { broadcast: { self: false } },
    })
    .on('broadcast', { event: 'room_update' }, ({ payload }) => {
      const data = payload as
        | { room?: GameRoom; senderId?: string; rematchFromCode?: string }
        | undefined;
      if (!data?.room) return;
      const r = data.room;
      if (r.hostPlayer.playerId !== playerId && r.partnerPlayer.playerId !== playerId) return;
      const meta: RoomUpdateMeta = data.rematchFromCode
        ? { rematchFromCode: data.rematchFromCode, source: 'broadcast' }
        : { source: 'broadcast' };
      roomListeners.forEach((cb) => cb(r, meta));
    })
    .on('broadcast', { event: 'typing_state' }, ({ payload }) => {
      const data = payload as
        | { roomCode?: string; playerId?: string; isTyping?: boolean }
        | undefined;
      if (!data?.roomCode || !data.playerId) return;
      typingListeners.forEach((cb) => cb(data.roomCode!, data.playerId!, Boolean(data.isTyping)));
    })
    .on('broadcast', { event: 'quick_reaction' }, ({ payload }) => {
      const ev = payload as QuickReactionEvent | undefined;
      if (!ev?.roomCode || !ev.playerId || !ev.reactionId) return;
      reactionListeners.forEach((cb) => cb(ev));
    })
    .on('broadcast', { event: 'room_nudge' }, ({ payload }) => {
      const ev = payload as NudgeEvent | undefined;
      if (!ev?.roomCode || !ev.fromPlayerId || !ev.toPlayerId) return;
      if (ev.toPlayerId !== playerId) return;
      nudgeListeners.forEach((cb) => cb(ev));
    })
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rooms' },
      async (payload) => {
        const row = payload.new as DbRoomRow | undefined;
        if (!row?.code) return;
        if (row.host_player_id !== playerId && row.partner_player_id !== playerId) return;
        const isInsert = payload.eventType === 'INSERT';
        const assembled = await assembleGameRoom(row);
        roomListeners.forEach((cb) =>
          cb(
            {
              ...assembled,
              turnStartedAt: Date.now(),
            },
            { isInsert, source: 'postgres' }
          )
        );
      }
    )
    .subscribe();
}

export function broadcastSupabaseRoomUpdate(
  room: GameRoom,
  senderId = '',
  rematchFromCode?: string
): void {
  if (
    room.code === STARTER_ROOM_CODE ||
    isBotPartner(room.partnerPlayer.playerId) ||
    !realtimeChannel
  ) {
    return;
  }
  void realtimeChannel.send({
    type: 'broadcast',
    event: 'room_update',
    payload: rematchFromCode ? { room, senderId, rematchFromCode } : { room, senderId },
  });
}

export function broadcastSupabaseTyping(
  roomCode: string,
  playerId: string,
  isTyping: boolean
): void {
  if (roomCode === STARTER_ROOM_CODE || !realtimeChannel) return;
  void realtimeChannel.send({
    type: 'broadcast',
    event: 'typing_state',
    payload: { roomCode, playerId, isTyping },
  });
}

export function broadcastSupabaseReaction(event: QuickReactionEvent): void {
  if (event.roomCode === STARTER_ROOM_CODE || !realtimeChannel) return;
  void realtimeChannel.send({
    type: 'broadcast',
    event: 'quick_reaction',
    payload: event,
  });
}

export function broadcastSupabaseNudge(event: NudgeEvent): void {
  if (event.roomCode === STARTER_ROOM_CODE || !realtimeChannel) return;
  void realtimeChannel.send({
    type: 'broadcast',
    event: 'room_nudge',
    payload: event,
  });
}

export function subscribeSupabaseSync(
  playerId: string,
  onRoomUpdate: (room: GameRoom, meta?: RoomUpdateMeta) => void,
  onTypingChange?: (roomCode: string, playerId: string, isTyping: boolean) => void,
  onReaction?: (event: QuickReactionEvent) => void,
  onNudge?: (event: NudgeEvent) => void
): () => void {
  if (!getSupabaseClient() || !isValidUuid(playerId)) return () => {};

  roomListeners.add(onRoomUpdate);
  if (onTypingChange) typingListeners.add(onTypingChange);
  if (onReaction) reactionListeners.add(onReaction);
  if (onNudge) nudgeListeners.add(onNudge);
  ensureRealtimeSubscription(playerId);

  return () => {
    roomListeners.delete(onRoomUpdate);
    if (onTypingChange) typingListeners.delete(onTypingChange);
    if (onReaction) reactionListeners.delete(onReaction);
    if (onNudge) nudgeListeners.delete(onNudge);
    if (
      roomListeners.size === 0 &&
      typingListeners.size === 0 &&
      reactionListeners.size === 0 &&
      nudgeListeners.size === 0 &&
      realtimeChannel
    ) {
      const client = getSupabaseClient();
      if (client) void client.removeChannel(realtimeChannel);
      realtimeChannel = null;
      boundPlayerId = null;
    }
  };
}
