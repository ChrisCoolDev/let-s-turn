import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Heart,
  Lock,
  PartyPopper,
  Sparkles,
  Star,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  BADGE_DEFINITIONS,
  PARTICLE_SHOP_ITEMS,
  THEME_SHOP_ITEMS,
  getLevelInfo,
} from '../engine/gamification';
import { FigmaAvatar, FigmaBadgeIcon, FigmaFlameIcon } from './FigmaAssets';
import { WordTiles } from './WordTiles';
import type {
  ParticleEffectId,
  PlayerProfile,
  SavedChainRecord,
  ThemeId,
} from '../types/game';

function formatChainDate(timestampMs: number): string {
  const target = new Date(timestampMs);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  ).getTime();
  const diffDays = Math.round((startOfToday - startOfTarget) / 86400000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(target);
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
  const headlineStats = [
    { value: `${profile.gamesWon}`, label: 'Victoires' },
    { value: profile.gamesPlayed > 0 ? `${winRate}%` : '—', label: 'Réussite' },
    { value: profile.fastestWinSeconds ? `${profile.fastestWinSeconds}s` : '—', label: 'Record' },
    { value: `${profile.uniqueWordsUsed.length}`, label: 'Mots' },
  ];

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
        <div className="flex items-baseline justify-between gap-2 text-[13px]">
          <span className="font-extrabold" style={{ color: 'var(--text-primary)' }}>
            Victoires au Par
          </span>
          <span className="font-black tabular-nums" style={{ color: 'var(--duo-green-shadow)' }}>
            {profile.optimalWins} / {profile.gamesWon}
            <span className="ml-1 font-bold" style={{ color: 'var(--text-muted)' }}>
              ({optimalRate}%)
            </span>
          </span>
        </div>

        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full"
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

        <p className="mt-2.5 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
          {profile.noHintWins} sans indice · {profile.gamesPlayed} parties ·{' '}
          {profile.longestWordSolved} lettres max
        </p>
      </div>
    </div>
  );
};

const SavedChainCard: React.FC<{ chain: SavedChainRecord }> = ({ chain }) => {
  const isOptimal = chain.actualSteps <= chain.optimalSteps;
  const accentVar = isOptimal ? '--duo-green' : '--duo-orange';
  const accentShadowVar = isOptimal ? '--duo-green-shadow' : '--duo-orange-shadow';

  return (
    <div className="duo-card p-3.5">
      {/* Méta duo & score Par */}
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>
          Avec <span style={{ color: 'var(--text-primary)' }}>{chain.partnerName}</span> ·{' '}
          {chain.language === 'FR' ? 'FR' : 'EN'} · {formatChainDate(chain.completedAt)}
        </p>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-black"
          style={{
            backgroundColor: `color-mix(in srgb, var(${accentVar}) 15%, transparent)`,
            color: `var(${accentShadowVar})`,
          }}
        >
          {isOptimal ? (
            <>
              <Check className="h-3 w-3 stroke-[3]" />
              Par {chain.optimalSteps}
            </>
          ) : (
            `${chain.actualSteps} / Par ${chain.optimalSteps}`
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
                  className="h-3 w-3 shrink-0 stroke-[2.5]"
                  style={{ color: 'var(--text-muted)' }}
                />
              )}
              <span
                className="inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-black tracking-wider"
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
  { icon: LucideIcon; color: string; filled: boolean; label: string }
> = {
  confetti: { icon: PartyPopper, color: '#ff9600', filled: false, label: 'Confettis' },
  sparkles: { icon: Sparkles, color: '#ffc800', filled: true, label: 'Étoiles' },
  hearts: { icon: Heart, color: '#ff4b8b', filled: true, label: 'Cœurs' },
  lightning: { icon: Zap, color: '#1cb0f6', filled: true, label: 'Éclairs' },
};

interface CollectionProfileScreenProps {
  profile: PlayerProfile;
  onBack: () => void;
  onBuyOrActivateTheme: (themeId: ThemeId, priceStars: number) => boolean;
  onBuyOrActivateParticle: (particleId: ParticleEffectId, priceStars: number) => boolean;
}

export const CollectionProfileScreen: React.FC<CollectionProfileScreenProps> = ({
  profile,
  onBack,
  onBuyOrActivateTheme,
  onBuyOrActivateParticle,
}) => {
  const [activeTab, setActiveTab] = useState<'badges' | 'stats' | 'shop'>('badges');
  const [shopNotice, setShopNotice] = useState<string | null>(null);

  const levelInfo = getLevelInfo(profile.xp);
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
      setShopNotice(`Thème "${name}" activé !`);
    } else {
      setShopNotice(`Il te manque des ⭐ pour débloquer "${name}" !`);
    }
    window.setTimeout(() => setShopNotice(null), 2400);
  };

  const handleParticleAction = (particleId: ParticleEffectId, price: number, name: string) => {
    const ok = onBuyOrActivateParticle(particleId, price);
    if (ok) {
      setShopNotice(`Effet "${name}" équipé !`);
    } else {
      setShopNotice(`Il te manque des ⭐ pour débloquer "${name}" !`);
    }
    window.setTimeout(() => setShopNotice(null), 2400);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-4 pb-8 pt-4">
      {/* En-tête */}
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-xl border-2"
          style={{ borderColor: 'var(--border-tile)', color: 'var(--text-primary)' }}
          aria-label="Retour"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[19px] font-black" style={{ color: 'var(--text-primary)' }}>
          Collection &amp; Profil
        </h1>
        <div
          className="flex items-center gap-1 rounded-xl border-2 px-2.5 py-1.5"
          style={{ borderColor: 'var(--duo-gold)', backgroundColor: 'var(--duo-gold-bg)' }}
        >
          <Star className="h-4 w-4 fill-[#ffc800] text-[#e5a400]" />
          <span className="text-[15px] font-black" style={{ color: 'var(--duo-gold-text)' }}>
            {profile.stars}
          </span>
        </div>
      </header>

      {/* Carte Profil */}
      <div className="duo-card mt-4 flex items-center gap-3.5 p-4">
        <FigmaAvatar avatarId={profile.avatarId} size={60} ringColor={profile.color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[19px] font-black" style={{ color: 'var(--text-primary)' }}>
              {profile.name}
            </h2>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-black"
              style={{ backgroundColor: 'var(--duo-orange-bg)', color: 'var(--duo-orange)' }}
            >
              <FigmaFlameIcon size={13} />
              {profile.streak}j
            </span>
          </div>
          <p className="text-[13px] font-extrabold" style={{ color: 'var(--duo-blue-text)' }}>
            Niveau {levelInfo.level} · {levelInfo.title}
          </p>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full"
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

      {/* Onglets Duolingo */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { id: 'badges' as const, label: 'Badges' },
          { id: 'stats' as const, label: 'Stats Duo' },
          { id: 'shop' as const, label: 'Vestiaire' },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`duo-btn flex items-center justify-center gap-1.5 py-2.5 text-[13px] ${
                active ? 'duo-btn-blue' : 'duo-btn-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenu Onglet 1 : Mur des Badges */}
      {activeTab === 'badges' && (
        <section className="mt-4 space-y-2.5">
          <p className="text-[13px] font-extrabold" style={{ color: 'var(--text-muted)' }}>
            {profile.unlockedBadges.length} / {BADGE_DEFINITIONS.length} badges débloqués
          </p>
          {BADGE_DEFINITIONS.map((badge) => {
            const unlocked = profile.unlockedBadges.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`duo-card flex items-center gap-3.5 p-3.5 ${
                  unlocked ? '' : 'opacity-65 grayscale'
                }`}
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: unlocked ? `${badge.color}22` : 'var(--bg-muted)',
                  }}
                >
                  <FigmaBadgeIcon badgeId={badge.id} size={30} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-black" style={{ color: 'var(--text-primary)' }}>
                      {badge.title}
                    </h3>
                    {unlocked ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-black"
                        style={{
                          backgroundColor: 'var(--duo-green-bg)',
                          color: 'var(--duo-green-text)',
                        }}
                      >
                        Débloqué
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5"
                        style={{
                          backgroundColor: 'var(--bg-muted)',
                          color: 'var(--text-muted)',
                        }}
                        aria-label="Verrouillé"
                        title="Verrouillé"
                      >
                        <Lock className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>
                    {unlocked ? badge.description : badge.conditionLabel}
                  </p>
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

          {/* Journal des chaînes */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3
                className="text-[13px] font-black uppercase tracking-wider"
                style={{ color: 'var(--text-muted)' }}
              >
                Dernières chaînes
              </h3>
              {profile.savedBestChains.length > 0 && (
                <span
                  className="text-xs font-extrabold"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {profile.savedBestChains.length} enregistrée
                  {profile.savedBestChains.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {profile.savedBestChains.length === 0 ? (
              <div className="duo-card p-5 text-center">
                <p className="text-[15px] font-black" style={{ color: 'var(--text-primary)' }}>
                  Aucune chaîne enregistrée
                </p>
                <p className="mt-1 text-[13px] font-bold" style={{ color: 'var(--text-muted)' }}>
                  Termine une partie en duo pour conserver votre parcours ici.
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

          {/* Thèmes : aperçus miniatures du plateau */}
          <div>
            <h3
              className="mb-3 text-[13px] font-black uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Thèmes
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {THEME_SHOP_ITEMS.map((item) => {
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
                      className="mt-2.5 truncate px-0.5 text-sm font-black"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {item.name}
                    </p>

                    <div className="mt-2">
                      {active ? (
                        <span
                          className="flex h-9 w-full items-center justify-center gap-1 rounded-xl text-[13px] font-black uppercase tracking-wide"
                          style={{ color: 'var(--duo-green-text)' }}
                        >
                          <Check className="h-4 w-4 stroke-[3]" />
                          Équipé
                        </span>
                      ) : unlocked ? (
                        <button
                          type="button"
                          onClick={() => handleThemeAction(item.id, 0, item.name)}
                          className="duo-btn duo-btn-white h-9 w-full text-[13px] uppercase tracking-wide"
                        >
                          Équiper
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleThemeAction(item.id, item.priceStars, item.name)}
                          className="duo-btn duo-btn-gold flex h-9 w-full items-center justify-center gap-1 text-[13px]"
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
              className="mb-3 text-[13px] font-black uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Effets de victoire
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {PARTICLE_SHOP_ITEMS.map((item) => {
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
                        className="block truncate text-sm font-black"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {visual.label}
                      </span>
                      <span
                        className="mt-0.5 flex items-center gap-1 text-xs font-extrabold"
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
                            <Check className="h-3 w-3 stroke-[3]" /> Équipé
                          </>
                        ) : unlocked ? (
                          'Équiper'
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
        </section>
      )}
    </div>
  );
};
