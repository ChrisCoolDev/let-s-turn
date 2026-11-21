export type Language = 'EN' | 'FR';
export type WordLength = 4 | 5;
export type GameMode = 'coop' | 'duel' | 'daily';

export type ThemeId =
  | 'classic'
  | 'cyberpunk'
  | 'nyt'
  | 'pastel'
  | 'oled'
  | 'forest'
  | 'royal'
  | 'arcade';
export type TileStyleId = 'classic' | 'wood' | 'neon' | 'gold';
export type AvatarFrameId = 'none' | 'flame' | 'electric' | 'crown';
export type BotDifficulty = 'apprentice' | 'scholar' | 'grandmaster';
export type ParticleEffectId = 'confetti' | 'sparkles' | 'hearts' | 'lightning';
export type AvatarId = 0 | 1 | 2 | 3 | 4 | 5;

export type BadgeTierLevel = 0 | 1 | 2 | 3 | 4;

export interface BadgeTierThreshold {
  tier: 1 | 2 | 3 | 4;
  target: number;
  rewardStars: number;
}

export interface BadgeUpgradeResult {
  badgeId: string;
  newTier: 1 | 2 | 3 | 4;
  rewardStars: number;
}

export type DailyQuestKind =
  | 'play_moves'
  | 'win_games'
  | 'fast_moves'
  | 'no_hint_win'
  | 'par_win'
  | 'five_letter_win'
  | 'daily_challenge_win'
  | 'beat_miyu';

export type QuestTier = 'bronze' | 'silver' | 'gold';

export interface DailyQuest {
  id: string;
  kind: DailyQuestKind;
  tier: QuestTier;
  target: number;
  progress: number;
  rewardStars: number;
  rewardXp: number;
  claimed: boolean;
}

export interface DailyQuestState {
  date: string; // YYYY-MM-DD heure locale
  quests: DailyQuest[];
  chestClaimed: boolean;
}

export type QuickReactionId = 'nice' | 'hurry' | 'tough' | 'idea';

export interface QuickReactionEvent {
  id: string;
  roomCode: string;
  playerId: string;
  playerName: string;
  reactionId: QuickReactionId;
  timestamp: number;
}

export interface NudgeEvent {
  roomCode: string;
  fromPlayerId: string;
  fromPlayerName: string;
  toPlayerId: string;
  timestamp: number;
}

export interface DuoStreakEntry {
  partnerId: string;
  partnerName: string;
  avatarId?: AvatarId;
  color?: string;
  streak: number;
  bestStreak: number;
  lastPlayedDate: string;
}

export interface PlayerProfile {
  playerId: string;
  name: string;
  avatarId: AvatarId;
  color: string;
  xp: number;
  stars: number;
  streak: number;
  lastPlayedDate: string | null;
  gamesPlayed: number;
  gamesWon: number;
  optimalWins: number;
  noHintWins: number;
  fastestWinSeconds: number | null;
  longestWordSolved: number;
  uniqueWordsUsed: string[];
  unlockedBadges: string[];
  badgeTiers?: Record<string, number>;
  bestStreak?: number;
  fastWins?: number;
  fiveLetterWins?: number;
  clutchMoves?: number;
  miyuWins?: number;
  streakFreezes?: number;
  lastFreezeUsedDate?: string | null;
  dailyQuests?: DailyQuestState;
  duoStreaks?: Record<string, DuoStreakEntry>;
  duelWins?: number;
  unlockedThemes: ThemeId[];
  activeTheme: ThemeId;
  unlockedTileStyles?: TileStyleId[];
  activeTileStyle?: TileStyleId;
  unlockedFrames?: AvatarFrameId[];
  activeFrame?: AvatarFrameId;
  unlockedAvatars: AvatarId[];
  unlockedParticles: ParticleEffectId[];
  activeParticle: ParticleEffectId;
  savedBestChains: SavedChainRecord[];
}

export interface SavedChainRecord {
  id: string;
  startWord: string;
  targetWord: string;
  words: string[];
  optimalSteps: number;
  actualSteps: number;
  partnerName: string;
  language: Language;
  completedAt: number;
}

export interface WordMove {
  id: string;
  word: string;
  previousWord: string;
  changedIndex: number;
  fromChar: string;
  toChar: string;
  playerId: string;
  playerName: string;
  playerAvatarId: AvatarId;
  playerColor: string;
  timestamp: number;
  isUndoPenalty?: boolean;
}

export interface PlayerPresence {
  playerId: string;
  name: string;
  avatarId: AvatarId;
  color: string;
  online: boolean;
  isTyping: boolean;
  lastSeen: number;
}

export interface TurnPassNotice {
  id: string;
  fromPlayerId: string;
  fromPlayerName: string;
  toPlayerId: string;
  toPlayerName: string;
  timestamp: number;
}

export interface GameRoom {
  code: string;
  language: Language;
  wordLength: WordLength;
  mode: GameMode;
  startWord: string;
  targetWord: string;
  currentWord: string;
  optimalPar: number;
  optimalPath: string[];
  moves: WordMove[];
  undoPenaltyCount: number;
  hintsUsed: number;
  currentTurnPlayerId: string;
  turnStartedAt?: number;
  lastTurnPass?: TurnPassNotice;
  hostPlayer: PlayerPresence;
  partnerPlayer: PlayerPresence;
  autoPartnerEnabled: boolean;
  status: 'active' | 'completed';
  startedAt: number;
  completedAt?: number;
  winnerPlayerId?: string;
  abandoned?: boolean;
  abandonedByPlayerId?: string;
  abandonedByName?: string;
  tempoCombo?: number;
  maxTempoCombo?: number;
  tempoBonusXp?: number;
  goldenLetter?: string;
  goldenLetterClaimed?: boolean;
  botDifficulty?: BotDifficulty;
  timeShieldsUsed?: number;
}

export interface TileStyleShopItem {
  id: TileStyleId;
  name: string;
  description: string;
  priceStars: number;
  previewBg: string;
  previewBorder: string;
  previewText: string;
}

export interface AvatarFrameShopItem {
  id: AvatarFrameId;
  name: string;
  description: string;
  priceStars: number;
  ringColor: string;
}

export interface BadgeDefinition {
  id: string;
  icon: string;
  title: string;
  description: string;
  conditionLabel: string;
  color: string;
  tiers: BadgeTierThreshold[];
}

export interface ThemeShopItem {
  id: ThemeId;
  name: string;
  description: string;
  priceStars: number;
  previewBg: string;
  previewAccent: string;
  previewText: string;
}
