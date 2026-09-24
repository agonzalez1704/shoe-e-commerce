import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { getPromoMap } from "@/lib/catalog";
import { promoDe } from "@/lib/pricing";
import type { ProductInput } from "@/app/admin/product-actions";

// Ruta bloqueante a proposito: dinamica de punta a punta (sesion/pago); un
// shell prerenderizado no aporta aqui.
export const instant = false;


export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: brands }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, slug, brand_id, description, gender, base_price_cents, status, made_to_order, featured, attributes, combo_group, " +
          "product_images(url, color, position), " +
          "variants(id, size_value, size_system, width, color, sku, price_cents, status, fuera_de_combo, inventory(qty_on_hand))",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("brands").select("id, name").order("name"),
  ]);

  if (!product) notFound();

  type Raw = {
    id: string; name: string; slug: string; brand_id: string | null; description: string | null;
    gender: string | null; base_price_cents: number; status: "draft" | "active" | "archived";
    made_to_order: boolean;
    featured: boolean;
    combo_group: string | null;
    attributes: Record<string, string | number | boolean> | null;
    product_images: { url: string; color: string | null; position: number }[];
    variants: {
      id: string; size_value: string; size_system: "MX" | "US" | "EU" | "UK"; width: "narrow" | "medium" | "wide";
      color: string; sku: string; price_cents: number | null; status: string; fuera_de_combo: boolean;
      inventory: { qty_on_hand: number } | null;
    }[];
  };
  const p = product as unknown as Raw;

  // % de promo por color, del mismo mapa que usa la tienda (0065).
  const promos = (await getPromoMap()).get(p.id);
  const promoPorColor: Record<string, number> = {};
  for (const c of new Set(p.variants.map((v) => v.color))) {
    const pct = promoDe(promos, c);
    if (pct) promoPorColor[c] = pct;
  }

  const initial: ProductInput = {
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand_id: p.brand_id,
    description: p.description,
    gender: p.gender,
    base_price_cents: p.base_price_cents,
    status: p.status,
    attributes: Object.fromEntries(
      Object.entries(p.attributes ?? {}).map(([k, v]) => [k, String(v)]),
    ),
    made_to_order: p.made_to_order,
    featured: p.featured,
    images: [...p.product_images].sort((a, b) => a.position - b.position).map((i) => ({ url: i.url, color: i.color })),
    // ordenadas por color y luego por talla: el editor las agrupa por color
    variants: [...p.variants]
      .sort((a, b) => a.color.localeCompare(b.color, "es") || Number(a.size_value) - Number(b.size_value))
      .map((v) => ({
        id: v.id,
        size_value: v.size_value,
        size_system: v.size_system,
        width: v.width,
        color: v.color,
        sku: v.sku,
        price_cents: v.price_cents,
        qty_on_hand: v.inventory?.qty_on_hand ?? 0,
        fuera_de_combo: v.fuera_de_combo,
        activo: v.status === "active",
      })),
  };

  return (
    <ProductEditor
      brands={brands ?? []}
      initial={initial}
      promoPorColor={promoPorColor}
      comboGroup={p.combo_group}
    />
  );
}
