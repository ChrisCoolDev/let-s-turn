import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Heart,
  Lock,
  PartyPopper,
  Snowflake,
  Sparkles,
  Star,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  getActiveDuoStreak,
  getAvatarFrameShopItems,
  getBadgeDefinitions,
  getBadgeProgress,
  getLevelInfo,
  getParticleShopItems,
  getThemeShopItems,
  getTileStyleShopItems,
  MAX_STREAK_FREEZES,
  STREAK_FREEZE_PRICE,
} from '../engine/gamification';
import {
  computeWordRarityScore,
  getTotalDictionaryWordCount,
} from '../engine/wordLadder';
import { MIYU_BOT_ID } from '../services/multiplayer';
import { fireVictoryEffect } from '../engine/victoryEffects';
import { isPlural, useI18n, type TranslationKey } from '../i18n';
import { FigmaAvatar, FigmaBadgeIcon, FigmaFlameIcon } from './FigmaAssets';
import { LanguageToggle } from './LanguageToggle';
import { WordTiles } from './WordTiles';
import type {
  AvatarFrameId,
  ParticleEffectId,
  PlayerProfile,
  SavedChainRecord,
  ThemeId,
  TileStyleId,
} from '../types/game';

function formatChainDate(
  timestampMs: number,
  intlLocale: string,
  t: (key: TranslationKey) => string
): string {
  const target = new Date(timestampMs);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  ).getTime();
  const diffDays = Math.round((startOfToday - startOfTarget) / 86400000);
  if (diffDays === 0) return t('profile.today');
  if (diffDays === 1) return t('profile.yesterday');
  return new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short' }).format(target);
}

interface StatsSummaryCardProps {
  profile: PlayerProfile;
  winRate: number;
  optimalRate: number;
}

const StatsSummaryCard: React.FC<StatsSummaryCardProps> = ({
  profile,
  winRate,
  optimalRate,
}) => {
  const { locale, t } = useI18n();
  const headlineStats = [
    { value: `${profile.gamesWon}`, label: t('profile.statWins') },
    { value: profile.gamesPlayed > 0 ? `${winRate}%` : '—', label: t('profile.statWinRate') },
    { value: profile.fastestWinSeconds ? `${profile.fastestWinSeconds}s` : '—', label: t('profile.statBest') },
    { value: `${profile.uniqueWordsUsed.length}`, label: t('profile.statWords') },
  ];

  const gamesLabel = t(isPlural(profile.gamesPlayed, locale) ? 'profile.gameMany' : 'profile.gameOne', {
    count: profile.gamesPlayed,
  });

  return (
    <div className="duo-card p-4">
      <div className="grid grid-cols-4 gap-2 text-center">
        {headlineStats.map((stat) => (
          <div key={stat.label}>
            <p
              className="text-[22px] font-black tabular-nums leading-none"
              style={{ color: 'var(--text-primary)' }}
            >
              {stat.value}
            </p>
            <p className="mt-1 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t pt-3.5" style={{ borderColor: 'var(--border-tile)' }}>
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-extrabold" style={{ color: 'var(--text-primary)' }}>
            {t('profile.parWins')}
          </span>
          <span className="font-black tabular-nums" style={{ color: 'var(--duo-green-shadow)' }}>
            {profile.optimalWins} / {profile.gamesWon}
            <span className="ml-1 font-bold" style={{ color: 'var(--text-muted)' }}>
              ({optimalRate}%)
            </span>
          </span>
        </div>

        <div
          className="mt-2 h-2.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: 'var(--bg-muted)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${optimalRate > 0 ? Math.max(8, optimalRate) : 0}%`,
              backgroundColor: 'var(--duo-green)',
            }}
          />
        </div>

        <p className="mt-2.5 text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>
          {t('profile.statsFooter', {
            noHint: profile.noHintWins,
            games: gamesLabel,
            letters: profile.longestWordSolved,
          })}
        </p>
      </div>
    </div>
  );
};

const SavedChainCard: React.FC<{ chain: SavedChainRecord }> = ({ chain }) => {
  const { intlLocale, t } = useI18n();
  const isOptimal = chain.actualSteps <= chain.optimalSteps;
  const accentVar = isOptimal ? '--duo-green' : '--duo-orange';
  const accentShadowVar = isOptimal ? '--duo-green-shadow' : '--duo-orange-shadow';

  return (
    <div className="duo-card p-3.5">
      {/* Méta duo & score Par */}
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
          {t('profile.withPartner')}{' '}
          <span style={{ color: 'var(--text-primary)' }}>{chain.partnerName}</span> ·{' '}
          {chain.language === 'FR' ? 'FR' : 'EN'} ·{' '}
          {formatChainDate(chain.completedAt, intlLocale, t)}
        </p>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-0.5 text-[13px] font-black"
          style={{
            backgroundColor: `color-mix(in srgb, var(${accentVar}) 15%, transparent)`,
            color: `var(${accentShadowVar})`,
          }}
        >
          {isOptimal ? (
            <>
              <Check className="h-3.5 w-3.5 stroke-[3]" />
              {t('common.parLabel', { par: chain.optimalSteps })}
            </>
          ) : (
            t('profile.parRatio', { actual: chain.actualSteps, optimal: chain.optimalSteps })
          )}
        </span>
      </div>

      {/* Départ → Cible en tuiles */}
      <div className="mt-3.5 flex items-center justify-center gap-2.5">
        <WordTiles word={chain.startWord} target={chain.targetWord} size="sm" />
        <ArrowRight
          className="h-4 w-4 shrink-0 stroke-[3]"
          style={{ color: 'var(--text-muted)' }}
        />
        <WordTiles word={chain.targetWord} variant="target" size="sm" />
      </div>

      {/* Étapes intermédiaires avec lettre modifiée mise en avant */}
      <div
        className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5 border-t pt-3"
        style={{ borderColor: 'var(--border-tile)' }}
      >
        {chain.words.map((word, idx) => {
          const prev = idx > 0 ? chain.words[idx - 1] : null;
          const isFinal = idx === chain.words.length - 1;
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
    </div>
  );
};

const PARTICLE_VISUALS: Record<
  ParticleEffectId,
  { icon: LucideIcon; color: string; filled: boolean }
> = {
  confetti: { icon: PartyPopper, color: '#ff9600', filled: false },
  sparkles: { icon: Sparkles, color: '#ffc800', filled: true },
  hearts: { icon: Heart, color: '#ff4b8b', filled: true },
  lightning: { icon: Zap, color: '#1cb0f6', filled: true },
};

const TILE_PREVIEW_STYLES: Record<TileStyleId, React.CSSProperties> = {
  classic: {
    backgroundColor: 'var(--bg-tile)',
    borderColor: 'var(--border-tile)',
    color: 'var(--text-primary)',
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  wood: {
    background: 'linear-gradient(180deg, #f3dec0 0%, #e4c393 100%)',
    borderColor: '#b98952',
    color: '#4e2e0f',
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  neon: {
    backgroundColor: '#12182b',
    borderColor: '#22d3ee',
    color: '#e0f2fe',
    borderWidth: 2,
    borderBottomWidth: 4,
    boxShadow: '0 0 10px rgba(34, 211, 238, 0.35)',
  },
  gold: {
    background: 'linear-gradient(180deg, #fff3b0 0%, #ffd43b 65%, #f59f00 100%)',
    borderColor: '#b7791f',
    color: '#5c3800',
    borderWidth: 2,
    borderBottomWidth: 4,
  },
};

interface CollectionProfileScreenProps {
  profile: PlayerProfile;
  onBack: () => void;
  onBuyOrActivateTheme: (themeId: ThemeId, priceStars: number) => boolean;
  onBuyOrActivateParticle: (particleId: ParticleEffectId, priceStars: number) => boolean;
  onBuyOrActivateTileStyle: (tileStyleId: TileStyleId, priceStars: number) => boolean;
  onBuyOrActivateAvatarFrame: (frameId: AvatarFrameId, priceStars: number) => boolean;
  onBuyStreakFreeze: () => 'ok' | 'maxed' | 'no_stars';
}

const TIER_STYLES: Record<1 | 2 | 3 | 4, { bg: string; fg: string; dot: string }> = {
  1: { bg: '#cd7f3222', fg: '#a15c1b', dot: '#cd7f32' },
  2: { bg: '#94a3b828', fg: '#475569', dot: '#94a3b8' },
  3: { bg: 'var(--duo-gold-bg)', fg: 'var(--duo-gold-text)', dot: '#f59e0b' },
  4: { bg: 'var(--duo-blue-bg)', fg: 'var(--duo-blue-text)', dot: '#06b6d4' },
};

export const CollectionProfileScreen: React.FC<CollectionProfileScreenProps> = ({
  profile,
  onBack,
  onBuyOrActivateTheme,
  onBuyOrActivateParticle,
  onBuyOrActivateTileStyle,
  onBuyOrActivateAvatarFrame,
  onBuyStreakFreeze,
}) => {
  const { locale, t } = useI18n();
  const [activeTab, setActiveTab] = useState<'badges' | 'stats' | 'shop'>('badges');
  const [shopNotice, setShopNotice] = useState<string | null>(null);
  const previewCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      previewCleanupRef.current?.();
    };
  }, []);

  const levelInfo = getLevelInfo(profile.xp, locale);
  const badgeDefinitions = getBadgeDefinitions(locale);
  const badgeProgressList = badgeDefinitions.map((badge) => ({
    badge,
    progress: getBadgeProgress(profile, badge),
  }));
  const unlockedTiersTotal = badgeProgressList.reduce(
    (sum, item) => sum + item.progress.currentTier,
    0
  );
  const maxTiersTotal = badgeDefinitions.length * 4;
  const themeShopItems = getThemeShopItems(locale);
  const particleShopItems = getParticleShopItems(locale);
  const tileStyleShopItems = getTileStyleShopItems(locale);
  const avatarFrameShopItems = getAvatarFrameShopItems(locale);
  const unlockedTileStyles = profile.unlockedTileStyles ?? ['classic'];
  const activeTileStyle = profile.activeTileStyle ?? 'classic';
  const unlockedFrames = profile.unlockedFrames ?? ['none'];
  const activeFrame = profile.activeFrame ?? 'none';
  const freezeCount = profile.streakFreezes ?? 0;

  const totalDictWords = getTotalDictionaryWordCount();
  const rarestWords = [...profile.uniqueWordsUsed]
    .sort(
      (a, b) =>
        computeWordRarityScore(b) - computeWordRarityScore(a) ||
        b.length - a.length ||
        a.localeCompare(b)
    )
    .slice(0, 8);

  const winRate =
    profile.gamesPlayed > 0
      ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100)
      : 100;
  const optimalRate =
    profile.gamesWon > 0
      ? Math.round((profile.optimalWins / profile.gamesWon) * 100)
      : 0;

  const handleThemeAction = (themeId: ThemeId, price: number, name: string) => {
    const ok = onBuyOrActivateTheme(themeId, price);
    if (ok) {
      setShopNotice(t('profile.noticeThemeActivated', { name }));
    } else {
      setShopNotice(t('profile.noticeNotEnoughStars', { name }));
    }
    window.setTimeout(() => setShopNotice(null), 2400);
  };

  const handleParticleAction = (particleId: ParticleEffectId, price: number, name: string) => {
    const ok = onBuyOrActivateParticle(particleId, price);
    if (ok) {
      setShopNotice(t('profile.noticeParticleEquipped', { name }));
      previewCleanupRef.current?.();
      previewCleanupRef.current = fireVictoryEffect(particleId, { preview: true });
    } else {
      setShopNotice(t('profile.noticeNotEnoughStars', { name }));
    }
    window.setTimeout(() => setShopNotice(null), 2400);
  };

  const handleTileStyleAction = (tileStyleId: TileStyleId, price: number, name: string) => {
    const ok = onBuyOrActivateTileStyle(tileStyleId, price);
    if (ok) {
      setShopNotice(t('profile.noticeTileStyleEquipped', { name }));
    } else {
      setShopNotice(t('profile.noticeNotEnoughStars', { name }));
    }
    window.setTimeout(() => setShopNotice(null), 2400);
  };

  const handleAvatarFrameAction = (frameId: AvatarFrameId, price: number, name: string) => {
    const ok = onBuyOrActivateAvatarFrame(frameId, price);
    if (ok) {
      setShopNotice(t('profile.noticeFrameEquipped', { name }));
    } else {
      setShopNotice(t('profile.noticeNotEnoughStars', { name }));
    }
    window.setTimeout(() => setShopNotice(null), 2400);
  };

  const handleBuyFreeze = () => {
    const res = onBuyStreakFreeze();
    if (res === 'ok') {
      setShopNotice(
        t('profile.noticeFreezeBought', {
          count: Math.min(MAX_STREAK_FREEZES, freezeCount + 1),
          max: MAX_STREAK_FREEZES,
        })
      );
    } else if (res === 'maxed') {
      setShopNotice(t('profile.noticeFreezeMaxed', { max: MAX_STREAK_FREEZES }));
    } else {
      setShopNotice(t('profile.noticeNotEnoughStars', { name: t('profile.freezeName') }));
    }
    window.setTimeout(() => setShopNotice(null), 2600);
  };

  const savedCount = profile.savedBestChains.length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-8 pt-4">
      {/* En-tête */}
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-xl border-2"
          style={{ borderColor: 'var(--border-tile)', color: 'var(--text-primary)' }}
          aria-label={t('common.back')}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
          {t('profile.title')}
        </h1>
        <div
          className="flex items-center gap-1 rounded-xl border-2 px-2.5 py-1.5"
          style={{ borderColor: 'var(--duo-gold)', backgroundColor: 'var(--duo-gold-bg)' }}
        >
          <Star className="h-4 w-4 fill-[#ffc800] text-[#e5a400]" />
          <span className="text-base font-black" style={{ color: 'var(--duo-gold-text)' }}>
            {profile.stars}
          </span>
        </div>
      </header>

      {/* Carte Profil */}
      <div className="duo-card mt-4 flex items-center gap-3.5 p-4">
        <FigmaAvatar
          avatarId={profile.avatarId}
          size={62}
          ringColor={profile.color}
          frame={activeFrame}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-xl font-black" style={{ color: 'var(--text-primary)' }}>
              {profile.name}
            </h2>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-black"
              style={{ backgroundColor: 'var(--duo-orange-bg)', color: 'var(--duo-orange)' }}
            >
              <FigmaFlameIcon size={14} />
              {profile.streak}
              {t('common.streakUnit')}
            </span>
          </div>
          <p className="text-sm font-extrabold" style={{ color: 'var(--duo-blue-text)' }}>
            {t('common.levelFull', { level: levelInfo.level })} · {levelInfo.title}
          </p>
          <div
            className="mt-2 h-2.5 w-full overflow-hidden rounded-full"
            style={{ backgroundColor: 'var(--bg-muted)' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(8, levelInfo.progressPct)}%`,
                backgroundColor: 'var(--duo-green)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Sélecteur de langue */}
      <LanguageToggle variant="row" />

      {/* Onglets Duolingo */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { id: 'badges' as const, label: t('profile.tabBadges') },
          { id: 'stats' as const, label: t('profile.tabStats') },
          { id: 'shop' as const, label: t('profile.tabShop') },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`duo-btn flex items-center justify-center gap-1.5 py-3 text-sm ${
                active ? 'duo-btn-blue' : 'duo-btn-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenu Onglet 1 : Mur des Badges Évolutifs */}
      {activeTab === 'badges' && (
        <section className="mt-4 space-y-2.5">
          <p className="text-sm font-extrabold" style={{ color: 'var(--text-muted)' }}>
            {t('profile.badgeTiersCount', {
              unlocked: unlockedTiersTotal,
              total: maxTiersTotal,
            })}
          </p>
          {badgeProgressList.map(({ badge, progress }) => {
            const tier = progress.currentTier;
            const unlocked = tier > 0;
            const tierStyle = unlocked ? TIER_STYLES[tier as 1 | 2 | 3 | 4] : null;
            return (
              <div
                key={badge.id}
                className={`duo-card flex items-start gap-3.5 p-3.5 ${
                  unlocked ? '' : 'opacity-75'
                }`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    unlocked ? '' : 'grayscale'
                  }`}
                  style={{
                    backgroundColor: unlocked ? `${badge.color}22` : 'var(--bg-muted)',
                  }}
                >
                  <FigmaBadgeIcon badgeId={badge.id} size={30} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-base font-black" style={{ color: 'var(--text-primary)' }}>
                      {badge.title}
                    </h3>
                    {tierStyle ? (
                      <span
                        className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-black"
                        style={{
                          backgroundColor: tierStyle.bg,
                          color: tierStyle.fg,
                        }}
                      >
                        {t(`badge.tier.${tier}` as TranslationKey)}
                      </span>
                    ) : (
                      <span
                        className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5"
                        style={{
                          backgroundColor: 'var(--bg-muted)',
                          color: 'var(--text-muted)',
                        }}
                        aria-label={t('profile.badgeLocked')}
                        title={t('profile.badgeLocked')}
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                    {unlocked ? badge.description : badge.conditionLabel}
                  </p>

                  {/* 4 pastilles de palier + barre de progression */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex shrink-0 items-center gap-1">
                      {([1, 2, 3, 4] as const).map((stepTier) => (
                        <span
                          key={stepTier}
                          className="h-2.5 w-2.5 rounded-full border"
                          style={{
                            backgroundColor:
                              tier >= stepTier ? TIER_STYLES[stepTier].dot : 'var(--bg-muted)',
                            borderColor:
                              tier >= stepTier ? TIER_STYLES[stepTier].dot : 'var(--border-tile)',
                          }}
                          title={t(`badge.tier.${stepTier}` as TranslationKey)}
                        />
                      ))}
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${progress.progressPct}%`,
                          backgroundColor: unlocked ? badge.color : 'var(--duo-blue)',
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] font-extrabold">
                    <span style={{ color: 'var(--text-muted)' }}>
                      {t('badge.progress', {
                        current: progress.currentValue,
                        target: progress.nextTarget,
                      })}
                    </span>
                    <span
                      className="inline-flex items-center gap-0.5"
                      style={{
                        color: progress.isMaxed ? 'var(--duo-green-text)' : 'var(--duo-gold-text)',
                      }}
                    >
                      {progress.isMaxed ? (
                        t('badge.maxTier')
                      ) : (
                        <>
                          <span>
                            {t('badge.nextTierLabel')} +{progress.nextRewardStars}
                          </span>
                          <Star className="h-3 w-3 fill-[#ffc800] text-[#e5a400]" />
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Contenu Onglet 2 : Stats de Duo & Journal des Meilleures Chaînes */}
      {activeTab === 'stats' && (
        <section className="mt-5 space-y-6">
          {/* Vue d'ensemble */}
          <StatsSummaryCard profile={profile} winRate={winRate} optimalRate={optimalRate} />

          {/* Flammes de duo par partenaire */}
          {profile.duoStreaks && Object.keys(profile.duoStreaks).length > 0 && (
            <div>
              <h3
                className="mb-3 text-sm font-black uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('profile.sectionDuoStreaks')}
              </h3>
              <div className="space-y-2">
                {Object.values(profile.duoStreaks)
                  .sort((a, b) => b.streak - a.streak || b.bestStreak - a.bestStreak)
                  .slice(0, 5)
                  .map((entry) => {
                    const activeDays = getActiveDuoStreak(profile, entry.partnerId);
                    return (
                      <div
                        key={entry.partnerId}
                        className="duo-card flex items-center justify-between gap-3 px-3.5 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <FigmaAvatar
                            avatarId={entry.avatarId ?? 2}
                            size={36}
                            ringColor={entry.color ?? '#1cb0f6'}
                            isBot={entry.partnerId === MIYU_BOT_ID}
                          />
                          <div className="min-w-0 leading-tight">
                            <p
                              className="truncate text-[15px] font-black"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {entry.partnerName}
                            </p>
                            <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                              {t('profile.duoStreakBest', { best: entry.bestStreak })}
                            </p>
                          </div>
                        </div>
                        <span
                          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black"
                          style={{
                            backgroundColor:
                              activeDays > 0 ? 'var(--duo-orange-bg)' : 'var(--bg-muted)',
                            color: activeDays > 0 ? 'var(--duo-orange-shadow)' : 'var(--text-muted)',
                          }}
                        >
                          <FigmaFlameIcon size={13} />
                          {t('profile.duoStreakDays', { days: activeDays })}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Lexique personnel ("Pokédex des Mots") */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3
                className="flex items-center gap-1.5 text-sm font-black uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                <BookOpen className="h-4 w-4 text-[var(--duo-blue)]" />
                {t('profile.sectionLexicon')}
              </h3>
              <span className="text-xs font-black" style={{ color: 'var(--duo-blue-text)' }}>
                {t('profile.lexiconCount', {
                  count: profile.uniqueWordsUsed.length,
                  total: totalDictWords,
                })}
              </span>
            </div>

            <div className="duo-card p-3.5">
              <div
                className="h-2.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--bg-muted)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      profile.uniqueWordsUsed.length > 0
                        ? Math.max(
                            3,
                            Math.min(
                              100,
                              Math.round(
                                (profile.uniqueWordsUsed.length / Math.max(1, totalDictWords)) * 100
                              )
                            )
                          )
                        : 0
                    }%`,
                    backgroundColor: 'var(--duo-blue)',
                  }}
                />
              </div>

              {rarestWords.length === 0 ? (
                <p
                  className="mt-3 text-center text-xs font-bold"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {t('profile.lexiconEmpty')}
                </p>
              ) : (
                <div className="mt-3">
                  <p
                    className="mb-2 text-xs font-black uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {t('profile.lexiconRarest')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {rarestWords.map((word, index) => (
                      <span
                        key={word}
                        className="inline-flex items-center gap-1 rounded-xl border-2 px-2.5 py-1 text-xs font-black tracking-wider"
                        style={
                          index < 3
                            ? {
                                backgroundColor: 'var(--duo-gold-bg)',
                                borderColor: 'var(--duo-gold)',
                                color: 'var(--duo-gold-text)',
                              }
                            : {
                                backgroundColor: 'var(--bg-muted)',
                                borderColor: 'var(--border-tile)',
                                color: 'var(--text-primary)',
                              }
                        }
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Journal des chaînes */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3
                className="text-sm font-black uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('profile.recentChains')}
              </h3>
              {savedCount > 0 && (
                <span
                  className="text-[13px] font-extrabold"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {t(isPlural(savedCount, locale) ? 'profile.savedMany' : 'profile.savedOne', {
                    count: savedCount,
                  })}
                </span>
              )}
            </div>

            {savedCount === 0 ? (
              <div className="duo-card p-5 text-center">
                <p className="text-base font-black" style={{ color: 'var(--text-primary)' }}>
                  {t('profile.emptyChainsTitle')}
                </p>
                <p className="mt-1 text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
                  {t('profile.emptyChainsSub')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {profile.savedBestChains.map((chain) => (
                  <SavedChainCard key={chain.id} chain={chain} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Contenu Onglet 3 : Vestiaire & Boutique Cosmétique (zéro argent réel) */}
      {activeTab === 'shop' && (
        <section className="mt-5 space-y-6">
          {shopNotice && (
            <div
              className="animate-pop-in rounded-2xl p-3 text-center text-[13px] font-black"
              style={{ backgroundColor: 'var(--duo-blue-bg)', color: 'var(--duo-blue-text)' }}
            >
              {shopNotice}
            </div>
          )}

          {/* Survie & Bonus : Gel de Série */}
          <div>
            <h3
              className="mb-3 text-[13px] font-black uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('profile.sectionPowerUps')}
            </h3>
            <div className="duo-card flex items-center justify-between gap-3 p-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: 'var(--duo-blue-bg)',
                    color: 'var(--duo-blue)',
                  }}
                >
                  <Snowflake className="h-6 w-6 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-[15px] font-black" style={{ color: 'var(--text-primary)' }}>
                      {t('profile.freezeName')}
                    </h4>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black"
                      style={{
                        backgroundColor: 'var(--duo-blue-bg)',
                        color: 'var(--duo-blue-text)',
                      }}
                    >
                      {t('profile.freezeOwned', { count: freezeCount, max: MAX_STREAK_FREEZES })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                    {t('profile.freezeDesc')}
                  </p>
                </div>
              </div>
              {freezeCount >= MAX_STREAK_FREEZES ? (
                <span
                  className="shrink-0 rounded-xl px-3 py-2 text-xs font-black uppercase"
                  style={{
                    backgroundColor: 'var(--duo-green-bg)',
                    color: 'var(--duo-green-text)',
                  }}
                >
                  {t('profile.freezeMaxed')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleBuyFreeze}
                  className="duo-btn duo-btn-gold flex shrink-0 items-center gap-1 px-3.5 py-2.5 text-sm"
                >
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {STREAK_FREEZE_PRICE}
                </button>
              )}
            </div>
          </div>

          {/* Thèmes : aperçus miniatures du plateau */}
          <div>
            <h3
              className="mb-3 text-[13px] font-black uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('profile.sectionThemes')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {themeShopItems.map((item) => {
                const unlocked = profile.unlockedThemes.includes(item.id);
                const active = profile.activeTheme === item.id;
                return (
                  <div
                    key={item.id}
                    className="duo-card flex flex-col p-2.5"
                    style={active ? { borderColor: 'var(--duo-green)' } : undefined}
                  >
                    {/* Mini plateau */}
                    <div
                      className="relative h-[88px] overflow-hidden rounded-xl"
                      style={{
                        backgroundColor: item.previewBg,
                        boxShadow: `inset 0 0 0 1.5px ${item.previewText}14`,
                      }}
                    >
                      <div
                        className="absolute left-3 right-3 top-3 h-1.5 overflow-hidden rounded-full"
                        style={{ backgroundColor: `${item.previewText}1f` }}
                      >
                        <div
                          className="h-full w-3/5 rounded-full"
                          style={{ backgroundColor: item.previewAccent }}
                        />
                      </div>
                      <div className="absolute inset-x-0 bottom-3.5 flex justify-center gap-1">
                        {['W', 'O', 'R', 'D'].map((c, i) => (
                          <span
                            key={c}
                            className="flex h-8 w-7 items-center justify-center rounded-md text-[13px] font-black"
                            style={{
                              backgroundColor: `${item.previewText}0d`,
                              border: `1.5px solid ${item.previewText}26`,
                              borderBottomWidth: 3,
                              color: i === 3 ? item.previewAccent : item.previewText,
                            }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                      {!unlocked && (
                        <span className="absolute right-2 top-5 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white">
                          <Lock className="h-3 w-3" />
                        </span>
                      )}
                    </div>

                    <p
                      className="mt-2.5 truncate px-0.5 text-[15px] font-black"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {item.name}
                    </p>

                    <div className="mt-2">
                      {active ? (
                        <span
                          className="flex h-10 w-full items-center justify-center gap-1 rounded-xl text-sm font-black uppercase tracking-wide"
                          style={{ color: 'var(--duo-green-text)' }}
                        >
                          <Check className="h-4 w-4 stroke-[3]" />
                          {t('profile.equipped')}
                        </span>
                      ) : unlocked ? (
                        <button
                          type="button"
                          onClick={() => handleThemeAction(item.id, 0, item.name)}
                          className="duo-btn duo-btn-white h-10 w-full text-sm uppercase tracking-wide"
                        >
                          {t('profile.equip')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleThemeAction(item.id, item.priceStars, item.name)}
                          className="duo-btn duo-btn-gold flex h-10 w-full items-center justify-center gap-1 text-sm"
                        >
                          <Star className="h-3.5 w-3.5 fill-current" />
                          {item.priceStars}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Effets de célébration */}
          <div>
            <h3
              className="mb-3 text-sm font-black uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('profile.sectionVictoryEffects')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {particleShopItems.map((item) => {
                const unlocked = profile.unlockedParticles.includes(item.id);
                const active = profile.activeParticle === item.id;
                const visual = PARTICLE_VISUALS[item.id];
                const Icon = visual.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      handleParticleAction(item.id, unlocked ? 0 : item.priceStars, item.name)
                    }
                    className="duo-card flex items-center gap-3 p-3 text-left transition active:translate-y-0.5"
                    style={active ? { borderColor: 'var(--duo-green)' } : undefined}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${visual.color}1f` }}
                    >
                      <Icon
                        className="h-5 w-5"
                        style={{
                          color: visual.color,
                          fill: visual.filled ? visual.color : 'none',
                        }}
                      />
                    </span>
                    <span className="min-w-0">
                      <span
                        className="block truncate text-[15px] font-black"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {t(`particle.${item.id}.short` as TranslationKey)}
                      </span>
                      <span
                        className="mt-0.5 flex items-center gap-1 text-[13px] font-extrabold"
                        style={{
                          color: active
                            ? 'var(--duo-green-text)'
                            : unlocked
                            ? 'var(--text-muted)'
                            : 'var(--duo-gold-text)',
                        }}
                      >
                        {active ? (
                          <>
                            <Check className="h-3 w-3 stroke-[3]" /> {t('profile.equipped')}
                          </>
                        ) : unlocked ? (
                          t('profile.equip')
                        ) : (
                          <>
                            <Star className="h-3 w-3 fill-[#ffc800] text-[#e5a400]" />
                            {item.priceStars}
                          </>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Style des tuiles */}
          <div>
            <h3
              className="mb-3 text-sm font-black uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('profile.sectionTileStyles')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {tileStyleShopItems.map((item) => {
                const unlocked = unlockedTileStyles.includes(item.id);
                const active = activeTileStyle === item.id;
                const previewStyle = TILE_PREVIEW_STYLES[item.id];
                return (
                  <div
                    key={item.id}
                    className="duo-card flex flex-col justify-between p-3"
                    style={active ? { borderColor: 'var(--duo-green)' } : undefined}
                  >
                    <div>
                      <div
                        className="flex h-16 items-center justify-center gap-1.5 rounded-xl border"
                        style={{
                          backgroundColor: 'var(--bg-muted)',
                          borderColor: 'var(--border-tile)',
                        }}
                      >
                        {['L', 'E', 'T'].map((char) => (
                          <span
                            key={char}
                            className="flex h-9 w-8 items-center justify-center rounded-lg font-black"
                            style={previewStyle}
                          >
                            {char}
                          </span>
                        ))}
                      </div>
                      <p
                        className="mt-2.5 truncate px-0.5 text-[15px] font-black"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {item.name}
                      </p>
                      <p
                        className="truncate px-0.5 text-xs font-bold"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-2.5">
                      {active ? (
                        <span
                          className="flex h-10 w-full items-center justify-center gap-1 rounded-xl text-sm font-black uppercase tracking-wide"
                          style={{ color: 'var(--duo-green-text)' }}
                        >
                          <Check className="h-4 w-4 stroke-[3]" />
                          {t('profile.equipped')}
                        </span>
                      ) : unlocked ? (
                        <button
                          type="button"
                          onClick={() => handleTileStyleAction(item.id, 0, item.name)}
                          className="duo-btn duo-btn-white h-10 w-full text-sm uppercase tracking-wide"
                        >
                          {t('profile.equip')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleTileStyleAction(item.id, item.priceStars, item.name)
                          }
                          className="duo-btn duo-btn-gold flex h-10 w-full items-center justify-center gap-1 text-sm"
                        >
                          <Star className="h-3.5 w-3.5 fill-current" />
                          {item.priceStars}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cadres d'avatar */}
          <div>
            <h3
              className="mb-3 text-sm font-black uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {t('profile.sectionAvatarFrames')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {avatarFrameShopItems.map((item) => {
                const unlocked = unlockedFrames.includes(item.id);
                const active = activeFrame === item.id;
                return (
                  <div
                    key={item.id}
                    className="duo-card flex flex-col justify-between p-3"
                    style={active ? { borderColor: 'var(--duo-green)' } : undefined}
                  >
                    <div className="flex flex-col items-center pt-1 text-center">
                      <FigmaAvatar
                        avatarId={profile.avatarId}
                        size={48}
                        ringColor={profile.color}
                        frame={item.id}
                      />
                      <p
                        className="mt-2 w-full truncate text-[15px] font-black"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {item.name}
                      </p>
                      <p
                        className="w-full truncate text-xs font-bold"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-2.5">
                      {active ? (
                        <span
                          className="flex h-10 w-full items-center justify-center gap-1 rounded-xl text-sm font-black uppercase tracking-wide"
                          style={{ color: 'var(--duo-green-text)' }}
                        >
                          <Check className="h-4 w-4 stroke-[3]" />
                          {t('profile.equipped')}
                        </span>
                      ) : unlocked ? (
                        <button
                          type="button"
                          onClick={() => handleAvatarFrameAction(item.id, 0, item.name)}
                          className="duo-btn duo-btn-white h-10 w-full text-sm uppercase tracking-wide"
                        >
                          {t('profile.equip')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleAvatarFrameAction(item.id, item.priceStars, item.name)
                          }
                          className="duo-btn duo-btn-gold flex h-10 w-full items-center justify-center gap-1 text-sm"
                        >
                          <Star className="h-3.5 w-3.5 fill-current" />
                          {item.priceStars}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
