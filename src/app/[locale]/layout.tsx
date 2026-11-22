import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Google_Sans_Code } from 'next/font/google';
import localFont from 'next/font/local';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import type { ReactNode } from 'react';

import { NativeValidationMessages } from '@/components/ui/NativeValidationMessages';
import { routing } from '@/i18n/routing';
import { BACKGROUND_IMAGE_INIT_SCRIPT } from '@/lib/appearance/glass';

import '../globals.css';

// The reference's Prompt files carry both Thai and Latin glyphs.
const prompt = localFont({
  src: [
    { path: '../../../assets/fonts/prompt-regular.ttf', weight: '400', style: 'normal' },
    { path: '../../../assets/fonts/prompt-medium.ttf', weight: '500', style: 'normal' },
    { path: '../../../assets/fonts/prompt-semibold.ttf', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-prompt',
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
      className={`${prompt.variable} ${googleSansCode.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Script id="background-image-preference" strategy="beforeInteractive">
          {BACKGROUND_IMAGE_INIT_SCRIPT}
        </Script>
        <NextIntlClientProvider>
          <NativeValidationMessages />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
