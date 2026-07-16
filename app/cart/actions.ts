"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { comboOf, cartComboDiscountCents, comboNudge, type ComboGroup } from "@/lib/pricing";
import type { SupabaseClient } from "@supabase/supabase-js";

const COOKIE = "cart_token";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

type Resolved = { db: SupabaseClient; cartId: string | null };

// Logged-in -> user client (RLS, keyed by customer_id).
// Guest -> admin client (RLS can't see anon carts), scoped by a cookie token.
async function resolveCart(create: boolean): Promise<Resolved> {
  const cookieStore = await cookies();
  const user_db = await createClient();
  const {
    data: { user },
  } = await user_db.auth.getUser();

  if (user) {
    let { data: cart } = await user_db
      .from("carts")
      .select("id")
      .eq("customer_id", user.id)
      .maybeSingle();
    if (!cart && create) {
      const { data } = await user_db
        .from("carts")
        .insert({ customer_id: user.id })
        .select("id")
        .single();
      cart = data;
    }
    return { db: user_db as unknown as SupabaseClient, cartId: cart?.id ?? null };
  }

  const admin = createAdminClient() as unknown as SupabaseClient;
  let token = cookieStore.get(COOKIE)?.value ?? null;
  let cart = token
    ? (await admin.from("carts").select("id").eq("session_token", token).maybeSingle()).data
    : null;

  if (!cart && create) {
    token = token ?? crypto.randomUUID();
    cookieStore.set(COOKIE, token, COOKIE_OPTS);
    const { data } = await admin
      .from("carts")
      .insert({ session_token: token })
      .select("id")
      .single();
    cart = data;
  }
  return { db: admin, cartId: cart?.id ?? null };
}

// returns null if the variant doesn't exist (e.g. stale page), 0+ if it does
async function availableQty(db: SupabaseClient, variantId: string): Promise<number | null> {
  const { data } = await db
    .from("variant_availability")
    .select("qty_available")
    .eq("variant_id", variantId)
    .maybeSingle();
  return data ? data.qty_available : null;
}

export async function addToCart(variantId: string, qty = 1) {
  const { db, cartId } = await resolveCart(true);
  if (!cartId) throw new Error("could not create cart");

  const avail = await availableQty(db, variantId);
  if (avail === null) throw new Error("variant not found (reload the page)");
  if (avail <= 0) throw new Error("out of stock");

  const { data: existing } = await db
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cartId)
    .eq("variant_id", variantId)
    .maybeSingle();

  const target = Math.min((existing?.quantity ?? 0) + qty, avail); // clamp to stock

  if (existing) {
    await db.from("cart_items").update({ quantity: target }).eq("id", existing.id);
  } else {
    await db.from("cart_items").insert({ cart_id: cartId, variant_id: variantId, quantity: target });
  }
  revalidatePath("/cart");
}

export async function updateCartItem(variantId: string, qty: number) {
  const { db, cartId } = await resolveCart(false);
  if (!cartId) return;
  if (qty <= 0) return removeFromCart(variantId);

  const avail = await availableQty(db, variantId);
  if (avail === null) return;
  await db
    .from("cart_items")
    .update({ quantity: Math.min(qty, avail) })
    .eq("cart_id", cartId)
    .eq("variant_id", variantId);
  revalidatePath("/cart");
}

export async function removeFromCart(variantId: string) {
  const { db, cartId } = await resolveCart(false);
  if (!cartId) return;
  await db.from("cart_items").delete().eq("cart_id", cartId).eq("variant_id", variantId);
  revalidatePath("/cart");
}

export type CartLine = {
  variantId: string;
  productId: string;
  productName: string;
  slug: string;
  label: string;
  color: string;
  image: string | null;
  unitPriceCents: number;
  quantity: number;
  qtyAvailable: number;
  lineTotalCents: number;
};

/** "Add N more of this model and save $X" — drives AOV using the combo price. */
export type ComboNudge = {
  productId: string;
  name: string;
  slug: string;
  needed: number;
  savingsCents: number;
};

export type CartSummary = {
  cartId: string | null;
  lines: CartLine[];
  subtotalCents: number;
  comboDiscountCents: number;
  totalCents: number;
  comboNudges: ComboNudge[];
};

export async function getCart(): Promise<CartSummary> {
  const { db, cartId } = await resolveCart(false);
  if (!cartId) return { cartId: null, lines: [], subtotalCents: 0, comboDiscountCents: 0, totalCents: 0, comboNudges: [] };

  const { data: items } = await db
    .from("cart_items")
    .select(
      "quantity, variant_id, " +
        "variants(sku, size_value, size_system, width, color, price_cents, " +
        "products(id, name, slug, base_price_cents, combo_min_qty, combo_price_cents, product_images(url, position)))",
    )
    .eq("cart_id", cartId);

  // supabase-js can't infer this deep embed; assert the shape we selected.
  type CartItemRow = {
    quantity: number;
    variant_id: string;
    variants: {
      size_system: string; size_value: string; width: string; color: string;
      price_cents: number | null;
      products: {
        id: string; name: string; slug: string; base_price_cents: number;
        combo_min_qty: number | null; combo_price_cents: number | null;
        product_images: { url: string; position: number }[];
      };
    };
  };
  const rows = (items ?? []) as unknown as CartItemRow[];

  const variantIds = rows.map((i) => i.variant_id);
  const { data: avail } = await db
    .from("variant_availability")
    .select("variant_id, qty_available")
    .in("variant_id", variantIds.length ? variantIds : ["00000000-0000-0000-0000-000000000000"]);
  const availMap = new Map((avail ?? []).map((a) => [a.variant_id, a.qty_available]));

  let subtotal = 0;
  const lines: CartLine[] = rows.map((it) => {
    const v = it.variants;
    const unit = v.price_cents ?? v.products.base_price_cents;
    const lineTotal = unit * it.quantity;
    subtotal += lineTotal;
    const img = [...(v.products.product_images ?? [])].sort((a, b) => a.position - b.position)[0];
    return {
      variantId: it.variant_id,
      productId: v.products.id,
      productName: v.products.name,
      slug: v.products.slug,
      label: `${v.size_system} ${v.size_value} / ${v.width} / ${v.color}`,
      color: v.color,
      image: img?.url ?? null,
      unitPriceCents: unit,
      quantity: it.quantity,
      qtyAvailable: availMap.get(it.variant_id) ?? 0,
      lineTotalCents: lineTotal,
    };
  });

  // combo discount, grouped per model (mirrors create_order in SQL)
  const groups = new Map<string, ComboGroup>();
  for (const it of rows) {
    const p = it.variants.products;
    const g = groups.get(p.id);
    if (g) g.qty += it.quantity;
    else groups.set(p.id, {
      productId: p.id,
      qty: it.quantity,
      baseCents: p.base_price_cents,
      combo: comboOf(p.combo_min_qty, p.combo_price_cents),
    });
  }
  const comboDiscount = cartComboDiscountCents([...groups.values()]);

  // AOV nudges: models one (or more) pairs away from a combo price
  const nudges: ComboNudge[] = [];
  for (const g of groups.values()) {
    const n = comboNudge(g.qty, g.baseCents, g.combo);
    if (!n) continue;
    const line = lines.find((l) => l.productId === g.productId);
    if (line) nudges.push({ productId: g.productId, name: line.productName, slug: line.slug, ...n });
  }

  return {
    cartId,
    lines,
    subtotalCents: subtotal,
    comboDiscountCents: comboDiscount,
    totalCents: subtotal - comboDiscount,
    comboNudges: nudges,
  };
}
