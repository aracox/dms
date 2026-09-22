import { contractNumber } from '@/lib/contracts/contract-number';
import { renderContractPdf } from '@/lib/pdf/ContractDocument';
import { can } from '@/lib/permissions';
import { propertySegment } from '@/lib/reporting/segments';
import { getRoomDetail } from '@/lib/rooms/queries';
import {
  getOwnerName,
  getPaymentBank,
  getPropertyAddress,
  getPropertyName,
  getSegmentSettings,
} from '@/lib/settings/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import { bangkokToday } from '@/lib/utils/date';

/**
 * Serves the active contract for a room as a PDF (สัญญาเช่า) -- as an
 * attachment (downloads) by default, or inline (opens in the browser's PDF
 * viewer) when called with `?view=1`.
 */
export async function GET(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const profile = await getCurrentProfile();
  if (!can(profile?.role, 'contracts:read')) {
    return new Response('Forbidden', { status: 403 });
  }

  const { roomId } = await params;
  const detail = await getRoomDetail(roomId);

  if (!detail || !detail.contract || !detail.tenant) {
    return new Response('Not found', { status: 404 });
  }

  const segment = propertySegment(detail.room.room_type);
  const [{ name_th, name_en }, owner, paymentBank, propertyAddress, segmentSettings] =
    await Promise.all([
      getPropertyName(segment),
      getOwnerName(segment),
      getPaymentBank(segment),
      getPropertyAddress(segment),
      getSegmentSettings(segment),
    ]);
  const dormitoryName = name_th || name_en || 'หอพัก';
  const buffer = await renderContractPdf({
    contractNumber: contractNumber(detail.contract),
    dormitoryName,
    propertyAddress,
    // Falls back to the property name until the owner sets a name for this
    // segment in Settings.
    owner: { ...owner, name_th: owner.name_th || owner.name_en || dormitoryName },
    paymentBank,
    lateFeePerDay: segmentSettings.late_fee_per_day,
    electricityRate: segmentSettings.electricity_rate,
    waterRate: segmentSettings.water_rate,
    internetFee: segmentSettings.internet_fee,
    generatedDate: bangkokToday(),
    room: detail.room,
    contract: detail.contract,
    tenant: detail.tenant,
  });

  const inline = new URL(request.url).searchParams.get('view') === '1';
  const disposition = inline ? 'inline' : 'attachment';

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="contract-${detail.room.room_number}.pdf"`,
    },
  });
}
