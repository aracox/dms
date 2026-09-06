import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Locale } from '@/i18n/routing';
import { formatTHB } from '@/lib/billing/money';
import { chartHeight, summarizeBusinessOverview } from '@/lib/reporting/business-overview';
import type { BusinessOverviewRow } from '@/types/database';

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
      <span className={`size-2.5 rounded-sm ${className}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export function BusinessOverviewCharts({
  rows,
  locale,
  labels,
}: {
  rows: BusinessOverviewRow[];
  locale: Locale;
  labels: ChartLabels;
}) {
  const { latest, averageOccupancy } = summarizeBusinessOverview(rows);
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

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader title={labels.occupancyTrend} description={labels.occupancyHint} />
        <div className="px-4 pt-5 pb-4 sm:px-6">
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
                  style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(26px, 1fr))` }}
                >
                  {rows.map((row) => {
                    const month = compactMonth(row.billing_month, locale);
                    return (
                      <li
                        key={row.billing_month}
                        className="flex h-full flex-col items-center gap-2"
                      >
                        <div className="flex min-h-0 w-full flex-1 items-end justify-center">
                          <span
                            role="img"
                            aria-label={`${month}: ${row.occupancy_rate}% (${row.occupied_rooms}/${row.total_rooms})`}
                            title={`${month}: ${row.occupancy_rate}%`}
                            className="bg-brand-blue/85 block w-5 rounded-t-sm"
                            style={{ height: `${chartHeight(row.occupancy_rate, 100)}%` }}
                          />
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
          <dl className="border-border mt-3 grid grid-cols-2 gap-4 border-t pt-3">
            <div>
              <dt className="text-ink-subtle text-caption">{labels.average}</dt>
              <dd className="text-ink mt-0.5 font-semibold tabular-nums">{averageOccupancy}%</dd>
            </div>
            <div className="text-right">
              <dt className="text-ink-subtle text-caption">{labels.current}</dt>
              <dd className="text-ink mt-0.5 font-semibold tabular-nums">
                {latest.occupancy_rate}%
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      <Card>
        <CardHeader title={labels.financialTrend} description={labels.financialHint} />
        <div className="px-4 pt-5 pb-4 sm:px-6">
          <div className="mb-4 flex flex-wrap gap-3">
            <LegendItem label={labels.billed} className="bg-brand-blue" />
            <LegendItem label={labels.collected} className="bg-brand-green" />
            <LegendItem label={labels.expenses} className="bg-brand-yellow" />
          </div>
          <div className="overflow-x-auto pb-2">
            <figure aria-label={labels.financialTrend} className="min-w-[48rem]">
              <ol
                className="border-border grid h-48 items-end gap-1.5 border-b"
                style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(26px, 1fr))` }}
              >
                {rows.map((row) => {
                  const month = compactMonth(row.billing_month, locale);
                  const bars = [
                    {
                      label: labels.billed,
                      value: row.billed_amount,
                      className: 'bg-brand-blue',
                    },
                    {
                      label: labels.collected,
                      value: row.collected_amount,
                      className: 'bg-brand-green',
                    },
                    {
                      label: labels.expenses,
                      value: row.expense_amount,
                      className: 'bg-brand-yellow',
                    },
                  ];

                  return (
                    <li key={row.billing_month} className="flex h-full flex-col items-center gap-2">
                      <div className="flex min-h-0 w-full flex-1 items-end justify-center gap-0.5">
                        {bars.map((bar) => (
                          <span
                            key={bar.label}
                            role="img"
                            aria-label={`${month}, ${bar.label}: ${money(bar.value)}`}
                            title={`${month} · ${bar.label}: ${money(bar.value)}`}
                            className={`block w-1.5 rounded-t-[1px] ${bar.className}`}
                            style={{ height: `${chartHeight(bar.value, financialMaximum)}%` }}
                          />
                        ))}
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
          <dl className="border-border mt-3 grid grid-cols-2 gap-4 border-t pt-3">
            <div>
              <dt className="text-ink-subtle text-caption">{labels.collectionRate}</dt>
              <dd className="text-ink mt-0.5 font-semibold tabular-nums">
                {latest.collection_rate}%
              </dd>
            </div>
            <div className="text-right">
              <dt className="text-ink-subtle text-caption">{labels.netAfterExpenses}</dt>
              <dd
                className={`mt-0.5 font-semibold tabular-nums ${
                  latest.net_after_expenses >= 0 ? 'text-brand-green-deep' : 'text-brand-red-deep'
                }`}
              >
                {money(latest.net_after_expenses)}
              </dd>
            </div>
          </dl>
        </div>
      </Card>
    </div>
  );
}
