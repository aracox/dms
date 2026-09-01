import { Document, Page, renderToBuffer, StyleSheet, Text, View } from '@react-pdf/renderer';

import { formatTHB } from '@/lib/billing/money';
import { registerContractFonts } from '@/lib/pdf/registerFonts';
import type { ContractRow, RoomRow, TenantRow } from '@/types/database';
import { formatDate, type IsoDate } from '@/lib/utils/date';

export interface ContractDocumentProps {
  dormitoryName: string;
  generatedDate: IsoDate;
  room: RoomRow;
  contract: ContractRow;
  tenant: TenantRow;
}

/**
 * The lease contract is a Thai legal document by convention, so unlike the
 * rest of the app it is not run through next-intl -- it stays Thai
 * regardless of the UI locale, the way a printed สัญญาเช่า would.
 */

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    fontFamily: 'Sarabun',
    fontSize: 11,
    lineHeight: 1.5,
    color: '#1a1a1a',
  },
  title: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { fontSize: 10, textAlign: 'center', color: '#555555', marginTop: 4, marginBottom: 18 },
  paragraph: { marginBottom: 10, textAlign: 'justify' },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 11.5, fontWeight: 'bold', marginBottom: 4 },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { width: 150 },
  value: { flex: 1 },
  bullet: { flexDirection: 'row', marginBottom: 4 },
  bulletMark: { width: 14 },
  bulletText: { flex: 1, textAlign: 'justify' },
  signatures: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 48 },
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

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletMark}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export function ContractDocument({
  dormitoryName,
  generatedDate,
  room,
  contract,
  tenant,
}: ContractDocumentProps) {
  return (
    <Document title={`สัญญาเช่าห้องพัก ${room.room_number}`} language="th">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>สัญญาเช่าห้องพัก</Text>
        <Text style={styles.subtitle}>
          ทำที่ {dormitoryName} วันที่ {formatDate(generatedDate, 'th')}
        </Text>

        <Text style={styles.paragraph}>
          สัญญานี้ทำขึ้นระหว่าง {dormitoryName} ในฐานะ &quot;ผู้ให้เช่า&quot; ฝ่ายหนึ่ง กับ{' '}
          {tenant.full_name}
          {tenant.id_card_or_passport
            ? ` เลขที่บัตรประชาชน/พาสปอร์ต ${tenant.id_card_or_passport}`
            : ''}{' '}
          ในฐานะ &quot;ผู้เช่า&quot; อีกฝ่ายหนึ่ง ทั้งสองฝ่ายตกลงทำสัญญาเช่าห้องพัก
          โดยมีข้อความดังต่อไปนี้
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อ 1. รายละเอียดห้องเช่า</Text>
          <InfoRow label="ห้องเลขที่" value={room.room_number} />
          <InfoRow label="ขนาดห้อง" value={room.size_sqm ? `${room.size_sqm} ตร.ม.` : '-'} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อ 2. ระยะเวลาเช่า</Text>
          <InfoRow
            label="ระยะเวลาเช่า"
            value={`${formatDate(contract.start_date, 'th')} ถึง ${formatDate(contract.end_date, 'th')}`}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อ 3. ค่าเช่าและเงินประกัน</Text>
          <InfoRow
            label="ค่าเช่ารายเดือน"
            value={`${formatTHB(contract.monthly_rent, 'th')} ชำระภายในวันที่ ${contract.payment_due_day} ของทุกเดือน`}
          />
          <InfoRow label="เงินประกัน (มัดจำ)" value={formatTHB(contract.deposit, 'th')} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อ 4. จำนวนผู้พักอาศัย</Text>
          <InfoRow
            label="จำนวนผู้พักอาศัยทั้งหมด"
            value={`${contract.occupant_count} คน (รวมผู้เช่า)`}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อ 5. ข้อมูลติดต่อผู้เช่า</Text>
          <InfoRow label="เบอร์โทรศัพท์" value={tenant.phone} />
          {tenant.line_id ? <InfoRow label="LINE ID" value={tenant.line_id} /> : null}
          {tenant.emergency_contact ? (
            <InfoRow
              label="ผู้ติดต่อฉุกเฉิน"
              value={`${tenant.emergency_contact}${tenant.emergency_phone ? ` (${tenant.emergency_phone})` : ''}`}
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อ 6. เงื่อนไขทั่วไป</Text>
          <Bullet>ผู้เช่าต้องชำระค่าเช่าให้ตรงตามกำหนดเวลาที่ระบุไว้ในข้อ 3</Bullet>
          <Bullet>
            เงินประกันจะคืนให้แก่ผู้เช่าเมื่อสิ้นสุดสัญญาเช่า
            และห้องพักอยู่ในสภาพเรียบร้อยไม่มีความเสียหาย หลังหักค่าใช้จ่ายค้างชำระ (ถ้ามี)
          </Bullet>
          <Bullet>
            ผู้เช่าต้องดูแลรักษาห้องพักและทรัพย์สินภายในห้องให้อยู่ในสภาพดี
            และแจ้งผู้ให้เช่าทันทีหากพบความเสียหาย
          </Bullet>
          <Bullet>
            ห้ามผู้เช่านำบุคคลอื่นเข้าพักอาศัยเกินจำนวนที่ระบุไว้ในข้อ 4
            โดยไม่ได้รับความเห็นชอบจากผู้ให้เช่า
          </Bullet>
          <Bullet>
            คู่สัญญาทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญานี้โดยตลอดแล้ว
            จึงลงลายมือชื่อไว้เป็นหลักฐาน
          </Bullet>
        </View>

        <View style={styles.signatures}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureCaption}>ผู้ให้เช่า</Text>
            <Text>({dormitoryName})</Text>
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureCaption}>ผู้เช่า</Text>
            <Text>({tenant.full_name})</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

/** Renders the contract to a PDF buffer. JSX must live in a .tsx file, hence the wrapper here. */
export async function renderContractPdf(props: ContractDocumentProps): Promise<Buffer> {
  registerContractFonts();
  return renderToBuffer(<ContractDocument {...props} />);
}
