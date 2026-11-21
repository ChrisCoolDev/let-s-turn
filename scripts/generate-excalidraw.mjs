#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const OUT_PATH = path.resolve(process.cwd(), 'docs/system-design.excalidraw');

// Exact required pastel palette
const PALETTE = {
  GREEN: { bg: '#b2f2bb', stroke: '#2f9e44', text: '#143d1d' },
  RED: { bg: '#ffc9c9', stroke: '#e03131', text: '#5c1414' },
  YELLOW: { bg: '#ffec99', stroke: '#f08c00', text: '#4a2b00' },
  BLUE: { bg: '#a5d8ff', stroke: '#1971c2', text: '#0d3661' },
  WHITE: { bg: '#ffffff', stroke: '#495057', text: '#1e1e1e' },
  NEUTRAL: { bg: '#f8f9fa', stroke: '#495057', text: '#1e1e1e' },
};

const FONT = {
  HAND: 1, // Titles & Frame headers
  SANS: 2, // Readable descriptions & rules
  MONO: 3, // Tables, SQL schemas, comparison matrices & code
};

// Deterministic pseudo-random seed generator so repeated runs stay reproducible
let seedCounter = 1001;
let idCounter = 1;
const nextId = (prefix = 'el') => `${prefix}_${idCounter++}`;
const nextSeed = () => {
  seedCounter = (seedCounter * 1664525 + 1013904223) >>> 0;
  return seedCounter % 2147483647 || 1;
};

const elements = [];
const byId = new Map();

function charWidthFactor(fontFamily) {
  if (fontFamily === FONT.HAND) return 0.60;
  if (fontFamily === FONT.MONO) return 0.61;
  return 0.54;
}

function lineHeightPx(fontSize) {
  return Math.ceil(fontSize * 1.25);
}

function wrapText(text, maxWidthPx, fontSize, fontFamily) {
  const cWidth = fontSize * charWidthFactor(fontFamily);
  const maxChars = Math.max(8, Math.floor(maxWidthPx / cWidth));
  const rawLines = String(text).split('\n');
  const wrapped = [];

  for (const raw of rawLines) {
    if (raw.trim() === '') {
      wrapped.push('');
      continue;
    }
    // Preserve indentation if leading spaces are used (e.g. code/tables)
    const indentMatch = raw.match(/^(\s+)/);
    const indent = fontFamily === FONT.MONO && indentMatch ? indentMatch[1] : '';
    const words = raw.trimStart().split(/\s+/);
    let current = indent;

    for (const word of words) {
      if (current === indent) {
        if ((current + word).length <= maxChars) {
          current += word;
        } else {
          // Hard split oversized tokens
          let chunk = word;
          while (chunk.length > maxChars) {
            wrapped.push(current + chunk.slice(0, maxChars - current.length));
            chunk = chunk.slice(maxChars - current.length);
            current = indent;
          }
          current += chunk;
        }
      } else if ((current + ' ' + word).length <= maxChars) {
        current += ' ' + word;
      } else {
        wrapped.push(current);
        current = indent + word;
        if (current.length > maxChars) {
          let chunk = current;
          while (chunk.length > maxChars) {
            wrapped.push(chunk.slice(0, maxChars));
            chunk = indent + chunk.slice(maxChars);
          }
          current = chunk;
        }
      }
    }
    if (current.length > 0) wrapped.push(current);
  }

  const maxLineChars = wrapped.reduce((m, l) => Math.max(m, l.length), 1);
  const textWidth = Math.ceil(maxLineChars * cWidth);
  const textHeight = Math.ceil(wrapped.length * lineHeightPx(fontSize));
  return {
    text: wrapped.join('\n'),
    lines: wrapped,
    textWidth,
    textHeight,
  };
}

function measureBoxHeight({
  width,
  text,
  fontSize = 15,
  fontFamily = FONT.SANS,
  paddingX = 20,
  paddingY = 16,
  minHeight = 0,
}) {
  const usableW = Math.max(40, width - paddingX * 2);
  const { textHeight } = wrapText(text, usableW, fontSize, fontFamily);
  return Math.max(minHeight, textHeight + paddingY * 2);
}

function baseElement(overrides) {
  return {
    version: 1,
    versionNonce: nextSeed(),
    isDeleted: false,
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    angle: 0,
    strokeColor: '#495057',
    backgroundColor: 'transparent',
    seed: nextSeed(),
    groupIds: [],
    frameId: null,
    roundness: null,
    boundElements: [],
    updated: 1700000000000,
    link: null,
    locked: false,
    ...overrides,
  };
}

function register(el) {
  elements.push(el);
  byId.set(el.id, el);
  return el;
}

function addFrame(name, x, y, width, height = 1200) {
  const frame = baseElement({
    id: nextId('frame'),
    type: 'frame',
    x,
    y,
    width,
    height,
    name,
    strokeWidth: 2,
    strokeColor: '#868e96',
    backgroundColor: 'transparent',
    roughness: 0,
  });
  return register(frame);
}

function addLabel({
  frameId,
  x,
  y,
  width,
  text,
  fontFamily = FONT.HAND,
  fontSize = 24,
  color = '#1e1e1e',
  textAlign = 'left',
}) {
  const wrapped = wrapText(text, width, fontSize, fontFamily);
  const el = baseElement({
    id: nextId('lbl'),
    type: 'text',
    frameId,
    x,
    y,
    width: Math.min(width, Math.max(40, wrapped.textWidth)),
    height: wrapped.textHeight,
    text: wrapped.text,
    originalText: wrapped.text,
    fontSize,
    fontFamily,
    textAlign,
    verticalAlign: 'top',
    strokeColor: color,
    backgroundColor: 'transparent',
    containerId: null,
    lineHeight: 1.25,
    autoResize: true,
  });
  register(el);
  return { id: el.id, x: el.x, y: el.y, width: el.width, height: el.height, el };
}

function addBox({
  frameId,
  x,
  y,
  width,
  minHeight = 0,
  fixedHeight = null,
  text,
  palette = PALETTE.WHITE,
  fontFamily = FONT.SANS,
  fontSize = 15,
  textAlign = 'left',
  verticalAlign = 'middle',
  paddingX = 20,
  paddingY = 16,
  strokeStyle = 'solid',
  strokeWidth = 2,
  roughness = 1,
}) {
  const usableW = Math.max(40, width - paddingX * 2);
  const wrapped = wrapText(text, usableW, fontSize, fontFamily);
  const computedH = Math.max(minHeight, wrapped.textHeight + paddingY * 2);
  const height = fixedHeight !== null ? Math.max(fixedHeight, computedH) : computedH;

  const rectId = nextId('box');
  const textId = nextId('txt');

  const rect = baseElement({
    id: rectId,
    type: 'rectangle',
    frameId,
    x,
    y,
    width,
    height,
    strokeColor: palette.stroke,
    backgroundColor: palette.bg,
    strokeStyle,
    strokeWidth,
    roughness,
    roundness: { type: 3 },
    boundElements: [{ id: textId, type: 'text' }],
  });

  const textX =
    textAlign === 'center'
      ? x + Math.max(paddingX, Math.floor((width - wrapped.textWidth) / 2))
      : x + paddingX;
  const textY =
    verticalAlign === 'top'
      ? y + paddingY
      : y + Math.max(paddingY, Math.floor((height - wrapped.textHeight) / 2));

  const textEl = baseElement({
    id: textId,
    type: 'text',
    frameId,
    x: textX,
    y: textY,
    width: Math.min(usableW, Math.max(20, wrapped.textWidth)),
    height: wrapped.textHeight,
    text: wrapped.text,
    originalText: wrapped.text,
    fontSize,
    fontFamily,
    textAlign,
    verticalAlign,
    strokeColor: palette.text,
    backgroundColor: 'transparent',
    containerId: rectId,
    lineHeight: 1.25,
    autoResize: true,
  });

  register(rect);
  register(textEl);

  return { id: rectId, x, y, width, height, rect, textEl };
}

function addDiamond({
  frameId,
  x,
  y,
  width = 260,
  minHeight = 140,
  text,
  palette = PALETTE.YELLOW,
  fontFamily = FONT.SANS,
  fontSize = 14,
}) {
  // Inscribed diamond area fits ~50% of width safely
  const safeTextW = Math.max(80, Math.floor(width * 0.5) - 16);
  const wrapped = wrapText(text, safeTextW, fontSize, fontFamily);
  const finalW = Math.max(width, wrapped.textWidth * 2 + 56);
  const finalH = Math.max(minHeight, Math.ceil(wrapped.textHeight * 2.15) + 44);

  const diamondId = nextId('dia');
  const textId = nextId('txt');

  const diamond = baseElement({
    id: diamondId,
    type: 'diamond',
    frameId,
    x,
    y,
    width: finalW,
    height: finalH,
    strokeColor: palette.stroke,
    backgroundColor: palette.bg,
    strokeWidth: 2,
    roughness: 1,
    roundness: { type: 2 },
    boundElements: [{ id: textId, type: 'text' }],
  });

  const textEl = baseElement({
    id: textId,
    type: 'text',
    frameId,
    x: x + Math.floor((finalW - wrapped.textWidth) / 2),
    y: y + Math.floor((finalH - wrapped.textHeight) / 2),
    width: wrapped.textWidth,
    height: wrapped.textHeight,
    text: wrapped.text,
    originalText: wrapped.text,
    fontSize,
    fontFamily,
    textAlign: 'center',
    verticalAlign: 'middle',
    strokeColor: palette.text,
    backgroundColor: 'transparent',
    containerId: diamondId,
    lineHeight: 1.25,
    autoResize: true,
  });

  register(diamond);
  register(textEl);

  return { id: diamondId, x, y, width: finalW, height: finalH, rect: diamond, textEl };
}

function anchorPoint(shape, side, offsetRatio = 0.5) {
  const cx = shape.x + shape.width * offsetRatio;
  const cy = shape.y + shape.height * offsetRatio;
  switch (side) {
    case 'top':
      return [cx, shape.y - 6];
    case 'bottom':
      return [cx, shape.y + shape.height + 6];
    case 'left':
      return [shape.x - 6, cy];
    case 'right':
      return [shape.x + shape.width + 6, cy];
    default:
      return [cx, cy];
  }
}

function addArrow({
  frameId,
  from,
  to,
  fromSide = 'bottom',
  toSide = 'top',
  fromOffset = 0.5,
  toOffset = 0.5,
  viaOffsets = [], // optional intermediate world [wx, wy] waypoints
  label = '',
  color = '#1971c2',
  dashed = false,
  fontSize = 13,
}) {
  const [sx, sy] = anchorPoint(from, fromSide, fromOffset);
  const [ex, ey] = anchorPoint(to, toSide, toOffset);

  const worldPoints = [[sx, sy], ...viaOffsets, [ex, ey]];
  const relPoints = worldPoints.map(([px, py]) => [Math.round(px - sx), Math.round(py - sy)]);

  const xs = relPoints.map((p) => p[0]);
  const ys = relPoints.map((p) => p[1]);
  const width = Math.max(1, Math.max(...xs) - Math.min(...xs));
  const height = Math.max(1, Math.max(...ys) - Math.min(...ys));

  const arrowId = nextId('arr');
  const bound = [];
  let labelEl = null;

  if (label) {
    const labelId = nextId('albl');
    bound.push({ id: labelId, type: 'text' });
    const wrapped = wrapText(label, 190, fontSize, FONT.SANS);
    // Compute midpoint along the path
    const midIdx = Math.floor(worldPoints.length / 2);
    const pA = worldPoints[Math.max(0, midIdx - 1)];
    const pB = worldPoints[midIdx];
    const mx = (pA[0] + pB[0]) / 2;
    const my = (pA[1] + pB[1]) / 2;

    labelEl = baseElement({
      id: labelId,
      type: 'text',
      frameId,
      x: Math.round(mx - wrapped.textWidth / 2),
      y: Math.round(my - wrapped.textHeight / 2),
      width: wrapped.textWidth,
      height: wrapped.textHeight,
      text: wrapped.text,
      originalText: wrapped.text,
      fontSize,
      fontFamily: FONT.SANS,
      textAlign: 'center',
      verticalAlign: 'middle',
      strokeColor: color,
      backgroundColor: '#ffffff',
      containerId: arrowId,
      lineHeight: 1.25,
      autoResize: true,
    });
  }

  const arrow = baseElement({
    id: arrowId,
    type: 'arrow',
    frameId,
    x: Math.round(sx),
    y: Math.round(sy),
    width,
    height,
    strokeColor: color,
    backgroundColor: 'transparent',
    strokeWidth: 2,
    strokeStyle: dashed ? 'dashed' : 'solid',
    roughness: 1,
    roundness: { type: 2 },
    points: relPoints,
    lastCommittedPoint: null,
    startBinding: { elementId: from.id, focus: 0, gap: 6 },
    endBinding: { elementId: to.id, focus: 0, gap: 6 },
    startArrowhead: null,
    endArrowhead: 'arrow',
    boundElements: bound,
  });

  from.rect.boundElements.push({ id: arrowId, type: 'arrow' });
  to.rect.boundElements.push({ id: arrowId, type: 'arrow' });

  register(arrow);
  if (labelEl) register(labelEl);
  return arrow;
}

/** Place horizontal columns inside a frame with equal or natural heights and return max bottom y */
function layoutRow(frameId, startX, y, totalWidth, gap, specs) {
  const count = specs.length;
  const colW = Math.floor((totalWidth - gap * (count - 1)) / count);
  const heights = specs.map((s) =>
    measureBoxHeight({
      width: s.width ?? colW,
      text: s.text,
      fontSize: s.fontSize ?? 15,
      fontFamily: s.fontFamily ?? FONT.SANS,
      paddingX: s.paddingX ?? 20,
      paddingY: s.paddingY ?? 16,
      minHeight: s.minHeight ?? 0,
    })
  );
  const maxH = Math.max(...heights);
  const boxes = [];
  let cx = startX;
  for (let i = 0; i < count; i++) {
    const s = specs[i];
    const w = s.width ?? colW;
    const box = addBox({
      frameId,
      x: cx,
      y,
      width: w,
      fixedHeight: s.equalHeight !== false ? maxH : heights[i],
      text: s.text,
      palette: s.palette ?? PALETTE.WHITE,
      fontFamily: s.fontFamily ?? FONT.SANS,
      fontSize: s.fontSize ?? 15,
      textAlign: s.textAlign ?? 'left',
      verticalAlign: s.verticalAlign ?? (s.equalHeight !== false ? 'top' : 'middle'),
      paddingX: s.paddingX ?? 20,
      paddingY: s.paddingY ?? 16,
      strokeStyle: s.strokeStyle ?? 'solid',
    });
    boxes.push(box);
    cx += w + gap;
  }
  return { boxes, bottomY: y + maxH };
}

// ============================================================================
// FRAME LAYOUT CONSTANTS
// ============================================================================
const FRAME_GAP = 200;
const PAD = 48;
const TOP_PAD = 64;

const F0_W = 1600;
const F1_W = 2020;
const F2_W = 2020;
const F3_W = 2060;

const F0_X = 0;
const F1_X = F0_X + F0_W + FRAME_GAP;
const F2_X = F1_X + F1_W + FRAME_GAP;
const F3_X = F2_X + F2_W + FRAME_GAP;

// ============================================================================
// FRAME 0: OVERVIEW & SYSTEM ARCHITECTURE
// ============================================================================
const frame0 = addFrame('0. Overview & System Architecture', F0_X, 0, F0_W);
{
  const fId = frame0.id;
  const innerW = F0_W - PAD * 2;
  let y = TOP_PAD;

  // Title header
  const titleLbl = addLabel({
    frameId: fId,
    x: F0_X + PAD,
    y,
    width: innerW,
    text: "Let's Turn — Duo Word Ladder  |  System Architecture Overview",
    fontFamily: FONT.HAND,
    fontSize: 30,
    color: '#1971c2',
  });
  y += titleLbl.height + 10;

  const subLbl = addLabel({
    frameId: fId,
    x: F0_X + PAD,
    y,
    width: innerW,
    text: 'Mobile-first cooperative & competitive word-ladder PWA (4 & 5 letters, FR & EN) powered by Local-First state + Supabase Serverless BaaS.',
    fontFamily: FONT.SANS,
    fontSize: 16,
    color: '#495057',
  });
  y += subLbl.height + 28;

  // Row 1: "How to read this board" legend + Core Constraints side-by-side
  const legendW = 740;
  const constraintsW = innerW - legendW - 28;

  const legendTitle = addLabel({
    frameId: fId,
    x: F0_X + PAD,
    y,
    width: legendW,
    text: 'How to read this board — Color Legend',
    fontFamily: FONT.HAND,
    fontSize: 20,
    color: '#1e1e1e',
  });
  const constrTitle = addLabel({
    frameId: fId,
    x: F0_X + PAD + legendW + 28,
    y,
    width: constraintsW,
    text: 'Non-Functional Goals & Constraints',
    fontFamily: FONT.HAND,
    fontSize: 20,
    color: '#1e1e1e',
  });
  y += Math.max(legendTitle.height, constrTitle.height) + 12;

  // 5 legend pills stacked into 2 clean rows on the left, constraints box on the right
  const leg1 = layoutRow(fId, F0_X + PAD, y, legendW, 14, [
    {
      text: 'CHOSEN / PROS\nAccepted design, active architecture & advantages (#b2f2bb)',
      palette: PALETTE.GREEN,
      fontSize: 13,
      paddingX: 14,
      paddingY: 12,
    },
    {
      text: 'REJECTED / CONS\nDiscarded alternatives & trade-offs (#ffc9c9)',
      palette: PALETTE.RED,
      fontSize: 13,
      paddingX: 14,
      paddingY: 12,
    },
    {
      text: 'ALT / NOTE / DECISION\nBusiness rules, RLS notes & decision gates (#ffec99)',
      palette: PALETTE.YELLOW,
      fontSize: 13,
      paddingX: 14,
      paddingY: 12,
    },
  ]);

  const leg2 = layoutRow(fId, F0_X + PAD, leg1.bottomY + 14, legendW, 14, [
    {
      text: 'FLOW / REALTIME / INFO\nData flows, sync buses, Bot AI & progression (#a5d8ff)',
      palette: PALETTE.BLUE,
      fontSize: 13,
      paddingX: 14,
      paddingY: 12,
    },
    {
      text: 'CONTEXT / NEUTRAL\nCurrent stack modules, tables & specs (#f8f9fa / #ffffff)',
      palette: PALETTE.NEUTRAL,
      fontSize: 13,
      paddingX: 14,
      paddingY: 12,
    },
  ]);

  const legendTotalH = leg2.bottomY - y;
  addBox({
    frameId: fId,
    x: F0_X + PAD + legendW + 28,
    y,
    width: constraintsW,
    fixedHeight: legendTotalH,
    text:
      '• Zero-Friction Onboarding: No email/password signup; instant anonymous play & /join/<CODE> deep links\n' +
      '• Sub-16ms Keystroke UX: O(1) dictionary lookups (19,221 words) + optimistic local state\n' +
      '• Local-First + Cloud Sync: Offline/multi-tab fallback via localStorage + BroadcastChannel; auto-upgrades with VITE_SUPABASE_URL/ANON_KEY\n' +
      '• Zero Dedicated Server Ops: Static CDN + Supabase Free-Tier BaaS (no WebSocket server or cron jobs)',
    palette: PALETTE.NEUTRAL,
    fontFamily: FONT.SANS,
    fontSize: 14,
    verticalAlign: 'middle',
  });

  y = leg2.bottomY + 34;

  // Section 2: 4-column Tech Stack
  const stackLbl = addLabel({
    frameId: fId,
    x: F0_X + PAD,
    y,
    width: innerW,
    text: 'Production Tech Stack Overview',
    fontFamily: FONT.HAND,
    fontSize: 22,
  });
  y += stackLbl.height + 12;

  const stackRow = layoutRow(fId, F0_X + PAD, y, innerW, 20, [
    {
      text:
        'FRONTEND & PWA\n\n' +
        '• React 18.3.1 + TypeScript 5.6\n' +
        '• Vite 6.0.5 + Tailwind CSS v4\n' +
        '• lucide-react + Figma PNG assets\n' +
        '• Service Worker (public/sw.js)\n' +
        '• Cache: lets-turn-v1 (offline shell)\n' +
        '• CDN headers (public/_headers)',
      palette: PALETTE.WHITE,
      fontFamily: FONT.SANS,
      fontSize: 14,
    },
    {
      text:
        'CLIENT GAME ENGINE\n\n' +
        '• dictionaries.ts: 19,221 ASCII words\n' +
        '• wordLadder.ts: BFS & 260 curated pairs\n' +
        '• gamification.ts: XP, 6 badges, 5 themes\n' +
        '• victoryEffects.ts: Path2D WebWorker FX\n' +
        '• AppTour.tsx: SVG mask + 3D bubbles\n' +
        '• i18n: 297 matched FR / EN keys',
      palette: PALETTE.GREEN,
      fontFamily: FONT.SANS,
      fontSize: 14,
    },
    {
      text:
        'HYBRID SYNC & SUPABASE BAAS\n\n' +
        '• multiplayer.ts + supabaseClient.ts\n' +
        '• Supabase Anonymous Auth (auth.uid)\n' +
        '• PostgreSQL: profiles, rooms, moves\n' +
        '• 6 strict RLS policies (schema.sql)\n' +
        '• Realtime Broadcast + Postgres Changes\n' +
        '• 30s turn clock + fallback polling',
      palette: PALETTE.BLUE,
      fontFamily: FONT.SANS,
      fontSize: 14,
    },
    {
      text:
        'LEXICAL APIS & CACHING\n\n' +
        '• Tier 1 (0ms): LOCAL_MEANINGS maps\n' +
        '• Tier 2: memoryCache + localStorage\n' +
        '  (lets_turn_meaning_cache_v2, cap 300)\n' +
        '• Tier 3 EN: api.dictionaryapi.dev\n' +
        '• Tier 3 FR: fr.wiktionary.org REST v1\n' +
        '• AbortController + offline fallback',
      palette: PALETTE.NEUTRAL,
      fontFamily: FONT.SANS,
      fontSize: 14,
    },
  ]);
  y = stackRow.bottomY + 38;

  // Section 3: High-Level Architecture Diagram with bound arrows
  const flowLbl = addLabel({
    frameId: fId,
    x: F0_X + PAD,
    y,
    width: innerW,
    text: 'High-Level Request & State Architecture',
    fontFamily: FONT.HAND,
    fontSize: 22,
  });
  y += flowLbl.height + 16;

  // Top center: UI Layer -> Game Engine -> Sync Orchestrator -> Fan out to 4 targets
  const uiW = 330;
  const engW = 360;
  const orchW = 410;
  const topGap = Math.floor((innerW - uiW - engW - orchW) / 2);

  const uiH = measureBoxHeight({
    width: uiW,
    text: 'UI Screens (src/components/)\nOnboarding · Hub · GameBoard · Victory · Collection · AppTour',
    fontSize: 14,
  });
  const engH = measureBoxHeight({
    width: engW,
    text: 'Pure Word Engine (src/engine/)\nisOneLetterDiff O(L) · isValidWord O(1) · bfsPath < 22ms',
    fontSize: 14,
  });
  const orchH = measureBoxHeight({
    width: orchW,
    text: 'Orchestrator (App.tsx & multiplayer.ts)\nOptimistic State · resolveRoomParticipants · Miyu AI · 30s Timer',
    fontSize: 14,
  });
  const maxTopH = Math.max(uiH, engH, orchH);

  const uiBox = addBox({
    frameId: fId,
    x: F0_X + PAD,
    y,
    width: uiW,
    fixedHeight: maxTopH,
    text: 'UI Screens (src/components/)\nOnboarding · Hub · GameBoard · Victory · Collection · AppTour',
    palette: PALETTE.WHITE,
    fontFamily: FONT.SANS,
    fontSize: 14,
    textAlign: 'center',
  });

  const engineBox = addBox({
    frameId: fId,
    x: uiBox.x + uiBox.width + topGap,
    y,
    width: engW,
    fixedHeight: maxTopH,
    text: 'Pure Word Engine (src/engine/)\nisOneLetterDiff O(L) · isValidWord O(1) · bfsPath < 22ms',
    palette: PALETTE.GREEN,
    fontFamily: FONT.SANS,
    fontSize: 14,
    textAlign: 'center',
  });

  const orchBox = addBox({
    frameId: fId,
    x: engineBox.x + engineBox.width + topGap,
    y,
    width: orchW,
    fixedHeight: maxTopH,
    text: 'Orchestrator (App.tsx & multiplayer.ts)\nOptimistic State · resolveRoomParticipants · Miyu AI · 30s Timer',
    palette: PALETTE.BLUE,
    fontFamily: FONT.SANS,
    fontSize: 14,
    textAlign: 'center',
  });

  const targetsY = y + maxTopH + 112;

  const targetRow = layoutRow(fId, F0_X + PAD, targetsY, innerW, 24, [
    {
      text: 'Browser Local Storage & Tabs\nlocalStorage (profile, rooms, tour_v1)\nBroadcastChannel("lets_turn_realtime_v1")',
      palette: PALETTE.GREEN,
      fontFamily: FONT.MONO,
      fontSize: 13,
      textAlign: 'center',
    },
    {
      text: 'Supabase Realtime WebSocket\nChannel: "lets-turn-realtime-v1"\nBroadcast: room_update & typing_state',
      palette: PALETTE.BLUE,
      fontFamily: FONT.MONO,
      fontSize: 13,
      textAlign: 'center',
    },
    {
      text: 'Supabase Auth & PostgreSQL\nsignInAnonymously() -> auth.uid()\nTables: profiles · rooms · moves + RLS',
      palette: PALETTE.BLUE,
      fontFamily: FONT.MONO,
      fontSize: 13,
      textAlign: 'center',
    },
    {
      text: 'External Dictionary APIs\napi.dictionaryapi.dev (EN)\nfr.wiktionary.org/api/rest_v1 (FR)',
      palette: PALETTE.YELLOW,
      fontFamily: FONT.MONO,
      fontSize: 13,
      textAlign: 'center',
    },
  ]);

  addArrow({
    frameId: fId,
    from: uiBox,
    to: engineBox,
    fromSide: 'right',
    toSide: 'left',
    label: 'Keystroke',
    color: '#2f9e44',
  });
  addArrow({
    frameId: fId,
    from: engineBox,
    to: orchBox,
    fromSide: 'right',
    toSide: 'left',
    label: 'Valid Move',
    color: '#1971c2',
  });
  addArrow({
    frameId: fId,
    from: orchBox,
    to: targetRow.boxes[0],
    fromSide: 'bottom',
    toSide: 'top',
    fromOffset: 0.2,
    label: '< 1ms Sync',
    color: '#2f9e44',
  });
  addArrow({
    frameId: fId,
    from: orchBox,
    to: targetRow.boxes[1],
    fromSide: 'bottom',
    toSide: 'top',
    fromOffset: 0.45,
    label: '~50ms WS',
    color: '#1971c2',
  });
  addArrow({
    frameId: fId,
    from: orchBox,
    to: targetRow.boxes[2],
    fromSide: 'bottom',
    toSide: 'top',
    fromOffset: 0.7,
    label: 'Durable SQL',
    color: '#1971c2',
  });
  addArrow({
    frameId: fId,
    from: uiBox,
    to: targetRow.boxes[3],
    fromSide: 'bottom',
    toSide: 'top',
    fromOffset: 0.85,
    label: 'Async lookup',
    color: '#f08c00',
    dashed: true,
  });

  frame0.height = targetRow.bottomY + PAD;
}

// ============================================================================
// FRAME 1: DATABASE DESIGN & DATA MODELING
// ============================================================================
const frame1 = addFrame('1. Database Design & Data Modeling', F1_X, 0, F1_W);
{
  const fId = frame1.id;
  const innerW = F1_W - PAD * 2;
  let y = TOP_PAD;

  const titleLbl = addLabel({
    frameId: fId,
    x: F1_X + PAD,
    y,
    width: innerW,
    text: '1. Database & Data Modeling — Access Patterns, Trade-offs & Final ERD',
    fontFamily: FONT.HAND,
    fontSize: 30,
    color: '#1971c2',
  });
  y += titleLbl.height + 24;

  // Subsection A: Requirements / Critical Queries
  const reqLbl = addLabel({
    frameId: fId,
    x: F1_X + PAD,
    y,
    width: innerW,
    text: 'A. Critical Queries That Must Be Fast (Access Patterns)',
    fontFamily: FONT.HAND,
    fontSize: 22,
  });
  y += reqLbl.height + 12;

  const reqRow = layoutRow(fId, F1_X + PAD, y, innerW, 20, [
    {
      text:
        'Q1: Join Room by Code (claimRemoteRoomByCode)\n' +
        '• O(1) B-Tree PK lookup on rooms.code\n' +
        '• Atomic conditional claim:\n' +
        '  WHERE code=$1 AND partner_player_id IS NULL\n' +
        '• Prevents race conditions; returns status: "full"',
      palette: PALETTE.BLUE,
      fontFamily: FONT.SANS,
      fontSize: 13.5,
    },
    {
      text:
        'Q2: Load Player Hub (loadRemoteRooms)\n' +
        '• Filter host_player_id=uid OR partner_player_id=uid\n' +
        '  ORDER BY started_at DESC LIMIT 30 (idx_rooms_players)\n' +
        '• Single batch fetch moves WHERE room_code IN (...)\n' +
        '  ORDER BY step_number ASC (zero N+1 queries)',
      palette: PALETTE.BLUE,
      fontFamily: FONT.SANS,
      fontSize: 13.5,
    },
    {
      text:
        'Q3: Commit Move & Advance Turn (pushRemoteMove)\n' +
        '• Idempotent INSERT into moves (onConflict: id)\n' +
        '• Targeted UPDATE on rooms (current_word,\n' +
        '  current_turn_player_id, status, completed_at)\n' +
        '• Emits lightweight postgres_changes payload',
      palette: PALETTE.BLUE,
      fontFamily: FONT.SANS,
      fontSize: 13.5,
    },
    {
      text:
        'Q4: Profile & Cosmetics (fetch / upsertProfileRemote)\n' +
        '• Direct PK lookup on profiles.id = auth.uid()\n' +
        '• In-memory client Map profileCache avoids repeat\n' +
        '  network reads on every Realtime update',
      palette: PALETTE.BLUE,
      fontFamily: FONT.SANS,
      fontSize: 13.5,
    },
  ]);
  y = reqRow.bottomY + 34;

  // Subsection B: Comparison of Options (Columns with PROS & CONS blocks)
  const optLbl = addLabel({
    frameId: fId,
    x: F1_X + PAD,
    y,
    width: innerW,
    text: 'B. Architecture Options Comparison — Why Hybrid Normalized Relational Won',
    fontFamily: FONT.HAND,
    fontSize: 22,
  });
  y += optLbl.height + 12;

  const colGap = 20;
  const colW = Math.floor((innerW - colGap * 3) / 4);
  const options = [
    {
      title:
        'OPTION A (CHOSEN)\nHybrid Normalized Relational\n(profiles + denormalized rooms + append-only moves + jsonb)',
      headerPal: PALETTE.GREEN,
      pros:
        'PROS:\n' +
        '• Hub loads 30 cards fast via rooms.current_word & current_turn_player_id (no JOIN/GROUP BY on moves)\n' +
        '• Concurrent moves are safe: each move is an immutable row with RLS auth.uid() = player_id\n' +
        '• Undo supported cleanly without DELETE policy via undo_penalty_count + mapDbMoves() trimming\n' +
        '• jsonb fits bounded arrays (unlocked_badges, unlocked_themes, optimal_path)',
      cons:
        'CONS:\n' +
        '• A move writes twice (moves.upsert then rooms.update); mitigated via optimistic UI + Broadcast\n' +
        '• Particles & savedBestChains live in localStorage until optional SQL migration',
    },
    {
      title:
        'OPTION B (REJECTED)\nMonolithic Room Document\n(All moves[] stored in rooms jsonb)',
      headerPal: PALETTE.RED,
      pros:
        'PROS:\n' +
        '• Simplest schema (only profiles + rooms)\n' +
        '• Single UPDATE statement per move',
      cons:
        'CONS:\n' +
        '• High lost-update risk when move + undo or partner timeout interleave on same JSON array\n' +
        '• Impossible to enforce per-move RLS INSERT authorship\n' +
        '• Realtime WAL payload grows linearly with every step in the ladder',
    },
    {
      title:
        'OPTION C (REJECTED)\nStrict 3NF / EAV Schema\n(Join tables for badges/themes, no current_word on rooms)',
      headerPal: PALETTE.RED,
      pros:
        'PROS:\n' +
        '• Zero relational redundancy\n' +
        '• Easy SQL analytics across all individual badges or themes',
      cons:
        'CONS:\n' +
        '• Hub card loading requires MAX(step_number) aggregation or multi-table JOINs across PostgREST\n' +
        '• Doubles RLS policy complexity across 6+ child tables for a casual 2P game',
    },
    {
      title:
        'OPTION D (REJECTED)\nNoSQL Document DB\n(Firebase Firestore / RTDB)',
      headerPal: PALETTE.RED,
      pros:
        'PROS:\n' +
        '• Built-in offline SDK listeners & live document streams',
      cons:
        'CONS:\n' +
        '• No SQL foreign keys or CHECK constraints (language IN EN/FR, word_length IN 4/5)\n' +
        '• Read-heavy pricing risks on Hub refresh; Postgres RLS & atomic WHERE partner_player_id IS NULL are cleaner',
    },
  ];

  // Align headers, pros, and cons rows evenly across all 4 columns!
  const hdrRow = layoutRow(
    fId,
    F1_X + PAD,
    y,
    innerW,
    colGap,
    options.map((o) => ({
      width: colW,
      text: o.title,
      palette: o.headerPal,
      fontFamily: FONT.HAND,
      fontSize: 16,
      textAlign: 'center',
      verticalAlign: 'middle',
    }))
  );
  const prosRow = layoutRow(
    fId,
    F1_X + PAD,
    hdrRow.bottomY + 12,
    innerW,
    colGap,
    options.map((o) => ({
      width: colW,
      text: o.pros,
      palette: PALETTE.GREEN,
      fontFamily: FONT.SANS,
      fontSize: 13.5,
      verticalAlign: 'top',
    }))
  );
  const consRow = layoutRow(
    fId,
    F1_X + PAD,
    prosRow.bottomY + 12,
    innerW,
    colGap,
    options.map((o) => ({
      width: colW,
      text: o.cons,
      palette: PALETTE.RED,
      fontFamily: FONT.SANS,
      fontSize: 13.5,
      verticalAlign: 'top',
    }))
  );
  y = consRow.bottomY + 30;

  // Subsection C: Side-by-Side Comparison Matrix
  const tblLbl = addLabel({
    frameId: fId,
    x: F1_X + PAD,
    y,
    width: innerW,
    text: 'C. Side-by-Side Comparison Table (App Scale: ~10k–100k Active Duels)',
    fontFamily: FONT.HAND,
    fontSize: 22,
  });
  y += tblLbl.height + 10;

  const matrixText =
    'Criterion                  | Option A: Hybrid Relational [CHOSEN] | Option B: Monolithic JSONB   | Option C: Strict 3NF        | Option D: Firestore NoSQL\n' +
    '---------------------------+--------------------------------------+------------------------------+-----------------------------+---------------------------\n' +
    'Hub Read Speed (30 rooms)  | VERY FAST (1 rooms + 1 batch moves)  | VERY FAST (single rooms read)| SLOW (N JOINs / GROUP BY)   | MEDIUM (N doc reads)\n' +
    'Concurrent Write Safety    | HIGH (append-only moves + idempotent)| LOW (array overwrite risk)   | HIGH                        | MEDIUM (explicit tx)\n' +
    'Security / Per-Move RLS    | YES (auth.uid() = moves.player_id)   | NO (whole-row UPDATE only)   | YES (complex across tables) | JSON security rules\n' +
    'Realtime Payload Size      | SMALL (~500B room row + 1 move)      | GROWS per move               | MEDIUM                      | MEDIUM-LARGE\n' +
    'Maintenance & Schema Cost  | LOW (96-line supabase/schema.sql)    | VERY LOW                     | HIGH (migrations + joins)   | MEDIUM (no SQL checks)';

  const tblBox = addBox({
    frameId: fId,
    x: F1_X + PAD,
    y,
    width: innerW,
    text: matrixText,
    palette: PALETTE.NEUTRAL,
    fontFamily: FONT.MONO,
    fontSize: 14,
    paddingX: 22,
    paddingY: 16,
  });
  y = tblBox.y + tblBox.height + 34;

  // Subsection D: Relational ERD Diagram + RLS/Collision Rules
  const erdLbl = addLabel({
    frameId: fId,
    x: F1_X + PAD,
    y,
    width: innerW,
    text: 'D. Final Relational Schema (supabase/schema.sql), Indexes, RLS & Anti-Collision Rules',
    fontFamily: FONT.HAND,
    fontSize: 22,
  });
  y += erdLbl.height + 16;

  // Layout 3 SQL Tables left-to-right + auth.users anchor on far left (with >= 100px arrow label gutters)
  const erdGap = 110;
  const authTbl = addBox({
    frameId: fId,
    x: F1_X + PAD,
    y,
    width: 245,
    text:
      'auth.users (Supabase)\n' +
      '─────────────────────\n' +
      'PK id : uuid\n' +
      'Anonymous Auth JWT\n' +
      'signInAnonymously()',
    palette: PALETTE.NEUTRAL,
    fontFamily: FONT.MONO,
    fontSize: 13,
    verticalAlign: 'top',
    paddingX: 16,
  });

  const profilesTbl = addBox({
    frameId: fId,
    x: authTbl.x + authTbl.width + erdGap,
    y,
    width: 440,
    text:
      'public.profiles\n' +
      '─────────────────────────────────────────\n' +
      'PK id                 uuid -> auth.users(id)\n' +
      '   name               text NOT NULL\n' +
      '   avatar_id          smallint DEFAULT 1 (0..5)\n' +
      '   color              text DEFAULT "#58cc02"\n' +
      '   xp / stars / streak integer (App starts 5★)\n' +
      '   last_played_date   date\n' +
      '   unlocked_badges    jsonb DEFAULT "[]"\n' +
      '   unlocked_themes    jsonb DEFAULT ["classic"]\n' +
      '   active_theme       text DEFAULT "classic"\n' +
      '   push_subscription  jsonb',
    palette: PALETTE.GREEN,
    fontFamily: FONT.MONO,
    fontSize: 13,
    verticalAlign: 'top',
    paddingX: 16,
  });

  const roomsTbl = addBox({
    frameId: fId,
    x: profilesTbl.x + profilesTbl.width + erdGap,
    y,
    width: 485,
    text:
      'public.rooms\n' +
      '──────────────────────────────────────────────\n' +
      'PK code                   text (WORD-XXXX / Daily)\n' +
      '   language               text CHECK ("EN","FR")\n' +
      '   word_length            smallint CHECK (4, 5)\n' +
      '   mode                   text CHECK ("coop","duel","daily")\n' +
      '   start_word / target_word / current_word  text\n' +
      '   optimal_par / optimal_path  integer / jsonb\n' +
      'FK host_player_id         uuid -> profiles(id)\n' +
      'FK partner_player_id      uuid NULL -> profiles(id)\n' +
      '   current_turn_player_id uuid\n' +
      '   undo_penalty_count / hints_used  integer\n' +
      '   status / winner_player_id  ("active"|"completed")\n' +
      'IDX idx_rooms_players(host_player_id, partner_player_id)',
    palette: PALETTE.BLUE,
    fontFamily: FONT.MONO,
    fontSize: 13,
    verticalAlign: 'top',
    paddingX: 16,
  });

  const movesTbl = addBox({
    frameId: fId,
    x: roomsTbl.x + roomsTbl.width + erdGap,
    y,
    width: innerW - (roomsTbl.x - (F1_X + PAD) + roomsTbl.width + erdGap),
    text:
      'public.moves (append-only)\n' +
      '───────────────────────────────────────\n' +
      'PK id              uuid DEFAULT gen_random_uuid()\n' +
      'FK room_code       text -> rooms(code) CASCADE\n' +
      '   step_number     integer NOT NULL\n' +
      '   word            text NOT NULL\n' +
      '   previous_word   text NOT NULL\n' +
      '   changed_index   smallint NOT NULL\n' +
      '   from_char / to_char  char(1)\n' +
      'FK player_id       uuid -> profiles(id)\n' +
      '   is_undo_penalty boolean DEFAULT false\n' +
      '   created_at      timestamptz\n' +
      'IDX idx_moves_room_code_step(room_code, step_number)',
    palette: PALETTE.BLUE,
    fontFamily: FONT.MONO,
    fontSize: 13,
    verticalAlign: 'top',
    paddingX: 16,
  });

  addArrow({
    frameId: fId,
    from: authTbl,
    to: profilesTbl,
    fromSide: 'right',
    toSide: 'left',
    label: '1 : 1',
    color: '#2f9e44',
  });
  addArrow({
    frameId: fId,
    from: profilesTbl,
    to: roomsTbl,
    fromSide: 'right',
    toSide: 'left',
    label: '1 : N\nhosts/joins',
    color: '#1971c2',
  });
  addArrow({
    frameId: fId,
    from: roomsTbl,
    to: movesTbl,
    fromSide: 'right',
    toSide: 'left',
    label: '1 : N\nsteps',
    color: '#1971c2',
  });

  const erdBottom = Math.max(
    authTbl.y + authTbl.height,
    profilesTbl.y + profilesTbl.height,
    roomsTbl.y + roomsTbl.height,
    movesTbl.y + movesTbl.height
  );

  // Security & Code-Collision Note below ERD tables
  const noteY = erdBottom + 28;
  const noteRow = layoutRow(fId, F1_X + PAD, noteY, innerW, 20, [
    {
      text:
        'RLS & AUTH.UID() GUARDRAILS (schema.sql)\n' +
        '• profiles: SELECT for authenticated; ALL restricted to auth.uid() = id\n' +
        '• rooms: INSERT requires auth.uid() = host_player_id;\n' +
        '  UPDATE requires host, partner, OR partner_player_id IS NULL\n' +
        '• moves: INSERT requires auth.uid() = player_id (no DELETE policy)\n' +
        '• mapDbMoves() slices undone tail using rooms.current_word when undo_penalty_count > 0',
      palette: PALETTE.YELLOW,
      fontFamily: FONT.SANS,
      fontSize: 13.5,
    },
    {
      text:
        'SENTINEL IDS & ANTI-COLLISION CODES (supabaseClient.ts / multiplayer.ts)\n' +
        '• WAITING_PARTNER_ID ("0000...0000") & MIYU_BOT_ID ("bot-miyu-fixed")\n' +
        '  map to partner_player_id = NULL in SQL so FK -> profiles(id) never fails\n' +
        '• updateRemoteRoomState omits partner_player_id when NULL to protect live joins\n' +
        '• Room codes use 32-char unambiguous alphabet (32^4 = 1,048,576 per word)\n' +
        '• Daily format DYYMMDD-LLN-XXXX + strict .insert() catching Postgres 23505',
      palette: PALETTE.YELLOW,
      fontFamily: FONT.SANS,
      fontSize: 13.5,
    },
  ]);

  frame1.height = noteRow.bottomY + PAD;
}

// ============================================================================
// FRAME 2: SYNC & GAME ENGINE
// ============================================================================
const frame2 = addFrame('2. Real-Time Sync & Game Engine', F2_X, 0, F2_W);
{
  const fId = frame2.id;
  const innerW = F2_W - PAD * 2;
  let y = TOP_PAD;

  const titleLbl = addLabel({
    frameId: fId,
    x: F2_X + PAD,
    y,
    width: innerW,
    text: '2. Real-Time Sync & Word Ladder Game Engine',
    fontFamily: FONT.HAND,
    fontSize: 30,
    color: '#1971c2',
  });
  y += titleLbl.height + 24;

  // Subsection A: Current Engine & Lexical Stack
  const engLbl = addLabel({
    frameId: fId,
    x: F2_X + PAD,
    y,
    width: innerW,
    text: 'A. Client-Side Lexical Engine & Optimal BFS Pipeline (< 22ms worst case)',
    fontFamily: FONT.HAND,
    fontSize: 22,
  });
  y += engLbl.height + 12;

  const engRow = layoutRow(fId, F2_X + PAD, y, innerW, 20, [
    {
      text:
        '1. In-Memory Dictionaries (src/engine/dictionaries.ts)\n' +
        '• 19,221 normalized ASCII uppercase words across 5 Set<string> buckets:\n' +
        '  - EN_4_SET: 3,694 (EN_4_COMMON_SET core: 2,606 everyday words)\n' +
        '  - EN_5_SET: 7,622  |  FR_4_SET: 2,424  |  FR_5_SET: 5,481\n' +
        '• O(1) membership validation (isValidWord) + O(L) diff check (isOneLetterDiff)',
      palette: PALETTE.GREEN,
      fontFamily: FONT.SANS,
      fontSize: 14,
    },
    {
      text:
        '2. Implicit Graph BFS & Puzzle Generator (src/engine/wordLadder.ts)\n' +
        '• bfsPath(): head-pointer queue + parent Map; probes <= 25 * L edges/node\n' +
        '• Two-tier EN_4 pathfinding: tries EN_4_COMMON_SET first, falls back to EN_4_SET\n' +
        '• findShortestPathExcluding(): cycle avoidance skipping visited moves\n' +
        '• generateWordPair(): 260 verified CURATED_PAIRS (3..7 par) + 65% live BFS discovery (4..7 steps, >= 2 neighbors, Hamming >= 3)',
      palette: PALETTE.BLUE,
      fontFamily: FONT.SANS,
      fontSize: 14,
    },
    {
      text:
        '3. 3-Tier Live Word Definitions (src/services/wordMeaning.ts)\n' +
        '• Tier 1 (0ms sync): LOCAL_MEANINGS (FR) & LOCAL_MEANINGS_EN (EN)\n' +
        '• Tier 2 (Cache): memoryCache Map + localStorage cache (FIFO cap 300)\n' +
        '• Tier 3 (Async + AbortController): dictionaryapi.dev (EN) & fr.wiktionary.org REST v1 (FR)\n' +
        '• Graceful offline fallback message without blocking submission',
      palette: PALETTE.NEUTRAL,
      fontFamily: FONT.SANS,
      fontSize: 14,
    },
  ]);
  y = engRow.bottomY + 34;

  // Subsection B: Sync & Engine Alternatives (Columns with PROS / CONS)
  const syncOptLbl = addLabel({
    frameId: fId,
    x: F2_X + PAD,
    y,
    width: innerW,
    text: 'B. Sync & Compute Architecture Trade-offs',
    fontFamily: FONT.HAND,
    fontSize: 22,
  });
  y += syncOptLbl.height + 12;

  const colGap = 20;
  const colW = Math.floor((innerW - colGap * 3) / 4);
  const syncOptions = [
    {
      title:
        'OPTION A (CHOSEN)\nClient BFS + Tri-Channel Hybrid Sync\n(Local + Supabase Broadcast + Postgres)',
      headerPal: PALETTE.GREEN,
      pros:
        'PROS:\n' +
        '• < 1ms UI feedback on every keystroke; works seamlessly offline & across tabs\n' +
        '• ~30-80ms remote delivery via Realtime Broadcast before DB replication settles\n' +
        '• Zero DB writes for ephemeral typing_state\n' +
        '• Postgres Changes acts as durable backup sync',
      cons:
        'CONS:\n' +
        '• Client holds dictionary (~57 KB gzipped) and manages asymmetric 30s turn expiry\n' +
        '• Requires anti-flapping echo guards (lastLocalMutationRef 2.5s window)',
    },
    {
      title:
        'OPTION B (REJECTED)\nDedicated Authoritative Game Server\n(Node.js / Go + Stateful WebSockets)',
      headerPal: PALETTE.RED,
      pros:
        'PROS:\n' +
        '• Single server clock owns 30s timeout and word validation strictly',
      cons:
        'CONS:\n' +
        '• Requires 24/7 server hosting & connection state for slow asynchronous duels\n' +
        '• Breaks offline play & free-tier static deployment\n' +
        '• Cold starts drop WebSocket rooms',
    },
    {
      title:
        'OPTION C (REJECTED)\nEdge Functions / SQL RPC per Move\n(Serverless validation & BFS)',
      headerPal: PALETTE.RED,
      pros:
        'PROS:\n' +
        '• Dictionary stays server-side\n' +
        '• Lower client JS bundle size',
      cons:
        'CONS:\n' +
        '• 150-400ms RTT + Deno cold start breaks instant draftMeaning validation UX\n' +
        '• Burns Edge invocation quota on every tap; no offline play',
    },
    {
      title:
        'OPTION D (REJECTED)\nPostgres Changes Only / Polling\n(No Broadcast WebSocket Bus)',
      headerPal: PALETTE.RED,
      pros:
        'PROS:\n' +
        '• One propagation mechanism triggered solely after DB commits',
      cons:
        'CONS:\n' +
        '• 3-5x higher turn latency waiting on WAL commit & replication\n' +
        '• Cannot stream live isTyping without spamming PostgreSQL UPDATEs',
    },
  ];

  const sHdr = layoutRow(
    fId,
    F2_X + PAD,
    y,
    innerW,
    colGap,
    syncOptions.map((o) => ({
      width: colW,
      text: o.title,
      palette: o.headerPal,
      fontFamily: FONT.HAND,
      fontSize: 16,
      textAlign: 'center',
      verticalAlign: 'middle',
    }))
  );
  const sPros = layoutRow(
    fId,
    F2_X + PAD,
    sHdr.bottomY + 12,
    innerW,
    colGap,
    syncOptions.map((o) => ({
      width: colW,
      text: o.pros,
      palette: PALETTE.GREEN,
      fontFamily: FONT.SANS,
      fontSize: 13.5,
      verticalAlign: 'top',
    }))
  );
  const sCons = layoutRow(
    fId,
    F2_X + PAD,
    sPros.bottomY + 12,
    innerW,
    colGap,
    syncOptions.map((o) => ({
      width: colW,
      text: o.cons,
      palette: PALETTE.RED,
      fontFamily: FONT.SANS,
      fontSize: 13.5,
      verticalAlign: 'top',
    }))
  );
  y = sCons.bottomY + 26;

  // Side-by-side matrix
  const syncMatrixText =
    'Dimension                  | Option A: Tri-Channel Client [CHOSEN] | Option B: Stateful WS Server | Option C: Edge/RPC Compute | Option D: Postgres Changes Only\n' +
    '---------------------------+---------------------------------------+------------------------------+----------------------------+--------------------------------\n' +
    'Keystroke & Validation RTT | < 1 ms (Local O(1) Set)               | 40–120 ms                    | 150–400 ms                 | 150–500 ms\n' +
    'Typing Indicator Traffic   | Ephemeral Broadcast (0 DB writes)     | WS frame (0 DB writes)       | DB or WS required          | Unusable without DB spam\n' +
    'Offline / Multi-Tab Sync   | Full (localStorage + BroadcastChannel)| None                         | None                       | None\n' +
    'Infra Cost & Complexity    | Zero ops (Static CDN + Supabase)      | Stateful server + scaling    | Edge billing + cold starts | Low';

  const syncTbl = addBox({
    frameId: fId,
    x: F2_X + PAD,
    y,
    width: innerW,
    text: syncMatrixText,
    palette: PALETTE.NEUTRAL,
    fontFamily: FONT.MONO,
    fontSize: 14,
    paddingX: 22,
    paddingY: 16,
  });
  y = syncTbl.y + syncTbl.height + 34;

  // Subsection C: End-to-End Tri-Channel Sync & Timeout Arbitration Flow
  const pipeLbl = addLabel({
    frameId: fId,
    x: F2_X + PAD,
    y,
    width: innerW,
    text: 'C. Tri-Channel Turn Synchronization & Asymmetric 30s Timeout Arbitration',
    fontFamily: FONT.HAND,
    fontSize: 22,
  });
  y += pipeLbl.height + 16;

  const pStart = addBox({
    frameId: fId,
    x: F2_X + PAD,
    y,
    width: 300,
    text:
      '1. Player A Submits Move (handleSubmitMove)\n' +
      '• Updates roomsRef & localStorage optimistically\n' +
      '• Stamps lastLocalMutationRef[code] = now\n' +
      '• Checks reachedTarget (auto-triggers Victory at 380ms)',
    palette: PALETTE.GREEN,
    fontFamily: FONT.SANS,
    fontSize: 13.5,
  });

  // 3 parallel buses right of Step 1 (wide 125px gutters for crisp arrow labels)
  const busX = pStart.x + pStart.width + 125;
  const busW = 450;
  const bus1 = addBox({
    frameId: fId,
    x: busX,
    y,
    width: busW,
    text: 'Bus 1 (Local < 1ms): BroadcastChannel("lets_turn_realtime_v1") + storage event -> syncs sibling browser tabs instantly',
    palette: PALETTE.GREEN,
    fontFamily: FONT.SANS,
    fontSize: 13.5,
  });
  const bus2 = addBox({
    frameId: fId,
    x: busX,
    y: bus1.y + bus1.height + 16,
    width: busW,
    text: 'Bus 2 (Remote ~50ms): Supabase Realtime Broadcast ("lets-turn-realtime-v1") -> room_update, rematchFromCode, typing_state',
    palette: PALETTE.BLUE,
    fontFamily: FONT.SANS,
    fontSize: 13.5,
  });
  const bus3 = addBox({
    frameId: fId,
    x: busX,
    y: bus2.y + bus2.height + 16,
    width: busW,
    text: 'Bus 3 (Durable ~200ms): pushRemoteMove() -> moves.upsert + rooms.update -> Postgres Changes listener on rooms',
    palette: PALETTE.BLUE,
    fontFamily: FONT.SANS,
    fontSize: 13.5,
  });

  const guardX = busX + busW + 125;
  const guardW = 460;
  const guardBox = addBox({
    frameId: fId,
    x: guardX,
    y,
    width: guardW,
    text:
      '2. Receiver Consistency Guards (subscribeRealtimeSync)\n' +
      '• Stale Guard: Reject updates with fewer moves or completed -> active downgrade\n' +
      '• Anti-Flapping: Ignore redundant source==="postgres" echoes within 2,500ms of local edit\n' +
      '• Identity: resolveRoomParticipants() + isGenericFallbackName() preserve true names\n' +
      '• Clock Skew Elimination: Re-anchors turnStartedAt = Date.now() on local device',
    palette: PALETTE.YELLOW,
    fontFamily: FONT.SANS,
    fontSize: 13.5,
  });

  const timeoutBox = addBox({
    frameId: fId,
    x: guardX + guardW + 100,
    y,
    width: innerW - (guardX - (F2_X + PAD)) - guardW - 100,
    text:
      '3. Asymmetric 30s Timeout\n(passTurnIfExpired)\n' +
      '• Waiting player expires turn at 30.0s (graceMs = 0)\n' +
      '• Active player yields fallback at 31.5s (graceMs = 1500ms)\n' +
      '• Emits lastTurnPass toast & Web Push notification',
    palette: PALETTE.YELLOW,
    fontFamily: FONT.SANS,
    fontSize: 13.5,
  });

  addArrow({
    frameId: fId,
    from: pStart,
    to: bus1,
    fromSide: 'right',
    toSide: 'left',
    label: 'Same\nOrigin',
    color: '#2f9e44',
  });
  addArrow({
    frameId: fId,
    from: pStart,
    to: bus2,
    fromSide: 'right',
    toSide: 'left',
    label: 'Cross-\nDevice',
    color: '#1971c2',
  });
  addArrow({
    frameId: fId,
    from: pStart,
    to: bus3,
    fromSide: 'right',
    toSide: 'left',
    label: 'SQL\nCommit',
    color: '#1971c2',
  });
  addArrow({
    frameId: fId,
    from: bus2,
    to: guardBox,
    fromSide: 'right',
    toSide: 'left',
    label: 'source:\nbroadcast',
    color: '#1971c2',
  });
  addArrow({
    frameId: fId,
    from: bus3,
    to: guardBox,
    fromSide: 'right',
    toSide: 'left',
    label: 'source:\npostgres',
    color: '#f08c00',
  });
  addArrow({
    frameId: fId,
    from: guardBox,
    to: timeoutBox,
    fromSide: 'right',
    toSide: 'left',
    label: 'Clock\nTick',
    color: '#f08c00',
  });

  const pipeBottom = Math.max(
    pStart.y + pStart.height,
    bus3.y + bus3.height,
    guardBox.y + guardBox.height,
    timeoutBox.y + timeoutBox.height
  );

  frame2.height = pipeBottom + PAD;
}

// ============================================================================
// FRAME 3: ONBOARDING, BOT AI & GAMIFICATION
// ============================================================================
const frame3 = addFrame('3. Onboarding, Bot AI & Gamification', F3_X, 0, F3_W);
{
  const fId = frame3.id;
  const innerW = F3_W - PAD * 2;
  let y = TOP_PAD;

  const titleLbl = addLabel({
    frameId: fId,
    x: F3_X + PAD,
    y,
    width: innerW,
    text: '3. Auth, Onboarding, Miyu AI Bot & Gamification Rules',
    fontFamily: FONT.HAND,
    fontSize: 30,
    color: '#1971c2',
  });
  y += titleLbl.height + 24;

  // Dual Flowcharts Side by Side (Left: Auth/Onboarding/Join | Right: Miyu AI Decision Flow)
  const flowGap = 48;
  const leftFlowW = Math.floor((innerW - flowGap) / 2);
  const rightFlowX = F3_X + PAD + leftFlowW + flowGap;
  const rightFlowW = innerW - leftFlowW - flowGap;

  const f1Title = addLabel({
    frameId: fId,
    x: F3_X + PAD,
    y,
    width: leftFlowW,
    text: '3.1 Zero-Friction Auth, ID Migration & Deep-Link Join Flow',
    fontFamily: FONT.HAND,
    fontSize: 20,
  });
  const f2Title = addLabel({
    frameId: fId,
    x: rightFlowX,
    y,
    width: rightFlowW,
    text: '3.2 Miyu Bot Cognitive AI & 30s Timeout Flowchart',
    fontFamily: FONT.HAND,
    fontSize: 20,
  });
  y += Math.max(f1Title.height, f2Title.height) + 14;

  // --- LEFT FLOWCHART: Auth & Join ---
  const lfCenter = F3_X + PAD + Math.floor(leftFlowW / 2);
  let ly = y;

  const aStart = addBox({
    frameId: fId,
    x: lfCenter - 220,
    y: ly,
    width: 440,
    text: 'App Boot -> parsePendingJoinCode() extracts /join/CODE or ?join=CODE',
    palette: PALETTE.NEUTRAL,
    fontFamily: FONT.SANS,
    fontSize: 14,
    textAlign: 'center',
  });
  ly += aStart.height + 46;

  const aHasProf = addDiamond({
    frameId: fId,
    x: lfCenter - 150,
    y: ly,
    width: 300,
    text: 'Local profile in localStorage?',
    palette: PALETTE.YELLOW,
    fontSize: 14,
  });

  // No -> Onboarding on left branch; Yes -> Background bootstrap on right branch
  const branchY = ly + aHasProf.height + 48;
  const colBranchW = Math.floor((leftFlowW - 36) / 2);

  const aOnboard = addBox({
    frameId: fId,
    x: F3_X + PAD,
    y: branchY,
    width: colBranchW,
    text:
      'OnboardingScreen\n' +
      'Name + Avatar (0..5) + Color\n' +
      '-> ensureSupabaseSession()\n' +
      '-> createInitialProfile(stars: 5)\n' +
      '-> upsertProfileRemote()',
    palette: PALETTE.BLUE,
    fontFamily: FONT.SANS,
    fontSize: 13.5,
  });

  const aBootSync = addBox({
    frameId: fId,
    x: F3_X + PAD + colBranchW + 36,
    y: branchY,
    width: colBranchW,
    text:
      'bootstrapSupabaseState()\n' +
      '-> ensureSupabaseSession() -> uid\n' +
      '-> If uid != local ID:\n' +
      '   migrateLocalPlayerId() rewrites host, partner, turn & moves[]\n' +
      '-> loadRemoteRooms() & merge',
    palette: PALETTE.BLUE,
    fontFamily: FONT.SANS,
    fontSize: 13.5,
  });

  ly = branchY + Math.max(aOnboard.height, aBootSync.height) + 46;
  const aHasJoin = addDiamond({
    frameId: fId,
    x: lfCenter - 150,
    y: ly,
    width: 300,
    text: 'pendingJoinCode present?',
    palette: PALETTE.YELLOW,
    fontSize: 14,
  });

  const resY = ly + aHasJoin.height + 48;
  const aHub = addBox({
    frameId: fId,
    x: F3_X + PAD,
    y: resY,
    width: colBranchW,
    text:
      'Open HubScreen\n' +
      'Starter room WINE-42 ready\n' +
      '(auto-starts Hub AppTour once)',
    palette: PALETTE.GREEN,
    fontFamily: FONT.SANS,
    fontSize: 13.5,
    textAlign: 'center',
  });

  const aClaim = addBox({
    frameId: fId,
    x: F3_X + PAD + colBranchW + 36,
    y: resY,
    width: colBranchW,
    text:
      'claimRemoteRoomByCode()\n' +
      '• OK -> GameBoard / Victory\n' +
      '• 2 other players -> status: "full"\n' +
      '  (Hub + hub.roomFull alert)',
    palette: PALETTE.GREEN,
    fontFamily: FONT.SANS,
    fontSize: 13.5,
  });

  addArrow({ frameId: fId, from: aStart, to: aHasProf, fromSide: 'bottom', toSide: 'top', color: '#495057' });
  addArrow({ frameId: fId, from: aHasProf, to: aOnboard, fromSide: 'left', toSide: 'top', label: 'No', color: '#e03131' });
  addArrow({ frameId: fId, from: aHasProf, to: aBootSync, fromSide: 'right', toSide: 'top', label: 'Yes', color: '#2f9e44' });
  addArrow({ frameId: fId, from: aOnboard, to: aHasJoin, fromSide: 'bottom', toSide: 'left', color: '#1971c2' });
  addArrow({ frameId: fId, from: aBootSync, to: aHasJoin, fromSide: 'bottom', toSide: 'right', color: '#1971c2' });
  addArrow({ frameId: fId, from: aHasJoin, to: aHub, fromSide: 'left', toSide: 'top', label: 'No', color: '#2f9e44' });
  addArrow({ frameId: fId, from: aHasJoin, to: aClaim, fromSide: 'right', toSide: 'top', label: 'Yes', color: '#1971c2' });

  const leftBottomY = Math.max(aHub.y + aHub.height, aClaim.y + aClaim.height);

  // --- RIGHT FLOWCHART: Miyu Bot AI ---
  const rfCenter = rightFlowX + Math.floor(rightFlowW / 2);
  let ry = y;

  const bWait = addBox({
    frameId: fId,
    x: rfCenter - 250,
    y: ry,
    width: 500,
    text:
      'Partner Slot Activation (createNewRoom / WINE-42)\n' +
      'Custom room starts WAITING; after 20s -> Miyu Bot proposal (handleEnableBot)\n' +
      'Note: partner_player_id stays NULL in SQL so a human friend can hot-swap live!',
    palette: PALETTE.NEUTRAL,
    fontFamily: FONT.SANS,
    fontSize: 13.5,
    textAlign: 'center',
  });
  ry += bWait.height + 46;

  const bTurn = addBox({
    frameId: fId,
    x: rfCenter - 240,
    y: ry,
    width: 480,
    text:
      'Miyu Turn Planner (planBotTurnBehavior)\n' +
      'timeoutChance = base (26% 4L / 36% 5L) - 10% (<=1 step) + 8% (>=4 steps) + 12% (after timeout)\n' +
      'Clamped safely to [15%, 55%]',
    palette: PALETTE.BLUE,
    fontFamily: FONT.SANS,
    fontSize: 13.5,
    textAlign: 'center',
  });
  ry += bTurn.height + 46;

  const bTimeoutDia = addDiamond({
    frameId: fId,
    x: rfCenter - 150,
    y: ry,
    width: 300,
    text: 'rng() < timeoutChance ?',
    palette: PALETTE.YELLOW,
    fontSize: 14,
  });

  const bBranchY = ry + bTimeoutDia.height + 48;
  const rColW = Math.floor((rightFlowW - 36) / 2);

  const bExpire = addBox({
    frameId: fId,
    x: rightFlowX,
    y: bBranchY,
    width: rColW,
    text:
      'Human Hesitation -> Run Out of Time\n' +
      '• Schedules 3 typingPulses across 0..27.8s\n' +
      '• No move submitted before 30s\n' +
      '• checkExpiredTurns() -> passTurnIfExpired()\n' +
      '• Returns turn to Player + Timeout Toast',
    palette: PALETTE.RED,
    fontFamily: FONT.SANS,
    fontSize: 13.5,
  });

  const bSolve = addBox({
    frameId: fId,
    x: rightFlowX + rColW + 36,
    y: bBranchY,
    width: rColW,
    text:
      'Variable Human Solve Delay\n' +
      '• 58% Quick Play: 2.8s–8.5s (1 typing burst)\n' +
      '• 42% Hard Think: 11.5s–24.0s (2 bursts)\n' +
      '-> pickSmartPartnerMove():\n' +
      '  1. findShortestPathExcluding(visited)\n' +
      '  2. Fallback: findShortestPath() (backtrack)\n' +
      '  3. Fallback: min Hamming neighbor',
    palette: PALETTE.GREEN,
    fontFamily: FONT.SANS,
    fontSize: 13.5,
  });

  addArrow({ frameId: fId, from: bWait, to: bTurn, fromSide: 'bottom', toSide: 'top', label: 'Miyu turn & board open', color: '#1971c2' });
  addArrow({ frameId: fId, from: bTurn, to: bTimeoutDia, fromSide: 'bottom', toSide: 'top', color: '#1971c2' });
  addArrow({ frameId: fId, from: bTimeoutDia, to: bExpire, fromSide: 'left', toSide: 'top', label: 'Yes (15–55%)', color: '#e03131' });
  addArrow({ frameId: fId, from: bTimeoutDia, to: bSolve, fromSide: 'right', toSide: 'top', label: 'No (Solve)', color: '#2f9e44' });

  const rightBottomY = Math.max(bExpire.y + bExpire.height, bSolve.y + bSolve.height);
  y = Math.max(leftBottomY, rightBottomY) + 38;

  // Subsection 3.3: Business Rules Grid (Daily Challenge + Economy/Badges + Edge Cases)
  const rulesLbl = addLabel({
    frameId: fId,
    x: F3_X + PAD,
    y,
    width: innerW,
    text: '3.3 Core Business Rules: Deterministic Daily Challenge, Star Economy, App Tour & Edge Cases',
    fontFamily: FONT.HAND,
    fontSize: 22,
  });
  y += rulesLbl.height + 12;

  const rulesRow = layoutRow(fId, F3_X + PAD, y, innerW, 20, [
    {
      text:
        'DETERMINISTIC DAILY CHALLENGE & APP TOUR\n\n' +
        '• Seed: "daily-" + getTodayKey() (YYYY-MM-DD) + "-" + lang + "-" + length\n' +
        '• Hash & PRNG: FNV-1a (2166136261 / 16777619) -> Mulberry32 (seededRandom)\n' +
        '• Shared Puzzle, Private Room: Picks deterministically from 260 CURATED_PAIRS while assigning unique DYYMMDD-LLN-XXXX room codes\n' +
        '• Duolingo AppTour (AppTour.tsx + tour.ts): SVG <mask> cutout, pulsing --duo-blue halo, auto-flipping pointer caret, 4 Hub + 5 Board steps, freezes board & Miyu timers (tourPaused)',
      palette: PALETTE.BLUE,
      fontFamily: FONT.SANS,
      fontSize: 13.5,
    },
    {
      text:
        'STAR ECONOMY, COSMETICS & BADGES (gamification.ts / victoryEffects.ts)\n\n' +
        '• Initial Stars: 5★ | Hint cost: -1★ | Abandoned game (abandoned: true): 0★ & 0 XP, reveals optimalSolution\n' +
        '• Victory Stars: 3★ (<= optimalPar), 2★ (<= par + 2), 1★ (> par + 2) | actualSteps = moves.length + undoPenaltyCount\n' +
        '• XP & Levels: xpEarned = 40 + 20 * stars (100/80/60 XP); 150 XP per level across 6 titles\n' +
        '• 5 CSS Themes (classic 0★, oled 6★, nyt 8★, cyberpunk 10★, pastel 12★) via data-theme attribute\n' +
        '• 4 Particle FX (confetti 0★, sparkles 5★, hearts 8★, lightning 10★) via canvas-confetti Path2D 6-float affine matrix\n' +
        '• 6 Badges: surgeon (<=par), lightning (<=45s), inseparable (streak>=7), librarian (>=100 words), purist (>=5 no-hint wins), polyglot (5-letter win)',
      palette: PALETTE.GREEN,
      fontFamily: FONT.SANS,
      fontSize: 13.5,
    },
    {
      text:
        'CRITICAL EDGE CASES HANDLED IN CODE\n\n' +
        '• React 18 <StrictMode> Timer Reset Bug: Miyu effect deps strictly track primitives (no rooms / isTyping), and move commits run outside setRooms() updaters\n' +
        '• Rematch Collision Fix: handleRematch() generates a fresh room code and emits rematchFromCode via Broadcast to auto-switch both players\n' +
        '• Bot Hub Timer Pause: checkExpiredTurns skips bot rooms while user is on HubScreen; handleOpenRoom() resets turnStartedAt = Date.now()\n' +
        '• PostgREST Race Guard: pendingRoomCreates ensures rooms.insert completes before pushRemoteMove or updateRemoteRoomState fires\n' +
        '• Strict Language Guardrails: 297 matched FR & EN keys checked 1:1',
      palette: PALETTE.YELLOW,
      fontFamily: FONT.SANS,
      fontSize: 13.5,
    },
  ]);

  frame3.height = rulesRow.bottomY + PAD;
}

// ============================================================================
// AUTOMATED VALIDATION BEFORE WRITING FILE
// ============================================================================
const frames = elements.filter((e) => e.type === 'frame');
assert.equal(frames.length, 4, `Expected 4 frames, got ${frames.length}`);
for (let i = 0; i < frames.length; i++) {
  assert.equal(frames[i].y, 0, `Frame ${i} y must be 0`);
  if (i > 0) {
    const gap = frames[i].x - (frames[i - 1].x + frames[i - 1].width);
    assert.equal(gap, 200, `Gap between Frame ${i - 1} and Frame ${i} must be 200px, got ${gap}`);
  }
}

// Check every element with frameId fits inside its frame bounds
for (const el of elements) {
  if (!el.frameId || el.type === 'frame') continue;
  const f = byId.get(el.frameId);
  assert(f, `Missing frame ${el.frameId} for element ${el.id}`);
  if (el.type !== 'arrow') {
    assert(
      el.x >= f.x &&
        el.y >= f.y &&
        el.x + el.width <= f.x + f.width &&
        el.y + el.height <= f.y + f.height,
      `Element ${el.id} (${el.type}) out of frame ${f.name}: [${el.x},${el.y},${el.width},${el.height}] vs [${f.x},${f.y},${f.width},${f.height}]`
    );
  }
}

// Pairwise AABB overlap check across all shapes (rectangles + diamonds)
const shapes = elements.filter((e) => e.type === 'rectangle' || e.type === 'diamond');
for (let i = 0; i < shapes.length; i++) {
  for (let j = i + 1; j < shapes.length; j++) {
    const a = shapes[i];
    const b = shapes[j];
    const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
    const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
    assert(
      !(overlapX && overlapY),
      `Shape collision between ${a.id} (${a.x},${a.y},${a.width}x${a.height}) and ${b.id} (${b.x},${b.y},${b.width}x${b.height})`
    );
  }
}

// Verify bindings are reciprocal and no text or arrow labels overlap shapes
for (const el of elements) {
  if (el.type === 'text' && el.containerId) {
    const parent = byId.get(el.containerId);
    assert(parent, `Missing container ${el.containerId} for text ${el.id}`);
    assert(
      parent.boundElements.some((b) => b.id === el.id && b.type === 'text'),
      `Container ${parent.id} missing boundElement entry for text ${el.id}`
    );
    if (parent.type === 'arrow') {
      for (const s of shapes) {
        const overlaps =
          el.x < s.x + s.width &&
          el.x + el.width > s.x &&
          el.y < s.y + s.height &&
          el.y + el.height > s.y;
        assert(!overlaps, `Arrow label "${el.text}" (${el.id}) overlaps shape ${s.id}`);
      }
    }
  }
  if (el.type === 'arrow') {
    for (const side of ['startBinding', 'endBinding']) {
      if (el[side]?.elementId) {
        const target = byId.get(el[side].elementId);
        assert(target, `Missing ${side} target ${el[side].elementId} for arrow ${el.id}`);
        assert(
          target.boundElements.some((b) => b.id === el.id && b.type === 'arrow'),
          `Target ${target.id} missing boundElement entry for arrow ${el.id}`
        );
      }
    }
  }
}

const scene = {
  type: 'excalidraw',
  version: 2,
  source: 'https://excalidraw.com',
  elements,
  appState: {
    gridSize: null,
    viewBackgroundColor: '#ffffff',
  },
  files: {},
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(scene, null, 2) + '\n', 'utf8');

console.log(`Generated ${OUT_PATH}`);
console.log(
  `Frames: ${frames.length}, Total elements: ${elements.length}, Shapes checked (0 collisions): ${shapes.length}, Arrows: ${elements.filter((e) => e.type === 'arrow').length}`
);
for (const f of frames) {
  console.log(`  - ${f.name}: x=${f.x}, y=${f.y}, w=${f.width}, h=${f.height}`);
}
