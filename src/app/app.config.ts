import { Directionality } from '@angular/cdk/bidi';
import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { routes } from './app.routes';
import { AppDirectionality } from './core/i18n/app-directionality';
import { LocaleService } from './core/i18n/locale.service';
import { detectPreferredLang } from './core/i18n/locales';
import {
  APP_DATE_FORMATS,
  MultiCalendarDateAdapter,
} from './core/i18n/multi-calendar-date-adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideHttpClient(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'top',
      }),
    ),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: '/i18n/',
        suffix: '.json',
      }),
      fallbackLang: 'en',
      lang: 'en',
    }),
    AppDirectionality,
    { provide: Directionality, useExisting: AppDirectionality },
    { provide: MAT_DATE_LOCALE, useValue: detectPreferredLang() },
    { provide: DateAdapter, useClass: MultiCalendarDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: APP_DATE_FORMATS },
    provideAppInitializer(() => {
      inject(LocaleService).init();
    }),
  ],
};
