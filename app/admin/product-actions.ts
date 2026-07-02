"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin-guard";
import { startAngleGeneration, getAngleSet, confirmAngleSet } from "@/lib/autotoon";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type VariantInput = {
  id?: string;
  size_value: string;
  size_system: "MX" | "US" | "EU" | "UK";
  width: "narrow" | "medium" | "wide";
  color: string;
  sku: string;
  price_cents: number | null;
  qty_on_hand: number;
};

export type ProductImageInput = { url: string; color: string | null };

export type ProductInput = {
  id?: string;
  name: string;
  slug: string;
  brand_id: string | null;
  description: string | null;
  gender: string | null;
  base_price_cents: number;
  status: "draft" | "active" | "archived";
  made_to_order: boolean;
  images: ProductImageInput[];
  variants: VariantInput[];
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function writeImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  images: ProductImageInput[],
) {
  await supabase.from("product_images").delete().eq("product_id", productId);
  const clean = images.filter((i) => i.url.trim());
  if (clean.length) {
    await supabase.from("product_images").insert(
      clean.map((img, position) => ({
        product_id: productId,
        url: img.url.trim(),
        color: img.color,
        position,
      })),
    );
  }
}

async function writeVariants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  variants: VariantInput[],
) {
  // delete variants removed in the form (FKs: order_items set null, cart_items cascade)
  // sanitize ids to UUIDs — they're interpolated into the PostgREST `in` filter
  const keepIds = variants.map((v) => v.id).filter((id): id is string => !!id && UUID_RE.test(id));
  let del = supabase.from("variants").delete().eq("product_id", productId);
  if (keepIds.length) del = del.not("id", "in", `(${keepIds.join(",")})`);
  await del;

  for (const v of variants) {
    const row = {
      product_id: productId,
      sku: v.sku,
      size_value: v.size_value,
      size_system: v.size_system,
      width: v.width,
      color: v.color,
      price_cents: v.price_cents,
      status: "active" as const,
    };

    let variantId = v.id;
    if (variantId) {
      const { error } = await supabase.from("variants").update(row).eq("id", variantId);
      if (error) throw new Error(`variante ${v.sku}: ${error.message}`);
    } else {
      const { data, error } = await supabase.from("variants").insert(row).select("id").single();
      if (error) throw new Error(`variante ${v.sku}: ${error.message}`);
      variantId = data!.id;
    }

    // upsert inventory (keep reserved as-is on existing rows)
    const { error: invErr } = await supabase
      .from("inventory")
      .upsert({ variant_id: variantId, qty_on_hand: Math.max(0, Math.floor(v.qty_on_hand)) }, { onConflict: "variant_id" });
    if (invErr) throw new Error(`inventario ${v.sku}: ${invErr.message}`);
  }
}

export async function saveProduct(input: ProductInput): Promise<{ error: string } | void> {
  const supabase = await requireAdmin();
  const slug = (input.slug || slugify(input.name)).trim();
  if (!input.name.trim()) return { error: "El nombre es obligatorio" };
  if (input.variants.length === 0) return { error: "Agrega al menos una variante" };

  const fields = {
    name: input.name.trim(),
    slug,
    brand_id: input.brand_id,
    description: input.description,
    gender: input.gender,
    base_price_cents: input.base_price_cents,
    status: input.status,
    made_to_order: input.made_to_order,
  };

  try {
    let productId = input.id;
    if (productId) {
      const { error } = await supabase.from("products").update(fields).eq("id", productId);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase.from("products").insert(fields).select("id").single();
      if (error) throw new Error(error.message.includes("duplicate") ? "El slug ya existe" : error.message);
      productId = data!.id;
    }

    await writeVariants(supabase, productId, input.variants);
    await writeImages(supabase, productId, input.images);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al guardar" };
  }

  revalidatePath("/admin/products");
  redirect("/admin/products");
}

// Auto-toon generation is slow (each image ~60-90s), so it's split so the
// browser drives the waiting and every server action stays well under the
// function timeout. 1) startProductAngles kicks it off. 2) the client polls
// pollProductAngles until "ready" (auto-approving the hero along the way).

export async function startProductAngles(
  sourceImageUrl: string,
  productName: string,
): Promise<{ angleSetId: string } | { error: string }> {
  await requireAdmin();
  try {
    const angleSetId = await startAngleGeneration(sourceImageUrl, productName || "producto");
    return { angleSetId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al iniciar la generación" };
  }
}

// re-host toon's images into our own bucket so they survive + serve from us
async function rehost(urls: string[]): Promise<string[]> {
  const admin = createAdminClient();
  const out: string[] = [];
  for (const url of urls) {
    const res = await fetch(url);
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const path = `ai/${crypto.randomUUID()}.${ext}`;
    const { error } = await admin.storage.from("product-images").upload(path, buf, { contentType: ct });
    if (error) continue;
    out.push(admin.storage.from("product-images").getPublicUrl(path).data.publicUrl);
  }
  return out;
}

export type AnglePoll =
  | { status: "processing" }
  | { status: "ready"; urls: string[] }
  | { error: string };

export async function pollProductAngles(angleSetId: string): Promise<AnglePoll> {
  await requireAdmin();
  try {
    const set = await getAngleSet(angleSetId);
    if (set.status === "failed") return { error: set.errorMessage ?? "auto-toon falló" };
    // hero is ready for review -> auto-approve so the rest render
    if (set.status === "awaiting_confirmation") {
      await confirmAngleSet(angleSetId);
      return { status: "processing" };
    }
    if (set.status === "ready") {
      const urls = await rehost(set.angleUrls ?? []);
      if (urls.length === 0) return { error: "No se generaron imágenes." };
      return { status: "ready", urls };
    }
    return { status: "processing" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al consultar los ángulos" };
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = await requireAdmin();
  await supabase.from("products").delete().eq("id", id);
  revalidatePath("/admin/products");
  redirect("/admin/products");
}
