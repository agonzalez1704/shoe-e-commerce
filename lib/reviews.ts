import { createClient } from "@/lib/supabase/server";

export type Review = {
  rating: number;
  body: string | null;
  fit_feedback: "runs_small" | "true_to_size" | "runs_large" | null;
  verified_purchase: boolean;
  created_at: string;
};

// Cupon por reseñar (honesta, buena o mala): se suma al combo, un uso.
export const CUPON_RESENA = { porcentaje: 10, dias: 90 } as const;

export type ReviewSummary = { count: number; average: number; items: Review[] };

export const FIT_LABEL: Record<string, string> = {
  runs_small: "Talla chica",
  true_to_size: "Talla correcta",
  runs_large: "Talla grande",
};

export async function getProductReviews(productId: string): Promise<ReviewSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("rating, body, fit_feedback, verified_purchase, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  const items = (data ?? []) as Review[];
  const count = items.length;
  const average = count ? items.reduce((s, r) => s + r.rating, 0) / count : 0;
  return { count, average, items };
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
    `Si nos dejas tu reseña (toma un minuto) te regalamos un cupón de ${CUPON_RESENA.porcentaje}% para tu siguiente par, ` +
    `que se suma al combo de 2 pares. Buena o mala, la queremos honesta 🙏\n\n${o.url}`;
  return `https://wa.me/${d.length === 10 ? `52${d}` : d}?text=${encodeURIComponent(texto)}`;
}
