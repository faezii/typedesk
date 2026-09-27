# ProcureFlow (TypeDesk) — project guide

Business management app for a UAE translation & typing center. Built phase by phase (see the phase prompts); keep each phase shippable.

## Stack
- Next.js 16 (App Router, TypeScript, `proxy.ts` instead of `middleware.ts`), React 19
- Tailwind CSS v4 + shadcn/ui (radix-nova style, components in `components/ui`)
- PostgreSQL + Prisma 6 (`prisma/schema.prisma`, seed in `prisma/seed.ts`)
- Auth.js v5 (Credentials + bcryptjs), Zod, react-hook-form, TanStack Table, dnd-kit, Recharts, @react-pdf/renderer, xlsx (SheetJS CDN build), date-fns + @date-fns/tz

## Conventions
- **Currency**: AED. Money columns are `Decimal @db.Decimal(12,2)`. Never do money math in floats on the client for persisted values — totals are recomputed server-side.
- **VAT**: UAE 5%, read from `Setting` key `vatRate` (default `0.05`). Invoice = subtotal + VAT = total.
- **Timezone**: all "today / this week / this month" logic uses `Asia/Dubai`.
- **Numbering**: `Counter` table, atomic upsert-increment → `WO-2026-0001`, `INV-2026-0001`, `QT-2026-0001`.
- **Phones**: `+971` format (e.g. `+971 50 123 4567`). **Emirates ID**: `784-XXXX-XXXXXXX-X`.
- **Soft delete**: models with `deletedAt` are filtered with `deletedAt: null` in every query.
- **Audit**: status changes and important mutations write an `ActivityLog` row.
- Data access for pages lives in `server/queries/*`; mutations are server actions in `server/actions/*`. Every action: auth check → role check → Zod validation → mutation → `revalidatePath`.
- Work order revisions never reset status: a delivered order with an open revision stays `DELIVERED` with `hasOpenRevision = true`.

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
`admin@procureflow.ae` (ADMIN), `manager@procureflow.ae` (MANAGER), `finance@procureflow.ae` (FINANCE), `typist@procureflow.ae` and `translator@procureflow.ae` (STAFF).

## Commands
- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck`
- `npm run db:migrate` (dev migration) · `npm run db:seed` · `npm run db:reset` (drop, migrate, seed)
- Local Postgres: `docker compose up -d db`, or point `DATABASE_URL` at an existing server.
