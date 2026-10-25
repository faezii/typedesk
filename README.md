# TypeDesk

Business management for a UAE translation & typing center: customers and their ID documents, work orders (Kanban + table), the translation pipeline, tasks and follow-ups, outsourced work, invoices and quotations with 5% VAT, payments, expenses, profit & loss, and exportable reports. Money is in AED, all dates run on Asia/Dubai time.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 + shadcn/ui · PostgreSQL + Prisma 6 · Auth.js v5 · Zod · Vitest.
Coding conventions and the role/permission table live in [CLAUDE.md](CLAUDE.md).

## Run it locally

Needs Node.js 20.9+ and PostgreSQL 15+ (Docker is easiest).

```bash
npm install
cp .env.example .env          # then set AUTH_SECRET: npx auth secret
npm run db:up                 # Postgres in Docker (or point DATABASE_URL at your own server)
npm run db:deploy             # create the tables
npm run db:seed               # demo data + the logins below (wipes the database first)
npm run dev                   # http://localhost:3000
```

### Demo logins (seed only)

Every seeded user has the password `Password123!`.

| Email | Role |
| --- | --- |
| admin@typedesk.ae | Admin: everything, including Settings |
| manager@typedesk.ae | Manager: everything except Settings |
| finance@typedesk.ae | Finance: invoices, payments, expenses, reports; operations read-only |
| typist@typedesk.ae, translator@typedesk.ae | Staff: work orders, tasks, follow-ups, customers, documents |

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` | yes | Signs session cookies. Generate with `npx auth secret` and keep it secret; changing it signs everyone out. |
| `UPLOAD_DIR` | no | Folder for uploaded files when no bucket is configured (default `./uploads`) |
| `S3_BUCKET` | no | Store files in an S3-compatible bucket instead of on disk. **Required on Vercel.** |
| `S3_ENDPOINT` | with bucket | R2: `https://<account-id>.r2.cloudflarestorage.com` · AWS: `https://s3.<region>.amazonaws.com` · MinIO: its URL |
| `S3_REGION` | with bucket | `auto` for R2, the bucket's region for AWS (e.g. `me-central-1`) |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | with bucket | A key limited to read/write on that bucket |

Company name, TRN, address, phone, email, logo, VAT rate and invoice terms are not env vars: an admin edits them under **Settings**.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build, serve the production build |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run db:deploy` | Apply migrations (safe on production) |
| `npm run db:migrate` | Create a new migration while developing |
| `npm run db:seed` | **Deletes all data** and loads demo data |
| `npm run db:reset` | Drop, migrate and seed (development only) |
| `npm run create-admin -- <email> "<name>"` | Create (or reset) an admin and print a one-time password |

## Deploy: Vercel + Neon (or Supabase) + Cloudflare R2

Vercel functions have no persistent disk, so uploads must go to a bucket.

1. **Database.** Create a Neon project in the region closest to your Vercel functions. Copy two connection strings:
   - the **pooled** one (host contains `-pooler`): add `&pgbouncer=true` to it. This is the app's `DATABASE_URL`.
   - the **direct** one: used only to run migrations.

   On **Supabase** use the *Transaction pooler* string (port 6543, add `?pgbouncer=true`) for the app and the *direct* / session string (port 5432) for migrations.

2. **Tables and first admin.** From your machine, using the direct connection string:

   ```bash
   DATABASE_URL="<direct connection string>" npx prisma migrate deploy
   DATABASE_URL="<direct connection string>" npm run create-admin -- owner@yourcentre.ae "Your Name"
   ```

   (PowerShell: `$env:DATABASE_URL="<direct connection string>"; npx prisma migrate deploy`.) Note the one-time password it prints.
   Don't run `db:seed` against a production database: it deletes everything first.

3. **File storage.** In Cloudflare, create an R2 bucket (keep it private) and an R2 API token with *Object Read & Write* on that bucket. You need the account ID, access key ID and secret.

4. **Vercel.** Import the Git repository (framework preset: Next.js; the default build command runs `prisma generate && next build`). Under *Settings → Environment Variables* add `DATABASE_URL` (pooled), `AUTH_SECRET`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION=auto`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Deploy.

5. **First sign-in.** Sign in with the admin and one-time password, choose a new password, then fill in **Settings** (company details, TRN, logo, VAT rate, invoice terms), add your **Services** and price list, and create **Employees** (each gets a one-time password).

**Later releases** that add a migration: run step 2's `prisma migrate deploy` (direct connection) before the new version goes live.

**A demo site** instead of a real one: after step 2, run `npm run db:seed` with the direct `DATABASE_URL` and the `S3_*` variables set, so the sample documents land in the bucket.

## Tests

`npm test` covers money and VAT maths, invoice status, document numbering, permissions and navigation, validation (UAE phone, Emirates ID, TRN, dates), report exports and S3 request signing.
