import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge only knows Tailwind's default scale, so it would read the
 * custom type-ramp tokens from globals.css (`text-body-sm`, `text-caption`, …)
 * as text colours and drop a real colour such as `text-white` beside them.
 * Registering them as font sizes keeps size and colour in separate groups.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'display',
            'h1',
            'h2',
            'h3',
            'h4',
            'body-lg',
            'body',
            'body-sm',
            'caption',
            'code',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
