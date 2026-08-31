# TASKS.md

Implementation checklist. Keep this updated as work progresses.

Legend: `[x]` done · `[~]` partial · `[ ]` not started

---

## Phase 1 — Foundation

- [x] Node 24 LTS + Git installed (winget, portable — see CLAUDE.md for the PATH prefix)
- [x] Next.js 16 + TypeScript + Tailwind v4 scaffold (`src/`, App Router, `@/*` alias)
- [x] Dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `next-intl`, `zod`, `lucide-react`
- [x] TypeScript strict mode hardened (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- [x] ESLint + Prettier + Vitest configured; npm scripts wired
- [x] `.env.example` + env validation (`src/lib/env.ts`)
- [x] Supabase clients: browser / server / admin (service-role, `server-only`)
- [x] SQL migrations `0001`–`0008` (enums, tables, triggers, views, RLS, storage)
- [x] Seed data: 3 floors, 21 real rooms, T01, test tenant, 2 cards, contract, meters, invoice, payment, ticket
- [x] `npm run db:push` / `npm run seed` runners (no Supabase CLI needed)
- [x] next-intl routing, `th` default, `[locale]` segment, middleware, locale switcher
- [x] Thai + English message catalogues
- [x] Supabase Auth: login page, session middleware, `profiles` + role
- [x] Permission helpers (`owner` / `admin` / `staff`) + server-side guards
- [x] Brand color tokens (CP AXTRA / Lotus's) as CSS variables

## Phase 2 — Rooms, Floor Plan, Room Detail

- [x] Floor layout JSON (provisional L-shape, `provisional: true`, 7 rooms/floor)
- [x] `FloorPlan` SVG component — interactive regions, keyboard accessible
- [x] Floor tabs (1 / 2 / 3), status legend
- [x] Room status visuals: color **+ icon + label** (never color alone)
- [x] `v_room_board` view — one source of truth for floor plan, room list and test mode
- [x] Room detail drawer (click a room) with link to the full room page
- [x] Room detail tabs: Overview / Contract / Meters / Billing / Payments / Access Cards / Maintenance
- [x] Rooms list page (table view, filters)
- [x] Reusable `RoomCard`, `RoomStatusBadge`, `StatTile`, `Drawer`, `Tabs`, `Badge`
- [ ] Room create/edit form (owner+admin) — schema and validation exist, UI pending

## Phase 3 — Tenant & Contracts

- [x] Schema, constraints, `occupant_count >= 1`, one active contract per room
- [x] Zod schemas for tenant + contract
- [ ] Tenant create/edit UI (reachable from Room Detail)
- [ ] Move-in flow (create tenant + contract, set room `occupied`)
- [ ] Contract renewal flow
- [ ] Move-out / termination flow (release cards, final invoice, set room `vacant`)
- [ ] Contract expiry surfacing on dashboard (query exists; needs UI polish)

## Phase 4 — Access Cards

- [x] Schema + "exactly 2 per room" trigger + `access_card_events` history
- [x] Seeded `<room>-A` / `<room>-B` for all 22 rooms
- [x] Access Cards tab in Room Detail (read)
- [ ] Card actions UI: activate / disable / lost / replace / return
- [ ] Replacement fee → invoice line item
- [ ] Access Cards index page with status filters

## Phase 5 — Meters

- [x] Schema, generated `usage` / `amount`, `current >= previous` constraint
- [x] Unique per (room, meter_type, billing_month); `billing_month` must be day 1
- [x] Rates configurable in `settings`; rate snapshotted onto each reading
- [x] Meters tab in Room Detail (read)
- [ ] Monthly meter entry page (all rooms, one screen, prev auto-filled)
- [ ] Meter correction flow + audit entry

## Phase 6 — Billing

- [x] `invoices` + `invoice_items`, generated item amounts, trigger-computed totals
- [x] Invoice number sequence, status enum, one live invoice per room-month
- [x] `calc.ts` pure functions mirroring the SQL, unit tested
- [x] Billing tab in Room Detail (read)
- [ ] Generate monthly invoices for all occupied rooms (batch action)
- [ ] Invoice detail / edit / issue / cancel UI
- [ ] Printable invoice
- [ ] Overdue sweep (mark `issued` → `overdue` past due date)

## Phase 7 — Payments

- [x] Schema, overpayment guard, auto `paid` / `partially_paid` transition
- [x] Payments tab in Room Detail (read)
- [ ] Record payment form (cash / transfer / PromptPay)
- [ ] Payment slip upload to Supabase Storage (`payment-slips/{roomId}/{invoiceId}/`)
- [ ] Receipt view / print
- [ ] Partial payment + outstanding display

## Phase 8 — Dashboard & Reports

- [x] `report_*` views, all hard-filtered `is_test = false`
- [x] `src/lib/reporting/` as the sole reporting data access layer
- [x] Dashboard: room counts, occupancy rate, revenue, collected, outstanding, overdue
- [x] Dashboard operational panels: expiring contracts, open tickets, lost cards, payments due
- [ ] Reports pages: occupancy, monthly billing, collection, outstanding, meter usage, contract expiry, maintenance, card status
- [ ] CSV export

## Phase 9 — Maintenance

- [x] Schema with nullable `room_id` (common areas), priority + status enums
- [x] Maintenance tab in Room Detail (read)
- [ ] Ticket create/edit UI + status transitions
- [ ] Photo upload to Storage (`maintenance/{ticketId}/`)
- [ ] Maintenance index page with filters

## Phase 10 — Test Mode

- [x] `T01` on floor 0, excluded from all production floor plans and reporting
- [x] `/test` route rendering T01 through the real components
- [x] Scenario definitions: normal, payment due, overdue, vacant, maintenance, lost card, partial payment, contract expiring
- [x] `Reset Test Data` restores T01 defaults
- [x] Scenario switcher wired to server actions (`lib/test-mode/reconcile.ts`)
- [x] Reconciler refuses to run unless the target room really has `is_test = true`
- [x] Current scenario inferred from live state rather than stored

## Phase 11 — Hardening

- [x] RLS enabled on every application table
- [x] Service-role key server-only; `server-only` import guard
- [x] Regression test: T01 never affects dashboard totals
- [x] Unit tests: meter usage, invoice totals, partial payment, outstanding, overdue, contract dates
- [x] Architecture test: reporting layer cannot query a base table
- [x] Test: Thai and English catalogues define identical keys
- [x] Test: floor layouts hold exactly 21 rooms, none overlapping, T01 absent
- [x] `npm run build` clean, `tsc --noEmit` clean, ESLint clean, 108 tests green
- [ ] Audit trail wired into all mutation paths (table + triggers exist; app writes pending)
- [ ] Integration tests against a real Supabase project — **nothing below has been
      run against a live database yet; the SQL is unexecuted**
- [ ] Vercel deployment + env vars
- [ ] Accessibility pass (keyboard nav on floor plan done; needs full audit)

## Verified so far

Run locally, passing:

```
npm run build      clean, 15 routes, no warnings
npm run typecheck  clean
npm run lint       clean
npm test           9 files, 108 tests
```

**Not yet verified:** the migrations and seed have never been executed. They need
a real Supabase project (`npm run db:push && npm run seed`). Expect to fix a
constraint or two on first contact.

---

## Decisions made without clarification

Recorded here rather than blocking development.

1. **Room numbering** — 101–107 / 201–207 / 301–307 (7 per floor × 3 = 21). Change in
   `src/config/floor-layout/*.json` and `supabase/seed.sql` together if the real numbering differs.
2. **Floor plan geometry is provisional** — the real plan was not supplied (spec §39). The JSON files
   are marked `"provisional": true`. Topology is now confirmed (rectangular building, 7 rooms in a
   single row per floor, stairs past the last room); exact wall measurements are still a placeholder.
   Only these files change when real dimensions arrive.
3. **T01 is on floor 0** — needed a floor value that a CHECK constraint can exclude from production
   plans without special-casing every query.
4. **`is_test` on every operational table**, kept consistent with the parent room by trigger. A
   join-based derivation was rejected: tenants and common-area tickets have no direct room link.
5. **`room_type` enum** = `standard` / `air_conditioned` / `studio`. Placeholder; real dorm types
   unknown. Seed uses `standard` and `air_conditioned`.
6. **Money stored as `numeric(12,2)`**, transported as satang integers in TS to avoid float drift.
7. **Rate history** is not a separate table — each meter reading snapshots the `rate` it was billed
   at, so past months stay correct when settings change.
8. **`payments.status`** = `pending` / `confirmed` / `cancelled`. Only `confirmed` counts toward
   invoice settlement and collection reporting.
9. **Electricity 8 THB/unit, water 20 THB/unit** as seeded defaults, matching the spec's T01 example.
10. **No Supabase CLI** — migrations run through a small `scripts/` runner over the service-role
    connection, so the free tier and this machine need no extra tooling.
