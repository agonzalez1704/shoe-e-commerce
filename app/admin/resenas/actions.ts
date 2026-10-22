"use server";

import { revalidatePath } from "next/cache";
import { assertPermiso } from "@/lib/permisos-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { emitirCuponDeResena } from "@/lib/resena-cupon";
import { sendTaggedPhotoRejectedEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site";

type Res = { ok: true } | { ok: false; error: string };
const falla = (e: unknown): Res => ({ ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" });

// Aprobar = el segundo paso está completo: se emite el 10% y se le manda por correo.
export async function aprobarFoto(orderId: string): Promise<Res> {
  try {
    await assertPermiso("pedidos_gestionar");
    const admin = createAdminClient();
    const { data: o } = await admin
      .from("orders")
      .update({ foto_estado: "aprobada", foto_motivo: null })
      .eq("id", orderId)
      .eq("foto_estado", "pendiente")
      .select("id, email, order_number, cupon_resena, recompensa_resena")
      .maybeSingle();
    if (!o) return { ok: false, error: "Esta foto ya se revisó." };
    const code = await emitirCuponDeResena(admin, o);
    if (!code) return { ok: false, error: "Se aprobó, pero no se pudo crear el cupón. Intenta de nuevo." };
    revalidatePath("/admin/resenas");
    return { ok: true };
  } catch (e) {
    return falla(e);
  }
}

export async function rechazarFoto(orderId: string, motivo: string): Promise<Res> {
  try {
    await assertPermiso("pedidos_gestionar");
    const admin = createAdminClient();
    const { data: o } = await admin
      .from("orders")
      .update({ foto_estado: "rechazada", foto_motivo: motivo.trim().slice(0, 200) || null })
      .eq("id", orderId)
      .eq("foto_estado", "pendiente")
      .select("email, order_number, review_token")
      .maybeSingle();
    if (!o) return { ok: false, error: "Esta foto ya se revisó." };
    if (o.review_token) {
      await sendTaggedPhotoRejectedEmail({
        to: o.email,
        orderNumber: o.order_number,
        motivo: motivo.trim(),
        url: `${SITE_URL}/resena/${o.review_token}#paso2`,
      }).catch((e) => console.error("[resenas] correo de rechazo:", e));
    }
    revalidatePath("/admin/resenas");
    return { ok: true };
  } catch (e) {
    return falla(e);
  }
}

// "Respuesta de Blade" bajo la reseña en la ficha. Vacío = quitarla.
export async function responderResena(reviewId: string, texto: string): Promise<Res> {
  try {
    await assertPermiso("pedidos_gestionar");
    const t = texto.trim().slice(0, 600);
    const { data: r, error } = await createAdminClient()
      .from("reviews")
      .update({ respuesta: t || null, respuesta_at: t ? new Date().toISOString() : null })
      .eq("id", reviewId)
      .select("products(slug)")
      .maybeSingle();
    if (error || !r) return { ok: false, error: "No se pudo guardar la respuesta." };
    const slug = (r.products as unknown as { slug: string } | null)?.slug;
    if (slug) revalidatePath(`/products/${slug}`);
    revalidatePath("/admin/resenas");
    return { ok: true };
  } catch (e) {
    return falla(e);
  }
}

// Las fotos de reseña se publican al instante; si alguna no debe estar en la
// ficha, se quita aquí.
export async function quitarFotoResena(reviewId: string, url: string): Promise<Res> {
  try {
    await assertPermiso("pedidos_gestionar");
    const admin = createAdminClient();
    const { data: r } = await admin.from("reviews").select("fotos, products(slug)").eq("id", reviewId).maybeSingle();
    if (!r) return { ok: false, error: "No encontramos la reseña." };
    await admin.from("reviews").update({ fotos: (r.fotos ?? []).filter((f) => f !== url) }).eq("id", reviewId);
    const slug = (r.products as unknown as { slug: string } | null)?.slug;
    if (slug) revalidatePath(`/products/${slug}`);
    revalidatePath("/admin/resenas");
    return { ok: true };
  } catch (e) {
    return falla(e);
  }
}
