import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCents } from "@/lib/money";
import { comboOf, precioPar, type ComboConfig } from "@/lib/pricing";
import { ComboExpress, type ParElegible } from "@/components/ComboExpress";
import { PagoComplemento } from "@/components/PagoComplemento";
import { pedidoAutorizado } from "./actions";

// Checkout exprés para completar el combo de un pedido ya pagado: elige el
// segundo par y paga solo la diferencia. Ruta bloqueante: token/sesión.
export const instant = false;

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

export default async function ComboExpresPage({
  params, searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { orderNumber } = await params;
  const { t } = await searchParams;
  const order = await pedidoAutorizado(decodeURIComponent(orderNumber), t ?? null);

  const Caja = ({ children }: { children: React.ReactNode }) => (
    <div className="mx-auto max-w-3xl py-12">{children}</div>
  );

  if (!order) {
    return (
      <Caja>
        <h1 className="text-2xl font-semibold tracking-tight">Completa tu combo</h1>
        <p className="mt-3 text-sm text-muted">
          No pudimos verificar tu pedido. Abre la liga que te enviamos por correo, o{" "}
          <Link href="/cuenta" className="text-accent underline">inicia sesión</Link> con la cuenta de tu compra.
        </p>
      </Caja>
    );
  }

  const admin = createAdminClient();

  // ¿Ya hay complemento? Vivo → mándalo a pagar; pagado → ya quedó.
  const { data: hijo } = await admin
    .from("orders")
    .select("id, order_number, status, total_cents")
    .eq("combo_parent_order_id", order.id)
    .not("status", "in", "(cancelled,refunded)")
    .maybeSingle();
  if (hijo) {
    // El par que aparto (nombre, variante y foto del color) y si ya se genero
    // ficha de pago — con ficha viva, cambiar de par queda cerrado.
    const [{ data: item }, { data: pago }] = await Promise.all([
      admin.from("order_items")
        .select("product_name, variant_label, variants(color, products(product_images(url, position, color)))")
        .eq("order_id", hijo.id).limit(1).maybeSingle(),
      admin.from("payments").select("id").eq("order_id", hijo.id).limit(1).maybeSingle(),
    ]);
    const vv = item?.variants as unknown as { color: string; products: { product_images: { url: string; position: number; color: string | null }[] } } | null;
    const fotos = [...(vv?.products?.product_images ?? [])].sort((a, b) => a.position - b.position);
    const elegido = item
      ? {
          nombre: item.product_name.replace(" (completa tu combo)", ""),
          label: item.variant_label,
          imagen: (fotos.find((f) => f.color?.toLowerCase() === vv?.color?.toLowerCase()) ?? fotos[0])?.url ?? null,
        }
      : null;
    return (
      <Caja>
        <h1 className="text-2xl font-semibold tracking-tight">Completa tu combo</h1>
        {hijo.status === "pending" ? (
          // Par apartado sin pagar: los MISMOS metodos del checkout, aqui mismo.
          <PagoComplemento
            parentOrderNumber={order.order_number}
            token={t ?? null}
            childOrderNumber={hijo.order_number}
            totalCents={hijo.total_cents}
            elegido={elegido}
            conektaPublicKey={process.env.NEXT_PUBLIC_CONEKTA_PUBLIC_KEY ?? ""}
            mpEnabled={!!process.env.MERCADOPAGO_ACCESS_TOKEN}
            fichaGenerada={!!pago}
          />
        ) : (
          <p className="mt-3 text-sm text-muted">
            Tu combo ya quedó completo con el pedido <span className="nums font-medium text-text">{hijo.order_number}</span>. ¡Gracias!
          </p>
        )}
      </Caja>
    );
  }

  // Elegibilidad para mostrar (el RPC la recalcula al confirmar): el pedido
  // trae un par suelto de un grupo de combo.
  const { data: items } = await admin
    .from("order_items")
    .select("quantity, unit_price_cents, variants(fuera_de_combo, exotico, products(combo_group, combo_min_qty, combo_price_cents, combo_price_mixto_cents, combo_price_exotico_cents))")
    .eq("order_id", order.id);
  type Fila = { quantity: number; unit_price_cents: number; variants: { fuera_de_combo: boolean; exotico: boolean; products: { combo_group: string | null; combo_min_qty: number | null; combo_price_cents: number | null; combo_price_mixto_cents: number | null; combo_price_exotico_cents: number | null } | null } | null };
  const grupos = new Map<string, { combo: ComboConfig; unidades: number; exoticos: number; precios: { unit: number; exotico: boolean }[] }>();
  for (const it of (items ?? []) as unknown as Fila[]) {
    const vv = it.variants;
    const p = vv?.products;
    const combo = p ? comboOf(p.combo_min_qty, p.combo_price_cents, p.combo_price_mixto_cents, p.combo_price_exotico_cents) : null;
    if (!vv || vv.fuera_de_combo || !p?.combo_group || !combo) continue;
    const g = grupos.get(p.combo_group) ?? { combo, unidades: 0, exoticos: 0, precios: [] };
    g.unidades += it.quantity;
    if (vv.exotico) g.exoticos += it.quantity;
    for (let i = 0; i < it.quantity; i++) g.precios.push({ unit: it.unit_price_cents, exotico: vv.exotico });
    grupos.set(p.combo_group, g);
  }
  const elegible = [...grupos.entries()].find(([, g]) => g.unidades % g.combo.minQty === g.combo.minQty - 1);
  // El par suelto es el que el pool deja sin pareja (espejo de crear_pedido_complemento
  // 0066): exotico si los exoticos son impares, el mas barato de su piel.
  const sueltoExotico = !!elegible && elegible[1].exoticos % 2 === 1;
  const pagadoSuelto = elegible
    ? Math.min(...elegible[1].precios.filter((u) => u.exotico === sueltoExotico).map((u) => u.unit))
    : 0;
  const diffPara = (exotico: boolean) =>
    elegible ? precioPar(elegible[1].combo, (sueltoExotico ? 1 : 0) + (exotico ? 1 : 0)) - pagadoSuelto : 0;
  const diff = elegible ? Math.min(diffPara(false), diffPara(true)) : 0;

  if (!elegible || (order.status !== "paid" && order.status !== "fulfilled") || diff <= 0) {
    return (
      <Caja>
        <h1 className="text-2xl font-semibold tracking-tight">Completa tu combo</h1>
        <p className="mt-3 text-sm text-muted">
          Este pedido no tiene un par pendiente de combo{order.status === "pending" ? " (aún no está pagado)" : ""}.
          {" "}<Link href="/products" className="text-accent underline">Ver la tienda</Link>
        </p>
      </Caja>
    );
  }

  // Los pares que pueden entrar: mismo grupo de combo, activos, con su foto
  // del color y sus tallas.
  const { data: prods } = await admin
    .from("products")
    .select("id, name, slug, base_price_cents, product_images(url, position, color), variants(id, size_system, size_value, width, color, status, fuera_de_combo, exotico)")
    .eq("combo_group", elegible[0])
    .eq("status", "active")
    .order("name");

  const pares: ParElegible[] = (prods ?? []).flatMap((p) => {
    const porColor = new Map<string, { exotico: boolean; variantes: { id: string; talla: string }[] }>();
    for (const v of p.variants ?? []) {
      if (v.status !== "active" || v.fuera_de_combo) continue;
      const c = porColor.get(v.color) ?? { exotico: false, variantes: [] };
      c.variantes.push({ id: v.id, talla: `${v.size_system} ${v.size_value}` });
      if (v.exotico) c.exotico = true;
      porColor.set(v.color, c);
    }
    const fotos = [...(p.product_images ?? [])].sort((a, b) => a.position - b.position);
    return [...porColor.entries()].map(([color, c]) => ({
      nombre: p.name,
      color,
      exotico: c.exotico,
      diffCents: diffPara(c.exotico),
      imagen: (fotos.find((f) => f.color?.toLowerCase() === color.toLowerCase()) ?? fotos[0])?.url ?? null,
      variantes: c.variantes.sort((a, b) => parseFloat(a.talla.replace(/\D+/, "")) - parseFloat(b.talla.replace(/\D+/, ""))),
    }));
  });

  return (
    <div className="mx-auto max-w-4xl py-10">
      <p className="text-sm text-muted">Pedido <span className="nums font-medium text-text">{order.order_number}</span></p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Completa tu combo 2 pares</h1>
      <p className="mt-2 text-sm text-muted">
        Ya pagaste tu primer par. Elige el segundo y paga solo la diferencia, desde{" "}
        <span className="nums font-semibold text-accent">{mxn(diff)}</span> — envío gratis, como siempre.
        {diffPara(true) !== diffPara(false) && " Un par con grabado exótico cuesta un poco más."}
      </p>
      <ComboExpress pares={pares} orderNumber={order.order_number} token={t ?? null} />
    </div>
  );
}
