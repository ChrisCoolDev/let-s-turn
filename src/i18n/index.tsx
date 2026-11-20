import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { en, fr, type TranslationKey } from './translations';

export type Locale = 'fr' | 'en';
export type { TranslationKey };

export const LOCALE_STORAGE_KEY = 'lets_turn_locale_v1';

const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = {
  fr,
  en,
};

export function getStoredLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'fr' || saved === 'en') {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }

  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
    return navigator.language.toLowerCase().startsWith('en') ? 'en' : 'fr';
  }
  return 'fr';
}

let activeLocale: Locale = getStoredLocale();

export function getActiveLocale(): Locale {
  return activeLocale;
}

export function isPlural(count: number, locale: Locale = activeLocale): boolean {
  return locale === 'fr' ? count > 1 : count !== 1;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`
  );
}

export function translate(
  key: TranslationKey,
  params?: Record<string, string | number>,
  locale: Locale = activeLocale
): string {
  const dict = DICTIONARIES[locale] ?? fr;
  const template = dict[key] ?? fr[key] ?? key;
  return interpolate(template, params);
}

export function formatMoveCount(count: number, locale: Locale = activeLocale): string {
  const key: TranslationKey = isPlural(count, locale) ? 'common.moveMany' : 'common.moveOne';
  return translate(key, { count }, locale);
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  intlLocale: string;
  formatMoves: (count: number) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => getStoredLocale());

  const setLocale = useCallback((next: Locale) => {
    activeLocale = next;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
    setLocaleState(next);
  }, []);

  useEffect(() => {
    activeLocale = locale;
    document.documentElement.lang = locale;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', translate('language.metaDescription', undefined, locale));
    }
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      setLocale,
      t: (key, params) => translate(key, params, locale),
      intlLocale: locale === 'en' ? 'en-US' : 'fr-FR',
      formatMoves: (count) => formatMoveCount(count, locale),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return {
    locale: activeLocale,
    setLocale: (next) => {
      activeLocale = next;
    },
    t: (key, params) => translate(key, params, activeLocale),
    intlLocale: activeLocale === 'en' ? 'en-US' : 'fr-FR',
    formatMoves: (count) => formatMoveCount(count, activeLocale),
  };
}
