import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useI18n } from '../i18n';

export interface TourStep {
  id: string;
  targetSelector: string;
  title: string;
  description: string;
  preferredPlacement?: 'top' | 'bottom';
  highlightRadius?: number;
  padding?: number;
}

interface AppTourProps {
  open: boolean;
  steps: TourStep[];
  onComplete: () => void;
  onSkip: () => void;
}

interface SpotRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface BubbleLayout {
  left: number;
  top: number;
  width: number;
  placement: 'top' | 'bottom';
  caretLeft: number;
}

function resolveAvailableSteps(steps: TourStep[]): TourStep[] {
  if (typeof document === 'undefined') return [];
  return steps.filter((step) => {
    const el = document.querySelector(step.targetSelector);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export const AppTour: React.FC<AppTourProps> = ({ open, steps, onComplete, onSkip }) => {
  const { t } = useI18n();
  const maskId = useId().replace(/:/g, '');
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [resolvedSteps, setResolvedSteps] = useState<TourStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotRect, setSpotRect] = useState<SpotRect | null>(null);
  const [bubbleLayout, setBubbleLayout] = useState<BubbleLayout | null>(null);

  const currentStep = open ? resolvedSteps[stepIndex] ?? null : null;

  // Resolve DOM targets whenever the tour opens or its steps definition changes
  useEffect(() => {
    if (!open) {
      setResolvedSteps([]);
      setSpotRect(null);
      setBubbleLayout(null);
      return;
    }

    setStepIndex(0);

    let cancelled = false;
    const resolve = () => {
      if (cancelled) return;
      const available = resolveAvailableSteps(steps);
      if (available.length > 0) {
        setResolvedSteps(available);
      } else {
        onCompleteRef.current();
      }
    };

    const immediate = resolveAvailableSteps(steps);
    if (immediate.length > 0) {
      setResolvedSteps(immediate);
      return () => {
        cancelled = true;
      };
    }

    const rafId = window.requestAnimationFrame(resolve);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [open, steps]);

  const measureAndPosition = useCallback(() => {
    if (!open || !currentStep) return;
    const targetEl = document.querySelector(currentStep.targetSelector);
    if (!targetEl) return;

    const raw = targetEl.getBoundingClientRect();
    if (raw.width === 0 || raw.height === 0) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = currentStep.padding ?? 8;

    const spotLeft = clamp(raw.left - pad, 4, vw - 8);
    const spotTop = clamp(raw.top - pad, 4, vh - 8);
    const spotRight = Math.min(vw - 4, raw.right + pad);
    const spotBottom = Math.min(vh - 4, raw.bottom + pad);
    const spot: SpotRect = {
      left: spotLeft,
      top: spotTop,
      width: Math.max(12, spotRight - spotLeft),
      height: Math.max(12, spotBottom - spotTop),
    };
    setSpotRect(spot);

    const bubbleWidth = Math.min(352, vw - 28);
    const spotCenterX = spot.left + spot.width / 2;
    const bubbleLeft = clamp(spotCenterX - bubbleWidth / 2, 14, Math.max(14, vw - bubbleWidth - 14));
    const caretLeft = clamp(spotCenterX - bubbleLeft - 10, 22, bubbleWidth - 42);

    const measuredHeight = bubbleRef.current?.getBoundingClientRect().height || 216;
    const gap = 16;
    const fitsBelow = spot.top + spot.height + gap + measuredHeight <= vh - 14;
    const fitsAbove = spot.top - gap - measuredHeight >= 14;
    const preferred = currentStep.preferredPlacement ?? 'bottom';

    let placement: 'top' | 'bottom' = preferred;
    if (preferred === 'bottom' && !fitsBelow && fitsAbove) {
      placement = 'top';
    } else if (preferred === 'top' && !fitsAbove && fitsBelow) {
      placement = 'bottom';
    } else if (!fitsAbove && !fitsBelow) {
      const spaceBelow = vh - (spot.top + spot.height);
      const spaceAbove = spot.top;
      placement = spaceBelow >= spaceAbove ? 'bottom' : 'top';
    }

    const rawTop =
      placement === 'bottom'
        ? spot.top + spot.height + gap
        : spot.top - gap - measuredHeight;
    const bubbleTop = clamp(rawTop, 14, Math.max(14, vh - measuredHeight - 14));

    setBubbleLayout({
      left: bubbleLeft,
      top: bubbleTop,
      width: bubbleWidth,
      placement,
      caretLeft,
    });
  }, [open, currentStep]);

  // Scroll target into comfortable view on step change, then measure
  useEffect(() => {
    if (!open || !currentStep) return;
    const targetEl = document.querySelector(currentStep.targetSelector);
    if (!targetEl) return;

    const r = targetEl.getBoundingClientRect();
    const isTall = r.height > window.innerHeight * 0.34;
    const needsScroll =
      r.top < 24 ||
      r.bottom > window.innerHeight - 24 ||
      (isTall && currentStep.preferredPlacement === 'top' && r.top < 240);
    if (needsScroll) {
      const block: ScrollLogicalPosition = isTall
        ? currentStep.preferredPlacement === 'top'
          ? 'end'
          : 'start'
        : 'center';
      targetEl.scrollIntoView({ behavior: 'smooth', block });
    }

    const settleTimer1 = window.setTimeout(measureAndPosition, 260);
    const settleTimer2 = window.setTimeout(measureAndPosition, 540);
    return () => {
      window.clearTimeout(settleTimer1);
      window.clearTimeout(settleTimer2);
    };
  }, [open, currentStep, measureAndPosition]);

  // Synchronous pre-paint measurement & observers
  useLayoutEffect(() => {
    if (!open || !currentStep) return;
    measureAndPosition();
    const rafId = window.requestAnimationFrame(measureAndPosition);

    const targetEl = document.querySelector(currentStep.targetSelector);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => measureAndPosition())
        : null;
    if (resizeObserver) {
      if (targetEl) resizeObserver.observe(targetEl);
      if (bubbleRef.current) resizeObserver.observe(bubbleRef.current);
    }

    window.addEventListener('resize', measureAndPosition);
    window.addEventListener('scroll', measureAndPosition, true);
    window.addEventListener('orientationchange', measureAndPosition);

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureAndPosition);
      window.removeEventListener('scroll', measureAndPosition, true);
      window.removeEventListener('orientationchange', measureAndPosition);
    };
  }, [open, currentStep, measureAndPosition]);

  const handleNext = useCallback(() => {
    if (stepIndex + 1 >= resolvedSteps.length) {
      onComplete();
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex, resolvedSteps.length, onComplete]);

  const handleBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!open || !currentStep) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' && stepIndex > 0) {
        e.preventDefault();
        handleBack();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, currentStep, stepIndex, handleNext, handleBack, onSkip]);

  if (!open || !currentStep) return null;

  const isLast = stepIndex + 1 >= resolvedSteps.length;
  const radius = currentStep.highlightRadius ?? 18;

  return (
    <>
      {/* Dimmed spotlight backdrop with rounded SVG cutout */}
      <div
        className="animate-fade-in fixed inset-0 z-[70]"
        onClick={(e) => e.stopPropagation()}
        aria-hidden="true"
      >
        <svg className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <mask id={maskId}>
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {spotRect && (
                <rect
                  x={spotRect.left}
                  y={spotRect.top}
                  width={spotRect.width}
                  height={spotRect.height}
                  rx={radius}
                  ry={radius}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(15, 23, 42, 0.46)"
            mask={`url(#${maskId})`}
          />
        </svg>
      </div>

      {/* Pulsing Duolingo blue highlight ring around spotlighted widget */}
      {spotRect && (
        <div
          className="animate-tour-ring pointer-events-none fixed z-[71] border-[3px] border-[var(--duo-blue)] transition-all duration-200"
          style={{
            left: spotRect.left,
            top: spotRect.top,
            width: spotRect.width,
            height: spotRect.height,
            borderRadius: radius,
          }}
          aria-hidden="true"
        />
      )}

      {/* Duolingo vibrant sky-blue speech bubble */}
      <div
        ref={bubbleRef}
        key={currentStep.id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`tour-title-${currentStep.id}`}
        className="animate-tour-pop fixed z-[72] overflow-visible rounded-[20px]"
        style={{
          left: bubbleLayout?.left ?? 14,
          top: bubbleLayout?.top ?? 120,
          width: bubbleLayout?.width ?? 'calc(100vw - 28px)',
          backgroundColor: 'var(--duo-blue)',
          boxShadow: '0 5px 0 var(--duo-blue-shadow), 0 18px 38px rgba(0, 0, 0, 0.24)',
          visibility: bubbleLayout ? 'visible' : 'hidden',
        }}
      >
        {/* Top directional caret when bubble appears below target */}
        {bubbleLayout?.placement === 'bottom' && (
          <svg
            viewBox="0 0 20 10"
            className="pointer-events-none absolute -top-[9px] h-[10px] w-[20px]"
            style={{ left: bubbleLayout.caretLeft }}
            aria-hidden="true"
          >
            <polygon points="10,0 20,10 0,10" fill="var(--duo-blue)" />
          </svg>
        )}

        {/* Bottom directional caret with 3D shadow lip when bubble appears above target */}
        {bubbleLayout?.placement === 'top' && (
          <svg
            viewBox="0 0 20 15"
            className="pointer-events-none absolute -bottom-[14px] h-[15px] w-[20px]"
            style={{ left: bubbleLayout.caretLeft }}
            aria-hidden="true"
          >
            <polygon points="0,4 20,4 10,15" fill="var(--duo-blue-shadow)" />
            <polygon points="0,0 20,0 10,11" fill="var(--duo-blue)" />
          </svg>
        )}

        {/* Decorative Duolingo sparkles inside corners */}
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute right-14 top-3 h-3 w-3 text-white opacity-30"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M12 0L14.8 9.2L24 12L14.8 14.8L12 24L9.2 14.8L0 12L9.2 9.2Z" />
        </svg>
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute bottom-16 right-4 h-4 w-4 text-white opacity-25"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M12 0L14.8 9.2L24 12L14.8 14.8L12 24L9.2 14.8L0 12L9.2 9.2Z" />
        </svg>
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute bottom-3.5 left-3.5 h-2.5 w-2.5 text-white opacity-30"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M12 0L14.8 9.2L24 12L14.8 14.8L12 24L9.2 14.8L0 12L9.2 9.2Z" />
        </svg>

        <div className="relative p-5">
          {/* Meta row: optional back + step counter / discreet Skip */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full text-white/85 transition hover:bg-white/15 hover:text-white"
                  aria-label={t('tour.backAria')}
                >
                  <ChevronLeft className="h-4 w-4 stroke-[3]" />
                </button>
              )}
              <span className="text-[13px] font-extrabold text-white/85">
                {t('tour.stepCounter', {
                  current: stepIndex + 1,
                  total: resolvedSteps.length,
                })}
              </span>
            </div>

            <button
              type="button"
              onClick={onSkip}
              className="rounded-lg px-2 py-0.5 text-[12.5px] font-extrabold uppercase tracking-wider text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              {t('tour.skip')}
            </button>
          </div>

          <h2
            id={`tour-title-${currentStep.id}`}
            className="mt-1.5 text-[20px] font-black leading-tight text-white"
          >
            {currentStep.title}
          </h2>
          <p className="mt-1.5 text-[14.5px] font-bold leading-snug text-white/95">
            {currentStep.description}
          </p>

          {/* Pill dots progress indicator */}
          <div className="mt-3.5 mb-4 flex items-center gap-1.5" aria-hidden="true">
            {resolvedSteps.map((s, idx) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  idx === stepIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>

          {/* Chunky white 3D CTA button matching Duolingo's popover style */}
          <button
            type="button"
            onClick={handleNext}
            className="w-full cursor-pointer rounded-[14px] bg-white py-3.5 text-center text-[15px] font-black uppercase tracking-wider transition active:translate-y-[2px]"
            style={{
              color: 'var(--duo-blue)',
              boxShadow: '0 4px 0 rgba(0, 0, 0, 0.14)',
            }}
          >
            {isLast ? t('tour.finish') : t('tour.next')}
          </button>
        </div>
      </div>
    </>
  );
};
