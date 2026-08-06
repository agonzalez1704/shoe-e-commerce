import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";

// Analytics over the online store (Blade). Mirrors the "fiable" POS MCP:
// ventas, más vendidos, fiados (= pedidos pendientes de pago), inventarios,
// estado de inventario, búsqueda. Amounts in MXN (centavos -> pesos).

export type Periodo = "hoy" | "7d" | "30d";

const peso = (cents: number) => Number((cents / 100).toFixed(2));
const PAID = ["paid", "fulfilled"] as const;

function sinceISO(p: Periodo): string {
  const now = new Date();
  if (p === "hoy") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const days = p === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 86400_000).toISOString();
}

// ---- ventas_resumen ----
export async function ventasResumen(periodo: Periodo) {
  const db = createAdminClient();
  const { data } = await db
    .from("orders")
    .select("total_cents")
    .in("status", [...PAID])
    .gte("created_at", sinceISO(periodo));

  const ventas = data?.length ?? 0;
  const ingresos = (data ?? []).reduce((s, o) => s + o.total_cents, 0);
  return {
    periodo,
    ventas,
    ingresos_mxn: peso(ingresos),
    ticket_promedio_mxn: ventas ? peso(ingresos / ventas) : 0,
    ganancia_estimada_mxn: null, // la tienda no captura costo por producto
  };
}

// ---- mas_vendidos ----
export async function masVendidos(periodo: Periodo, limite = 5) {
  const db = createAdminClient();
  const { data } = await db
    .from("order_items")
    .select("product_name, sku, quantity, line_total_cents, orders!inner(status, created_at)")
    .gte("orders.created_at", sinceISO(periodo))
    .in("orders.status", [...PAID]);

  type Row = { product_name: string; sku: string; quantity: number; line_total_cents: number };
  const rows = (data ?? []) as unknown as Row[];
  const map = new Map<string, { producto: string; sku: string; vendidos: number; ingreso: number }>();
  for (const r of rows) {
    const key = r.sku || r.product_name;
    const cur = map.get(key) ?? { producto: r.product_name, sku: r.sku, vendidos: 0, ingreso: 0 };
    cur.vendidos += r.quantity;
    cur.ingreso += r.line_total_cents;
    map.set(key, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.ingreso - a.ingreso)
    .slice(0, Math.min(Math.max(limite, 1), 20))
    .map((x) => ({ producto: x.producto, sku: x.sku, vendidos: x.vendidos, ingreso_mxn: peso(x.ingreso) }));
}

// ---- fiados_pendientes (online = pedidos pendientes de pago: OXXO/SPEI/Aplazo) ----
// Chasing an unpaid order needs a name, a phone and how long is left — the
// email and the total alone can't be acted on.
const waLink = (phone?: string | null) => {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return null;
  return `https://wa.me/${d.length === 10 ? `52${d}` : d}`;
};

export async function fiadosPendientes() {
  const db = createAdminClient();
  const { data } = await db
    .from("orders")
    .select(
      "id, order_number, email, total_cents, created_at, expires_at, payment_method, shipping_address, " +
        "order_items(product_name, quantity), payments(reference, voucher_url, status)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  type Row = {
    id: string; order_number: string; email: string; total_cents: number;
    created_at: string; expires_at: string | null; payment_method: string | null;
    shipping_address: Record<string, string> | null;
    order_items: { product_name: string; quantity: number }[];
    payments: { reference: string | null; voucher_url: string | null; status: string }[];
  };
  const rows = (data ?? []) as unknown as Row[];
  const now = Date.now();

  const fiados = rows.map((o) => {
    const ship = o.shipping_address ?? {};
    const pay = o.payments?.[0];
    const horas = o.expires_at
      ? Math.round((new Date(o.expires_at).getTime() - now) / 3600_000)
      : null;
    return {
      pedido: o.order_number,
      cliente: ship.name ?? o.email,
      email: o.email,
      telefono: ship.phone ?? null,
      whatsapp: waLink(ship.phone),
      metodo: o.payment_method,
      total_mxn: peso(o.total_cents),
      dias: Math.floor((now - new Date(o.created_at).getTime()) / 86400_000),
      // negative = already past its deadline; null = no expiry (aplazo/mercadopago)
      horas_para_vencer: horas,
      vencido: horas != null && horas <= 0,
      referencia: pay?.reference ?? null,
      voucher_url: pay?.voucher_url ?? null,
      productos: o.order_items.map((i) => (i.quantity > 1 ? `${i.product_name} x${i.quantity}` : i.product_name)).join(", "),
    };
  });

  // soonest deadline first: that's the order to call people in
  fiados.sort((a, b) => (a.horas_para_vencer ?? 9e9) - (b.horas_para_vencer ?? 9e9));

  return {
    total_mxn: peso(rows.reduce((s, o) => s + o.total_cents, 0)),
    pendientes: rows.length,
    por_vencer_24h: fiados.filter((f) => f.horas_para_vencer != null && f.horas_para_vencer > 0 && f.horas_para_vencer <= 24).length,
    fiados,
  };
}

// ---- buscar_pedido ----
// "Fulanita dice que hizo un pedido" is the most common message a store gets;
// answering it needed a hand-written query until now.
export async function buscarPedido(q: string) {
  const db = createAdminClient();
  const term = q.trim().replace(/[,()%*\\]/g, "").slice(0, 60);
  if (!term) return { encontrados: 0, pedidos: [], nota: "Escribe un nombre, correo, teléfono o número de pedido." };

  const digits = term.replace(/\D/g, "");
  const filters = [
    `order_number.ilike.%${term}%`,
    `email.ilike.%${term}%`,
    `shipping_address->>name.ilike.%${term}%`,
  ];
  if (digits.length >= 7) filters.push(`shipping_address->>phone.ilike.%${digits}%`);

  const { data } = await db
    .from("orders")
    .select("order_number, status, payment_method, total_cents, email, created_at, paid_at, fulfillment_stage, shipping_address, order_items(product_name, variant_label, quantity)")
    .or(filters.join(","))
    .order("created_at", { ascending: false })
    .limit(20);

  type Row = {
    order_number: string; status: string; payment_method: string | null; total_cents: number;
    email: string; created_at: string; paid_at: string | null; fulfillment_stage: string | null;
    shipping_address: Record<string, string> | null;
    order_items: { product_name: string; variant_label: string; quantity: number }[];
  };
  const rows = (data ?? []) as unknown as Row[];

  return {
    encontrados: rows.length,
    // an empty result is a real answer here: the order never existed
    nota: rows.length ? undefined : `No hay ningún pedido que coincida con "${term}". Puede que nunca se haya completado el checkout.`,
    pedidos: rows.map((o) => ({
      pedido: o.order_number,
      cliente: o.shipping_address?.name ?? o.email,
      email: o.email,
      telefono: o.shipping_address?.phone ?? null,
      estado: o.status,
      etapa: o.fulfillment_stage,
      metodo: o.payment_method,
      total_mxn: peso(o.total_cents),
      creado: o.created_at,
      pagado: o.paid_at,
      productos: o.order_items.map((i) => `${i.product_name} (${i.variant_label}) x${i.quantity}`).join(", "),
    })),
  };
}

// ---- estado_pedido ----
export async function estadoPedido(orderNumber: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("orders")
    .select(
      "order_number, status, payment_method, total_cents, subtotal_cents, discount_cents, email, created_at, paid_at, expires_at, " +
        "fulfillment_stage, carrier, tracking_number, tracking_url, estimated_delivery, shipped_at, delivered_at, needs_invoice, " +
        "shipping_address, order_items(product_name, variant_label, quantity), payments(provider, method, status, reference, voucher_url, expires_at)",
    )
    .eq("order_number", orderNumber.trim().toUpperCase())
    .maybeSingle();

  if (!data) return { encontrado: false, nota: `No existe el pedido ${orderNumber}.` };

  type Row = {
    order_number: string; status: string; payment_method: string | null;
    total_cents: number; discount_cents: number | null; email: string;
    created_at: string; paid_at: string | null; expires_at: string | null;
    fulfillment_stage: string | null; carrier: string | null;
    tracking_number: string | null; tracking_url: string | null;
    estimated_delivery: string | null; shipped_at: string | null; delivered_at: string | null;
    needs_invoice: boolean | null;
    shipping_address: Record<string, string> | null;
    order_items: { product_name: string; variant_label: string; quantity: number }[];
    payments: { provider: string; method: string | null; status: string; reference: string | null; voucher_url: string | null; expires_at: string | null }[];
  };
  const o = data as unknown as Row;
  const ship = o.shipping_address ?? {};
  const pay = o.payments?.[0];

  return {
    encontrado: true,
    pedido: o.order_number,
    estado: o.status,
    etapa_entrega: o.fulfillment_stage,
    pago: {
      metodo: o.payment_method,
      estado: pay?.status ?? null,
      proveedor: pay?.provider ?? null,
      referencia: pay?.reference ?? null,
      voucher_url: pay?.voucher_url ?? null,
      vence: pay?.expires_at ?? o.expires_at,
      pagado_el: o.paid_at,
    },
    envio: {
      paqueteria: o.carrier,
      guia: o.tracking_number,
      rastreo: o.tracking_url,
      entrega_estimada: o.estimated_delivery,
      enviado_el: o.shipped_at,
      entregado_el: o.delivered_at,
      destino: [ship.line1, ship.neighborhood, ship.city, ship.region, ship.postal].filter(Boolean).join(", ") || null,
    },
    cliente: { nombre: ship.name ?? null, email: o.email, telefono: ship.phone ?? null, whatsapp: waLink(ship.phone) },
    factura_solicitada: o.needs_invoice,
    total_mxn: peso(o.total_cents),
    descuento_mxn: peso(o.discount_cents ?? 0),
    productos: o.order_items.map((i) => `${i.product_name} (${i.variant_label}) x${i.quantity}`).join(", "),
    seguimiento_url: `${SITE_URL}/rastrear?o=${o.order_number}`,
  };
}

// Shared loader: active variants with brand, price, stock, availability.
async function variantStock() {
  const db = createAdminClient();
  const [{ data: variants }, { data: avail }] = await Promise.all([
    db
      .from("variants")
      .select("id, sku, color, size_value, size_system, width, price_cents, products!inner(name, slug, status, made_to_order, base_price_cents, brands(name))")
      .eq("status", "active"),
    db.from("variant_availability").select("variant_id, qty_available"),
  ]);
  const availMap = new Map((avail ?? []).map((a) => [a.variant_id, a.qty_available]));

  type V = {
    id: string; sku: string; color: string; size_value: string; size_system: string; width: string;
    price_cents: number | null;
    products: { name: string; slug: string; status: string; made_to_order: boolean; base_price_cents: number; brands: { name: string } | null };
  };
  return ((variants ?? []) as unknown as V[])
    .filter((v) => v.products.status === "active")
    .map((v) => ({
      brand: v.products.brands?.name ?? "Sin marca",
      productName: v.products.name,
      slug: v.products.slug,
      sku: v.sku,
      color: v.color,
      talla: `${v.size_system} ${v.size_value}`,
      width: v.width,
      precio: v.price_cents ?? v.products.base_price_cents,
      available: availMap.get(v.id) ?? 0,
      madeToOrder: v.products.made_to_order,
    }));
}

// ---- listar_inventarios (= por marca) ----
export async function listarInventarios() {
  const rows = await variantStock();
  const map = new Map<string, { inventario: string; productos: Set<string>; unidades: number; valor: number }>();
  for (const r of rows) {
    const g = map.get(r.brand) ?? { inventario: r.brand, productos: new Set<string>(), unidades: 0, valor: 0 };
    g.productos.add(r.productName);
    if (!r.madeToOrder) {
      g.unidades += r.available;
      g.valor += r.available * r.precio;
    }
    map.set(r.brand, g);
  }
  return [...map.values()].map((g) => ({
    inventario: g.inventario,
    productos: g.productos.size,
    unidades: g.unidades,
    valor_venta_mxn: peso(g.valor),
  }));
}

// ---- estado_inventario ----
export async function estadoInventario() {
  const rows = await variantStock();
  const LOW = 3;

  const porMarca = new Map<string, { inventario: string; productos: Set<string>; unidades: number; valor: number; agotados: number; bajo_stock: number }>();
  const agotados: { inventario: string; sku: string; nombre: string }[] = [];
  const bajo: { inventario: string; sku: string; nombre: string; stock: number }[] = [];

  for (const r of rows) {
    const g = porMarca.get(r.brand) ?? { inventario: r.brand, productos: new Set<string>(), unidades: 0, valor: 0, agotados: 0, bajo_stock: 0 };
    g.productos.add(r.productName);
    if (!r.madeToOrder) {
      g.unidades += r.available;
      g.valor += r.available * r.precio;
      if (r.available <= 0) { g.agotados++; agotados.push({ inventario: r.brand, sku: r.sku, nombre: r.productName }); }
      else if (r.available <= LOW) { g.bajo_stock++; bajo.push({ inventario: r.brand, sku: r.sku, nombre: r.productName, stock: r.available }); }
    }
    porMarca.set(r.brand, g);
  }

  const tracked = rows.filter((r) => !r.madeToOrder);
  return {
    productos: new Set(rows.map((r) => r.productName)).size,
    unidades: tracked.reduce((s, r) => s + r.available, 0),
    valor_venta_mxn: peso(tracked.reduce((s, r) => s + r.available * r.precio, 0)),
    por_inventario: [...porMarca.values()].map((g) => ({
      inventario: g.inventario, productos: g.productos.size, unidades: g.unidades,
      valor_venta_mxn: peso(g.valor), agotados: g.agotados, bajo_stock: g.bajo_stock,
    })),
    agotados,
    bajo_stock: bajo,
    nota: "Productos 'hecho sobre pedido' no se cuentan como stock (disponibilidad ilimitada).",
  };
}

// ---- buscar_producto ----
const STOP = new Set(["de", "la", "el", "los", "las", "un", "una", "para", "con", "por", "que", "y", "the", "for", "and"]);
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export async function buscarProducto(q: string) {
  const rows = await variantStock();
  const tokens = norm(q).split(/\s+/).filter((t) => t && !STOP.has(t));
  if (tokens.length === 0) return [];

  const matched = rows.filter((r) => {
    const hay = norm([r.productName, r.sku, r.brand, r.color, r.talla].join(" "));
    return tokens.every((t) => hay.includes(t));
  });

  return matched
    .sort((a, b) => (b.available > 0 ? 1 : 0) - (a.available > 0 ? 1 : 0) || a.productName.localeCompare(b.productName))
    .slice(0, 15)
    .map((r) => ({
      inventario: r.brand,
      sku: r.sku,
      nombre: r.productName,
      marca: r.brand,
      color: r.color,
      talla: r.talla,
      costo_mxn: null,
      precio_mxn: peso(r.precio),
      stock: r.madeToOrder ? "sobre pedido" : r.available,
      // made-to-order: SIEMPRE se puede vender aunque stock sea 0 (on-demand)
      disponible: r.madeToOrder ? true : r.available > 0,
      entrega: r.madeToOrder ? "Sobre pedido · 4-7 días hábiles" : r.available > 0 ? "En existencia" : "Sin stock",
      link: `${SITE_URL}/products/${r.slug}`,
      activo: true,
    }));
}

// ---- verificar_pago ----
// When a buyer says "ya pagué", our own row may not have caught up (a webhook can
// be late or lost). Ask the provider directly and compare with what we recorded.
export async function verificarPago(orderNumber: string) {
  const db = createAdminClient();
  const { data: order } = await db
    .from("orders")
    .select("id, order_number, status, payment_method, total_cents, paid_at")
    .eq("order_number", orderNumber.trim().toUpperCase())
    .maybeSingle();
  if (!order) return { encontrado: false, nota: `No existe el pedido ${orderNumber}.` };

  const { data: pays } = await db
    .from("payments")
    .select("provider, provider_charge_id, status, amount_cents")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });
  const pay = (pays ?? [])[0];

  const nuestro = {
    estado_pedido: order.status,
    estado_pago: pay?.status ?? null,
    pagado_el: order.paid_at,
    total_mxn: peso(order.total_cents),
  };

  let proveedor: Record<string, unknown> | null = null;
  try {
    if (order.payment_method === "mercadopago") {
      const { getMpPayment } = await import("@/lib/mercadopago");
      // our charge id is "mp_<paymentId>"
      const id = (pay?.provider_charge_id ?? "").replace(/^mp_/, "");
      if (id) {
        const p = await getMpPayment(id);
        proveedor = { fuente: "mercadopago", estado: p.status, monto: p.transaction_amount, referencia: p.external_reference };
      }
    } else if (pay?.provider_charge_id) {
      const { getConektaOrder } = await import("@/lib/conekta");
      const co = await getConektaOrder(pay.provider_charge_id);
      const charges = (co.charges?.data ?? []).map((c) => ({ estado: c.status, tipo: c.payment_method?.type, referencia: c.payment_method?.reference }));
      proveedor = { fuente: "conekta", estado: co.payment_status, monto_centavos: co.amount, cargos: charges };
    }
  } catch (e) {
    proveedor = { error: e instanceof Error ? e.message : "no se pudo consultar al proveedor" };
  }

  const proveedorPagado = proveedor
    ? /paid|approved|accredited/i.test(String(proveedor.estado ?? ""))
    : null;
  const nosotrosPagado = ["paid", "fulfilled"].includes(order.status);

  return {
    encontrado: true,
    pedido: order.order_number,
    metodo: order.payment_method,
    nuestro_registro: nuestro,
    proveedor,
    // the case worth catching: money in, order never confirmed
    discrepancia:
      proveedorPagado === true && !nosotrosPagado
        ? "El proveedor reporta el pago como cubierto pero el pedido NO está marcado como pagado. Revisar el webhook."
        : proveedorPagado === false && nosotrosPagado
          ? "Nuestro pedido está pagado pero el proveedor no lo confirma. Revisar manualmente."
          : null,
  };
}

// ---- embudo_checkout ----
// The disabled-button bug cost ~70% of checkouts and left no trace: those buyers
// never create an order, so nothing else in this file can see them.
export async function embudoCheckout(periodo: Periodo) {
  const db = createAdminClient();
  // Counted in SQL on purpose: PostgREST caps a response at 1000 rows, so
  // grouping the events here would silently report a slice as the whole month.
  const { data, error } = await db.rpc("checkout_funnel", { p_desde: sinceISO(periodo) });
  if (error) return { periodo, error: error.message };
  const f = (Array.isArray(data) ? data[0] : data) as {
    visitantes: number; vieron_producto: number; llegaron_al_carrito: number;
    llegaron_al_checkout: number; pedidos_creados: number; pedidos_pagados: number;
  } | null;
  if (!f) return { periodo, error: "sin datos" };

  const pct = (a: number, b: number) => (b > 0 ? Number(((a / b) * 100).toFixed(1)) : 0);
  const abandono = Math.max(0, f.llegaron_al_checkout - f.pedidos_creados);

  return {
    periodo,
    visitantes: f.visitantes,
    vieron_producto: f.vieron_producto,
    llegaron_al_carrito: f.llegaron_al_carrito,
    llegaron_al_checkout: f.llegaron_al_checkout,
    pedidos_creados: f.pedidos_creados,
    pedidos_pagados: f.pedidos_pagados,
    conversion_pct: pct(f.pedidos_pagados, f.visitantes),
    // the number that surfaces a broken checkout: reached the form, never ordered
    abandono_en_formulario: abandono,
    abandono_formulario_pct: pct(abandono, f.llegaron_al_checkout),
    pago_no_completado: Math.max(0, f.pedidos_creados - f.pedidos_pagados),
    alerta:
      f.llegaron_al_checkout >= 10 && pct(abandono, f.llegaron_al_checkout) > 50
        ? "Más de la mitad de quienes llegan al checkout no generan pedido. Suele ser un campo obligatorio que bloquea el botón, no falta de interés."
        : null,
  };
}

// ---- reenviar_instrucciones_pago (la única herramienta que escribe) ----
// Sends the buyer their voucher again. It touches a real inbox and it's callable
// by a model, so it refuses more often than the admin button does: only a
// still-payable order, only one send per COOLDOWN_H, and never for a method that
// has no reference to resend.
const COOLDOWN_H = 6;

export async function reenviarInstruccionesPago(orderNumber: string) {
  const db = createAdminClient();
  const num = orderNumber.trim().toUpperCase();

  const { data: order } = await db
    .from("orders")
    .select("id, order_number, email, total_cents, status, payment_method, expires_at, instructions_resent_at")
    .eq("order_number", num)
    .maybeSingle();

  if (!order) return { enviado: false, motivo: `No existe el pedido ${num}.` };
  if (order.status !== "pending") return { enviado: false, motivo: `El pedido ya está "${order.status}", no hay nada que cobrar.` };
  if (order.payment_method !== "oxxo" && order.payment_method !== "spei") {
    return { enviado: false, motivo: `Ese pedido se paga con ${order.payment_method}, que no usa referencia. Mándale el link de pago desde el admin.` };
  }
  if (order.expires_at && new Date(order.expires_at).getTime() <= Date.now()) {
    return { enviado: false, motivo: "La referencia ya venció; hay que generar un pedido nuevo." };
  }

  const last = order.instructions_resent_at ? new Date(order.instructions_resent_at).getTime() : 0;
  const horas = (Date.now() - last) / 3600_000;
  if (last && horas < COOLDOWN_H) {
    return {
      enviado: false,
      motivo: `Ya se le reenviaron las instrucciones hace ${horas.toFixed(1)} h. Espera ${(COOLDOWN_H - horas).toFixed(1)} h para no saturarlo.`,
    };
  }

  const { data: payment } = await db
    .from("payments")
    .select("reference, clabe, voucher_url")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!payment?.reference && !payment?.clabe) {
    return { enviado: false, motivo: "El pedido no tiene referencia registrada." };
  }

  const { data: items } = await db
    .from("order_items")
    .select("product_name, variant_label, unit_price_cents, quantity")
    .eq("order_id", order.id);

  const { sendVoucherEmail } = await import("@/lib/email");
  await sendVoucherEmail({
    to: order.email,
    orderNumber: order.order_number,
    totalCents: order.total_cents,
    method: order.payment_method,
    reference: payment.reference ?? undefined,
    clabe: payment.clabe ?? undefined,
    voucherUrl: payment.voucher_url ?? undefined,
    expiresAt: order.expires_at,
    lines: (items ?? []).map((i) => ({
      name: `${i.product_name} (${i.variant_label})`,
      quantity: i.quantity,
      lineTotalCents: i.unit_price_cents * i.quantity,
    })),
  });

  await db.from("orders").update({ instructions_resent_at: new Date().toISOString() }).eq("id", order.id);

  return {
    enviado: true,
    pedido: order.order_number,
    a: order.email,
    referencia: payment.reference ?? payment.clabe,
    vence: order.expires_at,
  };
}
