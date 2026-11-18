import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { AVATAR_LABELS, FigmaAvatar, FigmaFlameIcon } from './FigmaAssets';
import { PLAYER_COLORS } from '../engine/gamification';
import type { AvatarId } from '../types/game';
import { PwaInstallBanner } from './PwaInstallBanner';

interface OnboardingScreenProps {
  pendingJoinCode: string | null;
  onComplete: (name: string, avatarId: AvatarId, color: string) => void;
}

const AVATAR_IDS: AvatarId[] = [0, 1, 2, 3, 4, 5];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  pendingJoinCode,
  onComplete,
}) => {
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState<AvatarId>(1);
  const [color, setColor] = useState<string>(PLAYER_COLORS[0].hex);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Entre ton prénom ou surnom pour commencer !');
      return;
    }
    onComplete(trimmed, avatarId, color);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-between px-4 py-6">
      <div>
        {/* En-tête de marque */}
        <div className="flex items-center justify-between">
          <div
            className="inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-tile)',
            }}
          >
            <FigmaFlameIcon size={18} />
            <span
              className="text-sm font-black tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Let&apos;s Turn
            </span>
          </div>
          {pendingJoinCode && (
            <span
              className="rounded-full px-3 py-1 text-xs font-extrabold"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--duo-green) 15%, transparent)',
                color: 'var(--duo-green-shadow)',
              }}
            >
              Salon {pendingJoinCode}
            </span>
          )}
        </div>

        {/* Aperçu en direct du profil */}
        <div className="mt-5 flex flex-col items-center text-center">
          <FigmaAvatar
            avatarId={avatarId}
            size={76}
            ringColor={color}
            ringGapColor="var(--bg-app)"
          />
          <h1
            className="mt-3.5 text-2xl font-black tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {pendingJoinCode
              ? `Rejoins le salon ${pendingJoinCode}`
              : name.trim() || 'Crée ton profil'}
          </h1>
          <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
            {AVATAR_LABELS[avatarId]} · Zéro inscription
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Prénom */}
          <div>
            <label
              htmlFor="player-name"
              className="mb-1.5 block text-xs font-black uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Prénom ou surnom
            </label>
            <input
              id="player-name"
              type="text"
              maxLength={18}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Ex : Alex, Chris..."
              className="w-full rounded-2xl border-2 px-4 py-3 text-base font-extrabold outline-none transition"
              style={{
                backgroundColor: 'var(--bg-muted)',
                borderColor: error ? 'var(--duo-red)' : 'var(--border-tile)',
                color: 'var(--text-primary)',
              }}
              autoFocus
            />
            {error && (
              <p className="mt-1.5 text-[13px] font-extrabold" style={{ color: 'var(--duo-red)' }}>
                {error}
              </p>
            )}
          </div>

          {/* Galerie des 6 avatars */}
          <div>
            <span
              className="mb-2 block text-xs font-black uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Avatar
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              {AVATAR_IDS.map((id) => {
                const selected = avatarId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAvatarId(id)}
                    aria-pressed={selected}
                    className="relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-3 transition active:translate-y-0.5"
                    style={{
                      backgroundColor: selected
                        ? `color-mix(in srgb, ${color} 10%, var(--bg-surface))`
                        : 'var(--bg-surface)',
                      borderColor: selected ? color : 'var(--border-tile)',
                      borderBottomWidth: selected ? 5 : 4,
                    }}
                  >
                    {selected && (
                      <span
                        className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: color }}
                      >
                        <Check className="h-2.5 w-2.5 stroke-[3.5]" />
                      </span>
                    )}
                    <FigmaAvatar
                      avatarId={id}
                      size={52}
                      ringColor={selected ? color : undefined}
                      ringGapColor={
                        selected
                          ? `color-mix(in srgb, ${color} 10%, var(--bg-surface))`
                          : undefined
                      }
                    />
                    <span
                      className="text-xs font-black"
                      style={{ color: selected ? 'var(--text-primary)' : 'var(--text-muted)' }}
                    >
                      {AVATAR_LABELS[id]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Couleur de joueur */}
          <div>
            <span
              className="mb-2.5 block text-xs font-black uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Couleur
            </span>
            <div className="flex items-center justify-between gap-2 px-0.5">
              {PLAYER_COLORS.map((c) => {
                const active = color === c.hex;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    title={c.name}
                    aria-label={c.name}
                    aria-pressed={active}
                    className="flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95"
                    style={{
                      backgroundColor: c.hex,
                      boxShadow: active
                        ? `0 0 0 2.5px var(--bg-app), 0 0 0 5px ${c.hex}`
                        : 'inset 0 0 0 1px rgba(0, 0, 0, 0.08)',
                    }}
                  >
                    {active && (
                      <Check
                        className={`h-4 w-4 stroke-[3.5] ${
                          c.id === 'gold' ? 'text-[#5c3d00]' : 'text-white'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="duo-btn duo-btn-green flex w-full items-center justify-center py-4 text-base"
          >
            {pendingJoinCode ? `Rejoindre ${pendingJoinCode}` : "C'est parti !"}
          </button>
        </form>
      </div>

      <PwaInstallBanner />
    </div>
  );
};
