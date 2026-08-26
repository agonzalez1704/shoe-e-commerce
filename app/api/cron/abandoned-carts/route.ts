import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAbandonedCartEmail, sendAbandonedCart2Email } from "@/lib/email";
import { SITE_URL } from "@/lib/site";

const HOURS_AFTER = 4;
const HOURS_SEGUNDO = 44; // ~48h después del abandono (corre cada hora)
const BATCH = 50;

// Recuperación de carrito. Alcanza a dos poblaciones:
//  - usuarios con cuenta (correo del customer), y
//  - invitados cuyo correo capturó el checkout al escribirlo (carts.contact_email)
//    — el 96% de los carritos abandonados eran de invitados inalcanzables.
// Dos toques máximo por carrito: recordatorio a las 4h y un segundo a las ~48h
// con código de 10%. Nunca a quien ya compró después de abandonar.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff1 = new Date(Date.now() - HOURS_AFTER * 3600_000).toISOString();
  const cutoff2 = new Date(Date.now() - HOURS_SEGUNDO * 3600_000).toISOString();

  // Todo carrito con items, correo conocido y algún toque pendiente.
  const { data: items, error } = await admin
    .from("cart_items")
    .select(
      "quantity, cart:carts!inner(id, customer_id, contact_email, abandoned_email_sent_at, abandoned_email2_sent_at, updated_at, customer:customers(email, full_name)), " +
        "variant:variants(price_cents, product:products(name, base_price_cents))",
    )
    .lt("cart.updated_at", cutoff1)
    .is("cart.abandoned_email2_sent_at", null)
    .limit(800);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    quantity: number;
    cart: {
      id: string; customer_id: string | null; contact_email: string | null;
      abandoned_email_sent_at: string | null; abandoned_email2_sent_at: string | null; updated_at: string;
      customer: { email: string; full_name: string | null } | null;
    };
    variant: { price_cents: number | null; product: { name: string; base_price_cents: number } };
  };

  type Candidato = {
    email: string; name: string | null; updatedAt: string;
    primerToque: string | null; // abandoned_email_sent_at
    lines: { name: string; quantity: number; lineTotalCents: number }[];
  };
  const carts = new Map<string, Candidato>();
  for (const r of (items ?? []) as unknown as Row[]) {
    const email = r.cart.customer?.email ?? r.cart.contact_email;
    if (!email) continue; // invitado que nunca llegó al checkout: inalcanzable
    const c = carts.get(r.cart.id) ?? {
      email,
      name: r.cart.customer?.full_name ?? null,
      updatedAt: r.cart.updated_at,
      primerToque: r.cart.abandoned_email_sent_at,
      lines: [],
    };
    const unit = r.variant.price_cents ?? r.variant.product.base_price_cents;
    c.lines.push({ name: r.variant.product.name, quantity: r.quantity, lineTotalCents: unit * r.quantity });
    carts.set(r.cart.id, c);
  }

  // Quien ya compró después de abandonar no recibe nada: el recordatorio de un
  // carrito viejo después de pagar lee como spam y quema la confianza.
  const emails = [...new Set([...carts.values()].map((c) => c.email))];
  const yaCompraron = new Set<string>();
  if (emails.length) {
    const desde = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const { data: pedidos } = await admin
      .from("orders").select("email, created_at").in("email", emails).gte("created_at", desde);
    for (const [id, c] of carts) {
      if ((pedidos ?? []).some((p) => p.email === c.email && p.created_at > c.updatedAt)) {
        yaCompraron.add(id);
      }
    }
  }

  let primeros = 0, segundos = 0;
  for (const [cartId, c] of [...carts].slice(0, BATCH)) {
    if (yaCompraron.has(cartId)) continue;
    if (!c.primerToque) {
      await sendAbandonedCartEmail({ to: c.email, name: c.name ?? undefined, lines: c.lines, cartUrl: `${SITE_URL}/cart` });
      await admin.from("carts").update({ abandoned_email_sent_at: new Date().toISOString() }).eq("id", cartId);
      primeros++;
    } else if (c.primerToque < cutoff2) {
      await sendAbandonedCart2Email({ to: c.email, name: c.name ?? undefined, lines: c.lines, cartUrl: `${SITE_URL}/cart` });
      await admin.from("carts").update({ abandoned_email2_sent_at: new Date().toISOString() }).eq("id", cartId);
      segundos++;
    }
  }
  return NextResponse.json({ primeros, segundos });
}
