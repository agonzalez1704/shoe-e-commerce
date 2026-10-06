import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { requirePagePermiso } from "@/lib/permisos-guard";
import { waPedirResena, CUPON_RESENA } from "@/lib/reviews";
import { activeBrand } from "@/lib/brand";
import { SITE_URL } from "@/lib/site";

export const instant = false;

// Pedidos entregados sin reseña: un toque abre WhatsApp con el mensaje y el
// link directo al formulario. El correo automatico casi no se contesta.
export default async function AdminResenas() {
  await requirePagePermiso("pedidos_ver");
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, review_token, delivered_at, shipping_address, order_items(product_name), reviews(id)")
    .not("delivered_at", "is", null)
    .in("status", ["paid", "fulfilled"])
    .order("delivered_at", { ascending: false })
    .limit(200);

  type Row = {
    id: string; order_number: string; review_token: string | null; delivered_at: string;
    shipping_address: Record<string, string> | null; order_items: { product_name: string }[]; reviews: { id: string }[];
  };
  const pendientes = ((data ?? []) as unknown as Row[]).filter((o) => o.review_token && !o.reviews.length);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Pedir reseñas</h1>
        <p className="mt-1 text-sm text-muted">
          {pendientes.length} pedidos entregados sin reseña. Al reseñar, el cliente recibe {CUPON_RESENA.porcentaje}% para su
          siguiente compra.
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
                  {o.order_number} · entregado {new Date(o.delivered_at).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
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
    </div>
  );
}
