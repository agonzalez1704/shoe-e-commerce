import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";

// Meta Commerce product feed, generated live from the DB. Meta re-fetches this on
// a schedule, so a sale (availability) or a product add/remove is reflected
// automatically — no Google Sheet to keep in sync.

// field-name header, exactly the columns Meta's template defines
const COLS = [
  "id","title","description","availability","condition","price","link","image_link","brand",
  "google_product_category","fb_product_category","quantity_to_sell_on_facebook","sale_price",
  "sale_price_effective_date","item_group_id","gender","color","size","age_group","material","pattern",
  "shipping","shipping_weight","offer_disclaimer","offer_disclaimer_url","video[0].url","video[0].tag[0]",
  "gtin","product_tags[0]","product_tags[1]","style[0]",
] as const;

function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function cell(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type Row = Partial<Record<(typeof COLS)[number], string | number>>;

export async function buildMetaCatalogCsv(): Promise<string> {
  const db = createAdminClient();

  const { data: products } = await db
    .from("products")
    .select("id, name, slug, description, base_price_cents, gender, made_to_order, brands(name)")
    .eq("status", "active")
    .order("name");

  const rows: string[] = [];

  for (const p of products ?? []) {
    const price = (p.base_price_cents / 100).toFixed(2);
    const gender = p.gender === "womens" ? "female" : p.gender === "mens" ? "male" : "unisex";
    const brand = (p.brands as { name?: string } | null)?.name ?? "Blade";

    const { data: variants } = await db
      .from("variants")
      .select("id, color, size_value")
      .eq("product_id", p.id)
      .eq("status", "active");
    if (!variants?.length) continue;

    // availability from the same view the storefront uses, so a sale that drops
    // stock to zero flips the feed to "out of stock" (made-to-order stays in stock)
    const ids = variants.map((v) => v.id);
    const { data: avail } = await db.from("variant_availability").select("variant_id, qty_available").in("variant_id", ids);
    const stock = new Map((avail ?? []).map((a) => [a.variant_id, a.qty_available]));

    const { data: images } = await db
      .from("product_images")
      .select("url, color, position")
      .eq("product_id", p.id)
      .order("position");

    const colors = [...new Set(variants.map((v) => v.color))];
    const sizes = [...new Set(variants.map((v) => v.size_value))].sort();

    for (const color of colors) {
      const inStock =
        p.made_to_order || variants.some((v) => v.color === color && (stock.get(v.id) ?? 0) > 0);
      const img =
        images?.find((i) => i.color === color)?.url ??
        images?.find((i) => i.color == null)?.url ??
        images?.[0]?.url ??
        "";

      const row: Row = {
        id: `${p.slug}__${slugify(color)}`,
        title: `${p.name} ${color} — Sneaker de piel`.slice(0, 200),
        description: p.description ?? `${p.name} en piel genuina. Hecho a mano en México.`,
        availability: inStock ? "in stock" : "out of stock",
        condition: "new",
        price: `${price} MXN`,
        link: `${SITE_URL}/products/${p.slug}?color=${encodeURIComponent(color)}`,
        image_link: img,
        brand,
        google_product_category: "Apparel & Accessories > Shoes",
        quantity_to_sell_on_facebook: p.made_to_order ? 100 : variants.filter((v) => v.color === color).reduce((n, v) => n + (stock.get(v.id) ?? 0), 0),
        item_group_id: p.slug,
        gender,
        color,
        size: `MX ${sizes[0]}-${sizes[sizes.length - 1]}`,
        age_group: "adult",
        material: "piel genuina",
        shipping: "MX::Envío gratis:0.00 MXN",
        shipping_weight: "1.2 kg",
        "product_tags[0]": p.name,
      };
      rows.push(COLS.map((c) => cell(row[c])).join(","));
    }
  }

  return [COLS.join(","), ...rows].join("\n") + "\n";
}
