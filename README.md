# TypeDesk

Business management for a translation & typing center in Qatar: customers and their ID documents, work orders (Kanban + table), the translation pipeline, tasks and follow-ups, outsourced work, invoices and quotations (VAT-ready, 0% while Qatar has none), payments, expenses, profit & loss, and exportable reports. Money is in QAR, all dates run on Asia/Qatar (Doha) time.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 + shadcn/ui · PostgreSQL + Prisma 6 · Auth.js v5 · Zod · Vitest.
Coding conventions and the role/permission table live in [CLAUDE.md](CLAUDE.md).

## Use it day to day (this PC + cloud data)

Double-click **`typedesk.cmd`** in the project folder. It starts TypeDesk on this PC (port 3000) if it isn't running, and opens it in its own window. The first start, and the first start after the code changes, builds the app first (about a minute).

- **Data** lives in the Neon cloud database set as `DATABASE_URL` in `.env` (project *typedesk.procuregcc.com*, Singapore). Restarting or replacing this PC loses nothing, and Neon keeps a 6-hour restore window.
- **Uploaded scans** are stored on this PC in `uploads/`. Back that folder up, or set the `S3_*` variables to keep them in the cloud too.
- **Other office PCs** can open `http://<this-pc-name>:3000` while this PC is on. Allow Node.js through Windows Firewall when Windows asks the first time.
- **Stop** TypeDesk by closing the minimised *TypeDesk server* window.
- **First admin** was created with `npm run create-admin -- <email> "<name>"`; use the same command to reset a forgotten admin password.

## Run it locally (development)

Needs Node.js 20.9+ and PostgreSQL 15+ (Docker is easiest). Use a separate database for development: `npm run db:seed` and `npm run db:reset` wipe everything. The seed refuses to run against a non-local database unless `ALLOW_REMOTE_SEED=1` is set.

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
| admin@typedesk.qa | Admin: everything, including Settings |
| manager@typedesk.qa | Manager: everything except Settings |
| finance@typedesk.qa | Finance: invoices, payments, expenses, reports; operations read-only |
| typist@typedesk.qa, translator@typedesk.qa | Staff: work orders, tasks, follow-ups, customers, documents |

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `AUTH_SECRET` | yes | Signs session cookies. Generate with `npx auth secret` and keep it secret; changing it signs everyone out. |
| `UPLOAD_DIR` | no | Folder for uploaded files when no bucket is configured (default `./uploads`) |
| `S3_BUCKET` | no | Store files in an S3-compatible bucket instead of on disk. **Required on Vercel.** |
| `APP_URL` | for email | Public address used in emailed links, e.g. `https://typedesk.procuregcc.com` |
| `RESEND_API_KEY` | for email | [Resend](https://resend.com) key for forgot-password emails. Without it, production asks users to contact their administrator; development prints emails to the console. |
| `EMAIL_FROM` | for email | Sender, e.g. `TypeDesk <no-reply@procuregcc.com>` (domain verified in Resend) |
| `S3_ENDPOINT` | with bucket | R2: `https://<account-id>.r2.cloudflarestorage.com` · AWS: `https://s3.<region>.amazonaws.com` · MinIO: its URL |
| `S3_REGION` | with bucket | `auto` for R2, the bucket's region for AWS (e.g. `me-central-1`) |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | with bucket | A key limited to read/write on that bucket |

Company name, CR / tax number, address, phone, email, logo, VAT rate and invoice terms are not env vars: an admin edits them under **Settings**.

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
   Or use **Neon Object Storage** in the same Neon project: create a private bucket and a credential with `storage:read` + `storage:write` on the branch; `S3_ENDPOINT` is the branch's storage endpoint, `S3_REGION` its AWS region (e.g. `ap-southeast-1`), `S3_ACCESS_KEY_ID` the `token_id` and `S3_SECRET_ACCESS_KEY` the `s3_secret_access_key`. (The live typedesk.procuregcc.com site uses this, bucket `typedesk-files`.)
   Uploads are capped at 4 MB because Vercel functions reject request bodies over 4.5 MB.

4. **Vercel.** Import the Git repository (framework preset: Next.js; the default build command runs `prisma generate && next build`). Under *Settings → Environment Variables* add `DATABASE_URL` (pooled), `AUTH_SECRET`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION=auto`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and for forgot-password emails `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`. Deploy.

5. **First sign-in.** Sign in with the admin and one-time password, choose a new password, then fill in **Settings** (company details, CR / tax number, logo, VAT rate — leave at 0 — and invoice terms), add your **Services** and price list, and create **Employees** (each gets a one-time password).

**Later releases** that add a migration: run step 2's `prisma migrate deploy` (direct connection) before the new version goes live.

**A demo site** instead of a real one: after step 2, run `npm run db:seed` with the direct `DATABASE_URL`, `ALLOW_REMOTE_SEED=1` and the `S3_*` variables set, so the sample documents land in the bucket.

## Tests

`npm test` covers money and VAT maths, invoice status, document numbering, permissions and navigation, validation (Qatar phone, QID, tax number, dates), report exports and S3 request signing.
