"use client";

import { useState, useTransition } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import { saveProduct, deleteProduct, type ProductInput, type VariantInput, type ProductImageInput } from "@/app/admin/product-actions";
import { ImageUploader } from "@/components/ImageUploader";

type Brand = { id: string; name: string };

type VariantRow = Omit<VariantInput, "price_cents"> & { price: string }; // price in pesos as text

const INPUT = "rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-text";
const pesos = (cents: number | null) => (cents == null ? "" : (cents / 100).toString());
const toCents = (p: string) => (p.trim() === "" ? null : Math.round(parseFloat(p) * 100));

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const blankVariant = (): VariantRow => ({
  size_value: "", size_system: "MX", width: "medium", color: "", sku: "", price: "", qty_on_hand: 0,
});

export function ProductForm({
  brands,
  initial,
}: {
  brands: Brand[];
  initial?: ProductInput;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [brandId, setBrandId] = useState(initial?.brand_id ?? "");
  const [gender, setGender] = useState(initial?.gender ?? "");
  const [status, setStatus] = useState<ProductInput["status"]>(initial?.status ?? "draft");
  const [madeToOrder, setMadeToOrder] = useState(initial?.made_to_order ?? true);
  const [basePrice, setBasePrice] = useState(pesos(initial?.base_price_cents ?? null));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [images, setImages] = useState<ProductImageInput[]>(initial?.images ?? []);
  const [variants, setVariants] = useState<VariantRow[]>(
    initial?.variants.map((v) => ({ ...v, price: pesos(v.price_cents) })) ?? [blankVariant()],
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const effectiveSlug = slug || slugify(name);
  const variantColors = Array.from(
    new Set(variants.map((v) => v.color.trim().toLowerCase()).filter(Boolean)),
  );

  function setVariant(i: number, patch: Partial<VariantRow>) {
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  function autoSku(v: VariantRow) {
    if (v.sku) return v.sku;
    return [effectiveSlug, v.size_value, v.color].filter(Boolean).join("-");
  }

  function submit() {
    setError(null);
    const payload: ProductInput = {
      id: initial?.id,
      name,
      slug: effectiveSlug,
      brand_id: brandId || null,
      description: description || null,
      gender: gender || null,
      base_price_cents: toCents(basePrice) ?? 0,
      status,
      made_to_order: madeToOrder,
      images: images.filter((i) => i.url.trim()).map((i) => ({ url: i.url.trim(), color: i.color })),
      variants: variants.map((v) => ({
        id: v.id,
        size_value: v.size_value,
        size_system: v.size_system,
        width: v.width,
        color: v.color.trim().toLowerCase(),
        sku: autoSku(v),
        price_cents: toCents(v.price),
        qty_on_hand: Number(v.qty_on_hand) || 0,
      })),
    };
    startTransition(async () => {
      const res = await saveProduct(payload);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-8">
      {/* basics */}
      <section className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${INPUT} w-full`} />
        </Field>
        <Field label="Slug" hint={`/products/${effectiveSlug || "…"}`}>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={slugify(name)} className={`${INPUT} w-full`} />
        </Field>
        <Field label="Marca">
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={`${INPUT} w-full`}>
            <option value="">Sin marca</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Género">
          <select value={gender} onChange={(e) => setGender(e.target.value)} className={`${INPUT} w-full`}>
            <option value="">—</option>
            <option value="mens">Hombre</option>
            <option value="womens">Mujer</option>
            <option value="kids">Niños</option>
            <option value="unisex">Unisex</option>
          </select>
        </Field>
        <Field label="Precio base (MXN)">
          <input value={basePrice} onChange={(e) => setBasePrice(e.target.value)} inputMode="decimal" placeholder="0.00" className={`${INPUT} w-full`} />
        </Field>
        <Field label="Estado">
          <select value={status} onChange={(e) => setStatus(e.target.value as ProductInput["status"])} className={`${INPUT} w-full`}>
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </Field>
        <Field label="Descripción" full>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${INPUT} w-full`} />
        </Field>
        <label className="flex items-start gap-2 text-sm md:col-span-2">
          <input type="checkbox" checked={madeToOrder} onChange={(e) => setMadeToOrder(e.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
          <span>
            Hecho sobre pedido
            <span className="block text-xs text-muted">Se puede ordenar sin stock; no se muestra disponibilidad. Desactiva cuando manejes inventario real.</span>
          </span>
        </label>
      </section>

      {/* variants */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Variantes</h2>
          <button onClick={() => setVariants((v) => [...v, blankVariant()])} className="inline-flex items-center gap-1 text-sm text-accent">
            <Plus size={14} weight="bold" /> Agregar
          </button>
        </div>
        <div className="space-y-2">
          {variants.map((v, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3 md:grid-cols-[80px_70px_110px_1fr_1fr_90px_80px_auto]">
              <input value={v.size_value} onChange={(e) => setVariant(i, { size_value: e.target.value })} placeholder="Talla" className={INPUT} />
              <select value={v.size_system} onChange={(e) => setVariant(i, { size_system: e.target.value as VariantRow["size_system"] })} className={INPUT}>
                <option>MX</option><option>US</option><option>EU</option><option>UK</option>
              </select>
              <select value={v.width} onChange={(e) => setVariant(i, { width: e.target.value as VariantRow["width"] })} className={INPUT}>
                <option value="narrow">narrow</option><option value="medium">medium</option><option value="wide">wide</option>
              </select>
              <input value={v.color} onChange={(e) => setVariant(i, { color: e.target.value })} placeholder="Color" className={INPUT} />
              <input value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} placeholder={autoSku(v) || "SKU"} className={INPUT} />
              <input value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} inputMode="decimal" placeholder="Precio" className={INPUT} />
              <input type="number" min={0} value={v.qty_on_hand} onChange={(e) => setVariant(i, { qty_on_hand: Number(e.target.value) })} placeholder="Stock" className={INPUT} />
              <button onClick={() => setVariants((vs) => vs.filter((_, idx) => idx !== i))} aria-label="Quitar variante" className="grid place-items-center text-muted hover:text-accent">
                <Trash size={16} />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Precio por variante opcional (vacío = usa el precio base). SKU se autogenera si lo dejas vacío.</p>
      </section>

      {/* images */}
      <section>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">Imágenes</h2>
        <ImageUploader images={images} colors={variantColors} productName={name} productId={initial?.id} onChange={setImages} />
      </section>

      {error && <p className="text-sm text-accent">{error}</p>}

      <div className="flex items-center justify-between border-t border-border pt-5">
        {initial?.id ? (
          <button
            onClick={() => {
              if (confirm("¿Eliminar este producto?")) startTransition(() => deleteProduct(initial.id!));
            }}
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent"
          >
            <Trash size={15} /> Eliminar
          </button>
        ) : <span />}
        <button onClick={submit} disabled={isPending} className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-contrast transition-transform active:scale-[0.99] disabled:bg-border disabled:text-muted">
          {isPending ? "Guardando…" : "Guardar producto"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, full, children }: { label: string; hint?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
