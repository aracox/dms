import { Document, Page, renderToBuffer, StyleSheet, Text, View } from '@react-pdf/renderer';

import { registerContractFonts } from '@/lib/pdf/registerFonts';
import type { OwnerIdentity, PaymentBank } from '@/lib/settings/queries';
import type { ContractRow, RoomRow, TenantRow } from '@/types/database';
import { bahtText } from '@/lib/utils/thai-baht-text';
import { formatDate, monthsBetween, type IsoDate } from '@/lib/utils/date';

interface ContractDocumentProps {
  /** Registered by renderContractPdf; never pass a literal font family here. */
  fontFamily: string;
  contractNumber: string;
  generatedDate: IsoDate;
  /** Building/property name (property_name), e.g. "หอพักตัวอย่าง" -- distinct from the owner. */
  dormitoryName: string;
  propertyAddress: string;
  owner: OwnerIdentity;
  paymentBank: PaymentBank;
  lateFeePerDay: number;
  electricityRate: number;
  waterRate: number;
  internetFee: number;
  room: RoomRow;
  contract: ContractRow;
  tenant: TenantRow;
}

/**
 * Follows the owner-supplied template (สัญญาเช่าห้องพัก.docx) clause for
 * clause. The lease contract is a Thai legal document by convention, so
 * unlike the rest of the app it is not run through next-intl -- it stays
 * Thai regardless of the UI locale, the way the printed template does.
 */

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    fontSize: 10.5,
    lineHeight: 1.5,
    color: '#1a1a1a',
  },
  title: { fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { fontSize: 10, textAlign: 'center', color: '#555555', marginTop: 4 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 14 },
  intro: { marginBottom: 10, textAlign: 'justify' },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 4 },
  partiesRow: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  partyBlock: { flex: 1 },
  partyTitle: { fontWeight: 'bold', marginBottom: 3 },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { width: 150 },
  value: { flex: 1 },
  paragraph: { marginBottom: 4, textAlign: 'justify' },
  subItem: { marginBottom: 4, textAlign: 'justify' },
  table: { borderWidth: 1, borderColor: '#bbbbbb', marginTop: 4, marginBottom: 4 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#bbbbbb' },
  tableRowLast: { flexDirection: 'row' },
  tableHeaderCell: {
    width: 170,
    padding: 4,
    backgroundColor: '#f2f2f2',
    borderRightWidth: 1,
    borderColor: '#bbbbbb',
  },
  tableHeaderCellLast: { width: 311, padding: 4, backgroundColor: '#f2f2f2' },
  tableHeaderText: { fontWeight: 'bold' },
  tableCell: { width: 170, padding: 4, borderRightWidth: 1, borderColor: '#bbbbbb' },
  tableCellLast: { width: 311, padding: 4 },
  signatures: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 32 },
  signatureBlock: { width: '45%', textAlign: 'center' },
  signatureLine: { borderBottomWidth: 1, borderColor: '#000000', height: 36 },
  signatureCaption: { marginTop: 6, fontWeight: 'bold' },
  signatureDate: { marginTop: 4, color: '#555555' },
});

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function TableHeader({ cells }: { cells: string[] }) {
  return (
    <View style={styles.tableRow}>
      {cells.map((cell, i) => (
        <View
          key={i}
          style={i === cells.length - 1 ? styles.tableHeaderCellLast : styles.tableHeaderCell}
        >
          <Text style={styles.tableHeaderText}>{cell}</Text>
        </View>
      ))}
    </View>
  );
}

function TableRow({ cells, last }: { cells: string[]; last?: boolean }) {
  return (
    <View style={last ? styles.tableRowLast : styles.tableRow}>
      {cells.map((cell, i) => (
        <View key={i} style={i === cells.length - 1 ? styles.tableCellLast : styles.tableCell}>
          <Text>{cell}</Text>
        </View>
      ))}
    </View>
  );
}

function SignatureBlock({ role, name }: { role: string; name: string }) {
  return (
    <View style={styles.signatureBlock}>
      <Text>ลงชื่อ</Text>
      <View style={styles.signatureLine} />
      <Text style={styles.signatureCaption}>{role}</Text>
      <Text>({name || '_______________________'})</Text>
      <Text style={styles.signatureDate}>วันที่ _____ / _____ / _____</Text>
    </View>
  );
}

function WitnessBlock({ label }: { label: string }) {
  return (
    <View style={styles.signatureBlock}>
      <Text>ลงชื่อ</Text>
      <View style={styles.signatureLine} />
      <Text style={styles.signatureCaption}>{label}</Text>
      <Text>(_______________________)</Text>
    </View>
  );
}

export function ContractDocument({
  fontFamily,
  contractNumber,
  generatedDate,
  dormitoryName,
  propertyAddress,
  owner,
  paymentBank,
  lateFeePerDay,
  electricityRate,
  waterRate,
  internetFee,
  room,
  contract,
  tenant,
}: ContractDocumentProps) {
  const durationMonths = monthsBetween(contract.start_date, contract.end_date);
  const depositMonths =
    contract.monthly_rent > 0
      ? Math.round((contract.deposit / contract.monthly_rent) * 10) / 10
      : 0;
  const hasBankAccount = paymentBank.bank_name || paymentBank.account_number;

  return (
    <Document title={`สัญญาเช่าห้องพัก ${room.room_number}`} language="th">
      <Page size="A4" style={[styles.page, { fontFamily }]}>
        <Text style={styles.title}>สัญญาเช่าห้องพัก / ที่พักอาศัย</Text>
        <Text style={styles.subtitle}>Residential Lease Agreement</Text>
        <View style={styles.meta}>
          <Text>เลขที่สัญญา: {contractNumber}</Text>
          <Text>วันที่: {formatDate(generatedDate, 'th')}</Text>
        </View>

        <Text style={styles.intro}>
          สัญญาฉบับนี้ทำขึ้นระหว่างบุคคลสองฝ่ายดังต่อไปนี้ ซึ่งตกลงทำสัญญาเช่าห้องพัก / ที่พักอาศัย{' '}
          {dormitoryName} โดยมีข้อความและเงื่อนไขดังนี้
        </Text>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>ข้อ 1. คู่สัญญา</Text>
          <View style={styles.partiesRow}>
            <View style={styles.partyBlock}>
              <Text style={styles.partyTitle}>ผู้ให้เช่า (ฝ่ายที่ 1)</Text>
              <InfoRow label="ชื่อ-นามสกุล:" value={owner.name_th || '-'} />
              <InfoRow label="เลขบัตรประชาชน:" value={owner.id_card || '-'} />
              <InfoRow label="ที่อยู่:" value={owner.address || '-'} />
              <InfoRow label="โทรศัพท์:" value={owner.phone || '-'} />
            </View>
            <View style={styles.partyBlock}>
              <Text style={styles.partyTitle}>ผู้เช่า (ฝ่ายที่ 2)</Text>
              <InfoRow label="ชื่อ-นามสกุล:" value={tenant.full_name} />
              <InfoRow label="เลขบัตรประชาชน:" value={tenant.id_card_or_passport || '-'} />
              <InfoRow label="ที่อยู่:" value={tenant.address || '-'} />
              <InfoRow label="โทรศัพท์:" value={tenant.phone} />
            </View>
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>ข้อ 2. ทรัพย์สินที่เช่า</Text>
          <Text style={styles.paragraph}>
            ผู้ให้เช่าตกลงให้เช่าและผู้เช่าตกลงเช่าห้องพักหมายเลข {room.room_number}
          </Text>
          <InfoRow label="ชื่ออาคาร/หอพัก:" value={dormitoryName} />
          <InfoRow label="ที่อยู่:" value={propertyAddress || '-'} />
          <InfoRow
            label="ขนาดพื้นที่/ชั้น:"
            value={`ประมาณ ${room.size_sqm ? `${room.size_sqm} ตร.ม.` : '-'} ชั้นที่ ${room.floor} เพื่อใช้เป็นที่พักอาศัยเท่านั้น`}
          />
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>ข้อ 3. ระยะเวลาเช่า</Text>
          <Text style={styles.paragraph}>
            ผู้ให้เช่าตกลงให้เช่าและผู้เช่าตกลงเช่าเป็นระยะเวลา {durationMonths} เดือน ตั้งแต่วันที่{' '}
            {formatDate(contract.start_date, 'th')} ถึงวันที่ {formatDate(contract.end_date, 'th')}
          </Text>
          <Text style={styles.paragraph}>
            เมื่อครบกำหนดระยะเวลาเช่า หากผู้เช่าประสงค์จะเช่าต่อ
            ผู้เช่าต้องแจ้งความประสงค์ให้ผู้ให้เช่าทราบล่วงหน้าไม่น้อยกว่า 30 วัน ก่อนครบกำหนดสัญญา
            โดยค่าเช่าและเงื่อนไขอาจเปลี่ยนแปลงตามที่ตกลงกัน
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อ 4. ค่าเช่าและการชำระเงิน</Text>
          <Text style={styles.subItem}>
            4.1 ผู้เช่าตกลงชำระค่าเช่าเดือนละ {contract.monthly_rent.toLocaleString('th-TH')} บาท
            (ตัวอักษร: {bahtText(contract.monthly_rent)})
          </Text>
          <Text style={styles.subItem}>
            4.2 ผู้เช่าต้องชำระค่าเช่าภายในวันที่ {contract.payment_due_day} ของทุกเดือน
            โดยชำระล่วงหน้าก่อนเข้าอยู่
          </Text>
          <Text style={styles.subItem}>4.3 ช่องทางการชำระเงิน:</Text>
          <Text style={styles.subItem}>
            {hasBankAccount
              ? `โอนเงินเข้าบัญชี: ธนาคาร ${paymentBank.bank_name || '-'} เลขที่บัญชี ${paymentBank.account_number || '-'} ชื่อบัญชี ${paymentBank.account_name || '-'}`
              : 'โอนเงินเข้าบัญชี: ธนาคาร _______________________ เลขที่บัญชี _______________________'}
          </Text>
          <Text style={styles.subItem}>
            4.4 หากผู้เช่าชำระค่าเช่าล่าช้าเกินกว่า 7 วัน นับจากวันครบกำหนด
            ผู้เช่ายินยอมชำระค่าปรับวันละ {lateFeePerDay.toLocaleString('th-TH')} บาท
            จนกว่าจะชำระครบถ้วน ทั้งนี้ค่าปรับรวมต้องไม่เกินร้อยละ 5 ของค่าเช่ารายเดือน
          </Text>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>ข้อ 5. เงินประกัน</Text>
          <Text style={styles.subItem}>
            5.1 ผู้เช่าได้วางเงินประกันการเช่าจำนวน {contract.deposit.toLocaleString('th-TH')} บาท
            (เทียบเท่าค่าเช่า {depositMonths} เดือน) ไว้กับผู้ให้เช่าในวันทำสัญญานี้
          </Text>
          <Text style={styles.subItem}>
            5.2 ผู้ให้เช่าจะคืนเงินประกันให้แก่ผู้เช่าภายใน 30 วัน
            นับจากวันสิ้นสุดสัญญาเช่าและผู้เช่าส่งมอบห้องพักคืนเรียบร้อยแล้ว
            โดยผู้ให้เช่ามีสิทธิหักค่าเสียหาย ค่าซ่อมแซม หรือค่าใช้จ่ายที่ค้างชำระ (ถ้ามี)
            ออกจากเงินประกัน
          </Text>
          <Text style={styles.subItem}>
            5.3
            ผู้ให้เช่าต้องแจ้งรายละเอียดการหักเงินประกันพร้อมหลักฐานให้ผู้เช่าทราบเป็นลายลักษณ์อักษร
          </Text>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>ข้อ 6. ค่าสาธารณูปโภค</Text>
          <Text style={styles.paragraph}>ผู้เช่าตกลงชำระค่าสาธารณูปโภคดังนี้</Text>
          <View style={styles.table}>
            <TableHeader cells={['รายการ', 'อัตรา']} />
            <TableRow
              cells={['ค่าไฟฟ้า', `${electricityRate.toLocaleString('th-TH')} บาท/หน่วย`]}
            />
            <TableRow cells={['ค่าน้ำประปา', `${waterRate.toLocaleString('th-TH')} บาท/หน่วย`]} />
            <TableRow
              cells={['ค่าอินเทอร์เน็ต', `${internetFee.toLocaleString('th-TH')} บาท/เดือน`]}
              last
            />
          </View>
          <Text style={styles.paragraph}>
            ค่าสาธารณูปโภคคำนวณตามมิเตอร์จริง
            โดยผู้ให้เช่าจะต้องไม่เรียกเก็บค่าไฟฟ้าและค่าน้ำประปาเกินอัตราที่การไฟฟ้าและการประปาเรียกเก็บจากผู้ให้เช่า
            (ตามประกาศ สคบ.)
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อ 7. สิทธิและหน้าที่ของผู้เช่า</Text>
          <Text style={styles.paragraph}>ผู้เช่ามีสิทธิและหน้าที่ดังต่อไปนี้:</Text>
          <Text style={styles.subItem}>
            7.1 ผู้เช่ามีสิทธิอยู่อาศัยในห้องพักที่เช่าอย่างสงบสุข ตลอดระยะเวลาเช่า
          </Text>
          <Text style={styles.subItem}>
            7.2 ผู้เช่าต้องใช้ห้องพักเพื่อเป็นที่พักอาศัยเท่านั้น
            ห้ามใช้เพื่อประกอบกิจการหรือกิจกรรมที่ผิดกฎหมาย
          </Text>
          <Text style={styles.subItem}>
            7.3 ผู้เช่าต้องดูแลรักษาห้องพักและทรัพย์สินของผู้ให้เช่าให้อยู่ในสภาพดี
            และต้องรับผิดชอบค่าเสียหายที่เกิดจากการกระทำของผู้เช่า
          </Text>
          <Text style={styles.subItem}>
            7.4 ผู้เช่าจะต้องไม่ดัดแปลง ต่อเติม
            หรือเปลี่ยนแปลงห้องพักโดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษรจากผู้ให้เช่า
          </Text>
          <Text style={styles.subItem}>
            7.5 ผู้เช่าต้องไม่ให้เช่าช่วง
            หรือโอนสิทธิ์การเช่าให้ผู้อื่นโดยไม่ได้รับอนุญาตจากผู้ให้เช่า
          </Text>
          <Text style={styles.subItem}>
            7.6 ผู้เช่าต้องปฏิบัติตามกฎระเบียบของอาคาร/หอพักที่ผู้ให้เช่ากำหนดไว้
          </Text>
          <Text style={styles.subItem}>
            7.7 ผู้เช่ามีสิทธิเข้าถึงสาธารณูปโภคพื้นฐาน ได้แก่ น้ำ ไฟฟ้า
            และระบบสุขาภิบาลที่ใช้งานได้
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อ 8. สิทธิและหน้าที่ของผู้ให้เช่า</Text>
          <Text style={styles.paragraph}>ผู้ให้เช่ามีสิทธิและหน้าที่ดังต่อไปนี้:</Text>
          <Text style={styles.subItem}>
            8.1 ผู้ให้เช่าต้องส่งมอบห้องพักในสภาพเรียบร้อยพร้อมเข้าอยู่อาศัยได้
          </Text>
          <Text style={styles.subItem}>
            8.2 ผู้ให้เช่าต้องดูแลซ่อมแซมอาคารและอุปกรณ์ส่วนกลางให้อยู่ในสภาพใช้งานได้ดี
          </Text>
          <Text style={styles.subItem}>
            8.3 ผู้ให้เช่าต้องไม่เข้าห้องพักของผู้เช่าโดยไม่ได้รับอนุญาต เว้นแต่กรณีฉุกเฉิน
            หรือแจ้งล่วงหน้าไม่น้อยกว่า 24 ชั่วโมง
          </Text>
          <Text style={styles.subItem}>
            8.4 ผู้ให้เช่ามีหน้าที่ออกใบเสร็จรับเงินทุกครั้งที่ได้รับค่าเช่าหรือค่าบริการจากผู้เช่า
          </Text>
          <Text style={styles.subItem}>
            8.5 ผู้ให้เช่าต้องไม่เรียกเก็บค่าสาธารณูปโภคเกินกว่าอัตราที่หน่วยงานรัฐเรียกเก็บ
          </Text>
          <Text style={styles.subItem}>
            8.6 ผู้ให้เช่าต้องไม่กระทำการใดๆ ที่เป็นการรบกวนสิทธิ์ในการอยู่อาศัยของผู้เช่า
          </Text>
          <Text style={styles.subItem}>
            8.7 ผู้ให้เช่ามีสิทธิ์เรียกร้องค่าเสียหายจากผู้เช่าในกรณีที่ผู้เช่าทำให้ทรัพย์สินเสียหาย
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อ 9. การบอกเลิกสัญญา</Text>
          <Text style={styles.subItem}>
            9.1 ผู้เช่าประสงค์จะเลิกสัญญาก่อนครบกำหนด
            ต้องแจ้งเป็นลายลักษณ์อักษรให้ผู้ให้เช่าทราบล่วงหน้าไม่น้อยกว่า 30 วัน
          </Text>
          <Text style={styles.subItem}>
            9.2 ผู้ให้เช่าประสงค์จะเลิกสัญญาก่อนครบกำหนด
            ต้องแจ้งเป็นลายลักษณ์อักษรให้ผู้เช่าทราบล่วงหน้าไม่น้อยกว่า 30 วัน
            เว้นแต่กรณีผู้เช่าผิดสัญญา
          </Text>
          <Text style={styles.subItem}>
            9.3 ผู้ให้เช่ามีสิทธิบอกเลิกสัญญาได้ทันทีหากผู้เช่ากระทำการดังต่อไปนี้:
          </Text>
          <Text style={styles.subItem}>- ค้างชำระค่าเช่าเกิน 2 เดือนติดต่อกัน</Text>
          <Text style={styles.subItem}>- ใช้ห้องพักเพื่อกิจกรรมผิดกฎหมาย</Text>
          <Text style={styles.subItem}>- ทำให้เกิดความเสียหายร้ายแรงต่อทรัพย์สิน</Text>
          <Text style={styles.subItem}>- ให้เช่าช่วงโดยไม่ได้รับอนุญาต</Text>
          <Text style={styles.subItem}>- ฝ่าฝืนกฎระเบียบของอาคาร/หอพักอย่างร้ายแรงหรือซ้ำซาก</Text>
          <Text style={styles.subItem}>
            9.4 เมื่อสัญญาสิ้นสุดลงไม่ว่าด้วยเหตุใด ผู้เช่าต้องส่งมอบห้องพักคืนในสภาพเรียบร้อย
            (ยกเว้นการเสื่อมสภาพจากการใช้งานปกติ) ภายใน 7 วัน
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อ 10. เงื่อนไขอื่นๆ</Text>
          <Text style={styles.subItem}>
            10.1 สัญญาฉบับนี้ผูกพันทายาทและผู้รับโอนสิทธิ์ของคู่สัญญาทั้งสองฝ่าย
          </Text>
          <Text style={styles.subItem}>
            10.2
            การแก้ไขเพิ่มเติมสัญญาฉบับนี้จะต้องทำเป็นลายลักษณ์อักษรและลงนามโดยคู่สัญญาทั้งสองฝ่าย
          </Text>
          <Text style={styles.subItem}>
            10.3 หากข้อความส่วนใดส่วนหนึ่งของสัญญานี้ตกเป็นโมฆะ ให้ส่วนที่เหลือยังคงมีผลบังคับใช้ได้
          </Text>
          <Text style={styles.subItem}>
            10.4 ข้อพิพาทที่เกิดจากสัญญาฉบับนี้ ให้ระงับโดยการเจรจาไกล่เกลี่ยก่อน
            หากตกลงกันไม่ได้ให้ใช้สิทธิ์ทางศาลตามกฎหมายไทย
          </Text>
          <Text style={styles.subItem}>
            10.5 สัญญาฉบับนี้จัดทำขึ้นตามประกาศคณะกรรมการว่าด้วยสัญญา เรื่อง
            ให้ธุรกิจการให้เช่าอาคารเพื่ออยู่อาศัยเป็นธุรกิจที่ควบคุมสัญญา พ.ศ. 2562 (สคบ.)
          </Text>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>เงื่อนไขเพิ่มเติม (ถ้ามี):</Text>
          <Text style={styles.subItem}>_______________________________________________</Text>
          <Text style={styles.subItem}>_______________________________________________</Text>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>ข้อ 11. การลงนาม</Text>
          <Text style={styles.paragraph}>
            สัญญาฉบับนี้ทำขึ้นเป็นสองฉบับ มีข้อความถูกต้องตรงกัน
            คู่สัญญาได้อ่านและเข้าใจข้อความในสัญญาโดยตลอดแล้ว
            จึงได้ลงลายมือชื่อไว้เป็นหลักฐานต่อหน้าพยาน
          </Text>

          <View style={styles.signatures}>
            <SignatureBlock role="ผู้ให้เช่า" name={owner.name_th} />
            <SignatureBlock role="ผู้เช่า" name={tenant.full_name} />
          </View>

          <View style={styles.signatures}>
            <WitnessBlock label="พยาน (คนที่ 1)" />
            <WitnessBlock label="พยาน (คนที่ 2)" />
          </View>
        </View>
      </Page>
    </Document>
  );
}

export type RenderContractPdfProps = Omit<ContractDocumentProps, 'fontFamily'>;

/** Renders the contract to a PDF buffer. JSX must live in a .tsx file, hence the wrapper here. */
export async function renderContractPdf(props: RenderContractPdfProps): Promise<Buffer> {
  const fontFamily = registerContractFonts();
  return renderToBuffer(<ContractDocument {...props} fontFamily={fontFamily} />);
}
