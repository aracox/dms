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
