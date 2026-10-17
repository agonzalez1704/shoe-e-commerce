import { createClient } from "@/lib/supabase/server";

export * from "@/lib/reviews-shared";
import { resumir, CUPON_RESENA, type Review, type ReviewSummary } from "@/lib/reviews-shared";

export async function getProductReviews(productId: string): Promise<ReviewSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating, body, fit_feedback, verified_purchase, created_at, autor, ciudad, color, talla, fotos, respuesta")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  return resumir((data ?? []) as Review[]);
}

// Mensaje de WhatsApp para pedir la reseña de un pedido entregado (admin).
// El link lleva el token del pedido: entra directo, sin teclear numero ni correo.
export function waPedirResena(o: {
  phone?: string | null; nombre?: string | null; numero: string; productos: string[]; url: string; marca: string;
}): string | null {
  const d = (o.phone ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  const nombre = o.nombre?.trim().split(/\s+/)[0];
  const texto =
    `Hola${nombre ? ` ${nombre}` : ""} 👋 Te escribimos de ${o.marca}. Ya nos aparece entregado tu pedido ${o.numero}` +
    `${o.productos.length ? ` (${o.productos.join(", ")})` : ""}. ¿Cómo te quedaron?\n\n` +
    `Si nos dejas tu reseña y compartes una foto con tus ${o.marca} etiquetándonos en Instagram o Facebook, te regalamos ` +
    `un cupón de ${CUPON_RESENA.porcentaje}% para tu siguiente par, que se suma al combo de 2 pares. Buena o mala, la queremos honesta 🙏\n\n${o.url}`;
  return `https://wa.me/${d.length === 10 ? `52${d}` : d}?text=${encodeURIComponent(texto)}`;
}
