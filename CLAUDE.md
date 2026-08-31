# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- The behavioral guidelines below are kept identical in AGENTS.md and GEMINI.md. Edit all three together. -->

---

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

# Repository Guidelines

## What this is

A bilingual (Thai / English) dormitory management system for a single real dormitory in Thailand:
**21 real rooms, 3 floors, rectangular building (7 rooms in a single row per floor), 2 access cards
per room.** The primary user is the dormitory owner/admin. Deploys to Vercel free tier against
Supabase free tier PostgreSQL.

The main navigation entry point is an **interactive SVG floor plan**, not a room list.

## Toolchain on this machine

Node is a winget portable install and **is not on the default PATH**. Every `PowerShell` tool call
starts a fresh shell, so prefix it each time:

```powershell
$env:PATH = "D:\Users\boitsaret\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64;$env:PATH"
```

PowerShell here is **Windows PowerShell 5.1** — no `&&`, no ternary, no `??`.

## Commands

```powershell
npm run dev              # dev server on :3000
npm run build            # production build (run before declaring work done)
npm run start            # serve the production build
npm run lint             # eslint
npm run typecheck        # tsc --noEmit
npm run format           # prettier --write
npm run test             # vitest run
npm run test:watch       # vitest watch
npm run seed             # apply supabase/seed.sql via service role (needs .env.local)
```

Run a single test file or a single test:

```powershell
npx vitest run src/lib/billing/calc.test.ts
npx vitest run -t "excludes test rooms from occupancy"
```

## Database workflow

Migrations are plain SQL in `supabase/migrations/`, applied **in filename order**. There is no
Supabase CLI dependency — paste them into the Supabase SQL editor, or run `npm run db:push` which
executes them in order over the service-role connection.

Migrations are append-only. To change schema, add a new numbered file; never edit an applied one.

After any schema change, regenerate types:

```powershell
npx supabase gen types typescript --project-id <ref> > src/types/database.ts
```

`src/types/database.ts` is currently hand-maintained, and two things about it
will waste an hour if you don't know them. postgrest-js requires every
`Row`/`Insert`/`Update` to satisfy `Record<string, unknown>`:

- Use **`type`, not `interface`**, for row shapes. Interfaces get no implicit
  index signature, so they fail the constraint.
- Never use `never` for an append-only table's `Update`. Use the `NoWrites`
  helper instead.

Break either rule and the `GenericSchema` constraint fails silently — every
query degrades to `never` and you get dozens of unrelated-looking errors like
`Property 'id' does not exist on type 'never'`.

## Architecture

Next.js App Router talking directly to Supabase. No Prisma, no separate backend service.

```
src/app/[locale]/*        Server Components by default; pages fetch via lib/supabase/server
src/app/[locale]/(app)/   authenticated pages, wrapped in AppShell
src/lib/supabase/         client (browser) | server (RSC/actions) | admin (service role, server-only)
src/lib/billing/          money + invoice math — pure functions, unit tested
src/lib/reporting/        the ONLY place dashboards/reports read from
src/lib/rooms/            operational room queries; CAN return T01 when asked
src/config/floor-layout/  static SVG geometry (JSON) — no business data
src/proxy.ts              locale routing + Supabase session refresh
```

There is **no `src/app/layout.tsx`**. `src/app/[locale]/layout.tsx` is the root
layout and owns `<html>`/`<body>`; adding a layout above it breaks the locale
segment.

Request middleware lives in `src/proxy.ts` exporting `proxy()`. Next.js 16
renamed the `middleware.ts` convention and warns on the old name.

Three Supabase clients, and the distinction matters:

- `lib/supabase/client.ts` — browser, anon key, subject to RLS.
- `lib/supabase/server.ts` — RSC / Server Actions / Route Handlers, anon key + user cookie session, subject to RLS. **Default choice.**
- `lib/supabase/admin.ts` — service role, bypasses RLS. Imports `server-only`. Use for seeding and
  system jobs only. Never import from a Client Component.

## Non-obvious rules

These are the ones that will bite you. They are load-bearing.

### 1. Test data must never reach production reporting

The database holds **22 rooms**: 21 real + one mock room `T01`. Every reporting number the owner
sees must come from the 21.

- Every operational table carries `is_test boolean not null default false`.
- A DB trigger forces a child row's `is_test` to match its parent room, so it cannot drift.
- `T01` lives on **floor 0**. A CHECK constraint pins real rooms to floors 1–3 and test rooms to
  floor 0, so `T01` can never appear on a production floor plan.
- Reporting reads go through the `report_*` SQL views, which hard-filter `is_test = false`. Do not
  add a dashboard or report query against a base table — add it to a `report_*` view.
- `src/lib/reporting/` is the only module allowed to query reporting data. It has no code path that
  can include test rows.

There is a regression test for this (`src/lib/reporting/exclusion.test.ts`). If you touch schema,
seeds, or reporting, it must still pass. This is the single most important invariant in the codebase.

### 2. One tenant per room, occupants are a count

A room may house several people, but the system registers exactly **one** person, who is both main
tenant and contact person. Additional occupants are stored only as `contracts.occupant_count`
(which _includes_ the main tenant, so `occupant_count = 3` means the tenant plus two others).

Do not add `roommates`, `lease_tenants`, or `secondary_tenants` tables. Do not store personal data
for additional occupants.

### 3. Access cards belong to rooms, not people

Exactly two per room, named `<room>-A` and `<room>-B` (e.g. `201-A`, `201-B`). A trigger rejects a
third card for a room. Cards are never assigned to an individual. Every status change writes an
`access_card_events` row — mutate cards through `lib/access-cards/`, not raw updates, or you lose
the audit trail.

### 4. Financial math is server-side, always

Never let the browser decide a total.

- `meter_readings.usage` and `.amount` are **generated columns** (`current - previous`, `usage * rate`).
- `invoice_items.amount` is a generated column (`quantity * unit_price`).
- `invoices.subtotal` / `.total` are recomputed by a trigger from the items.
- A trigger blocks payments exceeding the invoice total and derives `paid` / `partially_paid`.

Client-side numbers are display only. `src/lib/billing/calc.ts` mirrors the SQL for previews and is
unit tested against it — if you change one, change both.

All money is `numeric(12,2)` in PG and handled as integer satang (`number` of 1/100 THB) in
`lib/billing/money.ts`. Do not do `+`/`*` on float baht.

### 5. Dates: Bangkok, not the server's timezone

Vercel runs UTC; users are UTC+7. A naive `new Date()` puts late-evening Bangkok actions on the
previous day and can bill the wrong month.

- Use `bangkokToday()` / `billingMonthOf()` from `src/lib/utils/date.ts`. Never bare `new Date()`
  for a business date.
- Contract dates and `billing_month` are PG `date` (calendar dates, no timezone). `billing_month`
  is always the **first day** of the month; a constraint enforces it.

### 6. Status values are language-neutral

DB enums stay English snake_case (`occupied`, `overdue`, `partially_paid`). Translate at the UI
layer only, via `next-intl`. Never store a Thai string as a status, and never key logic off a
translated label.

### 7. No hardcoded user-facing strings

Every visible string goes through `next-intl` (`src/messages/{th,en}.json`). Thai is the default
locale. Status colors are never the only signal — pair them with an icon and a text label.

### 8. Test Mode reuses real components

`/test` drives room `T01` through the _same_ components as real rooms (`RoomDetailPanel`,
`InvoiceView`, …). If you find yourself writing a mock-only variant of a component, that is a bug —
parameterize the real one instead. Scenarios live in `src/config/test-scenarios/`.

## Brand colors

Status colors come from the CP AXTRA / Lotus's palette, defined once as CSS variables in
`src/app/globals.css`. Use the semantic tokens, not raw hex.

| Token            | RGB          | Use                  |
| ---------------- | ------------ | -------------------- |
| `--brand-blue`   | 48, 111, 199 | primary, occupied    |
| `--brand-yellow` | 246, 194, 74 | warning, payment due |
| `--brand-green`  | 67, 147, 143 | success, paid        |
| `--brand-red`    | 218, 56, 50  | danger, overdue      |

## Floor plan geometry

`src/config/floor-layout/floor-{1,2,3}.json` currently hold **provisional** geometry
(`"provisional": true`) — the real dormitory plan has not been supplied yet. Room numbers
101–107 / 201–207 / 301–307 are an assumption (7 per floor × 3 = 21).

When the real plan arrives: edit only these JSON files, remapping `x/y/width/height/rotation` and
room numbers. No component change should be needed. Keep geometry out of the database — it is
static configuration, not business data.

## Out of scope for v1

Accounting/GL, AI chatbot, smart meters, physical access-control hardware, bank APIs, automatic
reconciliation, inventory, CRM, mobile app, multi-property. Keep module boundaries clean enough
that these can be added later, but do not build seams for them now.

## Cross-assistant consultation skills

The template ships read-only consultation skills that let each assistant get an independent second opinion from another. All shell out to locally installed, authenticated CLIs and stay **read-only** (no editing, commits, or secrets in prompts).

For **Claude Code** (under `.claude/skills/`) and **Antigravity / Gemini** (under `.gemini/skills/`):

- `.gemini/skills/consult-codex/scripts/consult-codex.sh "<request>"` — asks the OpenAI **Codex** CLI (`codex exec`, read-only sandbox, high reasoning). Prints Codex's final answer on stdout. See `.gemini/skills/consult-codex/SKILL.md` (or `.claude/skills/consult-codex/SKILL.md`).
- `.gemini/skills/consult-claude/scripts/consult-claude.sh "<request>"` — asks the **Claude Code** CLI (`claude -p`, read-only plan mode, high effort). Prints Claude's answer on stdout. See `.gemini/skills/consult-claude/SKILL.md`.
- `.claude/skills/consult-antigravity/scripts/consult-antigravity.sh "<request>"` — asks the **Antigravity** CLI (`agy`, Gemini models, plan/print mode). Prints Antigravity's answer on stdout. See `.claude/skills/consult-antigravity/SKILL.md`.

For the **Codex CLI** (under `.codex/skills/`, not read by Claude Code) — an orchestration system that routes tasks to other models:

- `.codex/skills/consult-claude/scripts/consult-claude.sh "<request>"` — runs `claude -p` in plan mode (`--model sonnet --effort high --max-turns 30`, JSON output).
- `.codex/skills/consult-antigravity/scripts/consult-antigravity.sh "<request>"` — runs the `agy` CLI in plan/print mode.

## Orchestration skills (Claude Code)

`.claude/skills/` also ships two skills that route work between Claude and the consult-* CLIs above. Claude Code should invoke them proactively when the trigger applies, not wait to be told:

- **`orchestrator`** — invoke when the user says the literal phrase "do think". Classifies the task, then routes: very complex/ambiguous/cross-cutting work stays with Claude itself; bounded complex work (focused review, implementation plan) goes to `consult-codex` for advice first; generic/simple work goes to `consult-antigravity` for advice first. Claude always does the actual implementation. See `.claude/skills/orchestrator/SKILL.md`.
- **`looping-engineer`** — invoke when the user asks to complete a goal end to end (or explicitly names the skill). Runs a full define-done → route-work → execute-until-verified → deliver loop, delegating only analysis/review to `consult-codex` or `consult-antigravity` while Claude remains the implementation owner. See `.claude/skills/looping-engineer/SKILL.md`.

Mirrors of both exist under `.gemini/skills/` (Antigravity as owner) and `.codex/skills/` (Codex as owner) for their respective CLIs.
