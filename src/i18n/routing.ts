import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['th', 'en'],
  // Thai is the primary language of the dormitory office.
  defaultLocale: 'th',
});

export type Locale = (typeof routing.locales)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  th: 'ไทย',
  en: 'English',
};
