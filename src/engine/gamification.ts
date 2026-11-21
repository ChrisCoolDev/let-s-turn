import { translate, type Locale, type TranslationKey } from '../i18n';
import type {
  AvatarFrameId,
  AvatarFrameShopItem,
  BadgeDefinition,
  BadgeTierLevel,
  BadgeUpgradeResult,
  BotDifficulty,
  DailyQuest,
  DailyQuestKind,
  DailyQuestState,
  DuoStreakEntry,
  GameRoom,
  PlayerPresence,
  PlayerProfile,
  ThemeShopItem,
  TileStyleId,
  TileStyleShopItem,
} from '../types/game';
import { getRemainingBfsSteps } from './wordLadder';

export const LEVEL_COUNT = 20;
export const LEVEL_UP_STAR_REWARD = 2;
export const STREAK_FREEZE_PRICE = 15;
export const MAX_STREAK_FREEZES = 2;
export const DAILY_CHEST_STARS = 3;
export const DAILY_CHEST_XP = 80;
export const TEMPO_COMBO_WINDOW_MS = 10_000;
export const TEMPO_COMBO_XP_PER_STEP = 5;
export const GOLDEN_LETTER_BONUS_STARS = 1;
export const DUEL_MVP_BONUS_STARS = 1;
export const TIME_SHIELD_PRICE = 1;
export const TIME_SHIELD_BONUS_MS = 15_000;

export interface BotDifficultyConfig {
  id: BotDifficulty;
  unlockLevel: number;
  turnTimeoutMs: number;
  xpBonusPct: number;
  winStarMultiplier: number;
}

export const BOT_DIFFICULTIES: Record<BotDifficulty, BotDifficultyConfig> = {
  apprentice: {
    id: 'apprentice',
    unlockLevel: 1,
    turnTimeoutMs: 30_000,
    xpBonusPct: 0,
    winStarMultiplier: 1,
  },
  scholar: {
    id: 'scholar',
    unlockLevel: 3,
    turnTimeoutMs: 20_000,
    xpBonusPct: 25,
    winStarMultiplier: 1,
  },
  grandmaster: {
    id: 'grandmaster',
    unlockLevel: 5,
    turnTimeoutMs: 12_000,
    xpBonusPct: 50,
    winStarMultiplier: 2,
  },
};

export function getBotDifficultyConfig(difficulty?: BotDifficulty): BotDifficultyConfig {
  if (difficulty && difficulty in BOT_DIFFICULTIES) {
    return BOT_DIFFICULTIES[difficulty];
  }
  return BOT_DIFFICULTIES.apprentice;
}

export function getComboMultiplier(combo: number): number {
  if (combo >= 5) return 3;
  if (combo >= 3) return 2;
  if (combo >= 2) return 1.5;
  return 1;
}

export const PLAYER_COLORS = [
  { id: 'green', name: 'Vert Duo', hex: '#58cc02' },
  { id: 'blue', name: 'Bleu Ciel', hex: '#1cb0f6' },
  { id: 'purple', name: 'Violet Pop', hex: '#ce82ff' },
  { id: 'orange', name: 'Flamme', hex: '#ff9600' },
  { id: 'pink', name: 'Rose Berry', hex: '#ff4b8b' },
  { id: 'gold', name: 'Or Solaire', hex: '#ffc800' },
];

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'surgeon',
    icon: '🎯',
    title: 'Chirurgien',
    description: 'Finir des parties au nombre de coups optimal ou mieux.',
    conditionLabel: 'Victoires au Par optimal',
    color: '#58cc02',
    tiers: [
      { tier: 1, target: 1, rewardStars: 2 },
      { tier: 2, target: 10, rewardStars: 5 },
      { tier: 3, target: 50, rewardStars: 10 },
      { tier: 4, target: 200, rewardStars: 25 },
    ],
  },
  {
    id: 'lightning',
    icon: '⚡',
    title: 'Éclair',
    description: 'Enchaîner les victoires en moins de 45 secondes.',
    conditionLabel: 'Victoires chrono < 45s',
    color: '#1cb0f6',
    tiers: [
      { tier: 1, target: 1, rewardStars: 2 },
      { tier: 2, target: 15, rewardStars: 5 },
      { tier: 3, target: 75, rewardStars: 10 },
      { tier: 4, target: 250, rewardStars: 25 },
    ],
  },
  {
    id: 'inseparable',
    icon: '🔥',
    title: 'Inséparables',
    description: 'Maintenir une flamme régulière jour après jour.',
    conditionLabel: 'Meilleure série de jours',
    color: '#ff9600',
    tiers: [
      { tier: 1, target: 3, rewardStars: 2 },
      { tier: 2, target: 7, rewardStars: 5 },
      { tier: 3, target: 30, rewardStars: 10 },
      { tier: 4, target: 100, rewardStars: 25 },
    ],
  },
  {
    id: 'librarian',
    icon: '📚',
    title: 'Bibliothécaire',
    description: 'Forger des chaînes avec un maximum de mots uniques.',
    conditionLabel: 'Mots uniques joués',
    color: '#ce82ff',
    tiers: [
      { tier: 1, target: 50, rewardStars: 2 },
      { tier: 2, target: 250, rewardStars: 5 },
      { tier: 3, target: 1000, rewardStars: 10 },
      { tier: 4, target: 3500, rewardStars: 25 },
    ],
  },
  {
    id: 'purist',
    icon: '🧠',
    title: 'Puriste',
    description: 'Enchaîner les victoires sans utiliser le moindre indice.',
    conditionLabel: 'Victoires sans indice',
    color: '#ffc800',
    tiers: [
      { tier: 1, target: 5, rewardStars: 2 },
      { tier: 2, target: 25, rewardStars: 5 },
      { tier: 3, target: 100, rewardStars: 10 },
      { tier: 4, target: 300, rewardStars: 25 },
    ],
  },
  {
    id: 'polyglot',
    icon: '🌍',
    title: 'Alchimiste Polyglotte',
    description: 'Compléter des chaînes de 5 lettres avec brio.',
    conditionLabel: 'Défis 5 lettres résolus',
    color: '#ff4b4b',
    tiers: [
      { tier: 1, target: 1, rewardStars: 2 },
      { tier: 2, target: 15, rewardStars: 5 },
      { tier: 3, target: 75, rewardStars: 10 },
      { tier: 4, target: 200, rewardStars: 25 },
    ],
  },
  {
    id: 'clutch',
    icon: '⏱️',
    title: 'Sang-Froid',
    description: 'Valider des coups avec 3 secondes ou moins au chrono.',
    conditionLabel: 'Jouer un coup à ≤ 3s de la fin',
    color: '#f97316',
    tiers: [
      { tier: 1, target: 1, rewardStars: 2 },
      { tier: 2, target: 10, rewardStars: 5 },
      { tier: 3, target: 35, rewardStars: 10 },
      { tier: 4, target: 100, rewardStars: 25 },
    ],
  },
  {
    id: 'miyu_tamer',
    icon: '🤖',
    title: 'Dompteur de Miyu',
    description: 'Compléter des défis en duo avec Miyu.',
    conditionLabel: 'Gagner une partie avec Miyu',
    color: '#ff9600',
    tiers: [
      { tier: 1, target: 1, rewardStars: 2 },
      { tier: 2, target: 10, rewardStars: 5 },
      { tier: 3, target: 50, rewardStars: 10 },
      { tier: 4, target: 150, rewardStars: 25 },
    ],
  },
];

export const THEME_SHOP_ITEMS: ThemeShopItem[] = [
  {
    id: 'classic',
    name: 'Classique Duolingo',
    description: 'Blanc éclatant, tuiles 3D et vert emblématique.',
    priceStars: 0,
    previewBg: '#ffffff',
    previewAccent: '#58cc02',
    previewText: '#4b484b',
  },
  {
    id: 'cyberpunk',
    name: 'Néon Cyberpunk',
    description: 'Nuit électrique cyan & magenta haute tension.',
    priceStars: 10,
    previewBg: '#0d0f1a',
    previewAccent: '#00f5d4',
    previewText: '#f1f5f9',
  },
  {
    id: 'nyt',
    name: 'Papier Journal NYT',
    description: 'Teinte parchemin éditoriale & vert forêt chic.',
    priceStars: 8,
    previewBg: '#f7f4ec',
    previewAccent: '#2d7a47',
    previewText: '#1a1917',
  },
  {
    id: 'pastel',
    name: 'Pastel Rose',
    description: 'Ambiance douce rose sakura & lavande pop.',
    priceStars: 12,
    previewBg: '#fff6f9',
    previewAccent: '#ff6aa2',
    previewText: '#63344d',
  },
  {
    id: 'oled',
    name: 'Mode Sombre OLED',
    description: 'Noir pur haute lisibilité pour jouer le soir.',
    priceStars: 6,
    previewBg: '#000000',
    previewAccent: '#58cc02',
    previewText: '#ffffff',
  },
  {
    id: 'forest',
    name: 'Forêt Zen',
    description: 'Sauge douce, bois naturel et sérénité.',
    priceStars: 18,
    previewBg: '#f2f7f2',
    previewAccent: '#2f9e44',
    previewText: '#1f3b24',
  },
  {
    id: 'royal',
    name: 'Or Royal',
    description: 'Indigo nuit majestueux & éclats dorés.',
    priceStars: 24,
    previewBg: '#141126',
    previewAccent: '#ffd43b',
    previewText: '#f8f5ff',
  },
  {
    id: 'arcade',
    name: 'Rétro Arcade',
    description: 'Violet profond & couleurs néon 16-bit.',
    priceStars: 30,
    previewBg: '#180d2e',
    previewAccent: '#4ade80',
    previewText: '#fdf4ff',
  },
];

export const TILE_STYLE_SHOP_ITEMS: TileStyleShopItem[] = [
  {
    id: 'classic',
    name: 'Classique 3D',
    description: 'Tuiles blanches épurées.',
    priceStars: 0,
    previewBg: '#fffdfe',
    previewBorder: '#e7e4e7',
    previewText: '#4d4b4c',
  },
  {
    id: 'wood',
    name: 'Bois de Scrabble',
    description: 'Touche chaleureuse façon plateau en bois.',
    priceStars: 12,
    previewBg: '#f6e7c8',
    previewBorder: '#d0ac72',
    previewText: '#533613',
  },
  {
    id: 'neon',
    name: 'Néon Électrique',
    description: 'Liseré lumineux haute tension.',
    priceStars: 18,
    previewBg: '#eaf8ff',
    previewBorder: '#1cb0f6',
    previewText: '#1899d6',
  },
  {
    id: 'gold',
    name: "Lingot d'Or",
    description: 'Tuiles dorées de champion.',
    priceStars: 35,
    previewBg: '#ffd43b',
    previewBorder: '#d99300',
    previewText: '#5c3d00',
  },
];

export const AVATAR_FRAME_SHOP_ITEMS: AvatarFrameShopItem[] = [
  {
    id: 'none',
    name: 'Standard',
    description: 'Cercle de couleur classique.',
    priceStars: 0,
    ringColor: '#cbd5e1',
  },
  {
    id: 'flame',
    name: 'Aura Flamme',
    description: 'Double éclat orange ardent.',
    priceStars: 15,
    ringColor: '#ff9600',
  },
  {
    id: 'electric',
    name: 'Arc Électrique',
    description: 'Halo bleu-cyan haute fréquence.',
    priceStars: 22,
    ringColor: '#1cb0f6',
  },
  {
    id: 'crown',
    name: 'Couronne Royale',
    description: 'Anneau doré surmonté d’une couronne.',
    priceStars: 40,
    ringColor: '#ffc800',
  },
];

export const PARTICLE_SHOP_ITEMS = [
  { id: 'confetti' as const, name: 'Confettis Fiesta', icon: '🎉', priceStars: 0 },
  { id: 'sparkles' as const, name: 'Étoiles Magiques', icon: '✨', priceStars: 5 },
  { id: 'hearts' as const, name: 'Pluie de Cœurs', icon: '💖', priceStars: 8 },
  { id: 'lightning' as const, name: 'Éclairs Turbo', icon: '⚡', priceStars: 10 },
];

export interface LevelInfo {
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPct: number;
}

export function getPlayerColors(locale: Locale) {
  return PLAYER_COLORS.map((c) => ({
    ...c,
    name: translate(`color.${c.id}` as TranslationKey, undefined, locale),
  }));
}

export function getBadgeDefinitions(locale: Locale): BadgeDefinition[] {
  return BADGE_DEFINITIONS.map((b) => ({
    ...b,
    title: translate(`badge.${b.id}.title` as TranslationKey, undefined, locale),
    description: translate(`badge.${b.id}.description` as TranslationKey, undefined, locale),
    conditionLabel: translate(`badge.${b.id}.condition` as TranslationKey, undefined, locale),
  }));
}

export function getThemeShopItems(locale: Locale): ThemeShopItem[] {
  return THEME_SHOP_ITEMS.map((item) => ({
    ...item,
    name: translate(`theme.${item.id}.name` as TranslationKey, undefined, locale),
    description: translate(`theme.${item.id}.description` as TranslationKey, undefined, locale),
  }));
}

export function getTileStyleShopItems(locale: Locale): TileStyleShopItem[] {
  return TILE_STYLE_SHOP_ITEMS.map((item) => ({
    ...item,
    name: translate(`tileStyle.${item.id}.name` as TranslationKey, undefined, locale),
    description: translate(`tileStyle.${item.id}.description` as TranslationKey, undefined, locale),
  }));
}

export function getAvatarFrameShopItems(locale: Locale): AvatarFrameShopItem[] {
  return AVATAR_FRAME_SHOP_ITEMS.map((item) => ({
    ...item,
    name: translate(`frame.${item.id}.name` as TranslationKey, undefined, locale),
    description: translate(`frame.${item.id}.description` as TranslationKey, undefined, locale),
  }));
}

export function getParticleShopItems(locale: Locale) {
  return PARTICLE_SHOP_ITEMS.map((item) => ({
    ...item,
    name: translate(`particle.${item.id}.name` as TranslationKey, undefined, locale),
  }));
}

export function xpRequiredForLevel(level: number): number {
  return Math.round((100 * Math.pow(Math.max(1, level), 1.32)) / 10) * 10;
}

export function getLevelInfo(xp: number, locale: Locale = 'fr'): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp));
  while (level < 100 && remaining >= xpRequiredForLevel(level)) {
    remaining -= xpRequiredForLevel(level);
    level++;
  }
  const nextLevelXp = xpRequiredForLevel(level);
  const levelIdx = Math.min(level - 1, LEVEL_COUNT - 1);
  const title = translate(`level.${levelIdx}` as TranslationKey, undefined, locale);
  return {
    level,
    title,
    currentLevelXp: remaining,
    nextLevelXp,
    progressPct: Math.min(100, Math.round((remaining / nextLevelXp) * 100)),
  };
}

export function applyXpWithLevelUp(
  currentXp: number,
  currentStars: number,
  addedXp: number
): {
  xp: number;
  stars: number;
  levelsGained: number;
  newLevel: number;
  levelUpBonusStars: number;
} {
  const prevLevel = getLevelInfo(currentXp).level;
  const nextXp = currentXp + Math.max(0, Math.round(addedXp));
  const nextLevel = getLevelInfo(nextXp).level;
  const levelsGained = Math.max(0, nextLevel - prevLevel);
  const levelUpBonusStars = levelsGained * LEVEL_UP_STAR_REWARD;
  return {
    xp: nextXp,
    stars: currentStars + levelUpBonusStars,
    levelsGained,
    newLevel: nextLevel,
    levelUpBonusStars,
  };
}

export function getLocalDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateParts(dateStr: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return [y, m, d];
}

export function shiftLocalDate(dateStr: string, deltaDays: number): string {
  const parts = parseDateParts(dateStr);
  if (!parts) return dateStr;
  const [y, m, d] = parts;
  const shifted = new Date(y, m - 1, d + deltaDays, 12, 0, 0, 0);
  return getLocalDateString(shifted);
}

export function getCalendarDayDiff(fromDateStr: string, toDateStr: string): number {
  const from = parseDateParts(fromDateStr);
  const to = parseDateParts(toDateStr);
  if (!from || !to) return 0;
  const fromUtc = Date.UTC(from[0], from[1] - 1, from[2]);
  const toUtc = Date.UTC(to[0], to[1] - 1, to[2]);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function reconcileDailyStreak(
  profile: PlayerProfile,
  todayStr = getLocalDateString()
): {
  profile: PlayerProfile;
  freezeConsumed: boolean;
  streakLost: boolean;
} {
  if (!profile.lastPlayedDate || profile.streak <= 0) {
    return { profile, freezeConsumed: false, streakLost: false };
  }
  const gap = getCalendarDayDiff(profile.lastPlayedDate, todayStr);
  if (gap <= 1) {
    return { profile, freezeConsumed: false, streakLost: false };
  }

  const missedDays = gap - 1;
  const freezes = profile.streakFreezes ?? 0;
  if (freezes >= missedDays) {
    const updated: PlayerProfile = {
      ...profile,
      streakFreezes: freezes - missedDays,
      lastPlayedDate: shiftLocalDate(todayStr, -1),
      lastFreezeUsedDate: todayStr,
      bestStreak: Math.max(profile.bestStreak ?? 0, profile.streak),
    };
    return { profile: updated, freezeConsumed: true, streakLost: false };
  }

  const updated: PlayerProfile = {
    ...profile,
    bestStreak: Math.max(profile.bestStreak ?? 0, profile.streak),
    streak: 0,
  };
  return { profile: updated, freezeConsumed: false, streakLost: true };
}

export function getBadgeMetricValue(profile: PlayerProfile, badgeId: string): number {
  switch (badgeId) {
    case 'surgeon':
      return profile.optimalWins ?? 0;
    case 'lightning':
      return (
        profile.fastWins ??
        (profile.fastestWinSeconds !== null && profile.fastestWinSeconds <= 45 ? 1 : 0)
      );
    case 'inseparable':
      return Math.max(profile.bestStreak ?? 0, profile.streak ?? 0);
    case 'librarian':
      return profile.uniqueWordsUsed?.length ?? 0;
    case 'purist':
      return profile.noHintWins ?? 0;
    case 'polyglot':
      return (
        profile.fiveLetterWins ??
        (profile.longestWordSolved >= 5 && profile.gamesWon > 0 ? 1 : 0)
      );
    case 'clutch':
      return profile.clutchMoves ?? 0;
    case 'miyu_tamer':
      return profile.miyuWins ?? 0;
    default:
      return 0;
  }
}

export interface BadgeProgressInfo {
  currentValue: number;
  currentTier: BadgeTierLevel;
  nextTarget: number;
  nextRewardStars: number;
  progressPct: number;
  isMaxed: boolean;
}

export function getBadgeProgress(
  profile: PlayerProfile,
  badge: BadgeDefinition
): BadgeProgressInfo {
  const currentValue = getBadgeMetricValue(profile, badge.id);
  const recordedTier =
    profile.badgeTiers?.[badge.id] ?? (profile.unlockedBadges.includes(badge.id) ? 1 : 0);

  let computedTier = 0;
  for (const t of badge.tiers) {
    if (currentValue >= t.target) {
      computedTier = t.tier;
    }
  }

  const currentTier = Math.min(4, Math.max(recordedTier, computedTier)) as BadgeTierLevel;
  const maxTierObj = badge.tiers[badge.tiers.length - 1];

  if (currentTier >= 4) {
    return {
      currentValue,
      currentTier: 4,
      nextTarget: maxTierObj.target,
      nextRewardStars: 0,
      progressPct: 100,
      isMaxed: true,
    };
  }

  const nextTierObj = badge.tiers[currentTier];
  const progressPct = Math.min(100, Math.round((currentValue / nextTierObj.target) * 100));

  return {
    currentValue,
    currentTier,
    nextTarget: nextTierObj.target,
    nextRewardStars: nextTierObj.rewardStars,
    progressPct,
    isMaxed: false,
  };
}

export function evaluateBadgeUpgrades(profile: PlayerProfile): {
  upgrades: BadgeUpgradeResult[];
  totalBonusStars: number;
  badgeTiers: Record<string, number>;
  unlockedBadges: string[];
} {
  const nextTiers: Record<string, number> = { ...(profile.badgeTiers ?? {}) };
  const unlockedSet = new Set(profile.unlockedBadges);
  const upgrades: BadgeUpgradeResult[] = [];
  let totalBonusStars = 0;

  for (const badge of BADGE_DEFINITIONS) {
    const prevTier =
      nextTiers[badge.id] ?? (unlockedSet.has(badge.id) ? 1 : 0);
    nextTiers[badge.id] = prevTier;

    const metricValue = getBadgeMetricValue(profile, badge.id);
    for (const threshold of badge.tiers) {
      if (threshold.tier > prevTier && metricValue >= threshold.target) {
        upgrades.push({
          badgeId: badge.id,
          newTier: threshold.tier,
          rewardStars: threshold.rewardStars,
        });
        totalBonusStars += threshold.rewardStars;
        nextTiers[badge.id] = threshold.tier;
        unlockedSet.add(badge.id);
      }
    }
  }

  return {
    upgrades,
    totalBonusStars,
    badgeTiers: nextTiers,
    unlockedBadges: Array.from(unlockedSet),
  };
}

function hashDateString(dateStr: string): number {
  let hash = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    hash ^= dateStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const BRONZE_POOL: Array<{ kind: DailyQuestKind; target: number }> = [
  { kind: 'play_moves', target: 5 },
  { kind: 'win_games', target: 1 },
];

const SILVER_POOL: Array<{ kind: DailyQuestKind; target: number }> = [
  { kind: 'fast_moves', target: 3 },
  { kind: 'no_hint_win', target: 1 },
  { kind: 'five_letter_win', target: 1 },
];

const GOLD_POOL: Array<{ kind: DailyQuestKind; target: number }> = [
  { kind: 'par_win', target: 1 },
  { kind: 'daily_challenge_win', target: 1 },
  { kind: 'beat_miyu', target: 1 },
];

export function generateDailyQuestsForDate(dateStr: string): DailyQuestState {
  const seed = hashDateString(dateStr);
  const bronzeChoice = BRONZE_POOL[seed % BRONZE_POOL.length];
  const silverChoice = SILVER_POOL[Math.floor(seed / 7) % SILVER_POOL.length];
  const goldChoice = GOLD_POOL[Math.floor(seed / 17) % GOLD_POOL.length];

  const quests: DailyQuest[] = [
    {
      id: `${dateStr}-bronze`,
      kind: bronzeChoice.kind,
      tier: 'bronze',
      target: bronzeChoice.target,
      progress: 0,
      rewardStars: 1,
      rewardXp: 30,
      claimed: false,
    },
    {
      id: `${dateStr}-silver`,
      kind: silverChoice.kind,
      tier: 'silver',
      target: silverChoice.target,
      progress: 0,
      rewardStars: 2,
      rewardXp: 60,
      claimed: false,
    },
    {
      id: `${dateStr}-gold`,
      kind: goldChoice.kind,
      tier: 'gold',
      target: goldChoice.target,
      progress: 0,
      rewardStars: 3,
      rewardXp: 100,
      claimed: false,
    },
  ];

  return {
    date: dateStr,
    quests,
    chestClaimed: false,
  };
}

export function ensureTodayQuests(
  profile: PlayerProfile,
  todayStr = getLocalDateString()
): DailyQuestState {
  if (
    profile.dailyQuests &&
    profile.dailyQuests.date === todayStr &&
    Array.isArray(profile.dailyQuests.quests) &&
    profile.dailyQuests.quests.length === 3
  ) {
    return profile.dailyQuests;
  }
  return generateDailyQuestsForDate(todayStr);
}

export function incrementDailyQuests(
  questState: DailyQuestState,
  deltas: Partial<Record<DailyQuestKind, number>>
): DailyQuestState {
  let changed = false;
  const nextQuests = questState.quests.map((q) => {
    const delta = deltas[q.kind];
    if (!delta || delta <= 0 || q.progress >= q.target) return q;
    changed = true;
    return {
      ...q,
      progress: Math.min(q.target, q.progress + delta),
    };
  });

  return changed ? { ...questState, quests: nextQuests } : questState;
}

export function normalizeProfile(
  profile: PlayerProfile,
  todayStr = getLocalDateString()
): PlayerProfile {
  const unlockedSet = new Set(profile.unlockedBadges ?? []);
  const badgeTiers: Record<string, number> = { ...(profile.badgeTiers ?? {}) };

  const baseProfile: PlayerProfile = {
    ...profile,
    unlockedBadges: Array.from(unlockedSet),
    bestStreak: Math.max(profile.bestStreak ?? 0, profile.streak ?? 0),
    fastWins:
      profile.fastWins ??
      (profile.fastestWinSeconds !== null && profile.fastestWinSeconds <= 45 ? 1 : 0),
    fiveLetterWins:
      profile.fiveLetterWins ??
      (profile.longestWordSolved >= 5 && profile.gamesWon > 0 ? 1 : 0),
    clutchMoves: profile.clutchMoves ?? 0,
    miyuWins: profile.miyuWins ?? 0,
    streakFreezes: Math.min(MAX_STREAK_FREEZES, Math.max(0, profile.streakFreezes ?? 0)),
    lastFreezeUsedDate: profile.lastFreezeUsedDate ?? null,
    duoStreaks: profile.duoStreaks ?? {},
    duelWins: profile.duelWins ?? 0,
    unlockedTileStyles:
      Array.isArray(profile.unlockedTileStyles) && profile.unlockedTileStyles.length > 0
        ? profile.unlockedTileStyles
        : (['classic'] as TileStyleId[]),
    activeTileStyle: profile.activeTileStyle ?? 'classic',
    unlockedFrames:
      Array.isArray(profile.unlockedFrames) && profile.unlockedFrames.length > 0
        ? profile.unlockedFrames
        : (['none'] as AvatarFrameId[]),
    activeFrame: profile.activeFrame ?? 'none',
  };

  for (const badge of BADGE_DEFINITIONS) {
    const val = getBadgeMetricValue(baseProfile, badge.id);
    let highest = badgeTiers[badge.id] ?? (unlockedSet.has(badge.id) ? 1 : 0);
    for (const threshold of badge.tiers) {
      if (val >= threshold.target && threshold.tier > highest) {
        highest = threshold.tier;
      }
    }
    if (highest > 0) {
      badgeTiers[badge.id] = highest;
      unlockedSet.add(badge.id);
    }
  }

  return {
    ...baseProfile,
    badgeTiers,
    unlockedBadges: Array.from(unlockedSet),
    dailyQuests: ensureTodayQuests(baseProfile, todayStr),
  };
}

export function getActiveDuoStreak(
  profile: Pick<PlayerProfile, 'duoStreaks'>,
  partnerId: string | null | undefined,
  todayStr = getLocalDateString()
): number {
  if (!partnerId) return 0;
  const entry = profile.duoStreaks?.[partnerId];
  if (!entry || entry.streak <= 0) return 0;
  const gap = getCalendarDayDiff(entry.lastPlayedDate, todayStr);
  return gap <= 1 ? entry.streak : 0;
}

export function updateDuoStreakOnWin(
  profile: Pick<PlayerProfile, 'duoStreaks'>,
  partner: Pick<PlayerPresence, 'playerId' | 'name' | 'avatarId' | 'color'>,
  todayStr = getLocalDateString()
): { duoStreaks: Record<string, DuoStreakEntry>; newStreak: number } {
  const prevMap = { ...(profile.duoStreaks ?? {}) };
  const prev = prevMap[partner.playerId];
  let nextStreak = 1;
  if (prev && prev.streak > 0) {
    const gap = getCalendarDayDiff(prev.lastPlayedDate, todayStr);
    if (gap === 0) {
      nextStreak = prev.streak;
    } else if (gap === 1) {
      nextStreak = prev.streak + 1;
    } else {
      nextStreak = 1;
    }
  }

  prevMap[partner.playerId] = {
    partnerId: partner.playerId,
    partnerName: partner.name,
    avatarId: partner.avatarId,
    color: partner.color,
    streak: nextStreak,
    bestStreak: Math.max(prev?.bestStreak ?? 0, nextStreak),
    lastPlayedDate: todayStr,
  };

  return { duoStreaks: prevMap, newStreak: nextStreak };
}

export interface DuelScoreBreakdown {
  hostScore: number;
  partnerScore: number;
  myScore: number;
  opponentScore: number;
  isTie: boolean;
  isMeWinning: boolean;
  isOpponentWinning: boolean;
}

export function computeDuelScores(
  room: Pick<
    GameRoom,
    | 'moves'
    | 'targetWord'
    | 'language'
    | 'startedAt'
    | 'hostPlayer'
    | 'partnerPlayer'
    | 'winnerPlayerId'
  >,
  mePlayerId: string
): DuelScoreBreakdown {
  let hostScore = 0;
  let partnerScore = 0;
  let prevTs = room.startedAt;

  for (const move of room.moves) {
    if (move.isUndoPenalty) {
      prevTs = move.timestamp || prevTs;
      continue;
    }

    const distBefore = getRemainingBfsSteps(
      move.previousWord,
      room.targetWord,
      room.language
    );
    const distAfter = getRemainingBfsSteps(move.word, room.targetWord, room.language);

    let pts = 10;
    if (distBefore !== null && distAfter !== null && distAfter < distBefore) {
      pts += 15;
    }
    if (move.timestamp - prevTs <= TEMPO_COMBO_WINDOW_MS) {
      pts += 5;
    }
    if (move.word === room.targetWord) {
      pts += 25;
    }

    if (move.playerId === room.hostPlayer.playerId) {
      hostScore += pts;
    } else {
      partnerScore += pts;
    }

    prevTs = move.timestamp || prevTs;
  }

  const iAmHost = room.hostPlayer.playerId === mePlayerId;
  const myScore = iAmHost ? hostScore : partnerScore;
  const opponentScore = iAmHost ? partnerScore : hostScore;
  const isTie = myScore === opponentScore;
  const isMeWinning =
    myScore > opponentScore || (isTie && room.winnerPlayerId === mePlayerId && room.moves.length > 0);
  const isOpponentWinning = !isTie && opponentScore > myScore;

  return {
    hostScore,
    partnerScore,
    myScore,
    opponentScore,
    isTie: isTie && !isMeWinning,
    isMeWinning,
    isOpponentWinning,
  };
}
