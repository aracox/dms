/**
 * The หอพัก / บ้านพัก split.
 *
 * The dormitory is two businesses under one roof: 21 dorm rooms and 3
 * standalone houses. The owner reads their numbers apart, so every per-segment
 * report view carries a `segment` column.
 *
 * `propertySegment` mirrors the SQL function `room_property_segment()` from
 * migration 0024. Change one, change both.
 */

import type { PropertySegment, RoomType } from '@/types/database';

/** Display order everywhere: หอพัก first, บ้านพัก second. */
export const PROPERTY_SEGMENTS = ['dorm', 'house'] as const satisfies readonly PropertySegment[];

/** Only room_type 'house' is a บ้านพัก. Every other type is a dorm room. */
export function propertySegment(roomType: RoomType): PropertySegment {
  return roomType === 'house' ? 'house' : 'dorm';
}

/**
 * Split rows into the two segments by their room type -- the TypeScript
 * equivalent of `group by room_property_segment(r.room_type)`.
 */
export function partitionBySegment<T extends { room_type: RoomType }>(
  rows: readonly T[],
): Record<PropertySegment, T[]> {
  return {
    dorm: rows.filter((row) => propertySegment(row.room_type) === 'dorm'),
    house: rows.filter((row) => propertySegment(row.room_type) === 'house'),
  };
}

/**
 * Index per-segment rows by segment, filling in `empty` for a segment the view
 * returned no row for (a segment with no rooms yet).
 */
export function bySegment<T>(
  rows: readonly (T & { segment: PropertySegment })[],
  empty: (segment: PropertySegment) => T,
): Record<PropertySegment, T> {
  const indexed = {} as Record<PropertySegment, T>;
  for (const segment of PROPERTY_SEGMENTS) {
    indexed[segment] = rows.find((row) => row.segment === segment) ?? empty(segment);
  }
  return indexed;
}

/**
 * The dashboard's segment filter: one segment on its own, or both combined.
 *
 * Kept separate from `PropertySegment` because 'all' is a view of the data, not
 * a property of a room -- no row is ever tagged 'all'.
 */
export type SegmentView = 'all' | PropertySegment;

/** Switcher order: ทั้งหมด first, then the segments in display order. */
export const SEGMENT_VIEWS = [
  'all',
  ...PROPERTY_SEGMENTS,
] as const satisfies readonly SegmentView[];

/**
 * Reads the `?segment=` query parameter. Anything unrecognised -- a stale
 * bookmark, a hand-edited URL, a repeated parameter -- falls back to the
 * combined view rather than throwing, so the dashboard always renders.
 */
export function parseSegmentView(value: string | string[] | undefined): SegmentView {
  const first = Array.isArray(value) ? value[0] : value;
  return SEGMENT_VIEWS.find((view) => view === first) ?? 'all';
}

/** The figures the selected view should show: the combined row, or one segment's. */
export function forView<T>(view: SegmentView, whole: T, perSegment: Record<PropertySegment, T>): T {
  return view === 'all' ? whole : perSegment[view];
}

/**
 * Narrows a list of report rows to the selected view.
 *
 * A row with no segment -- a common-area maintenance ticket, which belongs to
 * the building rather than to หอพัก or บ้านพัก -- appears only in the combined
 * view, since claiming it for either segment would be a lie.
 */
export function filterByView<T extends { property_segment: PropertySegment | null }>(
  view: SegmentView,
  rows: readonly T[],
): T[] {
  return view === 'all' ? [...rows] : rows.filter((row) => row.property_segment === view);
}

/** The segments a view draws: both when combined, otherwise just the one. */
export function viewSegments(view: SegmentView): readonly PropertySegment[] {
  return view === 'all' ? PROPERTY_SEGMENTS : [view];
}

/**
 * Narrows rows that carry a `room_type` to the selected view.
 *
 * The operational `v_room_board` rows behind the rooms list have no
 * `property_segment` column -- only the report_* views add it -- so the segment
 * is derived here exactly as `room_property_segment()` derives it in SQL.
 */
export function filterRoomsByView<T extends { room_type: RoomType }>(
  view: SegmentView,
  rows: readonly T[],
): T[] {
  return view === 'all' ? [...rows] : rows.filter((row) => propertySegment(row.room_type) === view);
}
