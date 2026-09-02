import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Cinzel, Fira_Code, Noto_Sans_Thai, Spectral } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { routing } from '@/i18n/routing';

import '../globals.css';

/**
 * Thai needs a font with proper tone-mark positioning. Cinzel and Spectral
 * carry no Thai glyphs, so Noto stays loaded and sits second in every stack
 * (see globals.css) -- the browser resolves per glyph, so Latin gets the
 * display/body face and Thai gets Noto.
 */
const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-noto-sans-thai',
});

/** Headings and small caps labels. */
const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-cinzel',
});

/** Body copy. */
const spectral = Spectral({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-spectral',
});

/** Meter readings, invoice numbers, card UIDs. */
const firaCode = Fira_Code({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  variable: '--font-fira-code',
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
      className={`${notoSansThai.variable} ${cinzel.variable} ${spectral.variable} ${firaCode.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
