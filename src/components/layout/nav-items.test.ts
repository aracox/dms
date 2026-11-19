import { describe, expect, it } from 'vitest';

import { ACCOUNT_NAV_ITEMS, NAV_SECTIONS } from './nav-items';

describe('main navigation', () => {
  it('follows the dormitory workflow order', () => {
    expect(
      NAV_SECTIONS.map((section) => ({
        section: section.labelKey,
        routes: section.items.map((item) => item.href),
      })),
    ).toEqual([
      { section: null, routes: ['/dashboard', '/floor-plan', '/rooms'] },
      { section: 'monthlyWorkflow', routes: ['/meters', '/billing', '/payments', '/refunds'] },
      { section: 'operations', routes: ['/access-cards', '/maintenance'] },
      { section: 'financeInsights', routes: ['/expenses', '/reports'] },
    ]);
  });

  it('keeps profile in the account menu instead of duplicating it in the sidebar', () => {
    expect(NAV_SECTIONS.flatMap((section) => section.items).map((item) => item.href)).not.toContain(
      '/profile',
    );
  });

  it('puts system administration in the account menu, not the sidebar', () => {
    const sidebar = NAV_SECTIONS.flatMap((section) => section.items).map((item) => item.href);
    const account = ACCOUNT_NAV_ITEMS.map((item) => item.href);

    expect(account).toEqual(['/settings', '/test', '/audit', '/staff']);
    expect(sidebar.filter((href) => account.includes(href))).toEqual([]);
  });
});
