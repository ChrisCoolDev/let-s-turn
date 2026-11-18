import React from 'react';

type TileVariant = 'current' | 'target' | 'mystery';
type TileSize = 'sm' | 'lg';

interface WordTilesProps {
  word: string;
  /** Mot cible : les lettres bien placées du mot courant sont teintées en vert */
  target?: string;
  variant?: TileVariant;
  size?: TileSize;
  className?: string;
}

// Les dimensions s'adaptent à la longueur du mot pour tenir sur un écran de 375 px
const SIZE_CLASSES: Record<TileSize, Record<'short' | 'long', string>> = {
  sm: {
    short: 'h-9 w-[31px] rounded-lg text-[15px]',
    long: 'h-8 w-[26px] rounded-md text-sm',
  },
  lg: {
    short: 'h-12 w-11 rounded-xl text-xl',
    long: 'h-11 w-10 rounded-xl text-lg',
  },
};

const MATCH_BG = 'color-mix(in srgb, var(--duo-green) 14%, var(--bg-tile))';

export const WordTiles: React.FC<WordTilesProps> = ({
  word,
  target,
  variant = 'current',
  size = 'sm',
  className = '',
}) => {
  const sizeClass = SIZE_CLASSES[size][word.length > 4 ? 'long' : 'short'];
  const gap = size === 'lg' ? 'gap-1.5' : word.length > 4 ? 'gap-0.5' : 'gap-1';

  return (
    <div className={`flex ${gap} ${className}`}>
      {word.split('').map((char, i) => {
        let style: React.CSSProperties;
        if (variant === 'target') {
          style = {
            backgroundColor: 'var(--duo-green)',
            borderColor: 'var(--duo-green-shadow)',
            color: '#ffffff',
          };
        } else if (variant === 'mystery') {
          style = {
            backgroundColor: 'var(--bg-muted)',
            borderColor: 'var(--border-tile)',
            color: 'var(--text-muted)',
          };
        } else if (target && target[i] === char) {
          style = {
            backgroundColor: MATCH_BG,
            borderColor: 'var(--duo-green)',
            color: 'var(--duo-green-shadow)',
          };
        } else {
          style = {
            backgroundColor: 'var(--bg-tile)',
            borderColor: 'var(--border-tile)',
            color: 'var(--text-tile)',
          };
        }

        return (
          <span
            key={i}
            className={`flex shrink-0 items-center justify-center border-2 border-b-[3px] font-black leading-none ${sizeClass}`}
            style={style}
          >
            {variant === 'mystery' ? '?' : char}
          </span>
        );
      })}
    </div>
  );
};
