"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { comboOf, cartComboDiscountCents, poolNudge, type ComboPool } from "@/lib/pricing";
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

/** "Add N more from the combo and save $X" — drives AOV using the pool price. */
export type ComboNudge = {
  href: string;
  needed: number;
  savingsCents: number;
};

/** Quick-add card for a combo model when a pool is one pair away. */
export type ComboSuggestion = { slug: string; name: string; priceCents: number; image: string | null };

export type CartSummary = {
  cartId: string | null;
  lines: CartLine[];
  subtotalCents: number;
  comboDiscountCents: number;
  totalCents: number;
  comboNudges: ComboNudge[];
  comboSuggestions: ComboSuggestion[];
};

export async function getCart(): Promise<CartSummary> {
  const { db, cartId } = await resolveCart(false);
  if (!cartId) return { cartId: null, lines: [], subtotalCents: 0, comboDiscountCents: 0, totalCents: 0, comboNudges: [], comboSuggestions: [] };

  const { data: items } = await db
    .from("cart_items")
    .select(
      "quantity, variant_id, " +
        "variants(sku, size_value, size_system, width, color, price_cents, " +
        "products(id, name, slug, base_price_cents, combo_min_qty, combo_price_cents, combo_group, product_images(url, position)))",
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
        combo_min_qty: number | null; combo_price_cents: number | null; combo_group: string | null;
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

  // combo POOL: products sharing combo_group pool together (mix models).
  // Collect each pool's config + individual unit prices (mirrors create_order).
  const pools = new Map<string, ComboPool & { minPrice: number }>();
  for (const it of rows) {
    const p = it.variants.products;
    const combo = comboOf(p.combo_min_qty, p.combo_price_cents);
    if (!p.combo_group || !combo) continue;
    const unit = it.variants.price_cents ?? p.base_price_cents;
    const pool = pools.get(p.combo_group);
    const units = Array(it.quantity).fill(unit);
    if (pool) { pool.unitPrices.push(...units); pool.minPrice = Math.min(pool.minPrice, unit); }
    else pools.set(p.combo_group, { group: p.combo_group, combo, unitPrices: units, minPrice: unit });
  }
  const poolList = [...pools.values()];
  const comboDiscount = cartComboDiscountCents(poolList);

  // AOV nudge: pool one unit away from another pair
  const nudges: ComboNudge[] = [];
  const groupsNeeding = new Set<string>();
  for (const pool of poolList) {
    const n = poolNudge(pool.unitPrices, pool.combo, pool.minPrice);
    if (n) { nudges.push({ href: "/products", ...n }); groupsNeeding.add(pool.group); }
  }

  // quick-add cards: the combo models for pools that are one pair short
  let comboSuggestions: ComboSuggestion[] = [];
  if (groupsNeeding.size) {
    const { data: sug } = await db
      .from("products")
      .select("name, slug, base_price_cents, product_images(url, position)")
      .in("combo_group", [...groupsNeeding])
      .eq("status", "active");
    type Sug = { name: string; slug: string; base_price_cents: number; product_images: { url: string; position: number }[] };
    comboSuggestions = ((sug ?? []) as unknown as Sug[]).map((p) => ({
      slug: p.slug,
      name: p.name,
      priceCents: p.base_price_cents,
      image: [...(p.product_images ?? [])].sort((a, b) => a.position - b.position)[0]?.url ?? null,
    }));
  }

  return {
    cartId,
    lines,
    subtotalCents: subtotal,
    comboDiscountCents: comboDiscount,
    totalCents: subtotal - comboDiscount,
    comboNudges: nudges,
    comboSuggestions,
  };
}
