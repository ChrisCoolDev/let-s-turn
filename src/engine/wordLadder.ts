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
import type { GameMode, Language, WordLength } from '../types/game';

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

function bfsPath(start: string, target: string, vocab: Set<string>): string[] | null {
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

const CURATED_PAIRS: Record<`${Language}_${WordLength}`, CuratedPair[]> = {
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
  ],
  EN_5: [
    { start: 'HEART', target: 'SHARE' },
    { start: 'TRAIN', target: 'PLANE' },
    { start: 'SWEET', target: 'BLEND' },
    { start: 'BLACK', target: 'FREAK' },
    { start: 'GREEN', target: 'TROUT' },
    { start: 'MAGIC', target: 'TANGY' },
    { start: 'STONE', target: 'REARS' },
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
  ],
  FR_5: [
    { start: 'TERRE', target: 'MERLE' },
    { start: 'TERRE', target: 'MOTTE' },
    { start: 'CARTE', target: 'COLLE' },
    { start: 'CHAUD', target: 'TROIS' },
    { start: 'SABLE', target: 'FIRME' },
    { start: 'FRIME', target: 'CRANE' },
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

  // Prefer curated everyday pairs for Daily mode and FR / 5-letter challenges
  const curated = CURATED_PAIRS[key].filter((p) => p.start !== avoidStartWord);

  if (mode === 'daily' || lang === 'FR' || length === 5 || rng() < 0.6) {
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
  for (let attempt = 0; attempt < 25; attempt++) {
    const start = wordList[Math.floor(rng() * wordList.length)];
    if (!start || start === avoidStartWord) continue;

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
      const target = candidates[Math.floor(rng() * candidates.length)];
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
