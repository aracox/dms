-- 0001_enums.sql
-- Enum types. All values are language-neutral English snake_case and are translated
-- at the UI layer only (see CLAUDE.md "Status values are language-neutral").

create extension if not exists pgcrypto;

create type app_role as enum ('owner', 'admin', 'staff');

create type room_status as enum ('vacant', 'occupied', 'reserved', 'maintenance');

create type room_type as enum ('standard', 'air_conditioned', 'studio');

create type contract_status as enum ('draft', 'active', 'expired', 'terminated');

create type card_status as enum (
  'available',
  'active',
  'lost',
  'disabled',
  'damaged',
  'returned'
);

create type card_action as enum (
  'issue',
  'activate',
  'disable',
  'report_lost',
  'replace',
  'return',
  'mark_damaged'
);

create type meter_type as enum ('electricity', 'water');

create type invoice_status as enum (
  'draft',
  'issued',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled'
);

-- 'discount' items are stored as positive amounts and subtracted from the subtotal.
create type invoice_item_type as enum (
  'rent',
  'electricity',
  'water',
  'internet',
  'parking',
  'other',
  'discount'
);

create type payment_method as enum ('cash', 'bank_transfer', 'promptpay');

-- Only 'confirmed' payments settle an invoice or count toward collection reporting.
create type payment_status as enum ('pending', 'confirmed', 'cancelled');

create type maintenance_status as enum (
  'open',
  'in_progress',
  'waiting',
  'completed',
  'cancelled'
);

create type maintenance_priority as enum ('low', 'medium', 'high', 'urgent');

create type audit_action as enum ('insert', 'update', 'delete');
