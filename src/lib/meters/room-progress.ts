import { billingMonthOf, type IsoDate } from '@/lib/utils/date';
import type { ContractStatus, MeterType, MeterUsageRow } from '@/types/database';

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

/**
 * Whether the meters page lists a room for `month`: any room with a reading
 * that month, plus every active contract that had started by then (the readings
 * still owed). So a past month keeps a room whose tenant has since moved out,
 * and does not flag a later move-in as missing.
 */
export function isMeterRoomForMonth(
  room: { contract_status: ContractStatus | null; start_date: IsoDate | null },
  readings: RoomMeterReadings | undefined,
  month: IsoDate,
) {
  if (readings) return true;
  if (room.contract_status !== 'active') return false;
  return room.start_date === null || billingMonthOf(room.start_date) <= month;
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
