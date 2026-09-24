import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Google_Sans_Code, Kanit, Noto_Sans_Thai } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { routing } from '@/i18n/routing';

import '../globals.css';

/**
 * Kanit, headings and body both.
 *
 * It carries the `thai` subset, so one typeface sets both scripts and Thai
 * renders in the same face as Latin. Kanit is NOT a variable font -- each
 * weight is a separate file -- so `weight` must list every step the type ramp
 * and the font-* utilities use (400, 500, 600, 700). A weight left out here
 * gets faux-bolded or snapped to the nearest loaded one by the browser.
 */
const kanit = Kanit({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-kanit',
});

/**
 * Meter readings, invoice numbers, card UIDs. The monospace member of the same
 * family, so the mono face is tonally consistent with the text face. It has no
 * Thai subset, which is fine -- everything set in mono here is digits and IDs.
 */
const googleSansCode = Google_Sans_Code({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  variable: '--font-google-sans-code',
});

/**
 * Fallback only, second in every stack (see globals.css). Kanit covers
 * Thai, so this exists purely as insurance against a face failing to load.
 * `preload: false` on purpose: preloading it would ship a font the browser is
 * never expected to need.
 */
const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-noto-sans-thai',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'app' });

  return {
    title: t('name'),
    description: t('tagline'),
    robots: { index: false, follow: false },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) notFound();

  // Enables static rendering for this locale.
  setRequestLocale(locale);

  return (
    // suppressHydrationWarning on html/body only: browser extensions inject
    // attributes onto these two elements before React hydrates (ColorZilla adds
    // cz-shortcut-listen, Grammarly adds data-gr-*), which React otherwise
    // reports as a mismatch. It suppresses the warning for these elements'
    // own attributes, not for the tree inside them.
    <html
      lang={locale}
      className={`${kanit.variable} ${googleSansCode.variable} ${notoSansThai.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
