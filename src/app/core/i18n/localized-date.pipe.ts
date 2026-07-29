import { Pipe, PipeTransform } from '@angular/core';
import { AppLang, DEFAULT_LANG, calendarLocale, isAppLang } from './locales';

export type LocalizedDateStyle = 'medium' | 'short' | 'long';

const STYLES: Record<LocalizedDateStyle, Intl.DateTimeFormatOptions> = {
  short: { year: 'numeric', month: '2-digit', day: '2-digit' },
  medium: { year: 'numeric', month: 'short', day: 'numeric' },
  long: { year: 'numeric', month: 'long', day: 'numeric' },
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(lang: AppLang, style: LocalizedDateStyle): Intl.DateTimeFormat {
  const key = `${lang}|${style}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(calendarLocale(lang), STYLES[style]);
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Renders a date in the calendar system of the given language (Gregorian, Jalali or Hijri). */
@Pipe({ name: 'localizedDate' })
export class LocalizedDatePipe implements PipeTransform {
  transform(
    value: string | number | Date | null | undefined,
    lang: string,
    style: LocalizedDateStyle = 'medium',
  ): string {
    if (value == null || value === '') {
      return '';
    }

    const date = this.toDate(value);
    if (!date || Number.isNaN(date.getTime())) {
      return '';
    }

    return formatterFor(isAppLang(lang) ? lang : DEFAULT_LANG, style)
      .format(date)
      .replace(/[\u200e\u200f\u061c]/g, '');
  }

  private toDate(value: string | number | Date): Date | null {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'number') {
      return new Date(value);
    }

    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (iso) {
      // Parse date-only strings as local time so the day never shifts.
      return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    }
    return new Date(value);
  }
}
