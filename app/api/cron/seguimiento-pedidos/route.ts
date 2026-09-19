import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendProductionUpdateEmail, sendShippedEmail, sendDeliveredEmail, linkSeguimiento } from "@/lib/email";
import { ventanaEntrega, trackingUrlFor, diasDesde } from "@/lib/fulfillment";
import { estadosDeGuias } from "@/lib/skydropx";
import { activeBrand } from "@/lib/brand";
import { reportarCompraMeta } from "@/lib/order-fulfillment";

// Seguimiento proactivo, dos veces al dia:
//  1. Correo "va en fabricacion" a los 4 dias del pago — el tramo de ~7 dias
//     sin noticias era el origen de las quejas.
//  2. Sincroniza con Skydropx: si la paqueteria ya lo lleva o lo entrego,
//     avanza el pedido y avisa al cliente. En Skydropx habia 17 entregados y
//     aqui solo 2, porque marcarlos dependia de que alguien lo hiciera a mano.

export const maxDuration = 120;

// Estados vistos en la cuenta real ademas de los obvios: delivered_to_branch
// (ya esta en la sucursal, falta que lo recojan) y delivery_attempt (hubo un
// intento fallido). Ninguno es "entregado" — ambos siguen en camino.
const EN_CAMINO = new Set(["in_transit", "picked_up", "out_for_delivery", "last_mile", "in_route", "delivered_to_branch", "delivery_attempt"]);

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const ahora = new Date().toISOString();
  let avances = 0, enviados = 0, entregados = 0, silenciosos = 0;

  // ---- 1. avance de fabricacion (solo marcas que fabrican sobre pedido)
  if (activeBrand.copy?.madeToOrderLine) {
    const { data: enFabrica } = await admin
      .from("orders")
      .select("id, email, order_number, paid_at, review_token")
      .eq("status", "paid")
      .is("shipped_at", null)
      .is("production_update_sent_at", null)
      .lte("paid_at", new Date(Date.now() - 4 * 864e5).toISOString())
      // pedidos viejos no reciben un "va en fabricacion" tardio
      .gte("paid_at", new Date(Date.now() - 9 * 864e5).toISOString())
      .limit(50);
    for (const o of enFabrica ?? []) {
      if (!o.paid_at) continue;
      await sendProductionUpdateEmail({
        to: o.email,
        orderNumber: o.order_number,
        dia: diasDesde(o.paid_at),
        eta: ventanaEntrega(o.paid_at).texto,
        trackUrl: linkSeguimiento(o.order_number, o.review_token),
      });
      await admin.from("orders").update({ production_update_sent_at: ahora }).eq("id", o.id);
      avances++;
    }
  }

  // ---- 2. sincronizacion con la paqueteria
  const { data: conGuia } = await admin
    .from("orders")
    .select("id, email, order_number, status, fulfillment_stage, carrier, tracking_number, shipped_at, review_token, total_cents")
    .in("status", ["paid", "fulfilled"])
    .not("tracking_number", "is", null)
    .is("delivered_at", null)
    .gte("created_at", new Date(Date.now() - 60 * 864e5).toISOString())
    .limit(100);

  let estados = new Map<string, string>();
  try {
    estados = await estadosDeGuias((conGuia ?? []).map((o) => o.tracking_number ?? ""));
  } catch (e) {
    console.error("[seguimiento] skydropx:", e);
  }

  for (const o of conGuia ?? []) {
    const estado = estados.get(o.tracking_number ?? "");
    if (!estado) continue;
    const cerrado = o.status === "paid" ? { status: "fulfilled" as const } : {};

    if (estado === "delivered") {
      await admin
        .from("orders")
        .update({ fulfillment_stage: "delivered", delivered_at: ahora, shipped_at: o.shipped_at ?? ahora, ...cerrado })
        .eq("id", o.id);
      // Una entrega de hace semanas se registra sin correo: avisar tarde confunde.
      if (!o.shipped_at || diasDesde(o.shipped_at) <= 14) {
        await sendDeliveredEmail({ to: o.email, orderNumber: o.order_number });
        entregados++;
      } else {
        silenciosos++;
      }
      continue;
    }

    if (EN_CAMINO.has(estado) && o.fulfillment_stage !== "shipped") {
      await admin
        .from("orders")
        .update({ fulfillment_stage: "shipped", shipped_at: o.shipped_at ?? ahora, ...cerrado })
        .eq("id", o.id);
      if (!o.shipped_at) {
        const { data: items } = await admin
          .from("order_items")
          .select("product_name, variant_label, unit_price_cents, quantity")
          .eq("order_id", o.id);
        await sendShippedEmail({
          to: o.email,
          orderNumber: o.order_number,
          totalCents: o.total_cents,
          carrier: o.carrier ?? undefined,
          tracking: o.tracking_number ?? undefined,
          carrierUrl: trackingUrlFor(o.carrier, o.tracking_number) ?? undefined,
          trackUrl: linkSeguimiento(o.order_number, o.review_token),
          eta: ventanaEntrega(ahora, ahora).texto,
          lines: (items ?? []).map((i) => ({
            name: `${i.product_name} (${i.variant_label})`,
            quantity: i.quantity,
            lineTotalCents: i.unit_price_cents * i.quantity,
          })),
        });
      }
      enviados++;
    }
  }

  // ---- 3. reconciliacion con Meta: toda compra pagada de los ultimos 3 dias
  // debe tener un envio aceptado; las que no, se reenvian (mismo event_id, Meta
  // las junta). Meta rechaza compras de mas de 7 dias, de ahi la ventana corta.
  let reenviadas = 0;
  const { data: pagadas } = await admin
    .from("orders")
    .select("id")
    .in("status", ["paid", "fulfilled"])
    .not("efectos_pago_at", "is", null)
    .gte("paid_at", new Date(Date.now() - 3 * 864e5).toISOString());
  const ids = (pagadas ?? []).map((o) => o.id);
  if (ids.length) {
    const { data: okEnvios } = await admin.from("capi_envios").select("order_id").in("order_id", ids).eq("ok", true);
    const confirmadas = new Set((okEnvios ?? []).map((e) => e.order_id));
    for (const id of ids) {
      if (confirmadas.has(id)) continue;
      await reportarCompraMeta(id);
      reenviadas++;
    }
  }

  return NextResponse.json({ avances, enviados, entregados, silenciosos, reenviadas });
}
