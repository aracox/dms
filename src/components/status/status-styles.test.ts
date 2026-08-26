import { describe, expect, it } from 'vitest';

import { LEGEND_ORDER, STATUS_STYLES, toDisplayStatus } from './status-styles';

describe('toDisplayStatus', () => {
  it('lets room status win for anything other than occupied', () => {
    // A room withdrawn for repair reads as maintenance even with money owing.
    expect(toDisplayStatus('maintenance', 'overdue')).toBe('maintenance');
    expect(toDisplayStatus('vacant', 'overdue')).toBe('vacant');
    expect(toDisplayStatus('reserved', 'payment_due')).toBe('reserved');
  });

  it('folds financial status into occupied rooms', () => {
    expect(toDisplayStatus('occupied', 'paid')).toBe('occupied_paid');
    expect(toDisplayStatus('occupied', 'payment_due')).toBe('occupied_due');
    expect(toDisplayStatus('occupied', 'overdue')).toBe('occupied_overdue');
    expect(toDisplayStatus('occupied', 'none')).toBe('occupied_no_bill');
  });
});

describe('status styles', () => {
  it('never rely on colour alone', () => {
    for (const [status, style] of Object.entries(STATUS_STYLES)) {
      expect(style.icon, `${status} needs an icon`).toBeTruthy();
      expect(style.labelKey, `${status} needs a text label`).toBeTruthy();
    }
  });

  it('hatch the maintenance fill so it reads without colour', () => {
    expect(STATUS_STYLES.maintenance.hatched).toBe(true);
  });

  it('give every display status a distinct icon', () => {
    const icons = Object.values(STATUS_STYLES).map((style) => style.icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('list every status in the legend, worst first', () => {
    expect([...LEGEND_ORDER].sort()).toEqual(Object.keys(STATUS_STYLES).sort());
    expect(LEGEND_ORDER[0]).toBe('occupied_overdue');
  });
});
