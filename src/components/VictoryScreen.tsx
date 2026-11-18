import React, { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Award,
  Check,
  Home,
  RefreshCw,
  Share2,
  Sparkles,
  Star,
} from 'lucide-react';
import { BADGE_DEFINITIONS, getLevelInfo } from '../engine/gamification';
import { FigmaAvatar, FigmaBadgeIcon, FigmaFlameIcon } from './FigmaAssets';
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
  const [sharedStatus, setSharedStatus] = useState<'idle' | 'copied'>('idle');
  const [showSharePreview, setShowSharePreview] = useState(false);

  const actualSteps = room.moves.length + room.undoPenaltyCount;
  const starRating =
    actualSteps <= room.optimalPar ? 3 : actualSteps <= room.optimalPar + 2 ? 2 : 1;

  const isHost = room.hostPlayer.playerId === profile.playerId;
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

  // Build Wordle-style colored square chain representation
  const wordleGridText = useMemo(() => {
    const lines = [
      `🔥 Let's Turn (${room.startWord} → ${room.targetWord})`,
      `👥 ${profile.name} & ${partner.name} · ${actualSteps}/${room.optimalPar} coups (${'⭐'.repeat(
        starRating
      )})`,
      '',
    ];

    const startSquares = room.startWord
      .split('')
      .map((c, idx) => (c === room.targetWord[idx] ? '🟩' : '⬜'))
      .join('');
    lines.push(`${startSquares} ${room.startWord}`);

    room.moves.forEach((m) => {
      const sq = m.word
        .split('')
        .map((c, idx) => {
          if (c === room.targetWord[idx]) return '🟩';
          if (idx === m.changedIndex) return '🟦';
          return '⬜';
        })
        .join('');
      lines.push(`${sq} ${m.word}`);
    });
    return lines.join('\n');
  }, [room, profile.name, partner.name, actualSteps, starRating]);

  const handleShareChain = async () => {
    setShowSharePreview(true);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Let's Turn : ${room.startWord} → ${room.targetWord}`,
          text: wordleGridText,
        });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(wordleGridText);
      setSharedStatus('copied');
      window.setTimeout(() => setSharedStatus('idle'), 2500);
    } catch {
      setSharedStatus('copied');
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-between px-4 pb-6 pt-5">
      <div>
        {/* Bannière Victoire */}
        <div className="animate-pop-in text-center">
          <div className="mb-3 flex items-center justify-center -space-x-2.5">
            <FigmaAvatar
              avatarId={profile.avatarId}
              size={52}
              ringColor={profile.color}
              ringGapColor="var(--bg-app)"
            />
            <FigmaAvatar
              avatarId={partner.avatarId}
              size={52}
              ringColor={partner.color}
              ringGapColor="var(--bg-app)"
            />
          </div>

          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black"
            style={{ backgroundColor: 'var(--duo-green-bg)', color: 'var(--duo-green-text)' }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Mot cible atteint en {durationSec}s !
          </div>

          <h1 className="mt-2 text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            {starRating === 3
              ? 'Parfait ! Score optimal !'
              : starRating === 2
              ? 'Super duo ! Bien joué !'
              : 'Chaîne complétée !'}
          </h1>

          {/* 3 étoiles Duolingo */}
          <div className="mt-3 flex items-center justify-center gap-2">
            {[1, 2, 3].map((n) => (
              <Star
                key={n}
                className={`h-9 w-9 transition-transform duration-500 ${
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

        {/* Résumé de la chaîne vs BFS optimal */}
        <div className="duo-card mt-5 p-4">
          <div
            className="flex items-center justify-between border-b-2 pb-3 text-xs font-black"
            style={{ borderColor: 'var(--border-tile)' }}
          >
            <div>
              <span className="block" style={{ color: 'var(--text-muted)' }}>
                Chemin optimal (BFS)
              </span>
              <span className="text-base" style={{ color: 'var(--duo-blue-text)' }}>
                {room.optimalPar} coups
              </span>
            </div>
            <div className="text-right">
              <span className="block" style={{ color: 'var(--text-muted)' }}>
                Votre score
              </span>
              <span
                className="text-base"
                style={{
                  color:
                    actualSteps <= room.optimalPar
                      ? 'var(--duo-green-text)'
                      : 'var(--duo-orange)',
                }}
              >
                {actualSteps} coups
              </span>
            </div>
          </div>

          {/* Parcours visuel de transformation */}
          <div className="mt-3">
            <span
              className="mb-2 block text-[11px] font-extrabold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Votre transformation
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="rounded-xl border-2 px-2.5 py-1 text-xs font-black"
                style={{
                  borderColor: 'var(--border-tile)',
                  backgroundColor: 'var(--bg-muted)',
                  color: 'var(--text-primary)',
                }}
              >
                {room.startWord}
              </span>
              {room.moves.map((m) => {
                const isTarget = m.word === room.targetWord;
                return (
                  <React.Fragment key={m.id}>
                    <ArrowRight className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                    <span
                      className="rounded-xl border-2 px-2.5 py-1 text-xs font-black"
                      style={{
                        borderColor: isTarget ? 'var(--duo-green)' : 'var(--border-tile)',
                        backgroundColor: isTarget ? 'var(--duo-green-bg)' : 'var(--bg-surface)',
                        color: isTarget ? 'var(--duo-green-text)' : 'var(--text-primary)',
                      }}
                    >
                      {m.word}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Progression XP & Récompenses */}
        <div className="duo-card mt-3.5 p-4">
          <div className="flex items-center justify-between text-xs font-black">
            <span className="flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
              <FigmaFlameIcon size={16} />+{earnedXp} XP · +{earnedStars} ⭐
            </span>
            <span style={{ color: 'var(--duo-blue-text)' }}>
              Niv. {levelInfo.level} · {levelInfo.title}
            </span>
          </div>
          <div
            className="mt-2 h-3 w-full overflow-hidden rounded-full"
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

        {/* Pop-up / Carte des Badges débloqués */}
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
            <div className="mt-2 space-y-2">
              {unlockedBadges.map((badge) => (
                <div key={badge.id} className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: 'var(--bg-surface)' }}
                  >
                    <FigmaBadgeIcon badgeId={badge.id} size={26} />
                  </div>
                  <div>
                    <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                      {badge.title}
                    </p>
                    <p className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                      {badge.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aperçu carte de partage style Wordle */}
        {showSharePreview && (
          <div className="duo-card animate-pop-in mt-3.5 p-3.5">
            <p className="mb-2 text-xs font-black" style={{ color: 'var(--duo-blue-text)' }}>
              Carte prête pour WhatsApp / Instagram :
            </p>
            <pre
              className="whitespace-pre-wrap rounded-xl p-3 font-sans text-xs font-bold leading-relaxed"
              style={{
                backgroundColor: 'var(--bg-muted)',
                color: 'var(--text-primary)',
              }}
            >
              {wordleGridText}
            </pre>
          </div>
        )}
      </div>

      {/* Actions de sortie (Rétention) */}
      <div className="mt-6 space-y-2.5">
        <button
          type="button"
          onClick={() => onRematch(room.code)}
          className="duo-btn duo-btn-green flex w-full items-center justify-center gap-2 py-4 text-base"
        >
          <RefreshCw className="h-5 w-5" />
          Revanche immédiate
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleShareChain}
            className="duo-btn duo-btn-blue flex items-center justify-center gap-1.5 py-3 text-xs"
          >
            {sharedStatus === 'copied' ? (
              <>
                <Check className="h-4 w-4" />
                Copié !
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Partager chaîne
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onBackToHub}
            className="duo-btn duo-btn-white flex items-center justify-center gap-1.5 py-3 text-xs"
          >
            <Home className="h-4 w-4" />
            Accueil
          </button>
        </div>
      </div>
    </div>
  );
};
