/**
 * Thai marks that stack above or below the previous letter and take no width
 * of their own: mai han-akat, the upper/lower vowels and phinthu (U+0E31,
 * U+0E34-U+0E3A), and maitaikhu, the tone marks, thanthakhat and the rest
 * (U+0E47-U+0E4E).
 */
const THAI_COMBINING = /[ัิ-ฺ็-๎]/;

/**
 * Trim `value` to at most `max` visible characters, ending in "…" when cut.
 *
 * For SVG text, which cannot overflow-ellipsis. Counting `string.length` would
 * charge every Thai vowel and tone mark as a character, cutting Thai names far
 * shorter than Latin ones of the same width -- so combining marks are free, and
 * a cut never strands a mark without the letter it sits on.
 */
export function truncateVisible(value: string, max: number): string {
  let visible = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (THAI_COMBINING.test(value[i]!)) continue;
    visible += 1;
    if (visible > max) {
      // Room for max - 1 letters plus the ellipsis; keep their marks.
      let end = i;
      let kept = visible - 1;
      while (kept > max - 1) {
        end -= 1;
        if (!THAI_COMBINING.test(value[end]!)) kept -= 1;
      }
      return `${value.slice(0, end).trimEnd()}…`;
    }
  }
  return value;
}
