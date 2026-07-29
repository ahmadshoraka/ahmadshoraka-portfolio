import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import { Title } from '@angular/platform-browser';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, isObservable } from 'rxjs';
import { AppDirectionality } from './app-directionality';
import {
  AppLang,
  LANG_META,
  detectPreferredLang,
  isAppLang,
} from './locales';

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private readonly document = inject(DOCUMENT);
  private readonly translate = inject(TranslateService);
  private readonly title = inject(Title);
  private readonly directionality = inject(AppDirectionality);
  private readonly dateAdapter = inject(DateAdapter);

  readonly lang = signal<AppLang>(detectPreferredLang());

  init(): void {
    this.translate.addLangs(['en', 'fa', 'ar']);
    void this.apply(this.lang());
  }

  async use(lang: string): Promise<AppLang> {
    const next = isAppLang(lang) ? lang : detectPreferredLang();
    await this.apply(next);
    return next;
  }

  private async apply(lang: AppLang): Promise<void> {
    this.lang.set(lang);
    localStorage.setItem('lang', lang);

    const meta = LANG_META[lang];
    const html = this.document.documentElement;
    html.lang = lang;
    html.dir = meta.dir;
    html.dataset['lang'] = lang;
    this.directionality.value = meta.dir;
    this.dateAdapter.setLocale(lang);

    const result = this.translate.use(lang);
    if (isObservable(result)) {
      await firstValueFrom(result);
    } else {
      await result;
    }

    this.title.setTitle(this.translate.instant('meta.title'));

    const description = this.document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute('content', this.translate.instant('meta.description'));
    }
  }
}
