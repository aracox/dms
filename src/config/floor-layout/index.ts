/**
 * Floor plan geometry.
 *
 * Static configuration, deliberately NOT in the database: it describes the
 * building, not the business. Room records join to it by `room_number`.
 *
 * The current geometry is PROVISIONAL -- see the `note` in each JSON file. When
 * the real dormitory plan is supplied, edit only the JSON.
 */

import floor1 from './floor-1.json';
import floor2 from './floor-2.json';
import floor3 from './floor-3.json';

export interface RoomLayout {
  roomNumber: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export type DecorationType = 'corridor' | 'stairs' | 'entrance' | 'lift';

export interface Decoration {
  type: DecorationType;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloorLayout {
  floor: number;
  provisional: boolean;
  note: string;
  viewBox: string;
  outline: [number, number][];
  decorations: Decoration[];
  rooms: RoomLayout[];
}

/** Production floors only. T01 lives on floor 0 and has no layout by design. */
export const FLOOR_LAYOUTS: readonly FloorLayout[] = [
  floor1 as FloorLayout,
  floor2 as FloorLayout,
  floor3 as FloorLayout,
];

export const FLOORS = [1, 2, 3] as const;

export type FloorNumber = (typeof FLOORS)[number];

export function isFloorNumber(value: unknown): value is FloorNumber {
  return typeof value === 'number' && FLOORS.includes(value as FloorNumber);
}

export function getFloorLayout(floor: number): FloorLayout | undefined {
  return FLOOR_LAYOUTS.find((layout) => layout.floor === floor);
}

/** Total rooms the layout files describe. Must be 24 (21 dorm rooms + 3 houses). */
export function layoutRoomCount(): number {
  return FLOOR_LAYOUTS.reduce((total, layout) => total + layout.rooms.length, 0);
}

/** Every room number the floor plans place, in order. */
export function layoutRoomNumbers(): string[] {
  return FLOOR_LAYOUTS.flatMap((layout) => layout.rooms.map((room) => room.roomNumber));
}

/**
 * A viewBox hugging everything drawn on a floor -- outline, decorations and
 * rooms -- plus `padding` on each side, so the plan fills its frame instead of
 * floating in the JSON's fixed canvas. Derived from the geometry, so a real
 * plan dropped into the JSON fits itself with no component change. (Rotation
 * is ignored; the padding absorbs the small overhang of a rotated room.)
 */
export function contentViewBox(layout: FloorLayout, padding = 14): string {
  const xs: number[] = [];
  const ys: number[] = [];

  for (const [x, y] of layout.outline) {
    xs.push(x);
    ys.push(y);
  }
  for (const box of [...layout.decorations, ...layout.rooms]) {
    xs.push(box.x, box.x + box.width);
    ys.push(box.y, box.y + box.height);
  }

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...ys) - minY;

  return [minX - padding, minY - padding, width + padding * 2, height + padding * 2].join(' ');
}
