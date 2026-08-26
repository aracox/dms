import 'server-only';

/**
 * Reconciles the mock room T01 to a declared scenario state.
 *
 * This uses the service-role client because it deletes payments and rewrites
 * invoice items -- operations RLS reserves for the owner. That is safe here for
 * one reason only, and it is asserted at runtime: every write is scoped to a
 * room whose `is_test` is true. If T01 ever loses that flag, this module refuses
 * to run rather than touching production data.
 */

import { buildMonthlyInvoiceItems, invoiceTotals } from '@/lib/billing/calc';
import { round2 } from '@/lib/billing/money';
import { createAdminClient } from '@/lib/supabase/admin';
import { bangkokToday, currentBillingMonth, type IsoDate } from '@/lib/utils/date';
import {
  DEFAULT_TEST_SCENARIO,
  T01_DEFAULTS,
  T01_ROOM_NUMBER,
  TEST_SCENARIOS,
  type TestScenarioId,
  type TestScenarioState,
} from '@/config/test-scenarios';

export class TestModeError extends Error {}

function addDays(date: IsoDate, days: number): IsoDate {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Loads T01 and refuses to continue unless it is genuinely a test room.
 * This is the guard that makes service-role access acceptable here.
 */
async function loadTestRoom(admin: Admin) {
  const { data: room, error } = await admin
    .from('rooms')
    .select('*')
    .eq('room_number', T01_ROOM_NUMBER)
    .maybeSingle();

  if (error) throw new TestModeError(error.message);
  if (!room) throw new TestModeError(`Room ${T01_ROOM_NUMBER} does not exist. Run the seed first.`);

  if (!room.is_test) {
    throw new TestModeError(
      `Room ${T01_ROOM_NUMBER} is not flagged is_test. Refusing to write: this could be production data.`,
    );
  }

  if (room.floor !== 0) {
    throw new TestModeError(
      `Room ${T01_ROOM_NUMBER} is on floor ${room.floor}; the test room must stay on floor 0.`,
    );
  }

  return room;
}

async function ensureTestTenant(admin: Admin) {
  const { data: existing } = await admin
    .from('tenants')
    .select('*')
    .eq('is_test', true)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  if (existing) {
    await admin
      .from('tenants')
      .update({ full_name: T01_DEFAULTS.tenantName, phone: T01_DEFAULTS.tenantPhone })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data: created, error } = await admin
    .from('tenants')
    .insert({
      full_name: T01_DEFAULTS.tenantName,
      phone: T01_DEFAULTS.tenantPhone,
      nationality: 'Thai',
      is_test: true,
      notes: 'Mock tenant for Test Mode.',
    })
    .select('id')
    .single();

  if (error || !created) throw new TestModeError(error?.message ?? 'Could not create test tenant');
  return created.id;
}

/** Restores the default meter readings so the invoice always totals 7,660. */
async function reconcileMeters(admin: Admin, roomId: string, billingMonth: IsoDate) {
  for (const [meterType, reading] of Object.entries(T01_DEFAULTS.meters)) {
    const { data: existing } = await admin
      .from('meter_readings')
      .select('id')
      .eq('room_id', roomId)
      .eq('meter_type', meterType as 'electricity' | 'water')
      .eq('billing_month', billingMonth)
      .maybeSingle();

    const values = {
      previous_reading: reading.previousReading,
      current_reading: reading.currentReading,
      rate: reading.rate,
    };

    if (existing) {
      await admin.from('meter_readings').update(values).eq('id', existing.id);
    } else {
      await admin.from('meter_readings').insert({
        room_id: roomId,
        meter_type: meterType as 'electricity' | 'water',
        billing_month: billingMonth,
        ...values,
      });
    }
  }
}

async function reconcileContract(
  admin: Admin,
  roomId: string,
  state: TestScenarioState,
  today: IsoDate,
) {
  const { data: contracts } = await admin
    .from('contracts')
    .select('*')
    .eq('room_id', roomId)
    .order('start_date', { ascending: false });

  const existing = contracts?.[0] ?? null;

  if (!state.contract) {
    if (existing && existing.status === 'active') {
      await admin
        .from('contracts')
        .update({ status: 'terminated', terminated_at: today })
        .eq('id', existing.id);
    }
    return;
  }

  const tenantId = await ensureTestTenant(admin);
  const values = {
    status: 'active' as const,
    end_date: addDays(today, state.contract.endsInDays),
    occupant_count: state.contract.occupantCount,
    monthly_rent: T01_DEFAULTS.monthlyRent,
    deposit: T01_DEFAULTS.deposit,
    terminated_at: null,
    termination_reason: null,
  };

  if (existing) {
    await admin
      .from('contracts')
      .update({ ...values, tenant_id: tenantId })
      .eq('id', existing.id);
  } else {
    await admin.from('contracts').insert({
      room_id: roomId,
      tenant_id: tenantId,
      start_date: addDays(today, -180),
      payment_due_day: 5,
      ...values,
    });
  }
}

async function reconcileCards(admin: Admin, roomId: string, state: TestScenarioState) {
  const { data: cards } = await admin
    .from('access_cards')
    .select('*')
    .eq('room_id', roomId)
    .order('card_number');

  const slots = [
    { suffix: '-A', status: state.cards.slotA, uid: T01_DEFAULTS.cards[0].cardUid },
    { suffix: '-B', status: state.cards.slotB, uid: T01_DEFAULTS.cards[1].cardUid },
  ];

  for (const slot of slots) {
    const cardNumber = `${T01_ROOM_NUMBER}${slot.suffix}`;
    const existing = cards?.find((card) => card.card_number === cardNumber);

    // The replacement fee only applies to a card that was actually lost.
    const fee = slot.status === 'lost' ? state.cards.replacementFee : 0;

    if (existing) {
      await admin
        .from('access_cards')
        .update({
          status: slot.status,
          card_uid: slot.uid,
          replacement_fee: fee,
          issued_date:
            slot.status === 'available' ? null : (existing.issued_date ?? bangkokToday()),
          returned_date: slot.status === 'returned' ? bangkokToday() : null,
        })
        .eq('id', existing.id);
    } else {
      await admin.from('access_cards').insert({
        room_id: roomId,
        card_number: cardNumber,
        card_uid: slot.uid,
        status: slot.status,
        replacement_fee: fee,
      });
    }
  }
}

async function reconcileInvoice(
  admin: Admin,
  roomId: string,
  contractId: string | null,
  state: TestScenarioState,
  billingMonth: IsoDate,
  today: IsoDate,
) {
  const { data: existingInvoices } = await admin
    .from('invoices')
    .select('*')
    .eq('room_id', roomId)
    .eq('billing_month', billingMonth)
    .neq('status', 'cancelled');

  const existing = existingInvoices?.[0] ?? null;

  if (!state.invoice) {
    if (existing) {
      // Payments must go before the invoice is cancelled, or the recalculation
      // trigger would leave a cancelled invoice carrying money.
      await admin.from('payments').delete().eq('invoice_id', existing.id);
      await admin.from('invoices').update({ status: 'cancelled' }).eq('id', existing.id);
    }
    return;
  }

  const items = buildMonthlyInvoiceItems({
    monthlyRent: T01_DEFAULTS.monthlyRent,
    electricity: T01_DEFAULTS.meters.electricity,
    water: T01_DEFAULTS.meters.water,
  });
  const { total } = invoiceTotals(items);
  const dueDate = addDays(today, state.invoice.dueInDays);

  let invoiceId = existing?.id;

  if (existing) {
    await admin
      .from('invoices')
      .update({ due_date: dueDate, status: 'issued', contract_id: contractId })
      .eq('id', existing.id);
  } else {
    const { data: created, error } = await admin
      .from('invoices')
      .insert({
        room_id: roomId,
        contract_id: contractId,
        billing_month: billingMonth,
        invoice_number: `INV-${billingMonth.slice(0, 7).replace('-', '')}-T01`,
        issue_date: billingMonth,
        due_date: dueDate,
        status: 'issued',
      })
      .select('id')
      .single();

    if (error || !created)
      throw new TestModeError(error?.message ?? 'Could not create test invoice');
    invoiceId = created.id;
  }

  if (!invoiceId) throw new TestModeError('Test invoice id missing');

  // Clear payments before rewriting items: shrinking the total below what has
  // been paid would trip the overpayment guard in recalc_invoice().
  await admin.from('payments').delete().eq('invoice_id', invoiceId);
  await admin.from('invoice_items').delete().eq('invoice_id', invoiceId);

  await admin.from('invoice_items').insert(
    items.map((item, index) => ({
      invoice_id: invoiceId,
      type: item.type,
      description:
        item.type === 'rent' ? 'Monthly rent' : `${item.quantity} units @ ${item.unitPrice}`,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      sort_order: index + 1,
    })),
  );

  const paidAmount = round2(total * state.invoice.paidFraction);

  if (paidAmount > 0) {
    await admin.from('payments').insert({
      invoice_id: invoiceId,
      payment_date: today,
      amount: paidAmount,
      payment_method: 'cash',
      status: 'confirmed',
      note: 'Mock payment for Test Mode',
    });
  }

  // With no payment change there is no trigger to fire, so derive the status
  // from the new due date explicitly.
  await admin.rpc('recalc_invoice', { p_invoice_id: invoiceId });
}

async function reconcileMaintenance(admin: Admin, roomId: string, state: TestScenarioState) {
  const openStatuses = ['open', 'in_progress', 'waiting'] as const;

  const { data: open } = await admin
    .from('maintenance_tickets')
    .select('*')
    .eq('room_id', roomId)
    .in('status', openStatuses);

  if (!state.maintenance) {
    for (const ticket of open ?? []) {
      await admin.from('maintenance_tickets').update({ status: 'cancelled' }).eq('id', ticket.id);
    }
    return;
  }

  const first = open?.[0];

  if (first) {
    await admin
      .from('maintenance_tickets')
      .update({
        status: 'open',
        priority: state.maintenance.priority,
        category: state.maintenance.category,
      })
      .eq('id', first.id);
  } else {
    await admin.from('maintenance_tickets').insert({
      room_id: roomId,
      category: state.maintenance.category,
      description: 'Mock maintenance ticket for Test Mode.',
      priority: state.maintenance.priority,
      status: 'open',
    });
  }
}

/** Brings T01 to the given scenario state. */
export async function reconcileTestRoom(scenarioId: TestScenarioId): Promise<void> {
  const admin = createAdminClient();
  const room = await loadTestRoom(admin);

  const state = TEST_SCENARIOS[scenarioId].state;
  const today = bangkokToday();
  const billingMonth = currentBillingMonth();

  await admin
    .from('rooms')
    .update({
      status: state.roomStatus,
      monthly_rent: T01_DEFAULTS.monthlyRent,
      deposit: T01_DEFAULTS.deposit,
    })
    .eq('id', room.id);

  await reconcileMeters(admin, room.id, billingMonth);
  await reconcileContract(admin, room.id, state, today);

  const { data: activeContract } = await admin
    .from('contracts')
    .select('id')
    .eq('room_id', room.id)
    .eq('status', 'active')
    .maybeSingle();

  await reconcileCards(admin, room.id, state);
  await reconcileInvoice(admin, room.id, activeContract?.id ?? null, state, billingMonth, today);
  await reconcileMaintenance(admin, room.id, state);
}

/** Restores every T01 default, then applies the `normal` scenario. */
export async function resetTestRoom(): Promise<void> {
  await reconcileTestRoom(DEFAULT_TEST_SCENARIO);
}
