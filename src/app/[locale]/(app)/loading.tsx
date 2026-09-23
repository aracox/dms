import { Loader2 } from 'lucide-react';

/**
 * Next.js shows this automatically while a page under (app) is loading --
 * clicking a nav link/tab, or any server-rendered page fetching data. Sits in
 * place of the page content only; the sidebar/toolbar in AppShell stay put.
 *
 * No next-intl here: `loading.tsx` can render as a Suspense fallback before
 * its route params resolve, so `params` isn't reliably available -- unlike
 * `page.tsx`, which always has it by the time it renders.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="text-brand-blue size-8 animate-spin" aria-label="Loading" />
    </div>
  );
}
