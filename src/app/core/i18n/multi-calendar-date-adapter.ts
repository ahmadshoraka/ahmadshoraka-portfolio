import { Injectable, inject } from '@angular/core';
import { DateAdapter, MAT_DATE_LOCALE, MatDateFormats } from '@angular/material/core';
import { AppLang, DEFAULT_LANG, LANG_META, calendarLocale, isAppLang } from './locales';

interface CalendarParts {
  year: number;
  month: number;
  day: number;
}

const DAY_MS = 86_400_000;

/** Search window for calendar -> timestamp lookups, roughly 1370–2570 CE. */
const SEARCH_RANGE_DAYS = 220_000;

const EASTERN_DIGITS = /[\u0660-\u0669\u06f0-\u06f9]/g;
const DIRECTIONALITY_MARKS = /[\u200e\u200f\u061c]/g;

function toLatinDigits(text: string): string {
  return text.replace(EASTERN_DIGITS, (char) => {
    const code = char.charCodeAt(0);
    return String(code - (code >= 0x06f0 ? 0x06f0 : 0x0660));
  });
}

function compareParts(candidate: CalendarParts, target: CalendarParts): number {
  return (
    candidate.year - target.year ||
    candidate.month - target.month ||
    candidate.day - target.day
  );
}

export const APP_DATE_FORMATS: MatDateFormats = {
  parse: { dateInput: null },
  display: {
    dateInput: { year: 'numeric', month: '2-digit', day: '2-digit' },
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  },
};

/**
 * Date adapter that renders the same underlying `Date` in the calendar system of the
 * active language: Gregorian for `en`, Jalali for `fa` and Hijri for `ar`.
 */
@Injectable()
export class MultiCalendarDateAdapter extends DateAdapter<Date> {
  private readonly formatters = new Map<string, Intl.DateTimeFormat>();
  private readonly nameLists = new Map<string, string[]>();

  constructor() {
    super();
    const initial = inject(MAT_DATE_LOCALE, { optional: true });
    this.setLocale(initial);
  }

  override setLocale(locale: unknown): void {
    super.setLocale(isAppLang(locale) ? locale : DEFAULT_LANG);
  }

  getYear(date: Date): number {
    return this.partsOf(date).year;
  }

  getMonth(date: Date): number {
    return this.partsOf(date).month - 1;
  }

  getDate(date: Date): number {
    return this.partsOf(date).day;
  }

  getDayOfWeek(date: Date): number {
    return date.getDay();
  }

  getMonthNames(style: 'long' | 'short' | 'narrow'): string[] {
    return this.cachedNames(`months-${style}`, () => {
      const format = this.displayFormatter({ month: style });
      const year = this.getYear(this.today());
      return Array.from({ length: 12 }, (_, month) =>
        this.clean(format.format(this.createDate(year, month, 1))),
      );
    });
  }

  getDateNames(): string[] {
    return this.cachedNames('dates', () => {
      const format = new Intl.NumberFormat(LANG_META[this.lang].intlLocale, {
        useGrouping: false,
      });
      return Array.from({ length: 31 }, (_, index) => this.clean(format.format(index + 1)));
    });
  }

  getDayOfWeekNames(style: 'long' | 'short' | 'narrow'): string[] {
    return this.cachedNames(`weekdays-${style}`, () => {
      const format = this.displayFormatter({ weekday: style });
      // 2017-01-01 was a Sunday, matching the 0-indexed contract.
      return Array.from({ length: 7 }, (_, index) =>
        this.clean(format.format(new Date(2017, 0, 1 + index))),
      );
    });
  }

  getYearName(date: Date): string {
    return this.clean(this.displayFormatter({ year: 'numeric' }).format(date));
  }

  getFirstDayOfWeek(): number {
    return LANG_META[this.lang].firstDayOfWeek;
  }

  getNumDaysInMonth(date: Date): number {
    const { year, month } = this.partsOf(date);
    const first = this.createDate(year, month - 1, 1);
    const nextFirst =
      month === 12 ? this.createDate(year + 1, 0, 1) : this.createDate(year, month, 1);
    return Math.round((nextFirst.getTime() - first.getTime()) / DAY_MS);
  }

  clone(date: Date): Date {
    return new Date(date.getTime());
  }

  createDate(year: number, month: number, date: number): Date {
    if (month < 0 || month > 11) {
      throw Error(`Invalid month index "${month}". Month has to be between 0 and 11.`);
    }
    if (date < 1) {
      throw Error(`Invalid date "${date}". Date has to be greater than 0.`);
    }

    if (LANG_META[this.lang].calendar === 'gregory') {
      const result = new Date(year, month, date);
      if (year >= 0 && year < 100) {
        result.setFullYear(year, month, date);
      }
      if (result.getMonth() !== month) {
        throw Error(`Invalid date "${date}" for month with index "${month}".`);
      }
      return result;
    }

    const found = this.findDate({ year, month: month + 1, day: date });
    if (!found) {
      throw Error(`Invalid date "${date}" for month with index "${month}".`);
    }
    return found;
  }

  today(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  parse(value: unknown): Date | null {
    if (value == null || value === '') {
      return null;
    }
    if (value instanceof Date) {
      return this.clone(value);
    }
    if (typeof value === 'number') {
      return new Date(value);
    }

    const numbers = toLatinDigits(String(value)).match(/\d+/g);
    if (!numbers || numbers.length < 3) {
      return this.invalid();
    }

    const [first, second, third] = numbers.slice(0, 3).map(Number);
    let year: number;
    let month: number;
    let day: number;

    if (first > 31) {
      [year, month, day] = [first, second, third];
    } else if (third > 31) {
      year = third;
      // Gregorian input follows the en-US month/day order, other calendars use day/month.
      [month, day] =
        LANG_META[this.lang].calendar === 'gregory' ? [first, second] : [second, first];
    } else {
      return this.invalid();
    }

    try {
      return this.createDate(year, month - 1, day);
    } catch {
      return this.invalid();
    }
  }

  format(date: Date, displayFormat: Intl.DateTimeFormatOptions): string {
    if (!this.isValid(date)) {
      throw Error('MultiCalendarDateAdapter: Cannot format invalid date.');
    }
    return this.clean(this.displayFormatter(displayFormat).format(date));
  }

  addCalendarYears(date: Date, years: number): Date {
    return this.addCalendarMonths(date, years * 12);
  }

  addCalendarMonths(date: Date, months: number): Date {
    const { year, month, day } = this.partsOf(date);
    const absoluteMonth = month - 1 + months;
    const targetYear = year + Math.floor(absoluteMonth / 12);
    const targetMonth = ((absoluteMonth % 12) + 12) % 12;
    const daysInTargetMonth = this.getNumDaysInMonth(this.createDate(targetYear, targetMonth, 1));
    return this.createDate(targetYear, targetMonth, Math.min(day, daysInTargetMonth));
  }

  addCalendarDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  toIso8601(date: Date): string {
    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  override deserialize(value: unknown): Date | null {
    if (typeof value === 'string') {
      if (!value) {
        return null;
      }
      const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
      if (iso) {
        return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      }
      const parsed = new Date(value);
      return this.isValid(parsed) ? parsed : this.invalid();
    }
    return super.deserialize(value);
  }

  isDateInstance(obj: unknown): boolean {
    return obj instanceof Date;
  }

  isValid(date: Date): boolean {
    return !Number.isNaN(date.getTime());
  }

  invalid(): Date {
    return new Date(NaN);
  }

  private get lang(): AppLang {
    return isAppLang(this.locale) ? this.locale : DEFAULT_LANG;
  }

  /** Calendar fields of `date`, always read with Latin digits so they can be parsed. */
  private partsOf(date: Date): CalendarParts {
    if (!this.isValid(date)) {
      return { year: NaN, month: NaN, day: NaN };
    }

    const parts = this.readerFormatter().formatToParts(date);
    const read = (type: Intl.DateTimeFormatPartTypes): number => {
      const part = parts.find((candidate) => candidate.type === type);
      return part ? Number(toLatinDigits(part.value)) : NaN;
    };

    return { year: read('year'), month: read('month'), day: read('day') };
  }

  /** Binary search for the timestamp whose calendar fields match `target`. */
  private findDate(target: CalendarParts): Date | null {
    let low = -SEARCH_RANGE_DAYS;
    let high = SEARCH_RANGE_DAYS;

    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = new Date(1970, 0, 1 + middle);
      const comparison = compareParts(this.partsOf(candidate), target);

      if (comparison === 0) {
        return candidate;
      }
      if (comparison < 0) {
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    return null;
  }

  private readerFormatter(): Intl.DateTimeFormat {
    const { calendar } = LANG_META[this.lang];
    return this.formatter(`en-US-u-ca-${calendar}-nu-latn`, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  }

  private displayFormatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    return this.formatter(calendarLocale(this.lang), options);
  }

  private formatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const key = `${locale}|${JSON.stringify(options)}`;
    let formatter = this.formatters.get(key);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat(locale, options);
      this.formatters.set(key, formatter);
    }
    return formatter;
  }

  private cachedNames(kind: string, build: () => string[]): string[] {
    const key = `${this.lang}|${kind}`;
    let names = this.nameLists.get(key);
    if (!names) {
      names = build();
      this.nameLists.set(key, names);
    }
    return names;
  }

  private clean(text: string): string {
    return text.replace(DIRECTIONALITY_MARKS, '').trim();
  }
}
