import { describe, expect, it } from 'vitest';

import { NAV_SECTIONS } from './nav-items';

describe('main navigation', () => {
  it('follows the dormitory workflow order', () => {
    expect(
      NAV_SECTIONS.map((section) => ({
        section: section.labelKey,
        routes: section.items.map((item) => item.href),
      })),
    ).toEqual([
      { section: null, routes: ['/dashboard', '/floor-plan', '/rooms'] },
      { section: 'monthlyWorkflow', routes: ['/meters', '/billing', '/payments'] },
      { section: 'operations', routes: ['/access-cards', '/maintenance'] },
      { section: 'financeInsights', routes: ['/expenses', '/reports'] },
      { section: 'system', routes: ['/settings', '/test'] },
    ]);
  });

  it('keeps profile in the account menu instead of duplicating it in the sidebar', () => {
    expect(NAV_SECTIONS.flatMap((section) => section.items).map((item) => item.href)).not.toContain(
      '/profile',
    );
  });
});
