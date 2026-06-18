import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/ProductForm";
import type { ProductInput } from "@/app/admin/product-actions";

export const dynamic = "force-dynamic";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: brands }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, slug, brand_id, description, gender, base_price_cents, status, made_to_order, " +
          "product_images(url, color, position), " +
          "variants(id, size_value, size_system, width, color, sku, price_cents, inventory(qty_on_hand))",
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
    product_images: { url: string; color: string | null; position: number }[];
    variants: {
      id: string; size_value: string; size_system: "US" | "EU" | "UK"; width: "narrow" | "medium" | "wide";
      color: string; sku: string; price_cents: number | null; inventory: { qty_on_hand: number } | null;
    }[];
  };
  const p = product as unknown as Raw;

  const initial: ProductInput = {
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand_id: p.brand_id,
    description: p.description,
    gender: p.gender,
    base_price_cents: p.base_price_cents,
    status: p.status,
    made_to_order: p.made_to_order,
    images: [...p.product_images].sort((a, b) => a.position - b.position).map((i) => ({ url: i.url, color: i.color })),
    variants: p.variants.map((v) => ({
      id: v.id,
      size_value: v.size_value,
      size_system: v.size_system,
      width: v.width,
      color: v.color,
      sku: v.sku,
      price_cents: v.price_cents,
      qty_on_hand: v.inventory?.qty_on_hand ?? 0,
    })),
  };

  return (
    <div className="space-y-6">
      <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <CaretLeft size={14} /> Productos
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">Editar: {p.name}</h1>
      <ProductForm brands={brands ?? []} initial={initial} />
    </div>
  );
}
