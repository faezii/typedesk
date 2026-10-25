# TypeDesk — project guide

Business management app for a UAE translation & typing center. Built phase by phase (see the phase prompts); keep each phase shippable.

**Scope: work only inside this folder (`C:\Projects\TypeDesk`).** `C:\Projects\ProcureFlow` is a separate, unrelated project — never read, modify or delete it.

## Stack
- Next.js 16 (App Router, TypeScript, `proxy.ts` instead of `middleware.ts`), React 19
- Tailwind CSS v4 + shadcn/ui (radix-nova style, components in `components/ui`)
- PostgreSQL + Prisma 6 (`prisma/schema.prisma`, seed in `prisma/seed.ts`)
- Auth.js v5 (Credentials + bcryptjs), Zod, react-hook-form, TanStack Table, dnd-kit, Recharts, @react-pdf/renderer, xlsx (SheetJS CDN build), date-fns + @date-fns/tz

## Conventions
- **Currency**: AED. Money columns are `Decimal @db.Decimal(12,2)`. Never do money math in floats on the client for persisted values — totals are recomputed server-side.
- **VAT**: UAE 5%, read from `Setting` key `vatRate` (default `0.05`). Invoice = subtotal + VAT = total.
- **Timezone**: all "today / this week / this month" logic uses `Asia/Dubai` — use the helpers in `lib/dates.ts` (`startOfTodayDubai`, `monthsAgoDubai`, `formatDubai`, …) and `lib/format.ts` (`formatAED`, `formatDate`); enum display labels live in `lib/labels.ts`.
- **Charts**: series colors are `var(--chart-1..4)` (emerald, sky, amber, violet; validated for colour-blindness and contrast in both themes). Assign in that order, never by rank.
- **Numbering**: `Counter` table, atomic upsert-increment → `WO-2026-0001`, `INV-2026-0001`, `QT-2026-0001`. Use `nextNumber(tx, prefix)` from `lib/numbering.ts` inside the creating transaction.
- **Money math**: `lineTotal()` in `lib/money.ts` (exact `Prisma.Decimal`, half-up to fils) — server only. Client forms may show a display-only estimate. Shared money/quantity regex is `DECIMAL_RE` in `lib/validation/work-order.ts` (keep `@prisma/client` out of client bundles).
- **Work orders**: stage changes go through `moveWorkOrder(id, from, to)` (optimistic-concurrency on `from`, writes ActivityLog). Orders with an open revision can't change stage. Deadlines render with `DeadlineText` (`components/shared/work-order-badges.tsx`).
- **Phones**: `+971` format (e.g. `+971 50 123 4567`). **Emirates ID**: `784-XXXX-XXXXXXX-X`.
- **Soft delete**: models with `deletedAt` are filtered with `deletedAt: null` in every query.
- **Audit**: status changes and important mutations write an `ActivityLog` row.
- Data access for pages lives in `server/queries/*`; mutations are server actions in `server/actions/*`. Every action: auth check → role check → Zod validation → mutation → `revalidatePath`.
- Work order revisions never reset status: a delivered order with an open revision stays `DELIVERED` with `hasOpenRevision = true`.
- **Validation**: Zod schemas in `lib/validation/*` are shared by the client form (react-hook-form + `zodResolver`) and the server action. Actions return `ActionResult` (`lib/action-result.ts`). Phone/EID/TRN normalisers live in `lib/validation/uae.ts`.
- **Files**: upload through `lib/storage.ts` (10 MB; PDF/JPG/PNG/DOCX checked by magic bytes) and store the returned `fileUrl` on a `Document`. Files are served by `/api/files/...` only to signed-in users and only while the `Document` isn't soft-deleted.
- **Expiry follow-ups**: after changing a customer's passport/Emirates ID expiry, call `syncIdExpiryFollowUps` (`server/services/expiry-follow-ups.ts`). It keeps one follow-up per ID, keyed by `FollowUp.autoKey`, due 30 days before expiry.
- **Lists**: filters live in the URL (`components/shared/url-filters.tsx`) with server-side `Pagination`; status pills use `ToneBadge`, ID expiry uses `ExpiryBadge`.
- **Action guard**: new server actions start with `const { user, error } = await guardAction("perm")` (`lib/auth/session.ts`) and return `{ ok: false, error }` when `user` is missing.
- **Tasks**: STAFF see their own tasks by default (`?assignee=everyone` for the team) and may only change tasks assigned to them; task detail opens via `?task=<id>`.
- **Follow-ups**: overdue-invoice reminders come from `syncPaymentReminders()` (`server/services/payment-reminders.ts`, keyed `invoice:<id>:payment`), run on the follow-ups page and dashboard. Snooze = 7 days past the later of today and the deadline.
- **Accounts**: new users and password resets get a one-time temp password (`lib/passwords.ts`) and `mustChangePassword`, which shows a banner until they change it at `/account`. Only ADMIN may create/change/reset/deactivate admins; nobody can deactivate themselves, change their own role, or remove the last active admin.
- **Outsourcing**: `setPaymentStatus` books exactly one FREELANCER `Expense` per job (unique `Expense.outsourcedWorkId`) and removes it on reversal; a paid job's cost can't change. Vendor deliveries are `Document`s linked to the work order and the job (`Document.outsourcedWorkId`). Margin = order amount − agreed cost (`jobMargin` in `lib/money.ts`).
- **Tests**: Vitest (`npm test`), files named `*.test.ts` next to the code.
- **Migrations**: `prisma migrate dev` refuses to run non-interactively. Generate SQL with `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` into a new `prisma/migrations/<timestamp>_<name>/migration.sql` (UTF-8, no BOM), then `prisma migrate deploy`.

## Auth & layout
- `auth.config.ts` — proxy-safe Auth.js config (JWT session with `id/role/department`, `authorized` callback does route gating). `auth.ts` adds the Credentials provider (bcrypt, per-email lockout). `proxy.ts` runs it on every request.
- `lib/auth/permissions.ts` is the single source of role rules (`can(role, perm)`, route → permission map). Update it, not individual pages.
- `lib/auth/session.ts`: `requirePagePermission()` in pages (redirects to `/login` or `/forbidden`), `requirePermission()` in server actions (throws). Both re-read the user from the DB, so deactivation applies immediately.
- App pages live under `app/(app)/` inside `AppShell` (sidebar nav from `lib/nav.ts`, filtered by role). Sections not built yet are `[[...slug]]` placeholder pages — delete the placeholder when building the real route.

## Roles & permissions
| Area | ADMIN | MANAGER | FINANCE | STAFF |
|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ (own-scope KPIs) |
| Work orders / Translation / Tasks / Follow-ups | ✓ | ✓ | view | ✓ (tasks: own by default) |
| Outsourced work & vendors | ✓ | ✓ | view + payment status | — |
| Customers / Documents / Services (view) | ✓ | ✓ | ✓ | ✓ |
| Services (edit) | ✓ | ✓ | — | — |
| Employees | ✓ | ✓ (no role changes to ADMIN) | — | — |
| Invoices, Quotes, Payments, Expenses | ✓ | ✓ | ✓ | — |
| Profit & Loss, Reports | ✓ | ✓ | ✓ | — |
| Settings | ✓ | — | — | — |

## Seed logins
All seeded users use password `Password123!` (development only):
`admin@typedesk.ae` (ADMIN), `manager@typedesk.ae` (MANAGER), `finance@typedesk.ae` (FINANCE), `typist@typedesk.ae` and `translator@typedesk.ae` (STAFF).

## Commands
- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test`
- `npm run db:migrate` (dev migration) · `npm run db:seed` · `npm run db:reset` (drop, migrate, seed)
- Local Postgres: `docker compose up -d db`, or point `DATABASE_URL` at an existing server.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
