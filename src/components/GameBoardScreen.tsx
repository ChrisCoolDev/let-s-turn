import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Delete,
  Flag,
  Flame,
  HelpCircle,
  History,
  Lightbulb,
  RotateCcw,
  ShieldPlus,
  Star,
  Swords,
  ThumbsUp,
  X,
  XCircle,
} from 'lucide-react';
import { FigmaAvatar, FigmaFlameIcon, ShareIcon } from './FigmaAssets';
import {
  computeDuelScores,
  getActiveDuoStreak,
  getComboMultiplier,
} from '../engine/gamification';
import {
  getHintForWord,
  getRoomGoldenLetter,
  hasClaimedGoldenLetter,
  isOneLetterDiff,
  isValidWord,
} from '../engine/wordLadder';
import { isPlural, useI18n } from '../i18n';
import {
  BOT_PROPOSAL_DELAY_MS,
  broadcastTypingState,
  getRoomTurnTimeoutMs,
  requestNotificationPermissionOnGesture,
  resolveRoomParticipants,
} from '../services/multiplayer';
import {
  fetchWordMeaning,
  getImmediateWordMeaning,
  type WordMeaningResult,
} from '../services/wordMeaning';
import type {
  GameRoom,
  PlayerProfile,
  QuickReactionEvent,
  QuickReactionId,
  WordMove,
} from '../types/game';

interface GameBoardScreenProps {
  room: GameRoom;
  profile: PlayerProfile;
  onBackToHub: () => void;
  onSubmitMove: (roomCode: string, nextWord: string) => void;
  onUndoMove: (roomCode: string) => void;
  onUseHint: (roomCode: string) => boolean;
  onUseTimeShield?: (roomCode: string) => boolean;
  onEnableBot: (roomCode: string) => void;
  onEndGame: (roomCode: string) => void;
  onOpenVictory: (roomCode: string) => void;
  onStartTour?: () => void;
  tourPaused?: boolean;
  partnerReaction?: QuickReactionEvent | null;
  onSendReaction?: (roomCode: string, reactionId: QuickReactionId) => void;
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
  onUseTimeShield,
  onEnableBot,
  onEndGame,
  onOpenVictory,
  onStartTour,
  tourPaused = false,
  partnerReaction = null,
  onSendReaction,
}) => {
  const { locale, t } = useI18n();
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
  const [sentReactionId, setSentReactionId] = useState<QuickReactionId | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const reactionCooldownRef = useRef<number>(0);
  const seenTurnPassIdRef = useRef<string | null>(null);

  const {
    me,
    partner,
    waitingForPartner,
    isBot,
    isMyTurn,
  } = resolveRoomParticipants(room, profile);
  const canPlayManually = isMyTurn;
  const hasTurnCountdown =
    room.status === 'active' &&
    !waitingForPartner &&
    partner.playerId !== profile.playerId &&
    partner.playerId !== me.playerId;
  const turnTimeoutMs = getRoomTurnTimeoutMs(room);
  const remainingSeconds = hasTurnCountdown
    ? Math.max(0, Math.ceil(((room.turnStartedAt ?? room.startedAt) + turnTimeoutMs - now) / 1000))
    : 0;
  const showPartnerCountdown = hasTurnCountdown && !isMyTurn && (isBot || remainingSeconds <= 20);
  const isLowTime = hasTurnCountdown && remainingSeconds <= 10;

  const goldenLetter = getRoomGoldenLetter(room);
  const goldenClaimed = hasClaimedGoldenLetter(room);
  const tempoCombo = room.tempoCombo ?? 0;
  const comboMult = getComboMultiplier(tempoCombo);
  const prevGoldenClaimedRef = useRef(goldenClaimed);
  const prevTempoComboRef = useRef(tempoCombo);

  const duoStreak = !waitingForPartner ? getActiveDuoStreak(profile, partner.playerId) : 0;
  const duelScores = useMemo(
    () => (room.mode === 'duel' ? computeDuelScores(room, me.playerId) : null),
    [
      room.mode,
      room.moves,
      room.targetWord,
      room.language,
      room.startedAt,
      room.hostPlayer,
      room.partnerPlayer,
      room.winnerPlayerId,
      me.playerId,
    ]
  );

  const handleQuickReaction = (reactionId: QuickReactionId) => {
    if (!onSendReaction) return;
    const ts = Date.now();
    if (ts - reactionCooldownRef.current < 1500) return;
    reactionCooldownRef.current = ts;
    setSentReactionId(reactionId);
    onSendReaction(room.code, reactionId);
    window.setTimeout(() => {
      setSentReactionId((cur) => (cur === reactionId ? null : cur));
    }, 1500);
  };

  useEffect(() => {
    if (!waitingForPartner || room.status !== 'active' || botProposalDismissed || tourPaused) {
      if (botProposalDismissed || !waitingForPartner || room.status !== 'active') {
        setShowBotProposal(false);
      }
      return;
    }
    const elapsed = Math.max(0, Date.now() - room.startedAt);
    const delay = Math.max(0, BOT_PROPOSAL_DELAY_MS - elapsed);
    const timer = window.setTimeout(() => setShowBotProposal(true), delay);
    return () => window.clearTimeout(timer);
  }, [waitingForPartner, room.status, room.startedAt, botProposalDismissed, tourPaused]);

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
    if (!hasTurnCountdown || tourPaused) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [hasTurnCountdown, tourPaused, room.turnStartedAt, room.currentTurnPlayerId]);

  // Show a clear toast when a turn passes automatically after timing out
  useEffect(() => {
    const pass = room.lastTurnPass;
    if (!pass || pass.id === seenTurnPassIdRef.current) return;
    seenTurnPassIdRef.current = pass.id;
    if (Date.now() - pass.timestamp > 15_000) return;

    const passedToMe = pass.toPlayerId === me.playerId || pass.toPlayerId === profile.playerId;
    if (passedToMe) {
      const fromIsOwnName =
        pass.fromPlayerName === profile.name || pass.fromPlayerName === me.name;
      const otherName =
        pass.fromPlayerId !== profile.playerId &&
        pass.fromPlayerId !== me.playerId &&
        !fromIsOwnName
          ? pass.fromPlayerName
          : partner.name;
      showToast(t('board.toastTurnTimeoutYou', { name: otherName }), 'hint', 3400);
    } else {
      const toIsOwnName =
        pass.toPlayerName === profile.name || pass.toPlayerName === me.name;
      const nextName =
        pass.toPlayerId !== profile.playerId &&
        pass.toPlayerId !== me.playerId &&
        !toIsOwnName
          ? pass.toPlayerName
          : partner.name;
      showToast(t('board.toastTurnTimeoutOther', { name: nextName }), 'info', 3400);
    }
  }, [room.lastTurnPass, profile.playerId, profile.name, me.playerId, me.name, partner.name, showToast, t]);

  // Reset local draft whenever the currentWord changes
  useEffect(() => {
    setSelectedIndex(null);
    setDraftLetter(null);
    setHintIndex(null);
    setHintChar(null);

    if (room.moves.length > 0) {
      const lastMove = room.moves[room.moves.length - 1];
      setFlippedIndex(lastMove.changedIndex);
      const timer = window.setTimeout(() => setFlippedIndex(null), 420);
      return () => window.clearTimeout(timer);
    }
  }, [room.currentWord, room.moves]);

  // Broadcast live typing indicator
  useEffect(() => {
    broadcastTypingState(room.code, profile.playerId, selectedIndex !== null || draftLetter !== null);
  }, [selectedIndex, draftLetter, room.code, profile.playerId]);

  // Celebratory toast when Golden Route or Tempo Combo milestone is hit
  useEffect(() => {
    const goldenJustClaimed = goldenClaimed && !prevGoldenClaimedRef.current;
    prevGoldenClaimedRef.current = goldenClaimed;

    const comboLeveledUp =
      tempoCombo > prevTempoComboRef.current &&
      (tempoCombo === 2 || tempoCombo === 3 || tempoCombo === 5);
    prevTempoComboRef.current = tempoCombo;

    if (goldenJustClaimed) {
      showToast(t('board.toastGoldenClaimed'), 'hint', 3000);
    } else if (comboLeveledUp) {
      showToast(t('board.toastCombo', { mult: comboMult }), 'info', 2200);
    }
  }, [goldenClaimed, tempoCombo, comboMult, showToast, t]);

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
    const immediate = getImmediateWordMeaning(draftWord, room.language, locale);
    setDraftMeaning(immediate);

    if (!immediate.valid || immediate.definition) return;
    const ctrl = new AbortController();
    fetchWordMeaning(draftWord, room.language, ctrl.signal, locale).then((res) => {
      if (!ctrl.signal.aborted) setDraftMeaning(res);
    });
    return () => ctrl.abort();
  }, [hasDraftChange, draftWord, room.language, locale]);

  // Définition du mot actuel sur le plateau
  useEffect(() => {
    const immediate = getImmediateWordMeaning(room.currentWord, room.language, locale);
    setCurrentWordMeaning(immediate);
    if (!immediate.valid || immediate.definition) return;
    const ctrl = new AbortController();
    fetchWordMeaning(room.currentWord, room.language, ctrl.signal, locale).then((res) => {
      if (!ctrl.signal.aborted) setCurrentWordMeaning(res);
    });
    return () => ctrl.abort();
  }, [room.currentWord, room.language, locale]);

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
          ? t('board.toastWaitingPartner')
          : t('board.toastPartnerPlaying', { name: partner.name }),
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
            ? t('board.toastWaitingPartnerMove')
            : t('board.toastPartnerTurn', { name: partner.name }),
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
    [room.status, canPlayManually, waitingForPartner, partner.name, selectedIndex, showToast, t]
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
      showToast(t('board.toastSelectTile'), 'info');
      return;
    }

    const candidate = draftWord.toUpperCase();

    // Verify exact 1-letter difference
    const diff = isOneLetterDiff(room.currentWord, candidate);
    if (!diff.valid) {
      triggerErrorFeedback(t('board.toastOneLetterOnly'));
      return;
    }

    // Check if word was already played in the chain (startWord or any previous move)
    if (candidate === room.startWord) {
      triggerErrorFeedback(t('board.toastAlreadyPlayedStart'));
      return;
    }
    const existingStepIdx = room.moves.findIndex((m) => m.word === candidate);
    if (existingStepIdx !== -1) {
      triggerErrorFeedback(t('board.toastAlreadyPlayedStep', { step: existingStepIdx + 1 }));
      return;
    }

    // Dictionary validation
    if (!isValidWord(candidate, room.language, room.wordLength)) {
      triggerErrorFeedback(t('board.toastUnknownWord'));
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
    t,
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
      showToast(t('board.toastWaitForHint'), 'info');
      return;
    }
    const hint = getHintForWord(room.currentWord, room.targetWord, room.language);
    if (!hint) {
      showToast(t('board.toastDeadEnd'), 'error');
      return;
    }

    // Second click on same word reveals exact target letter without double charging
    if (hintIndex !== null && hintChar === null) {
      setHintChar(hint.targetChar);
      setSelectedIndex(hint.changedIndex);
      showToast(
        t('board.toastHintRevealed', {
          index: hint.changedIndex + 1,
          char: hint.targetChar,
        }),
        'hint',
        3200
      );
      return;
    }

    const paid = onUseHint(room.code);
    if (!paid) {
      showToast(t('board.toastNoStars'), 'error');
      return;
    }

    setHintIndex(hint.changedIndex);
    setSelectedIndex(hint.changedIndex);
    setDraftLetter(null);
    const remainingLabel = t(
      isPlural(hint.remainingSteps, locale)
        ? 'board.remainingMovesMany'
        : 'board.remainingMovesOne',
      { count: hint.remainingSteps }
    );
    showToast(t('board.toastHintBfs', { remaining: remainingLabel }), 'hint', 3500);
  };

  const handleShieldClick = () => {
    if (!onUseTimeShield || room.status !== 'active' || !canPlayManually || !hasTurnCountdown) {
      return;
    }
    if (remainingSeconds > 12) {
      showToast(t('board.toastShieldWait'), 'info');
      return;
    }
    const ok = onUseTimeShield(room.code);
    if (!ok) {
      showToast(t('board.toastNoStars'), 'error');
      return;
    }
    showToast(t('board.toastShieldUsed'), 'hint', 3000);
  };

  const handleInviteCopy = async () => {
    void requestNotificationPermissionOnGesture();
    const url = `${window.location.origin}/join/${room.code}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: t('board.shareTitle', { start: room.startWord, target: room.targetWord }),
          text: t('board.shareText', { code: room.code }),
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
      showToast(t('board.toastLinkCopied', { code: room.code }), 'info');
    } catch {
      showToast(t('board.toastRoomCode', { code: room.code }), 'info');
    }
  };

  // Conversational history text matching Figma Frame 2 (node 2:16)
  const formatMoveSentence = (move: WordMove) => {
    const isMe = move.playerId === profile.playerId || move.playerId === me.playerId;
    if (move.isUndoPenalty) {
      return isMe ? t('board.moveMeUndo') : t('board.moveOtherUndo', { name: move.playerName });
    }
    return isMe
      ? t('board.moveMeChanged', {
          from: move.fromChar,
          to: move.toChar,
          word: move.word,
        })
      : t('board.moveOtherChanged', {
          name: move.playerName,
          from: move.fromChar,
          to: move.toChar,
          word: move.word,
        });
  };

  const recentMoves = useMemo(() => {
    const limit = hasDraftChange ? 1 : 3;
    return [...room.moves].reverse().slice(0, limit);
  }, [room.moves, hasDraftChange]);

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
            aria-label={t('board.backAria')}
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

          {onStartTour && (
            <button
              type="button"
              onClick={onStartTour}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--text-muted)] transition hover:bg-black/5 hover:text-[var(--duo-blue)]"
              aria-label={t('tour.replayAria')}
              title={t('tour.replayAria')}
            >
              <HelpCircle className="h-[19px] w-[19px] stroke-[2.5]" />
            </button>
          )}

          {room.status === 'active' && (
            <button
              type="button"
              onClick={() => setShowEndConfirm(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--text-muted)] transition hover:bg-black/5 hover:text-[var(--duo-red)]"
              aria-label={t('board.endGameAria')}
              title={t('board.endGameAria')}
            >
              <Flag className="h-[18px] w-[18px] stroke-[2.5]" />
            </button>
          )}
        </div>

        {/* Ligne 2 : Avatar & statut du tour à gauche / Flamme + Share à droite */}
        <div data-tour="board-turn-status" className="flex items-center justify-between gap-2">
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
              <div className="flex items-center gap-1.5">
                <p
                  className="truncate text-[17px] font-black"
                  style={{ color: waitingForPartner ? 'var(--text-muted)' : 'var(--text-primary)' }}
                >
                  {waitingForPartner ? t('common.waiting') : partner.name}
                </p>
                {isBot && room.botDifficulty && room.botDifficulty !== 'apprentice' && (
                  <span
                    className="inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide"
                    style={{
                      backgroundColor: 'var(--duo-blue-bg)',
                      color: 'var(--duo-blue-text)',
                    }}
                  >
                    {t(`bot.${room.botDifficulty}.title`)}
                  </span>
                )}
                {duoStreak > 0 && (
                  <span
                    className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-black"
                    style={{
                      backgroundColor: 'var(--duo-orange-bg)',
                      color: 'var(--duo-orange-shadow)',
                    }}
                  >
                    <FigmaFlameIcon size={11} />
                    {duoStreak}
                    {t('common.streakUnit')}
                  </span>
                )}
                {partnerReaction && partnerReaction.roomCode === room.code && (
                  <span
                    key={partnerReaction.id}
                    className="animate-pop-in inline-flex shrink-0 items-center rounded-full border border-[var(--duo-blue)] bg-[var(--duo-blue-bg)] px-2 py-0.5 text-[11px] font-black text-[var(--duo-blue-text)]"
                  >
                    {t(`board.reaction.${partnerReaction.reactionId}` as Parameters<typeof t>[0])}
                  </span>
                )}
              </div>
              {room.status === 'completed' ? (
                <button
                  type="button"
                  onClick={() => onOpenVictory(room.code)}
                  className="text-sm font-black text-[var(--duo-green-text)] hover:underline"
                >
                  {t('board.completedCta')}
                </button>
              ) : isMyTurn ? (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="truncate text-sm font-extrabold text-[var(--duo-green-text)]">
                    {t('board.yourTurn', { moves: totalMovesUsed, par: room.optimalPar })}
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
                      title={t('board.yourTurnTimeTooltip')}
                    >
                      <Clock className="h-3 w-3 stroke-[2.75]" />
                      {remainingSeconds}s
                    </span>
                  )}
                </div>
              ) : waitingForPartner ? (
                <p className="mt-0.5 truncate text-sm font-extrabold text-[var(--text-muted)]">
                  {t('board.waitingStatus', { moves: totalMovesUsed, par: room.optimalPar })}
                </p>
              ) : (
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="truncate text-sm font-extrabold text-[var(--duo-gold-text)]">
                    {partner.isTyping
                      ? t('board.partnerTyping', { name: partner.name })
                      : t('board.partnerTurn', { name: partner.name })}{' '}
                    · {t('board.moveRatio', { moves: totalMovesUsed, par: room.optimalPar })}
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
                      title={t('board.partnerTimeTooltip')}
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
              title={t('hub.streakTooltip')}
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
              aria-label={t('board.shareAria')}
              title={t('board.shareAria')}
            >
              <ShareIcon />
            </button>
          </div>
        </div>

        {/* Barre de scores en direct (Mode Duel) */}
        {duelScores && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-[var(--border-tile)] bg-[var(--bg-muted)] px-3 py-1.5 text-xs font-black">
            <span
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 tabular-nums ${
                duelScores.isMeWinning
                  ? 'bg-[var(--duo-green-bg)] text-[var(--duo-green-text)]'
                  : 'text-[var(--text-primary)]'
              }`}
            >
              {t('common.you')} · {t('board.ptsUnit', { pts: duelScores.myScore })}
            </span>
            <span className="inline-flex items-center gap-1 text-[var(--duo-orange-shadow)]">
              <Swords className="h-3.5 w-3.5" />
              {duelScores.isTie ? t('board.duelTie') : t('board.duelLead')}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 tabular-nums ${
                duelScores.isOpponentWinning
                  ? 'bg-[var(--duo-blue-bg)] text-[var(--duo-blue-text)]'
                  : 'text-[var(--text-primary)]'
              }`}
            >
              {waitingForPartner ? t('common.partner') : partner.name} ·{' '}
              {t('board.ptsUnit', { pts: duelScores.opponentScore })}
            </span>
          </div>
        )}

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
                  {t('board.miyuTitle')}
                </p>
                <p className="truncate text-xs font-bold text-[var(--text-muted)]">
                  {t('board.miyuSubtitle')}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => onEnableBot(room.code)}
                className="duo-btn duo-btn-green px-3.5 py-1.5 text-xs"
              >
                {t('common.play')}
              </button>
              <button
                type="button"
                onClick={() => setBotProposalDismissed(true)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-black/5"
                aria-label={t('board.miyuDismissAria')}
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
          data-tour="board-goal"
          className="text-center text-[22px] font-extrabold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Let&apos;s turn <span className="font-black">{room.startWord}</span> to{' '}
          <span className="font-black text-[var(--duo-green)]">{room.targetWord}</span>
        </h1>

        {/* Pilules compactes : Lettre Dorée & Tempo Combo */}
        {(goldenLetter || tempoCombo >= 2) && (
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
            {goldenLetter && (
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-black"
                style={
                  goldenClaimed
                    ? {
                        borderColor: 'var(--duo-green)',
                        backgroundColor: 'var(--duo-green-bg)',
                        color: 'var(--duo-green-text)',
                      }
                    : {
                        borderColor: 'var(--duo-gold)',
                        backgroundColor: 'var(--duo-gold-bg)',
                        color: 'var(--duo-gold-text)',
                      }
                }
              >
                {goldenClaimed ? (
                  <>
                    <Check className="h-3 w-3 stroke-[3]" />
                    <span>{t('board.goldenLetterDone')}</span>
                    <span className="inline-flex items-center gap-0.5">
                      +1 <Star className="h-3 w-3 fill-[#ffc800] text-[#e5a400]" />
                    </span>
                  </>
                ) : (
                  <>
                    <Star className="h-3 w-3 fill-[#ffc800] text-[#e5a400]" />
                    <span>{t('board.goldenLetterLabel', { letter: goldenLetter })}</span>
                    <span className="opacity-80">· +1</span>
                    <Star className="h-2.5 w-2.5 fill-[#ffc800] text-[#e5a400]" />
                  </>
                )}
              </span>
            )}
            {tempoCombo >= 2 && (
              <span
                className="animate-pop-in inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-black"
                style={{
                  borderColor: 'var(--duo-orange)',
                  backgroundColor: 'var(--duo-orange-bg)',
                  color: 'var(--duo-orange-shadow)',
                }}
              >
                <FigmaFlameIcon size={13} />
                <span>{t('board.comboBadge', { mult: comboMult })}</span>
              </span>
            )}
          </div>
        )}

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
                  ? t('board.promptWaitingPartner')
                  : showPartnerCountdown
                  ? t('board.promptPartnerCountdown', {
                      name: partner.name,
                      seconds: remainingSeconds,
                    })
                  : t('board.promptPartnerLocked', { name: partner.name })
                : selectedIndex === null
                ? t('board.promptTapTile')
                : t('board.promptTileSelected', { index: selectedIndex + 1 })}
            </p>
          )}
        </div>

        {/* Rangée de Tuiles 3D Tactiles */}
        <div
          data-tour="board-tiles"
          className={`mt-4 flex w-full items-center justify-center ${
            room.wordLength === 5 ? 'gap-2' : 'gap-2.5'
          } ${shakeBoard ? 'animate-shake' : ''}`}
          role="group"
          aria-label={t('board.tilesGroupAria')}
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
                    : tempoCombo >= 2 && room.status === 'active'
                    ? 'duo-tile-combo'
                    : ''
                } ${isFlipped ? 'animate-flip-tile' : ''}`}
                style={{ color: letterColor }}
                aria-label={t('board.tileAria', { index: idx + 1, letter })}
              >
                {letter}
              </button>
            );
          })}
        </div>

        {/* Rappel de l'indice lettre cible si révélé */}
        {hintChar && hintIndex !== null && (
          <p className="mt-2.5 text-sm font-black text-[var(--duo-gold-text)]">
            {t('board.hintSuggested', { index: hintIndex + 1 })}{' '}
            <span className="rounded bg-[var(--duo-gold-bg)] px-2 py-0.5 text-[var(--duo-gold-text)]">
              {hintChar}
            </span>
          </p>
        )}

        {/* Vérification en direct que la lettre remplacée forme un mot qui a du sens */}
        {hasDraftChange && draftMeaning && (
          <div
            className={`animate-pop-in mt-3 flex w-full items-start gap-2.5 rounded-2xl border-2 px-3.5 py-2.5 text-left ${
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
                  ? alreadyPlayedStep === 0
                    ? t('board.draftAlreadyStart', { word: draftWord })
                    : t('board.draftAlreadyStep', { word: draftWord, step: alreadyPlayedStep })
                  : draftMeaning.valid
                  ? t('board.draftValid', { word: draftWord })
                  : t('board.draftInvalid', { word: draftWord })}
              </p>
              <p className="mt-0.5 truncate text-sm font-bold opacity-90">
                {alreadyPlayedStep !== null
                  ? t('board.draftAlreadyDesc')
                  : draftMeaning.valid
                  ? draftMeaning.definition ?? t('board.draftChecking')
                  : t('board.draftInvalidDesc')}
              </p>
            </div>
          </div>
        )}

        {/* Journal Conversationnel */}
        <div className={`${hasDraftChange ? 'mt-2.5' : 'mt-4'} w-full space-y-1.5 text-center`}>
          {recentMoves.length === 0 ? (
            <p className="text-base font-bold text-[var(--text-muted)]">
              {t('board.startWordPromptPrefix')}{' '}
              <span className="text-[var(--text-primary)]">{room.startWord}</span>{' '}
              {t('board.startWordPromptSuffix')}
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
              {t('board.fullChain', { count: room.moves.length + 1 })}
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
                    {t('common.start')}
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
                        #{stepIdx + 1}{' '}
                        {move.playerId === profile.playerId || move.playerId === me.playerId
                          ? t('common.you')
                          : move.playerName}
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

      {/* BAS DU PLATEAU : Réactions + Aide (Indice + Undo) + Clavier AZERTY/QWERTY + Valider */}
      <footer className="space-y-2.5">
        {!waitingForPartner && room.status === 'active' && onSendReaction && (
          <div className="flex items-center justify-center gap-1.5">
            {(
              [
                { id: 'nice' as const, Icon: ThumbsUp, color: 'var(--duo-green-text)' },
                { id: 'hurry' as const, Icon: Clock, color: 'var(--duo-orange)' },
                { id: 'tough' as const, Icon: Flame, color: 'var(--duo-red-text)' },
                { id: 'idea' as const, Icon: Lightbulb, color: 'var(--duo-blue-text)' },
              ] as const
            ).map(({ id, Icon, color }) => {
              const label = t(`board.reaction.${id}` as Parameters<typeof t>[0]);
              const isSent = sentReactionId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleQuickReaction(id)}
                  aria-label={t('board.reactAria', { label })}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--border-tile)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-black transition active:scale-95"
                  style={{
                    borderColor: isSent ? 'var(--duo-blue)' : undefined,
                    backgroundColor: isSent ? 'var(--duo-blue-bg)' : undefined,
                    color: isSent ? 'var(--duo-blue-text)' : 'var(--text-muted)',
                  }}
                >
                  <Icon className="h-3 w-3 shrink-0" style={{ color: isSent ? undefined : color }} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Barre d'aide & switch clavier */}
        <div data-tour="board-tools" className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleHintClick}
              disabled={!canPlayManually || room.status === 'completed'}
              className={`duo-btn flex items-center gap-1 px-2.5 py-2 text-xs sm:gap-1.5 sm:px-3.5 sm:py-2.5 sm:text-sm ${
                !canPlayManually || room.status === 'completed'
                  ? 'duo-btn-disabled'
                  : 'duo-btn-white'
              }`}
            >
              <Lightbulb className="h-3.5 w-3.5 text-[#ffc800] sm:h-4 sm:w-4" />
              {t('board.hintButton')}
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--duo-gold-bg)] px-1.5 py-0.5 text-[11px] font-black text-[var(--duo-gold-text)] sm:text-xs">
                1 <Star className="h-3 w-3 fill-[#ffc800] text-[#e5a400]" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onUndoMove(room.code)}
              disabled={room.moves.length === 0 || room.status === 'completed'}
              className={`duo-btn flex items-center gap-1 px-2.5 py-2 text-xs sm:gap-1.5 sm:px-3.5 sm:py-2.5 sm:text-sm ${
                room.moves.length === 0 || room.status === 'completed'
                  ? 'duo-btn-disabled'
                  : 'duo-btn-white'
              }`}
              title={t('board.undoTooltip')}
            >
              <RotateCcw className="h-3.5 w-3.5 text-[var(--duo-orange)] sm:h-4 sm:w-4" />
              {t('board.undoButton')}
            </button>

            {onUseTimeShield && hasTurnCountdown && (
              <button
                type="button"
                onClick={handleShieldClick}
                disabled={!canPlayManually || room.status === 'completed'}
                title={t('board.shieldTooltip')}
                className={`duo-btn flex items-center gap-1 px-2.5 py-2 text-xs sm:gap-1.5 sm:px-3 sm:py-2.5 sm:text-sm ${
                  !canPlayManually || room.status === 'completed'
                    ? 'duo-btn-disabled'
                    : 'duo-btn-white'
                }`}
                style={
                  canPlayManually && room.status === 'active' && remainingSeconds <= 12
                    ? {
                        borderColor: 'var(--duo-blue)',
                        backgroundColor: 'var(--duo-blue-bg)',
                      }
                    : undefined
                }
              >
                <ShieldPlus className="h-3.5 w-3.5 text-[var(--duo-blue)] sm:h-4 sm:w-4" />
                <span>{t('board.shieldButton')}</span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--duo-gold-bg)] px-1.5 py-0.5 text-[11px] font-black text-[var(--duo-gold-text)] sm:text-xs">
                  1 <Star className="h-3 w-3 fill-[#ffc800] text-[#e5a400]" />
                </span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setKeyboardLayout((l) => (l === 'AZERTY' ? 'QWERTY' : 'AZERTY'))}
            className="shrink-0 rounded-xl border-2 border-[var(--border-tile)] px-2.5 py-2 text-xs font-black text-[var(--text-muted)] hover:text-[var(--text-primary)] sm:px-3 sm:text-[13px]"
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
                const isGoldenKey = !goldenClaimed && goldenLetter === key;

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!canPlayManually || room.status === 'completed'}
                    onClick={() => handleKeyPress(key)}
                    className={`duo-key relative flex h-12 flex-1 items-center justify-center text-base font-black ${
                      isActiveChar
                        ? '!border-[var(--duo-blue-shadow)] !bg-[var(--duo-blue)] !text-white'
                        : matchesTargetAtSelected
                        ? '!border-[var(--duo-gold)] !bg-[var(--duo-gold-bg)] !text-[var(--duo-gold-text)]'
                        : isGoldenKey
                        ? 'duo-key-golden'
                        : ''
                    }`}
                  >
                    {key}
                    {isGoldenKey && !isActiveChar && (
                      <Star className="pointer-events-none absolute right-0.5 top-0.5 h-2.5 w-2.5 fill-[#ffc800] text-[#e5a400]" />
                    )}
                  </button>
                );
              })}
              {rIdx === 2 && (
                <button
                  type="button"
                  disabled={!canPlayManually || room.status === 'completed'}
                  onClick={handleBackspace}
                  className="duo-key flex h-12 w-12 items-center justify-center bg-[var(--bg-muted)] text-[var(--text-primary)]"
                  aria-label={t('board.backspaceAria')}
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
          data-tour="board-submit"
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
            ? t('board.ctaVictory')
            : hasDraftChange
            ? t('board.ctaSubmitWord', { word: draftWord })
            : canPlayManually
            ? t('board.ctaSubmit')
            : waitingForPartner
            ? t('board.ctaWaitingPartner')
            : t('board.ctaPartnerTurn', { name: partner.name })}
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
                {t('board.endModalTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setShowEndConfirm(false)}
                className="rounded-full p-1 text-[var(--text-muted)] hover:bg-black/5"
                aria-label={t('common.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1.5 text-sm font-bold text-[var(--text-muted)]">
              {t('board.endModalDescPrefix')}{' '}
              <span className="font-black text-[var(--text-primary)]">{room.targetWord}</span>{' '}
              {t('board.endModalDescSuffix')}
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowEndConfirm(false)}
                className="duo-btn duo-btn-white flex-1 py-3.5 text-sm"
              >
                {t('board.endModalContinue')}
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
                {t('board.endModalConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
