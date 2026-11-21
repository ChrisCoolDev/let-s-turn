import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Copy,
  Download,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
  SquareStack,
  X,
} from 'lucide-react';
import { useI18n, type TranslationKey } from '../i18n';
import type { PwaPlatform } from '../services/pwaInstall';

interface PwaInstallBannerProps {
  isStandalone: boolean;
  bannerDismissed: boolean;
  isIos: boolean;
  platform: PwaPlatform;
  onInstallClick: () => void;
  onDismiss: () => void;
}

export const PwaInstallBanner: React.FC<PwaInstallBannerProps> = ({
  isStandalone,
  bannerDismissed,
  isIos,
  onInstallClick,
  onDismiss,
}) => {
  const { t } = useI18n();

  if (isStandalone || bannerDismissed) return null;

  return (
    <div
      className="duo-card mx-auto mt-4 flex w-full items-center gap-3 p-3.5 shadow-sm"
      style={{ backgroundColor: 'var(--bg-muted)' }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--duo-blue-bg)] text-[var(--duo-blue)]">
        <Smartphone className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold leading-tight" style={{ color: 'var(--text-primary)' }}>
          {t('pwa.bannerTitle')}
        </p>
        <p className="mt-0.5 text-[13px] font-bold leading-snug" style={{ color: 'var(--text-muted)' }}>
          {isIos ? t('pwa.bannerSubtitleIos') : t('pwa.bannerSubtitle')}
        </p>
      </div>
      <button
        type="button"
        onClick={onInstallClick}
        className="duo-btn duo-btn-blue shrink-0 px-3.5 py-2 text-[13px]"
      >
        {isIos ? t('pwa.btnInstallIos') : t('pwa.btnInstall')}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-black/5"
        aria-label={t('pwa.dismissAria')}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

interface StepRowProps {
  number: number;
  accent?: 'blue' | 'green' | 'orange';
  children: React.ReactNode;
  preview?: React.ReactNode;
}

const ACCENT_STYLES: Record<'blue' | 'green' | 'orange', { bg: string; fg: string }> = {
  blue: { bg: 'var(--duo-blue)', fg: '#ffffff' },
  green: { bg: 'var(--duo-green)', fg: '#ffffff' },
  orange: { bg: 'var(--duo-orange)', fg: '#ffffff' },
};

const StepRow: React.FC<StepRowProps> = ({ number, accent = 'blue', children, preview }) => {
  const palette = ACCENT_STYLES[accent];
  return (
    <div
      className="rounded-2xl border-2 p-3"
      style={{
        borderColor: 'var(--border-tile)',
        backgroundColor: 'var(--bg-muted)',
      }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black"
          style={{ backgroundColor: palette.bg, color: palette.fg }}
        >
          {number}
        </span>
        <div className="min-w-0 flex-1 text-xs font-extrabold leading-relaxed" style={{ color: 'var(--text-primary)' }}>
          {children}
        </div>
      </div>
      {preview && <div className="mt-2.5">{preview}</div>}
    </div>
  );
};

const ShareSheetPreview: React.FC<{ label: string }> = ({ label }) => (
  <div
    className="flex items-center justify-between rounded-xl border px-3 py-2 shadow-sm"
    style={{
      borderColor: 'var(--border-tile)',
      backgroundColor: 'var(--bg-surface)',
    }}
    aria-hidden="true"
  >
    <span className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>
      {label}
    </span>
    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--duo-green-bg)] text-[var(--duo-green-text)]">
      <PlusSquare className="h-4 w-4 stroke-[2.25]" />
    </span>
  </div>
);

const AddConfirmPreview: React.FC<{ addLabel: string }> = ({ addLabel }) => (
  <div
    className="flex items-center justify-between rounded-xl border px-3 py-2 shadow-sm"
    style={{
      borderColor: 'var(--border-tile)',
      backgroundColor: 'var(--bg-surface)',
    }}
    aria-hidden="true"
  >
    <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
      Let&apos;s Turn
    </span>
    <span className="rounded-lg bg-[var(--duo-blue)] px-2.5 py-0.5 text-xs font-black text-white">
      {addLabel}
    </span>
  </div>
);

interface PwaInstallModalProps {
  open: boolean;
  platform: PwaPlatform;
  onClose: () => void;
}

const PLATFORM_BADGE_KEY: Record<PwaPlatform, TranslationKey> = {
  'ios-safari': 'pwa.badgeIosSafari',
  'ios-chrome': 'pwa.badgeIosChrome',
  'ios-firefox': 'pwa.badgeIosFirefox',
  'ios-inapp': 'pwa.badgeIosInapp',
  other: 'pwa.badgeOther',
};

const PLATFORM_SUB_KEY: Record<PwaPlatform, TranslationKey> = {
  'ios-safari': 'pwa.modalSubIosSafari',
  'ios-chrome': 'pwa.modalSubIosChrome',
  'ios-firefox': 'pwa.modalSubIosFirefox',
  'ios-inapp': 'pwa.modalSubIosInapp',
  other: 'pwa.modalSubOther',
};

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({ open, platform, onClose }) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleCopyLink = async () => {
    const url = window.location.href;
    let success = false;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(url);
        success = true;
      } catch {
        success = false;
      }
    }
    if (!success) {
      try {
        const input = document.createElement('textarea');
        input.value = url;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        success = document.execCommand('copy');
        document.body.removeChild(input);
      } catch {
        success = false;
      }
    }
    if (success) {
      setCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2600);
    }
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-title"
        className="animate-sheet-up max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t-2 px-4 pb-6 pt-5 shadow-2xl sm:rounded-3xl sm:border-2 sm:p-5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-tile)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-3 h-1 w-10 rounded-full opacity-35 sm:hidden"
          style={{ backgroundColor: 'var(--text-muted)' }}
        />

        {/* En-tête */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/icon-192.png"
              alt="Let's Turn"
              className="h-11 w-11 shrink-0 rounded-xl border border-[var(--border-tile)] shadow-sm"
            />
            <div className="min-w-0">
              <h3
                id="pwa-install-title"
                className="truncate text-lg font-black leading-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('pwa.modalTitle')}
              </h3>
              <span
                className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-black"
                style={{
                  backgroundColor:
                    platform === 'ios-inapp' ? 'var(--duo-orange-bg)' : 'var(--duo-blue-bg)',
                  color:
                    platform === 'ios-inapp'
                      ? 'var(--duo-orange-shadow)'
                      : 'var(--duo-blue-text)',
                }}
              >
                {t(PLATFORM_BADGE_KEY[platform])}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-[var(--text-muted)] hover:bg-black/5"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p
          className="mt-3 text-sm font-bold leading-snug"
          style={{
            color:
              platform === 'ios-inapp' ? 'var(--duo-orange-shadow)' : 'var(--text-muted)',
          }}
        >
          {t(PLATFORM_SUB_KEY[platform])}
        </p>

        {/* Instructions adaptées au navigateur détecté */}
        <div className="mt-3.5 space-y-2.5">
          {platform === 'ios-safari' && (
            <>
              <StepRow
                number={1}
                accent="blue"
                preview={
                  <div
                    className="flex items-center justify-between rounded-xl border px-3 py-1.5 shadow-sm"
                    style={{
                      borderColor: 'var(--border-tile)',
                      backgroundColor: 'var(--bg-surface)',
                    }}
                    aria-hidden="true"
                  >
                    <ChevronLeft className="h-4 w-4 text-[var(--text-muted)] opacity-60" />
                    <ChevronRight className="h-4 w-4 text-[var(--text-muted)] opacity-35" />
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--duo-blue)] text-white shadow-sm ring-4 ring-[var(--duo-blue)]/25">
                      <Share className="h-4 w-4 stroke-[2.5]" />
                    </span>
                    <Bookmark className="h-4 w-4 text-[var(--text-muted)] opacity-60" />
                    <SquareStack className="h-4 w-4 text-[var(--text-muted)] opacity-60" />
                  </div>
                }
              >
                {t('pwa.iosSafariStep1Prefix')}{' '}
                <span className="font-black text-[var(--duo-blue-text)]">
                  {t('pwa.step1Highlight')}
                </span>{' '}
                {t('pwa.iosSafariStep1Suffix')}
              </StepRow>

              <StepRow
                number={2}
                accent="green"
                preview={<ShareSheetPreview label={t('pwa.step2Highlight')} />}
              >
                {t('pwa.iosStep2Prefix')}{' '}
                <span className="font-black text-[var(--duo-green-text)]">
                  {t('pwa.step2Highlight')}
                </span>
              </StepRow>

              <StepRow
                number={3}
                accent="orange"
                preview={<AddConfirmPreview addLabel={t('pwa.iosAddButton')} />}
              >
                {t('pwa.iosStep3Prefix')}{' '}
                <span className="font-black text-[var(--duo-blue-text)]">
                  {t('pwa.iosAddButton')}
                </span>{' '}
                {t('pwa.iosStep3Suffix')}
              </StepRow>
            </>
          )}

          {platform === 'ios-chrome' && (
            <>
              <StepRow
                number={1}
                accent="blue"
                preview={
                  <div
                    className="flex items-center justify-between rounded-xl border px-3 py-1.5 shadow-sm"
                    style={{
                      borderColor: 'var(--border-tile)',
                      backgroundColor: 'var(--bg-surface)',
                    }}
                    aria-hidden="true"
                  >
                    <span
                      className="rounded-md px-2 py-0.5 text-[11px] font-bold"
                      style={{
                        backgroundColor: 'var(--bg-muted)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      lets-turn
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--duo-blue)] text-white shadow-sm ring-4 ring-[var(--duo-blue)]/25">
                      <Share className="h-3.5 w-3.5 stroke-[2.5]" />
                    </span>
                  </div>
                }
              >
                {t('pwa.iosChromeStep1Prefix')}{' '}
                <span className="font-black text-[var(--duo-blue-text)]">
                  {t('pwa.step1Highlight')}
                </span>{' '}
                {t('pwa.iosChromeStep1Suffix')}
              </StepRow>

              <StepRow
                number={2}
                accent="green"
                preview={<ShareSheetPreview label={t('pwa.step2Highlight')} />}
              >
                {t('pwa.iosStep2Prefix')}{' '}
                <span className="font-black text-[var(--duo-green-text)]">
                  {t('pwa.step2Highlight')}
                </span>
              </StepRow>

              <StepRow
                number={3}
                accent="orange"
                preview={<AddConfirmPreview addLabel={t('pwa.iosAddButton')} />}
              >
                {t('pwa.iosStep3Prefix')}{' '}
                <span className="font-black text-[var(--duo-blue-text)]">
                  {t('pwa.iosAddButton')}
                </span>{' '}
                {t('pwa.iosStep3Suffix')}
              </StepRow>
            </>
          )}

          {platform === 'ios-inapp' && (
            <>
              <div
                className="flex items-start gap-3 rounded-2xl border-2 p-3"
                style={{
                  borderColor: 'var(--duo-orange)',
                  backgroundColor: 'var(--duo-orange-bg)',
                }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--duo-orange)] text-white">
                  <Compass className="h-5 w-5" />
                </span>
                <p
                  className="text-xs font-extrabold leading-relaxed"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {t('pwa.inappStep1')}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className={`duo-btn flex w-full items-center justify-center gap-2 py-3 text-sm ${
                  copied ? 'duo-btn-green' : 'duo-btn-blue'
                }`}
              >
                {copied ? <Check className="h-4 w-4 stroke-[3]" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? t('pwa.linkCopied') : t('pwa.copyLink')}</span>
              </button>

              <StepRow
                number={2}
                accent="green"
                preview={<ShareSheetPreview label={t('pwa.step2Highlight')} />}
              >
                {t('pwa.inappStep2')}
              </StepRow>
            </>
          )}

          {platform === 'ios-firefox' && (
            <>
              <button
                type="button"
                onClick={handleCopyLink}
                className={`duo-btn flex w-full items-center justify-center gap-2 py-3 text-sm ${
                  copied ? 'duo-btn-green' : 'duo-btn-blue'
                }`}
              >
                {copied ? <Check className="h-4 w-4 stroke-[3]" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? t('pwa.linkCopied') : t('pwa.copyLink')}</span>
              </button>

              <StepRow
                number={2}
                accent="green"
                preview={<ShareSheetPreview label={t('pwa.step2Highlight')} />}
              >
                {t('pwa.inappStep2')}
              </StepRow>
            </>
          )}

          {platform === 'other' && (
            <>
              <StepRow number={1} accent="blue">
                <span className="inline-flex items-center gap-1 align-middle">
                  <MoreVertical className="h-4 w-4 text-[var(--duo-blue)]" />
                </span>{' '}
                {t('pwa.otherStep1')}
              </StepRow>

              <StepRow number={2} accent="green">
                <span className="inline-flex items-center gap-1 align-middle">
                  <Download className="h-4 w-4 text-[var(--duo-green)]" />
                </span>{' '}
                {t('pwa.otherStep2')}
              </StepRow>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="duo-btn duo-btn-green mt-4 w-full py-3 text-sm"
        >
          {t('pwa.gotIt')}
        </button>

        {platform === 'ios-safari' && (
          <div className="mt-3 flex flex-col items-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--duo-blue-bg)] px-3 py-1 text-xs font-black text-[var(--duo-blue-text)]">
              <span>{t('pwa.iosSafariPointer')}</span>
              <ArrowDown className="h-3.5 w-3.5 animate-bounce stroke-[3]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
