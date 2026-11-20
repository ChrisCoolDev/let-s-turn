import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Award, Star } from 'lucide-react';
import { getBadgeDefinitions, getLevelInfo } from '../engine/gamification';
import { fireVictoryEffect } from '../engine/victoryEffects';
import { findShortestPath } from '../engine/wordLadder';
import { useI18n } from '../i18n';
import { isBotPartner, isWaitingPartner } from '../services/multiplayer';
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
  const { locale, t, formatMoves } = useI18n();
  const [xpBarAnimated, setXpBarAnimated] = useState(false);

  const actualSteps = room.moves.length + room.undoPenaltyCount;
  const isAbandoned = Boolean(room.abandoned || room.currentWord !== room.targetWord);
  const isOptimal = !isAbandoned && actualSteps <= room.optimalPar;
  const starRating = isAbandoned ? 0 : isOptimal ? 3 : actualSteps <= room.optimalPar + 2 ? 2 : 1;

  const isHost =
    room.hostPlayer.playerId === profile.playerId ||
    (room.partnerPlayer.playerId !== profile.playerId &&
      room.hostPlayer.name === profile.name &&
      room.partnerPlayer.name !== profile.name);
  const partner = isHost ? room.partnerPlayer : room.hostPlayer;
  const partnerWaiting = isWaitingPartner(partner.playerId);
  const partnerIsBot = isBotPartner(partner.playerId);
  const levelInfo = getLevelInfo(profile.xp, locale);

  const durationSec = room.completedAt
    ? Math.max(1, Math.round((room.completedAt - room.startedAt) / 1000))
    : 42;

  useEffect(() => {
    if (isAbandoned) return;
    const stopEffect = fireVictoryEffect(profile.activeParticle);
    const tXp = window.setTimeout(() => setXpBarAnimated(true), 150);
    return () => {
      stopEffect();
      window.clearTimeout(tXp);
    };
  }, [profile.activeParticle, isAbandoned]);

  const unlockedBadges = useMemo(() => {
    if (isAbandoned) return [];
    return getBadgeDefinitions(locale).filter((b) => newlyUnlockedBadgeIds.includes(b.id));
  }, [newlyUnlockedBadgeIds, isAbandoned, locale]);

  const chainWords = useMemo(() => {
    return [room.startWord, ...room.moves.map((m) => m.word)];
  }, [room.startWord, room.moves]);

  const optimalSolution = useMemo(() => {
    if (!isAbandoned) return [];
    if (room.optimalPath.length > 0) return room.optimalPath;
    return (
      findShortestPath(room.startWord, room.targetWord, room.language) ?? [
        room.startWord,
        room.targetWord,
      ]
    );
  }, [isAbandoned, room.optimalPath, room.startWord, room.targetWord, room.language]);

  const headline = isAbandoned
    ? t('victory.titleAbandoned')
    : starRating === 3
    ? t('victory.titlePerfect')
    : starRating === 2
    ? t('victory.titleGreat')
    : t('victory.titleCompleted');

  const subtitle = isAbandoned
    ? room.abandonedByName && room.abandonedByPlayerId !== profile.playerId
      ? t('victory.subtitleAbandonedBy', {
          name: room.abandonedByName,
          start: room.startWord,
          target: room.targetWord,
        })
      : t('victory.subtitleAbandonedSelf', {
          start: room.startWord,
          target: room.targetWord,
        })
    : partnerWaiting
    ? t('victory.subtitleWonSolo', {
        start: room.startWord,
        target: room.targetWord,
        duration: durationSec,
      })
    : t('victory.subtitleWonWith', {
        start: room.startWord,
        target: room.targetWord,
        name: partner.name,
        duration: durationSec,
      });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-between px-4 pb-6 pt-6">
      <div>
        {/* Bannière Victoire */}
        <div className="animate-pop-in text-center">
          <div className="mb-3.5 flex items-center justify-center -space-x-3">
            <FigmaAvatar
              avatarId={profile.avatarId}
              size={60}
              ringColor={profile.color}
              ringGapColor="var(--bg-app)"
            />
            <FigmaAvatar
              avatarId={partner.avatarId}
              size={60}
              ringColor={partnerWaiting ? undefined : partner.color}
              ringGapColor="var(--bg-app)"
              empty={partnerWaiting}
              isBot={partnerIsBot}
            />
          </div>

          <h1
            className="text-[28px] font-black leading-tight tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {headline}
          </h1>

          <p className="mt-1.5 text-[15px] font-bold" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
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
                className="text-2xl font-black tabular-nums leading-none"
                style={{
                  color: isAbandoned
                    ? 'var(--text-primary)'
                    : isOptimal
                    ? 'var(--duo-green-text)'
                    : 'var(--duo-orange)',
                }}
              >
                {actualSteps}
              </p>
              <p className="mt-1 text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>
                {t('victory.statMoves')}
              </p>
            </div>
            <div>
              <p
                className="text-2xl font-black tabular-nums leading-none"
                style={{ color: 'var(--duo-blue-text)' }}
              >
                {room.optimalPar}
              </p>
              <p className="mt-1 text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>
                {t('victory.statPar')}
              </p>
            </div>
            <div>
              <p
                className="text-2xl font-black tabular-nums leading-none"
                style={{ color: 'var(--text-primary)' }}
              >
                {durationSec}s
              </p>
              <p className="mt-1 text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>
                {t('victory.statTime')}
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

          {/* Parcours joué ou Solution optimale révélée */}
          {isAbandoned ? (
            <div
              className="mt-4 space-y-3 border-t pt-3.5"
              style={{ borderColor: 'var(--border-tile)' }}
            >
              {room.moves.length > 0 && (
                <div>
                  <p
                    className="mb-2 text-center text-[11px] font-black uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {t('victory.yourAttempt', { moves: formatMoves(room.moves.length) })}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {chainWords.map((word, idx) => {
                      const prev = idx > 0 ? chainWords[idx - 1] : null;
                      return (
                        <React.Fragment key={`played-${word}-${idx}`}>
                          {idx > 0 && (
                            <ArrowRight
                              className="h-3.5 w-3.5 shrink-0 stroke-[2.5]"
                              style={{ color: 'var(--text-muted)' }}
                            />
                          )}
                          <span
                            className="inline-flex items-center rounded-lg border px-2.5 py-1 text-[13px] font-black tracking-wider"
                            style={{
                              backgroundColor: 'var(--bg-muted)',
                              borderColor: 'var(--border-tile)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {word.split('').map((ch, ci) => {
                              const changed = prev !== null && prev[ci] !== ch;
                              return (
                                <span
                                  key={ci}
                                  style={{
                                    color: changed ? 'var(--duo-blue-text)' : undefined,
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
              )}

              <div>
                <p
                  className="mb-2 text-center text-[11px] font-black uppercase tracking-wider"
                  style={{ color: 'var(--duo-green-text)' }}
                >
                  {t('victory.optimalSolution', { moves: formatMoves(room.optimalPar) })}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {optimalSolution.map((word, idx) => {
                    const prev = idx > 0 ? optimalSolution[idx - 1] : null;
                    const isFinal = idx === optimalSolution.length - 1;
                    return (
                      <React.Fragment key={`opt-${word}-${idx}`}>
                        {idx > 0 && (
                          <ArrowRight
                            className="h-3.5 w-3.5 shrink-0 stroke-[2.5]"
                            style={{ color: 'var(--text-muted)' }}
                          />
                        )}
                        <span
                          className="inline-flex items-center rounded-lg border px-2.5 py-1 text-[13px] font-black tracking-wider"
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
            </div>
          ) : (
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
                      className="inline-flex items-center rounded-lg border px-2.5 py-1 text-[13px] font-black tracking-wider"
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
          )}
        </div>

        {/* Progression XP & Récompenses */}
        {!isAbandoned && (
          <div className="duo-card mt-3.5 p-4">
            <div className="flex items-center justify-between gap-2 text-[15px] font-black">
              <span className="flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <FigmaFlameIcon size={18} />+{earnedXp} XP · +{earnedStars} ⭐
              </span>
              <span className="text-sm" style={{ color: 'var(--duo-blue-text)' }}>
                {t('common.levelShort', { level: levelInfo.level })} · {levelInfo.title}
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
        )}

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
              {t('victory.newBadge')}
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
          {t('victory.rematch')}
        </button>

        <button
          type="button"
          onClick={onBackToHub}
          className="duo-btn duo-btn-white w-full py-3.5 text-[15px]"
        >
          {t('victory.home')}
        </button>
      </div>
    </div>
  );
};
