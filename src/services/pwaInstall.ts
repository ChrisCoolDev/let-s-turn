import { useCallback, useEffect, useState } from 'react';

export type PwaPlatform =
  | 'ios-safari'
  | 'ios-chrome'
  | 'ios-firefox'
  | 'ios-inapp'
  | 'other';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'lets_turn_pwa_banner_dismissed_v2';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function detectPwaPlatform(
  userAgent?: string,
  maxTouchPoints?: number
): PwaPlatform {
  const rawUa =
    userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const ua = rawUa.toLowerCase();
  const touchPoints =
    maxTouchPoints ??
    (typeof navigator !== 'undefined' ? navigator.maxTouchPoints ?? 0 : 0);

  const isIosDevice =
    /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && touchPoints > 1);
  if (!isIosDevice) return 'other';

  if (/crios/i.test(ua)) return 'ios-chrome';
  if (/fxios/i.test(ua)) return 'ios-firefox';

  const isKnownInApp =
    /fban|fbav|instagram|whatsapp|line\/|snapchat|tiktok|bytedance|musical_ly|linkedinapp|micromessenger|twitter|gsa\//i.test(
      ua
    );
  const lacksSafariOrEdge = !/safari/i.test(ua) && !/edgios/i.test(ua);
  if (isKnownInApp || lacksSafariOrEdge) return 'ios-inapp';

  return 'ios-safari';
}

function readBannerDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && ts > 0 && Date.now() - ts < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<PwaPlatform>(() => detectPwaPlatform());
  const [isStandalone, setIsStandalone] = useState<boolean>(() => isStandalonePwa());
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() =>
    readBannerDismissed()
  );
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    setPlatform(detectPwaPlatform());
    setIsStandalone(isStandalonePwa());
    setBannerDismissed(readBannerDismissed());

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setShowGuideModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    const mediaQuery = window.matchMedia?.('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsStandalone(true);
        setShowGuideModal(false);
      }
    };
    mediaQuery?.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery?.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setBannerDismissed(true);
      }
      setDeferredPrompt(null);
      return;
    }
    setShowGuideModal(true);
  }, [deferredPrompt]);

  const dismissBanner = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Ignore storage errors in private browsing contexts
    }
    setBannerDismissed(true);
  }, []);

  return {
    platform,
    isIos: platform !== 'other',
    isStandalone,
    canPromptNative: Boolean(deferredPrompt),
    bannerDismissed,
    showGuideModal,
    setShowGuideModal,
    triggerInstall,
    dismissBanner,
  };
}
