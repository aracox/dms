import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/**
 * Locale-aware navigation. Always import Link and useRouter from here rather
 * than from `next/link` and `next/navigation`, so the locale prefix survives.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
