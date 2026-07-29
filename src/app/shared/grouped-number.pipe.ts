import { Pipe, PipeTransform } from '@angular/core';

/**
 * Groups digits in threes with a dot, e.g. `100500` -> `100.500`.
 * Decimals use a comma so they stay distinguishable from the group separator.
 */
@Pipe({ name: 'groupedNumber' })
export class GroupedNumberPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    if (value == null || value === '') {
      return '';
    }

    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      return '';
    }

    const rounded = Math.round(Math.abs(numeric) * 100) / 100;
    const [whole, fraction] = rounded.toString().split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const formatted = fraction ? `${grouped},${fraction}` : grouped;

    return numeric < 0 ? `-${formatted}` : formatted;
  }
}
