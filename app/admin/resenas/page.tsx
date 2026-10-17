import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePagePermiso } from "@/lib/permisos-guard";
import { waPedirResena, CUPON_RESENA } from "@/lib/reviews";
import { Stars } from "@/components/Stars";
import { RevisarFoto, ResponderResena, QuitarFoto } from "@/components/admin/ResenasAdmin";
import { activeBrand } from "@/lib/brand";
import { SITE_URL } from "@/lib/site";

export const instant = false;

const dia = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" });

// Tres trabajos: aprobar las fotos etiquetadas (eso emite el 10%), responder
// reseñas, y pedirlas por WhatsApp a quien ya recibió y no ha reseñado.
export default async function AdminResenas() {
  await requirePagePermiso("pedidos_ver");
  const supabase = await createClient();
  const [{ data }, { data: fotosData }, { data: recientes }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_number, review_token, delivered_at, shipping_address, order_items(product_name), reviews(id)")
      .not("delivered_at", "is", null)
      .in("status", ["paid", "fulfilled"])
      .order("delivered_at", { ascending: false })
      .limit(200),
    supabase
      .from("orders")
      .select("id, order_number, foto_enlace, foto_captura, foto_at, shipping_address, reviews(rating, body)")
      .eq("foto_estado", "pendiente")
      .order("foto_at", { ascending: true }),
    supabase
      .from("reviews")
      .select("id, rating, body, autor, ciudad, color, talla, fotos, respuesta, created_at, products(name)")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  type Row = {
    id: string; order_number: string; review_token: string | null; delivered_at: string;
    shipping_address: Record<string, string> | null; order_items: { product_name: string }[]; reviews: { id: string }[];
  };
  const pendientes = ((data ?? []) as unknown as Row[]).filter((o) => o.review_token && !o.reviews.length);

  // Capturas en bucket privado: URL firmada de una hora para verlas aquí.
  const fotos = fotosData ?? [];
  const rutas = fotos.map((f) => f.foto_captura).filter((p): p is string => !!p);
  const { data: firmadas } = rutas.length
    ? await createAdminClient().storage.from("resena-capturas").createSignedUrls(rutas, 3600)
    : { data: [] };
  const urlCaptura = new Map((firmadas ?? []).map((s) => [s.path, s.signedUrl]));

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Fotos etiquetadas por revisar</h1>
          <p className="mt-1 text-sm text-muted">
            Revisa que la publicación etiquete a la marca y muestre los zapatos. Al aprobar, el cliente recibe su{" "}
            {CUPON_RESENA.porcentaje}% por correo.
          </p>
        </div>
        {fotos.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted">No hay fotos pendientes.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {fotos.map((f) => {
              const ship = (f.shipping_address ?? {}) as Record<string, string>;
              const resena = (f.reviews as unknown as { rating: number; body: string | null }[])[0];
              const captura = f.foto_captura ? urlCaptura.get(f.foto_captura) : null;
              return (
                <li key={f.id} className="space-y-3 rounded-2xl border border-border bg-surface p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{ship.name ?? "Sin nombre"}</p>
                      <p className="nums text-xs text-muted">{f.order_number} · enviada {f.foto_at ? dia(f.foto_at) : ""}</p>
                    </div>
                    {resena && <Stars value={resena.rating} />}
                  </div>
                  {f.foto_enlace && (
                    <a href={f.foto_enlace} target="_blank" rel="noopener noreferrer" className="block truncate text-accent underline">
                      {f.foto_enlace}
                    </a>
                  )}
                  {captura && (
                    <a href={captura} target="_blank" rel="noopener noreferrer" className="block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={captura} alt="Captura de la publicación" className="max-h-72 rounded-xl border border-border object-contain" />
                    </a>
                  )}
                  <RevisarFoto orderId={f.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Reseñas recientes</h2>
          <p className="mt-1 text-sm text-muted">Tu respuesta aparece como “Respuesta de {activeBrand.name}” bajo la reseña en la ficha.</p>
        </div>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {(recientes ?? []).map((r) => (
            <li key={r.id} className="space-y-2 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Stars value={r.rating} />
                <span className="font-medium">{(r.products as unknown as { name: string } | null)?.name}</span>
                <span className="text-xs text-muted">
                  {[r.autor, r.ciudad, r.color, r.talla && `talla ${r.talla}`, dia(r.created_at)].filter(Boolean).join(" · ")}
                </span>
              </div>
              {r.body && <p className="text-text/85">{r.body}</p>}
              {r.fotos.length > 0 && (
                <div className="flex gap-2">
                  {r.fotos.map((u) => (
                    <div key={u} className="relative h-20 w-20 overflow-hidden rounded-lg bg-elevated">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="h-full w-full object-cover" />
                      <QuitarFoto reviewId={r.id} url={u} />
                    </div>
                  ))}
                </div>
              )}
              {r.respuesta && (
                <p className="rounded-r-lg border-l-2 border-accent bg-bg px-3 py-2 text-xs text-muted">
                  <span className="font-medium text-text">Respuesta: </span>{r.respuesta}
                </p>
              )}
              <ResponderResena reviewId={r.id} inicial={r.respuesta} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Pedir reseñas</h2>
          <p className="mt-1 text-sm text-muted">
            {pendientes.length} pedidos entregados sin reseña. Con su reseña y una foto etiquetada, el cliente recibe{" "}
            {CUPON_RESENA.porcentaje}% para su siguiente compra.
          </p>
        </div>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {pendientes.map((o) => {
            const ship = o.shipping_address ?? {};
            const wa = waPedirResena({
              phone: ship.phone,
              nombre: ship.name,
              numero: o.order_number,
              productos: [...new Set(o.order_items.map((i) => i.product_name))],
              url: `${SITE_URL}/resena/${o.review_token}`,
              marca: activeBrand.name,
            });
            return (
              <li key={o.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{ship.name ?? "Sin nombre"}</p>
                  <p className="nums truncate text-xs text-muted">
                    {o.order_number} · entregado {dia(o.delivered_at)}
                  </p>
                </div>
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-3 py-2 text-xs font-medium text-[#128C4B] hover:bg-[#25D366]/20 dark:text-[#25D366]"
                  >
                    <WhatsappLogo size={14} weight="fill" /> Pedir reseña
                  </a>
                ) : (
                  <span className="text-xs text-muted">Sin teléfono</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
