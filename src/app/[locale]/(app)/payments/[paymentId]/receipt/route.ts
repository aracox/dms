import { renderReceiptPdf } from '@/lib/pdf/ReceiptDocument';
import { can } from '@/lib/permissions';
import { getPaymentReceipt } from '@/lib/payments/queries';
import { getDormitoryIdentity } from '@/lib/settings/queries';
import { getCurrentProfile } from '@/lib/supabase/server';
import { bangkokToday } from '@/lib/utils/date';

/** Downloads a confirmed payment's receipt as a PDF. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; paymentId: string }> },
) {
  const profile = await getCurrentProfile();
  if (!can(profile?.role, 'payments:read')) {
    return new Response('Forbidden', { status: 403 });
  }

  const { locale, paymentId } = await params;
  const receipt = await getPaymentReceipt(paymentId);

  if (!receipt || receipt.payment.status !== 'confirmed') {
    return new Response('Not found', { status: 404 });
  }

  const { name_th, name_en } = await getDormitoryIdentity();
  const typedLocale = locale === 'en' ? 'en' : 'th';
  const buffer = await renderReceiptPdf({
    locale: typedLocale,
    dormitoryName: (typedLocale === 'th' ? name_th : name_en) || name_th || 'หอพัก',
    generatedDate: bangkokToday(),
    roomNumber: receipt.roomNumber,
    tenantName: receipt.tenantName,
    invoiceNumber: receipt.invoiceNumber,
    billingMonth: receipt.billingMonth,
    payment: receipt.payment,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${receipt.invoiceNumber}.pdf"`,
    },
  });
}
