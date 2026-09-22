import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';

import { formatTHB } from '@/lib/billing/money';
import { registerContractFonts } from '@/lib/pdf/registerFonts';
import { formatBillingMonth, formatDate, type IsoDate } from '@/lib/utils/date';
import type { PaymentMethod, PaymentRow } from '@/types/database';

interface ReceiptDocumentProps {
  /** Registered by renderReceiptPdf; never pass a literal font family here. */
  fontFamily: string;
  locale: 'th' | 'en';
  dormitoryName: string;
  generatedDate: IsoDate;
  roomNumber: string;
  tenantName: string;
  invoiceNumber: string;
  billingMonth: IsoDate;
  payment: PaymentRow;
}

/**
 * Unlike the lease contract, a receipt is not a fixed-language legal
 * document -- it follows whichever locale the room's billing tab was open
 * in, the way the rest of the app does.
 */
const LABELS = {
  th: {
    title: 'ใบเสร็จรับเงิน',
    issuedAt: (name: string, date: string) => `ออกโดย ${name} วันที่ ${date}`,
    room: 'ห้องเลขที่',
    tenant: 'ผู้เช่า',
    invoiceNumber: 'เลขที่ใบแจ้งหนี้',
    billingMonth: 'รอบบิล',
    paymentDate: 'วันที่ชำระ',
    method: 'ช่องทางชำระ',
    reference: 'เลขอ้างอิง',
    amountReceived: 'จำนวนเงินที่รับชำระ',
    receivedBy: 'ผู้รับเงิน',
    payer: 'ผู้ชำระเงิน',
    paymentMethod: { cash: 'เงินสด', bank_transfer: 'โอนเงิน', promptpay: 'พร้อมเพย์' },
  },
  en: {
    title: 'Payment Receipt',
    issuedAt: (name: string, date: string) => `Issued by ${name} on ${date}`,
    room: 'Room',
    tenant: 'Tenant',
    invoiceNumber: 'Invoice number',
    billingMonth: 'Billing month',
    paymentDate: 'Payment date',
    method: 'Method',
    reference: 'Reference',
    amountReceived: 'Amount received',
    receivedBy: 'Received by',
    payer: 'Payer',
    paymentMethod: { cash: 'Cash', bank_transfer: 'Bank transfer', promptpay: 'PromptPay' },
  },
} satisfies Record<'th' | 'en', Record<string, unknown>>;

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    fontSize: 11,
    lineHeight: 1.5,
    color: '#1a1a1a',
  },
  title: { fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { fontSize: 10, textAlign: 'center', color: '#555555', marginTop: 4, marginBottom: 24 },
  section: { marginBottom: 14 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 150, color: '#555555' },
  value: { flex: 1, fontWeight: 'bold' },
  amountBox: {
    marginTop: 8,
    marginBottom: 24,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#000000',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: { fontSize: 12 },
  amountValue: { fontSize: 20, fontWeight: 'bold' },
  signatures: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 56 },
  signatureBlock: { width: '45%', textAlign: 'center' },
  signatureLine: { borderBottomWidth: 1, borderColor: '#000000', height: 36 },
  signatureCaption: { marginTop: 6 },
});

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function ReceiptDocument({
  fontFamily,
  locale,
  dormitoryName,
  generatedDate,
  roomNumber,
  tenantName,
  invoiceNumber,
  billingMonth,
  payment,
}: ReceiptDocumentProps) {
  const t = LABELS[locale];

  return (
    <Document title={`${t.title} ${invoiceNumber}`} language={locale}>
      <Page size="A4" style={[styles.page, { fontFamily }]}>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.subtitle}>
          {t.issuedAt(dormitoryName, formatDate(generatedDate, locale))}
        </Text>

        <View style={styles.section}>
          <InfoRow label={t.room} value={roomNumber} />
          {tenantName ? <InfoRow label={t.payer} value={tenantName} /> : null}
          <InfoRow label={t.invoiceNumber} value={invoiceNumber} />
          <InfoRow label={t.billingMonth} value={formatBillingMonth(billingMonth, locale)} />
        </View>

        <View style={styles.section}>
          <InfoRow label={t.paymentDate} value={formatDate(payment.payment_date, locale)} />
          <InfoRow
            label={t.method}
            value={t.paymentMethod[payment.payment_method as PaymentMethod]}
          />
          {payment.reference ? <InfoRow label={t.reference} value={payment.reference} /> : null}
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>{t.amountReceived}</Text>
          <Text style={styles.amountValue}>{formatTHB(payment.amount, locale)}</Text>
        </View>

        <View style={styles.signatures}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureCaption}>{t.tenant}</Text>
            <Text>({tenantName || '-'})</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureCaption}>{t.receivedBy}</Text>
            <Text>({dormitoryName})</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export type RenderReceiptPdfProps = Omit<ReceiptDocumentProps, 'fontFamily'>;

/** Renders the receipt to a PDF buffer. JSX must live in a .tsx file, hence the wrapper here. */
export async function renderReceiptPdf(props: RenderReceiptPdfProps): Promise<Buffer> {
  const fontFamily = registerContractFonts();
  return renderToBuffer(<ReceiptDocument {...props} fontFamily={fontFamily} />);
}
