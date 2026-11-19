import type { FloorLayout } from '@/config/floor-layout';

/**
 * Proportions of the 2.5D building view, in SVG units. The facade is drawn
 * flat-on so room labels stay upright; depth comes from the end wall and roof,
 * drawn back along (depthX, depthY) -- an oblique projection.
 */
export const BUILDING = {
  floorHeight: 96,
  depthX: -46,
  depthY: -30,
  /** Brick lattice screen at each end of the facade, as in the owner's sketch. */
  lattice: 24,
  roofOverhang: 10,
  fascia: 8,
  /** Gutter for the floor labels left of the end wall. */
  labelGutter: 58,
  house: { width: 74, bodyHeight: 64, roofHeight: 26, gap: 10, offset: 36 },
} as const;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BuildingRoom extends Box {
  roomNumber: string;
  floor: number;
}

export interface BuildingFloor {
  floor: number;
  top: number;
  bottom: number;
}

export interface BuildingGeometry {
  viewBox: string;
  /** Facade left edge (outer edge of the left lattice). */
  x0: number;
  /** Left edge of the first room. */
  roomsLeft: number;
  /** Right edge of the last room. */
  roomsRight: number;
  /** Facade right edge, past the stair tower and its lattice. */
  right: number;
  /** Top of the top floor. Ground is y = 0; up is negative. */
  top: number;
  floors: BuildingFloor[];
  rooms: BuildingRoom[];
  stairs: { x: number; width: number } | null;
  houses: (Box & { roomNumber: string })[];
}

/**
 * Lay the building out from the floor-plan JSON: each floor's dorm rooms keep
 * their x order and widths, floors stack bottom-up, the stair tower follows the
 * last room, and the houses stand in a row to the right. Derived entirely from
 * the layouts, so a real plan dropped into the JSON redraws the building too.
 */
export function buildingGeometry(
  layouts: readonly FloorLayout[],
  isHouse: (roomNumber: string) => boolean,
): BuildingGeometry {
  const { floorHeight, lattice, house, depthX, depthY, fascia, labelGutter } = BUILDING;

  const dorm = layouts.flatMap((layout) =>
    layout.rooms
      .filter((room) => !isHouse(room.roomNumber))
      .map((room) => ({ ...room, floor: layout.floor })),
  );
  const houseNumbers = layouts
    .flatMap((layout) => layout.rooms)
    .filter((room) => isHouse(room.roomNumber))
    .map((room) => room.roomNumber)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  const floorNumbers = [...new Set(dorm.map((room) => room.floor))].sort((a, b) => a - b);
  const floors: BuildingFloor[] = floorNumbers.map((floor, index) => ({
    floor,
    bottom: -index * floorHeight,
    top: -(index + 1) * floorHeight,
  }));
  const bandOf = new Map(floors.map((band) => [band.floor, band]));

  const minX = dorm.length ? Math.min(...dorm.map((room) => room.x)) : 0;
  const maxX = dorm.length ? Math.max(...dorm.map((room) => room.x + room.width)) : 0;

  const x0 = 0;
  const roomsLeft = x0 + lattice;
  const roomsRight = roomsLeft + (maxX - minX);

  const stairsDecoration = layouts
    .flatMap((layout) => layout.decorations)
    .find((decoration) => decoration.type === 'stairs');
  const stairs = stairsDecoration ? { x: roomsRight, width: stairsDecoration.width } : null;
  const right = stairs ? stairs.x + stairs.width + lattice : roomsRight;

  const rooms: BuildingRoom[] = dorm.map((room) => {
    const band = bandOf.get(room.floor)!;
    return {
      roomNumber: room.roomNumber,
      floor: room.floor,
      x: roomsLeft + (room.x - minX),
      y: band.top,
      width: room.width,
      height: floorHeight,
    };
  });

  const housesLeft = right + house.offset;
  const houses = houseNumbers.map((roomNumber, index) => ({
    roomNumber,
    x: housesLeft + index * (house.width + house.gap),
    y: -house.bodyHeight,
    width: house.width,
    height: house.bodyHeight,
  }));

  const top = floors.length ? floors[floors.length - 1]!.top : 0;
  const housesRight = houses.length ? houses[houses.length - 1]!.x + house.width : right;

  const viewLeft = x0 + depthX - labelGutter;
  const viewTop = top - 4 - fascia + depthY - 18;
  // Room on the right for the tree past the last house.
  const viewRight = Math.max(right, housesRight) + 84;
  const viewBottom = 26;

  return {
    viewBox: [viewLeft, viewTop, viewRight - viewLeft, viewBottom - viewTop].join(' '),
    x0,
    roomsLeft,
    roomsRight,
    right,
    top,
    floors,
    rooms,
    stairs,
    houses,
  };
}
