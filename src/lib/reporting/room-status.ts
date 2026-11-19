import type { ReportRoomRow } from '@/types/database';

/** The columns of `report_rooms` the dashboard's room status map needs. */
export type RoomStatusRow = Pick<
  ReportRoomRow,
  'room_id' | 'room_number' | 'floor' | 'room_status' | 'financial_status' | 'property_segment'
>;

export type RoomStatusGroup =
  | { kind: 'floor'; floor: number; rooms: RoomStatusRow[] }
  | { kind: 'house'; rooms: RoomStatusRow[] };

const byRoomNumber = (a: RoomStatusRow, b: RoomStatusRow) =>
  a.room_number.localeCompare(b.room_number, 'en', { numeric: true });

/**
 * Rows of the room status map: dorm floors top-down, as the building stands,
 * then the houses, which have no floor of their own. Empty groups are dropped
 * so a segment-filtered map shows only that segment's rows.
 */
export function groupRoomStatus(rows: readonly RoomStatusRow[]): RoomStatusGroup[] {
  const floors = new Map<number, RoomStatusRow[]>();
  const houses: RoomStatusRow[] = [];

  for (const row of rows) {
    if (row.property_segment === 'house') {
      houses.push(row);
    } else {
      floors.set(row.floor, [...(floors.get(row.floor) ?? []), row]);
    }
  }

  const groups: RoomStatusGroup[] = [...floors.entries()]
    .sort(([a], [b]) => b - a)
    .map(([floor, rooms]) => ({ kind: 'floor', floor, rooms: rooms.sort(byRoomNumber) }));

  if (houses.length > 0) groups.push({ kind: 'house', rooms: houses.sort(byRoomNumber) });
  return groups;
}
