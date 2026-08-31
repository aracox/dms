import { describe, expect, it } from 'vitest';

import { FLOOR_LAYOUTS, getFloorLayout, layoutRoomCount, layoutRoomNumbers } from './index';

describe('floor layouts', () => {
  it('describe exactly the 21 real rooms', () => {
    expect(layoutRoomCount()).toBe(21);
  });

  it('cover floors 1 to 3 and nothing else', () => {
    expect(FLOOR_LAYOUTS.map((layout) => layout.floor)).toEqual([1, 2, 3]);
    expect(getFloorLayout(0)).toBeUndefined();
  });

  it('never place the T01 test room', () => {
    expect(layoutRoomNumbers()).not.toContain('T01');
    expect(layoutRoomNumbers().every((room) => /^[123]0[1-7]$/.test(room))).toBe(true);
  });

  it('use unique room numbers across every floor', () => {
    const numbers = layoutRoomNumbers();
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('give each room a positive footprint inside the viewBox', () => {
    for (const layout of FLOOR_LAYOUTS) {
      const [, , viewWidth, viewHeight] = layout.viewBox.split(' ').map(Number);

      for (const room of layout.rooms) {
        expect(room.width, `${room.roomNumber} width`).toBeGreaterThan(0);
        expect(room.height, `${room.roomNumber} height`).toBeGreaterThan(0);
        expect(room.x + room.width, `${room.roomNumber} right edge`).toBeLessThanOrEqual(
          viewWidth!,
        );
        expect(room.y + room.height, `${room.roomNumber} bottom edge`).toBeLessThanOrEqual(
          viewHeight!,
        );
      }
    }
  });

  it('do not overlap rooms on the same floor', () => {
    for (const layout of FLOOR_LAYOUTS) {
      for (let i = 0; i < layout.rooms.length; i += 1) {
        for (let j = i + 1; j < layout.rooms.length; j += 1) {
          const a = layout.rooms[i]!;
          const b = layout.rooms[j]!;
          const overlaps =
            a.x < b.x + b.width &&
            b.x < a.x + a.width &&
            a.y < b.y + b.height &&
            b.y < a.y + a.height;
          expect(
            overlaps,
            `${a.roomNumber} overlaps ${b.roomNumber} on floor ${layout.floor}`,
          ).toBe(false);
        }
      }
    }
  });

  it('form a rectangular outline', () => {
    for (const layout of FLOOR_LAYOUTS) {
      expect(layout.outline.length).toBe(4);
    }
  });

  it('are flagged provisional until the real plan is supplied', () => {
    // Flip these to false in the JSON once the real geometry is mapped, so the
    // "provisional layout" notice disappears from the UI.
    for (const layout of FLOOR_LAYOUTS) {
      expect(typeof layout.provisional).toBe('boolean');
      expect(layout.note.length).toBeGreaterThan(20);
    }
  });
});
