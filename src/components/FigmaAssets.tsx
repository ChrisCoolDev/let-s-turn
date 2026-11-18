import React from 'react';
import type { AvatarId } from '../types/game';

interface FlameProps {
  className?: string;
  size?: number;
}

const FLAME_PATH =
  'M9.58091 0.0184988C9.76317 -0.0289175 9.98247 0.0170169 10.1129 0.131112C10.2596 0.258543 10.3292 0.4245 10.3218 0.621574C10.3203 0.658618 10.2922 0.811239 10.2596 0.962378C10.0773 1.78624 10.064 2.37153 10.2062 3.14056C10.3574 3.95256 10.6567 4.72901 11.1945 5.704C11.4672 6.19891 12.1858 7.3043 12.6763 7.98591C13.1016 8.57565 13.3609 8.95646 13.5713 9.30467C13.9091 9.86478 14.1462 10.3626 14.3136 10.8679C14.647 11.8696 14.7567 12.8031 14.6515 13.7351C14.6293 13.9322 14.57 14.2923 14.5359 14.4464C14.5018 14.596 14.3744 15.0391 14.327 15.1724C14.2336 15.4332 14.0188 15.9103 13.881 16.1578C12.8186 18.0737 10.8997 19.4517 8.70668 19.8711C8.234 19.963 7.83688 20 7.35828 20C4.93116 20.0015 2.57813 18.7568 1.21343 16.7505C0.805943 16.1519 0.481439 15.4599 0.293256 14.7872C0.242876 14.6049 0.148043 14.2108 0.122854 14.0685C0.0976637 13.9352 0.0635833 13.6714 0.0413569 13.4462C-0.120155 11.7748 0.198423 9.67215 0.874104 7.96368C1.22973 7.06129 1.5646 6.41525 2.05951 5.66992C2.20917 5.44469 2.23732 5.41061 2.30548 5.36764C2.52775 5.22836 2.83743 5.32023 2.93227 5.55583C2.94116 5.57657 2.96635 5.68029 2.98709 5.7855C3.03747 6.02406 3.04636 6.05814 3.11008 6.25966C3.19306 6.5249 3.3353 6.86274 3.40791 6.96794C3.67166 7.35023 4.14583 7.3858 4.43625 7.04499C4.52812 6.93831 4.5459 6.89237 4.65407 6.48193C4.74594 6.13223 4.91338 5.5662 4.99932 5.31134C5.14749 4.87125 5.42014 4.22669 5.64981 3.77031C5.73575 3.59991 5.98913 3.16279 6.12545 2.94793C6.32549 2.6338 6.69741 2.14334 6.92857 1.88848C7.03674 1.76994 7.42199 1.39061 7.5509 1.27651C8.02062 0.858655 8.62518 0.463026 9.28456 0.142966C9.41792 0.077769 9.52609 0.0318346 9.58091 0.0184988Z';

/** Exact SVG flame extracted from Figma node 2:12 (Group 5) */
export const FigmaFlameIcon: React.FC<FlameProps> = ({ className = '', size = 20 }) => {
  const width = Math.round((size * 14.69) / 20);
  return (
    <svg
      width={width}
      height={size}
      viewBox="0 0 14.69 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d={FLAME_PATH} fillRule="evenodd" clipRule="evenodd" fill="#FE9A03" />
      <circle cx="7.3508" cy="13.0832" r="3.85257" fill="#FFC70F" />
    </svg>
  );
};

interface BadgeIconProps {
  badgeId: string;
  size?: number;
  className?: string;
}

/** Icône de partage (trait, hérite de currentColor) */
export const ShareIcon: React.FC<{ className?: string; strokeWidth?: number }> = ({
  className = 'h-[18px] w-[18px]',
  strokeWidth = 1.75,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      d="m8.59 13.51 6.83 3.98m-.01-10.98-6.82 3.98M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0M9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0m12 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0"
    />
  </svg>
);

/** Illustrations SVG de badges dans le style vectoriel plat et chaleureux de FigmaFlameIcon */
export const FigmaBadgeIcon: React.FC<BadgeIconProps> = ({
  badgeId,
  size = 28,
  className = '',
}) => {
  switch (badgeId) {
    case 'inseparable':
      return <FigmaFlameIcon size={size} className={className} />;

    case 'surgeon':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <circle cx="11" cy="13" r="9.2" fill="#46A302" />
          <circle cx="11" cy="12" r="9.2" fill="#58CC02" />
          <path
            d="M5.2 8A7.2 7.2 0 0 1 11 4.8"
            stroke="#FFFFFF"
            strokeOpacity="0.4"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="11" cy="12" r="6.1" fill="#E9F9D8" />
          <circle cx="11" cy="12" r="3.8" fill="#58CC02" />
          <circle cx="11" cy="12" r="2.1" fill="#FE9A03" />
          <circle cx="11" cy="11.7" r="1.1" fill="#FFC70F" />
          {/* Flèche dorée plantée au centre */}
          <path
            d="M17.8 2.6C18.5 2 19.6 2 20.1 2.7L21.3 3.9C22 4.4 22 5.5 21.4 6.2L19 8.6L15.4 5L17.8 2.6Z"
            fill="#FE9A03"
          />
          <path
            d="M18.1 3.3C18.6 2.9 19.3 2.9 19.7 3.4L20.6 4.3C21.1 4.7 21.1 5.4 20.7 5.9L18.9 7.7L16.3 5.1L18.1 3.3Z"
            fill="#FFC70F"
          />
          <path d="M11.6 11.4L19 4" stroke="#FE9A03" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M11.8 11.2L18.8 4.2" stroke="#FFF4B8" strokeWidth="1" strokeLinecap="round" />
        </svg>
      );

    case 'lightning': {
      const boltPath =
        'M13.51 2.86L5.95 12.27Q5.2 13.2 6.4 13.2H10.5Q11.2 13.2 11.09 13.89L9.97 20.91Q9.8 22 10.49 21.14L18.05 11.73Q18.8 10.8 17.6 10.8H13.5Q12.8 10.8 12.91 10.11L14.03 3.09Q14.2 2 13.51 2.86Z';
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <g transform="translate(0 1)">
            <path d={boltPath} fill="#1899D6" />
          </g>
          <path d={boltPath} fill="#1CB0F6" />
          <g transform="translate(12 12) scale(0.68) translate(-12 -12)">
            <path d={boltPath} fill="#7CE4FF" />
          </g>
          <g transform="translate(12 12) scale(0.4) translate(-12 -12)">
            <path d={boltPath} fill="#FFC70F" />
          </g>
        </svg>
      );
    }

    case 'librarian':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <rect x="2" y="5.6" width="20" height="14.6" rx="3.2" fill="#A548E5" />
          <rect x="2" y="4.4" width="20" height="14.4" rx="3.2" fill="#CE82FF" />
          <path
            d="M4 6.5C4 6 4.5 5.6 5 5.7C7.5 6 10.3 6.8 11.6 8V17.2C10.1 16.3 7.4 15.8 4.9 15.6C4.4 15.6 4 15.2 4 14.7V6.5Z"
            fill="#FFF4D6"
          />
          <path
            d="M20 6.5C20 6 19.5 5.6 19 5.7C16.5 6 13.7 6.8 12.4 8V17.2C13.9 16.3 16.6 15.8 19.1 15.6C19.6 15.6 20 15.2 20 14.7V6.5Z"
            fill="#FFF4D6"
          />
          <rect x="11.4" y="7.7" width="1.2" height="9.6" rx="0.6" fill="#E9D5FF" />
          <path
            d="M15.2 15.4H17.8V21.1C17.8 21.5 17.3 21.7 17 21.4L16.5 20.9L16 21.4C15.7 21.7 15.2 21.5 15.2 21.1V15.4Z"
            fill="#FE9A03"
          />
          {/* Étoile dorée au cœur du grimoire */}
          <path
            d="M12 7.5L13.2 9.8L15.7 10.2L13.9 11.9L14.3 14.4L12 13.2L9.7 14.4L10.1 11.9L8.3 10.2L10.8 9.8L12 7.5Z"
            fill="#FE9A03"
          />
          <path
            d="M12 8.2L12.9 10L14.9 10.3L13.4 11.7L13.8 13.7L12 12.7L10.2 13.7L10.6 11.7L9.1 10.3L11.1 10L12 8.2Z"
            fill="#FFC70F"
          />
        </svg>
      );

    case 'purist': {
      const crownPath =
        'M4.4 15.6L2.8 8.7C2.5 7.3 3.9 6.3 5.1 7.2L7.8 9.4C8.4 9.9 9.2 9.7 9.6 9L10.9 5.5C11.4 4.2 12.6 4.2 13.1 5.5L14.4 9C14.8 9.7 15.6 9.9 16.2 9.4L18.9 7.2C20.1 6.3 21.5 7.3 21.2 8.7L19.6 15.6C19.4 16.3 18.8 16.8 18 16.8H6C5.2 16.8 4.6 16.3 4.4 15.6Z';
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          <path d={crownPath} fill="#FE9A03" />
          <g transform="translate(12 13.8) scale(0.74) translate(-12 -13.8)">
            <path d={crownPath} fill="#FFC70F" />
          </g>
          <rect x="4.4" y="17.5" width="15.2" height="2.7" rx="1.35" fill="#FE9A03" />
          <rect x="5.4" y="18.1" width="13.2" height="1.5" rx="0.75" fill="#FFC70F" />
        </svg>
      );
    }

    case 'polyglot':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
          aria-hidden="true"
        >
          {/* Ombre fiole */}
          <circle cx="12" cy="15.4" r="6.8" fill="#D33131" />
          <rect x="9.5" y="4.6" width="5" height="6" rx="1.4" fill="#D33131" />
          {/* Corps fiole rubis */}
          <circle cx="12" cy="14.5" r="6.7" fill="#FF4B4B" />
          <rect x="9.8" y="4.8" width="4.4" height="5.4" rx="1.2" fill="#FF4B4B" />
          <rect x="8.3" y="3.5" width="7.4" height="2.3" rx="1.15" fill="#D33131" />
          <rect x="8.3" y="3.2" width="7.4" height="2" rx="1" fill="#FF4B4B" />
          {/* Liquide magique */}
          <path
            d="M6.8 15C8.2 14.1 10.2 15.9 12 15C13.8 14.1 15.8 14.3 17.2 15A5.3 5.3 0 0 1 12 19.9A5.3 5.3 0 0 1 6.8 15Z"
            fill="#FE9A03"
          />
          <path
            d="M7.6 16.1C9 15.5 10.5 16.7 12 16.1C13.5 15.5 15.1 15.7 16.4 16.1A4.4 4.4 0 0 1 12 19.3A4.4 4.4 0 0 1 7.6 16.1Z"
            fill="#FFC70F"
          />
          {/* Bulles lumineuses */}
          <circle cx="10.2" cy="12.9" r="1.15" fill="#58CC02" />
          <circle cx="13.2" cy="11.2" r="0.95" fill="#58CC02" />
          <circle cx="12.1" cy="1.8" r="1.05" fill="#58CC02" />
          {/* Reflet verre blanc */}
          <path
            d="M7.8 12.1A4.8 4.8 0 0 1 10.2 10"
            stroke="#FFFFFF"
            strokeOpacity="0.65"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );

    default:
      return <FigmaFlameIcon size={size} className={className} />;
  }
};

interface AvatarProps {
  avatarId: AvatarId;
  size?: number;
  ringColor?: string;
  /** Couleur du liseré séparant la photo de l'anneau extérieur */
  ringGapColor?: string;
  onlineDot?: boolean;
  className?: string;
}

export const AVATAR_LABELS: Record<AvatarId, string> = {
  0: 'Léo',
  1: 'Néo',
  2: 'Mia',
  3: 'Nana',
  4: 'Kylian',
  5: 'Carole',
};

const AVATAR_ACCENTS: Record<AvatarId, string> = {
  0: '#38bdf8',
  1: '#1cb0f6',
  2: '#a855f7',
  3: '#f59e0b',
  4: '#fb7185',
  5: '#ff4b8b',
};

export const FigmaAvatar: React.FC<AvatarProps> = ({
  avatarId,
  size = 44,
  ringColor,
  ringGapColor = 'var(--bg-surface)',
  onlineDot = false,
  className = '',
}) => {
  const tint = ringColor ?? AVATAR_ACCENTS[avatarId];
  const gap = size >= 48 ? 2 : 1.5;
  const ring = size >= 48 ? 2.5 : 2;
  const dotSize = Math.max(10, Math.round(size * 0.27));

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: ringColor
          ? `0 0 0 ${gap}px ${ringGapColor}, 0 0 0 ${gap + ring}px ${ringColor}`
          : undefined,
      }}
    >
      <div
        className="h-full w-full overflow-hidden rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 26%, color-mix(in srgb, ${tint} 11%, var(--bg-surface)) 0%, color-mix(in srgb, ${tint} 26%, var(--bg-muted)) 100%)`,
          boxShadow:
            'inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 10%, transparent)',
        }}
      >
        <img
          src={`/avatars/avatar-${avatarId}.png`}
          alt={AVATAR_LABELS[avatarId]}
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>
      {onlineDot && (
        <span
          className="absolute -bottom-0.5 -right-0.5 block rounded-full border-2"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: 'var(--duo-green)',
            borderColor: ringGapColor,
          }}
          title="En ligne"
        />
      )}
    </div>
  );
};
