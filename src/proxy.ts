import { createServerClient } from '@supabase/ssr';
import { hasLocale } from 'next-intl';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { routing } from '@/i18n/routing';
import { env } from '@/lib/env';

const handleI18n = createIntlMiddleware(routing);

/** Reachable without a session. Everything else requires one. */
const PUBLIC_PATHS = ['/login'];

/**
 * Runs the locale middleware first, then refreshes the Supabase session on the
 * response it produced. Refreshing here is what lets Server Components read a
 * valid session -- they cannot set cookies themselves.
 *
 * Named `proxy` in `src/proxy.ts`: Next.js 16 renamed the middleware file
 * convention, and the old name is deprecated.
 */
export async function proxy(request: NextRequest) {
  const response = handleI18n(request);

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const hasLocalePrefix = hasLocale(routing.locales, segments[0]);
  const locale = hasLocalePrefix ? segments[0] : routing.defaultLocale;
  const pathname = `/${segments.slice(hasLocalePrefix ? 1 : 0).join('/')}`;

  const isPublic = PUBLIC_PATHS.some(
    (publicPath) => pathname === publicPath || pathname.startsWith(`${publicPath}/`),
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip API routes, Next internals and anything with a file extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
