import React from 'react';
import { Globe } from 'lucide-react';
import { useI18n, type Locale } from '../i18n';

interface LanguageToggleProps {
  variant?: 'compact' | 'row';
}

const LOCALE_OPTIONS: Array<{ id: Locale; shortLabel: string; fullLabel: string }> = [
  { id: 'fr', shortLabel: 'FR', fullLabel: 'Français' },
  { id: 'en', shortLabel: 'EN', fullLabel: 'English' },
];

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ variant = 'compact' }) => {
  const { locale, setLocale, t } = useI18n();

  if (variant === 'row') {
    return (
      <div className="duo-card mt-3 flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: 'var(--duo-blue-bg)',
              color: 'var(--duo-blue)',
            }}
          >
            <Globe className="h-4 w-4 stroke-[2.5]" />
          </span>
          <span
            className="truncate text-sm font-black"
            style={{ color: 'var(--text-primary)' }}
          >
            {t('profile.languageLabel')}
          </span>
        </div>

        <div
          role="group"
          aria-label={t('language.switcherAria')}
          className="flex shrink-0 items-center rounded-xl border-2 p-0.5"
          style={{
            backgroundColor: 'var(--bg-muted)',
            borderColor: 'var(--border-tile)',
          }}
        >
          {LOCALE_OPTIONS.map((opt) => {
            const active = locale === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLocale(opt.id)}
                aria-pressed={active}
                className="rounded-lg px-3 py-1 text-xs font-black transition"
                style={{
                  backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                  color: active ? 'var(--duo-blue-text)' : 'var(--text-muted)',
                  boxShadow: active ? '0 1px 2px rgba(0, 0, 0, 0.08)' : undefined,
                }}
              >
                {opt.fullLabel}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={t('language.switcherAria')}
      className="inline-flex items-center rounded-full border-2 p-0.5"
      style={{
        backgroundColor: 'var(--bg-muted)',
        borderColor: 'var(--border-tile)',
      }}
    >
      {LOCALE_OPTIONS.map((opt) => {
        const active = locale === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setLocale(opt.id)}
            aria-pressed={active}
            className="rounded-full px-2.5 py-1 text-xs font-black tracking-wide transition"
            style={{
              backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: active ? '0 1px 2px rgba(0, 0, 0, 0.08)' : undefined,
            }}
          >
            {opt.shortLabel}
          </button>
        );
      })}
    </div>
  );
};
