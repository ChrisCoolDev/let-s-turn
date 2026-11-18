import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Check, Copy, Play, Shuffle, Sparkles, X } from 'lucide-react';
import { ShareIcon } from './FigmaAssets';
import { WordTiles } from './WordTiles';
import type { GameMode, GameRoom, Language, WordLength } from '../types/game';

interface CreateDuelSheetProps {
  defaultDaily?: boolean;
  onClose: () => void;
  onCreateRoom: (language: Language, wordLength: WordLength, mode: GameMode) => GameRoom;
  onEnterRoom: (roomCode: string) => void;
}

const PREVIEW_PAIRS: Record<Language, Record<WordLength, { start: string; target: string }>> = {
  EN: {
    4: { start: 'WINE', target: 'SLIM' },
    5: { start: 'HEART', target: 'SHARE' },
  },
  FR: {
    4: { start: 'VENT', target: 'SANG' },
    5: { start: 'TERRE', target: 'MERLE' },
  },
};

interface OptionTileProps {
  active: boolean;
  accentVar: '--duo-blue' | '--duo-green' | '--duo-orange';
  badge: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
}

/** Tuile de sélection tactile partagée entre les groupes d'options du duel */
const OptionTile: React.FC<OptionTileProps> = ({
  active,
  accentVar,
  badge,
  title,
  subtitle,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className="flex items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2.5 text-left transition active:translate-y-0.5"
    style={{
      backgroundColor: active
        ? `color-mix(in srgb, var(${accentVar}) 12%, var(--bg-tile))`
        : 'var(--bg-tile)',
      borderColor: active ? `var(${accentVar})` : 'var(--border-tile)',
      borderBottomWidth: active ? 5 : 4,
    }}
  >
    <span
      className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg px-1.5 text-xs font-black"
      style={{
        backgroundColor: active ? `var(${accentVar})` : 'var(--bg-muted)',
        color: active ? '#ffffff' : 'var(--text-muted)',
      }}
    >
      {badge}
    </span>
    <div className="min-w-0 leading-tight">
      <p className="text-[15px] font-black" style={{ color: 'var(--text-primary)' }}>
        {title}
      </p>
      {subtitle && (
        <p className="truncate text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
          {subtitle}
        </p>
      )}
    </div>
  </button>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    className="mb-2 block text-xs font-black uppercase tracking-wider"
    style={{ color: 'var(--text-muted)' }}
  >
    {children}
  </span>
);

export const CreateDuelSheet: React.FC<CreateDuelSheetProps> = ({
  defaultDaily = false,
  onClose,
  onCreateRoom,
  onEnterRoom,
}) => {
  const [language, setLanguage] = useState<Language>('EN');
  const [wordLength, setWordLength] = useState<WordLength>(4);
  const [isDaily, setIsDaily] = useState(defaultDaily);
  const [createdRoom, setCreatedRoom] = useState<GameRoom | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, [onClose]);

  const handleValidate = () => {
    const finalMode: GameMode = isDaily ? 'daily' : 'coop';
    const room = onCreateRoom(language, wordLength, finalMode);
    setCreatedRoom(room);
  };

  const inviteUrl = createdRoom
    ? `${window.location.origin}/join/${createdRoom.code}`
    : '';

  const scheduleCopyReset = () => {
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopyState('idle'), 2000);
  };

  const handleCopyLink = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    scheduleCopyReset();
  };

  const handleShare = async () => {
    if (!createdRoom) return;
    const shareText = `Rejoins mon défi Let's Turn (${createdRoom.startWord} → ${createdRoom.targetWord}) ! Code : ${createdRoom.code}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: "Let's Turn — Défi Duo",
          text: shareText,
          url: inviteUrl,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
      }
    }
    await handleCopyLink();
  };

  const preview = PREVIEW_PAIRS[language][wordLength];

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-duel-title"
        className="animate-sheet-up max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t-2 px-4 pb-7 pt-5 shadow-2xl sm:rounded-3xl sm:border-2 sm:p-5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-tile)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-3.5 h-1 w-10 rounded-full opacity-35 sm:hidden"
          style={{ backgroundColor: 'var(--text-muted)' }}
        />

        <div className="flex items-center justify-between">
          <h2
            id="create-duel-title"
            className="text-lg font-black"
            style={{ color: 'var(--text-primary)' }}
          >
            {createdRoom ? 'Salon prêt' : 'Configurer un duel'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-black/5"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!createdRoom ? (
          <div className="mt-4 space-y-4">
            {/* Aperçu en direct du format sélectionné */}
            <div
              className="rounded-2xl border-2 px-3 py-3.5"
              style={{
                backgroundColor: 'var(--bg-muted)',
                borderColor: 'var(--border-tile)',
              }}
            >
              <div className="flex items-center justify-center gap-2.5">
                <WordTiles
                  word={preview.start}
                  target={isDaily ? undefined : preview.target}
                  variant={isDaily ? 'mystery' : 'current'}
                  size="sm"
                />
                <ArrowRight
                  className="h-4 w-4 shrink-0 stroke-[3]"
                  style={{ color: 'var(--text-muted)' }}
                />
                <WordTiles
                  word={preview.target}
                  variant={isDaily ? 'mystery' : 'target'}
                  size="sm"
                />
              </div>
              <p
                className="mt-2.5 text-center text-[13px] font-extrabold"
                style={{ color: 'var(--text-muted)' }}
              >
                {isDaily
                  ? `Mot secret du jour · Commun pendant 24 h (${wordLength} lettres)`
                  : `Chaîne en ${wordLength} lettres · 4 à 7 coups optimaux`}
              </p>
            </div>

            {/* Langue du dictionnaire */}
            <div>
              <SectionLabel>Langue</SectionLabel>
              <div className="grid grid-cols-2 gap-2.5">
                <OptionTile
                  active={language === 'EN'}
                  accentVar="--duo-blue"
                  badge="EN"
                  title="Anglais"
                  onClick={() => setLanguage('EN')}
                />
                <OptionTile
                  active={language === 'FR'}
                  accentVar="--duo-blue"
                  badge="FR"
                  title="Français"
                  onClick={() => setLanguage('FR')}
                />
              </div>
            </div>

            {/* Longueur des mots */}
            <div>
              <SectionLabel>Longueur</SectionLabel>
              <div className="grid grid-cols-2 gap-2.5">
                <OptionTile
                  active={wordLength === 4}
                  accentVar="--duo-green"
                  badge="4"
                  title="4 lettres"
                  subtitle="Parties rapides"
                  onClick={() => setWordLength(4)}
                />
                <OptionTile
                  active={wordLength === 5}
                  accentVar="--duo-green"
                  badge="5"
                  title="5 lettres"
                  subtitle="Plus corsé"
                  onClick={() => setWordLength(5)}
                />
              </div>
            </div>

            {/* Format de partie */}
            <div>
              <SectionLabel>Format</SectionLabel>
              <div className="grid grid-cols-2 gap-2.5">
                <OptionTile
                  active={!isDaily}
                  accentVar="--duo-green"
                  badge={<Shuffle className="h-3.5 w-3.5 stroke-[2.5]" />}
                  title="Aléatoire"
                  subtitle="Nouvelle paire"
                  onClick={() => setIsDaily(false)}
                />
                <OptionTile
                  active={isDaily}
                  accentVar="--duo-orange"
                  badge={<Sparkles className="h-3.5 w-3.5 stroke-[2.5]" />}
                  title="Du jour"
                  subtitle="Commun 24 h"
                  onClick={() => setIsDaily(true)}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleValidate}
              className="duo-btn duo-btn-green flex w-full items-center justify-center gap-2 py-3.5 text-sm"
            >
              {isDaily ? 'Ouvrir le défi du jour' : 'Créer le duel'}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Carte du salon créé */}
            <div
              className="duo-card p-4"
              style={{
                borderColor: 'var(--duo-green)',
                backgroundColor: 'color-mix(in srgb, var(--duo-green) 7%, var(--bg-surface))',
              }}
            >
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider">
                <span style={{ color: 'var(--text-muted)' }}>
                  {createdRoom.mode === 'daily'
                    ? `Défi du jour · ${createdRoom.wordLength} lettres`
                    : `${createdRoom.language === 'FR' ? 'Français' : 'Anglais'} · ${
                        createdRoom.wordLength
                      } lettres`}
                </span>
                <span style={{ color: 'var(--duo-green-shadow)' }}>
                  Par {createdRoom.optimalPar} coups
                </span>
              </div>

              <div className="mt-4 flex flex-col items-center gap-2">
                <WordTiles
                  word={createdRoom.startWord}
                  target={createdRoom.targetWord}
                  size="lg"
                />
                <ArrowDown
                  className="h-4 w-4 stroke-[3]"
                  style={{ color: 'var(--text-muted)' }}
                />
                <WordTiles word={createdRoom.targetWord} variant="target" size="lg" />
              </div>

              {/* Code du salon cliquable pour copier le lien */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="mt-4 flex w-full items-center justify-between rounded-xl border-2 px-3.5 py-2.5 transition active:scale-[0.99]"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-tile)',
                }}
              >
                <div className="text-left leading-tight">
                  <span
                    className="block text-[10px] font-black uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Code du salon
                  </span>
                  <span
                    className="text-sm font-black tracking-widest"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {createdRoom.code}
                  </span>
                </div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black"
                  style={{
                    backgroundColor:
                      copyState === 'copied'
                        ? 'color-mix(in srgb, var(--duo-green) 16%, transparent)'
                        : 'var(--bg-muted)',
                    color:
                      copyState === 'copied'
                        ? 'var(--duo-green-shadow)'
                        : 'var(--text-primary)',
                  }}
                >
                  {copyState === 'copied' ? (
                    <>
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                      Copié
                    </>
                  ) : copyState === 'failed' ? (
                    'Copie bloquée'
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copier le lien
                    </>
                  )}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-2.5">
              <button
                type="button"
                onClick={handleShare}
                className="duo-btn duo-btn-white flex items-center justify-center gap-2 px-4 py-3.5 text-sm"
                aria-label="Partager l'invitation"
              >
                <ShareIcon className="h-4 w-4" />
                Inviter
              </button>

              <button
                type="button"
                onClick={() => onEnterRoom(createdRoom.code)}
                className="duo-btn duo-btn-green flex items-center justify-center gap-2 py-3.5 text-sm"
              >
                <Play className="h-4 w-4 fill-white" />
                Jouer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
