import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LocaleService } from '../../core/i18n/locale.service';
import { AppLang, LANG_META, SUPPORTED_LANGS } from '../../core/i18n/locales';

@Component({
  selector: 'app-language-switcher',
  imports: [RouterLink],
  templateUrl: './language-switcher.html',
  styleUrl: './language-switcher.scss',
})
export class LanguageSwitcher {
  private readonly locale = inject(LocaleService);
  private readonly router = inject(Router);

  readonly langs = SUPPORTED_LANGS;
  readonly meta = LANG_META;

  current(): AppLang {
    return this.locale.lang();
  }

  linkFor(lang: AppLang): string[] {
    const url = this.router.url;
    const segments = url.split('?')[0].split('#')[0].split('/').filter(Boolean);
    if (segments.length === 0) {
      return ['/', lang];
    }
    segments[0] = lang;
    return ['/', ...segments];
  }
}
