import Image from 'next/image';

import { cn } from '@/lib/utils/cn';

/**
 * The Baan Chomplern house-and-leaf mark on a cream tile. The tile is what
 * keeps the olive roof readable on the dark-brown sidebar as well as on the
 * cream toolbar. Decorative: every use sits next to, or inside a link labelled
 * with, the app name.
 */
export function AppLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        'bg-surface border-border inline-flex shrink-0 items-center justify-center rounded-md border',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo.png"
        alt=""
        width={Math.round(size * 0.8)}
        height={Math.round(size * 0.8)}
        priority
      />
    </span>
  );
}
