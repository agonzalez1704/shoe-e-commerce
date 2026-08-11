import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ProductFilters = {
  brand?: string;   // brand slug
  gender?: string;
  color?: string;
  sort?: "newest" | "price_asc" | "price_desc";
};

// One card PER variant colour (limited inventory → each colour sold as its own
// listing). Links to the product detail with that colour preselected.
export type ProductCard = {
  key: string;              // product id + colour
  name: string;
  slug: string;
  color: string | null;     // the specific variant colour
  base_price_cents: number;
  brand: string | null;
  image: string | null;
  imageAlt: string | null;  // that colour's 2nd image (hover crossfade)
  comboMinQty: number | null;
  comboPriceCents: number | null;
  promoPercent: number | null;  // active promo %, or null
};

// Active promo % per product id, for the storefront to render sale prices.
// Applies to every product (combos included); when combo units pair up, the
// combo price reprices them instead. Mirrors promo_percent() + create_order (0037).
export async function getPromoMap(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("promocion_productos")
    .select("product_id, promociones!inner(percent, active, starts_at, ends_at)")
    .eq("promociones.active", true)
    .lte("promociones.starts_at", now)
    .gt("promociones.ends_at", now);
  const m = new Map<string, number>();
  for (const r of (data ?? []) as unknown as { product_id: string; promociones: { percent: number } | null }[]) {
    const pct = r.promociones?.percent ?? 0;
    if (pct > 0 && pct > (m.get(r.product_id) ?? 0)) m.set(r.product_id, pct);
  }
  return m;
}

// Expand a product row into one card per active variant colour.
function toVariantCards(
  p: {
    id: string; name: string; slug: string; base_price_cents: number;
    combo_min_qty?: number | null; combo_price_cents?: number | null;
    brands: { name: string } | null;
    product_images: { url: string; position: number; color: string | null }[];
    variants: { color: string | null; status: string; price_cents?: number | null }[];
  },
  promoPct: number | null = null,
): ProductCard[] {
  const imgs = [...(p.product_images ?? [])].sort((a, b) => a.position - b.position);
  const brand = p.brands?.name ?? null;
  const colors: string[] = [];
  for (const v of p.variants ?? []) {
    if (v.status === "active" && v.color && !colors.includes(v.color)) colors.push(v.color);
  }
  // effective price for a colour = that colour's variant override, else base
  const priceOf = (c: string) =>
    p.variants?.find((v) => v.status === "active" && v.color === c && v.price_cents != null)?.price_cents
    ?? p.base_price_cents;
  const common = {
    name: p.name, slug: p.slug, brand,
    comboMinQty: p.combo_min_qty ?? null, comboPriceCents: p.combo_price_cents ?? null,
    promoPercent: promoPct,
  };

  if (colors.length === 0) {
    return [{ key: p.id, color: null, base_price_cents: p.base_price_cents, image: imgs[0]?.url ?? null, imageAlt: imgs[1]?.url ?? null, ...common }];
  }
  return colors.map((c) => {
    const ci = imgs.filter((i) => i.color === c);
    const use = ci.length ? ci : imgs; // fall back to all images if none tagged
    return { key: `${p.id}:${c}`, color: c, base_price_cents: priceOf(c), image: use[0]?.url ?? null, imageAlt: use[1]?.url ?? null, ...common };
  });
}

// PLP: active products, optional filters. RLS already hides non-active.
export async function listProducts(filters: ProductFilters = {}): Promise<ProductCard[]> {
  const supabase = await createClient();

  let q = supabase
    .from("products")
    .select("id, name, slug, base_price_cents, combo_min_qty, combo_price_cents, gender, brands(name, slug), product_images(url, position, color), variants(color, status, price_cents)")
    .eq("status", "active");

  if (filters.gender) q = q.eq("gender", filters.gender);
  if (filters.brand) q = q.eq("brands.slug", filters.brand);

  switch (filters.sort) {
    case "price_asc": q = q.order("base_price_cents", { ascending: true }); break;
    case "price_desc": q = q.order("base_price_cents", { ascending: false }); break;
    default: q = q.order("created_at", { ascending: false });
  }

  const { data, error } = await q;
  if (error) throw error;

  const promo = await getPromoMap();
  return (data ?? []).flatMap((p) => {
    const row = p as Parameters<typeof toVariantCards>[0];
    return toVariantCards(row, promo.get(row.id) ?? null);
  });
}

// Cross-sell: other active models (one card per model, not per colourway).
export async function listRelatedProducts(excludeSlug: string, limit = 4): Promise<ProductCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, base_price_cents, combo_min_qty, combo_price_cents, brands(name), product_images(url, position, color), variants(color, status, price_cents)")
    .eq("status", "active")
    .neq("slug", excludeSlug)
    .order("created_at", { ascending: false });
  if (error) throw error;

  type Row = Parameters<typeof toVariantCards>[0];
  const promo = await getPromoMap();
  const cards = ((data ?? []) as unknown as Row[]).flatMap((p) => toVariantCards(p, promo.get(p.id) ?? null));
  // one card per model
  const bySlug = new Map<string, ProductCard>();
  for (const c of cards) if (!bySlug.has(c.slug)) bySlug.set(c.slug, c);
  return [...bySlug.values()].slice(0, limit);
}

// Best sellers for the storefront. The ranking comes from top_sellers(), a
// SECURITY DEFINER function that returns product ids and nothing else — orders
// stay behind RLS and the volumes stay private.
//
// Returns [] when there is not enough history (a brand-new store has none), so
// the caller can hide the section rather than label the newest arrivals as
// best sellers.
export async function listBestSellers(limit = 8, minimum = 3): Promise<ProductCard[]> {
  const supabase = await createClient();
  const { data: top, error } = await supabase.rpc("top_sellers", { p_limit: limit });
  if (error || !top?.length) return [];

  const ids = (top as { product_id: string }[]).map((t) => t.product_id);
  if (ids.length < minimum) return [];

  const { data } = await supabase
    .from("products")
    .select("id, name, slug, base_price_cents, combo_min_qty, combo_price_cents, brands(name), product_images(url, position, color), variants(color, status, price_cents)")
    .in("id", ids)
    .eq("status", "active");

  type Row = Parameters<typeof toVariantCards>[0];
  const promo = await getPromoMap();
  const byId = new Map<string, Row>(((data ?? []) as unknown as Row[]).map((p) => [p.id, p]));
  // one card per model, in the ranking's order — `in` does not preserve it
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is Row => !!p)
    .map((p) => toVariantCards(p, promo.get(p.id) ?? null)[0])
    .filter(Boolean);
}

// Hand-picked shelf, used only when there is no sales history to rank. Kept
// separate from listBestSellers so the heading can differ: what the storefront
// claims always matches where the list came from.
export async function listFeatured(limit = 8): Promise<ProductCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, slug, base_price_cents, combo_min_qty, combo_price_cents, brands(name), product_images(url, position, color), variants(color, status, price_cents)")
    .eq("status", "active")
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  type Row = Parameters<typeof toVariantCards>[0];
  const promo = await getPromoMap();
  return ((data ?? []) as unknown as Row[])
    .map((p) => toVariantCards(p, promo.get(p.id) ?? null)[0])
    .filter(Boolean);
}

export type Category = { id: string; name: string; slug: string; description: string | null };

export type CategoryLink = { name: string; slug: string; count: number };

// Categories that actually have something to show, most-stocked first.
//
// The footer used to link /categoria/running|casual|trail, hardcoded. Those
// three 404 on calzadoblade.com right now — the store has no categories at all
// — and would have 404'd on every future brand too. Reading the real list is
// the fix; patching the three hrefs would only move the problem to brand four.
//
// A category with no active products is dropped rather than linked to an empty
// page, so the count doubles as the filter. Cached per request like
// getCategory, since the header and the footer both call this.
export const listCategories = cache(async (): Promise<CategoryLink[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("name, slug, product_categories(products!inner(id))")
    .eq("product_categories.products.status", "active");
  if (error) throw error;

  type Row = { name: string; slug: string; product_categories: unknown[] | null };
  return ((data ?? []) as Row[])
    .map((c) => ({ name: c.name, slug: c.slug, count: c.product_categories?.length ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
});

export const getCategory = cache(async (slug: string): Promise<Category | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, description")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Category) ?? null;
});

// Products in a category (M:N via product_categories), mapped like listProducts.
export async function listProductsByCategory(slug: string): Promise<ProductCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, base_price_cents, combo_min_qty, combo_price_cents, brands(name), product_images(url, position, color), variants(color, status, price_cents), " +
        "product_categories!inner(categories!inner(slug))",
    )
    .eq("status", "active")
    .eq("product_categories.categories.slug", slug)
    .order("created_at", { ascending: false });
  if (error) throw error;

  type Row = Parameters<typeof toVariantCards>[0];
  const promo = await getPromoMap();
  return ((data ?? []) as unknown as Row[]).flatMap((p) => toVariantCards(p, promo.get(p.id) ?? null));
}

export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price_cents: number;
  brand: string | null;
  images: { url: string; alt: string | null; color: string | null }[];
  // Used to pick the brand's per-category feature blocks. One asset set covers
  // all 40 scooters, which is a request a client can actually fill — unlike one
  // bespoke set per model.
  categorySlugs: string[];
  variants: {
    id: string;
    sku: string;
    // null on products that don't come in sizes (a scooter, a helmet). The
    // picker reads this to decide whether there is anything to pick at all.
    size_value: string | null;
    size_system: string | null;
    width: string | null;
    color: string;
    price_cents: number | null;
    qty_available: number;
  }[];
  made_to_order: boolean;
  comboMinQty: number | null;
  comboPriceCents: number | null;
  promoPercent: number | null;
  // free-form specs, per category — empty on products that have none
  attributes: Record<string, string | number | boolean>;
};

// PDP: one product by slug, with variants joined to live availability.
// Cached per-request so generateMetadata + the page share one fetch.
export const getProduct = cache(async (slug: string): Promise<ProductDetail | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, description, base_price_cents, made_to_order, combo_min_qty, combo_price_cents, attributes, " +
        "brands(name), " +
        "product_images(url, alt, color, position), " +
        "product_categories(categories(slug)), " +
        "variants(id, sku, size_value, size_system, width, color, price_cents, status)",
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // supabase-js can't infer deeply-nested embeds; assert the shape we selected.
  type ProductRow = {
    id: string; name: string; slug: string; description: string | null; base_price_cents: number;
    made_to_order: boolean; combo_min_qty: number | null; combo_price_cents: number | null;
    attributes: Record<string, string | number | boolean> | null;
    brands: { name: string } | null;
    product_images: { url: string; alt: string | null; color: string | null; position: number }[];
    product_categories: { categories: { slug: string } | null }[] | null;
    variants: {
      id: string; sku: string; size_value: string | null; size_system: string | null;
      width: string | null; color: string; price_cents: number | null; status: string;
    }[];
  };
  const p = data as unknown as ProductRow;

  const activeVariants = (p.variants ?? []).filter((v) => v.status === "active");
  const ids = activeVariants.map((v) => v.id);

  // availability from the public view (no raw on_hand/reserved leak)
  const { data: avail } = await supabase
    .from("variant_availability")
    .select("variant_id, qty_available")
    .in("variant_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  const availMap = new Map((avail ?? []).map((a) => [a.variant_id, a.qty_available]));

  // Active promo % via the SQL helper (all products) — single source of truth.
  const { data: pct } = await supabase.rpc("promo_percent", { p_product_id: p.id });
  const promoPercent = typeof pct === "number" && pct > 0 ? pct : null;

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    base_price_cents: p.base_price_cents,
    brand: p.brands?.name ?? null,
    images: [...(p.product_images ?? [])]
      .sort((a, b) => a.position - b.position)
      .map(({ url, alt, color }) => ({ url, alt, color })),
    categorySlugs: (p.product_categories ?? []).map((c) => c.categories?.slug).filter(Boolean) as string[],
    variants: activeVariants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size_value: v.size_value,
      size_system: v.size_system,
      width: v.width,
      color: v.color,
      price_cents: v.price_cents,
      qty_available: availMap.get(v.id) ?? 0,
    })),
    made_to_order: p.made_to_order,
    comboMinQty: p.combo_min_qty,
    comboPriceCents: p.combo_price_cents,
    promoPercent,
    attributes: p.attributes ?? {},
  };
});
