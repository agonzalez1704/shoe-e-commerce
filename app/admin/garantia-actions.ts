"use server";

import { revalidatePath } from "next/cache";
import { requirePermiso } from "@/lib/permisos-guard";
import { ORIGIN, type Address } from "@/lib/skydropx";

// Garantías: dos envíos más sobre el mismo pedido. El retorno viaja AL REVÉS
// (del cliente a la bodega); la reposición es un envío normal. El estado se
// deriva de qué guías y fechas existen — no hay columna de estado que
// desincronizar.

type Pierna = "retorno" | "repo";

// El Update de Supabase es tipado por columna: objetos concretos por pierna en
// vez de llaves computadas, que degradan a index-signature y no compilan.
type Guia = { carrier: string | null; tracking: string | null; url: string | null; label?: string | null };
const patchPierna = (pierna: Pierna, g: Guia) =>
  pierna === "retorno"
    ? { retorno_carrier: g.carrier, retorno_tracking: g.tracking, retorno_url: g.url, ...(g.label !== undefined ? { retorno_label_url: g.label } : {}) }
    : { repo_carrier: g.carrier, repo_tracking: g.tracking, repo_url: g.url, ...(g.label !== undefined ? { repo_label_url: g.label } : {}) };

// Skydropx provider name → our carrier keys (igual que en actions.ts).
const CARRIER_MAP: Record<string, string> = {
  estafeta: "estafeta", fedex: "fedex", dhl: "dhl",
  paquetexpress: "paquetexpress", ninetynineminutes: "99minutos", correos: "correos",
};

async function direccionCliente(supabase: Awaited<ReturnType<typeof requirePermiso>>, orderId: string): Promise<Address> {
  const { data: o } = await supabase.from("orders").select("shipping_address, email").eq("id", orderId).maybeSingle();
  if (!o?.shipping_address) throw new Error("El pedido no tiene dirección de envío.");
  const s = o.shipping_address as Record<string, string>;
  return {
    name: s.name || "Cliente", phone: s.phone || "", email: o.email,
    street1: s.line1 || "", area_level1: s.region || "", area_level2: s.city || "",
    area_level3: s.neighborhood || "", postal_code: s.postal || "", country_code: "MX",
  };
}

export async function abrirGarantia(orderId: string, razon: string) {
  try {
    const supabase = await requirePermiso("pedidos_gestionar");
    if (!razon.trim()) return { ok: false as const, error: "Escribe la razón de la garantía." };
    const { error } = await supabase.from("garantias").insert({ order_id: orderId, razon: razon.trim() });
    if (error) {
      return { ok: false as const, error: /duplicate|unique/i.test(error.message) ? "Este pedido ya tiene una garantía abierta." : error.message };
    }
    revalidatePath("/admin/orders/[id]", "page");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "No se pudo abrir la garantía" };
  }
}

// Cotiza la pierna pedida. El retorno intercambia las direcciones: el paquete
// sale del domicilio del cliente hacia la bodega.
export async function cotizarGarantia(orderId: string, pierna: Pierna) {
  try {
    const supabase = await requirePermiso("pedidos_gestionar");
    const cliente = await direccionCliente(supabase, orderId);
    const { quote } = await import("@/lib/skydropx");
    const { quotationId, rates } = pierna === "retorno"
      ? await quote(ORIGIN as Address, cliente)   // cliente -> bodega
      : await quote(cliente);                      // bodega -> cliente
    // El retorno llega a sucursal en Leon (ocurre): nosotros pasamos por el
    // paquete en vez de esperar reparto en la bodega. Solo tarifas que lo den.
    const lista = pierna === "retorno" ? rates.filter((r) => r.ocurre) : rates;
    if (!lista.length) {
      return { ok: false as const, error: pierna === "retorno"
        ? "Ninguna paqueteria entrega a sucursal (ocurre) en Leon para esta ruta."
        : "Sin tarifas para esta ruta." };
    }
    return { ok: true as const, quotationId, rates: lista };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Falló la cotización" };
  }
}

export async function generarGuiaGarantia(orderId: string, pierna: Pierna, quotationId: string, rateId: string) {
  try {
    const supabase = await requirePermiso("pedidos_gestionar");
    const cliente = await direccionCliente(supabase, orderId);
    const { rateById, createShipment } = await import("@/lib/skydropx");
    const rate = await rateById(quotationId, rateId);
    if (!rate) return { ok: false as const, error: "Esa tarifa ya no está disponible. Vuelve a cotizar." };

    const r = pierna === "retorno"
      ? await createShipment(quotationId, rate, ORIGIN as Address, true, cliente) // ocurre: recogemos en sucursal de Leon
      : await createShipment(quotationId, rate, cliente);

    // Cobrado ya: lo que llegó se guarda antes de juzgar (lección de BL-001074).
    const { error } = await supabase.from("garantias").update(
      patchPierna(pierna, {
        carrier: CARRIER_MAP[r.carrier] ?? "other",
        tracking: r.trackingNumber || null,
        url: r.trackingUrl,
        label: r.labelUrl,
      }),
    ).eq("order_id", orderId);

    const rastro = `Envío ${r.shipmentId ?? "?"}${r.trackingNumber ? ` · guía ${r.trackingNumber}` : ""}`;
    if (error) return { ok: false as const, error: `El envío se creó y se cobró, pero no se guardó: ${error.message}. ${rastro} — anótala.` };
    if (!r.trackingNumber) return { ok: false as const, error: `Skydropx cobró el envío sin devolver guía. ${rastro} — revísalo antes de reintentar o lo pagarás dos veces.` };

    revalidatePath("/admin/orders/[id]", "page");
    // Misma verificacion que el envio normal: pedimos sucursal y hay que saber
    // si Skydropx lo registro asi, porque si no, saldria a reparto a la bodega.
    if (pierna === "retorno" && !r.ocurreConfirmado) {
      return { ok: false as const, error: `Guía ${r.trackingNumber} creada, pero Skydropx NO la registró como entrega a sucursal — saldría a domicilio. Revísala en su panel (envío ${r.shipmentId ?? "?"}).` };
    }
    if (!r.labelUrl) return { ok: false as const, error: `Guía ${r.trackingNumber} creada; la etiqueta aún no está lista. Recarga en un minuto, no vuelvas a generar.` };
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Falló la generación" };
  }
}

// Captura manual (guía hecha en el panel de Skydropx o de otra paquetería) y
// descarte de una guía cancelada — mismas salidas que el envío normal.
export async function guardarGuiaGarantia(orderId: string, pierna: Pierna, datos: { carrier: string | null; tracking: string | null; url: string | null }) {
  try {
    const supabase = await requirePermiso("pedidos_gestionar");
    const { error } = await supabase.from("garantias").update(
      patchPierna(pierna, { carrier: datos.carrier || null, tracking: datos.tracking || null, url: datos.url || null }),
    ).eq("order_id", orderId);
    if (error) return { ok: false as const, error: error.message };
    revalidatePath("/admin/orders/[id]", "page");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "No se pudo guardar" };
  }
}

// Hitos: el par regresó a la bodega; la garantía quedó resuelta.
export async function marcarGarantia(orderId: string, hito: "recibido" | "cerrada", valor: boolean) {
  try {
    const supabase = await requirePermiso("pedidos_gestionar");
    const patch = hito === "recibido"
      ? { recibido_at: valor ? new Date().toISOString() : null }
      : { cerrada_at: valor ? new Date().toISOString() : null };
    const { error } = await supabase.from("garantias").update(patch).eq("order_id", orderId);
    if (error) return { ok: false as const, error: error.message };
    revalidatePath("/admin/orders/[id]", "page");
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "No se pudo actualizar" };
  }
}
