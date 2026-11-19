/**
 * Shared by the expenses page (server) and ExpensesSection (client), so it
 * cannot live in either one: a function exported from a 'use client' module
 * is not callable on the server.
 */

import { billingMonthOf, type IsoDate } from '@/lib/utils/date';
import type { CommonExpenseCategory, CommonExpenseRow } from '@/types/database';

/** The recurring categories, in entry-card order. 'other' (non-recurring) follows them. */
export const MONTHLY_CATEGORIES: readonly CommonExpenseCategory[] = [
  'common_electricity',
  'common_water',
  'housekeeping',
  'gardening',
  'internet',
  'transformer_fee',
];

export const EXPENSE_CATEGORIES: readonly CommonExpenseCategory[] = [
  ...MONTHLY_CATEGORIES,
  'other',
];

/** The month an expense counts toward: its billing month, or for 'other' its date's month. */
export function expenseMonth(expense: CommonExpenseRow): IsoDate {
  return expense.category === 'other'
    ? billingMonthOf(expense.expense_date)
    : expense.billing_month!;
}
