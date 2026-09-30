'use client';

import { useState } from 'react';

import type { Locale } from '@/i18n/routing';
import { formatTHB, sumMoney } from '@/lib/billing/money';
import type { CommonExpenseCategory } from '@/types/database';

import { CATEGORY_RING as RING } from './category-colors';

const RADIUS = 80;
const THICKNESS = 30;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Surface gap between slices, in the same units as the circumference. */
const GAP = 2;

/**
 * Part-to-whole of one period's expenses by category. Slices keep a small gap;
 * the center shows the total, or the hovered slice. The legend beside it lists
 * every category with its amount and share, so no value depends on color --
 * two of the seven slots are under 3:1 on cream.
 */
export function ExpenseCategoryDonut({
  amounts,
  categoryLabels,
  totalLabel,
  locale,
}: {
  amounts: Record<CommonExpenseCategory, number>;
  categoryLabels: Record<CommonExpenseCategory, string>;
  totalLabel: string;
  locale: Locale;
}) {
  const [hovered, setHovered] = useState<CommonExpenseCategory | null>(null);
  const total = sumMoney(RING.map((slot) => amounts[slot.category]));
  const share = (amount: number) => (total === 0 ? 0 : Math.round((amount / total) * 1000) / 10);

  // Each slice starts where the previous one ended.
  const slices = RING.filter((slot) => amounts[slot.category] > 0).reduce<
    ((typeof RING)[number] & { length: number; offset: number })[]
  >((placed, slot) => {
    const previous = placed.at(-1);
    return [
      ...placed,
      {
        ...slot,
        length: (amounts[slot.category] / total) * CIRCUMFERENCE,
        offset: previous ? previous.offset + previous.length : 0,
      },
    ];
  }, []);
  const single = slices.length === 1;
  const focus = hovered ? RING.find((slot) => slot.category === hovered) : null;

  return (
    <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-10">
      <div className="relative size-56 shrink-0">
        <svg viewBox="0 0 200 200" className="size-full -rotate-90" role="img" aria-hidden="true">
          <circle
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            strokeWidth={THICKNESS}
            className="stroke-surface-sunken"
          />
          {slices.map((slice) => (
            <circle
              key={slice.category}
              cx="100"
              cy="100"
              r={RADIUS}
              fill="none"
              strokeWidth={hovered === slice.category ? THICKNESS + 6 : THICKNESS}
              className={`${slice.stroke} transition-[stroke-width,opacity] ${
                hovered && hovered !== slice.category ? 'opacity-40' : ''
              }`}
              // One slice alone is a full ring; otherwise leave a surface gap.
              strokeDasharray={`${single ? slice.length : Math.max(0, slice.length - GAP)} ${CIRCUMFERENCE}`}
              strokeDashoffset={-slice.offset}
              onMouseEnter={() => setHovered(slice.category)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-ink-muted text-caption max-w-28">
            {focus ? categoryLabels[focus.category] : totalLabel}
          </span>
          <span className="text-ink font-display text-h4 font-semibold tabular-nums">
            {formatTHB(focus ? amounts[focus.category] : total, locale)}
          </span>
          {focus ? (
            <span className="text-ink-subtle text-caption">{share(amounts[focus.category])}%</span>
          ) : null}
        </div>
      </div>

      <ul className="w-full max-w-md space-y-1">
        {RING.map((slot) => {
          const amount = amounts[slot.category];
          return (
            <li
              key={slot.category}
              onMouseEnter={() => (amount > 0 ? setHovered(slot.category) : undefined)}
              onMouseLeave={() => setHovered(null)}
              className={`grid grid-cols-[auto_1fr_auto_3.5rem] items-center gap-3 rounded-md px-2 py-1.5 ${
                hovered === slot.category ? 'bg-surface-sunken' : ''
              } ${amount === 0 ? 'opacity-50' : ''}`}
            >
              <span aria-hidden="true" className={`${slot.swatch} size-3 rounded-sm`} />
              <span className="text-ink text-body-sm">{categoryLabels[slot.category]}</span>
              <span className="text-ink text-body-sm text-right tabular-nums">
                {formatTHB(amount, locale)}
              </span>
              <span className="text-ink-subtle text-caption text-right tabular-nums">
                {share(amount)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
