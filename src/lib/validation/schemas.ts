/**
 * Zod schemas for every business form.
 *
 * These run on the SERVER (in Server Actions), not only in the browser. Client
 * validation is a convenience; this is the gate. The database constraints in
 * migrations 0002-0005 are the final backstop.
 *
 * Error messages are i18n keys, resolved by the caller through next-intl, so no
 * user-facing English leaks out of this module.
 */

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const THAI_PHONE = /^0\d{8,9}$/;
// Structural check only. z.uuid() enforces RFC 4122 version/variant bits, but
// seed_uuid() (md5(...)::uuid in supabase/seed.sql) doesn't set them, so every
// seeded id would fail that stricter check. Postgres's own `uuid` column
// accepts any 8-4-4-4-12 hex value regardless of those bits; this matches that.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uuid = z.string().regex(UUID, 'errors.generic');

const isoDate = z.string().regex(ISO_DATE, 'validation.date.format');

const billingMonth = isoDate.refine(
  (value) => value.endsWith('-01'),
  'validation.date.firstOfMonth',
);

const money = z.number().finite().min(0, 'validation.money.negative');

const positiveMoney = z.number().finite().positive('validation.money.notPositive');

// --- Rooms -----------------------------------------------------------------

export const roomSchema = z.object({
  room_number: z.string().trim().min(1, 'validation.required').max(10),
  floor: z.int().min(1, 'validation.room.floorRange').max(3, 'validation.room.floorRange'),
  room_type: z.enum(['standard', 'air_conditioned', 'studio', 'house']),
  monthly_rent: money,
  deposit: money,
  status: z.enum(['vacant', 'occupied', 'reserved', 'maintenance']),
  size_sqm: z.number().positive().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type RoomInput = z.infer<typeof roomSchema>;

/**
 * Sets a room's status among the three a room can be in without a tenant:
 * vacant, reserved, or under maintenance. 'occupied' is exclusively managed
 * by move-in/move-out, never through this.
 */
export const roomStatusOverrideSchema = z.object({
  room_id: uuid,
  status: z.enum(['vacant', 'reserved', 'maintenance']),
});

export type RoomStatusOverrideInput = z.infer<typeof roomStatusOverrideSchema>;

/** At most 1 car + 1 motorcycle per room -- enforced by the columns being scalar, not a list. */
export const roomVehiclesSchema = z.object({
  room_id: uuid,
  car_plate: z.string().trim().max(20).nullable().optional(),
  motorcycle_plate: z.string().trim().max(20).nullable().optional(),
});

export type RoomVehiclesInput = z.infer<typeof roomVehiclesSchema>;

// --- Tenants ---------------------------------------------------------------

/** The single registered person per room: main tenant and contact in one record. */
export const tenantSchema = z.object({
  full_name: z.string().trim().min(1, 'validation.required').max(200),
  phone: z.string().trim().regex(THAI_PHONE, 'validation.phone.format'),
  email: z
    .union([z.literal(''), z.email('validation.email.format')])
    .nullable()
    .optional(),
  id_card_or_passport: z.string().trim().max(50).nullable().optional(),
  nationality: z.string().trim().max(60).nullable().optional(),
  emergency_contact: z.string().trim().max(200).nullable().optional(),
  emergency_phone: z
    .union([z.literal(''), z.string().trim().regex(THAI_PHONE, 'validation.phone.format')])
    .nullable()
    .optional(),
  line_id: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type TenantInput = z.infer<typeof tenantSchema>;

/**
 * The subset of tenant fields editable after move-in: contact details, not
 * identity. full_name / id_card_or_passport / nationality stay fixed once the
 * tenant is registered.
 */
export const tenantContactSchema = z.object({
  tenant_id: uuid,
  phone: z.string().trim().regex(THAI_PHONE, 'validation.phone.format'),
  line_id: z.string().trim().max(100).nullable().optional(),
  emergency_contact: z.string().trim().max(200).nullable().optional(),
  emergency_phone: z
    .union([z.literal(''), z.string().trim().regex(THAI_PHONE, 'validation.phone.format')])
    .nullable()
    .optional(),
});

export type TenantContactInput = z.infer<typeof tenantContactSchema>;

// --- Contracts -------------------------------------------------------------

export const contractSchema = z
  .object({
    room_id: uuid,
    tenant_id: uuid,
    start_date: isoDate,
    end_date: isoDate,
    monthly_rent: money,
    deposit: money,
    payment_due_day: z
      .int()
      .min(1, 'validation.contract.dueDayRange')
      .max(28, 'validation.contract.dueDayRange'),
    /** Total occupants INCLUDING the main tenant. */
    occupant_count: z.int().min(1, 'validation.contract.occupantsMin').max(20),
    status: z.enum(['draft', 'active', 'expired', 'terminated']),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((value) => value.end_date > value.start_date, {
    error: 'validation.contract.endBeforeStart',
    path: ['end_date'],
  });

export type ContractInput = z.infer<typeof contractSchema>;

/** Corrects the rent an active contract bills, without touching its other terms. */
export const contractRentSchema = z.object({
  contract_id: uuid,
  monthly_rent: money,
});

export type ContractRentInput = z.infer<typeof contractRentSchema>;

// --- Access cards ----------------------------------------------------------

export const accessCardSchema = z.object({
  room_id: uuid,
  /** Must be <room_number>-A or <room_number>-B; the database enforces the pairing. */
  card_number: z
    .string()
    .trim()
    .regex(/-[AB]$/, 'validation.card.slot'),
  card_uid: z.string().trim().max(64).nullable().optional(),
  status: z.enum(['available', 'active', 'lost', 'disabled', 'damaged', 'returned']),
  issued_date: isoDate.nullable().optional(),
  returned_date: isoDate.nullable().optional(),
  replacement_fee: money,
  notes: z.string().trim().max(500).nullable().optional(),
});

export const cardActionSchema = z.object({
  card_id: uuid,
  action: z.enum(['activate', 'disable', 'report_lost', 'replace', 'return', 'mark_damaged']),
  replacement_fee: money.optional(),
  note: z.string().trim().max(500).optional(),
});

export type CardActionInput = z.infer<typeof cardActionSchema>;

// --- Meter readings --------------------------------------------------------

export const meterReadingSchema = z
  .object({
    room_id: uuid,
    meter_type: z.enum(['electricity', 'water']),
    billing_month: billingMonth,
    previous_reading: money,
    current_reading: money,
    rate: money,
    note: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => value.current_reading >= value.previous_reading, {
    error: 'validation.meter.reversed',
    path: ['current_reading'],
  });

export type MeterReadingInput = z.infer<typeof meterReadingSchema>;

// --- Invoices --------------------------------------------------------------

export const invoiceItemSchema = z.object({
  type: z.enum(['rent', 'electricity', 'water', 'internet', 'parking', 'other', 'discount']),
  description: z.string().trim().max(300).default(''),
  quantity: positiveMoney,
  unit_price: money,
  sort_order: z.int().min(0).max(999).default(0),
});

export const invoiceSchema = z.object({
  room_id: uuid,
  contract_id: uuid.nullable().optional(),
  billing_month: billingMonth,
  issue_date: isoDate.nullable().optional(),
  due_date: isoDate,
  items: z.array(invoiceItemSchema).min(1, 'validation.invoice.noItems'),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;

/**
 * Generates a room's monthly invoice: rent + that month's recorded meter
 * usage (if any) + whichever optional extra fees the caller ticks. The extra
 * fee keys are validated against the known settings keys in the action.
 */
export const generateInvoiceSchema = z.object({
  room_id: uuid,
  billing_month: billingMonth,
});

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;

// --- Payments --------------------------------------------------------------

export const paymentSchema = z.object({
  invoice_id: uuid,
  payment_date: isoDate,
  amount: positiveMoney,
  payment_method: z.enum(['cash', 'bank_transfer', 'promptpay']),
  reference: z.string().trim().max(100).nullable().optional(),
  slip_path: z.string().trim().max(500).nullable().optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled']).default('confirmed'),
  note: z.string().trim().max(500).nullable().optional(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

// --- Maintenance -----------------------------------------------------------

export const maintenanceSchema = z.object({
  /** Null for a common-area ticket. */
  room_id: uuid.nullable().optional(),
  category: z.string().trim().min(1, 'validation.required').max(60),
  description: z.string().trim().min(1, 'validation.required').max(2000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['open', 'in_progress', 'waiting', 'completed', 'cancelled']),
  cost: money.nullable().optional(),
  technician: z.string().trim().max(200).nullable().optional(),
  photo_path: z.string().trim().max(500).nullable().optional(),
});

export type MaintenanceInput = z.infer<typeof maintenanceSchema>;

// --- Settings --------------------------------------------------------------

export const settingsSchema = z.object({
  electricity_rate: money,
  water_rate: money,
  internet_fee: money,
  parking_fee_car: money,
  parking_fee_motorcycle: money,
  card_replacement_fee: money,
  netflix_fee: money,
  youtube_fee: money,
  disney_fee: money,
  viu_fee: money,
  hbo_fee: money,
  amazon_prime_fee: money,
  default_monthly_rent: money,
  default_deposit: money,
  default_payment_due_day: z
    .int()
    .min(1, 'validation.contract.dueDayRange')
    .max(28, 'validation.contract.dueDayRange'),
  payment_grace_days: z
    .int()
    .min(0, 'validation.settings.graceDaysRange')
    .max(30, 'validation.settings.graceDaysRange'),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

// --- Move-in / move-out ----------------------------------------------------

/**
 * Move-in registers ONE person and a headcount. There is deliberately no way to
 * supply details for the additional occupants.
 */
export const moveInSchema = z
  .object({
    room_id: uuid,
    tenant: tenantSchema,
    start_date: isoDate,
    end_date: isoDate,
    monthly_rent: money,
    deposit: money,
    payment_due_day: z
      .int()
      .min(1, 'validation.contract.dueDayRange')
      .max(28, 'validation.contract.dueDayRange'),
    occupant_count: z.int().min(1, 'validation.contract.occupantsMin').max(20),
    activate_cards: z.boolean().default(true),
  })
  .refine((value) => value.end_date > value.start_date, {
    error: 'validation.contract.endBeforeStart',
    path: ['end_date'],
  });

export type MoveInInput = z.infer<typeof moveInSchema>;

export const moveOutSchema = z.object({
  contract_id: uuid,
  terminated_at: isoDate,
  termination_reason: z.string().trim().max(500).optional(),
  return_cards: z.boolean().default(true),
});

export type MoveOutInput = z.infer<typeof moveOutSchema>;
