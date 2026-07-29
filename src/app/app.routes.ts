import { Routes } from '@angular/router';
import { langGuard } from './core/i18n/lang.guard';
import { detectPreferredLang } from './core/i18n/locales';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => detectPreferredLang(),
  },
  {
    path: ':lang',
    canActivate: [langGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/home/home').then((m) => m.Home),
        title: 'Ahmad Shoraka',
      },
      {
        path: 'demo/admin',
        loadComponent: () =>
          import('./pages/admin-demo/admin-demo').then((m) => m.AdminDemo),
        title: 'Admin Dashboard Demo',
      },
      { path: '**', redirectTo: '' },
    ],
  },
  { path: '**', redirectTo: () => detectPreferredLang() },
];
