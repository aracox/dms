# Dormitory Management System

Bilingual (ไทย / English) management system for a single dormitory in Thailand:
**21 rooms across 3 floors, L-shaped building, 2 access cards per room.**

Built for the dormitory owner. The main entry point is an interactive floor plan
rather than a room list — you click the room you are thinking about.

Next.js 16 · TypeScript · Tailwind v4 · Supabase (PostgreSQL, Auth, Storage) ·
next-intl · Zod. Deploys to Vercel free tier against Supabase free tier.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in your Supabase values
npm run db:push                # apply supabase/migrations/*.sql in order
npm run seed                   # 21 real rooms + T01, tenants, invoices, payments
npm run dev                    # http://localhost:3000 -> redirects to /th
```

Then create your login: sign up is not exposed in the UI, so add the user in the
Supabase dashboard (**Authentication → Users → Add user**), and promote them:

```sql
update profiles
set role = 'owner', full_name = 'Dormitory Owner'
where id = (select id from auth.users where email = 'you@example.com');
```

A trigger creates the `profiles` row automatically on sign-up, defaulting to the
`staff` role.

### Node on Windows

If `node` is not on your PATH (a winget portable install, for example), prefix
each shell:

```powershell
$env:PATH = "D:\Users\boitsaret\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64;$env:PATH"
```

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest, watch mode |
| `npm run db:push` | Apply pending migrations (tracked in `schema_migrations`) |
| `npm run seed` | Apply `supabase/seed.sql` and verify test-data exclusion |

Run one test file, or one test by name:

```bash
npx vitest run src/lib/billing/calc.test.ts
npx vitest run -t "excludes the T01 payment from collected revenue"
```

---

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Anon key; RLS applies |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Bypasses RLS. Seeding and system jobs |
| `SUPABASE_DB_URL` | scripts only | Direct Postgres URI for `db:push` / `seed` |
| `NEXT_PUBLIC_SITE_URL` | optional | Public origin for auth redirects |

`src/lib/env.server.ts` imports `server-only`, so a client bundle that reaches
the service-role key fails the build rather than shipping it.

---

## Database

Migrations are plain SQL applied in filename order. There is no Supabase CLI
dependency — `npm run db:push` connects over the Postgres protocol and records
what it has applied, so it is safe to re-run.

```
supabase/migrations/
  0001_enums.sql                     enum types
  0002_core_tables.sql               profiles, settings, rooms, tenants
  0003_contracts_and_cards.sql       contracts, access cards + history
  0004_meters_billing_maintenance.sql meters, invoices, payments, tickets, audit
  0005_functions_and_triggers.sql    business rules enforced in the database
  0006_views.sql                     v_* operational, report_* reporting
  0007_rls.sql                       row level security for every table
  0008_storage.sql                   private storage buckets + policies
supabase/seed.sql                    idempotent development data
```

Migrations are append-only. To change the schema, add a numbered file; never
edit one that has been applied.

The database — not the application — owns the arithmetic:

- `meter_readings.usage` and `.amount` are generated columns.
- `invoice_items.amount` is a generated column.
- `invoices.subtotal` / `.discount` / `.total` are maintained by trigger.
- A trigger rejects payments exceeding the invoice total and derives
  `paid` / `partially_paid` / `overdue`.

A client cannot write any of those, by construction.

---

## The rule that shapes everything

The database holds **22 rooms**: the 21 real ones plus a mock room `T01` used by
Test Mode. Every figure the owner sees must come from the 21.

Four independent defences:

1. `T01` sits on **floor 0**. A CHECK constraint pins real rooms to floors 1–3
   and test rooms to floor 0, so `T01` cannot appear on a production floor plan.
2. Every operational table carries `is_test`, and a trigger forces each child row
   to match its parent room. It cannot drift, and a test tenant cannot be
   contracted to a real room.
3. Dashboards and reports read only `report_*` views, which hard-filter
   `is_test = false` in SQL. `src/lib/reporting/` is the only module allowed to
   query them, and it has no code path that can widen the filter.
4. `src/lib/reporting/exclusion.test.ts` asserts the arithmetic, scans
   `queries.ts` for stray base-table access, and greps the migrations for the
   constraints and triggers above.

With the seed applied, the dashboard reads 21 rooms and ฿46,760 collected. If
`T01` leaked in it would read 22 rooms and ฿54,420 — which is exactly what that
test checks.

---

## Architecture

```
src/
  app/[locale]/          Server Components by default
    (app)/               authenticated pages, wrapped in AppShell
    login/               public
  components/
    floor-plan/          interactive SVG, keyboard accessible
    room/                RoomDetail and its seven tabs — reused verbatim by Test Mode
    status/              the one mapping from room state to colour + icon + label
    ui/                  Card, Badge, Table, Tabs, Drawer, StatTile
  config/
    floor-layout/        static SVG geometry (JSON) — no business data
    test-scenarios/      the eight Test Mode scenarios
  lib/
    supabase/            client (browser) | server (RSC) | admin (service role)
    billing/             money and invoice maths, mirroring the SQL, unit tested
    reporting/           the ONLY reporting data access
    rooms/               operational room queries (can see T01, on request)
    test-mode/           scenario reconciliation
    validation/          Zod schemas, server-side
    permissions/         role checks mirroring the RLS policies
  proxy.ts               locale routing + Supabase session refresh
```

Three Supabase clients, and the difference matters:

- `lib/supabase/server.ts` — RSC, Server Actions, Route Handlers. Anon key plus
  the user's session, so RLS applies. **The default.**
- `lib/supabase/client.ts` — browser. Anon key, RLS applies.
- `lib/supabase/admin.ts` — service role, bypasses RLS. Seeding and system jobs
  only. Imports `server-only`.

### Business rules worth knowing before you edit

- **One tenant per room.** A room may house several people, but exactly one is
  registered, and that person is also the contact. Additional occupants exist
  only as `contracts.occupant_count`, which *includes* the main tenant. There is
  deliberately no `roommates` table.
- **Access cards belong to rooms**, never to people. Exactly two per room, named
  `<room>-A` and `<room>-B`; a trigger rejects a third, and every status change
  writes an `access_card_events` row.
- **Dates are Bangkok dates.** Vercel runs UTC, users are UTC+7. Use
  `bangkokToday()` from `src/lib/utils/date.ts`, never a bare `new Date()`, or
  late-evening activity lands on the wrong day and bills the wrong month.
- **Status values are language-neutral.** Enums stay English snake_case in the
  database; `next-intl` translates them at the UI layer only.
- **Test Mode reuses real components.** `/test` renders `T01` through the same
  `RoomDetail` as any real room. There is no mock variant of anything.

---

## Floor plan

`src/config/floor-layout/floor-{1,2,3}.json` currently hold **provisional**
geometry — the real building plan has not been supplied. Room numbers
101–107 / 201–207 / 301–307 assume 7 rooms per floor, and the app shows a
"provisional layout" notice while `"provisional": true`.

When the real plan arrives, edit only those JSON files: remap
`x` / `y` / `width` / `height` / `rotation` and the room numbers, then set
`provisional` to `false`. No component changes are needed. Geometry stays out of
the database — it describes the building, not the business.

---

## Roles

| | Owner | Admin | Staff |
| --- | --- | --- | --- |
| Read everything | ✓ | ✓ | ✓ |
| Record meter readings, payments, tickets | ✓ | ✓ | ✓ |
| Rooms, tenants, contracts, cards, invoices | ✓ | ✓ | |
| Correct meter readings | ✓ | ✓ | |
| Delete payments | ✓ | | |
| Change settings | ✓ | | |

Enforced by RLS in `0007_rls.sql`. `src/lib/permissions/` mirrors it so the UI
can hide what a user cannot do — it is not the enforcement.

---

## Deployment (Vercel)

1. Push the repository and import it in Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` (do **not** add `SUPABASE_DB_URL` — it is only
   needed by the local scripts).
3. Add your Vercel domain to Supabase → Authentication → URL Configuration.
4. Deploy. Nothing is written to the local filesystem, so the free tier is fine.

---

## Status

`TASKS.md` tracks what is done and what is next. In short: the schema, RLS,
seed, i18n, auth, floor plan, room detail, dashboard, reports and Test Mode are
working. The create/edit forms for move-in, meter entry, invoice generation and
payment recording are the next phase — the pages that need them say so.

Out of scope for v1: accounting/GL, smart meters, access-control hardware, bank
APIs, automatic reconciliation, inventory, CRM, mobile app, multi-property.
