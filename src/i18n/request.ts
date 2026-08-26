import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { BANGKOK_TZ } from '@/lib/utils/date';

import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    // Pin formatting to Bangkok so a UTC server and a Thai user agree on dates.
    timeZone: BANGKOK_TZ,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
