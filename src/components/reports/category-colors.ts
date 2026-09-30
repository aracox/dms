import type { CommonExpenseCategory } from '@/types/database';

/**
 * Ring order and color per category (globals.css --color-chart-cat-*). The
 * palette was validated as a ring in exactly this order, so slices are drawn
 * in it -- never re-sorted by size, which would put unvalidated pairs side by
 * side. Class names are spelled out so Tailwind emits them.
 */
export const CATEGORY_RING: readonly {
  category: CommonExpenseCategory;
  stroke: string;
  swatch: string;
}[] = [
  { category: 'common_electricity', stroke: 'stroke-chart-cat-1', swatch: 'bg-chart-cat-1' },
  { category: 'common_water', stroke: 'stroke-chart-cat-2', swatch: 'bg-chart-cat-2' },
  { category: 'other', stroke: 'stroke-chart-cat-3', swatch: 'bg-chart-cat-3' },
  { category: 'housekeeping', stroke: 'stroke-chart-cat-4', swatch: 'bg-chart-cat-4' },
  { category: 'gardening', stroke: 'stroke-chart-cat-5', swatch: 'bg-chart-cat-5' },
  { category: 'internet', stroke: 'stroke-chart-cat-6', swatch: 'bg-chart-cat-6' },
  { category: 'transformer_fee', stroke: 'stroke-chart-cat-7', swatch: 'bg-chart-cat-7' },
];
