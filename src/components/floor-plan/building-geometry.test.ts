import { describe, expect, it } from 'vitest';

import { FLOOR_LAYOUTS } from '@/config/floor-layout';

import { BUILDING, buildingGeometry } from './building-geometry';

const isHouse = (roomNumber: string) => roomNumber.startsWith('H');
const geometry = buildingGeometry(FLOOR_LAYOUTS, isHouse);

describe('buildingGeometry', () => {
  it('places all 21 dorm rooms on the facade and the 3 houses beside it', () => {
    expect(geometry.rooms).toHaveLength(21);
    expect(geometry.houses.map((h) => h.roomNumber)).toEqual(['H101', 'H102', 'H103']);
  });

  it('stacks floors bottom-up, so a higher floor sits above a lower one', () => {
    const y = (n: string) => geometry.rooms.find((r) => r.roomNumber === n)!.y;
    expect(y('301')).toBeLessThan(y('201'));
    expect(y('201')).toBeLessThan(y('101'));
    expect(geometry.floors.map((f) => f.floor)).toEqual([1, 2, 3]);
  });

  it('keeps the plan order along each floor, 101 on the left to 107 on the right', () => {
    const floor1 = geometry.rooms.filter((r) => r.floor === 1).sort((a, b) => a.x - b.x);
    expect(floor1.map((r) => r.roomNumber)).toEqual([
      '101',
      '102',
      '103',
      '104',
      '105',
      '106',
      '107',
    ]);
  });

  it('puts the stair tower after the last room and the houses past the facade', () => {
    expect(geometry.stairs?.x).toBe(geometry.roomsRight);
    for (const house of geometry.houses) {
      expect(house.x).toBeGreaterThan(geometry.right);
    }
  });

  it('frames everything, the end wall and roof depth included, inside the viewBox', () => {
    const [left, top, width, height] = geometry.viewBox.split(' ').map(Number);
    const right = left! + width!;
    const bottom = top! + height!;

    expect(left).toBeLessThan(geometry.x0 + BUILDING.depthX);
    expect(top).toBeLessThan(geometry.top + BUILDING.depthY);
    for (const box of [...geometry.rooms, ...geometry.houses]) {
      expect(box.x + box.width).toBeLessThanOrEqual(right);
      expect(box.y + box.height).toBeLessThanOrEqual(bottom);
    }
  });
});
