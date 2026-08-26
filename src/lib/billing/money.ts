/**
 * Money.
 *
 * Amounts cross the wire as baht `number`s because that is what PostgreSQL
 * `numeric(12,2)` gives us, but arithmetic happens in integer satang so binary
 * floating point cannot drift (0.1 + 0.2 !== 0.3, and 1.005 * 100 is
 * 100.49999999999999, which would round the wrong way).
 *
 * Client-side sums are for display and previews only. The authoritative totals
 * are computed by the database -- see recalc_invoice() in migration 0005.
 */

/** Baht -> integer satang. */
export function toSatang(baht: number): number {
  return Math.round(Number((baht * 100).toFixed(6)));
}

/** Integer satang -> baht. */
export function fromSatang(satang: number): number {
  return satang / 100;
}

/**
 * Round to 2 decimal places, half away from zero -- the same rule as
 * PostgreSQL `round(numeric, 2)`. `Math.round` alone rounds -0.005 to -0.00.
 */
export function round2(value: number): number {
  const scaled = Number((Math.abs(value) * 100).toFixed(6));
  const rounded = Math.round(scaled) / 100;
  return value < 0 ? -rounded : rounded;
}

/** Exact sum of baht amounts. */
export function sumMoney(amounts: readonly number[]): number {
  return fromSatang(amounts.reduce((total, amount) => total + toSatang(amount), 0));
}

/** quantity x unitPrice, rounded like the invoice_items.amount generated column. */
export function multiplyMoney(quantity: number, unitPrice: number): number {
  return round2(quantity * unitPrice);
}

/** Exact a - b. */
export function subtractMoney(a: number, b: number): number {
  return fromSatang(toSatang(a) - toSatang(b));
}

/**
 * '฿6,500.00' in both locales.
 *
 * `narrowSymbol` matters: en-US would otherwise render 'THB 6,500.00', and the
 * owner reads both languages against the same figures.
 */
export function formatTHB(amount: number, locale: 'th' | 'en' = 'th'): string {
  return new Intl.NumberFormat(locale === 'th' ? 'th-TH' : 'en-US', {
    style: 'currency',
    currency: 'THB',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** '6,500' — for dense tables where the currency symbol is in the header. */
export function formatAmount(amount: number, locale: 'th' | 'en' = 'th'): string {
  return new Intl.NumberFormat(locale === 'th' ? 'th-TH' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
