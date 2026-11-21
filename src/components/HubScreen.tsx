import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BellRing,
  Check,
  Gift,
  Hash,
  HelpCircle,
  Plus,
  Snowflake,
  Star,
  Swords,
  X,
} from 'lucide-react';
import { FigmaAvatar, FigmaFlameIcon } from './FigmaAssets';
import { WordTiles } from './WordTiles';
import {
  computeDuelScores,
  DAILY_CHEST_STARS,
  DAILY_CHEST_XP,
  ensureTodayQuests,
  getActiveDuoStreak,
  getLevelInfo,
} from '../engine/gamification';
import { useI18n, type TranslationKey } from '../i18n';
import {
  getRoomTurnTimeoutMs,
  isWaitingPartner,
  resolveRoomParticipants,
} from '../services/multiplayer';
import { PwaInstallBanner } from './PwaInstallBanner';
import type { DailyQuest, GameRoom, PlayerProfile, QuestTier } from '../types/game';

interface HubScreenProps {
  profile: PlayerProfile;
  rooms: GameRoom[];
  joinNotice?: string | null;
  onDismissJoinNotice?: () => void;
  onOpenRoom: (roomCode: string) => void;
  onOpenCreateDuel: (daily?: boolean) => void;
  onJoinByCode: (code: string) => Promise<void> | void;
  onOpenCollection: () => void;
  onStartTour?: () => void;
  onClaimQuest?: (questId: string) => void;
  onClaimChest?: () => void;
  nudgedRooms?: Record<string, number>;
  onNudgeRoom?: (room: GameRoom) => void;
}

function isSameLocalDay(timestampMs: number): boolean {
  const d = new Date(timestampMs);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

interface DailyChallengeCardProps {
  dailyRoom?: GameRoom;
  todayLabel: string;
  onPress: () => void;
}

const DailyChallengeCard: React.FC<DailyChallengeCardProps> = ({
  dailyRoom,
  todayLabel,
  onPress,
}) => {
  const { t, formatMoves } = useI18n();
  const isCompleted = dailyRoom?.status === 'completed';
  const isActive = dailyRoom?.status === 'active';
  const moves = dailyRoom ? dailyRoom.moves.length + dailyRoom.undoPenaltyCount : 0;
  const accentColor = isCompleted ? 'var(--duo-green)' : 'var(--duo-orange)';
  const accentShadow = isCompleted ? 'var(--duo-green-shadow)' : 'var(--duo-orange-shadow)';

  return (
    <button
      type="button"
      onClick={onPress}
      data-tour="hub-daily"
      className="duo-card mt-5 w-full p-4 text-left transition active:translate-y-0.5"
      style={{
        borderColor: accentColor,
        backgroundColor: `color-mix(in srgb, ${accentColor} 7%, var(--bg-surface))`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `color-mix(in srgb, ${accentColor} 16%, transparent)`,
            }}
          >
            <FigmaFlameIcon size={20} />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-1.5">
              <span
                className="truncate text-[17px] font-black"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('hub.dailyTitle')}
              </span>
              <span
                className="shrink-0 rounded-md px-2 py-0.5 text-xs font-black uppercase"
                style={{
                  backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
                  color: accentShadow,
                }}
              >
                {todayLabel}
              </span>
            </div>
            <p
              className="mt-0.5 truncate text-sm font-bold"
              style={{ color: 'var(--text-muted)' }}
            >
              {isCompleted && dailyRoom
                ? t('hub.dailyCompleted', {
                    moves: formatMoves(moves),
                    par: dailyRoom.optimalPar,
                  })
                : isActive && dailyRoom
                ? `${
                    dailyRoom.language === 'FR' ? t('common.french') : t('common.english')
                  } · ${t('common.letters', { count: dailyRoom.wordLength })}`
                : t('hub.dailySubtitleEmpty')}
            </p>
          </div>
        </div>

        {isCompleted ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-black uppercase tracking-wide"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--duo-green) 16%, transparent)',
              color: 'var(--duo-green-shadow)',
            }}
          >
            <Check className="h-4 w-4 stroke-[3]" />
            {t('common.done')}
          </span>
        ) : (
          <span
            className="shrink-0 rounded-xl px-3.5 py-2 text-sm font-black uppercase tracking-wide text-white"
            style={{
              backgroundColor: 'var(--duo-orange)',
              boxShadow: '0 3px 0 var(--duo-orange-shadow)',
            }}
          >
            {isActive ? t('common.resume') : t('common.play')}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2.5">
        {dailyRoom ? (
          <>
            <WordTiles word={dailyRoom.currentWord} target={dailyRoom.targetWord} size="sm" />
            <ArrowRight
              className="h-4 w-4 shrink-0 stroke-[3]"
              style={{ color: 'var(--text-muted)' }}
            />
            <WordTiles word={dailyRoom.targetWord} variant="target" size="sm" />
          </>
        ) : (
          <>
            <WordTiles word="????" variant="mystery" size="sm" />
            <ArrowRight
              className="h-4 w-4 shrink-0 stroke-[3]"
              style={{ color: 'var(--text-muted)' }}
            />
            <WordTiles word="????" variant="mystery" size="sm" />
          </>
        )}
      </div>
    </button>
  );
};

export const HubScreen: React.FC<HubScreenProps> = ({
  profile,
  rooms,
  joinNotice,
  onDismissJoinNotice,
  onOpenRoom,
  onOpenCreateDuel,
  onJoinByCode,
  onOpenCollection,
  onStartTour,
  onClaimQuest,
  onClaimChest,
  nudgedRooms = {},
  onNudgeRoom,
}) => {
  const { locale, t, intlLocale, formatMoves } = useI18n();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [now, setNow] = useState<number>(() => Date.now());

  const levelInfo = getLevelInfo(profile.xp, locale);
  const questState = ensureTodayQuests(profile);
  const completedQuestsCount = questState.quests.filter((q) => q.progress >= q.target).length;
  const allQuestsDone = completedQuestsCount === questState.quests.length;
  const freezeCount = profile.streakFreezes ?? 0;

  const activeRooms = rooms
    .filter((r) => r.status === 'active')
    .sort((a, b) => {
      const aMyTurn = resolveRoomParticipants(a, profile).isMyTurn ? 1 : 0;
      const bMyTurn = resolveRoomParticipants(b, profile).isMyTurn ? 1 : 0;
      if (aMyTurn !== bMyTurn) return bMyTurn - aMyTurn;
      return b.startedAt - a.startedAt;
    });

  const hasMultiplayerTurn = activeRooms.some(
    (r) => !r.autoPartnerEnabled && !isWaitingPartner(r.partnerPlayer.playerId)
  );

  useEffect(() => {
    if (!hasMultiplayerTurn) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [hasMultiplayerTurn]);

  const completedCount = rooms.filter((r) => r.status === 'completed').length;

  const todayDailyRoom = rooms
    .filter((r) => r.mode === 'daily' && isSameLocalDay(r.startedAt))
    .sort((a, b) => {
      const aActive = a.status === 'active' ? 1 : 0;
      const bActive = b.status === 'active' ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return b.startedAt - a.startedAt;
    })[0];

  const todayLabel = new Intl.DateTimeFormat(intlLocale, {
    day: 'numeric',
    month: 'short',
  }).format(new Date());

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (cleaned.length < 4) {
      setJoinError(t('hub.joinError'));
      return;
    }
    setShowJoinModal(false);
    setJoinCode('');
    onJoinByCode(cleaned);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-8 pt-5">
      {/* Zone 1 : En-tête (Profil & Progression) */}
      <header data-tour="hub-profile" className="duo-card flex items-center justify-between gap-3 p-3.5">
        <button
          type="button"
          onClick={onOpenCollection}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <FigmaAvatar
            avatarId={profile.avatarId}
            size={48}
            ringColor={profile.color}
            frame={profile.activeFrame}
            onlineDot
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-lg font-black" style={{ color: 'var(--text-primary)' }}>
                {profile.name}
              </span>
              <span className="rounded-full bg-[var(--duo-blue-bg)] px-2 py-0.5 text-xs font-black text-[var(--duo-blue-text)]">
                {t('common.levelShort', { level: levelInfo.level })}
              </span>
            </div>
            <p className="truncate text-sm font-extrabold text-[var(--text-muted)]">
              {levelInfo.title}
            </p>
          </div>
        </button>

        {/* Compteur Streaks & Étoiles */}
        <div className="flex shrink-0 items-center gap-2">
          <div
            className="flex items-center gap-1 rounded-xl border-2 border-[var(--border-tile)] px-2.5 py-1.5"
            title={t('hub.streakTooltip')}
          >
            <FigmaFlameIcon size={18} />
            <span className="text-base font-black" style={{ color: 'var(--text-primary)' }}>
              {profile.streak}
            </span>
          </div>
          {freezeCount > 0 && (
            <button
              type="button"
              onClick={onOpenCollection}
              className="flex items-center gap-1 rounded-xl border-2 px-2 py-1.5 transition active:scale-95"
              style={{
                borderColor: 'var(--duo-blue)',
                backgroundColor: 'var(--duo-blue-bg)',
                color: 'var(--duo-blue-text)',
              }}
              title={t('hub.freezeTooltip', { count: freezeCount })}
            >
              <Snowflake className="h-3.5 w-3.5 stroke-[2.75]" />
              <span className="text-xs font-black">{freezeCount}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenCollection}
            className="flex items-center gap-1 rounded-xl border-2 border-[var(--duo-gold)] bg-[var(--duo-gold-bg)] px-2.5 py-1.5 transition active:scale-95"
            title={t('hub.starsTooltip')}
          >
            <Star className="h-4 w-4 fill-[#ffc800] text-[#e5a400]" />
            <span className="text-base font-black text-[var(--duo-gold-text)]">{profile.stars}</span>
          </button>
          <button
            type="button"
            onClick={onOpenCollection}
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[var(--border-tile)] text-[var(--text-muted)] hover:text-[var(--duo-blue)]"
            aria-label={t('hub.collectionAria')}
            title={t('hub.collectionTooltip')}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-[18px] w-[18px]"
              aria-hidden="true"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
                d="M12 17a6.5 6.5 0 0 1-6.5-6.5V4.556c0-.519 0-.778.094-.979a1 1 0 0 1 .483-.483C6.278 3 6.537 3 7.056 3h9.888c.519 0 .778 0 .979.094a1 1 0 0 1 .483.483c.094.201.094.46.094.979V10.5A6.5 6.5 0 0 1 12 17m0 0v4m5 0H7M22 5v5M2 5v5"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Mini barre XP du niveau */}
      <div className="mt-3.5 px-1">
        <div className="mb-1 flex items-center justify-between text-sm font-extrabold text-[var(--text-muted)]">
          <span>{t('hub.xpProgress')}</span>
          <span>
            {levelInfo.currentLevelXp} / {levelInfo.nextLevelXp} XP
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <div
            className="relative h-full rounded-full bg-[var(--duo-green)] transition-all duration-500"
            style={{ width: `${Math.max(8, levelInfo.progressPct)}%` }}
          >
            <div className="mx-2 mt-0.5 h-1 rounded-full bg-white/30" />
          </div>
        </div>
      </div>

      {/* Alerte éventuelle (ex : salon complet) */}
      {joinNotice && (
        <div
          role="alert"
          className="animate-pop-in mt-3.5 flex items-center justify-between gap-2 rounded-2xl border-2 border-[var(--duo-red)] bg-[var(--duo-red-bg)] px-4 py-2.5 text-sm font-extrabold text-[var(--duo-red-text)]"
        >
          <span>{joinNotice}</span>
          {onDismissJoinNotice && (
            <button
              type="button"
              onClick={onDismissJoinNotice}
              className="rounded-lg p-1 hover:bg-black/5"
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Zone 2 : Parties en cours (Asynchrone & Temps réel) */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[15px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            {t('hub.activeGames', { count: activeRooms.length })}
          </h2>
          {onStartTour && (
            <button
              type="button"
              onClick={onStartTour}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--border-tile)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-black text-[var(--duo-blue-text)] transition hover:border-[var(--duo-blue)] active:scale-95"
              aria-label={t('tour.replayAria')}
              title={t('tour.replayAria')}
            >
              <HelpCircle className="h-3.5 w-3.5 stroke-[2.5]" />
              {t('tour.replayButton')}
            </button>
          )}
        </div>

        {activeRooms.length === 0 ? (
          <div data-tour="hub-active-games" className="duo-card p-5 text-center">
            <p className="text-base font-extrabold" style={{ color: 'var(--text-primary)' }}>
              {t('hub.emptyTitle')}
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--text-muted)]">
              {t('hub.emptySubtitle')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeRooms.map((room, index) => {
              const {
                me,
                partner,
                waitingForPartner: waiting,
                isBot,
                isMyTurn,
              } = resolveRoomParticipants(room, profile);
              const moves = room.moves.length + room.undoPenaltyCount;
              const overPar = moves > room.optimalPar;
              const matched = room.currentWord
                .split('')
                .filter((c, i) => c === room.targetWord[i]).length;
              const progress = Math.round((matched / room.wordLength) * 100);
              const duoStreak = !waiting ? getActiveDuoStreak(profile, partner.playerId) : 0;
              const duelScores =
                room.mode === 'duel' ? computeDuelScores(room, me.playerId) : null;
              const lastNudgeTs = nudgedRooms[room.code] ?? 0;
              const nudgeOnCooldown = now - lastNudgeTs < 60_000;
              const canNudge = !isMyTurn && !waiting && !isBot && Boolean(onNudgeRoom);

              return (
                <div
                  key={room.code}
                  role="button"
                  tabIndex={0}
                  data-tour={index === 0 ? 'hub-active-games' : undefined}
                  onClick={() => onOpenRoom(room.code)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenRoom(room.code);
                    }
                  }}
                  className="duo-card group w-full cursor-pointer p-4 text-left transition active:translate-y-0.5"
                  style={{
                    borderColor: isMyTurn ? 'var(--duo-green)' : undefined,
                  }}
                >
                  {/* En-tête : partenaire + statut */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FigmaAvatar
                        avatarId={partner.avatarId}
                        size={40}
                        ringColor={waiting ? undefined : partner.color}
                        onlineDot={!waiting && partner.online}
                        empty={waiting}
                        isBot={isBot}
                      />
                      <div className="min-w-0 leading-tight">
                        <div className="flex items-center gap-1.5">
                          <p
                            className="truncate text-[17px] font-black"
                            style={{ color: waiting ? 'var(--text-muted)' : 'var(--text-primary)' }}
                          >
                            {waiting ? t('common.waiting') : partner.name}
                          </p>
                          {duoStreak > 0 && (
                            <span
                              className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-black"
                              style={{
                                backgroundColor: 'var(--duo-orange-bg)',
                                color: 'var(--duo-orange-shadow)',
                              }}
                            >
                              <FigmaFlameIcon size={11} />
                              {t('hub.duoStreakLabel', { days: duoStreak })}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-sm font-bold text-[var(--text-muted)]">
                          {room.mode === 'duel' && (
                            <span className="mr-1.5 inline-flex items-center gap-0.5 text-[var(--duo-orange-shadow)]">
                              <Swords className="h-3 w-3" />
                              {t('hub.modeDuelTag')} ·
                            </span>
                          )}
                          {isBot && room.botDifficulty && room.botDifficulty !== 'apprentice' && (
                            <span className="mr-1.5 text-[var(--duo-blue-text)]">
                              {t(`bot.${room.botDifficulty}.title`)} ·
                            </span>
                          )}
                          {room.language === 'FR' ? t('common.french') : t('common.english')} ·{' '}
                          {t('common.letters', { count: room.wordLength })}
                        </p>
                      </div>
                    </div>

                    {isMyTurn ? (
                      <span
                        className="shrink-0 rounded-xl px-3.5 py-2 text-sm font-black uppercase tracking-wide text-white"
                        style={{
                          backgroundColor: 'var(--duo-green)',
                          boxShadow: '0 3px 0 var(--duo-green-shadow)',
                        }}
                      >
                        {t('common.play')}
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1.5 text-sm font-extrabold tabular-nums text-[var(--text-muted)]">
                        {(() => {
                          if (waiting) {
                            return (
                              <>
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: 'var(--text-muted)' }}
                                />
                                {t('common.waitingShort')}
                              </>
                            );
                          }
                          if (room.autoPartnerEnabled) {
                            return (
                              <>
                                <span className="h-1.5 w-1.5 rounded-full bg-[var(--duo-gold)]" />
                                {t('hub.theirTurn')}
                              </>
                            );
                          }
                          const remainingSec = Math.max(
                            0,
                            Math.ceil(
                              ((room.turnStartedAt ?? room.startedAt) +
                                getRoomTurnTimeoutMs(room) -
                                now) /
                                1000
                            )
                          );
                          return (
                            <>
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{
                                  backgroundColor:
                                    remainingSec <= 10 ? 'var(--duo-red)' : 'var(--duo-gold)',
                                }}
                              />
                              {remainingSec <= 20
                                ? t('hub.theirTurnCountdown', { seconds: remainingSec })
                                : t('hub.theirTurn')}
                            </>
                          );
                        })()}
                      </span>
                    )}
                  </div>

                  {/* Mot actuel → cible en mini-tuiles */}
                  <div className="mt-4 flex items-center justify-center gap-2.5">
                    <WordTiles
                      word={room.currentWord}
                      target={room.targetWord}
                      size="sm"
                    />
                    <ArrowRight className="h-4 w-4 shrink-0 stroke-[3] text-[var(--border-tile)]" />
                    <WordTiles word={room.targetWord} variant="target" size="sm" />
                  </div>

                  {/* Progression + score duel ou bouton Relancer */}
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--duo-green)] transition-all duration-500"
                        style={{ width: `${Math.max(6, progress)}%` }}
                      />
                    </div>
                    {duelScores ? (
                      <span className="shrink-0 text-xs font-black text-[var(--duo-orange-shadow)]">
                        {t('hub.duelScoreSummary', {
                          me: duelScores.myScore,
                          partner: duelScores.opponentScore,
                        })}
                      </span>
                    ) : (
                      <span
                        className={`shrink-0 text-sm font-extrabold ${
                          overPar ? 'text-[var(--duo-orange)]' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {formatMoves(moves)} · {t('common.parShort', { par: room.optimalPar })}
                      </span>
                    )}
                    {canNudge && (
                      <button
                        type="button"
                        disabled={nudgeOnCooldown}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNudgeRoom?.(room);
                        }}
                        className={`inline-flex shrink-0 items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-black transition ${
                          nudgeOnCooldown
                            ? 'border-[var(--border-tile)] bg-[var(--bg-muted)] text-[var(--text-muted)]'
                            : 'border-[var(--duo-blue)] bg-[var(--duo-blue-bg)] text-[var(--duo-blue-text)] hover:opacity-90 active:scale-95'
                        }`}
                      >
                        <BellRing className="h-3 w-3" />
                        {nudgeOnCooldown ? t('hub.nudgeSent') : t('hub.nudgeButton')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Zone 3 : Zone d'action principale */}
      <section className="mt-6 space-y-3">
        <button
          type="button"
          data-tour="hub-start-duel"
          onClick={() => onOpenCreateDuel(false)}
          className="duo-btn duo-btn-green flex w-full items-center justify-center gap-2.5 py-4 text-[17px]"
        >
          <Plus className="h-5 w-5 stroke-[3]" />
          {t('hub.startDuel')}
        </button>

        <button
          type="button"
          onClick={() => {
            setJoinError('');
            setShowJoinModal(true);
          }}
          className="duo-btn duo-btn-white flex w-full items-center justify-center gap-2.5 py-4 text-base"
        >
          <Hash className="h-5 w-5 text-[var(--duo-blue)]" />
          {t('hub.joinWithCode')}
        </button>
      </section>

      {/* Défi du jour */}
      <DailyChallengeCard
        dailyRoom={todayDailyRoom}
        todayLabel={todayLabel}
        onPress={() =>
          todayDailyRoom ? onOpenRoom(todayDailyRoom.code) : onOpenCreateDuel(true)
        }
      />

      {/* Quêtes du jour & Coffre quotidien */}
      <section className="duo-card mt-5 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            {t('quests.title')}
          </h2>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-black"
            style={{
              backgroundColor: allQuestsDone ? 'var(--duo-green-bg)' : 'var(--bg-muted)',
              color: allQuestsDone ? 'var(--duo-green-text)' : 'var(--text-muted)',
            }}
          >
            {t('quests.completedCount', {
              done: completedQuestsCount,
              total: questState.quests.length,
            })}
          </span>
        </div>

        <div className="mt-3 space-y-2.5">
          {questState.quests.map((quest: DailyQuest) => {
            const done = quest.progress >= quest.target;
            const pct = Math.min(100, Math.round((quest.progress / quest.target) * 100));
            const tierColors: Record<QuestTier, { bg: string; fg: string; bar: string }> = {
              bronze: { bg: '#cd7f3222', fg: '#a15c1b', bar: '#cd7f32' },
              silver: { bg: '#94a3b828', fg: '#475569', bar: '#64748b' },
              gold: { bg: 'var(--duo-gold-bg)', fg: 'var(--duo-gold-text)', bar: 'var(--duo-gold)' },
            };
            const tc = tierColors[quest.tier];
            const label = t(`quests.kind.${quest.kind}` as TranslationKey, {
              target: quest.target,
            });

            return (
              <div
                key={quest.id}
                className="flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5"
                style={{
                  borderColor: done && !quest.claimed ? 'var(--duo-green)' : 'var(--border-tile)',
                  backgroundColor: quest.claimed
                    ? 'color-mix(in srgb, var(--duo-green) 5%, var(--bg-surface))'
                    : 'var(--bg-surface)',
                }}
              >
                <span
                  className="inline-flex h-8 min-w-11 shrink-0 items-center justify-center gap-0.5 rounded-xl px-2 text-xs font-black"
                  style={{ backgroundColor: tc.bg, color: tc.fg }}
                >
                  +{quest.rewardStars}
                  <Star className="h-3.5 w-3.5 fill-[#ffc800] text-[#e5a400]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className="truncate text-sm font-extrabold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {label}
                    </p>
                    <span className="shrink-0 text-xs font-black tabular-nums text-[var(--text-muted)]">
                      {quest.progress}/{quest.target}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: done ? 'var(--duo-green)' : tc.bar,
                      }}
                    />
                  </div>
                </div>
                {quest.claimed ? (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-black"
                    style={{
                      backgroundColor: 'var(--duo-green-bg)',
                      color: 'var(--duo-green-text)',
                    }}
                  >
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                    {t('quests.claimed')}
                  </span>
                ) : done ? (
                  <button
                    type="button"
                    onClick={() => onClaimQuest?.(quest.id)}
                    className="duo-btn duo-btn-green shrink-0 px-3 py-1.5 text-xs"
                  >
                    {t('quests.claim')}
                  </button>
                ) : (
                  <span className="shrink-0 text-[11px] font-black text-[var(--text-muted)]">
                    +{quest.rewardXp} XP
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Coffre du jour */}
        <div
          className="mt-3 flex items-center justify-between gap-3 rounded-2xl border-2 px-3.5 py-2.5"
          style={{
            borderColor: questState.chestClaimed
              ? 'var(--duo-green)'
              : allQuestsDone
              ? 'var(--duo-gold)'
              : 'var(--border-tile)',
            backgroundColor: questState.chestClaimed
              ? 'var(--duo-green-bg)'
              : allQuestsDone
              ? 'var(--duo-gold-bg)'
              : 'var(--bg-muted)',
          }}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Gift
              className="h-5 w-5 shrink-0"
              style={{
                color: questState.chestClaimed
                  ? 'var(--duo-green-text)'
                  : allQuestsDone
                  ? 'var(--duo-orange)'
                  : 'var(--text-muted)',
              }}
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-black" style={{ color: 'var(--text-primary)' }}>
                {t('quests.chestTitle')}
              </p>
              <p className="truncate text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                {questState.chestClaimed ? t('quests.chestClaimed') : t('quests.chestDesc')}
              </p>
            </div>
          </div>

          {questState.chestClaimed ? (
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--duo-green-text)' }}
            >
              <Check className="h-4 w-4 stroke-[3]" />
            </span>
          ) : allQuestsDone ? (
            <button
              type="button"
              onClick={() => onClaimChest?.()}
              className="duo-btn duo-btn-gold inline-flex shrink-0 items-center gap-1 px-3 py-2 text-xs"
            >
              <span>{t('quests.chestOpen')}</span>
              <span>(+{DAILY_CHEST_STARS}</span>
              <Star className="h-3.5 w-3.5 fill-current" />
              <span>· +{DAILY_CHEST_XP} XP)</span>
            </button>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-black text-[var(--duo-gold-text)]">
              +{DAILY_CHEST_STARS}
              <Star className="h-3.5 w-3.5 fill-[#ffc800] text-[#e5a400]" />
            </span>
          )}
        </div>
      </section>

      <PwaInstallBanner />

      {/* Modale Rejoindre avec un code */}
      {showJoinModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setShowJoinModal(false)}
        >
          <div
            className="duo-card animate-pop-in w-full max-w-sm p-5"
            style={{ backgroundColor: 'var(--bg-surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>
                {t('hub.joinModalTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="rounded-full p-1 text-[var(--text-muted)] hover:bg-black/5"
                aria-label={t('common.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm font-bold text-[var(--text-muted)]">
              {t('hub.joinModalHint')}
            </p>

            <form onSubmit={handleJoinSubmit} className="mt-4 space-y-4">
              <input
                type="text"
                maxLength={16}
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase());
                  if (joinError) setJoinError('');
                }}
                placeholder="WINE-42"
                className="w-full rounded-2xl border-2 border-[var(--border-tile)] bg-[var(--bg-muted)] px-4 py-3.5 text-center text-xl font-black tracking-widest text-[var(--text-primary)] uppercase outline-none focus:border-[var(--duo-blue)] focus:bg-[var(--bg-surface)]"
                autoFocus
              />
              {joinError && (
                <p className="text-center text-sm font-extrabold text-[var(--duo-red-text)]">
                  {joinError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setJoinCode('WINE-42')}
                  className="duo-btn duo-btn-white flex-1 py-3 text-[13px]"
                >
                  {t('hub.tryDemo')}
                </button>
                <button type="submit" className="duo-btn duo-btn-blue flex-1 py-3 text-[13px]">
                  {t('hub.joinSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
