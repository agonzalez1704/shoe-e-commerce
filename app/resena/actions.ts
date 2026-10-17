"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { randomUUID } from "node:crypto";
import { notifyAdmins } from "@/lib/push";
import { enlacePublicacionValido } from "@/lib/reviews-shared";

// Entrada sin el link del correo: numero de pedido + correo de la compra (solo
// el numero, que es consecutivo, dejaria reseñar pedidos ajenos). Solo pedidos
// entregados; el resto se queda en el formulario con el motivo.
export type AccesoResena = { error: string; o: string; e: string } | null;

export async function entrarAResena(_prev: AccesoResena, form: FormData): Promise<AccesoResena> {
  const o = String(form.get("o") ?? "").trim().toUpperCase();
  const e = String(form.get("e") ?? "").trim();
  // React vacia el formulario tras la accion: se devuelven los valores para rellenarlo.
  const falla = (error: string) => ({ error, o, e });
  if (!(await rateLimit("resena-acceso", await clientIp(), 10, 3600))) {
    return falla("Demasiados intentos. Intenta de nuevo en una hora.");
  }
  if (!o || !e) return falla("Escribe tu número de pedido y tu correo.");

  const { data: order } = await createAdminClient()
    .from("orders")
    .select("review_token, status, delivered_at")
    .eq("order_number", o)
    .ilike("email", e.replace(/[\\%_]/g, "\\$&"))
    .maybeSingle();
  if (!order?.review_token || order.status === "cancelled" || order.status === "refunded") {
    return falla("No encontramos un pedido con ese número y correo.");
  }
  if (!order.delivered_at) return falla("Podrás dejar tu reseña en cuanto tu pedido se entregue.");
  redirect(`/resena/${order.review_token}`);
}

// Pedido por token, solo si ya se entregó: es la prueba de compra de todo el
// flujo de reseña (el cliente entra sin sesión, con el link del correo).
async function pedidoEntregado(admin: ReturnType<typeof createAdminClient>, token: string) {
  type R = { error: string } | { order: NonNullable<typeof order> };
  const { data: order } = await admin
    .from("orders")
    .select("id, customer_id, status, delivered_at, email, order_number, shipping_address, foto_estado, cupon_resena")
    .eq("review_token", token)
    .maybeSingle();
  if (!order) return { error: "Enlace inválido." } as R;
  if (!order.delivered_at || (order.status !== "paid" && order.status !== "fulfilled")) {
    return { error: "Podrás dejar tu reseña en cuanto tu pedido se entregue." } as R;
  }
  return { order } as R;
}

const IMAGEN_MAX = 1_500_000; // el navegador ya la reduce a ~1600px antes de subirla
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

// Una foto por llamada (cabe en el límite de 1 MB de las server actions). Va al
// bucket público "resenas", bajo la carpeta del pedido: submitReview solo
// acepta URLs de esa carpeta.
export async function subirFotoResena(token: string, form: FormData): Promise<{ url: string } | { error: string }> {
  if (!(await rateLimit("resena-foto", await clientIp(), 30, 3600))) return { error: "Demasiadas fotos. Intenta más tarde." };
  const admin = createAdminClient();
  const r = await pedidoEntregado(admin, token);
  if ("error" in r) return { error: r.error };
  const file = form.get("foto");
  if (!(file instanceof File) || !TIPOS.includes(file.type) || file.size > IMAGEN_MAX) return { error: "Esa imagen no se pudo subir." };
  const path = `${r.order.id}/${randomUUID()}.jpg`;
  const { error } = await admin.storage.from("resenas").upload(path, file, { contentType: file.type });
  if (error) return { error: "Esa imagen no se pudo subir." };
  return { url: admin.storage.from("resenas").getPublicUrl(path).data.publicUrl };
}

// Paso 1: la reseña. Ya no da cupón por sí sola — el 10% llega cuando también
// aprobamos la foto etiquetada (paso 2).
export async function submitReview(input: {
  token: string;
  productId: string;
  rating: number;
  body: string;
  fit: "" | "runs_small" | "true_to_size" | "runs_large";
  fotos?: string[];
}): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient();
  const r = await pedidoEntregado(admin, input.token);
  if ("error" in r) return { error: r.error };
  const { order } = r;

  // product must belong to the order
  const { data: items } = await admin
    .from("order_items")
    .select("variants(product_id, color, size_value, products(slug))")
    .eq("order_id", order.id);
  type Row = { variants: { product_id: string; color: string | null; size_value: string | number | null; products: { slug: string } | null } | null };
  const rows = (items ?? []) as unknown as Row[];
  const match = rows.find((x) => x.variants?.product_id === input.productId);
  if (!match) return { error: "Ese producto no está en tu pedido." };

  const carpeta = admin.storage.from("resenas").getPublicUrl(`${order.id}/`).data.publicUrl;
  const fotos = (input.fotos ?? []).filter((u) => u.startsWith(carpeta)).slice(0, 3);

  const rating = Math.min(5, Math.max(1, Math.round(input.rating)));
  const { error } = await admin.from("reviews").upsert(
    {
      order_id: order.id,
      product_id: input.productId,
      customer_id: order.customer_id,
      rating,
      body: input.body.trim() || null,
      fit_feedback: input.fit || null,
      verified_purchase: true,
      ...autorPublico(order.shipping_address),
      color: match.variants?.color ?? null,
      talla: match.variants?.size_value != null ? String(match.variants.size_value) : null,
      fotos,
    },
    { onConflict: "order_id,product_id" },
  );
  if (error) return { error: error.message };

  const slug = match.variants?.products?.slug;
  if (slug) revalidatePath(`/products/${slug}`);
  return { ok: true };
}

// Paso 2: la publicación en Instagram/Facebook etiquetando a la marca. Enlace
// (posts y reels) o captura (las historias no tienen enlace que dure). Queda
// en revisión; al aprobarla en /admin/resenas se emite el cupón.
export async function enviarFotoEtiquetada(token: string, form: FormData): Promise<{ ok: true } | { error: string }> {
  if (!(await rateLimit("resena-etiqueta", await clientIp(), 10, 3600))) return { error: "Demasiados intentos. Intenta más tarde." };
  const admin = createAdminClient();
  const r = await pedidoEntregado(admin, token);
  if ("error" in r) return { error: r.error };
  const { order } = r;
  if (order.cupon_resena || order.foto_estado === "aprobada") return { error: "Tu cupón ya está activo." };
  if (order.foto_estado === "pendiente") return { error: "Ya la recibimos; la estamos revisando." };
  const { count } = await admin.from("reviews").select("id", { count: "exact", head: true }).eq("order_id", order.id);
  if (!count) return { error: "Primero publica tu reseña (paso 1)." };

  const enlace = String(form.get("enlace") ?? "").trim();
  const file = form.get("captura");
  const hayCaptura = file instanceof File && file.size > 0;
  if (!enlace && !hayCaptura) return { error: "Pega el enlace de tu publicación o sube una captura." };
  if (enlace && !enlacePublicacionValido(enlace)) return { error: "El enlace debe ser de una publicación de Instagram o Facebook." };

  let captura: string | null = null;
  if (hayCaptura) {
    if (!TIPOS.includes(file.type) || file.size > IMAGEN_MAX) return { error: "Esa captura no se pudo subir." };
    captura = `${order.id}/${randomUUID()}.jpg`;
    const { error } = await admin.storage.from("resena-capturas").upload(captura, file, { contentType: file.type });
    if (error) return { error: "Esa captura no se pudo subir." };
  }

  const { error } = await admin
    .from("orders")
    .update({ foto_enlace: enlace || null, foto_captura: captura, foto_estado: "pendiente", foto_motivo: null, foto_at: new Date().toISOString() })
    .eq("id", order.id);
  if (error) return { error: "No se pudo enviar. Intenta de nuevo." };
  await notifyAdmins({
    title: "Foto etiquetada por revisar",
    body: `Pedido ${order.order_number}: aprueba su foto para enviarle su 10%.`,
    url: "/admin/resenas",
    tag: `foto-${order.order_number}`,
  });
  revalidatePath(`/resena/${token}`);
  return { ok: true };
}

// Lo que se publica de quien reseña: nombre y la inicial del apellido ("Ana G.")
// y su ciudad. Nunca el nombre completo ni la direccion.
function autorPublico(envio: unknown): { autor: string | null; ciudad: string | null } {
  const e = (envio ?? {}) as { name?: string; city?: string };
  const partes = (e.name ?? "").trim().split(/\s+/).filter(Boolean);
  const nombre = partes[0] ? partes[0][0].toUpperCase() + partes[0].slice(1).toLowerCase() : null;
  const inicial = partes[1] ? ` ${partes[1][0].toUpperCase()}.` : "";
  return { autor: nombre ? nombre + inicial : null, ciudad: e.city?.trim() || null };
}
