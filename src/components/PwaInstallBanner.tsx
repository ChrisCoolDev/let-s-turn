import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X, Smartphone } from 'lucide-react';
import { useI18n } from '../i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'lets_turn_pwa_banner_dismissed';

export const PwaInstallBanner: React.FC = () => {
  const { t } = useI18n();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');

    const ua = window.navigator.userAgent.toLowerCase();
    const iosDetected = /iphone|ipad|ipod/.test(ua);
    setIsIos(iosDetected);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (isStandalone || dismissed) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDismissed(true);
      }
      setDeferredPrompt(null);
      return;
    }
    setShowIosGuide(true);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <>
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
            {t('pwa.bannerSubtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={handleInstallClick}
          className="duo-btn duo-btn-blue shrink-0 px-3.5 py-2 text-[13px]"
        >
          {isIos ? t('pwa.btnView') : t('pwa.btnInstall')}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-black/5"
          aria-label={t('pwa.dismissAria')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {showIosGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setShowIosGuide(false)}
        >
          <div
            className="duo-card animate-pop-in w-full max-w-sm p-5"
            style={{ backgroundColor: 'var(--bg-surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>
                {t('pwa.modalTitle')}
              </h3>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="rounded-full p-1 text-[var(--text-muted)] hover:bg-black/5"
                aria-label={t('common.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm font-bold" style={{ color: 'var(--text-muted)' }}>
              {isIos ? t('pwa.modalSubIos') : t('pwa.modalSubOther')}
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3 rounded-xl border-2 border-[var(--border-tile)] p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--duo-blue-bg)] text-[var(--duo-blue)]">
                  <Share className="h-5 w-5" />
                </div>
                <p className="text-xs font-extrabold">
                  {t('pwa.step1Prefix')}{' '}
                  <span className="text-[var(--duo-blue-text)]">{t('pwa.step1Highlight')}</span>{' '}
                  {t('pwa.step1Suffix')}
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-xl border-2 border-[var(--border-tile)] p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--duo-green-bg)] text-[var(--duo-green)]">
                  <PlusSquare className="h-5 w-5" />
                </div>
                <p className="text-xs font-extrabold">
                  {t('pwa.step2Prefix')}{' '}
                  <span className="text-[var(--duo-green-text)]">{t('pwa.step2Highlight')}</span>{' '}
                  {t('pwa.step2Suffix')}
                </p>
              </div>
              {!isIos && (
                <div className="flex items-center gap-3 rounded-xl border-2 border-[var(--border-tile)] p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--duo-orange-bg)] text-[var(--duo-orange)]">
                    <Download className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-extrabold">{t('pwa.step3Other')}</p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="duo-btn duo-btn-green mt-5 w-full py-3 text-sm"
            >
              {t('pwa.gotIt')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
