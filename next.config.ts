import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // typedRoutes is off: next-intl builds hrefs from the [locale] segment, and the
  // generated route union fights the locale-aware Link.
  typedRoutes: false,
  experimental: {
    // Default is 1mb; move-in can upload several tenant-document photos at once,
    // each up to the tenant-documents bucket's own 5mb-per-file limit (0008).
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
};

export default withNextIntl(nextConfig);
