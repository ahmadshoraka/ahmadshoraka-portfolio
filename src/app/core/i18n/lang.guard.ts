import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { LocaleService } from './locale.service';
import { detectPreferredLang, isAppLang } from './locales';

export const langGuard: CanActivateFn = async (route, state) => {
  const langParam = route.paramMap.get('lang');
  const locale = inject(LocaleService);
  const router = inject(Router);

  if (!isAppLang(langParam)) {
    const preferred = detectPreferredLang();
    const rest = state.url.split(/[?#]/)[0].split('/').filter(Boolean).slice(1);
    return router.createUrlTree(['/', preferred, ...rest]);
  }

  await locale.use(langParam);
  return true;
};
