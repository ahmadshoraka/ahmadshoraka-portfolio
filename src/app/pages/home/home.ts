import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LocaleService } from '../../core/i18n/locale.service';
import { LanguageSwitcher } from '../../shared/language-switcher/language-switcher';

@Component({
  selector: 'app-home',
  imports: [RouterLink, TranslatePipe, LanguageSwitcher],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly locale = inject(LocaleService);

  readonly currentYear = new Date().getFullYear();
  readonly photoFailed = signal(false);

  readonly services = [
    {
      titleKey: 'services.items.admin.title',
      textKey: 'services.items.admin.text',
    },
    {
      titleKey: 'services.items.apps.title',
      textKey: 'services.items.apps.text',
    },
    {
      titleKey: 'services.items.aiBi.title',
      textKey: 'services.items.aiBi.text',
    },
    {
      titleKey: 'services.items.lead.title',
      textKey: 'services.items.lead.text',
    },
  ];

  readonly projects = [
    {
      titleKey: 'work.items.ops.title',
      tagKey: 'work.items.ops.tag',
      textKey: 'work.items.ops.text',
      link: 'demo/admin',
    },
    {
      titleKey: 'work.items.aiAssistant.title',
      tagKey: 'work.items.aiAssistant.tag',
      textKey: 'work.items.aiAssistant.text',
      link: null as string | null,
    },
    {
      titleKey: 'work.items.easypay.title',
      tagKey: 'work.items.easypay.tag',
      textKey: 'work.items.easypay.text',
      link: null as string | null,
    },
    {
      titleKey: 'work.items.hr.title',
      tagKey: 'work.items.hr.tag',
      textKey: 'work.items.hr.text',
      link: null as string | null,
    },
    {
      titleKey: 'work.items.easycard.title',
      tagKey: 'work.items.easycard.tag',
      textKey: 'work.items.easycard.text',
      link: null as string | null,
    },
    {
      titleKey: 'work.items.mobile.title',
      tagKey: 'work.items.mobile.tag',
      textKey: 'work.items.mobile.text',
      link: null as string | null,
    },
    {
      titleKey: 'work.items.react.title',
      tagKey: 'work.items.react.tag',
      textKey: 'work.items.react.text',
      link: null as string | null,
    },
  ];

  readonly experience = [
    {
      roleKey: 'experience.items.maher.role',
      companyKey: 'experience.items.maher.company',
      periodKey: 'experience.items.maher.period',
      textKey: 'experience.items.maher.text',
    },
    {
      roleKey: 'experience.items.tosan.role',
      companyKey: 'experience.items.tosan.company',
      periodKey: 'experience.items.tosan.period',
      textKey: 'experience.items.tosan.text',
    },
    {
      roleKey: 'experience.items.adtn.role',
      companyKey: 'experience.items.adtn.company',
      periodKey: 'experience.items.adtn.period',
      textKey: 'experience.items.adtn.text',
    },
    {
      roleKey: 'experience.items.dar.role',
      companyKey: 'experience.items.dar.company',
      periodKey: 'experience.items.dar.period',
      textKey: 'experience.items.dar.text',
    },
  ];

  readonly education = [
    {
      degreeKey: 'education.items.master.degree',
      schoolKey: 'education.items.master.school',
      periodKey: 'education.items.master.period',
    },
    {
      degreeKey: 'education.items.bachelor.degree',
      schoolKey: 'education.items.bachelor.school',
      periodKey: 'education.items.bachelor.period',
    },
  ];

  readonly skills = [
    'Angular',
    'TypeScript',
    'JavaScript',
    'Angular Material',
    'RxJS',
    'Svelte 5',
    'SvelteKit',
    'React',
    'Tailwind CSS',
    'Ionic',
    'FastAPI',
    'Git',
    'Docker',
  ];

  demoLink(): string[] {
    return ['/', this.locale.lang(), 'demo', 'admin'];
  }

  onPhotoError(): void {
    this.photoFailed.set(true);
  }
}
