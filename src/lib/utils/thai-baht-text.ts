/**
 * Thai number-to-text conversion (เลขไทยเป็นตัวอักษร), for spelling out the
 * rent amount on the lease contract the way a Thai legal document requires
 * ("หกพันห้าร้อยบาทถ้วน") -- a formatted number is not acceptable there.
 */

const DIGIT_WORDS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];

/** Place name for each position within a 6-digit group, indexed from the units digit. */
const PLACE_WORDS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];

/** Converts one group of up to 6 digits (no group separator, no "ล้าน"). */
function convertGroup(digits: string): string {
  let result = '';
  const length = digits.length;

  for (let i = 0; i < length; i += 1) {
    const digit = Number(digits[i]);
    if (digit === 0) continue;
    const place = length - i - 1;

    if (place === 0) {
      // Units digit: "เอ็ด" instead of "หนึ่ง" whenever it is not the sole
      // digit of the whole group (11 -> สิบเอ็ด, 101 -> หนึ่งร้อยเอ็ด, but a
      // standalone 1 -> หนึ่ง).
      result += digit === 1 && length > 1 ? 'เอ็ด' : DIGIT_WORDS[digit]!;
    } else if (place === 1) {
      // Tens digit: "สิบ" alone for 1, "ยี่สิบ" (not "สองสิบ") for 2.
      if (digit === 1) result += 'สิบ';
      else if (digit === 2) result += 'ยี่สิบ';
      else result += DIGIT_WORDS[digit]! + 'สิบ';
    } else {
      // digits is at most 6 characters long, so place is at most 5 -- within
      // PLACE_WORDS' range.
      result += DIGIT_WORDS[digit]! + PLACE_WORDS[place]!;
    }
  }

  return result;
}

/** Converts a non-negative integer to Thai words, e.g. 1234567 -> "หนึ่งล้านสองแสนสามหมื่นสี่พันห้าร้อยหกสิบเจ็ด". */
export function numberToThaiText(value: number): string {
  const n = Math.trunc(Math.abs(value));
  if (n === 0) return 'ศูนย์';

  const digits = String(n);
  const groups: string[] = [];
  let rest = digits;
  while (rest.length > 0) {
    groups.unshift(rest.slice(-6));
    rest = rest.slice(0, -6);
  }

  return groups
    .map((group, index) => {
      const words = convertGroup(group);
      if (!words) return '';
      const isLast = index === groups.length - 1;
      return words + (isLast ? '' : 'ล้าน');
    })
    .join('');
}

/**
 * Spells out a baht amount for a contract/receipt, e.g. 6500 ->
 * "หกพันห้าร้อยบาทถ้วน", 1250.5 -> "หนึ่งพันสองร้อยห้าสิบบาทห้าสิบสตางค์".
 */
export function bahtText(amount: number): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const baht = Math.trunc(rounded);
  const satang = Math.round((rounded - baht) * 100);

  const bahtWords = `${numberToThaiText(baht)}บาท`;
  if (satang === 0) return `${bahtWords}ถ้วน`;
  return `${bahtWords}${numberToThaiText(satang)}สตางค์`;
}
