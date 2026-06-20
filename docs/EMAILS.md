# Email program

All emails go through Resend. Two channels:

- **Transactional** — event-triggered, 1:1, no opt-in needed. Sent via `lib/email.ts`
  (`send-email` API). Branded + itemized.
- **Marketing / lifecycle** — bulk or behavioral, **requires opt-in + unsubscribe**.
  Use **Resend Audiences + Broadcasts** (handles contacts, unsubscribe, MX LFPDPPP).

Status legend: ✅ built · 🔜 build next · 🟡 needs a feature first (accounts/returns) · 📣 marketing

---

## 1. Transactional (core commerce)

| # | Email | Trigger | Status | Key content |
|---|-------|---------|--------|-------------|
| 1 | **Payment instructions** (OXXO/SPEI) | checkout, async method | ✅ `sendVoucherEmail` | barcode/CLABE, amount, expiry, items |
| 2 | **Order confirmed** | payment confirmed (card / webhook) | ✅ `sendPaidEmail` | items, totals, "made to order 3-5 días" |
| 3 | **Order shipped** | admin → fulfilled | ✅ `sendShippedEmail` | items, carrier/tracking |
| 4 | **Payment failed / declined** | Conekta `order.declined` / `charge.declined` | 🔜 | reason, retry link |
| 5 | **Order expired / canceled** | `expire_pending_orders` (unpaid OXXO/SPEI) | 🔜 | "voucher venció", re-order link |
| 6 | **Refund processed** | admin refund / return completed | 🔜 | amount, method, timeline |
| 7 | **Factura CFDI lista** | CFDI stamped (`stampOrderCfdi` success) | 🔜 | PDF + XML links/attachments |
| 8 | **Delivered** | manual / carrier callback | 🟡 optional | review nudge |

## 2. Returns / exchanges (Phase 4 — schema exists, flow not built)

| # | Email | Trigger | Status |
|---|-------|---------|--------|
| 9 | Return requested (received) | customer opens return | 🟡 |
| 10 | Return approved / label | admin approves | 🟡 |
| 11 | Exchange shipped | exchange variant ships | 🟡 |

## 3. Account / auth

| # | Email | Trigger | Status | Notes |
|---|-------|---------|--------|-------|
| 12 | **Welcome** | customer signup | 🟡 | needs customer accounts (deferred) |
| 13 | Verify email / magic link | signup / login | — | **Supabase Auth** sends these; configure in Supabase (can route via Resend SMTP) |
| 14 | Password reset | request | — | Supabase Auth |

> Auth emails (13/14) are owned by Supabase, not `lib/email.ts`. Brand them in
> Supabase → Auth → Email Templates, or point Supabase SMTP at Resend.

## 4. Lifecycle / retention (behavioral — opt-in)

| # | Email | Trigger | Status | Data we have |
|---|-------|---------|--------|--------------|
| 15 | **Abandoned checkout** (pago pendiente) | OXXO/SPEI unpaid 12h, cron `/api/cron/payment-reminders` | ✅ `sendPaymentReminderEmail` | recovers started-but-unpaid orders. True never-checked-out carts need email capture (not collected) |
| 16 | **Back in stock** | admin restocks a variant | 🔜 | `restock_subscriptions` table exists |
| 17 | **Review request** | fulfilled + 5 días (cron `/api/cron/review-requests`) | ✅ `sendReviewEmail` → `/resena/<token>` | verified-buyer reviews live |
| 18 | Win-back / "te extrañamos" | no order in 90d | 📣 | order history |

## 5. Marketing / broadcasts (Resend Audiences + Broadcasts)

| # | Email | Cadence | Status |
|---|-------|---------|--------|
| 19 | Newsletter welcome / double opt-in | on subscribe | 📣 |
| 20 | **Promociones / códigos de descuento** | ad-hoc | 📣 |
| 21 | **Ventas** (Hot Sale, El Buen Fin, Navidad) | seasonal MX | 📣 |
| 22 | Novedades / nuevos modelos | on drop | 📣 |
| 23 | Cumpleaños / aniversario | per-contact date | 📣 |

> Marketing 19-23 live in **Resend Broadcasts** (audience lists + built-in
> unsubscribe), not the transactional pipeline. Manage via the Resend dashboard
> or the `resend` MCP/CLI. Never send these without opt-in.

---

## Build priority

- **P0 (launch):** 1-3 ✅ done · **4** (payment failed), **7** (CFDI delivery) · auth 13/14 via Supabase.
- **P1:** 5 (expired), 6 (refund), 16 (back in stock), 17 (review request).
- **P2:** 15 (abandoned cart), marketing 19-23 via Broadcasts.
- **Phase 4:** 9-11 returns, with the returns flow.

## Implementation notes

- Transactional templates share the branded `shell()` in `lib/email.ts` — add new
  `sendXEmail` functions there; brand colors come from `activeBrand`.
- Consider **React Email** (`.tsx` templates) if templates grow — the `resend-cli`
  skill renders/sends them; keeps design in components.
- Per brand: each verifies its own sending domain + audience in Resend.
- Compliance: transactional = no opt-in; marketing = opt-in + unsubscribe (LFPDPPP/MX).
