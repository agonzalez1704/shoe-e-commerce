"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatCents } from "@/lib/money";
import { CASH_CHAINS_SHORT } from "@/lib/payment-method";
import { generarReferencia, type ReferenciaResult } from "@/app/admin/referencia-actions";

export type ModeloRef = {
  id: string;
  name: string;
  variantes: { id: string; color: string; talla: string; ancho: string }[];
};

type Linea = { variantId: string; etiqueta: string };
type Lista = Extract<ReferenciaResult, { ok: true }>;

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const IN = "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent";
const VACIO = { nombre: "", telefono: "", email: "", calle: "", colonia: "", ciudad: "", estado: "", cp: "" };
const CAMPOS: { k: keyof typeof VACIO; label: string; ancho?: boolean; inputMode?: "numeric" | "email" | "tel" }[] = [
  { k: "nombre", label: "Nombre completo", ancho: true },
  { k: "telefono", label: "WhatsApp (10 dígitos)", inputMode: "tel" },
  { k: "email", label: "Correo (opcional)", inputMode: "email" },
  { k: "calle", label: "Calle y número", ancho: true },
  { k: "colonia", label: "Colonia" },
  { k: "cp", label: "Código postal", inputMode: "numeric" },
  { k: "ciudad", label: "Ciudad" },
  { k: "estado", label: "Estado" },
];

export function ReferenciaForm({ modelos }: { modelos: ModeloRef[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [lista, setLista] = useState<Lista | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [datos, setDatos] = useState(VACIO);
  const [modeloId, setModeloId] = useState("");
  const [color, setColor] = useState("");
  const [varianteId, setVarianteId] = useState("");

  const modelo = modelos.find((m) => m.id === modeloId);
  const colores = [...new Set(modelo?.variantes.map((v) => v.color))];
  const tallas = modelo?.variantes.filter((v) => v.color === color) ?? [];

  function agregar() {
    const v = tallas.find((t) => t.id === varianteId);
    if (!modelo || !v) return;
    setLineas((l) => [...l, { variantId: v.id, etiqueta: `${modelo.name} · ${v.color} · MX ${v.talla}${v.ancho === "medium" ? "" : ` · ${v.ancho}`}` }]);
    setVarianteId("");
  }

  function generar() {
    start(async () => {
      setErr(null);
      // el mismo par dos veces es una sola línea con cantidad 2
      const cantidades = new Map<string, number>();
      for (const l of lineas) cantidades.set(l.variantId, (cantidades.get(l.variantId) ?? 0) + 1);
      const r = await generarReferencia({
        ...datos,
        items: [...cantidades].map(([variantId, quantity]) => ({ variantId, quantity })),
      });
      if (r.ok) setLista(r);
      else setErr(r.error);
    });
  }

  function otra() {
    setLista(null);
    setLineas([]);
    setDatos(VACIO);
    setModeloId("");
    setColor("");
    setVarianteId("");
  }

  if (lista) {
    const vence = lista.venceEn ? new Date(lista.venceEn).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : null;
    const mensaje =
      `Hola ${datos.nombre.trim()}, esta es tu referencia para pagar ${mxn(lista.totalCents)} en efectivo de tu pedido ${lista.numero}:\n\n` +
      `${lista.referencia}\n\n` +
      `Puedes pagar en ${CASH_CHAINS_SHORT}. No se puede pagar en OXXO.\n` +
      (vence ? `Vence el ${vence}.\n` : "") +
      `Código de barras y lista de tiendas: ${lista.ligaPago}`;
    return (
      <div className="max-w-md space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div>
          <p className="text-sm text-muted">Pedido <span className="nums font-medium text-text">{lista.numero}</span></p>
          <p className="nums mt-1 text-3xl font-semibold">{mxn(lista.totalCents)}</p>
          {vence && <p className="mt-1 text-sm text-muted">Vence el {vence}</p>}
        </div>
        <div className="rounded-xl bg-white p-4 text-center">
          {lista.barcodeUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lista.barcodeUrl} alt="Código de barras para pago en efectivo" className="mx-auto max-h-44 w-auto" />
          )}
          <p className="mt-2 break-all font-mono text-sm tracking-wider text-zinc-900">{lista.referencia}</p>
        </div>
        <p className="text-xs text-muted">Se paga en {CASH_CHAINS_SHORT}. <span className="font-medium">No se puede pagar en OXXO.</span></p>
        <div className="flex flex-wrap gap-2">
          <a
            href={`https://wa.me/52${lista.telefono}?text=${encodeURIComponent(mensaje)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast"
          >
            Enviar por WhatsApp
          </a>
          <a href={`/admin/referencias/${encodeURIComponent(lista.numero)}/ficha`} download className="rounded-full border border-border px-4 py-2 text-sm font-medium">Descargar imagen</a>
          <Link href={`/admin/orders/${lista.orderId}`} className="rounded-full border border-border px-4 py-2 text-sm font-medium">Ver pedido</Link>
          <button type="button" onClick={otra} className="rounded-full border border-border px-4 py-2 text-sm font-medium">Generar otra</button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="max-w-2xl space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        generar();
      }}
    >
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium">Pares</h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_8rem_auto]">
          <select aria-label="Modelo" className={IN} value={modeloId} onChange={(e) => { setModeloId(e.target.value); setColor(""); setVarianteId(""); }}>
            <option value="">Modelo</option>
            {modelos.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select aria-label="Color" className={IN} value={color} disabled={!modelo} onChange={(e) => { setColor(e.target.value); setVarianteId(""); }}>
            <option value="">Color</option>
            {colores.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select aria-label="Talla" className={IN} value={varianteId} disabled={!color} onChange={(e) => setVarianteId(e.target.value)}>
            <option value="">Talla</option>
            {tallas.map((t) => <option key={t.id} value={t.id}>{t.talla}{t.ancho === "medium" ? "" : ` · ${t.ancho}`}</option>)}
          </select>
          <button type="button" onClick={agregar} disabled={!varianteId} className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50">Agregar</button>
        </div>
        {lineas.length > 0 && (
          <ul className="divide-y divide-border text-sm">
            {lineas.map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span>{l.etiqueta}</span>
                <button type="button" onClick={() => setLineas((x) => x.filter((_, j) => j !== i))} className="text-xs text-muted underline">Quitar</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-medium">Cliente y envío</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {CAMPOS.map(({ k, label, ancho, inputMode }) => (
            <label key={k} className={`block text-xs text-muted ${ancho ? "sm:col-span-2" : ""}`}>
              {label}
              <input className={`${IN} mt-1`} inputMode={inputMode} value={datos[k]} onChange={(e) => setDatos((d) => ({ ...d, [k]: e.target.value }))} />
            </label>
          ))}
        </div>
      </section>

      {err && <p role="alert" className="text-sm text-accent">{err}</p>}
      <button type="submit" disabled={pending || lineas.length === 0} className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-contrast disabled:opacity-50">
        {pending ? "Generando…" : "Generar referencia"}
      </button>
    </form>
  );
}
