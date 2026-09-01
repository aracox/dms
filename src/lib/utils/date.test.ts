import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  bangkokToday,
  billingMonthOf,
  currentBillingMonth,
  daysBetween,
  dueDateFor,
  isPastDue,
} from './date';

describe('bangkokToday', () => {
  it('uses the Bangkok calendar date, not the server date', () => {
    // 22:30 on 26 Aug UTC is already 05:30 on 27 Aug in Bangkok.
    expect(bangkokToday(new Date('2026-08-26T22:30:00Z'))).toBe('2026-08-27');
  });

  it('does not roll over early in the UTC day', () => {
    expect(bangkokToday(new Date('2026-08-26T01:00:00Z'))).toBe('2026-08-26');
  });

  it('handles the UTC midnight boundary', () => {
    expect(bangkokToday(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01');
  });
});

describe('billing months', () => {
  it('normalises to the first of the month', () => {
    expect(billingMonthOf('2026-08-26')).toBe('2026-08-01');
  });

  it('derives the current billing month in Bangkok', () => {
    expect(currentBillingMonth(new Date('2026-07-31T20:00:00Z'))).toBe('2026-08-01');
  });

  it('shifts across year boundaries in both directions', () => {
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01');
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01');
    expect(addMonths('2026-08-01', 12)).toBe('2027-08-01');
    expect(addMonths('2026-08-01', -20)).toBe('2024-12-01');
  });
});

describe('due dates', () => {
  it('places the due day inside the billing month', () => {
    expect(dueDateFor('2026-08-01', 5)).toBe('2026-08-05');
  });

  it('clamps to the last day of a short month', () => {
    expect(dueDateFor('2026-02-01', 30)).toBe('2026-02-28');
    expect(dueDateFor('2028-02-01', 30)).toBe('2028-02-29'); // leap year
  });

  it('detects a past due date', () => {
    expect(isPastDue('2026-08-05', '2026-08-26')).toBe(true);
    expect(isPastDue('2026-08-28', '2026-08-26')).toBe(false);
    expect(isPastDue('2026-08-26', '2026-08-26')).toBe(false);
  });

  it('shifts a date forward by whole days, spanning a month boundary', () => {
    expect(addDays('2026-08-05', 5)).toBe('2026-08-10');
    expect(addDays('2026-08-28', 5)).toBe('2026-09-02');
  });

  it('applies a grace period before counting as past due -- due day 5 + 5 days grace = late after day 10', () => {
    expect(isPastDue('2026-08-05', '2026-08-09', 5)).toBe(false);
    expect(isPastDue('2026-08-05', '2026-08-10', 5)).toBe(false);
    expect(isPastDue('2026-08-05', '2026-08-11', 5)).toBe(true);
  });

  it('defaults the grace period to zero, matching the no-grace behaviour', () => {
    expect(isPastDue('2026-08-05', '2026-08-06')).toBe(true);
    expect(isPastDue('2026-08-05', '2026-08-06', 0)).toBe(true);
  });
});

describe('daysBetween', () => {
  it('counts forward and backward', () => {
    expect(daysBetween('2026-08-26', '2026-09-15')).toBe(20);
    expect(daysBetween('2026-08-26', '2026-08-05')).toBe(-21);
    expect(daysBetween('2026-08-26', '2026-08-26')).toBe(0);
  });

  it('spans a leap day', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
  });
});

describe('contract date validation', () => {
  it('requires the end date to follow the start date', () => {
    expect(daysBetween('2026-01-01', '2026-12-31')).toBeGreaterThan(0);
    expect(daysBetween('2026-12-31', '2026-01-01')).toBeLessThan(0);
  });
});
