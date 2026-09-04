import type { FinancialStatus } from '@/types/database';

const BILLING_PRIORITY: Record<FinancialStatus, number> = {
  overdue: 0,
  payment_due: 1,
  none: 2,
  paid: 3,
};

export function compareBillingRooms(
  left: { financial_status: FinancialStatus; room_number: string },
  right: { financial_status: FinancialStatus; room_number: string },
) {
  return (
    BILLING_PRIORITY[left.financial_status] - BILLING_PRIORITY[right.financial_status] ||
    left.room_number.localeCompare(right.room_number)
  );
}
