import {
  EN_4_COMMON_LIST,
  EN_4_COMMON_SET,
  EN_4_SET,
  EN_5_LIST,
  EN_5_SET,
  FR_4_LIST,
  FR_4_SET,
  FR_5_LIST,
  FR_5_SET,
} from './dictionaries';
import type { GameMode, GameRoom, Language, WordLength } from '../types/game';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface DiffResult {
  valid: boolean;
  changedIndex: number;
  fromChar: string;
  toChar: string;
}

export interface HintResult {
  nextWord: string;
  changedIndex: number;
  targetChar: string;
  remainingSteps: number;
}

export function getDictionarySet(lang: Language, length: WordLength): Set<string> {
  if (lang === 'EN') {
    return length === 4 ? EN_4_SET : EN_5_SET;
  }
  return length === 4 ? FR_4_SET : FR_5_SET;
}

export function getHintDictionarySet(lang: Language, length: WordLength): Set<string> {
  if (lang === 'EN' && length === 4) {
    return EN_4_COMMON_SET;
  }
  return getDictionarySet(lang, length);
}

export function isValidWord(word: string, lang: Language, length: WordLength): boolean {
  const clean = word.trim().toUpperCase();
  if (clean.length !== length) return false;
  return getDictionarySet(lang, length).has(clean);
}

export function isOneLetterDiff(wordA: string, wordB: string): DiffResult {
  const a = wordA.trim().toUpperCase();
  const b = wordB.trim().toUpperCase();
  if (a.length !== b.length) {
    return { valid: false, changedIndex: -1, fromChar: '', toChar: '' };
  }

  let diffs = 0;
  let changedIndex = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      diffs++;
      changedIndex = i;
      if (diffs > 1) {
        return { valid: false, changedIndex: -1, fromChar: '', toChar: '' };
      }
    }
  }

  if (diffs !== 1 || changedIndex === -1) {
    return { valid: false, changedIndex: -1, fromChar: '', toChar: '' };
  }

  return {
    valid: true,
    changedIndex,
    fromChar: a[changedIndex],
    toChar: b[changedIndex],
  };
}

function bfsPath(
  start: string,
  target: string,
  vocab: Set<string>,
  excludedWords?: Set<string>
): string[] | null {
  if (start === target) return [start];
  if (!vocab.has(start) || !vocab.has(target)) return null;

  const parent = new Map<string, string | null>();
  parent.set(start, null);
  const queue: string[] = [start];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    for (let i = 0; i < current.length; i++) {
      const prefix = current.slice(0, i);
      const suffix = current.slice(i + 1);
      const origChar = current[i];

      for (let c = 0; c < ALPHABET.length; c++) {
        const ch = ALPHABET[c];
        if (ch === origChar) continue;
        const next = prefix + ch + suffix;
        if (!vocab.has(next) || parent.has(next)) continue;
        if (excludedWords && next !== target && next !== start && excludedWords.has(next)) {
          continue;
        }

        parent.set(next, current);
        if (next === target) {
          const path: string[] = [];
          let cur: string | null = next;
          while (cur !== null) {
            path.push(cur);
            cur = parent.get(cur) ?? null;
          }
          return path.reverse();
        }
        queue.push(next);
      }
    }
  }

  return null;
}

export function findValidNeighbors(word: string, lang: Language): string[] {
  const clean = word.trim().toUpperCase();
  if (clean.length !== 4 && clean.length !== 5) return [];
  const vocab = getDictionarySet(lang, clean.length as WordLength);
  return findNeighbors(clean, vocab);
}

export function findShortestPathExcluding(
  startWord: string,
  targetWord: string,
  lang: Language,
  excludedWords: Set<string>
): string[] | null {
  const start = startWord.trim().toUpperCase();
  const target = targetWord.trim().toUpperCase();
  if (start.length !== target.length || (start.length !== 4 && start.length !== 5)) {
    return null;
  }
  const length = start.length as WordLength;

  if (lang === 'EN' && length === 4) {
    const commonVocab = new Set(EN_4_COMMON_SET);
    commonVocab.add(start);
    commonVocab.add(target);
    const commonPath = bfsPath(start, target, commonVocab, excludedWords);
    if (commonPath) return commonPath;
  }

  const fullVocab = new Set(getDictionarySet(lang, length));
  fullVocab.add(start);
  fullVocab.add(target);
  return bfsPath(start, target, fullVocab, excludedWords);
}

export function findShortestPath(
  startWord: string,
  targetWord: string,
  lang: Language
): string[] | null {
  const start = startWord.trim().toUpperCase();
  const target = targetWord.trim().toUpperCase();
  if (start.length !== target.length || (start.length !== 4 && start.length !== 5)) {
    return null;
  }
  const length = start.length as WordLength;

  if (lang === 'EN' && length === 4) {
    const commonVocab = new Set(EN_4_COMMON_SET);
    commonVocab.add(start);
    commonVocab.add(target);
    const commonPath = bfsPath(start, target, commonVocab);
    if (commonPath) return commonPath;
  }

  const fullVocab = new Set(getDictionarySet(lang, length));
  fullVocab.add(start);
  fullVocab.add(target);
  return bfsPath(start, target, fullVocab);
}

export function getHintForWord(
  currentWord: string,
  targetWord: string,
  lang: Language
): HintResult | null {
  const path = findShortestPath(currentWord, targetWord, lang);
  if (!path || path.length < 2) return null;

  const nextWord = path[1];
  const diff = isOneLetterDiff(currentWord, nextWord);
  if (!diff.valid) return null;

  return {
    nextWord,
    changedIndex: diff.changedIndex,
    targetChar: diff.toChar,
    remainingSteps: path.length - 1,
  };
}

interface CuratedPair {
  start: string;
  target: string;
}

export const CURATED_PAIRS: Record<`${Language}_${WordLength}`, CuratedPair[]> = {
  EN_4: [
    { start: 'WINE', target: 'SLIM' },
    { start: 'COLD', target: 'WARM' },
    { start: 'FIRE', target: 'GOLD' },
    { start: 'STAR', target: 'MOON' },
    { start: 'DARK', target: 'LAMP' },
    { start: 'RAIN', target: 'SNOW' },
    { start: 'BOOK', target: 'READ' },
    { start: 'SHIP', target: 'BOAT' },
    { start: 'WOLF', target: 'LION' },
    { start: 'TREE', target: 'LEAF' },
    { start: 'HEAD', target: 'FOOT' },
    { start: 'MILK', target: 'CAKE' },
    { start: 'WORK', target: 'HOME' },
    { start: 'BIRD', target: 'WING' },
    { start: 'WIND', target: 'GALE' },
    { start: 'KING', target: 'DUKE' },
    { start: 'HAND', target: 'FIST' },
    { start: 'TIME', target: 'HOUR' },
    { start: 'ROSE', target: 'LILY' },
    { start: 'SEED', target: 'ROOT' },
    { start: 'LOVE', target: 'HATE' },
    { start: 'HOPE', target: 'WISH' },
    { start: 'SAND', target: 'DUNE' },
    { start: 'WAVE', target: 'TIDE' },
    { start: 'CITY', target: 'TOWN' },
    { start: 'ROAD', target: 'PATH' },
    { start: 'DOOR', target: 'GATE' },
    { start: 'DAWN', target: 'DUSK' },
    { start: 'SOFT', target: 'HARD' },
    { start: 'SLOW', target: 'FAST' },
    { start: 'POOR', target: 'RICH' },
    { start: 'WILD', target: 'TAME' },
    { start: 'GRAY', target: 'CYAN' },
    { start: 'TEAL', target: 'NAVY' },
    { start: 'RUBY', target: 'JADE' },
    { start: 'SOUP', target: 'MEAL' },
    { start: 'RICE', target: 'CORN' },
    { start: 'PEAR', target: 'PLUM' },
    { start: 'MINT', target: 'SALT' },
    { start: 'FROG', target: 'TOAD' },
    { start: 'HAWK', target: 'DOVE' },
    { start: 'DUCK', target: 'SWAN' },
    { start: 'SONG', target: 'TUNE' },
    { start: 'NOTE', target: 'STEM' },
    { start: 'FILM', target: 'SHOW' },
    { start: 'HERO', target: 'FOOL' },
    { start: 'GOLD', target: 'SILK' },
    { start: 'WOOD', target: 'BARK' },
    { start: 'ROCK', target: 'PEAK' },
    { start: 'LAKE', target: 'POND' },
    { start: 'SHIP', target: 'SAIL' },
    { start: 'CART', target: 'MILE' },
    { start: 'RING', target: 'BELL' },
    { start: 'BOOT', target: 'SHOE' },
    { start: 'COAT', target: 'VEST' },
    { start: 'DRUM', target: 'HORN' },
    { start: 'QUIZ', target: 'TEST' },
    { start: 'FACT', target: 'MYTH' },
    { start: 'MIND', target: 'SOUL' },
    { start: 'GIFT', target: 'CARD' },
    { start: 'CREW', target: 'TEAM' },
    { start: 'BANK', target: 'COIN' },
    { start: 'DEBT', target: 'LOAN' },
    { start: 'JUMP', target: 'LEAP' },
    { start: 'WALK', target: 'RUNS' },
    { start: 'SPIN', target: 'TURN' },
    { start: 'EYES', target: 'NOSE' },
    { start: 'LIPS', target: 'FACE' },
    { start: 'SKIN', target: 'BONE' },
    { start: 'KNEE', target: 'SHIN' },
  ],
  EN_5: [
    { start: 'HEART', target: 'SHARE' },
    { start: 'TRAIN', target: 'PLANE' },
    { start: 'SWEET', target: 'BLEND' },
    { start: 'BLACK', target: 'FREAK' },
    { start: 'GREEN', target: 'TROUT' },
    { start: 'MAGIC', target: 'TANGY' },
    { start: 'STONE', target: 'REARS' },
    { start: 'BREAD', target: 'TOAST' },
    { start: 'WATER', target: 'RIVER' },
    { start: 'STORM', target: 'CLOUD' },
    { start: 'FLAME', target: 'SPARK' },
    { start: 'SLEEP', target: 'DREAM' },
    { start: 'WHALE', target: 'SHARK' },
    { start: 'PLATE', target: 'BOWLS' },
    { start: 'SHIRT', target: 'JEANS' },
    { start: 'BOOTS', target: 'SOCKS' },
    { start: 'SCARF', target: 'GLOVE' },
    { start: 'WOODS', target: 'GROVE' },
    { start: 'PLANT', target: 'BLOOM' },
    { start: 'SEEDS', target: 'ROOTS' },
    { start: 'STARS', target: 'COMET' },
    { start: 'BRAIN', target: 'THINK' },
    { start: 'PEACE', target: 'TRUCE' },
    { start: 'GRACE', target: 'CHARM' },
    { start: 'FRESH', target: 'CRISP' },
    { start: 'QUIET', target: 'STILL' },
    { start: 'WRITE', target: 'PROSE' },
    { start: 'STAGE', target: 'SCENE' },
    { start: 'DRIVE', target: 'TRACK' },
    { start: 'GLASS', target: 'BRICK' },
    { start: 'CHESS', target: 'CARDS' },
    { start: 'SMILE', target: 'GLOWS' },
    { start: 'HOUSE', target: 'HOMES' },
    { start: 'LEMON', target: 'LIMES' },
    { start: 'SNOWS', target: 'FROST' },
    { start: 'WINDS', target: 'GALES' },
    { start: 'GLOBE', target: 'SPACE' },
    { start: 'WHITE', target: 'BLACK' },
    { start: 'HAPPY', target: 'MERRY' },
    { start: 'FUNNY', target: 'JOLLY' },
    { start: 'TRUST', target: 'FAITH' },
    { start: 'CHOIR', target: 'CHIME' },
    { start: 'FLUTE', target: 'DRUMS' },
    { start: 'GREAT', target: 'GRAND' },
    { start: 'POINT', target: 'LINES' },
    { start: 'FRONT', target: 'BACKS' },
    { start: 'EARLY', target: 'LATER' },
    { start: 'PAUSE', target: 'CEASE' },
    { start: 'WORDS', target: 'STORY' },
    { start: 'BOOKS', target: 'PAPER' },
    { start: 'NOVEL', target: 'POEMS' },
    { start: 'SHEET', target: 'PAGES' },
    { start: 'CROSS', target: 'TRAIL' },
    { start: 'TIGER', target: 'LIONS' },
    { start: 'BIRDS', target: 'WINGS' },
    { start: 'SNAKE', target: 'FROGS' },
    { start: 'WALLS', target: 'DOORS' },
    { start: 'STORE', target: 'SHOPS' },
    { start: 'MONEY', target: 'COINS' },
    { start: 'GIFTS', target: 'CARDS' },
    { start: 'SHAPE', target: 'FORMS' },
    { start: 'FORCE', target: 'POWER' },
    { start: 'HEAVY', target: 'DENSE' },
    { start: 'FEAST', target: 'MEALS' },
    { start: 'SPELL', target: 'CHARM' },
    { start: 'CHEST', target: 'TRUNK' },
  ],
  FR_4: [
    { start: 'VENT', target: 'SANG' },
    { start: 'PAIN', target: 'FOUR' },
    { start: 'CHAT', target: 'SOIR' },
    { start: 'DAME', target: 'ROIS' },
    { start: 'BOIS', target: 'FEUX' },
    { start: 'NUIT', target: 'AUBE' },
    { start: 'LOUP', target: 'JOUR' },
    { start: 'ROSE', target: 'LIME' },
    { start: 'MARE', target: 'LUNE' },
    { start: 'TOUR', target: 'PONT' },
    { start: 'MAIN', target: 'PIED' },
    { start: 'YEUX', target: 'PEAU' },
    { start: 'TETE', target: 'COUP' },
    { start: 'AMIE', target: 'RUDE' },
    { start: 'BEAU', target: 'LAID' },
    { start: 'DOUX', target: 'RAPE' },
    { start: 'BLEU', target: 'VERT' },
    { start: 'NOIR', target: 'GRIS' },
    { start: 'ORNE', target: 'PALE' },
    { start: 'BRUN', target: 'ROUX' },
    { start: 'LAIT', target: 'MIEL' },
    { start: 'LION', target: 'OURS' },
    { start: 'PORT', target: 'QUAI' },
    { start: 'PONT', target: 'GARE' },
    { start: 'MURS', target: 'TOIT' },
    { start: 'DORT', target: 'REVE' },
    { start: 'COUR', target: 'SAUT' },
    { start: 'LIRE', target: 'VOIR' },
    { start: 'FAIT', target: 'PRIS' },
    { start: 'VAIN', target: 'FIER' },
    { start: 'LOIN', target: 'PRES' },
    { start: 'SEUL', target: 'DEUX' },
    { start: 'LAME', target: 'EPEE' },
    { start: 'PAIX', target: 'TRUC' },
    { start: 'JEUX', target: 'RUSE' },
    { start: 'SONS', target: 'VOIX' },
    { start: 'CUIR', target: 'DRAP' },
    { start: 'AMIS', target: 'CHER' },
    { start: 'BANC', target: 'PARC' },
    { start: 'BORD', target: 'RIVE' },
    { start: 'BRAS', target: 'MAIN' },
    { start: 'BRIE', target: 'MIDI' },
    { start: 'CAPE', target: 'ROBE' },
    { start: 'CAVE', target: 'VINS' },
    { start: 'CERF', target: 'DAIM' },
    { start: 'CHAR', target: 'TANK' },
    { start: 'CHEF', target: 'ROIS' },
    { start: 'CRIE', target: 'RIRE' },
    { start: 'CUBE', target: 'ROND' },
    { start: 'DANS', target: 'SOUS' },
    { start: 'DATE', target: 'MOIS' },
    { start: 'DEMI', target: 'TOUT' },
    { start: 'DENT', target: 'JOUE' },
    { start: 'DIEU', target: 'ANGE' },
    { start: 'DIRE', target: 'MOTS' },
    { start: 'DOME', target: 'TOUR' },
    { start: 'DONT', target: 'POUR' },
    { start: 'DRAP', target: 'LITS' },
    { start: 'EAUX', target: 'FLOT' },
    { start: 'ETAT', target: 'PAYS' },
    { start: 'FAIM', target: 'SOIF' },
    { start: 'FILS', target: 'PERE' },
    { start: 'FOIS', target: 'TOUR' },
    { start: 'FOND', target: 'HAUT' },
    { start: 'FORT', target: 'DOUX' },
  ],
  FR_5: [
    { start: 'TERRE', target: 'MERLE' },
    { start: 'TERRE', target: 'MOTTE' },
    { start: 'CARTE', target: 'COLLE' },
    { start: 'CHAUD', target: 'TROIS' },
    { start: 'SABLE', target: 'FIRME' },
    { start: 'FRIME', target: 'CRANE' },
    { start: 'CHOSE', target: 'FORCE' },
    { start: 'AIMER', target: 'HAINE' },
    { start: 'JOURS', target: 'SOIRS' },
    { start: 'ROUGE', target: 'VERTS' },
    { start: 'PAINS', target: 'TARTE' },
    { start: 'POMME', target: 'POIRE' },
    { start: 'SOUPE', target: 'CREME' },
    { start: 'CHATS', target: 'LOUPS' },
    { start: 'AIGLE', target: 'MERLE' },
    { start: 'ROCHE', target: 'MONTS' },
    { start: 'FORET', target: 'BOISE' },
    { start: 'MAINS', target: 'PIEDS' },
    { start: 'DENTS', target: 'LEVRE' },
    { start: 'LIVRE', target: 'PAGES' },
    { start: 'DANSE', target: 'VALSE' },
    { start: 'VILLE', target: 'RUEES' },
    { start: 'ROUTE', target: 'PISTE' },
    { start: 'ROBES', target: 'JUPES' },
    { start: 'BOTTE', target: 'GANTS' },
    { start: 'GARDE', target: 'ARMEE' },
    { start: 'PEINE', target: 'JOIES' },
    { start: 'JAUNE', target: 'BLEUE' },
    { start: 'MATIN', target: 'SOIRS' },
    { start: 'ORAGE', target: 'BRUME' },
    { start: 'ROSES', target: 'LILAS' },
    { start: 'TIGRE', target: 'LIONS' },
    { start: 'SIEGE', target: 'BANCS' },
    { start: 'LITRE', target: 'VERRE' },
    { start: 'POELE', target: 'FOURS' },
    { start: 'POIRE', target: 'PRUNE' },
    { start: 'SALEE', target: 'SUCRE' },
    { start: 'SANGS', target: 'VEINE' },
    { start: 'CONTE', target: 'ROMAN' },
    { start: 'VERSO', target: 'RECTO' },
    { start: 'FLUTE', target: 'HARPE' },
    { start: 'TOILE', target: 'CADRE' },
    { start: 'COULE', target: 'TEINT' },
    { start: 'VOILE', target: 'CANOT' },
    { start: 'VESTE', target: 'CAPOT' },
    { start: 'BONNE', target: 'BERET' },
    { start: 'BOTTE', target: 'TALON' },
    { start: 'CABLE', target: 'FILMS' },
    { start: 'GAGNE', target: 'PERDS' },
    { start: 'HAUTS', target: 'BASES' },
    { start: 'LOURD', target: 'LEGER' },
    { start: 'PARTI', target: 'RESTE' },
    { start: 'DORME', target: 'REVER' },
    { start: 'PARLE', target: 'TAISE' },
    { start: 'LUTIN', target: 'TAPIS' },
    { start: 'ETUDE', target: 'EXILE' },
    { start: 'EVITE', target: 'GRIME' },
    { start: 'CYGNE', target: 'VAGUE' },
    { start: 'FAUVE', target: 'REINE' },
  ],
};

function seededRandom(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function findNeighbors(word: string, vocab: Set<string>): string[] {
  const neighbors: string[] = [];
  for (let i = 0; i < word.length; i++) {
    const prefix = word.slice(0, i);
    const suffix = word.slice(i + 1);
    const orig = word[i];
    for (let c = 0; c < ALPHABET.length; c++) {
      const ch = ALPHABET[c];
      if (ch === orig) continue;
      const cand = prefix + ch + suffix;
      if (vocab.has(cand)) neighbors.push(cand);
    }
  }
  return neighbors;
}

export interface GeneratedWordPair {
  startWord: string;
  targetWord: string;
  optimalPath: string[];
  optimalPar: number;
}

export function generateWordPair(
  lang: Language,
  length: WordLength,
  mode: GameMode,
  avoidStartWord?: string
): GeneratedWordPair {
  const key = `${lang}_${length}` as `${Language}_${WordLength}`;
  const rng =
    mode === 'daily'
      ? seededRandom(`daily-${getTodayKey()}-${lang}-${length}`)
      : Math.random;

  const vocab = getHintDictionarySet(lang, length);
  const wordList =
    lang === 'EN'
      ? length === 4
        ? EN_4_COMMON_LIST
        : EN_5_LIST
      : length === 4
      ? FR_4_LIST
      : FR_5_LIST;

  // Use curated everyday pairs deterministically for Daily mode, and ~35% of the time otherwise
  const curated = CURATED_PAIRS[key].filter((p) => p.start !== avoidStartWord);

  if (mode === 'daily' || rng() < 0.35) {
    for (let attempt = 0; attempt < curated.length; attempt++) {
      const idx = Math.floor(rng() * curated.length);
      const chosen = curated[(idx + attempt) % curated.length];
      const path = findShortestPath(chosen.start, chosen.target, lang);
      if (path && path.length - 1 >= 3 && path.length - 1 <= 7) {
        return {
          startWord: chosen.start,
          targetWord: chosen.target,
          optimalPath: path,
          optimalPar: path.length - 1,
        };
      }
    }
  }

  // Try random BFS distance-4..7 discovery on the dictionary
  for (let attempt = 0; attempt < 40; attempt++) {
    const start = wordList[Math.floor(rng() * wordList.length)];
    if (!start || start === avoidStartWord) continue;
    if (findNeighbors(start, vocab).length < 2) continue;

    // BFS layer expansion to find words at exact distance 4..7
    const dist = new Map<string, number>();
    dist.set(start, 0);
    const queue: string[] = [start];
    const candidates: string[] = [];
    let head = 0;

    while (head < queue.length && candidates.length < 30) {
      const cur = queue[head++];
      const d = dist.get(cur) ?? 0;
      if (d >= 7) continue;

      const neighbors = findNeighbors(cur, vocab);
      for (const nxt of neighbors) {
        if (!dist.has(nxt)) {
          dist.set(nxt, d + 1);
          queue.push(nxt);
          if (d + 1 >= 4 && d + 1 <= 7) {
            candidates.push(nxt);
          }
        }
      }
    }

    if (candidates.length > 0) {
      const farCandidates = candidates.filter((cand) => {
        let diff = 0;
        for (let i = 0; i < cand.length; i++) {
          if (cand[i] !== start[i]) diff++;
        }
        return diff >= 3;
      });
      const targetPool = farCandidates.length > 0 ? farCandidates : candidates;
      const target = targetPool[Math.floor(rng() * targetPool.length)];
      const path = findShortestPath(start, target, lang);
      if (path && path.length - 1 >= 4 && path.length - 1 <= 7) {
        return {
          startWord: start,
          targetWord: target,
          optimalPath: path,
          optimalPar: path.length - 1,
        };
      }
    }
  }

  // Fallback to verified curated pair
  const fallback = curated[Math.floor(rng() * curated.length)] ?? CURATED_PAIRS[key][0];
  const fallbackPath = findShortestPath(fallback.start, fallback.target, lang) ?? [
    fallback.start,
    fallback.target,
  ];
  return {
    startWord: fallback.start,
    targetWord: fallback.target,
    optimalPath: fallbackPath,
    optimalPar: Math.max(4, fallbackPath.length - 1),
  };
}

const GOLDEN_LETTER_PRIORITY = 'KVWBGPYFHCMDUOALRNSTIEZXJQ';

function hashStringDeterministic(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickGoldenLetter(
  startWord: string,
  targetWord: string,
  optimalPath: string[],
  language: Language
): string | null {
  const start = startWord.trim().toUpperCase();
  const target = targetWord.trim().toUpperCase();
  const excluded = new Set<string>([...start.split(''), ...target.split('')]);
  const candidates = new Set<string>();

  const path =
    optimalPath && optimalPath.length >= 2
      ? optimalPath
      : findShortestPath(start, target, language) ?? [start, target];

  for (const w of path.slice(1, -1)) {
    for (const ch of w.trim().toUpperCase()) {
      if (ch >= 'A' && ch <= 'Z' && !excluded.has(ch)) {
        candidates.add(ch);
      }
    }
  }

  for (const baseWord of path.slice(0, -1)) {
    const neighbors = findValidNeighbors(baseWord, language);
    for (const neighbor of neighbors) {
      if (neighbor === start || neighbor === target) continue;
      if (findValidNeighbors(neighbor, language).length < 2) continue;
      for (const ch of neighbor) {
        if (ch >= 'A' && ch <= 'Z' && !excluded.has(ch)) {
          candidates.add(ch);
        }
      }
    }
  }

  if (candidates.size === 0) return null;

  const sorted = Array.from(candidates).sort((a, b) => {
    const idxA = GOLDEN_LETTER_PRIORITY.indexOf(a);
    const idxB = GOLDEN_LETTER_PRIORITY.indexOf(b);
    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
  });

  const topPool = sorted.slice(0, 3);
  const seed = hashStringDeterministic(`${language}:${start}:${target}`);
  return topPool[seed % topPool.length];
}

export function getRoomGoldenLetter(
  room: Pick<GameRoom, 'startWord' | 'targetWord' | 'optimalPath' | 'language' | 'goldenLetter'>
): string | null {
  if (room.goldenLetter && /^[A-Z]$/.test(room.goldenLetter)) {
    return room.goldenLetter;
  }
  return pickGoldenLetter(room.startWord, room.targetWord, room.optimalPath, room.language);
}

export function hasClaimedGoldenLetter(
  room: Pick<
    GameRoom,
    'moves' | 'goldenLetter' | 'goldenLetterClaimed' | 'startWord' | 'targetWord' | 'optimalPath' | 'language'
  >
): boolean {
  if (room.goldenLetterClaimed) return true;
  const letter = getRoomGoldenLetter(room);
  if (!letter) return false;
  return room.moves.some((m) => !m.isUndoPenalty && m.word.includes(letter));
}

const remainingStepsCache = new Map<string, number | null>();

export function getRemainingBfsSteps(
  word: string,
  targetWord: string,
  lang: Language
): number | null {
  const start = word.trim().toUpperCase();
  const target = targetWord.trim().toUpperCase();
  if (start === target) return 0;
  const cacheKey = `${lang}:${start}:${target}`;
  if (remainingStepsCache.has(cacheKey)) {
    return remainingStepsCache.get(cacheKey) ?? null;
  }
  const path = findShortestPath(start, target, lang);
  const steps = path ? Math.max(0, path.length - 1) : null;
  if (remainingStepsCache.size > 2000) {
    remainingStepsCache.clear();
  }
  remainingStepsCache.set(cacheKey, steps);
  return steps;
}

let cachedTotalDictionaryWords: number | null = null;

export function getTotalDictionaryWordCount(): number {
  if (cachedTotalDictionaryWords !== null) return cachedTotalDictionaryWords;
  cachedTotalDictionaryWords = new Set<string>([
    ...EN_4_SET,
    ...EN_5_SET,
    ...FR_4_SET,
    ...FR_5_SET,
  ]).size;
  return cachedTotalDictionaryWords;
}

const LETTER_RARITY_WEIGHTS: Record<string, number> = {
  Z: 10,
  Q: 9,
  X: 9,
  J: 8,
  K: 8,
  W: 7,
  Y: 6,
  H: 4,
  F: 4,
  V: 4,
  B: 3,
  G: 3,
  P: 3,
};

export function computeWordRarityScore(word: string): number {
  let score = word.length >= 5 ? 4 : 0;
  for (const ch of word.trim().toUpperCase()) {
    score += LETTER_RARITY_WEIGHTS[ch] ?? 1;
  }
  return score;
}
