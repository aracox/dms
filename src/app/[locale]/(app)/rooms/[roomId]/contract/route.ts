import { renderContractPdf } from '@/lib/pdf/ContractDocument';
import { can } from '@/lib/permissions';
import { getRoomDetail } from '@/lib/rooms/queries';
import { getDormitoryIdentity } from '@/lib/settings/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import { bangkokToday } from '@/lib/utils/date';

/** Downloads the active contract for a room as a PDF (สัญญาเช่า). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const profile = await getCurrentProfile();
  if (!can(profile?.role, 'contracts:read')) {
    return new Response('Forbidden', { status: 403 });
  }

  const { roomId } = await params;
  const detail = await getRoomDetail(roomId);

  if (!detail || !detail.contract || !detail.tenant) {
    return new Response('Not found', { status: 404 });
  }

  const { name_th, name_en } = await getDormitoryIdentity();
  const buffer = await renderContractPdf({
    dormitoryName: name_th || name_en || 'หอพัก',
    generatedDate: bangkokToday(),
    room: detail.room,
    contract: detail.contract,
    tenant: detail.tenant,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="contract-${detail.room.room_number}.pdf"`,
    },
  });
}
