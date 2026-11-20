import type { InvoiceItemType } from '@/types/database';

/**
 * The optional extra fees a monthly invoice can carry, each backed by a
 * settings row (see supabase/seed.sql). invoice_item_type has no dedicated
 * category for streaming services, so those go in as 'other' with a
 * description -- same as parking's two sub-fees share 'parking'.
 *
 * card_replacement_fee is not one of them: a replacement card is paid for on
 * the spot (access_card_events.fee, counted as income by 0046), so billing it
 * too would charge it twice.
 */
export const INVOICE_EXTRA_FEE_KEYS = [
  'internet_fee',
  'parking_fee_car',
  'parking_fee_motorcycle',
  'netflix_fee',
  'youtube_fee',
  'disney_fee',
  'viu_fee',
  'hbo_fee',
  'amazon_prime_fee',
] as const;

export type InvoiceExtraFeeKey = (typeof INVOICE_EXTRA_FEE_KEYS)[number];

/** The extra fees that are standing subscriptions -- currently all of them. */
export const SUBSCRIPTION_FEE_KEYS = [
  'internet_fee',
  'parking_fee_car',
  'parking_fee_motorcycle',
  'netflix_fee',
  'youtube_fee',
  'disney_fee',
  'viu_fee',
  'hbo_fee',
  'amazon_prime_fee',
] as const satisfies readonly InvoiceExtraFeeKey[];

export type SubscriptionFeeKey = (typeof SUBSCRIPTION_FEE_KEYS)[number];

/** Settings label key for each extra fee, reusing the existing Settings page copy. */
export const EXTRA_FEE_LABEL_KEY: Record<InvoiceExtraFeeKey, string> = {
  internet_fee: 'settings.internetFee',
  parking_fee_car: 'settings.parkingFeeCar',
  parking_fee_motorcycle: 'settings.parkingFeeMotorcycle',
  netflix_fee: 'settings.netflixFee',
  youtube_fee: 'settings.youtubeFee',
  disney_fee: 'settings.disneyFee',
  viu_fee: 'settings.viuFee',
  hbo_fee: 'settings.hboFee',
  amazon_prime_fee: 'settings.amazonPrimeFee',
};

export const EXTRA_FEE_META: Record<
  InvoiceExtraFeeKey,
  { type: InvoiceItemType; description: string }
> = {
  internet_fee: { type: 'internet', description: 'Internet' },
  parking_fee_car: { type: 'parking', description: 'Parking (car)' },
  parking_fee_motorcycle: { type: 'parking', description: 'Parking (motorcycle)' },
  netflix_fee: { type: 'other', description: 'Netflix' },
  youtube_fee: { type: 'other', description: 'YouTube' },
  disney_fee: { type: 'other', description: 'Disney+' },
  viu_fee: { type: 'other', description: 'Viu' },
  hbo_fee: { type: 'other', description: 'HBO' },
  amazon_prime_fee: { type: 'other', description: 'Amazon Prime' },
};
