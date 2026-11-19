import type { MeterType, MeterUsageRow } from '@/types/database';

export type RoomMeterReadings = Partial<Record<MeterType, MeterUsageRow>>;

export function groupMeterReadingsByRoom(readings: MeterUsageRow[]) {
  const grouped = new Map<string, RoomMeterReadings>();

  for (const reading of readings) {
    const roomReadings = grouped.get(reading.room_id) ?? {};
    roomReadings[reading.meter_type] = reading;
    grouped.set(reading.room_id, roomReadings);
  }

  return grouped;
}

export function meterRoomIsComplete(readings?: RoomMeterReadings) {
  return Boolean(readings?.electricity && readings.water);
}

export function compareMeterRoomProgress(
  left: { complete: boolean; room_number: string },
  right: { complete: boolean; room_number: string },
) {
  return (
    Number(left.complete) - Number(right.complete) ||
    left.room_number.localeCompare(right.room_number)
  );
}
