import { describe, expect, it } from 'vitest';

import { buildMonthlyInvoiceItems, invoiceTotals, meterAmount } from '@/lib/billing/calc';

import {
  DEFAULT_TEST_SCENARIO,
  T01_DEFAULTS,
  TEST_SCENARIO_IDS,
  TEST_SCENARIOS,
  isTestScenarioId,
} from './index';

describe('T01 defaults', () => {
  it('match the specification', () => {
    expect(T01_DEFAULTS.roomNumber).toBe('T01');
    expect(T01_DEFAULTS.tenantName).toBe('Test Tenant');
    expect(T01_DEFAULTS.tenantPhone).toBe('0800000000');
    expect(T01_DEFAULTS.occupantCount).toBe(2);
    expect(T01_DEFAULTS.monthlyRent).toBe(6500);
    expect(T01_DEFAULTS.deposit).toBe(13000);
  });

  it('sit on floor 0, off every production floor plan', () => {
    expect(T01_DEFAULTS.floor).toBe(0);
  });

  it('define exactly two access cards, named for the room', () => {
    expect(T01_DEFAULTS.cards).toHaveLength(2);
    expect(T01_DEFAULTS.cards.map((card) => card.cardNumber)).toEqual(['T01-A', 'T01-B']);
    expect(T01_DEFAULTS.cards.map((card) => card.cardUid)).toEqual([
      'TEST-CARD-001',
      'TEST-CARD-002',
    ]);
  });

  it('produce the example invoice from the specification', () => {
    const { electricity, water } = T01_DEFAULTS.meters;

    expect(
      meterAmount(electricity.previousReading, electricity.currentReading, electricity.rate),
    ).toBe(1040);
    expect(meterAmount(water.previousReading, water.currentReading, water.rate)).toBe(120);

    const totals = invoiceTotals(
      buildMonthlyInvoiceItems({
        monthlyRent: T01_DEFAULTS.monthlyRent,
        electricity,
        water,
      }),
    );

    // Rent 6,500 + Electricity 1,040 + Water 120 = 7,660 THB
    expect(totals.total).toBe(7660);
  });
});

describe('test scenarios', () => {
  it('cover all eight required scenarios', () => {
    expect(TEST_SCENARIO_IDS).toEqual([
      'normal',
      'payment_due',
      'overdue',
      'vacant',
      'maintenance',
      'lost_card',
      'partial_payment',
      'contract_expiring',
    ]);
  });

  it('define state for every id', () => {
    for (const id of TEST_SCENARIO_IDS) {
      expect(TEST_SCENARIOS[id].id).toBe(id);
    }
  });

  it('reset to the normal scenario', () => {
    expect(DEFAULT_TEST_SCENARIO).toBe('normal');
    const normal = TEST_SCENARIOS.normal.state;
    expect(normal.roomStatus).toBe('occupied');
    expect(normal.contract?.occupantCount).toBe(T01_DEFAULTS.occupantCount);
    expect(normal.invoice?.paidFraction).toBe(1);
    expect(normal.cards).toEqual({ slotA: 'active', slotB: 'active', replacementFee: 0 });
  });

  it('make each scenario actually distinguishable', () => {
    const { payment_due, overdue, partial_payment, vacant, maintenance, lost_card } =
      TEST_SCENARIOS;

    // Payment due is unpaid but not yet late; overdue is unpaid and late.
    expect(payment_due.state.invoice?.dueInDays).toBeGreaterThan(0);
    expect(payment_due.state.invoice?.paidFraction).toBe(0);
    expect(overdue.state.invoice?.dueInDays).toBeLessThan(0);
    expect(overdue.state.invoice?.paidFraction).toBe(0);

    // Partial payment sits between the two.
    expect(partial_payment.state.invoice?.paidFraction).toBeGreaterThan(0);
    expect(partial_payment.state.invoice?.paidFraction).toBeLessThan(1);

    expect(vacant.state.contract).toBeNull();
    expect(vacant.state.invoice).toBeNull();

    expect(maintenance.state.roomStatus).toBe('maintenance');
    expect(maintenance.state.maintenance?.priority).toBe('urgent');

    expect(lost_card.state.cards.slotB).toBe('lost');
    expect(lost_card.state.cards.replacementFee).toBeGreaterThan(0);
  });

  it('expires the contract_expiring scenario within the dashboard warning window', () => {
    const endsInDays = TEST_SCENARIOS.contract_expiring.state.contract?.endsInDays;
    expect(endsInDays).toBeGreaterThan(0);
    expect(endsInDays).toBeLessThanOrEqual(60);
  });

  it('keeps every scenario on two access cards', () => {
    for (const id of TEST_SCENARIO_IDS) {
      const { cards } = TEST_SCENARIOS[id].state;
      expect(Object.keys(cards).filter((key) => key.startsWith('slot'))).toHaveLength(2);
    }
  });

  it('validates scenario ids', () => {
    expect(isTestScenarioId('overdue')).toBe(true);
    expect(isTestScenarioId('nonsense')).toBe(false);
    expect(isTestScenarioId(null)).toBe(false);
  });
});
