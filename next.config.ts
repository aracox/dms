import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // typedRoutes is off: next-intl builds hrefs from the [locale] segment, and the
  // generated route union fights the locale-aware Link.
  typedRoutes: false,
};

export default withNextIntl(nextConfig);
