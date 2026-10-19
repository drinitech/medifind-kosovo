# MediFind Kosovo

A platform for finding medicines in Kosovo pharmacies: search for a medicine, see which **verified** pharmacies **report** it as available, where they are, and when their inventory was last updated.

> MediFind shows availability **as reported by pharmacies**. It is not confirmed real-time stock — the UI always says *"Disponueshmëria e raportuar — kontakto farmacinë për konfirmim."* and flags outdated reports.

The UI is in Albanian. Code, API and database identifiers are in English.

## Architecture

```
apps/
  api/   NestJS 11 REST API · Prisma 7 · PostgreSQL · JWT (HttpOnly cookie) · Swagger · BullMQ (optional)
  web/   Next.js 16 (App Router, Cache Components) · Tailwind v4 · shadcn/ui (Radix) · Leaflet/OpenStreetMap
docker-compose.yml   local PostgreSQL (+ optional Redis)
```

- The browser only talks to the Next.js origin. `next.config.ts` proxies `/api/v1/*` to `API_URL`, so the session cookie is first-party (`HttpOnly`, `SameSite=Lax`, `Secure` in production) and no API URL is exposed to the client.
- **Every permission is enforced in the API.** A global `JwtAuthGuard` (routes are protected unless marked `@Public()`) re-loads the user on every request, so deactivations take effect immediately. `RolesGuard` checks roles, and `PharmacyAccessService` is the only place that decides whether an account may act on a pharmacy. The web app's route checks and `proxy.ts` only affect what is displayed.
- **Distance search** uses a bounding-box pre-filter plus Haversine in SQL (`/pharmacies/nearby`) or in memory for a medicine's availability, which is bounded by the number of pharmacies. This works on any PostgreSQL. PostGIS is not required; the Docker image includes it in case you want to adopt it later.
- **Search** is case- and accent-insensitive (`ë`→`e`, `ç`→`c`) over normalized columns with `pg_trgm` GIN indexes. Every word must match the name, active ingredient or strength. Results are ranked exact match, then prefix, then similarity. Medicines with a different strength, form or package are separate products.
- **Background jobs:** inventory changes that make a medicine available again become "availability events". With `REDIS_URL` set they go through a BullMQ queue (the job id is the event id); without Redis they run in-process. The matcher is idempotent: one notification per (alert, event), enforced by a unique `dedupeKey`, plus a 12-hour cooldown per alert and pharmacy so flapping stock doesn't spam users.

### Roles

| Role | Can |
|---|---|
| Public (no account) | Search, view availability, pharmacies and the map |
| `USER` | + create, view and deactivate availability alerts; in-app notifications |
| `PHARMACY_MANAGER` | + register their pharmacy (hidden until verified), manage inventory (add/edit/deactivate, bulk, CSV/XLSX import with preview), see history, edit profile — **only for pharmacies they are a member of** |
| `ADMIN` | + dashboard statistics and freshness, verify and deactivate pharmacies, grant or revoke manager access, catalog management, user roles and deactivation, inventory review, audit log |

Administrator accounts cannot be self-registered.

## Local development

Requirements: Node 22+ (tested on 24), pnpm 11, and Docker (or any PostgreSQL 14+ with the `pg_trgm` extension available).

```bash
pnpm install                                   # also runs `prisma generate`
docker compose up -d postgres                  # PostgreSQL on :5432 (creates medifind + medifind_test)

cp apps/api/.env.example apps/api/.env         # then set JWT_SECRET (see the comment in the file)
cp apps/web/.env.example apps/web/.env.local

pnpm db:deploy                                 # apply migrations (use `pnpm db:migrate` when changing the schema)
pnpm db:seed                                   # FICTIONAL demo data + demo accounts (prints generated passwords)

pnpm dev                                       # API on :4000, web on :3000
```

- Web: http://localhost:3000
- API docs (Swagger): http://localhost:4000/api/docs (OpenAPI JSON at `/api/docs-json`)
- Health check: http://localhost:4000/api/v1/health

Optional Redis for BullMQ: `docker compose --profile redis up -d`, then set `REDIS_URL=redis://localhost:6379` in `apps/api/.env`.

### Demo data

`pnpm db:seed` creates 22 catalog entries (generic names, codes `DEMO-0001…`), 9 **fictional** pharmacies flagged `isDemo` (named "Farmacia Demo …", with placeholder addresses and non-dialable `+383 00 000 …` numbers, one left unverified), about 130 inventory entries with a mix of fresh, aging and stale reports, and a sample alert and notification. The UI marks demo pharmacies with a **Demo** badge. None of it is real pharmacy information.

Demo accounts come from `SEED_*` variables. Leave a password empty and the seed generates one and prints it once. The seed refuses to run when `NODE_ENV=production`.

## Tests

```bash
pnpm --filter api test        # API unit tests (Jest): availability rules, freshness, import parsing and validation, ownership, alert matching
pnpm --filter api test:e2e    # API end-to-end tests (Jest + Supertest) against a real PostgreSQL
pnpm --filter web test        # web unit tests (Vitest)
pnpm --filter web test:e2e    # browser journeys (Playwright) against a running stack with seeded data
```

The API e2e suite needs `apps/api/.env.test` (copy `.env.test.example`) pointing at a **disposable** database. It applies migrations, then truncates every table. It refuses to run if that URL equals `DATABASE_URL`. The suite covers auth and cookies, role checks, cross-pharmacy isolation, search and filters, quantity privacy, stale labelling, distance and radius, inventory CRUD and duplicate prevention, CSV/XLSX import (preview, row errors, duplicate rows, double-confirm, file type and size limits), alert triggering and de-duplication, admin flows, and the error envelope.

Playwright uses your installed Chrome (`channel: "chrome"`). To use the bundled Chromium instead, run `pnpm exec playwright install chromium` and set `PW_CHANNEL=""`.

Other checks: `pnpm lint`, `pnpm typecheck`, `pnpm build`.

## API overview

All routes are under `/api/v1`. Successful responses are `{ "data": … }`; paginated data is `{ items, meta: { page, pageSize, total, totalPages } }`. Errors are `{ "error": { statusCode, code, message, details? } }`.

| Area | Endpoints |
|---|---|
| Auth | `POST auth/register` · `POST auth/login` · `POST auth/logout` · `GET auth/me` |
| Medicines | `GET medicines` · `GET medicines/suggestions` · `GET medicines/:id` · `GET medicines/:id/availability` |
| Pharmacies | `GET pharmacies` · `GET pharmacies/cities` · `GET pharmacies/nearby` · `GET pharmacies/:idOrSlug` · `GET pharmacies/:id/inventory` |
| Pharmacy (manager) | `GET/POST/PATCH pharmacy/profile` |
| Inventory (manager) | `GET/POST pharmacy/inventory` · `GET pharmacy/inventory/stats` · `PATCH/DELETE pharmacy/inventory/:id` · `POST pharmacy/inventory/bulk-update` · `GET pharmacy/inventory/history` · `POST pharmacy/inventory/import/preview` · `POST pharmacy/inventory/import/confirm` · `GET pharmacy/inventory/import/batches` |
| Alerts | `POST/GET alerts` · `PATCH alerts/:id` |
| Notifications | `GET notifications` · `PATCH notifications/:id/read` · `PATCH notifications/read-all` |
| Admin | `GET admin/dashboard` · `GET/POST admin/medicines` · `PATCH admin/medicines/:id` · `GET admin/pharmacies` · `PATCH admin/pharmacies/:id` · `PATCH admin/pharmacies/:id/verify` · `POST/DELETE admin/pharmacies/:id/members[/:userId]` · `GET admin/users` · `PATCH admin/users/:id` · `GET admin/inventory` · `PATCH admin/inventory/:id` · `GET admin/inventory-history` · `GET admin/audit-logs` |

Managers of several pharmacies (and admins) pass `?pharmacyId=` to pharmacy-scoped endpoints.

### Inventory import format

CSV (comma, semicolon or tab separated; UTF-8) or `.xlsx` (first sheet), up to 2 MB and 5,000 rows. Header names are case- and accent-insensitive, and Albanian aliases are accepted. Template: `apps/web/public/templates/inventari-shembull.csv`.

| Column | Required | Notes |
|---|---|---|
| `medicine_code` (`kodi`) | one identifier | Catalog code — recommended |
| `medicine_id` | one identifier | Internal id |
| `medicine_name` + `strength` + `dosage_form` | one identifier | Must match exactly one catalog product |
| `quantity` (`sasia`) | quantity or status | Whole number ≥ 0; derives the status when none is given (0 = out, 1–5 = low) |
| `availability_status` (`statusi`) | quantity or status | `IN_STOCK`/`LOW_STOCK`/`OUT_OF_STOCK`/`UNKNOWN` or "në stok", "pak", "nuk ka", "panjohur" |
| `show_quantity_publicly` | no | po/jo, yes/no, true/false |

Preview stores the validated rows server-side as an import batch that expires after 30 minutes. Confirm sends only the batch id, so the rows can't be altered between preview and commit. The batch is applied in a single transaction with set-based SQL and can be confirmed only once. Invalid rows are reported and never silently dropped.

**Future integrations:** every inventory write goes through `applyInventoryChanges()` (`apps/api/src/inventory/inventory-writer.ts`) with an `InventorySource` (`MANUAL`, `IMPORT`, `API`, `SCHEDULED_IMPORT`). An authenticated pharmacy-system API or a scheduled import from an authorized source can reuse it and get history, auditing and alerts for free. No scraping and no assumed pharmacy APIs.

## Security and privacy notes

- Passwords are hashed with Argon2id. Login responses are generic, with timing equalized for unknown emails.
- DTO validation with `whitelist` and `forbidNonWhitelisted` (mass-assignment protection). Parameterized SQL only. LIKE wildcards are escaped.
- Rate limits: 10/min on login and register, 60/min on public search endpoints, 300/min otherwise. `TRUST_PROXY` must match your proxy chain.
- Helmet headers, a 100 kB JSON body limit, and upload checks on type, extension, magic bytes, size and row count.
- Environment variables are validated at boot with zod. There are no default secrets. Production refuses `THROTTLE_DISABLED`.
- The audit log covers registration, user changes, pharmacy create, update, verify and deactivate, membership changes, catalog changes, inventory changes and imports.
- **Privacy:** searches are never stored or linked to accounts. Accounts store only name, email, role and the alerts the user creates (medicine plus an optional city or radius), and no medical history. Quantities are public only when the pharmacy opts in.
- **Email:** notifications are in-app. No email provider is configured, so nothing claims an email was sent. Adding one belongs in `NotificationsService.notify()`.

## Production deployment

1. Provision PostgreSQL (for example Neon or RDS). Use the pooled URL as `DATABASE_URL` and the direct URL as `DIRECT_DATABASE_URL`, then run `pnpm db:deploy`. **Do not run the seed in production.**
2. API: `pnpm --filter api build && node apps/api/dist/main.js` with `NODE_ENV=production`, a strong `JWT_SECRET`, `CORS_ORIGINS`/`WEB_APP_URL` set to the web origin, and optionally `REDIS_URL`. Swagger is disabled in production unless `SWAGGER_ENABLED=true`.
3. Web: `pnpm --filter web build && pnpm --filter web start` (or deploy `apps/web` to Vercel) with `API_URL` pointing at the API. Because the browser only talks to the web origin, cookies are `Secure` and `SameSite=Lax` and no cross-site cookie setup is needed.
4. Create the first administrator by registering normally, then promoting that account once in the database, for example `UPDATE "User" SET role='ADMIN' WHERE email='…';`. After that, manage roles from `/admin/users`.

## Known limitations

- The medicine catalog contains only demo entries. A real deployment needs an import from an authoritative source, such as the national medicines registry.
- Address search uses the public OpenStreetMap Nominatim service (submit-only, bounded to Kosovo) and map tiles come from tile.openstreetmap.org. A high-traffic deployment should use its own or a commercial geocoder and tile provider.
- Opening hours and prices are deliberately not modelled or shown.
- Editing a catalog medicine cannot clear an optional field back to empty (empty values are ignored on update).
- Email and SMS notification channels are not implemented. The service boundary exists.
