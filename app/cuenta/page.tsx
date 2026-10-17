import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { customerSignOut } from "@/app/cuenta/actions";
import { AuthForms } from "@/components/AuthForms";
import { Stars } from "@/components/Stars";
import { CopiarCodigo } from "@/components/CopiarCodigo";
import { PASOS_CLIENTE, pasoCliente, carrierName, trackingUrlFor, fechaEntrega } from "@/lib/fulfillment";
import { ligarPedidosDeInvitado } from "@/lib/cuenta";
import { FIT_LABEL } from "@/lib/reviews-shared";
import { formatCents } from "@/lib/money";
import { activeBrand } from "@/lib/brand";

export const instant = false; // dinámica de punta a punta (sesión/pedido)

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const COPY = activeBrand.copy ?? {};
const ITEMS_ORDERED = `${COPY.itemPlural ?? "Productos"} pedidos`.replace(/^./, (c) => c.toUpperCase());
const dia = (iso: string, anio = false) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", ...(anio && { year: "numeric" }), timeZone: "America/Mexico_City" });

const VERDE = "text-[#2f9e5c] dark:text-[#5FD08A]";
const AMBAR = "text-[#b7861f] dark:text-[#E8B84A]";

type Item = {
  product_name: string;
  variant_label: string;
  quantity: number;
  variants: { color: string; products: { product_images: { url: string; position: number; color: string | null }[] } | null } | null;
};
type Garantia = { razon: string; recibido_at: string | null; cerrada_at: string | null; retorno_carrier: string | null; retorno_tracking: string | null; retorno_label_url: string | null; repo_carrier: string | null; repo_tracking: string | null };
type ComboFila = { quantity: number; variants: { fuera_de_combo: boolean; products: { combo_group: string | null; combo_min_qty: number | null } | null } | null };

const ORDER_SELECT =
  "id, order_number, status, fulfillment_stage, delivered_at, carrier, tracking_number, tracking_url, estimated_delivery, total_cents, created_at, payment_method, shipping_address, review_token, cupon_resena, combo_parent_order_id, order_items_combo:order_items(quantity, variants(fuera_de_combo, products(combo_group, combo_min_qty))), garantias(razon, recibido_at, cerrada_at, retorno_carrier, retorno_tracking, retorno_label_url, repo_carrier, repo_tracking), order_items(product_name, variant_label, quantity, variants(color, products(product_images(url, position, color))))";

export default async function CuentaPage({ searchParams }: { searchParams: Promise<{ error?: string; msg?: string; next?: string }> }) {
  const { error, msg, next } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="py-12">
        <h1 className="mb-8 text-center text-2xl font-semibold tracking-tight">Mi cuenta</h1>
        <AuthForms error={error} msg={msg} google={process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1"} next={next ?? "/cuenta"} />
      </div>
    );
  }

  // Antes de leer: así el pedido que hizo como invitado ya aparece aquí.
  await ligarPedidosDeInvitado(user);

  const [{ data: customer }, { data: ordersData }] = await Promise.all([
    supabase.from("customers").select("full_name, email").eq("id", user.id).maybeSingle(),
    supabase.from("orders").select(ORDER_SELECT).eq("customer_id", user.id).order("created_at", { ascending: false }),
  ]);
  const orders = ordersData ?? [];

  const codigos = orders.map((o) => o.cupon_resena).filter((c): c is string => !!c);
  const [{ data: reviews }, { data: cupones }] = await Promise.all([
    orders.length
      ? supabase
          .from("reviews")
          .select("id, order_id, rating, body, fit_feedback, created_at, color, products(name, slug)")
          .in("order_id", orders.map((o) => o.id))
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    // discount_codes es solo de admin por RLS; los códigos salen de sus propios pedidos.
    codigos.length
      ? createAdminClient().from("discount_codes").select("code, value, expires_at, used_count, max_uses, active").in("code", codigos)
      : Promise.resolve({ data: [] }),
  ]);

  const resenados = new Set((reviews ?? []).map((r) => r.order_id));
  const vivo = (s: string) => s !== "cancelled" && s !== "refunded";
  const porResenar = orders.filter((o) => o.delivered_at && o.review_token && vivo(o.status) && !resenados.has(o.id));
  await connection(); // la vigencia de los cupones depende de la hora actual
  const ahora = Date.now();
  const listaCupones = (cupones ?? []).map((c) => ({
    ...c,
    estado:
      c.max_uses != null && c.used_count >= c.max_uses ? "Usado"
      : !c.active || (c.expires_at && new Date(c.expires_at).getTime() < ahora) ? "Vencido"
      : null,
  }));
  const cuponVivo = listaCupones.find((c) => !c.estado);
  const nombre = (customer?.full_name ?? "").trim().split(/\s+/)[0];
  const wa = activeBrand.legal.whatsapp;

  const secciones = [
    { id: "pedidos", label: "Pedidos", extra: orders.length ? String(orders.length) : null },
    { id: "resenas", label: "Reseñas", extra: porResenar.length ? `${porResenar.length} pendiente${porResenar.length > 1 ? "s" : ""}` : null },
    { id: "cupones", label: "Cupones", extra: cuponVivo ? "1 activo" : null },
  ];

  return (
    <div className="py-8 md:grid md:grid-cols-[250px_minmax(0,1fr)] md:gap-12 md:py-12">
      <aside className="space-y-5 md:sticky md:top-24 md:self-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-[26px]">Hola{nombre ? `, ${nombre}` : ""}</h1>
          <p className="mt-0.5 truncate text-sm text-muted">
            {customer?.email ?? user.email}
            <span className="md:hidden"> · {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}</span>
          </p>
        </div>

        <nav aria-label="Secciones de la cuenta" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1 md:flex md:flex-col md:bg-transparent md:p-0">
          {secciones.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex h-10 items-center justify-center gap-2 rounded-xl text-sm text-text transition-colors hover:bg-elevated md:h-11 md:justify-between md:px-3.5"
            >
              {s.label}
              {s.extra && (
                <span className={`hidden text-xs md:inline ${s.id === "resenas" ? "rounded-full bg-accent px-2 py-0.5 text-accent-contrast" : "nums text-muted"}`}>
                  {s.extra}
                </span>
              )}
            </a>
          ))}
          <form action={customerSignOut} className="hidden md:block">
            <button className="flex h-11 w-full items-center rounded-xl px-3.5 text-sm text-muted transition-colors hover:bg-elevated hover:text-text">
              Cerrar sesión
            </button>
          </form>
        </nav>

        {cuponVivo && (
          <a href="#cupones" className="hidden rounded-2xl border-[1.5px] border-dashed border-accent/40 bg-accent-soft/40 p-3.5 md:block">
            <span className="block text-xs text-muted">Tu cupón</span>
            <span className="nums block font-semibold tracking-wide">{cuponVivo.code}</span>
            <span className="block text-xs text-muted">{cuponVivo.value}% en tu próxima compra</span>
          </a>
        )}
      </aside>

      <main className="mt-6 min-w-0 space-y-10 md:mt-0">
        {porResenar[0] && <PromoResena order={porResenar[0]} total={porResenar.length} />}

        <section id="pedidos" className="scroll-mt-24 space-y-3">
          <h2 className="text-lg font-semibold">Mis pedidos</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-muted">
              Aún no tienes pedidos. <Link href="/products" className="text-accent underline">Ir a la tienda</Link>
            </p>
          ) : (
            <ul className="space-y-3">
              {orders.map((o) => (
                <PedidoCard key={o.order_number} o={o} resenado={resenados.has(o.id)} />
              ))}
            </ul>
          )}
        </section>

        <section id="resenas" className="scroll-mt-24 space-y-3">
          <h2 className="text-lg font-semibold">Mis reseñas</h2>
          {(reviews ?? []).length === 0 ? (
            <p className="text-sm text-muted">
              Aún no has reseñado. {porResenar.length ? "Tienes pedidos entregados esperando tu opinión." : "Cuando recibas tu pedido podrás contarnos qué tal te quedó."}
            </p>
          ) : (
            <ul className="space-y-3">
              {(reviews ?? []).map((r) => {
                const p = r.products as unknown as { name: string; slug: string } | null;
                return (
                  <li key={r.id} className="space-y-2 rounded-2xl border border-border bg-surface p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium capitalize">{[p?.name, r.color].filter(Boolean).join(" ")}</span>
                      <span className="text-xs text-muted">{dia(r.created_at)}</span>
                    </div>
                    <Stars value={r.rating} />
                    {r.body && <p className="text-sm leading-relaxed text-text/85">{r.body}</p>}
                    <p className="text-xs text-muted">
                      {[r.fit_feedback && FIT_LABEL[r.fit_feedback], "Publicada en la tienda"].filter(Boolean).join(" · ")}
                      {p?.slug && (
                        <> · <Link href={`/products/${p.slug}#resenas`} className="text-accent underline-offset-2 hover:underline">Ver</Link></>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section id="cupones" className="scroll-mt-24 space-y-3">
          <h2 className="text-lg font-semibold">Mis cupones</h2>
          {listaCupones.length === 0 ? (
            <p className="text-sm text-muted">Aquí aparecerán tus cupones. Reseña un pedido entregado y gana 10% en tu próxima compra.</p>
          ) : (
            <ul className="space-y-3">
              {listaCupones.map((c) => (
                <li
                  key={c.code}
                  className={`flex items-center justify-between gap-3 rounded-2xl border-[1.5px] border-dashed p-4 ${c.estado ? "border-border opacity-60" : "border-accent/40 bg-accent-soft/40"}`}
                >
                  <div className="min-w-0">
                    <p className={`nums font-semibold tracking-wide ${c.estado ? "line-through" : ""}`}>{c.code}</p>
                    <p className="text-xs text-muted">
                      {c.value}% en tu próxima compra · {c.estado ?? (c.expires_at ? `vence ${dia(c.expires_at, true)}` : "sin vencimiento")}
                    </p>
                  </div>
                  {!c.estado && <CopiarCodigo code={c.code} />}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="divide-y divide-border border-y border-border md:hidden">
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-between text-sm">
              Ayuda por WhatsApp <span aria-hidden="true">›</span>
            </a>
          )}
          <form action={customerSignOut}>
            <button className="flex h-12 w-full items-center text-sm text-muted">Cerrar sesión</button>
          </form>
        </section>
      </main>
    </div>
  );
}

type Order = {
  id: string;
  order_number: string;
  review_token: string | null;
};

// El cupón hoy llega al publicar la reseña (lib/reviews: CUPON_RESENA).
function PromoResena({ order, total }: { order: Order; total: number }) {
  return (
    <section className="grid overflow-hidden rounded-3xl border border-border bg-surface sm:grid-cols-[200px_minmax(0,1fr)]">
      <Image
        src="/blade-promo-resenas.webp"
        alt="10% de descuento"
        width={640}
        height={800}
        sizes="200px"
        className="hidden h-full w-full object-cover sm:block"
      />
      <div className="flex flex-col justify-center gap-3 p-5 sm:p-7">
        <span className="nums text-xs tracking-[0.12em] text-accent">TU 10% DE DESCUENTO</span>
        <p className="text-xl font-semibold leading-snug sm:text-2xl">Reseña tus {activeBrand.name} y gana 10% en tu próxima compra</p>
        <p className="text-sm text-muted">
          {total > 1 ? `Tienes ${total} pedidos entregados por reseñar.` : "Tu pedido ya llegó: cuéntanos qué tal te quedó."} El cupón llega al
          publicar tu reseña, sin importar tu calificación.
        </p>
        <Link
          href={`/resena/${order.review_token}`}
          className="mt-1 inline-flex h-11 w-fit items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-contrast"
        >
          Reseñar {order.order_number}
        </Link>
      </div>
    </section>
  );
}

function estadoPedido(status: string, stage: string | null, entregado: boolean, conGuia: boolean) {
  if (status === "cancelled") return { label: "Cancelado", tono: "text-muted" };
  if (status === "refunded") return { label: "Reembolsado", tono: "text-muted" };
  if (status === "pending") return { label: "Pendiente de pago", tono: "text-accent" };
  const paso = entregado ? 4 : pasoCliente(status, stage, conGuia);
  return { label: PASOS_CLIENTE[paso].label, tono: paso === 4 ? VERDE : AMBAR };
}

// Par suelto de combo en un pedido pagado: la puerta al checkout exprés que
// cobra solo la diferencia.
function faltaParDeCombo(status: string, parent: string | null, filas: ComboFila[]) {
  if ((status !== "paid" && status !== "fulfilled") || parent) return false;
  const g = new Map<string, { min: number; u: number }>();
  for (const f of filas) {
    const pr = f.variants?.products;
    if (f.variants?.fuera_de_combo || !pr?.combo_group || pr.combo_min_qty == null) continue;
    const e = g.get(pr.combo_group) ?? { min: pr.combo_min_qty, u: 0 };
    e.u += f.quantity;
    g.set(pr.combo_group, e);
  }
  return [...g.values()].some((e) => e.u % e.min === e.min - 1);
}

function PedidoCard({ o: raw, resenado }: { o: Record<string, unknown>; resenado: boolean }) {
  const o = raw as {
    order_number: string; status: string; fulfillment_stage: string | null; delivered_at: string | null;
    carrier: string | null; tracking_number: string | null; tracking_url: string | null; estimated_delivery: string | null;
    total_cents: number; created_at: string; payment_method: string | null; shipping_address: Record<string, string> | null;
    review_token: string | null; combo_parent_order_id: string | null; order_items_combo: ComboFila[] | null;
    garantias: Garantia | null; order_items: Item[] | null;
  };
  const items = o.order_items ?? [];
  const ship = o.shipping_address ?? {};
  const addr = [ship.line1, ship.neighborhood, ship.city, ship.region, ship.postal].filter(Boolean).join(", ");
  const rastreoUrl = trackingUrlFor(o.carrier, o.tracking_number, o.tracking_url);
  const estado = estadoPedido(o.status, o.fulfillment_stage, !!o.delivered_at, !!o.tracking_number);
  const unidades = items.reduce((n, it) => n + it.quantity, 0);
  const nombres = items.map((it) => `${it.product_name} ${it.variants?.color ?? ""}`.trim()).join(" + ");
  const v = items[0]?.variants;
  const fotos = [...(v?.products?.product_images ?? [])].sort((a, b) => a.position - b.position);
  const foto = (fotos.find((f) => f.color?.toLowerCase() === v?.color?.toLowerCase()) ?? fotos[0])?.url;
  const vivo = o.status !== "cancelled" && o.status !== "refunded";
  const ga = o.garantias;

  return (
    <li className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex gap-3.5">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white">
          {foto && <Image src={foto} alt="" width={128} height={128} sizes="64px" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center justify-between gap-3">
            <span className="nums text-xs text-muted">{o.order_number}</span>
            <span className={`shrink-0 text-xs font-medium ${estado.tono}`}>● {estado.label}</span>
          </div>
          <p className="line-clamp-2 font-medium capitalize">{nombres || "Pedido"}</p>
          <p className="text-xs text-muted">
            {unidades} {unidades === 1 ? (COPY.itemSingular ?? "producto") : (COPY.itemPlural ?? "productos")} · <span className="nums">{mxn(o.total_cents)}</span> · {dia(o.created_at)}
          </p>
        </div>
      </div>

      {vivo && o.status !== "pending" && (
        <p className="text-xs">
          {resenado ? (
            <span className={VERDE}>Reseña ✓</span>
          ) : o.delivered_at ? (
            <span className={AMBAR}>Reseña pendiente</span>
          ) : (
            <span className="text-muted">Podrás reseñarlo al recibirlo</span>
          )}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {o.status === "pending" ? (
          <Link href={`/pedido/${o.order_number}/pagar`} className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-contrast">
            {o.payment_method === "aplazo" ? "Continuar en Aplazo" : "Completar pago"} →
          </Link>
        ) : (
          <>
            {faltaParDeCombo(o.status, o.combo_parent_order_id, o.order_items_combo ?? []) && (
              <Link href={`/pedido/${o.order_number}/combo`} className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-contrast">
                Completa tu combo
              </Link>
            )}
            {vivo && o.delivered_at && o.review_token && !resenado && (
              <Link href={`/resena/${o.review_token}`} className="inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-contrast">
                Reseñar y ganar 10%
              </Link>
            )}
            {vivo && (
              <Link
                href={o.review_token ? `/pedido/${o.order_number}?t=${o.review_token}` : `/rastrear?o=${o.order_number}`}
                className="inline-flex h-10 items-center rounded-full border border-border px-4 text-sm text-muted transition-colors hover:text-text"
              >
                {o.delivered_at ? "Ver pedido" : "Seguimiento"}
              </Link>
            )}
          </>
        )}
      </div>

      <details className="[&_summary]:cursor-pointer">
        <summary className="text-xs font-medium text-accent">Ver detalle</summary>
        <div className="mt-2 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{ITEMS_ORDERED}</p>
            <ul className="mt-1.5 space-y-0.5 text-muted">
              {items.map((it, i) => (
                <li key={i} className="capitalize">{it.product_name} ({it.variant_label}) × {it.quantity}</li>
              ))}
            </ul>
          </div>
          <div>
            {(o.tracking_number || o.estimated_delivery) && (
              <div className="mb-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Rastreo</p>
                <div className="mt-1.5 text-muted">
                  {o.tracking_number && (
                    <p>
                      {carrierName(o.carrier) ?? "Paquetería"} <span className="nums text-text">{o.tracking_number}</span>
                    </p>
                  )}
                  {o.estimated_delivery && (
                    <p>
                      Entrega estimada: <span className="text-text">{fechaEntrega(o.estimated_delivery)}</span>
                    </p>
                  )}
                  {rastreoUrl && (
                    <a href={rastreoUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-block font-medium text-accent underline">
                      Rastrear con la paquetería →
                    </a>
                  )}
                </div>
              </div>
            )}
            {ga && (
              <div className="mb-3 rounded-lg border border-accent/40 bg-accent-soft/60 p-2.5">
                <p className="text-xs font-semibold text-accent">Garantía en proceso{ga.cerrada_at ? " — resuelta" : ""}</p>
                {ga.retorno_tracking && (
                  <p className="mt-1 text-xs text-muted">
                    Regreso: <span className="nums text-text">{ga.retorno_tracking}</span>
                    {ga.retorno_label_url && <> · <a className="text-accent underline" href={ga.retorno_label_url} target="_blank" rel="noopener noreferrer">tu etiqueta</a></>}
                    {ga.recibido_at && " · ✓ recibido"}
                  </p>
                )}
                {ga.repo_tracking && (
                  <p className="mt-0.5 text-xs text-muted">Reposición: <span className="nums text-text">{ga.repo_tracking}</span></p>
                )}
              </div>
            )}
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Datos de envío</p>
            <div className="mt-1.5 text-muted">
              {ship.name && <p className="text-text">{ship.name}</p>}
              {ship.phone && <p className="nums">{ship.phone}</p>}
              {addr && <p className="leading-relaxed">{addr}</p>}
              {!ship.name && !addr && <p>Sin datos de envío.</p>}
            </div>
          </div>
        </div>
      </details>
    </li>
  );
}
