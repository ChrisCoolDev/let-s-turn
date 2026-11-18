import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Hash,
  Plus,
  Star,
  X,
} from 'lucide-react';
import { FigmaAvatar, FigmaFlameIcon } from './FigmaAssets';
import { WordTiles } from './WordTiles';
import { getLevelInfo } from '../engine/gamification';
import { TURN_TIMEOUT_MS } from '../services/multiplayer';
import { PwaInstallBanner } from './PwaInstallBanner';
import type { GameRoom, PlayerProfile } from '../types/game';

interface HubScreenProps {
  profile: PlayerProfile;
  rooms: GameRoom[];
  onOpenRoom: (roomCode: string) => void;
  onOpenCreateDuel: (daily?: boolean) => void;
  onJoinByCode: (code: string) => void;
  onOpenCollection: () => void;
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
  const isCompleted = dailyRoom?.status === 'completed';
  const isActive = dailyRoom?.status === 'active';
  const moves = dailyRoom ? dailyRoom.moves.length + dailyRoom.undoPenaltyCount : 0;
  const accentColor = isCompleted ? 'var(--duo-green)' : 'var(--duo-orange)';
  const accentShadow = isCompleted ? 'var(--duo-green-shadow)' : 'var(--duo-orange-shadow)';

  return (
    <button
      type="button"
      onClick={onPress}
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
                className="truncate text-base font-black"
                style={{ color: 'var(--text-primary)' }}
              >
                Défi du jour
              </span>
              <span
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-black uppercase"
                style={{
                  backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
                  color: accentShadow,
                }}
              >
                {todayLabel}
              </span>
            </div>
            <p
              className="mt-0.5 truncate text-[13px] font-bold"
              style={{ color: 'var(--text-muted)' }}
            >
              {isCompleted && dailyRoom
                ? `Réussi en ${moves} coup${moves > 1 ? 's' : ''} · par ${dailyRoom.optimalPar}`
                : isActive && dailyRoom
                ? `${dailyRoom.language === 'FR' ? 'Français' : 'Anglais'} · ${
                    dailyRoom.wordLength
                  } lettres`
                : 'Un mot commun chaque jour'}
            </p>
          </div>
        </div>

        {isCompleted ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-[13px] font-black uppercase tracking-wide"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--duo-green) 16%, transparent)',
              color: 'var(--duo-green-shadow)',
            }}
          >
            <Check className="h-3.5 w-3.5 stroke-[3]" />
            Fini
          </span>
        ) : (
          <span
            className="shrink-0 rounded-xl px-3.5 py-1.5 text-[13px] font-black uppercase tracking-wide text-white"
            style={{
              backgroundColor: 'var(--duo-orange)',
              boxShadow: '0 3px 0 var(--duo-orange-shadow)',
            }}
          >
            {isActive ? 'Reprendre' : 'Jouer'}
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
  onOpenRoom,
  onOpenCreateDuel,
  onJoinByCode,
  onOpenCollection,
}) => {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [now, setNow] = useState<number>(() => Date.now());

  const levelInfo = getLevelInfo(profile.xp);

  const activeRooms = rooms
    .filter((r) => r.status === 'active')
    .sort((a, b) => {
      const aMyTurn = a.currentTurnPlayerId === profile.playerId ? 1 : 0;
      const bMyTurn = b.currentTurnPlayerId === profile.playerId ? 1 : 0;
      if (aMyTurn !== bMyTurn) return bMyTurn - aMyTurn;
      return b.startedAt - a.startedAt;
    });

  const hasMultiplayerTurn = activeRooms.some((r) => !r.autoPartnerEnabled);

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

  const todayLabel = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date());

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (cleaned.length < 4) {
      setJoinError('Entre un code valide (ex : WINE-42 ou 4 lettres)');
      return;
    }
    setShowJoinModal(false);
    setJoinCode('');
    onJoinByCode(cleaned);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-4 pb-8 pt-5">
      {/* Zone 1 : En-tête (Profil & Progression) */}
      <header className="duo-card flex items-center justify-between gap-3 p-3.5">
        <button
          type="button"
          onClick={onOpenCollection}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <FigmaAvatar avatarId={profile.avatarId} size={46} ringColor={profile.color} onlineDot />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[17px] font-black" style={{ color: 'var(--text-primary)' }}>
                {profile.name}
              </span>
              <span className="rounded-full bg-[var(--duo-blue-bg)] px-2 py-0.5 text-[11px] font-black text-[var(--duo-blue-text)]">
                Niv. {levelInfo.level}
              </span>
            </div>
            <p className="truncate text-[13px] font-extrabold text-[var(--text-muted)]">
              {levelInfo.title}
            </p>
          </div>
        </button>

        {/* Compteur Streaks & Étoiles */}
        <div className="flex shrink-0 items-center gap-2">
          <div
            className="flex items-center gap-1 rounded-xl border-2 border-[var(--border-tile)] px-2.5 py-1.5"
            title="Jours consécutifs joués en duo"
          >
            <FigmaFlameIcon size={18} />
            <span className="text-[15px] font-black" style={{ color: 'var(--text-primary)' }}>
              {profile.streak}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenCollection}
            className="flex items-center gap-1 rounded-xl border-2 border-[var(--duo-gold)] bg-[var(--duo-gold-bg)] px-2.5 py-1.5 transition active:scale-95"
            title="Étoiles & Boutique"
          >
            <Star className="h-4 w-4 fill-[#ffc800] text-[#e5a400]" />
            <span className="text-[15px] font-black text-[var(--duo-gold-text)]">{profile.stars}</span>
          </button>
          <button
            type="button"
            onClick={onOpenCollection}
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[var(--border-tile)] text-[var(--text-muted)] hover:text-[var(--duo-blue)]"
            aria-label="Collection & Profil"
            title="Badges, Stats & Thèmes"
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
      <div className="mt-3 px-1">
        <div className="mb-1 flex items-center justify-between text-[13px] font-extrabold text-[var(--text-muted)]">
          <span>Progression XP</span>
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

      {/* Zone 2 : Parties en cours (Asynchrone & Temps réel) */}
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[var(--text-muted)]">
            Parties en cours ({activeRooms.length})
          </h2>
          {/*{completedCount > 0 && (
            <button
              type="button"
              onClick={onOpenCollection}
              className="text-xs font-extrabold hover:underline"
              style={{ color: 'var(--duo-blue-text)' }}
            >
              {completedCount} terminée{completedCount > 1 ? 's' : ''}
            </button>
          )}*/}
        </div>

        {activeRooms.length === 0 ? (
          <div className="duo-card p-5 text-center">
            <p className="text-[15px] font-extrabold" style={{ color: 'var(--text-primary)' }}>
              Aucune partie active pour le moment
            </p>
            <p className="mt-1 text-[13px] font-bold text-[var(--text-muted)]">
              Lance un nouveau défi pour transformer un mot avec ton partenaire !
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeRooms.map((room) => {
              const isHost =
                room.hostPlayer.playerId === profile.playerId ||
                (room.partnerPlayer.playerId !== profile.playerId &&
                  room.hostPlayer.name === profile.name &&
                  room.partnerPlayer.name !== profile.name);
              const partner = isHost ? room.partnerPlayer : room.hostPlayer;
              const isMyTurn = room.currentTurnPlayerId === profile.playerId;
              const moves = room.moves.length + room.undoPenaltyCount;
              const overPar = moves > room.optimalPar;
              const matched = room.currentWord
                .split('')
                .filter((c, i) => c === room.targetWord[i]).length;
              const progress = Math.round((matched / room.wordLength) * 100);

              return (
                <button
                  key={room.code}
                  type="button"
                  onClick={() => onOpenRoom(room.code)}
                  className="duo-card group w-full p-4 text-left transition active:translate-y-0.5"
                  style={{
                    borderColor: isMyTurn ? 'var(--duo-green)' : undefined,
                  }}
                >
                  {/* En-tête : partenaire + statut */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FigmaAvatar
                        avatarId={partner.avatarId}
                        size={38}
                        ringColor={partner.color}
                        onlineDot={partner.online}
                      />
                      <div className="min-w-0 leading-tight">
                        <p
                          className="truncate text-base font-black"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {partner.name}
                        </p>
                        <p className="truncate text-[13px] font-bold text-[var(--text-muted)]">
                          {room.language === 'FR' ? 'Français' : 'Anglais'} · {room.wordLength}{' '}
                          lettres
                        </p>
                      </div>
                    </div>

                    {isMyTurn ? (
                      <span
                        className="shrink-0 rounded-xl px-3.5 py-1.5 text-[13px] font-black uppercase tracking-wide text-white"
                        style={{
                          backgroundColor: 'var(--duo-green)',
                          boxShadow: '0 3px 0 var(--duo-green-shadow)',
                        }}
                      >
                        Jouer
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-extrabold tabular-nums text-[var(--text-muted)]">
                        {(() => {
                          if (room.autoPartnerEnabled) {
                            return (
                              <>
                                <span className="h-1.5 w-1.5 rounded-full bg-[var(--duo-gold)]" />
                                Son tour
                              </>
                            );
                          }
                          const remainingSec = Math.max(
                            0,
                            Math.ceil(
                              ((room.turnStartedAt ?? room.startedAt) + TURN_TIMEOUT_MS - now) / 1000
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
                              {remainingSec <= 20 ? `Son tour · ${remainingSec}s` : 'Son tour'}
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

                  {/* Progression */}
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                      <div
                        className="h-full rounded-full bg-[var(--duo-green)] transition-all duration-500"
                        style={{ width: `${Math.max(6, progress)}%` }}
                      />
                    </div>
                    <span
                      className={`shrink-0 text-[13px] font-extrabold ${
                        overPar ? 'text-[var(--duo-orange)]' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {moves} coup{moves > 1 ? 's' : ''} · par {room.optimalPar}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Zone 3 : Zone d'action principale */}
      <section className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() => onOpenCreateDuel(false)}
          className="duo-btn duo-btn-green flex w-full items-center justify-center gap-2.5 py-4 text-base"
        >
          <Plus className="h-5 w-5 stroke-[3]" />
          Lancer un défi
        </button>

        <button
          type="button"
          onClick={() => {
            setJoinError('');
            setShowJoinModal(true);
          }}
          className="duo-btn duo-btn-white flex w-full items-center justify-center gap-2.5 py-3.5 text-[15px]"
        >
          <Hash className="h-4 w-4 text-[var(--duo-blue)]" />
          Rejoindre avec un code
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
                Rejoindre un duel
              </h3>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="rounded-full p-1 text-[var(--text-muted)] hover:bg-black/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm font-bold text-[var(--text-muted)]">
              Entre le code envoyé par ton partenaire (ex : WINE-42 ou 4 caractères).
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
                  Tester WINE-42
                </button>
                <button type="submit" className="duo-btn duo-btn-blue flex-1 py-3 text-[13px]">
                  Rejoindre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
