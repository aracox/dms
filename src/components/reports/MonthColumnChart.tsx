'use client';

import { useState } from 'react';

import type { Locale } from '@/i18n/routing';
import { formatTHB, sumMoney } from '@/lib/billing/money';
import { formatBillingMonth } from '@/lib/utils/date';

const PLOT_HEIGHT = 220;
/** Headroom above the plot so the top axis label is not clipped by the scroller. */
const TOP_PAD = 12;

/** The smallest of 1, 2, 2.5, 5 x 10^n at or above `value`. */
function niceStep(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value)! * magnitude;
}

/**
 * Axis maximum and gridline count, so every gridline lands on a round value:
 * tries 4 and 5 steps and keeps whichever tops out lower. (5,000 becomes
 * 0-5,000 in steps of 1,000, not quarters that read "1.3K, 3.8K".)
 */
function niceAxis(value: number): { max: number; steps: number } {
  if (value <= 0) return { max: 1000, steps: 4 };
  return [4, 5]
    .map((steps) => ({ max: niceStep(value / steps) * steps, steps }))
    .reduce((best, candidate) => (candidate.max < best.max ? candidate : best));
}

export interface ColumnSeries {
  label: string;
  /** Tailwind bg-* class; spelled out by the caller so Tailwind emits it. */
  swatch: string;
}

export interface MonthColumn {
  month: string;
  /** One value per series, in the same order (the first sits at the baseline). */
  values: number[];
}

/**
 * One column per month, stacked from the given series with a 2px surface gap
 * between segments. Recessive gridlines, month-only axis labels (the card
 * names the year), and a tooltip on hover or keyboard focus. Values are always
 * reachable as text (tooltip, aria-label), so a sub-3:1 series color never
 * carries a value alone. A legend shows only for two or more series -- a
 * single series is named by its card.
 *
 * `reference` draws a dashed horizontal line (e.g. the average). With
 * `onSelect`, a column is also a toggle: clicking picks that month (the
 * others dim) and clicking it again clears the pick.
 */
export function MonthColumnChart({
  title,
  series,
  columns,
  totalLabel,
  locale,
  reference,
  selectedMonth = null,
  onSelect,
}: {
  title: string;
  series: ColumnSeries[];
  columns: MonthColumn[];
  totalLabel: string;
  locale: Locale;
  reference?: { value: number; label: string };
  selectedMonth?: string | null;
  onSelect?: (month: string | null) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const totals = columns.map((column) => sumMoney(column.values));
  const { max, steps } = niceAxis(Math.max(...totals, reference?.value ?? 0));
  const ticks = Array.from({ length: steps + 1 }, (_, index) => 1 - index / steps);
  const compact = new Intl.NumberFormat(locale === 'th' ? 'th-TH' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  const px = (amount: number) => (amount / max) * PLOT_HEIGHT;
  const shortMonth = new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-GB', {
    month: 'short',
    timeZone: 'UTC',
  });
  const stacked = series.length > 1;
  // Tooltip rows plus a total row when stacked; kept inside the plot so the scroller never clips it.
  const tooltipHeight = 40 + series.length * 18 + (stacked ? 24 : 0);

  return (
    <figure aria-label={title} className="space-y-3">
      {stacked ? (
        <ul className="text-ink-muted text-caption flex flex-wrap gap-4">
          {series.map((entry) => (
            <li key={entry.label} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`${entry.swatch} size-3 rounded-sm`} />
              {entry.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="overflow-x-auto">
        <div
          className="relative min-w-[40rem] pl-12"
          style={{ height: TOP_PAD + PLOT_HEIGHT + 28 }}
        >
          {/* Gridlines and y-axis labels. */}
          {ticks.map((tick) => (
            <div
              key={tick}
              className="border-border absolute right-0 left-12 border-t"
              style={{ top: TOP_PAD + PLOT_HEIGHT - tick * PLOT_HEIGHT }}
            >
              <span className="text-ink-subtle text-caption absolute -top-2 -left-12 w-10 text-right tabular-nums">
                {compact.format(tick * max)}
              </span>
            </div>
          ))}

          {reference && reference.value > 0 ? (
            <div
              aria-hidden="true"
              className="border-ink-muted pointer-events-none absolute right-0 left-12 z-[1] border-t-2 border-dashed"
              style={{ top: TOP_PAD + PLOT_HEIGHT - px(reference.value) }}
            >
              <span
                // Label above the line, or below it when the line is near the top edge.
                className={`bg-surface text-ink-muted text-caption absolute right-0 rounded-sm px-1 tabular-nums ${
                  px(reference.value) > PLOT_HEIGHT - 24 ? 'top-1' : '-top-5'
                }`}
              >
                {reference.label} {formatTHB(reference.value, locale)}
              </span>
            </div>
          ) : null}

          <div
            className="absolute right-0 left-12 flex items-end gap-2"
            style={{ top: TOP_PAD, height: PLOT_HEIGHT }}
          >
            {columns.map((column, index) => {
              const total = totals[index]!;
              const caption = [
                formatBillingMonth(column.month, locale),
                ...series.map(
                  (entry, seriesIndex) =>
                    `${entry.label} ${formatTHB(column.values[seriesIndex]!, locale)}`,
                ),
                ...(stacked ? [`${totalLabel} ${formatTHB(total, locale)}`] : []),
              ].join(' · ');
              const isActive = active === index;
              const isSelected = selectedMonth === column.month;
              // Hover wins while it lasts; otherwise a picked month stays lit.
              const dimmed = active !== null ? !isActive : selectedMonth !== null && !isSelected;
              // Drawn top segment first; only the topmost non-empty one gets rounded corners.
              const segments = series
                .map((entry, seriesIndex) => ({ ...entry, value: column.values[seriesIndex]! }))
                .filter((segment) => segment.value > 0)
                .reverse();

              return (
                <button
                  key={column.month}
                  type="button"
                  aria-label={caption}
                  aria-pressed={onSelect ? isSelected : undefined}
                  onClick={onSelect ? () => onSelect(isSelected ? null : column.month) : undefined}
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  // The hit target is the whole column height, not just the bar.
                  className={`relative flex h-full flex-1 flex-col items-center justify-end outline-offset-2 ${
                    onSelect ? '' : 'cursor-default'
                  }`}
                >
                  <span
                    className={`flex w-full max-w-9 flex-col items-stretch gap-0.5 transition-opacity ${dimmed ? 'opacity-40' : 'opacity-100'}`}
                  >
                    {segments.map((segment, segmentIndex) => (
                      <span
                        key={segment.label}
                        className={`${segment.swatch} ${segmentIndex === 0 ? 'rounded-t' : ''}`}
                        style={{ height: Math.max(2, px(segment.value)) }}
                      />
                    ))}
                  </span>

                  {isActive ? (
                    <span
                      role="tooltip"
                      className={`bg-surface border-border text-caption absolute z-10 w-max rounded-md border px-3 py-2 text-left shadow-md ${
                        index < 2
                          ? 'left-0'
                          : index >= columns.length - 2
                            ? 'right-0'
                            : 'left-1/2 -translate-x-1/2'
                      }`}
                      style={{ bottom: Math.min(px(total) + 8, PLOT_HEIGHT - tooltipHeight) }}
                    >
                      <span className="text-ink block font-semibold">
                        {formatBillingMonth(column.month, locale)}
                      </span>
                      {series.map((entry, seriesIndex) => (
                        <span
                          key={entry.label}
                          className="text-ink-muted flex items-center gap-1.5"
                        >
                          <span
                            aria-hidden="true"
                            className={`${entry.swatch} size-2 rounded-sm`}
                          />
                          {entry.label}
                          <span className="text-ink ml-auto pl-3 tabular-nums">
                            {formatTHB(column.values[seriesIndex]!, locale)}
                          </span>
                        </span>
                      ))}
                      {stacked ? (
                        <span className="border-border text-ink mt-1 flex border-t pt-1 font-semibold">
                          {totalLabel}
                          <span className="ml-auto pl-3 tabular-nums">
                            {formatTHB(total, locale)}
                          </span>
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Month labels under the baseline: month only -- the card title names the year. */}
          <div
            className="absolute right-0 left-12 flex gap-2"
            style={{ top: TOP_PAD + PLOT_HEIGHT + 8 }}
          >
            {columns.map((column) => (
              <span
                key={column.month}
                className={`text-caption flex-1 text-center whitespace-nowrap ${
                  selectedMonth === column.month ? 'text-ink font-semibold' : 'text-ink-subtle'
                }`}
              >
                {shortMonth.format(new Date(`${column.month}T00:00:00Z`))}
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
