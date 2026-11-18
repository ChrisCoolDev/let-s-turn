export type Language = 'EN' | 'FR';
export type WordLength = 4 | 5;
export type GameMode = 'coop' | 'duel' | 'daily';

export type ThemeId = 'classic' | 'cyberpunk' | 'nyt' | 'pastel' | 'oled';
export type ParticleEffectId = 'confetti' | 'sparkles' | 'hearts' | 'lightning';
export type AvatarId = 0 | 1 | 2 | 3 | 4 | 5;

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
  unlockedThemes: ThemeId[];
  activeTheme: ThemeId;
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
}

export interface BadgeDefinition {
  id: string;
  icon: string;
  title: string;
  description: string;
  conditionLabel: string;
  color: string;
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
