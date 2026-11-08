"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { requirePermiso } from "@/lib/permisos-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createConektaOrder } from "@/lib/conekta";
import { activeBrand } from "@/lib/brand";
import { SITE_URL } from "@/lib/site";

// Referencia de pago en efectivo capturada por el equipo. El efectivo salió del
// checkout público (2026-10) porque apartaba inventario sin pagarse; aquí queda
// para el cliente que lo pide por WhatsApp. "oxxo" es el nombre interno del
// método en Conekta: la ficha NO se paga en OXXO (ver lib/payment-method).
// El precio lo decide create_order (combo y promociones), igual que en la tienda.

export type ReferenciaInput = {
  items: { variantId: string; quantity: number }[];
  nombre: string;
  telefono: string;
  email: string; // opcional: sin correo se usa el de la tienda
  calle: string;
  colonia: string;
  ciudad: string;
  estado: string;
  cp: string;
};

export type ReferenciaResult =
  | {
      ok: true;
      orderId: string;
      numero: string;
      totalCents: number;
      referencia: string;
      barcodeUrl: string | null;
      venceEn: string | null;
      ligaPago: string;
      telefono: string;
    }
  | { ok: false; error: string };

// Devuelve el error en vez de lanzarlo: Next oculta los mensajes en producción.
export async function generarReferencia(input: ReferenciaInput): Promise<ReferenciaResult> {
  let cartId: string | null = null;
  let orderId: string | null = null; // mientras tenga valor, un fallo deshace el pedido
  const admin = createAdminClient();

  try {
    await requirePermiso("pedidos_gestionar");

    const telefono = input.telefono.replace(/\D/g, "").slice(-10);
    const nombre = input.nombre.trim();
    const email = input.email.trim().toLowerCase() || activeBrand.legal.supportEmail;
    const direccion = {
      name: nombre,
      phone: telefono,
      line1: input.calle.trim(),
      neighborhood: input.colonia.trim(),
      city: input.ciudad.trim(),
      region: input.estado.trim(),
      postal: input.cp.trim(),
      country: "MX",
    };
    if (!input.items.length) return { ok: false, error: "Agrega al menos un par." };
    if (input.items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) return { ok: false, error: "Cantidad inválida." };
    if (!nombre) return { ok: false, error: "Falta el nombre del cliente." };
    if (telefono.length !== 10) return { ok: false, error: "El teléfono debe tener 10 dígitos." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "El correo no es válido." };
    if (!direccion.line1 || !direccion.city || !direccion.region) return { ok: false, error: "Falta la dirección de envío." };
    if (!/^\d{5}$/.test(direccion.postal)) return { ok: false, error: "El código postal debe tener 5 dígitos." };

    // create_order trabaja sobre un carrito: uno de un solo uso, sin dueño.
    const { data: cart, error: cartErr } = await admin
      .from("carts").insert({ session_token: randomUUID() }).select("id").single();
    if (cartErr || !cart) throw new Error(cartErr?.message ?? "No se pudo crear el carrito.");
    cartId = cart.id;

    const { error: itemsErr } = await admin.from("cart_items").insert(
      input.items.map((i) => ({ cart_id: cart.id, variant_id: i.variantId, quantity: i.quantity })),
    );
    if (itemsErr) throw new Error(itemsErr.message);

    // Con service role: auth.uid() de una sesión de staff haría "not your cart".
    const { data: creado, error: createErr } = await admin
      .rpc("create_order", {
        p_cart_id: cart.id,
        p_email: email,
        p_payment_method: "oxxo",
        p_shipping: direccion as never,
        p_billing: direccion as never,
      })
      .single();
    if (createErr || !creado) throw new Error(createErr?.message ?? "No se pudo crear el pedido.");
    orderId = creado.order_id;
    updateTag("stock"); // el pedido apartó inventario

    await admin.rpc("set_order_amounts", { p_order_id: creado.order_id, p_shipping_cents: 0 });
    const totalCents = creado.subtotal_cents - creado.discount_cents;

    const [{ data: lineas }, { data: conToken }] = await Promise.all([
      admin.from("order_items").select("product_name, variant_label, unit_price_cents, quantity").eq("order_id", creado.order_id),
      admin.from("orders").select("review_token").eq("id", creado.order_id).single(),
    ]);
    const lineItems = (lineas ?? []).map((l) => ({
      name: `${l.product_name} (${l.variant_label})`,
      unit_price: l.unit_price_cents,
      quantity: l.quantity,
    }));
    // Conekta cobra la suma de las líneas: si no cuadra, mejor no emitir la ficha.
    const suma = lineItems.reduce((n, l) => n + l.unit_price * l.quantity, 0);
    if (suma - creado.discount_cents !== totalCents) throw new Error(`Las líneas no cuadran con el total de ${creado.order_number}.`);

    const co = await createConektaOrder({
      amountCents: totalCents,
      method: "oxxo",
      customer: { name: nombre, email, phone: telefono },
      lineItems,
      discountCents: creado.discount_cents,
      orderNumber: creado.order_number,
      expiresAt: creado.expires_at ? Math.floor(new Date(creado.expires_at).getTime() / 1000) : undefined,
    });
    const pm = co.charges.data[0]?.payment_method;
    if (!pm?.reference) throw new Error("Conekta no devolvió referencia. Revisa que el pago en efectivo siga habilitado.");

    // La ficha ya existe y se puede pagar: de aquí en adelante no se deshace.
    orderId = null;
    const { error: pagoErr } = await admin.rpc("record_payment", {
      p_order_id: creado.order_id,
      p_provider_charge_id: co.id,
      p_method: "oxxo",
      p_amount_cents: totalCents,
      p_reference: pm.reference,
      p_voucher_url: pm.barcode_url,
      p_expires_at: pm.expires_at ? new Date(pm.expires_at * 1000).toISOString() : undefined,
    });
    if (pagoErr) {
      console.error("[referencia] record_payment:", pagoErr.message);
      return { ok: false, error: `No compartas la referencia: ${creado.order_number} se creó en Conekta (${co.id}) pero no se guardó el pago, y no se confirmaría al pagarse.` };
    }

    revalidatePath("/admin/orders");
    return {
      ok: true,
      orderId: creado.order_id,
      numero: creado.order_number,
      totalCents,
      referencia: pm.reference,
      barcodeUrl: pm.barcode_url ?? null,
      venceEn: creado.expires_at,
      ligaPago: `${SITE_URL}/pedido/${encodeURIComponent(creado.order_number)}/pagar?t=${conToken?.review_token ?? ""}`,
      telefono,
    };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    console.error("[referencia] falló:", raw);
    if (orderId) {
      await admin.rpc("cancel_order", { p_order_id: orderId }); // libera el inventario
      await admin.from("orders").delete().eq("id", orderId);
    }
    return { ok: false, error: /out of stock|sin stock|insufficient/i.test(raw) ? "Uno de los pares ya no tiene existencia." : raw };
  } finally {
    if (cartId) await admin.from("carts").delete().eq("id", cartId);
  }
}
