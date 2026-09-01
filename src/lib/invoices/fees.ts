import type { InvoiceItemType } from '@/types/database';

/**
 * The optional extra fees a monthly invoice can carry, each backed by a
 * settings row (see supabase/seed.sql). invoice_item_type has no dedicated
 * category for streaming services or card replacement, so those go in as
 * 'other' with a description -- same as parking's two sub-fees share 'parking'.
 */
export const INVOICE_EXTRA_FEE_KEYS = [
  'internet_fee',
  'parking_fee_car',
  'parking_fee_motorcycle',
  'card_replacement_fee',
  'netflix_fee',
  'youtube_fee',
  'disney_fee',
  'viu_fee',
  'hbo_fee',
  'amazon_prime_fee',
] as const;

export type InvoiceExtraFeeKey = (typeof INVOICE_EXTRA_FEE_KEYS)[number];

export const EXTRA_FEE_META: Record<
  InvoiceExtraFeeKey,
  { type: InvoiceItemType; description: string }
> = {
  internet_fee: { type: 'internet', description: 'Internet' },
  parking_fee_car: { type: 'parking', description: 'Parking (car)' },
  parking_fee_motorcycle: { type: 'parking', description: 'Parking (motorcycle)' },
  card_replacement_fee: { type: 'other', description: 'Card replacement' },
  netflix_fee: { type: 'other', description: 'Netflix' },
  youtube_fee: { type: 'other', description: 'YouTube' },
  disney_fee: { type: 'other', description: 'Disney+' },
  viu_fee: { type: 'other', description: 'Viu' },
  hbo_fee: { type: 'other', description: 'HBO' },
  amazon_prime_fee: { type: 'other', description: 'Amazon Prime' },
};
