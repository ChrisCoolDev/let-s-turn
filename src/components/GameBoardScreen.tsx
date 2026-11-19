import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Delete,
  Flag,
  History,
  Lightbulb,
  RotateCcw,
  Star,
  X,
  XCircle,
} from 'lucide-react';
import { FigmaAvatar, FigmaFlameIcon, ShareIcon } from './FigmaAssets';
import { getHintForWord, isOneLetterDiff, isValidWord } from '../engine/wordLadder';
import {
  BOT_PROPOSAL_DELAY_MS,
  broadcastTypingState,
  isBotPartner,
  isWaitingPartner,
  TURN_TIMEOUT_MS,
} from '../services/multiplayer';
import {
  fetchWordMeaning,
  getImmediateWordMeaning,
  type WordMeaningResult,
} from '../services/wordMeaning';
import type { GameRoom, PlayerProfile, WordMove } from '../types/game';

interface GameBoardScreenProps {
  room: GameRoom;
  profile: PlayerProfile;
  onBackToHub: () => void;
  onSubmitMove: (roomCode: string, nextWord: string) => void;
  onUndoMove: (roomCode: string) => void;
  onUseHint: (roomCode: string) => boolean;
  onEnableBot: (roomCode: string) => void;
  onEndGame: (roomCode: string) => void;
  onOpenVictory: (roomCode: string) => void;
}

const QWERTY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const AZERTY_ROWS = [
  ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
  ['W', 'X', 'C', 'V', 'B', 'N'],
];

export const GameBoardScreen: React.FC<GameBoardScreenProps> = ({
  room,
  profile,
  onBackToHub,
  onSubmitMove,
  onUndoMove,
  onUseHint,
  onEnableBot,
  onEndGame,
  onOpenVictory,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draftLetter, setDraftLetter] = useState<string | null>(null);
  const [shakeBoard, setShakeBoard] = useState(false);
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'error' | 'info' | 'hint' } | null>(null);
  const [hintIndex, setHintIndex] = useState<number | null>(null);
  const [hintChar, setHintChar] = useState<string | null>(null);
  const [showFullChain, setShowFullChain] = useState(false);
  const [keyboardLayout, setKeyboardLayout] = useState<'QWERTY' | 'AZERTY'>(
    room.language === 'FR' ? 'AZERTY' : 'QWERTY'
  );
  const [draftMeaning, setDraftMeaning] = useState<WordMeaningResult | null>(null);
  const [currentWordMeaning, setCurrentWordMeaning] = useState<WordMeaningResult | null>(null);
  const [showBotProposal, setShowBotProposal] = useState(false);
  const [botProposalDismissed, setBotProposalDismissed] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const [now, setNow] = useState<number>(() => Date.now());

  const toastTimerRef = useRef<number | null>(null);
  const seenTurnPassIdRef = useRef<string | null>(null);

  const isHost =
    room.hostPlayer.playerId === profile.playerId ||
    (room.partnerPlayer.playerId !== profile.playerId &&
      room.hostPlayer.name === profile.name &&
      room.partnerPlayer.name !== profile.name);
  const partner = isHost ? room.partnerPlayer : room.hostPlayer;
  const waitingForPartner = isWaitingPartner(partner.playerId);
  const isBot = isBotPartner(partner.playerId);
  const isMyTurn = room.currentTurnPlayerId === profile.playerId;
  const canPlayManually = isMyTurn;
  const hasTurnCountdown =
    room.status === 'active' &&
    !room.autoPartnerEnabled &&
    !waitingForPartner &&
    !isBot &&
    partner.playerId !== profile.playerId;
  const remainingSeconds = hasTurnCountdown
    ? Math.max(0, Math.ceil(((room.turnStartedAt ?? room.startedAt) + TURN_TIMEOUT_MS - now) / 1000))
    : 0;
  const showPartnerCountdown = hasTurnCountdown && !isMyTurn && remainingSeconds <= 20;
  const isLowTime = hasTurnCountdown && remainingSeconds <= 10;

  useEffect(() => {
    if (!waitingForPartner || room.status !== 'active' || botProposalDismissed) {
      setShowBotProposal(false);
      return;
    }
    const elapsed = Math.max(0, Date.now() - room.startedAt);
    const delay = Math.max(0, BOT_PROPOSAL_DELAY_MS - elapsed);
    const t = window.setTimeout(() => setShowBotProposal(true), delay);
    return () => window.clearTimeout(t);
  }, [waitingForPartner, room.status, room.startedAt, botProposalDismissed]);

  const showToast = useCallback(
    (text: string, tone: 'error' | 'info' | 'hint' = 'info', duration = 2600) => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      setToast({ text, tone });
      toastTimerRef.current = window.setTimeout(() => setToast(null), duration);
    },
    []
  );

  // Live countdown ticker for 2-player turn timeout
  useEffect(() => {
    if (!hasTurnCountdown) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [hasTurnCountdown, room.turnStartedAt, room.currentTurnPlayerId]);

  // Show a clear toast when a turn passes automatically after timing out
  useEffect(() => {
    const pass = room.lastTurnPass;
    if (!pass || pass.id === seenTurnPassIdRef.current) return;
    seenTurnPassIdRef.current = pass.id;
    if (Date.now() - pass.timestamp > 15_000) return;

    if (pass.toPlayerId === profile.playerId) {
      const otherName =
        pass.fromPlayerId !== profile.playerId && pass.fromPlayerName !== profile.name
          ? pass.fromPlayerName
          : partner.name;
      showToast(`${otherName} a trop tardé — à ton tour !`, 'hint', 3400);
    } else {
      const nextName =
        pass.toPlayerId !== profile.playerId && pass.toPlayerName !== profile.name
          ? pass.toPlayerName
          : partner.name;
      showToast(`Temps écoulé — le tour passe à ${nextName}`, 'info', 3400);
    }
  }, [room.lastTurnPass, profile.playerId, profile.name, partner.name, showToast]);

  // Reset local draft whenever the currentWord changes
  useEffect(() => {
    setSelectedIndex(null);
    setDraftLetter(null);
    setHintIndex(null);
    setHintChar(null);

    if (room.moves.length > 0) {
      const lastMove = room.moves[room.moves.length - 1];
      setFlippedIndex(lastMove.changedIndex);
      const t = window.setTimeout(() => setFlippedIndex(null), 420);
      return () => window.clearTimeout(t);
    }
  }, [room.currentWord, room.moves]);

  // Broadcast live typing indicator
  useEffect(() => {
    broadcastTypingState(room.code, profile.playerId, selectedIndex !== null || draftLetter !== null);
  }, [selectedIndex, draftLetter, room.code, profile.playerId]);

  const displayLetters = useMemo(() => {
    const chars = room.currentWord.split('');
    if (selectedIndex !== null && draftLetter) {
      chars[selectedIndex] = draftLetter;
    }
    return chars;
  }, [room.currentWord, selectedIndex, draftLetter]);

  const draftWord = displayLetters.join('');
  const hasDraftChange =
    selectedIndex !== null &&
    draftLetter !== null &&
    draftLetter !== room.currentWord[selectedIndex];

  const alreadyPlayedStep = useMemo(() => {
    if (!hasDraftChange) return null;
    if (draftWord === room.startWord) return 0;
    const idx = room.moves.findIndex((m) => m.word === draftWord);
    return idx !== -1 ? idx + 1 : null;
  }, [hasDraftChange, draftWord, room.startWord, room.moves]);

  // Vérification instantanée + définition API du mot en cours de composition
  useEffect(() => {
    if (!hasDraftChange) {
      setDraftMeaning(null);
      return;
    }
    const immediate = getImmediateWordMeaning(draftWord, room.language);
    setDraftMeaning(immediate);

    if (!immediate.valid || immediate.definition) return;
    const ctrl = new AbortController();
    fetchWordMeaning(draftWord, room.language, ctrl.signal).then((res) => {
      if (!ctrl.signal.aborted) setDraftMeaning(res);
    });
    return () => ctrl.abort();
  }, [hasDraftChange, draftWord, room.language]);

  // Définition du mot actuel sur le plateau
  useEffect(() => {
    const immediate = getImmediateWordMeaning(room.currentWord, room.language);
    setCurrentWordMeaning(immediate);
    if (!immediate.valid || immediate.definition) return;
    const ctrl = new AbortController();
    fetchWordMeaning(room.currentWord, room.language, ctrl.signal).then((res) => {
      if (!ctrl.signal.aborted) setCurrentWordMeaning(res);
    });
    return () => ctrl.abort();
  }, [room.currentWord, room.language]);

  const lastChangedIndex = useMemo(() => {
    if (room.moves.length === 0) return -1;
    return room.moves[room.moves.length - 1].changedIndex;
  }, [room.moves]);

  const totalMovesUsed = room.moves.length + room.undoPenaltyCount;

  // Progress bar ratio: how close to target + moves progress
  const progressPct = useMemo(() => {
    if (room.status === 'completed' || room.currentWord === room.targetWord) return 100;
    let matchingChars = 0;
    for (let i = 0; i < room.wordLength; i++) {
      if (room.currentWord[i] === room.targetWord[i]) matchingChars++;
    }
    const moveProgress = Math.min(0.7, room.moves.length / Math.max(1, room.optimalPar));
    const letterProgress = matchingChars / room.wordLength;
    return Math.max(12, Math.min(92, Math.round((moveProgress * 0.6 + letterProgress * 0.4) * 100)));
  }, [room]);

  const triggerErrorFeedback = useCallback(
    (message: string) => {
      setShakeBoard(true);
      if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
      showToast(message, 'error', 2800);
      window.setTimeout(() => {
        setShakeBoard(false);
        setDraftLetter(null);
      }, 460);
    },
    [showToast]
  );

  const handleTileSelect = (idx: number) => {
    if (room.status === 'completed') {
      onOpenVictory(room.code);
      return;
    }
    if (!canPlayManually) {
      showToast(
        waitingForPartner
          ? 'Partage le lien ou attends qu’un partenaire rejoigne !'
          : `Patiente un instant, ${partner.name} joue son coup...`,
        'info'
      );
      return;
    }
    if (selectedIndex === idx) {
      // Keep selected, clear draft if any
      setDraftLetter(null);
    } else {
      // Selecting a different tile clears previous draft so only 1 letter changes at a time
      setSelectedIndex(idx);
      setDraftLetter(null);
    }
  };

  const handleKeyPress = useCallback(
    (char: string) => {
      if (room.status === 'completed') return;
      if (!canPlayManually) {
        showToast(
          waitingForPartner
            ? 'En attente d’un partenaire pour ce coup !'
            : `C'est au tour de ${partner.name} !`,
          'info'
        );
        return;
      }
      const targetIdx = selectedIndex ?? 0;
      if (selectedIndex === null) {
        setSelectedIndex(0);
      }
      setDraftLetter(char.toUpperCase());
      setFlippedIndex(targetIdx);
      window.setTimeout(() => setFlippedIndex(null), 260);
    },
    [room.status, canPlayManually, partner.name, selectedIndex, showToast]
  );

  const handleBackspace = useCallback(() => {
    if (!canPlayManually) return;
    if (draftLetter !== null) {
      setDraftLetter(null);
    } else if (selectedIndex !== null) {
      setSelectedIndex(null);
    }
  }, [canPlayManually, draftLetter, selectedIndex]);

  const handleValidate = useCallback(() => {
    if (room.status === 'completed') {
      onOpenVictory(room.code);
      return;
    }
    if (!canPlayManually) return;
    if (!hasDraftChange) {
      showToast('Touche une tuile puis tape une nouvelle lettre !', 'info');
      return;
    }

    const candidate = draftWord.toUpperCase();

    // Verify exact 1-letter difference
    const diff = isOneLetterDiff(room.currentWord, candidate);
    if (!diff.valid) {
      triggerErrorFeedback('Tu ne peux changer qu’une seule lettre à la fois !');
      return;
    }

    // Check if word was already played in the chain (startWord or any previous move)
    if (candidate === room.startWord) {
      triggerErrorFeedback('Déjà joué au départ (étape 0) !');
      return;
    }
    const existingStepIdx = room.moves.findIndex((m) => m.word === candidate);
    if (existingStepIdx !== -1) {
      triggerErrorFeedback(`Déjà joué à l'étape ${existingStepIdx + 1} !`);
      return;
    }

    // Dictionary validation
    if (!isValidWord(candidate, room.language, room.wordLength)) {
      triggerErrorFeedback('Mot inconnu dans le dictionnaire');
      return;
    }

    // Valid move! Haptic + submit
    if (navigator.vibrate) navigator.vibrate(25);
    setDraftLetter(null);
    setSelectedIndex(null);
    onSubmitMove(room.code, candidate);
  }, [
    room.status,
    room.code,
    room.currentWord,
    room.startWord,
    room.moves,
    room.language,
    room.wordLength,
    canPlayManually,
    hasDraftChange,
    draftWord,
    onOpenVictory,
    onSubmitMove,
    showToast,
    triggerErrorFeedback,
  ]);

  // Physical keyboard support for fast testing & desktop play
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        handleKeyPress(e.key.toUpperCase());
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleValidate();
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex((prev) => (prev === null ? 0 : (prev + 1) % room.wordLength));
        setDraftLetter(null);
      } else if (e.key === 'ArrowLeft') {
        setSelectedIndex((prev) =>
          prev === null ? room.wordLength - 1 : (prev - 1 + room.wordLength) % room.wordLength
        );
        setDraftLetter(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKeyPress, handleBackspace, handleValidate, room.wordLength]);

  const handleHintClick = () => {
    if (room.status === 'completed') return;
    if (!canPlayManually) {
      showToast(`Attends ton tour pour utiliser un indice !`, 'info');
      return;
    }
    const hint = getHintForWord(room.currentWord, room.targetWord, room.language);
    if (!hint) {
      showToast('Impasse détectée ! Utilise Reculer (Undo) pour revenir en arrière.', 'error');
      return;
    }

    // Second click on same word reveals exact target letter without double charging
    if (hintIndex !== null && hintChar === null) {
      setHintChar(hint.targetChar);
      setSelectedIndex(hint.changedIndex);
      showToast(
        `Indice révélé : change la tuile #${hint.changedIndex + 1} en "${hint.targetChar}"`,
        'hint',
        3200
      );
      return;
    }

    const paid = onUseHint(room.code);
    if (!paid) {
      showToast('Plus d’étoiles (0 ⭐) ! Utilise Reculer ou termine des défis.', 'error');
      return;
    }

    setHintIndex(hint.changedIndex);
    setSelectedIndex(hint.changedIndex);
    setDraftLetter(null);
    showToast(
      `Indice BFS (-1 ⭐) : modifie la tuile dorée ! (${hint.remainingSteps} coup${
        hint.remainingSteps > 1 ? 's' : ''
      } min. restant${hint.remainingSteps > 1 ? 's' : ''})`,
      'hint',
      3500
    );
  };

  const handleInviteCopy = async () => {
    const url = `${window.location.origin}/join/${room.code}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Let's Turn : ${room.startWord} → ${room.targetWord}`,
          text: `Rejoins mon duel Let's Turn (${room.code}) !`,
          url,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast(`Lien du salon ${room.code} copié !`, 'info');
    } catch {
      showToast(`Code salon : ${room.code}`, 'info');
    }
  };

  // Conversational history text matching Figma Frame 2 (node 2:16)
  const formatMoveSentence = (move: WordMove) => {
    const isMe = move.playerId === profile.playerId;
    const actor = isMe ? 'Vous avez' : `${move.playerName} a`;
    if (move.isUndoPenalty) {
      return `${actor} reculé d'un coup (+1 pénalité)`;
    }
    return `${actor} changé ${move.fromChar} en ${move.toChar} pour ${move.word}`;
  };

  const recentMoves = useMemo(() => {
    return [...room.moves].reverse().slice(0, 3);
  }, [room.moves]);

  const rows = keyboardLayout === 'AZERTY' ? AZERTY_ROWS : QWERTY_ROWS;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-between px-4 pb-5 pt-3.5">
      {/* TOP BAR épurée en 2 lignes : Retour + Barre de progression / Avatar + Flamme + Share */}
      <header className="space-y-3">
        {/* Ligne 1 : Bouton retour + barre de progression verte */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-black/5"
            aria-label="Retour à l'accueil"
          >
            <ArrowLeft className="h-5 w-5 stroke-[2.75]" />
          </button>

          <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
            <div
              className="relative h-full rounded-full bg-[var(--duo-green)] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            >
              <div className="mx-2 mt-0.5 h-1 rounded-full bg-white/35" />
            </div>
          </div>

          {room.status === 'active' && (
            <button
              type="button"
              onClick={() => setShowEndConfirm(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--text-muted)] transition hover:bg-black/5 hover:text-[var(--duo-red)]"
              aria-label="Terminer la partie"
              title="Terminer la partie"
            >
              <Flag className="h-[18px] w-[18px] stroke-[2.5]" />
            </button>
          )}
        </div>

        {/* Ligne 2 : Avatar & statut du tour à gauche / Flamme + Share à droite */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <FigmaAvatar
              avatarId={partner.avatarId}
              size={42}
              ringColor={waitingForPartner ? undefined : partner.color}
              ringGapColor="var(--bg-app)"
              onlineDot={!waitingForPartner && partner.online}
              empty={waitingForPartner}
              isBot={isBot}
            />
            <div className="min-w-0 leading-tight">
              <p
                className="truncate text-[17px] font-black"
                style={{ color: waitingForPartner ? 'var(--text-muted)' : 'var(--text-primary)' }}
              >
                {waitingForPartner ? 'En attente...' : partner.name}
              </p>
              {room.status === 'completed' ? (
                <button
                  type="button"
                  onClick={() => onOpenVictory(room.code)}
                  className="text-sm font-black text-[var(--duo-green-text)] hover:underline"
                >
                  🎉 Terminé ! Voir le résumé
                </button>
              ) : isMyTurn ? (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="truncate text-sm font-extrabold text-[var(--duo-green-text)]">
                    C&apos;est ton tour ! · Coup {totalMovesUsed}/{room.optimalPar}
                  </p>
                  {hasTurnCountdown && (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black tabular-nums"
                      style={{
                        backgroundColor: isLowTime
                          ? 'var(--duo-red-bg)'
                          : 'var(--duo-green-bg)',
                        color: isLowTime
                          ? 'var(--duo-red-text)'
                          : 'var(--duo-green-text)',
                      }}
                      title="Temps restant pour ton tour"
                    >
                      <Clock className="h-3 w-3 stroke-[2.75]" />
                      {remainingSeconds}s
                    </span>
                  )}
                </div>
              ) : waitingForPartner ? (
                <p className="mt-0.5 truncate text-sm font-extrabold text-[var(--text-muted)]">
                  En attente d&apos;un partenaire... · Coup {totalMovesUsed}/{room.optimalPar}
                </p>
              ) : (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="truncate text-sm font-extrabold text-[var(--duo-gold-text)]">
                    {partner.isTyping ? `${partner.name} tape...` : `Tour de ${partner.name}...`} ·
                    Coup {totalMovesUsed}/{room.optimalPar}
                  </p>
                  {showPartnerCountdown && (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black tabular-nums"
                      style={{
                        backgroundColor: isLowTime
                          ? 'var(--duo-red-bg)'
                          : 'var(--duo-gold-bg)',
                        color: isLowTime
                          ? 'var(--duo-red-text)'
                          : 'var(--duo-gold-text)',
                      }}
                      title="Passage auto du tour si inactif"
                    >
                      <Clock className="h-3 w-3 stroke-[2.75]" />
                      {remainingSeconds}s
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div
              className="flex h-10 items-center gap-1.5 rounded-xl border-2 border-[var(--border-tile)] px-3"
              title="Jours consécutifs joués en duo"
            >
              <FigmaFlameIcon size={18} />
              <span className="text-base font-black" style={{ color: 'var(--text-primary)' }}>
                {profile.streak}
              </span>
            </div>

            <button
              type="button"
              onClick={handleInviteCopy}
              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[var(--border-tile)] text-[var(--text-muted)] transition hover:text-[var(--duo-blue)] active:scale-95"
              aria-label="Partager la partie"
              title="Partager la partie"
            >
              <ShareIcon />
            </button>
          </div>
        </div>

        {/* Proposition du bot Miyu après 20s sans partenaire */}
        {waitingForPartner && showBotProposal && !botProposalDismissed && room.status === 'active' && (
          <div className="duo-card animate-pop-in flex items-center justify-between gap-2.5 px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <FigmaAvatar avatarId={5} isBot size={38} ringColor="#ff9600" />
              <div className="min-w-0 leading-tight">
                <p
                  className="truncate text-sm font-black"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Personne n&apos;a rejoint ?
                </p>
                <p className="truncate text-xs font-bold text-[var(--text-muted)]">
                  Jouer avec Miyu (bot)
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => onEnableBot(room.code)}
                className="duo-btn duo-btn-green px-3.5 py-1.5 text-xs"
              >
                Jouer
              </button>
              <button
                type="button"
                onClick={() => setBotProposalDismissed(true)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-black/5"
                aria-label="Ignorer la proposition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* CENTRE DU PLATEAU (Fidèle aux frames Figma 1:5 et 1:35) */}
      <main className="my-2 flex flex-1 flex-col items-center justify-start pt-4">
        {/* Titre Figma node 1:34 : "Let’s turn WINE to SLIM" */}
        <h1
          className="text-center text-[22px] font-extrabold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Let&apos;s turn <span className="font-black">{room.startWord}</span> to{' '}
          <span className="font-black text-[var(--duo-green)]">{room.targetWord}</span>
        </h1>

        {/* Toast discret pour erreurs / indices / notifications */}
        <div className="mt-2.5 flex min-h-8 items-center justify-center">
          {toast ? (
            <div
              className={`animate-pop-in rounded-full px-4 py-1 text-sm font-extrabold shadow-sm ${
                toast.tone === 'error'
                  ? 'bg-[var(--duo-red-bg)] text-[var(--duo-red-text)]'
                  : toast.tone === 'hint'
                  ? 'bg-[var(--duo-gold-bg)] text-[var(--duo-gold-text)]'
                  : 'bg-[var(--duo-blue-bg)] text-[var(--duo-blue-text)]'
              }`}
            >
              {toast.text}
            </div>
          ) : (
            <p className="text-center text-sm font-bold text-[var(--text-muted)]">
              {!isMyTurn && room.status === 'active'
                ? waitingForPartner
                  ? 'Partage le lien ou attends qu’un partenaire rejoigne'
                  : showPartnerCountdown
                  ? `En attente de ${partner.name} — tour auto dans ${remainingSeconds}s`
                  : `En attente du coup de ${partner.name} — clavier verrouillé`
                : selectedIndex === null
                ? 'Touche une tuile pour changer une lettre'
                : `Tuile #${selectedIndex + 1} sélectionnée — tape une lettre`}
            </p>
          )}
        </div>

        {/* Rangée de Tuiles 3D Tactiles */}
        <div
          className={`mt-4 flex w-full items-center justify-center ${
            room.wordLength === 5 ? 'gap-2' : 'gap-2.5'
          } ${shakeBoard ? 'animate-shake' : ''}`}
          role="group"
          aria-label="Tuiles du mot actuel"
        >
          {displayLetters.map((letter, idx) => {
            const isSelected = selectedIndex === idx;
            const isDraftedHere = isSelected && hasDraftChange;
            const isJustChanged = !hasDraftChange && lastChangedIndex === idx;
            const isHinted = hintIndex === idx && !isDraftedHere;
            const isFlipped = flippedIndex === idx;

            const tileSizeClass =
              room.wordLength === 5
                ? 'h-[54px] flex-1 max-w-[64px] text-[28px]'
                : 'h-[58px] flex-1 max-w-[74px] text-[32px]';

            let letterColor = 'var(--text-tile)';
            if (shakeBoard) {
              letterColor = 'var(--duo-red-text)';
            } else if (isDraftedHere || isJustChanged) {
              letterColor = 'var(--duo-green-bright)';
            } else if (isSelected) {
              letterColor = 'var(--duo-blue-text)';
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleTileSelect(idx)}
                data-tile-index={idx}
                className={`duo-tile flex ${tileSizeClass} items-center justify-center font-semibold leading-none ${
                  shakeBoard
                    ? 'duo-tile-error'
                    : isHinted
                    ? 'duo-tile-hint'
                    : isSelected
                    ? 'duo-tile-selected'
                    : ''
                } ${isFlipped ? 'animate-flip-tile' : ''}`}
                style={{ color: letterColor }}
                aria-label={`Tuile ${idx + 1} lettre ${letter}`}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {/* Rappel de l'indice lettre cible si révélé */}
        {hintChar && hintIndex !== null && (
          <p className="mt-2.5 text-sm font-black text-[var(--duo-gold-text)]">
            💡 Lettre suggérée pour la tuile {hintIndex + 1} :{' '}
            <span className="rounded bg-[var(--duo-gold-bg)] px-2 py-0.5 text-[var(--duo-gold-text)]">
              {hintChar}
            </span>
          </p>
        )}

        {/* Vérification en direct que la lettre remplacée forme un mot qui a du sens */}
        {hasDraftChange && draftMeaning && (
          <div
            className={`animate-pop-in mt-4 flex w-full items-start gap-2.5 rounded-2xl border-2 px-4 py-3 text-left ${
              alreadyPlayedStep !== null
                ? 'border-[var(--duo-gold)] bg-[var(--duo-gold-bg)] text-[var(--duo-gold-text)]'
                : draftMeaning.valid
                ? 'border-[var(--duo-green)] bg-[var(--duo-green-bg)] text-[var(--duo-green-text)]'
                : 'border-[var(--duo-red)] bg-[var(--duo-red-bg)] text-[var(--duo-red-text)]'
            }`}
            role="status"
            aria-live="polite"
          >
            {alreadyPlayedStep !== null ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--duo-orange)]" />
            ) : draftMeaning.valid ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--duo-green)]" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--duo-red)]" />
            )}
            <div className="min-w-0 flex-1 leading-snug">
              <p className="text-[15px] font-black">
                {alreadyPlayedStep !== null
                  ? `${draftWord} déjà joué (${
                      alreadyPlayedStep === 0 ? 'mot de départ' : `étape ${alreadyPlayedStep}`
                    })`
                  : draftMeaning.valid
                  ? `✓ ${draftWord} a du sens !`
                  : `✗ "${draftWord}" n'a pas de sens`}
              </p>
              <p className="mt-0.5 truncate text-sm font-bold opacity-90">
                {alreadyPlayedStep !== null
                  ? 'Choisis une autre lettre pour avancer sans tourner en rond.'
                  : draftMeaning.valid
                  ? draftMeaning.definition ?? 'Vérification du sens en cours...'
                  : 'Ce mot n’existe pas dans le dictionnaire courant.'}
              </p>
            </div>
          </div>
        )}

        {/* Journal Conversationnel */}
        <div className="mt-5 w-full space-y-2 text-center">
          {recentMoves.length === 0 ? (
            <p className="text-base font-bold text-[var(--text-muted)]">
              Mot de départ : <span className="text-[var(--text-primary)]">{room.startWord}</span> — À vous de
              jouer le premier coup !
            </p>
          ) : (
            recentMoves.map((move, i) => (
              <p
                key={move.id}
                className={`text-base font-bold leading-snug ${
                  i === 0 ? 'opacity-100' : 'opacity-70'
                }`}
                style={{ color: 'var(--text-muted)' }}
              >
                {formatMoveSentence(move)}
              </p>
            ))
          )}

          {/* Sens du mot actuellement posé sur le plateau */}
          {!hasDraftChange && currentWordMeaning?.valid && currentWordMeaning.definition && (
            <div className="mx-auto mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border-tile)] bg-[var(--bg-muted)] px-3.5 py-1.5 text-sm font-extrabold text-[var(--text-muted)]">
              <BookOpen className="h-4 w-4 shrink-0 text-[var(--duo-blue)]" />
              <span className="truncate">
                <strong className="text-[var(--text-primary)]">{room.currentWord}</strong> :{' '}
                {currentWordMeaning.definition}
              </span>
            </div>
          )}
        </div>

        {/* Chaîne d'évolution verticale scrollable / dépliable */}
        {room.moves.length > 0 && (
          <div className="mt-4 w-full">
            <button
              type="button"
              onClick={() => setShowFullChain((v) => !v)}
              className="mx-auto flex items-center gap-1.5 rounded-full border border-[var(--border-tile)] px-4 py-1.5 text-sm font-extrabold text-[var(--text-muted)] hover:bg-black/5"
            >
              <History className="h-4 w-4 text-[var(--duo-blue)]" />
              Chaîne complète ({room.moves.length + 1} mots)
              {showFullChain ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showFullChain && (
              <div className="duo-card mt-2 max-h-40 space-y-2 overflow-y-auto p-3.5">
                <div className="flex items-center justify-between text-sm font-extrabold">
                  <span className="rounded-lg bg-[var(--bg-muted)] px-2 py-0.5 text-[var(--text-muted)]">
                    Départ
                  </span>
                  <span className="tracking-widest text-[var(--text-primary)]">
                    {room.startWord}
                  </span>
                </div>
                {room.moves.map((move, stepIdx) => (
                  <div
                    key={move.id}
                    className="flex items-center justify-between border-t border-[var(--border-tile)] pt-1.5 text-sm font-extrabold"
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: move.playerColor }}
                      />
                      <span className="text-[var(--text-muted)]">
                        #{stepIdx + 1} {move.playerId === profile.playerId ? 'Toi' : move.playerName}
                      </span>
                    </span>
                    <span className="font-black tracking-widest">
                      {move.word.split('').map((c, ci) => (
                        <span
                          key={ci}
                          className={
                            ci === move.changedIndex
                              ? 'text-[var(--duo-green-bright)]'
                              : 'text-[var(--text-primary)]'
                          }
                        >
                          {c}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* BAS DU PLATEAU : Actions Aide (Indice + Undo) + Clavier AZERTY/QWERTY + Valider */}
      <footer className="space-y-2.5">
        {/* Barre d'aide & switch clavier */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleHintClick}
              disabled={!canPlayManually || room.status === 'completed'}
              className={`duo-btn flex items-center gap-1.5 px-3.5 py-2.5 text-sm ${
                !canPlayManually || room.status === 'completed'
                  ? 'duo-btn-disabled'
                  : 'duo-btn-white'
              }`}
            >
              <Lightbulb className="h-4 w-4 text-[#ffc800]" />
              Indice
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--duo-gold-bg)] px-1.5 py-0.5 text-xs font-black text-[var(--duo-gold-text)]">
                1 <Star className="h-3 w-3 fill-[#ffc800] text-[#e5a400]" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onUndoMove(room.code)}
              disabled={room.moves.length === 0 || room.status === 'completed'}
              className={`duo-btn flex items-center gap-1.5 px-3.5 py-2.5 text-sm ${
                room.moves.length === 0 || room.status === 'completed'
                  ? 'duo-btn-disabled'
                  : 'duo-btn-white'
              }`}
              title="Reculer d'un coup (+1 pénalité)"
            >
              <RotateCcw className="h-4 w-4 text-[var(--duo-orange)]" />
              Undo
            </button>
          </div>

          <button
            type="button"
            onClick={() => setKeyboardLayout((l) => (l === 'AZERTY' ? 'QWERTY' : 'AZERTY'))}
            className="rounded-xl border-2 border-[var(--border-tile)] px-3 py-2 text-[13px] font-black text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            {keyboardLayout}
          </button>
        </div>

        {/* Clavier virtuel tactile style Duolingo / Wordle */}
        <div
          className={`space-y-1.5 rounded-2xl p-1.5 transition-opacity ${
            !canPlayManually && room.status === 'active' ? 'pointer-events-none opacity-50' : ''
          }`}
          style={{ backgroundColor: 'var(--bg-muted)' }}
          aria-disabled={!canPlayManually || room.status === 'completed'}
        >
          {rows.map((row, rIdx) => (
            <div key={rIdx} className="flex justify-center gap-1">
              {row.map((key) => {
                const isActiveChar =
                  selectedIndex !== null && displayLetters[selectedIndex] === key && hasDraftChange;
                const matchesTargetAtSelected =
                  hintChar === key && hintIndex === selectedIndex;

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!canPlayManually || room.status === 'completed'}
                    onClick={() => handleKeyPress(key)}
                    className={`duo-key flex h-12 flex-1 items-center justify-center text-base font-black ${
                      isActiveChar
                        ? '!border-[var(--duo-blue-shadow)] !bg-[var(--duo-blue)] !text-white'
                        : matchesTargetAtSelected
                        ? '!border-[var(--duo-gold)] !bg-[var(--duo-gold-bg)] !text-[var(--duo-gold-text)]'
                        : ''
                    }`}
                  >
                    {key}
                  </button>
                );
              })}
              {rIdx === 2 && (
                <button
                  type="button"
                  disabled={!canPlayManually || room.status === 'completed'}
                  onClick={handleBackspace}
                  className="duo-key flex h-12 w-12 items-center justify-center bg-[var(--bg-muted)] text-[var(--text-primary)]"
                  aria-label="Effacer"
                >
                  <Delete className="h-5 w-5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Gros bouton Valider 3D style Duolingo CHECK / Figma node 2:1040 */}
        <button
          type="button"
          onClick={handleValidate}
          disabled={room.status === 'active' && (!hasDraftChange || !canPlayManually)}
          className={`duo-btn flex w-full items-center justify-center gap-2 py-4 text-[17px] ${
            room.status === 'completed'
              ? 'duo-btn-green'
              : hasDraftChange && canPlayManually
              ? 'duo-btn-green'
              : 'duo-btn-disabled'
          }`}
        >
          {room.status === 'completed'
            ? 'Voir la victoire 🎉'
            : hasDraftChange
            ? `Valider ${draftWord}`
            : canPlayManually
            ? 'Valider'
            : waitingForPartner
            ? 'En attente d’un partenaire...'
            : `Tour de ${partner.name}...`}
        </button>
      </footer>

      {/* Modale de confirmation pour terminer une partie sans trouver le mot */}
      {showEndConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setShowEndConfirm(false)}
        >
          <div
            className="duo-card animate-pop-in w-full max-w-sm p-5"
            style={{ backgroundColor: 'var(--bg-surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>
                Terminer la partie ?
              </h3>
              <button
                type="button"
                onClick={() => setShowEndConfirm(false)}
                className="rounded-full p-1 text-[var(--text-muted)] hover:bg-black/5"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1.5 text-sm font-bold text-[var(--text-muted)]">
              La partie sera clôturée sans trouver{' '}
              <span className="font-black text-[var(--text-primary)]">{room.targetWord}</span> et la
              solution optimale sera affichée.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowEndConfirm(false)}
                className="duo-btn duo-btn-white flex-1 py-3.5 text-sm"
              >
                Continuer
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEndConfirm(false);
                  onEndGame(room.code);
                }}
                className="duo-btn flex-1 py-3.5 text-sm text-white"
                style={{
                  backgroundColor: 'var(--duo-red)',
                  border: '2px solid var(--duo-red-shadow)',
                  borderBottomWidth: 6,
                }}
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
