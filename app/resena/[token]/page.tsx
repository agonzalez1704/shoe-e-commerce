import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReviewForm } from "@/components/ReviewForm";
import { PasoFotoEtiquetada } from "@/components/PasoFotoEtiquetada";
import { CopiarCodigo } from "@/components/CopiarCodigo";
import { CUPON_RESENA, RECOMPENSA, arrobaInstagram, pasoCampana } from "@/lib/reviews-shared";
import { activeBrand } from "@/lib/brand";

// Ruta bloqueante a proposito: dinamica de punta a punta (sesion/pago); un
// shell prerenderizado no aporta aqui.
export const instant = false;

type Row = {
  product_name: string;
  quantity: number;
  variants: {
    product_id: string; color: string | null; size_value: string | number | null;
    products: { name: string; product_images: { url: string; position: number; color: string | null }[] } | null;
  } | null;
};

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, status, delivered_at, cupon_resena, foto_estado, foto_motivo, recompensa_resena")
    .eq("review_token", token)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: items }, { data: reviews }] = await Promise.all([
    admin
      .from("order_items")
      .select("product_name, quantity, variants(product_id, color, size_value, products(name, product_images(url, position, color)))")
      .eq("order_id", order.id),
    admin.from("reviews").select("product_id").eq("order_id", order.id),
  ]);

  // Un formulario por producto (dos pares del mismo modelo = una reseña).
  const products = new Map<string, { id: string; name: string; detalle: string; imagen: string | null }>();
  let pares = 0;
  for (const r of (items ?? []) as unknown as Row[]) {
    pares += r.quantity;
    const v = r.variants;
    if (!v?.product_id || products.has(v.product_id)) continue;
    const fotos = [...(v.products?.product_images ?? [])].sort((a, b) => a.position - b.position);
    products.set(v.product_id, {
      id: v.product_id,
      name: [v.products?.name ?? r.product_name, v.color].filter(Boolean).join(" "),
      detalle: v.size_value != null ? `Talla ${v.size_value}` : "",
      imagen: (fotos.find((f) => f.color?.toLowerCase() === v.color?.toLowerCase()) ?? fotos[0])?.url ?? null,
    });
  }
  const publicadas = new Set((reviews ?? []).map((r) => r.product_id));
  const entregado = !!order.delivered_at && (order.status === "paid" || order.status === "fulfilled");
  const paso = pasoCampana({ resenado: publicadas.size > 0, foto_estado: order.foto_estado, cupon_resena: order.cupon_resena });
  const arroba = arrobaInstagram(activeBrand.social?.instagram);
  const cartera = order.recompensa_resena === "cartera";
  const tarjeta = "rounded-3xl border border-border bg-surface p-5";

  return (
    <div className="mx-auto max-w-lg space-y-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reseña tu pedido</h1>
        <p className="nums mt-1 text-sm text-muted">
          {order.order_number} · {pares} {pares === 1 ? (activeBrand.copy?.itemSingular ?? "producto") : (activeBrand.copy?.itemPlural ?? "productos")}
        </p>
      </div>

      {!entregado ? (
        <p className="text-sm text-muted">Podrás dejar tu reseña en cuanto tu pedido se entregue.</p>
      ) : products.size === 0 ? (
        <p className="text-sm text-muted">No encontramos productos para reseñar.</p>
      ) : (
        <>
          <div className="space-y-2 pt-2">
            <div className="grid grid-cols-2 gap-1.5" aria-hidden="true">
              <span className="h-1.5 rounded-full bg-accent" />
              <span className={`h-1.5 rounded-full ${paso === "resena" ? "bg-elevated" : "bg-accent"}`} />
            </div>
            <div className="flex justify-between text-xs text-muted">
              <span className={paso === "resena" ? "font-semibold text-text" : ""}>1. Tu reseña</span>
              <span className={paso !== "resena" ? "font-semibold text-text" : ""}>2. Tu foto etiquetada · regalo</span>
            </div>
          </div>

          <section aria-labelledby="paso1" className={`${tarjeta} space-y-5`}>
            <h2 id="paso1" className="text-lg font-semibold">¿Qué tal te quedaron?</h2>
            {[...products.values()].map((p, i) => (
              <div key={p.id} className={i ? "border-t border-border pt-5" : ""}>
                <ReviewForm token={token} productId={p.id} productName={p.name} detalle={p.detalle} imagen={p.imagen} publicada={publicadas.has(p.id)} />
              </div>
            ))}
          </section>

          <section id="paso2" aria-labelledby="paso2t" className={`${tarjeta} scroll-mt-24 space-y-4`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="paso2t" className="text-lg font-semibold">Comparte una foto con tus {activeBrand.name}</h2>
              <span className="nums text-sm text-accent">{CUPON_RESENA.porcentaje}% o cartera</span>
            </div>
            {paso === "resena" ? (
              <p className="text-sm text-muted">Primero publica tu reseña; después comparte tu foto y elige tu regalo: {CUPON_RESENA.porcentaje}% de descuento o una cartera.</p>
            ) : paso === "revision" ? (
              <p className="rounded-2xl bg-elevated p-4 text-sm text-muted">
                <span className="font-medium text-text">Recibimos tu publicación.</span> La revisamos en menos de 24 horas y te
                mandamos tu código por correo.
              </p>
            ) : paso === "listo" ? (
              <p className="text-sm text-muted">¡Listo! Ya revisamos tu publicación. Gracias por compartir.</p>
            ) : (
              <>
                {order.foto_estado === "rechazada" && (
                  <p className="rounded-2xl border border-accent/40 bg-accent-soft p-3 text-sm">
                    No pudimos validar tu publicación{order.foto_motivo ? `: ${order.foto_motivo}` : "."} Inténtalo de nuevo.
                  </p>
                )}
                <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-text/85">
                  <li>Toma una foto o video con tus {activeBrand.name} puestos o en tu día a día.</li>
                  <li>
                    Publícala en Instagram o Facebook (post, reel o historia) y etiqueta a{" "}
                    <strong className="text-text">{arroba ?? activeBrand.name}</strong>.
                  </li>
                  <li>Pega aquí el enlace o sube una captura de tu publicación.</li>
                </ol>
                <PasoFotoEtiquetada token={token} />
                <p className="text-xs leading-relaxed text-muted">
                  La revisamos en menos de 24 horas y te mandamos tu código por correo. Tu cuenta debe ser pública o la
                  publicación visible para que podamos verla.
                </p>
              </>
            )}
          </section>

          <section
            aria-label="Tu regalo"
            className={`flex items-center justify-between gap-3 rounded-3xl border-[1.5px] border-dashed p-5 ${order.cupon_resena ? "border-accent/50 bg-accent-soft/50" : "border-border"}`}
          >
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-muted">Tu regalo para la próxima compra</p>
              <p className="nums text-lg font-semibold tracking-wide">
                {order.cupon_resena
                  ? `${cartera ? "Cartera de regalo" : `${CUPON_RESENA.porcentaje}%`} · ${order.cupon_resena}`
                  : `${CUPON_RESENA.porcentaje}% o una cartera`}
              </p>
              <p className="text-sm text-muted">
                {order.cupon_resena
                  ? `${cartera ? "Usa el código al pagar y la cartera va con tus zapatos." : "Un uso; se suma al combo de 2 pares."} Válido ${CUPON_RESENA.dias} días.`
                  : `Tú eliges al enviar tu foto: ${RECOMPENSA.descuento.titulo.toLowerCase()} o ${RECOMPENSA.cartera.titulo.toLowerCase()}. Se activa al completar los dos pasos, sin importar tu calificación.`}
              </p>
            </div>
            {order.cupon_resena && <CopiarCodigo code={order.cupon_resena} />}
          </section>
        </>
      )}
    </div>
  );
}
