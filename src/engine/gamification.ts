import type { BadgeDefinition, PlayerProfile, ThemeShopItem } from '../types/game';

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
    description: 'Finir une partie exactement au nombre de coups optimal.',
    conditionLabel: 'Atteindre le Par optimal (ou mieux)',
    color: '#58cc02',
  },
  {
    id: 'lightning',
    icon: '⚡',
    title: 'Éclair',
    description: 'Finir un duel en direct en moins de 45 secondes.',
    conditionLabel: 'Victoire chrono < 45s',
    color: '#1cb0f6',
  },
  {
    id: 'inseparable',
    icon: '🔥',
    title: 'Inséparables',
    description: 'Maintenir une série de 7 jours consécutifs en duo.',
    conditionLabel: 'Streak de 7 jours (ou +)',
    color: '#ff9600',
  },
  {
    id: 'librarian',
    icon: '📚',
    title: 'Bibliothécaire',
    description: 'Forger des chaînes avec 100 mots uniques différents.',
    conditionLabel: '100 mots uniques joués',
    color: '#ce82ff',
  },
  {
    id: 'purist',
    icon: '🧠',
    title: 'Puriste',
    description: 'Gagner 5 parties sans utiliser le moindre indice.',
    conditionLabel: '5 victoires sans indice',
    color: '#ffc800',
  },
  {
    id: 'polyglot',
    icon: '🌍',
    title: 'Alchimiste Polyglotte',
    description: 'Compléter des chaînes de 5 lettres avec brio.',
    conditionLabel: 'Résoudre un défi 5 lettres',
    color: '#ff4b4b',
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

const LEVEL_TITLES = [
  'Apprenti des Lettres',
  'Tisseur de Mots',
  'Éclaireur Lexical',
  'Alchimiste des Mots',
  'Maître des Chaînes',
  'Légende du Duo',
];

export function getLevelInfo(xp: number): LevelInfo {
  const xpPerLevel = 150;
  const level = Math.floor(xp / xpPerLevel) + 1;
  const currentLevelXp = xp % xpPerLevel;
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  return {
    level,
    title,
    currentLevelXp,
    nextLevelXp: xpPerLevel,
    progressPct: Math.min(100, Math.round((currentLevelXp / xpPerLevel) * 100)),
  };
}

export function evaluateNewBadges(
  profile: PlayerProfile,
  justCompletedStats?: {
    durationSeconds: number;
    actualSteps: number;
    optimalPar: number;
    hintsUsed: number;
    wordLength: number;
  }
): string[] {
  const unlocked = new Set(profile.unlockedBadges);
  const newlyUnlocked: string[] = [];

  const grant = (id: string) => {
    if (!unlocked.has(id)) {
      unlocked.add(id);
      newlyUnlocked.push(id);
    }
  };

  if (justCompletedStats) {
    if (justCompletedStats.actualSteps <= justCompletedStats.optimalPar) {
      grant('surgeon');
    }
    if (justCompletedStats.durationSeconds <= 45) {
      grant('lightning');
    }
    if (justCompletedStats.wordLength >= 5) {
      grant('polyglot');
    }
  }

  if (profile.streak >= 7) {
    grant('inseparable');
  }
  if (profile.uniqueWordsUsed.length >= 100) {
    grant('librarian');
  }
  if (profile.noHintWins >= 5) {
    grant('purist');
  }

  return newlyUnlocked;
}
