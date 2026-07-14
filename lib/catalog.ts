import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ProductFilters = {
  brand?: string;   // brand slug
  gender?: string;
  color?: string;
  sort?: "newest" | "price_asc" | "price_desc";
};

export type ProductCard = {
  id: string;
  name: string;
  slug: string;
  base_price_cents: number;
  brand: string | null;
  image: string | null;
  imageAlt: string | null;          // 2nd image of the default color (hover crossfade)
  colors: string[];                 // distinct variant colors
  colorImages: Record<string, string>; // color -> first image for that color
};

// PLP: active products, optional filters. RLS already hides non-active.
export async function listProducts(filters: ProductFilters = {}): Promise<ProductCard[]> {
  const supabase = await createClient();

  let q = supabase
    .from("products")
    .select("id, name, slug, base_price_cents, gender, brands(name, slug), product_images(url, position, color), variants(color, status)")
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

  return (data ?? []).map((p) => {
    const imgs = [...(p.product_images ?? [])].sort((a, b) => a.position - b.position);
    // distinct colors from active variants, in first-seen order
    const colors: string[] = [];
    for (const v of p.variants ?? []) {
      if (v.status === "active" && v.color && !colors.includes(v.color)) colors.push(v.color);
    }
    // first image per color (fallback: default first image)
    const colorImages: Record<string, string> = {};
    for (const c of colors) {
      const match = imgs.find((i) => i.color === c);
      if (match) colorImages[c] = match.url;
    }
    // default view = first color's images (portada + an alt for hover crossfade)
    const firstColor = colors[0];
    const firstImgs = firstColor ? imgs.filter((i) => i.color === firstColor || i.color == null) : imgs;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      base_price_cents: p.base_price_cents,
      brand: p.brands?.name ?? null,
      image: firstImgs[0]?.url ?? imgs[0]?.url ?? null,
      imageAlt: firstImgs[1]?.url ?? null,
      colors,
      colorImages,
    };
  });
}

export type Category = { id: string; name: string; slug: string; description: string | null };

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
      "id, name, slug, base_price_cents, brands(name), product_images(url, position, color), variants(color, status), " +
        "product_categories!inner(categories!inner(slug))",
    )
    .eq("status", "active")
    .eq("product_categories.categories.slug", slug)
    .order("created_at", { ascending: false });
  if (error) throw error;

  type Row = {
    id: string; name: string; slug: string; base_price_cents: number;
    brands: { name: string } | null;
    product_images: { url: string; position: number; color: string | null }[];
    variants: { color: string | null; status: string }[];
  };
  return ((data ?? []) as unknown as Row[]).map((p) => {
    const imgs = [...(p.product_images ?? [])].sort((a, b) => a.position - b.position);
    const colors: string[] = [];
    for (const v of p.variants ?? []) {
      if (v.status === "active" && v.color && !colors.includes(v.color)) colors.push(v.color);
    }
    const colorImages: Record<string, string> = {};
    for (const c of colors) {
      const match = imgs.find((i) => i.color === c);
      if (match) colorImages[c] = match.url;
    }
    const firstColor = colors[0];
    const firstImgs = firstColor ? imgs.filter((i) => i.color === firstColor || i.color == null) : imgs;
    return {
      id: p.id, name: p.name, slug: p.slug, base_price_cents: p.base_price_cents,
      brand: p.brands?.name ?? null, image: firstImgs[0]?.url ?? imgs[0]?.url ?? null,
      imageAlt: firstImgs[1]?.url ?? null,
      colors, colorImages,
    };
  });
}

export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  base_price_cents: number;
  brand: string | null;
  images: { url: string; alt: string | null; color: string | null }[];
  variants: {
    id: string;
    sku: string;
    size_value: string;
    size_system: string;
    width: string;
    color: string;
    price_cents: number | null;
    qty_available: number;
  }[];
  made_to_order: boolean;
};

// PDP: one product by slug, with variants joined to live availability.
// Cached per-request so generateMetadata + the page share one fetch.
export const getProduct = cache(async (slug: string): Promise<ProductDetail | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, description, base_price_cents, made_to_order, " +
        "brands(name), " +
        "product_images(url, alt, color, position), " +
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
    made_to_order: boolean;
    brands: { name: string } | null;
    product_images: { url: string; alt: string | null; color: string | null; position: number }[];
    variants: {
      id: string; sku: string; size_value: string; size_system: string;
      width: string; color: string; price_cents: number | null; status: string;
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
  };
});
