# Deploy runbook (per brand)

One codebase, one deployment per brand. Each brand = its own Supabase project +
Vercel project + domain + env. Repeat this checklist for every brand
(`soleco`, `altura`, `vellora`, …). Brand identity itself lives in
[`lib/brand.ts`](lib/brand.ts) and is selected by `NEXT_PUBLIC_BRAND`.

---

## 0. One-time, local

```bash
npm i -g supabase        # or brew install supabase/tap/supabase
pnpm install
```

---

## 1. Supabase project (per brand)

1. Create a project at supabase.com → note the **project ref**, **URL**, **anon key**, **service_role key** (Settings → API).
2. Link + push all migrations (creates schema, RLS, RPCs, storage bucket, cron jobs):

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push                      # applies supabase/migrations/* to the remote
```

3. (Optional) seed demo catalog — **skip for a real launch**, the client adds products via admin:

```bash
psql "<REMOTE_DB_URL>" -f supabase/seed.sql      # REMOTE_DB_URL from Settings → Database
```

4. Confirm `pg_cron` jobs exist (expire-pending-orders, cleanup-rate-limits):

```sql
select jobname, schedule from cron.job;
```

5. Create the admin user:
   - Auth → Users → Add user (email + password), copy the user id.
   - SQL editor: `insert into admin_users (user_id) values ('<USER_ID>');`

> Storage bucket `product-images` is created by migration 0009. The client uploads
> real product photos through the admin UI (Productos → Editar → Imágenes).

---

## 2. Vercel project (per brand)

1. New Vercel project → import this repo. Framework: Next.js (auto). pnpm (auto from `packageManager`).
2. Add a custom domain (e.g. `soleco.mx`).
3. Set Environment Variables (Production):

| Var | Value |
|-----|-------|
| `NEXT_PUBLIC_BRAND` | `soleco` (the brand key) |
| `NEXT_PUBLIC_SITE_URL` | `https://soleco.mx` |
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase (server-only) |
| `CONEKTA_PRIVATE_KEY` | Conekta live key |
| `NEXT_PUBLIC_CONEKTA_PUBLIC_KEY` | Conekta public key |
| `CONEKTA_WEBHOOK_SECRET` | long random string |
| `RESEND_API_KEY` | from Resend |
| `EMAIL_FROM` | optional (brand config has a default) |
| `PAC_BASE_URL` / `PAC_API_USER` / `PAC_API_PASSWORD` / `PAC_EXPEDITION_ZIP` | Facturama, if CFDI at launch |

4. Deploy.

> **Scheduled jobs:**
> - `expire_pending_orders` — pure SQL, runs via `pg_cron` (migration 0007). No setup.
> - `/api/cron/review-requests` — sends review emails ~5 days post-fulfillment; needs an
>   **HTTP** scheduler (sends mail, can't be pure SQL). Point a daily cron at
>   `https://<domain>/api/cron/review-requests` with header `Authorization: Bearer <CRON_SECRET>`.
>   Use Supabase `pg_cron` + `pg_net` (`net.http_get`), an external cron (cron-job.org), or a GitHub Action.
> - `/api/cron/payment-reminders` — abandoned-checkout nudge (pending OXXO/SPEI, ~12h). Same HTTP-scheduler setup as review-requests; run hourly.
> - `/api/cron/expire-orders` — optional HTTP twin of the pg_cron job (manual/uptime).

---

## 3. Payment + email + invoicing config (per brand)

- **Conekta**
  - Generate the webhook secret: `openssl rand -hex 32` → set as `CONEKTA_WEBHOOK_SECRET` (Vercel env) and use the **same** value in the URL below.
  - Dashboard → Webhooks → add `https://<domain>/api/webhooks/conekta?secret=<CONEKTA_WEBHOOK_SECRET>`.
  - Events to enable:
    - **`order.paid`** — REQUIRED. Confirms card (post-3DS), OXXO, and SPEI payments → commits the order.
    - `order.expired`, `order.canceled` — optional (reflect Conekta-side cancellations; otherwise the pg_cron expiry handles it).
    - Do NOT rely on `charge.paid` — its payload is the charge, not the order, so our handler (keyed by order id) ignores it.
  - Use **live** keys (`CONEKTA_PRIVATE_KEY` + `NEXT_PUBLIC_CONEKTA_PUBLIC_KEY`) in prod; per brand = its own Conekta account + secret.
  - Webhook auth is the URL secret + a server-side re-fetch of the order from Conekta (spoof-proof). Conekta also signs with a `DIGEST` header; verifying it is optional defense-in-depth, not implemented.
- **Resend** — verify the sending domain (SPF/DKIM DNS) so `EMAIL_FROM` delivers.
- **Facturama** (if CFDI) — load CSD certs, configure issuer, then validate one stamp against sandbox before going live (`lib/cfdi.ts` field mapping).

---

## 4. SEO go-live (per brand)

- Google Search Console → verify domain → submit `https://<domain>/sitemap.xml`.
- Rich Results Test on a product URL (Product + Breadcrumb schema should pass).
- Confirm `robots.txt` shows the right host + sitemap.

---

## 5. Smoke test (per brand)

- [ ] Storefront loads, brand name + colors correct (light + dark).
- [ ] Add to cart → checkout → **card** test pays, order flips to `paid`, email arrives.
- [ ] **OXXO/SPEI** → voucher/CLABE shown + emailed; webhook confirms on payment.
- [ ] Admin login (`/login`) → dashboard, products CRUD, inventory, order status.
- [ ] Pending order past expiry → cron cancels + releases (or call `/api/cron/expire-orders`).

---

## Adding a new brand

1. Copy a preset block in `lib/brand.ts`, set name + colors + email + (optional) logo.
2. Run sections 1–5 above with the new brand key + its own Supabase/Vercel/domain.

No other code changes.
