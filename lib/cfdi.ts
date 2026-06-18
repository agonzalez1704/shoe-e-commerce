import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// CFDI 4.0 stamping via Facturama PAC.
//
// REQUIRES (to actually stamp): a Facturama account with your CSD certs loaded,
// issuer (Emisor) configured, and correct SAT catalog codes. The field mapping
// below follows Facturama's "CFDI" (multi-emisor=false) web API shape and MUST be
// validated against your sandbox before go-live. Until PAC_* env is set, this
// records a 'failed' cfdi_documents row with a clear reason instead of throwing.
//
// Prices are IVA-inclusive (16%); we back the IVA out per line for the breakdown.
// ============================================================

const SAT_PRODUCT_CODE = "53111601"; // calzado (footwear) — make per-product later
const UNIT_CODE = "H87"; // Pieza
const IVA_RATE = 0.16;

type StampResult = { ok: true; uuid: string } | { ok: false; error: string };

function lineFiscal(unitPriceCents: number, qty: number) {
  const totalCents = unitPriceCents * qty;
  const baseCents = Math.round(totalCents / (1 + IVA_RATE));
  const ivaCents = totalCents - baseCents;
  return {
    total: totalCents / 100,
    base: baseCents / 100,
    iva: ivaCents / 100,
    unitPrice: baseCents / qty / 100,
  };
}

export async function stampOrderCfdi(orderId: string): Promise<StampResult> {
  const admin = createAdminClient();
  const base = process.env.PAC_BASE_URL;
  const user = process.env.PAC_API_USER;
  const pass = process.env.PAC_API_PASSWORD;
  const expeditionZip = process.env.PAC_EXPEDITION_ZIP;

  // idempotent: don't re-stamp
  const { data: existing } = await admin
    .from("cfdi_documents")
    .select("id, status, uuid_fiscal")
    .eq("order_id", orderId)
    .eq("status", "stamped")
    .maybeSingle();
  if (existing?.uuid_fiscal) return { ok: true, uuid: existing.uuid_fiscal };

  const recordFailure = async (error: string) => {
    await admin.from("cfdi_documents").insert({ order_id: orderId, status: "failed", pac_error: error });
    return { ok: false as const, error };
  };

  if (!base || !user || !pass) {
    return recordFailure("PAC no configurado (PAC_BASE_URL / PAC_API_USER / PAC_API_PASSWORD)");
  }

  // gather order + items + fiscal data
  const [{ data: order }, { data: items }, { data: fiscal }] = await Promise.all([
    admin.from("orders").select("payment_method, total_cents").eq("id", orderId).maybeSingle(),
    admin.from("order_items").select("product_name, unit_price_cents, quantity").eq("order_id", orderId),
    admin.from("order_fiscal_data").select("rfc, fiscal_name, fiscal_regime, cfdi_use, postal_code").eq("order_id", orderId).maybeSingle(),
  ]);

  if (!order || !fiscal || !items?.length) {
    return recordFailure("Faltan datos de pedido o fiscales");
  }

  const lineItems = items.map((it) => {
    const f = lineFiscal(it.unit_price_cents, it.quantity);
    return {
      ProductCode: SAT_PRODUCT_CODE,
      Description: it.product_name,
      Unit: "Pieza",
      UnitCode: UNIT_CODE,
      Quantity: it.quantity,
      UnitPrice: Number(f.unitPrice.toFixed(6)),
      Subtotal: Number(f.base.toFixed(2)),
      TaxObject: "02", // objeto de impuesto: sí
      Taxes: [
        { Name: "IVA", Rate: IVA_RATE, Total: Number(f.iva.toFixed(2)), Base: Number(f.base.toFixed(2)), IsRetention: false },
      ],
      Total: Number(f.total.toFixed(2)),
    };
  });

  // Facturama CFDI 4.0 payload (issuer/Emisor taken from account config)
  const payload = {
    CfdiType: "I",
    PaymentForm: order.payment_method === "spei" ? "03" : order.payment_method === "oxxo" ? "01" : "04",
    PaymentMethod: "PUE",
    ExpeditionPlace: expeditionZip ?? fiscal.postal_code,
    Currency: "MXN",
    Receiver: {
      Rfc: fiscal.rfc,
      Name: fiscal.fiscal_name,
      CfdiUse: fiscal.cfdi_use,
      FiscalRegime: fiscal.fiscal_regime,
      TaxZipCode: fiscal.postal_code,
    },
    Items: lineItems,
  };

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/3/cfdis`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) {
      return recordFailure(`Facturama ${res.status}: ${JSON.stringify(body?.Message ?? body)}`);
    }

    const uuid: string | undefined = body?.Complement?.TaxStamp?.Uuid ?? body?.Uuid;
    const id: string | undefined = body?.Id;
    if (!uuid) return recordFailure("Respuesta sin folio fiscal (UUID)");

    // Facturama serves PDF/XML by id; a production setup downloads + stores in Storage.
    await admin.from("cfdi_documents").insert({
      order_id: orderId,
      status: "stamped",
      uuid_fiscal: uuid,
      xml_url: id ? `${base.replace(/\/$/, "")}/cfdi/xml/issued/${id}` : null,
      pdf_url: id ? `${base.replace(/\/$/, "")}/cfdi/pdf/issued/${id}` : null,
      stamped_at: new Date().toISOString(),
    });
    return { ok: true, uuid };
  } catch (e) {
    return recordFailure(e instanceof Error ? e.message : "Error al timbrar");
  }
}
