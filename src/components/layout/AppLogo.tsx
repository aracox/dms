import Image from 'next/image';

import { cn } from '@/lib/utils/cn';

/**
 * Keep the property's house-and-leaf mark on a white tile within the glass
 * frame. Decorative: each use sits next to, or in a link labelled with, its name.
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
