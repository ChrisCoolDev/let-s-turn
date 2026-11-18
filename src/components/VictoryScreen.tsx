import React, { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { ArrowRight, Award, Star } from 'lucide-react';
import { BADGE_DEFINITIONS, getLevelInfo } from '../engine/gamification';
import { FigmaAvatar, FigmaBadgeIcon, FigmaFlameIcon } from './FigmaAssets';
import { WordTiles } from './WordTiles';
import type { GameRoom, PlayerProfile } from '../types/game';

interface VictoryScreenProps {
  room: GameRoom;
  profile: PlayerProfile;
  newlyUnlockedBadgeIds: string[];
  earnedXp: number;
  earnedStars: number;
  onRematch: (roomCode: string) => void;
  onBackToHub: () => void;
}

export const VictoryScreen: React.FC<VictoryScreenProps> = ({
  room,
  profile,
  newlyUnlockedBadgeIds,
  earnedXp,
  earnedStars,
  onRematch,
  onBackToHub,
}) => {
  const [xpBarAnimated, setXpBarAnimated] = useState(false);

  const actualSteps = room.moves.length + room.undoPenaltyCount;
  const isOptimal = actualSteps <= room.optimalPar;
  const starRating = isOptimal ? 3 : actualSteps <= room.optimalPar + 2 ? 2 : 1;

  const isHost =
    room.hostPlayer.playerId === profile.playerId ||
    (room.partnerPlayer.playerId !== profile.playerId &&
      room.hostPlayer.name === profile.name &&
      room.partnerPlayer.name !== profile.name);
  const partner = isHost ? room.partnerPlayer : room.hostPlayer;
  const levelInfo = getLevelInfo(profile.xp);

  const durationSec = room.completedAt
    ? Math.max(1, Math.round((room.completedAt - room.startedAt) / 1000))
    : 42;

  useEffect(() => {
    const colors =
      profile.activeParticle === 'hearts'
        ? ['#ff4b8b', '#ff85b3', '#ffc800']
        : profile.activeParticle === 'lightning'
        ? ['#1cb0f6', '#ffc800', '#00f5d4']
        : ['#58cc02', '#1cb0f6', '#ffc800', '#ff9600', '#ce82ff'];

    confetti({
      particleCount: 85,
      spread: 75,
      origin: { y: 0.55 },
      colors,
    });
    const t2 = window.setTimeout(() => {
      confetti({
        particleCount: 45,
        angle: 60,
        spread: 55,
        origin: { x: 0.1, y: 0.6 },
        colors,
      });
      confetti({
        particleCount: 45,
        angle: 120,
        spread: 55,
        origin: { x: 0.9, y: 0.6 },
        colors,
      });
    }, 320);

    const tXp = window.setTimeout(() => setXpBarAnimated(true), 150);
    return () => {
      window.clearTimeout(t2);
      window.clearTimeout(tXp);
    };
  }, [profile.activeParticle]);

  const unlockedBadges = useMemo(() => {
    return BADGE_DEFINITIONS.filter((b) => newlyUnlockedBadgeIds.includes(b.id));
  }, [newlyUnlockedBadgeIds]);

  const chainWords = useMemo(() => {
    return [room.startWord, ...room.moves.map((m) => m.word)];
  }, [room.startWord, room.moves]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-between px-4 pb-6 pt-6">
      <div>
        {/* Bannière Victoire */}
        <div className="animate-pop-in text-center">
          <div className="mb-3.5 flex items-center justify-center -space-x-3">
            <FigmaAvatar
              avatarId={profile.avatarId}
              size={58}
              ringColor={profile.color}
              ringGapColor="var(--bg-app)"
            />
            <FigmaAvatar
              avatarId={partner.avatarId}
              size={58}
              ringColor={partner.color}
              ringGapColor="var(--bg-app)"
            />
          </div>

          <h1
            className="text-[26px] font-black leading-tight tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {starRating === 3
              ? 'Parfait ! Score optimal !'
              : starRating === 2
              ? 'Super duo ! Bien joué !'
              : 'Chaîne complétée !'}
          </h1>

          <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
            {room.startWord} → {room.targetWord} avec {partner.name} en {durationSec}s
          </p>

          {/* 3 étoiles Duolingo */}
          <div className="mt-3.5 flex items-center justify-center gap-2.5">
            {[1, 2, 3].map((n) => (
              <Star
                key={n}
                className={`h-10 w-10 transition-transform duration-500 ${
                  n <= starRating ? 'scale-110 drop-shadow-sm' : ''
                }`}
                style={{
                  fill: n <= starRating ? '#ffc800' : 'var(--bg-muted)',
                  color: n <= starRating ? '#e5a400' : 'var(--border-tile)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Carte Résumé + Transformation visuelle */}
        <div className="duo-card mt-5 p-4">
          {/* Chiffres clés sur 3 colonnes */}
          <div
            className="grid grid-cols-3 gap-2 border-b pb-3.5 text-center"
            style={{ borderColor: 'var(--border-tile)' }}
          >
            <div>
              <p
                className="text-[22px] font-black tabular-nums leading-none"
                style={{
                  color: isOptimal ? 'var(--duo-green-text)' : 'var(--duo-orange)',
                }}
              >
                {actualSteps}
              </p>
              <p className="mt-1 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                Coups
              </p>
            </div>
            <div>
              <p
                className="text-[22px] font-black tabular-nums leading-none"
                style={{ color: 'var(--duo-blue-text)' }}
              >
                {room.optimalPar}
              </p>
              <p className="mt-1 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                Par BFS
              </p>
            </div>
            <div>
              <p
                className="text-[22px] font-black tabular-nums leading-none"
                style={{ color: 'var(--text-primary)' }}
              >
                {durationSec}s
              </p>
              <p className="mt-1 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                Temps
              </p>
            </div>
          </div>

          {/* Départ → Cible en tuiles 3D */}
          <div className="mt-4 flex items-center justify-center gap-2.5">
            <WordTiles word={room.startWord} target={room.targetWord} size="sm" />
            <ArrowRight
              className="h-4 w-4 shrink-0 stroke-[3]"
              style={{ color: 'var(--text-muted)' }}
            />
            <WordTiles word={room.targetWord} variant="target" size="sm" />
          </div>

          {/* Parcours étape par étape avec la lettre modifiée mise en avant */}
          <div
            className="mt-4 flex flex-wrap items-center justify-center gap-1.5 border-t pt-3.5"
            style={{ borderColor: 'var(--border-tile)' }}
          >
            {chainWords.map((word, idx) => {
              const prev = idx > 0 ? chainWords[idx - 1] : null;
              const isFinal = idx === chainWords.length - 1;
              return (
                <React.Fragment key={`${word}-${idx}`}>
                  {idx > 0 && (
                    <ArrowRight
                      className="h-3.5 w-3.5 shrink-0 stroke-[2.5]"
                      style={{ color: 'var(--text-muted)' }}
                    />
                  )}
                  <span
                    className="inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-black tracking-wider"
                    style={{
                      backgroundColor: isFinal
                        ? 'color-mix(in srgb, var(--duo-green) 14%, var(--bg-tile))'
                        : 'var(--bg-muted)',
                      borderColor: isFinal ? 'var(--duo-green)' : 'var(--border-tile)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {word.split('').map((ch, ci) => {
                      const changed = prev !== null && prev[ci] !== ch;
                      return (
                        <span
                          key={ci}
                          style={{
                            color: changed ? 'var(--duo-green-shadow)' : undefined,
                          }}
                        >
                          {ch}
                        </span>
                      );
                    })}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Progression XP & Récompenses */}
        <div className="duo-card mt-3.5 p-4">
          <div className="flex items-center justify-between gap-2 text-sm font-black">
            <span className="flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
              <FigmaFlameIcon size={18} />+{earnedXp} XP · +{earnedStars} ⭐
            </span>
            <span className="text-[13px]" style={{ color: 'var(--duo-blue-text)' }}>
              Niv. {levelInfo.level} · {levelInfo.title}
            </span>
          </div>
          <div
            className="mt-2.5 h-3 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: 'var(--bg-muted)' }}
          >
            <div
              className="relative h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${xpBarAnimated ? Math.max(12, levelInfo.progressPct) : 5}%`,
                backgroundColor: 'var(--duo-green)',
              }}
            >
              <div className="mx-2 mt-0.5 h-1 rounded-full bg-white/35" />
            </div>
          </div>
        </div>

        {/* Carte des Badges débloqués */}
        {unlockedBadges.length > 0 && (
          <div
            className="duo-card animate-pop-in mt-3.5 p-4"
            style={{
              borderColor: 'var(--duo-gold)',
              backgroundColor: 'var(--duo-gold-bg)',
            }}
          >
            <div
              className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"
              style={{ color: 'var(--duo-gold-text)' }}
            >
              <Award className="h-4 w-4" style={{ color: 'var(--duo-orange)' }} />
              Nouveau badge débloqué !
            </div>
            <div className="mt-2.5 space-y-2.5">
              {unlockedBadges.map((badge) => (
                <div key={badge.id} className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: 'var(--bg-surface)' }}
                  >
                    <FigmaBadgeIcon badgeId={badge.id} size={28} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-black" style={{ color: 'var(--text-primary)' }}>
                      {badge.title}
                    </p>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                      {badge.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions de sortie (sans icônes) */}
      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() => onRematch(room.code)}
          className="duo-btn duo-btn-green w-full py-4 text-base"
        >
          Revanche immédiate
        </button>

        <button
          type="button"
          onClick={onBackToHub}
          className="duo-btn duo-btn-white w-full py-3.5 text-[15px]"
        >
          Accueil
        </button>
      </div>
    </div>
  );
};
