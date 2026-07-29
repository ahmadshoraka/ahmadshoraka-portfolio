export const SUPPORTED_LANGS = ['en', 'fa', 'ar'] as const;

export type AppLang = (typeof SUPPORTED_LANGS)[number];

export const DEFAULT_LANG: AppLang = 'en';

export type AppCalendar = 'gregory' | 'persian' | 'islamic-umalqura';

export interface LangMeta {
  label: string;
  dir: 'ltr' | 'rtl';
  nativeName: string;
  intlLocale: string;
  calendar: AppCalendar;
  firstDayOfWeek: number;
}

export const LANG_META: Record<AppLang, LangMeta> = {
  en: {
    label: 'EN',
    dir: 'ltr',
    nativeName: 'English',
    intlLocale: 'en-US',
    calendar: 'gregory',
    firstDayOfWeek: 0,
  },
  fa: {
    label: 'FA',
    dir: 'rtl',
    nativeName: 'فارسی',
    intlLocale: 'fa-IR',
    calendar: 'persian',
    firstDayOfWeek: 6,
  },
  ar: {
    label: 'AR',
    dir: 'rtl',
    nativeName: 'العربية',
    intlLocale: 'ar-SA',
    calendar: 'islamic-umalqura',
    firstDayOfWeek: 6,
  },
};

/** BCP 47 tag that pins the calendar system, e.g. `fa-IR-u-ca-persian`. */
export function calendarLocale(lang: AppLang): string {
  const meta = LANG_META[lang];
  return `${meta.intlLocale}-u-ca-${meta.calendar}`;
}

export function isAppLang(value: unknown): value is AppLang {
  return typeof value === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(value);
}

export function detectPreferredLang(): AppLang {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('lang');
    if (isAppLang(stored)) {
      return stored;
    }
  }

  if (typeof navigator !== 'undefined') {
    const nav = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase();
    if (nav.startsWith('fa')) return 'fa';
    if (nav.startsWith('ar')) return 'ar';
  }

  return DEFAULT_LANG;
}
