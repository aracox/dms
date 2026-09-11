/**
 * Builds a CSV string from a header row and data rows. Quotes any field
 * containing a comma, quote, or newline, doubling embedded quotes per RFC
 * 4180. A leading UTF-8 BOM is included so Excel renders Thai text correctly
 * instead of guessing a Latin encoding.
 */
export function toCsv(headers: readonly string[], rows: readonly (string | number)[][]): string {
  const escape = (value: string | number): string => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [headers, ...rows].map((row) => row.map(escape).join(','));
  return `﻿${lines.join('\r\n')}`;
}
