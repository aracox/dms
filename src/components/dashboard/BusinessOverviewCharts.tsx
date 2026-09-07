import { SEGMENT_STYLES } from '@/components/dashboard/segment-styles';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import {
  chartHeight,
  mergeOverviewSegments,
  stackShare,
  summarizeBusinessOverview,
  summarizeSegmentOccupancy,
} from '@/lib/reporting/business-overview';
import { PROPERTY_SEGMENTS } from '@/lib/reporting/segments';
import { cn } from '@/lib/utils/cn';
import type {
  BusinessOverviewBySegmentRow,
  BusinessOverviewRow,
  PropertySegment,
} from '@/types/database';

type ChartLabels = {
  occupancyTrend: string;
  occupancyHint: string;
  average: string;
  current: string;
  financialTrend: string;
  financialHint: string;
  billed: string;
  collected: string;
  expenses: string;
  collectionRate: string;
  netAfterExpenses: string;
  noData: string;
  /** Whole-property row label in both footers. */
  wholeProperty: string;
  /** Marks the common-expense bar as unattributable to a segment. */
  buildingWide: string;
  segments: Record<PropertySegment, string>;
};

/**
 * Segment shading for the financial chart: the metric owns the hue, the segment
 * owns the depth. หอพัก sits at the base tone, บ้านพัก stacks on top in the
 * deeper one.
 */
const STACK_FILL: Record<'billed' | 'collected', Record<PropertySegment, string>> = {
  billed: { dorm: 'bg-brand-blue', house: 'bg-brand-blue-deep' },
  collected: { dorm: 'bg-brand-green', house: 'bg-brand-green-deep' },
};

function compactMonth(month: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'th' ? 'th-TH-u-ca-buddhist' : 'en-GB', {
    month: 'short',
    year: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(`${month}T12:00:00Z`));
}

function LegendItem({ label, className }: { label: string; className: string }) {
  return (
    <span className="text-ink-muted text-caption inline-flex items-center gap-1.5">
      <span className={cn('size-2.5 rounded-sm', className)} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Metric legend whose two swatches name the two segments. */
function StackedLegendItem({
  label,
  fills,
  segments,
}: {
  label: string;
  fills: Record<PropertySegment, string>;
  segments: Record<PropertySegment, string>;
}) {
  return (
    <span className="text-ink-muted text-caption inline-flex items-center gap-1.5">
      <span className="text-ink font-medium">{label}</span>
      {PROPERTY_SEGMENTS.map((segment) => (
        <span key={segment} className="inline-flex items-center gap-1">
          <span className={cn('size-2.5 rounded-sm', fills[segment])} aria-hidden="true" />
          {segments[segment]}
        </span>
      ))}
    </span>
  );
}

/** Two-slice bar: หอพัก at the base, บ้านพัก stacked above it. */
function StackedBar({
  values,
  maximum,
  fills,
  ariaLabel,
  title,
}: {
  values: Record<PropertySegment, number>;
  maximum: number;
  fills: Record<PropertySegment, string>;
  ariaLabel: string;
  title: string;
}) {
  const total = values.dorm + values.house;

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      title={title}
      className="flex w-1.5 flex-col justify-end"
      style={{ height: `${chartHeight(total, maximum)}%` }}
    >
      <span
        className={cn('block w-full rounded-t-[1px]', fills.house)}
        style={{ height: `${stackShare(values.house, total)}%` }}
        aria-hidden="true"
      />
      <span
        className={cn('block w-full', fills.dorm)}
        style={{ height: `${stackShare(values.dorm, total)}%` }}
        aria-hidden="true"
      />
    </span>
  );
}

/** Footer comparison: whole property first, then one row per segment. */
function FooterTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: { key: string; label: string; swatch?: string; values: string[]; accent?: string }[];
}) {
  return (
    <table className="border-border mt-3 w-full border-t text-left">
      <thead>
        <tr>
          <th className="sr-only" scope="col">
            {' '}
          </th>
          {columns.map((column) => (
            <th
              key={column}
              scope="col"
              className="text-ink-subtle text-caption pt-3 pb-1 text-right font-normal"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row" className="text-ink-muted text-caption py-1 font-normal">
              <span className="inline-flex items-center gap-1.5">
                {row.swatch ? (
                  <span className={cn('size-2.5 rounded-sm', row.swatch)} aria-hidden="true" />
                ) : null}
                {row.label}
              </span>
            </th>
            {row.values.map((value, index) => (
              <td
                key={columns[index] ?? index}
                className={cn(
                  'text-body-sm py-1 text-right font-semibold tabular-nums',
                  row.accent ?? 'text-ink',
                )}
              >
                {value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BusinessOverviewCharts({
  rows,
  segmentRows,
  locale,
  labels,
}: {
  rows: BusinessOverviewRow[];
  segmentRows: BusinessOverviewBySegmentRow[];
  locale: Locale;
  labels: ChartLabels;
}) {
  const { latest, averageOccupancy } = summarizeBusinessOverview(rows);
  const months = mergeOverviewSegments(rows, segmentRows);
  const segmentOccupancy = summarizeSegmentOccupancy(months);
  const financialMaximum = Math.max(
    0,
    ...rows.flatMap((row) => [row.billed_amount, row.collected_amount, row.expense_amount]),
  );
  const money = (amount: number) => formatTHB(amount, locale);

  if (!latest) {
    return (
      <Card className="p-4">
        <EmptyState message={labels.noData} />
      </Card>
    );
  }

  const latestSegments = months.at(-1)?.segments;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader title={labels.occupancyTrend} description={labels.occupancyHint} />
        <div className="px-4 pt-5 pb-4 sm:px-6">
          <div className="mb-4 flex flex-wrap gap-3">
            {PROPERTY_SEGMENTS.map((segment) => (
              <LegendItem
                key={segment}
                label={labels.segments[segment]}
                className={SEGMENT_STYLES[segment].fill}
              />
            ))}
          </div>
          <div className="overflow-x-auto pb-2">
            <figure aria-label={labels.occupancyTrend} className="min-w-[48rem]">
              <div className="border-border relative h-48 border-b">
                <div
                  className="border-brand-yellow/80 pointer-events-none absolute inset-x-0 top-[20%] z-[1] border-t border-dashed"
                  aria-hidden="true"
                >
                  <span className="bg-surface text-brand-yellow-deep absolute -top-4 right-0 px-1 text-[10px]">
                    80%
                  </span>
                </div>
                <ol
                  className="absolute inset-0 grid items-end gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${months.length}, minmax(26px, 1fr))` }}
                >
                  {months.map((entry) => {
                    const month = compactMonth(entry.billing_month, locale);
                    return (
                      <li
                        key={entry.billing_month}
                        className="flex h-full flex-col items-center gap-2"
                      >
                        <div className="flex min-h-0 w-full flex-1 items-end justify-center gap-0.5">
                          {PROPERTY_SEGMENTS.map((segment) => {
                            const row = entry.segments[segment];
                            const caption = `${month}, ${labels.segments[segment]}: ${row.occupancy_rate}% (${row.occupied_rooms}/${row.total_rooms})`;
                            return (
                              <span
                                key={segment}
                                role="img"
                                aria-label={caption}
                                title={caption}
                                className={cn(
                                  'block w-2 rounded-t-sm',
                                  SEGMENT_STYLES[segment].fill,
                                )}
                                style={{ height: `${chartHeight(row.occupancy_rate, 100)}%` }}
                              />
                            );
                          })}
                        </div>
                        <span className="text-ink-subtle h-5 text-[10px] whitespace-nowrap">
                          {month}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </figure>
          </div>
          <FooterTable
            columns={[labels.average, labels.current]}
            rows={[
              {
                key: 'total',
                label: labels.wholeProperty,
                values: [`${averageOccupancy}%`, `${latest.occupancy_rate}%`],
              },
              ...PROPERTY_SEGMENTS.map((segment) => ({
                key: segment,
                label: labels.segments[segment],
                swatch: SEGMENT_STYLES[segment].fill,
                values: [
                  `${segmentOccupancy[segment].average}%`,
                  `${segmentOccupancy[segment].current}%`,
                ],
              })),
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title={labels.financialTrend} description={labels.financialHint} />
        <div className="px-4 pt-5 pb-4 sm:px-6">
          <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
            <StackedLegendItem
              label={labels.billed}
              fills={STACK_FILL.billed}
              segments={labels.segments}
            />
            <StackedLegendItem
              label={labels.collected}
              fills={STACK_FILL.collected}
              segments={labels.segments}
            />
            <LegendItem
              label={`${labels.expenses} (${labels.buildingWide})`}
              className="bg-brand-yellow"
            />
          </div>
          <div className="overflow-x-auto pb-2">
            <figure aria-label={labels.financialTrend} className="min-w-[48rem]">
              <ol
                className="border-border grid h-48 items-end gap-1.5 border-b"
                style={{ gridTemplateColumns: `repeat(${months.length}, minmax(26px, 1fr))` }}
              >
                {months.map((entry) => {
                  const month = compactMonth(entry.billing_month, locale);
                  const stacks = [
                    {
                      key: 'billed' as const,
                      label: labels.billed,
                      amount: 'billed_amount' as const,
                    },
                    {
                      key: 'collected' as const,
                      label: labels.collected,
                      amount: 'collected_amount' as const,
                    },
                  ];

                  return (
                    <li
                      key={entry.billing_month}
                      className="flex h-full flex-col items-center gap-2"
                    >
                      <div className="flex min-h-0 w-full flex-1 items-end justify-center gap-0.5">
                        {stacks.map((stack) => {
                          const values = {
                            dorm: entry.segments.dorm[stack.amount],
                            house: entry.segments.house[stack.amount],
                          };
                          const caption = PROPERTY_SEGMENTS.map(
                            (segment) => `${labels.segments[segment]} ${money(values[segment])}`,
                          ).join(', ');

                          return (
                            <StackedBar
                              key={stack.key}
                              values={values}
                              maximum={financialMaximum}
                              fills={STACK_FILL[stack.key]}
                              ariaLabel={`${month}, ${stack.label}: ${caption}`}
                              title={`${month} · ${stack.label}: ${caption}`}
                            />
                          );
                        })}
                        <span
                          role="img"
                          aria-label={`${month}, ${labels.expenses} (${labels.buildingWide}): ${money(entry.total.expense_amount)}`}
                          title={`${month} · ${labels.expenses}: ${money(entry.total.expense_amount)}`}
                          className="bg-brand-yellow block w-1.5 rounded-t-[1px]"
                          style={{
                            height: `${chartHeight(entry.total.expense_amount, financialMaximum)}%`,
                          }}
                        />
                      </div>
                      <span className="text-ink-subtle h-5 text-[10px] whitespace-nowrap">
                        {month}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </figure>
          </div>
          <FooterTable
            columns={[labels.billed, labels.collected, labels.collectionRate]}
            rows={[
              {
                key: 'total',
                label: labels.wholeProperty,
                values: [
                  money(latest.billed_amount),
                  money(latest.collected_amount),
                  `${latest.collection_rate}%`,
                ],
              },
              ...PROPERTY_SEGMENTS.map((segment) => {
                const row = latestSegments?.[segment];
                return {
                  key: segment,
                  label: labels.segments[segment],
                  swatch: STACK_FILL.collected[segment],
                  values: [
                    money(row?.billed_amount ?? 0),
                    money(row?.collected_amount ?? 0),
                    `${row?.collection_rate ?? 0}%`,
                  ],
                };
              }),
            ]}
          />
          <dl className="border-border mt-3 flex items-baseline justify-between gap-4 border-t pt-3">
            <dt className="text-ink-subtle text-caption">
              {labels.netAfterExpenses} ({labels.buildingWide})
            </dt>
            <dd
              className={cn(
                'font-semibold tabular-nums',
                latest.net_after_expenses >= 0 ? 'text-brand-green-deep' : 'text-brand-red-deep',
              )}
            >
              {money(latest.net_after_expenses)}
            </dd>
          </dl>
        </div>
      </Card>
    </div>
  );
}
