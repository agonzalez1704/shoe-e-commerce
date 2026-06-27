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
export async function fiadosPendientes() {
  const db = createAdminClient();
  const { data } = await db
    .from("orders")
    .select("email, total_cents, created_at, payment_method, order_items(product_name, quantity)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  type Row = { email: string; total_cents: number; created_at: string; payment_method: string | null; order_items: { product_name: string; quantity: number }[] };
  const rows = (data ?? []) as unknown as Row[];
  const now = Date.now();
  const fiados = rows.map((o) => ({
    cliente: o.email,
    metodo: o.payment_method,
    total_mxn: peso(o.total_cents),
    dias: Math.floor((now - new Date(o.created_at).getTime()) / 86400_000),
    productos: o.order_items.map((i) => (i.quantity > 1 ? `${i.product_name} x${i.quantity}` : i.product_name)).join(", "),
  }));
  return {
    total_mxn: peso(rows.reduce((s, o) => s + o.total_cents, 0)),
    pendientes: rows.length,
    fiados,
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
      entrega: r.madeToOrder ? "Sobre pedido · 3-5 días hábiles" : r.available > 0 ? "En existencia" : "Sin stock",
      link: `${SITE_URL}/products/${r.slug}`,
      activo: true,
    }));
}
