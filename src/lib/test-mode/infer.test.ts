import { describe, expect, it } from 'vitest';

import type { RoomBoardRow } from '@/types/database';

import { inferTestScenario } from './infer';

const TODAY = '2026-08-26';

function board(overrides: Partial<RoomBoardRow> = {}): RoomBoardRow {
  return {
    room_id: 'test-room',
    room_number: 'T01',
    floor: 0,
    room_type: 'studio',
    room_status: 'occupied',
    monthly_rent: 3500,
    deposit: 3500,
    is_test: true,
    contract_id: 'c1',
    contract_status: 'active',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    occupant_count: 2,
    payment_due_day: 5,
    tenant_id: 't1',
    tenant_name: 'Test Tenant',
    tenant_phone: '0800000000',
    invoice_id: 'i1',
    invoice_number: 'INV-202608-T01',
    billing_month: '2026-08-01',
    due_date: '2026-08-28',
    invoice_status: 'paid',
    invoice_total: 4660,
    paid_amount: 4660,
    outstanding: 0,
    financial_status: 'paid',
    open_maintenance_count: 0,
    lost_card_count: 0,
    active_card_count: 2,
    total_card_count: 2,
    notice_given_at: null,
    planned_move_out_date: null,
    ...overrides,
  };
}

describe('inferTestScenario', () => {
  it('reports normal for a paid, healthy room', () => {
    expect(inferTestScenario(board(), TODAY)).toBe('normal');
  });

  it('reports payment_due for an unpaid invoice still in date', () => {
    expect(
      inferTestScenario(
        board({
          invoice_status: 'issued',
          financial_status: 'payment_due',
          paid_amount: 0,
          outstanding: 4660,
        }),
        TODAY,
      ),
    ).toBe('payment_due');
  });

  it('reports overdue for an unpaid invoice past its due date', () => {
    expect(
      inferTestScenario(
        board({
          invoice_status: 'overdue',
          financial_status: 'overdue',
          due_date: '2026-08-05',
          paid_amount: 0,
          outstanding: 4660,
        }),
        TODAY,
      ),
    ).toBe('overdue');
  });

  it('reports partial_payment ahead of overdue when something has been paid', () => {
    expect(
      inferTestScenario(
        board({
          invoice_status: 'partially_paid',
          financial_status: 'overdue',
          paid_amount: 2330,
          outstanding: 2330,
        }),
        TODAY,
      ),
    ).toBe('partial_payment');
  });

  it('reports vacant', () => {
    expect(inferTestScenario(board({ room_status: 'vacant' }), TODAY)).toBe('vacant');
  });

  it('reports maintenance ahead of everything else', () => {
    expect(
      inferTestScenario(
        board({ room_status: 'maintenance', financial_status: 'overdue', lost_card_count: 1 }),
        TODAY,
      ),
    ).toBe('maintenance');
  });

  it('reports lost_card', () => {
    expect(inferTestScenario(board({ lost_card_count: 1, active_card_count: 1 }), TODAY)).toBe(
      'lost_card',
    );
  });

  it('reports contract_expiring when a paid room lapses within 20 days', () => {
    expect(inferTestScenario(board({ end_date: '2026-09-10' }), TODAY)).toBe('contract_expiring');
  });

  it('returns null with no room', () => {
    expect(inferTestScenario(null, TODAY)).toBeNull();
  });
});
