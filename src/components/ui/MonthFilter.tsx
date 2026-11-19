import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Button, buttonClasses } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils/cn';
import { addMonths, formatMonthName, formatYear, type IsoDate } from '@/lib/utils/date';
import { monthQuery } from '@/lib/utils/month-filter';

/** The year dropdown always offers 2568-2580 (2025-2037), widened if data or today falls outside. */
const YEAR_RANGE_START = 2025;
const YEAR_RANGE_END = 2037;

const MONTH_NUMBERS = Array.from({ length: 12 }, (_, index) => index + 1);

const LABEL_CLASSES = 'text-ink-muted text-body-sm font-medium whitespace-nowrap';

/** The dropdown beside the month: a room on most pages, a category on expenses. */
export type MonthFilterChoice = {
  /** URL parameter, e.g. 'room'. */
  name: string;
  label: string;
  /** The empty option, e.g. 'ทุกห้อง'. */
  allLabel: string;
  options: { value: string; label: string }[];
  value: string | undefined;
};

/**
 * `เดือน [‹] [month] [year] [›]   ห้อง [room]   [ค้นหา]` over a list page.
 *
 * A plain GET form plus links, like the segment switcher: the search lives in
 * the URL (`?year=2026&month=10&room=201`), survives a reload, and the control
 * ships no JavaScript.
 *
 * `defaultMonth` is the month the page shows with nothing in the URL. The ‹
 * arrow stops at `firstMonth` (or the month on screen, if earlier) and › at
 * `currentMonth`. `keep` (e.g. the segment) rides along on every link and
 * through the form.
 */
export function MonthFilter({
  label,
  pathname,
  month,
  defaultMonth,
  currentMonth,
  firstMonth,
  choice,
  keep = {},
  className,
}: {
  label: string;
  pathname: string;
  month: IsoDate;
  defaultMonth: IsoDate;
  currentMonth: IsoDate;
  firstMonth: IsoDate;
  choice: MonthFilterChoice;
  keep?: Record<string, string>;
  className?: string;
}) {
  const t = useTranslations('filters');
  const locale = useLocale() as Locale;
  const earliestMonth = month < firstMonth ? month : firstMonth;
  const firstYear = Math.min(YEAR_RANGE_START, Number(earliestMonth.slice(0, 4)));
  const lastYear = Math.max(YEAR_RANGE_END, Number(currentMonth.slice(0, 4)));
  const yearOptions = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i);
  const previous = month > earliestMonth ? addMonths(month, -1) : null;
  const next = month < currentMonth ? addMonths(month, 1) : null;
  const searching = month !== defaultMonth || choice.value !== undefined;
  const chosen = { [choice.name]: choice.value };

  const stepLink = (target: IsoDate | null, direction: 'previous' | 'next') => {
    const Icon = direction === 'previous' ? ChevronLeft : ChevronRight;
    const classes = buttonClasses('secondary', 'md', 'w-10 shrink-0 px-0');
    if (target === null) {
      return (
        <span aria-hidden="true" className={cn(classes, 'pointer-events-none opacity-40')}>
          <Icon size={18} />
        </span>
      );
    }
    const stepLabel = t(direction === 'previous' ? 'previousMonth' : 'nextMonth');
    return (
      <Link
        href={{ pathname, query: { ...keep, ...monthQuery(target, defaultMonth, chosen) } }}
        aria-label={stepLabel}
        title={stepLabel}
        className={classes}
      >
        <Icon size={18} aria-hidden="true" />
      </Link>
    );
  };

  return (
    <form
      method="get"
      action={`/${locale}${pathname}`}
      role="search"
      aria-label={label}
      className={cn(
        'border-border flex flex-wrap items-center gap-x-4 gap-y-3 border-b p-3',
        className,
      )}
    >
      {Object.entries(keep).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="flex items-center gap-2">
        <label htmlFor="filter-month" className={LABEL_CLASSES}>
          {t('month')}
        </label>
        <div className="flex gap-1.5">
          {stepLink(previous, 'previous')}
          <Select
            id="filter-month"
            name="month"
            defaultValue={String(Number(month.slice(5, 7)))}
            className="w-36"
          >
            {MONTH_NUMBERS.map((option) => (
              <option key={option} value={option}>
                {formatMonthName(option, locale)}
              </option>
            ))}
          </Select>
          <Select
            name="year"
            aria-label={t('year')}
            defaultValue={month.slice(0, 4)}
            className="w-28"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {formatYear(year, locale)}
              </option>
            ))}
          </Select>
          {stepLink(next, 'next')}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="filter-choice" className={LABEL_CLASSES}>
          {choice.label}
        </label>
        <Select
          id="filter-choice"
          name={choice.name}
          defaultValue={choice.value ?? ''}
          className="w-48"
        >
          <option value="">{choice.allLabel}</option>
          {choice.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit">{t('search')}</Button>
      {searching ? (
        <Link href={{ pathname, query: keep }} className={buttonClasses('ghost', 'md')}>
          {t('clear')}
        </Link>
      ) : null}
    </form>
  );
}
