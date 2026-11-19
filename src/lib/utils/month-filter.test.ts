import { describe, expect, it } from 'vitest';

import { isRoomForMonth, monthQuery, parseMonthParams } from './month-filter';

describe('parseMonthParams', () => {
  it('reads a year and a 1-12 month', () => {
    expect(parseMonthParams('2026', '3', '2026-11-01')).toBe('2026-03-01');
  });

  it('returns null for a missing or malformed part', () => {
    expect(parseMonthParams(undefined, '3', '2026-11-01')).toBeNull();
    expect(parseMonthParams('2026', '', '2026-11-01')).toBeNull();
    expect(parseMonthParams('2026', '13', '2026-11-01')).toBeNull();
    expect(parseMonthParams('26', '3', '2026-11-01')).toBeNull();
  });

  it('clamps a future month to the current one', () => {
    expect(parseMonthParams('2030', '1', '2026-11-01')).toBe('2026-11-01');
  });
});

describe('monthQuery', () => {
  it('leaves out the page default month', () => {
    expect(monthQuery('2026-11-01', '2026-11-01')).toEqual({});
    expect(monthQuery('2026-11-01', '2026-11-01', { room: '201', category: undefined })).toEqual({
      room: '201',
    });
    expect(monthQuery('2026-10-01', '2026-11-01')).toEqual({ year: '2026', month: '10' });
  });
});

describe('isRoomForMonth', () => {
  const active = (start: string) => ({ contract_status: 'active' as const, start_date: start });
  const ended = { contract_status: 'terminated' as const, start_date: '2025-01-15' };

  it('keeps a moved-out room only in months it has a record for', () => {
    expect(isRoomForMonth(ended, true, '2026-09-01')).toBe(true);
    expect(isRoomForMonth(ended, false, '2026-09-01')).toBe(false);
  });

  it('includes an active room from its move-in month on, not before', () => {
    expect(isRoomForMonth(active('2026-09-20'), false, '2026-09-01')).toBe(true);
    expect(isRoomForMonth(active('2026-10-03'), false, '2026-09-01')).toBe(false);
  });
});
