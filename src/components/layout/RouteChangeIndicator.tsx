'use client';

import { Loader2 } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Shows a small spinner the instant an in-app link is clicked, until the URL
 * actually changes.
 *
 * `loading.tsx` alone only fires while a page segment is still fetching --
 * Next's Link prefetching means most in-app navigations (e.g. a room list row
 * to that room's own page) already have their data by the time you click, so
 * Suspense never suspends and no loading state appears at all. This listens
 * for the click itself instead, so every navigation gets immediate feedback
 * regardless of how fast the target page turns out to be.
 */
export function RouteChangeIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = `${pathname}?${searchParams.toString()}`;

  const [isNavigating, setIsNavigating] = useState(false);
  // Adjusting state during render (not in an effect) when a derived value
  // changes -- https://react.dev/learn/you-might-not-need-an-effect
  const [trackedUrl, setTrackedUrl] = useState(url);
  if (url !== trackedUrl) {
    setTrackedUrl(url);
    if (isNavigating) setIsNavigating(false);
  }

  useEffect(() => {
    if (!isNavigating) return;
    // Safety net: never let a stuck/failed navigation leave the spinner up.
    const timeout = setTimeout(() => setIsNavigating(false), 10_000);
    return () => clearTimeout(timeout);
  }, [isNavigating]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = (event.target as HTMLElement | null)?.closest('a');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      let target: URL;
      try {
        target = new URL(href, window.location.href);
      } catch {
        return;
      }
      const current = new URL(window.location.href);
      if (target.origin !== current.origin) return;
      if (target.pathname === current.pathname && target.search === current.search) return;

      setIsNavigating(true);
    }

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  if (!isNavigating) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-3"
      role="status"
      aria-live="polite"
    >
      <div className="bg-surface border-border flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-lg">
        <Loader2 className="text-brand-blue size-4 animate-spin" aria-label="Loading" />
      </div>
    </div>
  );
}
