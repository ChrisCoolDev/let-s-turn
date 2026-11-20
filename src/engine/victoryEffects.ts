import confetti from 'canvas-confetti';
import type { ParticleEffectId } from '../types/game';

const SPARKLE_PATH = 'M12 1L14.8 9.2L23 12L14.8 14.8L12 23L9.2 14.8L1 12L9.2 9.2Z';
const HEART_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
const BOLT_PATH = 'M13 2L4 14h7l-1 8 9-12h-7l1-8z';

function createVectorShape(
  path: string,
  viewBoxCenterX: number,
  viewBoxCenterY: number,
  maxDim: number,
  fallback: 'star' | 'circle'
): confetti.Shape {
  if (typeof Path2D !== 'function' || typeof DOMMatrix !== 'function') {
    return fallback;
  }
  try {
    const scale = 10 / maxDim;
    const matrix = [scale, 0, 0, scale, -viewBoxCenterX * scale, -viewBoxCenterY * scale];
    return confetti.shapeFromPath({
      path,
      // canvas-confetti v1.9.3 checks Array.isArray(shape.matrix) at runtime and clones it to its worker
      matrix: matrix as unknown as DOMMatrix,
    });
  } catch {
    return fallback;
  }
}

let cachedSparkleShape: confetti.Shape | null = null;
let cachedHeartShape: confetti.Shape | null = null;
let cachedBoltShape: confetti.Shape | null = null;

function getSparkleShape(): confetti.Shape {
  if (!cachedSparkleShape) {
    cachedSparkleShape = createVectorShape(SPARKLE_PATH, 12, 12, 22, 'star');
  }
  return cachedSparkleShape;
}

function getHeartShape(): confetti.Shape {
  if (!cachedHeartShape) {
    cachedHeartShape = createVectorShape(HEART_PATH, 12, 12.2, 20, 'circle');
  }
  return cachedHeartShape;
}

function getBoltShape(): confetti.Shape {
  if (!cachedBoltShape) {
    cachedBoltShape = createVectorShape(BOLT_PATH, 11.5, 12, 20, 'star');
  }
  return cachedBoltShape;
}

/** Fires the equipped victory celebration animation (or a lighter preview in the Wardrobe). */
export function fireVictoryEffect(
  effect: ParticleEffectId,
  options?: { preview?: boolean }
): () => void {
  const preview = Boolean(options?.preview);
  const timers: number[] = [];

  const later = (delayMs: number, fn: () => void) => {
    const id = window.setTimeout(fn, delayMs);
    timers.push(id);
  };

  if (effect === 'sparkles') {
    const colors = ['#ffc800', '#ffe066', '#ff9600', '#fff3b0', '#ffaa00'];
    const sparkle = getSparkleShape();
    const fireStarburst = (origin: confetti.Origin, count: number, startVelocity: number) => {
      confetti({
        particleCount: count,
        spread: 360,
        startVelocity,
        decay: 0.92,
        gravity: 0.35,
        ticks: 110,
        scalar: 1.4,
        flat: true,
        shapes: ['star', sparkle],
        colors,
        origin,
      });
      confetti({
        particleCount: Math.max(8, Math.round(count * 0.45)),
        spread: 360,
        startVelocity: startVelocity * 0.72,
        decay: 0.92,
        gravity: 0.3,
        ticks: 95,
        scalar: 0.55,
        shapes: ['circle'],
        colors,
        origin,
      });
    };

    if (preview) {
      fireStarburst({ x: 0.5, y: 0.55 }, 28, 24);
    } else {
      fireStarburst({ x: 0.5, y: 0.48 }, 36, 28);
      later(240, () => fireStarburst({ x: 0.25, y: 0.42 }, 26, 24));
      later(460, () => fireStarburst({ x: 0.75, y: 0.42 }, 26, 24));
    }
  } else if (effect === 'hearts') {
    const colors = ['#ff4b8b', '#ff2d6f', '#ff85b3', '#ff5c8a', '#ffa6c9'];
    const heart = getHeartShape();

    if (preview) {
      confetti({
        particleCount: 28,
        spread: 75,
        startVelocity: 30,
        gravity: 0.55,
        ticks: 210,
        scalar: 1.9,
        flat: true,
        shapes: [heart],
        colors,
        origin: { x: 0.5, y: 0.62 },
      });
    } else {
      confetti({
        particleCount: 38,
        spread: 80,
        startVelocity: 32,
        gravity: 0.55,
        ticks: 210,
        scalar: 1.9,
        flat: true,
        shapes: [heart],
        colors,
        origin: { x: 0.5, y: 0.58 },
      });
      [
        { delay: 200, x: 0.25 },
        { delay: 400, x: 0.5 },
        { delay: 600, x: 0.75 },
      ].forEach(({ delay, x }) => {
        later(delay, () => {
          confetti({
            particleCount: 16,
            angle: 270,
            spread: 75,
            startVelocity: 12,
            gravity: 0.48,
            ticks: 210,
            scalar: 1.9,
            flat: true,
            shapes: [heart],
            colors,
            origin: { x, y: 0.02 },
          });
        });
      });
    }
  } else if (effect === 'lightning') {
    const colors = ['#1cb0f6', '#ffc800', '#00f5d4', '#38bdf8', '#fde047'];
    const bolt = getBoltShape();

    if (preview) {
      confetti({
        particleCount: 26,
        spread: 80,
        startVelocity: 44,
        decay: 0.91,
        gravity: 1.15,
        ticks: 130,
        scalar: 1.95,
        flat: true,
        shapes: [bolt],
        colors,
        origin: { x: 0.5, y: 0.55 },
      });
    } else {
      confetti({
        particleCount: 34,
        angle: 270,
        spread: 65,
        startVelocity: 52,
        decay: 0.91,
        gravity: 1.15,
        ticks: 130,
        scalar: 1.95,
        flat: true,
        shapes: [bolt],
        colors,
        origin: { x: 0.5, y: 0.1 },
      });
      later(170, () => {
        confetti({
          particleCount: 24,
          angle: 320,
          spread: 55,
          startVelocity: 48,
          decay: 0.91,
          gravity: 1.15,
          ticks: 130,
          scalar: 1.95,
          flat: true,
          shapes: [bolt],
          colors,
          origin: { x: 0.12, y: 0.2 },
        });
      });
      later(340, () => {
        confetti({
          particleCount: 24,
          angle: 220,
          spread: 55,
          startVelocity: 48,
          decay: 0.91,
          gravity: 1.15,
          ticks: 130,
          scalar: 1.95,
          flat: true,
          shapes: [bolt],
          colors,
          origin: { x: 0.88, y: 0.2 },
        });
      });
    }
  } else {
    const colors = ['#58cc02', '#1cb0f6', '#ffc800', '#ff9600', '#ce82ff'];
    if (preview) {
      confetti({
        particleCount: 45,
        spread: 65,
        shapes: ['square', 'circle'],
        colors,
        origin: { y: 0.6 },
      });
    } else {
      confetti({
        particleCount: 85,
        spread: 75,
        shapes: ['square', 'circle'],
        colors,
        origin: { y: 0.55 },
      });
      later(320, () => {
        confetti({
          particleCount: 45,
          angle: 60,
          spread: 55,
          shapes: ['square', 'circle'],
          colors,
          origin: { x: 0.1, y: 0.6 },
        });
        confetti({
          particleCount: 45,
          angle: 120,
          spread: 55,
          shapes: ['square', 'circle'],
          colors,
          origin: { x: 0.9, y: 0.6 },
        });
      });
    }
  }

  return () => {
    timers.forEach((id) => window.clearTimeout(id));
  };
}
