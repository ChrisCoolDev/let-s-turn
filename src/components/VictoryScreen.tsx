import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Award, Sparkles, Star, Swords, Trophy } from 'lucide-react';
import { computeDuelScores, getBadgeDefinitions, getLevelInfo } from '../engine/gamification';
import { fireVictoryEffect } from '../engine/victoryEffects';
import { findShortestPath } from '../engine/wordLadder';
import { useI18n, type TranslationKey } from '../i18n';
import { resolveRoomParticipants } from '../services/multiplayer';
import { FigmaAvatar, FigmaBadgeIcon, FigmaFlameIcon } from './FigmaAssets';
import { WordTiles } from './WordTiles';
import type { BadgeUpgradeResult, GameRoom, PlayerProfile } from '../types/game';

interface VictoryScreenProps {
  room: GameRoom;
  profile: PlayerProfile;
  badgeUpgrades: BadgeUpgradeResult[];
  earnedXp: number;
  earnedStars: number;
  leveledUpTo?: number | null;
  levelUpBonusStars?: number;
  tempoBonusXp?: number;
  goldenRouteClaimed?: boolean;
  duelMvpBonusStars?: number;
  duoStreakDays?: number;
  onRematch: (roomCode: string) => void;
  onBackToHub: () => void;
}

export const VictoryScreen: React.FC<VictoryScreenProps> = ({
  room,
  profile,
  badgeUpgrades,
  earnedXp,
  earnedStars,
  leveledUpTo = null,
  levelUpBonusStars = 0,
  tempoBonusXp = 0,
  goldenRouteClaimed = false,
  duelMvpBonusStars = 0,
  duoStreakDays = 0,
  onRematch,
  onBackToHub,
}) => {
  const { locale, t, formatMoves } = useI18n();
  const [xpBarAnimated, setXpBarAnimated] = useState(false);

  const actualSteps = room.moves.length + room.undoPenaltyCount;
  const isAbandoned = Boolean(room.abandoned || room.currentWord !== room.targetWord);
  const isOptimal = !isAbandoned && actualSteps <= room.optimalPar;
  const starRating = isAbandoned ? 0 : isOptimal ? 3 : actualSteps <= room.optimalPar + 2 ? 2 : 1;

  const {
    me,
    partner,
    waitingForPartner: partnerWaiting,
    isBot: partnerIsBot,
  } = resolveRoomParticipants(room, profile);
  const levelInfo = getLevelInfo(profile.xp, locale);
  const duelScores =
    !isAbandoned && room.mode === 'duel' ? computeDuelScores(room, me.playerId) : null;

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

  const upgradedBadgeEntries = useMemo(() => {
    if (isAbandoned) return [];
    const defs = getBadgeDefinitions(locale);
    return badgeUpgrades
      .map((upgrade) => {
        const def = defs.find((b) => b.id === upgrade.badgeId);
        return def ? { upgrade, def } : null;
      })
      .filter((x): x is { upgrade: BadgeUpgradeResult; def: (typeof defs)[number] } => x !== null);
  }, [badgeUpgrades, isAbandoned, locale]);

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
              frame={profile.activeFrame}
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
          {duelScores && (
            <div
              className="mb-3.5 rounded-2xl border-2 px-3 py-2.5"
              style={{
                borderColor: duelScores.isMeWinning ? 'var(--duo-gold)' : 'var(--border-tile)',
                backgroundColor: duelScores.isMeWinning ? 'var(--duo-gold-bg)' : 'var(--bg-muted)',
              }}
            >
              <div className="flex items-center justify-between gap-2 text-xs font-black">
                <span className="inline-flex items-center gap-1 text-[var(--duo-orange-shadow)]">
                  <Swords className="h-3.5 w-3.5" />
                  {duelScores.isTie
                    ? t('victory.duelTie')
                    : duelScores.isMeWinning
                    ? t('victory.duelWinnerYou')
                    : t('victory.duelWinnerPartner', { name: partner.name })}
                </span>
                {duelMvpBonusStars > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] font-black text-[var(--duo-gold-text)]">
                    <Trophy className="h-3 w-3 text-[var(--duo-orange)]" />
                    <span>{t('victory.duelMvpBonus')}</span>
                    <Star className="h-3 w-3 fill-[#ffc800] text-[#e5a400]" />
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-[var(--bg-surface)] px-2 py-1.5">
                  <p className="truncate text-[11px] font-bold text-[var(--text-muted)]">
                    {t('common.you')}
                  </p>
                  <p
                    className="text-base font-black tabular-nums"
                    style={{
                      color: duelScores.isMeWinning
                        ? 'var(--duo-green-text)'
                        : 'var(--text-primary)',
                    }}
                  >
                    {duelScores.myScore} pts
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--bg-surface)] px-2 py-1.5">
                  <p className="truncate text-[11px] font-bold text-[var(--text-muted)]">
                    {partnerWaiting ? t('common.partner') : partner.name}
                  </p>
                  <p
                    className="text-base font-black tabular-nums"
                    style={{
                      color: duelScores.isOpponentWinning
                        ? 'var(--duo-blue-text)'
                        : 'var(--text-primary)',
                    }}
                  >
                    {duelScores.opponentScore} pts
                  </p>
                </div>
              </div>
            </div>
          )}

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
              <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <FigmaFlameIcon size={18} />
                <span>+{earnedXp} XP · +{earnedStars}</span>
                <Star className="h-4 w-4 fill-[#ffc800] text-[#e5a400]" />
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
            {leveledUpTo && (
              <div
                className="animate-pop-in mt-3 flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-center text-xs font-black"
                style={{
                  backgroundColor: 'var(--duo-gold-bg)',
                  color: 'var(--duo-gold-text)',
                }}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--duo-orange)]" />
                <span>
                  {t('victory.levelUpPrefix', { level: leveledUpTo })} +{levelUpBonusStars}
                </span>
                <Star className="h-3.5 w-3.5 fill-[#ffc800] text-[#e5a400]" />
                <span>{t('victory.levelUpSuffix')}</span>
              </div>
            )}
            {(goldenRouteClaimed ||
              tempoBonusXp > 0 ||
              duoStreakDays > 0 ||
              (!isAbandoned &&
                partnerIsBot &&
                (room.botDifficulty === 'scholar' || room.botDifficulty === 'grandmaster'))) && (
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
                {!isAbandoned && partnerIsBot && room.botDifficulty === 'scholar' && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black"
                    style={{
                      backgroundColor: 'var(--duo-blue-bg)',
                      color: 'var(--duo-blue-text)',
                    }}
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>{t('victory.bonusMiyuScholar')}</span>
                  </span>
                )}
                {!isAbandoned && partnerIsBot && room.botDifficulty === 'grandmaster' && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black"
                    style={{
                      backgroundColor: 'var(--duo-gold-bg)',
                      color: 'var(--duo-gold-text)',
                    }}
                  >
                    <Star className="h-3 w-3 fill-[#ffc800] text-[#e5a400]" />
                    <span>{t('victory.bonusMiyuGrandmaster')}</span>
                  </span>
                )}
                {goldenRouteClaimed && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black"
                    style={{
                      backgroundColor: 'var(--duo-gold-bg)',
                      color: 'var(--duo-gold-text)',
                    }}
                  >
                    <Star className="h-3 w-3 fill-[#ffc800] text-[#e5a400]" />
                    <span>{t('victory.bonusGoldenRoute')} +1</span>
                    <Star className="h-3 w-3 fill-[#ffc800] text-[#e5a400]" />
                  </span>
                )}
                {tempoBonusXp > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black"
                    style={{
                      backgroundColor: 'var(--duo-orange-bg)',
                      color: 'var(--duo-orange-shadow)',
                    }}
                  >
                    <FigmaFlameIcon size={12} />
                    <span>{t('victory.bonusTempoXp', { xp: tempoBonusXp })}</span>
                  </span>
                )}
                {duoStreakDays > 0 && !partnerWaiting && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black"
                    style={{
                      backgroundColor: 'var(--duo-orange-bg)',
                      color: 'var(--duo-orange-shadow)',
                    }}
                  >
                    <FigmaFlameIcon size={12} />
                    <span>
                      {t('victory.duoStreakBanner', {
                        name: partner.name,
                        days: duoStreakDays,
                      })}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Carte des Badges débloqués */}
        {upgradedBadgeEntries.length > 0 && (
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
              {upgradedBadgeEntries.map(({ upgrade, def }) => (
                <div key={`${def.id}-${upgrade.newTier}`} className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: 'var(--bg-surface)' }}
                  >
                    <FigmaBadgeIcon badgeId={def.id} size={28} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[15px] font-black" style={{ color: 'var(--text-primary)' }}>
                        {def.title}
                      </p>
                      <span
                        className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--duo-gold-text)',
                        }}
                      >
                        <span>
                          {t('victory.badgeTierLabel', {
                            tier: t(`badge.tier.${upgrade.newTier}` as TranslationKey),
                          })}{' '}
                          · +{upgrade.rewardStars}
                        </span>
                        <Star className="h-3 w-3 fill-[#ffc800] text-[#e5a400]" />
                      </span>
                    </div>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                      {def.description}
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
