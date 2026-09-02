import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Google_Sans, Google_Sans_Code, Noto_Sans_Thai } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { routing } from '@/i18n/routing';

import '../globals.css';

/**
 * Google Sans, headings and body both.
 *
 * It carries the `thai` subset, so one typeface sets both scripts and Thai no
 * longer renders in a visibly different face from Latin. `weight` is omitted
 * deliberately: this is a variable font with a wght axis spanning 400-700, so
 * every step the type ramp asks for (400, 500, 600, 700) is a real
 * interpolation rather than a synthesised or coerced weight.
 */
const googleSans = Google_Sans({
  subsets: ['thai', 'latin'],
  display: 'swap',
  variable: '--font-google-sans',
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
 * Fallback only, second in every stack (see globals.css). Google Sans covers
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
      className={`${googleSans.variable} ${googleSansCode.variable} ${notoSansThai.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
