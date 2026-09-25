"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowSquareOut, CaretDown, CaretLeft, Plus, Trash, X } from "@phosphor-icons/react";
import { saveProduct, deleteProduct, type ProductInput, type VariantInput, type ProductImageInput } from "@/app/admin/product-actions";
import { ImageUploader } from "@/components/ImageUploader";
import { formatCents } from "@/lib/money";
import { SPEC_LABELS, specLabel } from "@/lib/specs";

// Editor de producto por COLOR. El formulario viejo era una lista plana de
// variantes: Napoli son 66 renglones iguales (6 colores x 11 tallas) sin foto
// ni agrupacion, y al bajar ya no se sabia que producto se estaba editando.
// Aqui manda el color: un panel por color con sus tallas y sus fotos dentro,
// una barra fija que dice siempre cual es el modelo, y una talla se abre en su
// propio panel con miga de pan.

type Brand = { id: string; name: string };
type VariantRow = Omit<VariantInput, "price_cents"> & { price: string }; // precio en pesos, como texto

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");
const IN = "rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-text";
const BTN = "rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-elevated";
const pesos = (cents: number | null) => (cents == null ? "" : (cents / 100).toString());
const toCents = (p: string) => (p.trim() === "" ? null : Math.round(parseFloat(p) * 100));

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const TALLAS_MX = ["25", "25.5", "26", "26.5", "27", "27.5", "28", "28.5", "29", "29.5", "30"];

type SpecRow = { key: string; value: string };

const blankVariant = (color = "", size_value = ""): VariantRow => ({
  size_value, size_system: "MX", width: "medium", color, sku: "", price: "", qty_on_hand: 0,
  fuera_de_combo: false, exotico: false, activo: true,
});

export function ProductEditor({
  brands,
  initial,
  promoPorColor = {},
  comboGroup = null,
}: {
  brands: Brand[];
  initial?: ProductInput;
  promoPorColor?: Record<string, number>;
  comboGroup?: string | null;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [brandId, setBrandId] = useState(initial?.brand_id ?? "");
  const [gender, setGender] = useState(initial?.gender ?? "");
  const [status, setStatus] = useState<ProductInput["status"]>(initial?.status ?? "draft");
  const [madeToOrder, setMadeToOrder] = useState(initial?.made_to_order ?? true);
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [basePrice, setBasePrice] = useState(pesos(initial?.base_price_cents ?? null));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [images, setImages] = useState<ProductImageInput[]>(initial?.images ?? []);
  const [specs, setSpecs] = useState<SpecRow[]>(
    Object.entries(initial?.attributes ?? {}).map(([key, value]) => ({ key, value: String(value) })),
  );
  const [variants, setVariants] = useState<VariantRow[]>(
    initial?.variants.map((v) => ({ ...v, price: pesos(v.price_cents) })) ?? [blankVariant()],
  );
  const [seccion, setSeccion] = useState<"colores" | "modelo" | "fotos" | "ficha">("colores");
  const [abierto, setAbierto] = useState<string | null>(initial?.variants[0]?.color ?? null);
  const [tallaAbierta, setTallaAbierta] = useState<number | null>(null);
  const [sucio, setSucio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const effectiveSlug = slug || slugify(name);
  const baseCents = toCents(basePrice) ?? 0;

  // Todo cambio pasa por aqui: es lo que enciende el aviso de "sin guardar".
  function cambia<T>(set: (v: T) => void) {
    return (v: T) => { setSucio(true); set(v); };
  }
  function setVariant(i: number, patch: Partial<VariantRow>) {
    setSucio(true);
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  // Un grupo por color, conservando el orden en que aparecen.
  const grupos = useMemo(() => {
    const m = new Map<string, number[]>();
    variants.forEach((v, i) => {
      const k = v.color.trim();
      m.set(k, [...(m.get(k) ?? []), i]);
    });
    return [...m].map(([color, idx]) => ({ color, idx }));
  }, [variants]);

  const colores = grupos.map((g) => g.color).filter(Boolean);
  const fotosDe = (color: string) => images.filter((i) => (i.color ?? "") === color);

  function autoSku(v: VariantRow) {
    return v.sku || [effectiveSlug, v.size_value, v.color].filter(Boolean).join("-");
  }

  function renombraColor(viejo: string, nuevo: string) {
    setSucio(true);
    setVariants((vs) => vs.map((v) => (v.color.trim() === viejo ? { ...v, color: nuevo } : v)));
    setImages((is) => is.map((i) => (i.color === viejo ? { ...i, color: nuevo } : i)));
    setAbierto(nuevo);
  }

  // El precio y el combo se deciden por color: se aplican a todas sus tallas.
  function precioDeColor(idx: number[]) {
    const p = variants[idx[0]]?.price ?? "";
    return idx.every((i) => variants[i].price === p) ? p : "";
  }
  function setPrecioColor(idx: number[], price: string) {
    setSucio(true);
    setVariants((vs) => vs.map((v, i) => (idx.includes(i) ? { ...v, price } : v)));
  }
  // La piel tambien es por color: un exotico sube la tarifa del combo.
  function setPielColor(idx: number[], exotico: boolean) {
    setSucio(true);
    setVariants((vs) => vs.map((v, i) => (idx.includes(i) ? { ...v, exotico } : v)));
  }
  function setComboColor(idx: number[], dentro: boolean) {
    setSucio(true);
    setVariants((vs) => vs.map((v, i) => (idx.includes(i) ? { ...v, fuera_de_combo: !dentro } : v)));
  }

  function agregarColor() {
    const plantilla = grupos[0]?.idx.map((i) => variants[i].size_value) ?? [""];
    setSucio(true);
    setVariants((vs) => [...vs, ...plantilla.map((t) => blankVariant("nuevo color", t))]);
    setAbierto("nuevo color");
    setSeccion("colores");
  }
  function agregarTalla(color: string, talla: string) {
    setSucio(true);
    setVariants((vs) => [...vs, blankVariant(color, talla)]);
  }
  function agregarTallaATodos(talla: string) {
    if (!talla.trim()) return;
    setSucio(true);
    setVariants((vs) => [
      ...vs,
      ...colores.filter((c) => !vs.some((v) => v.color.trim() === c && v.size_value === talla)).map((c) => blankVariant(c, talla)),
    ]);
  }
  function quitarColor(color: string) {
    setSucio(true);
    setVariants((vs) => vs.filter((v) => v.color.trim() !== color));
    setImages((is) => is.filter((i) => i.color !== color));
    if (abierto === color) setAbierto(null);
  }

  // Las fotos de un color se editan aparte pero viven en la misma lista: se
  // reinsertan donde estaba la primera del color para no perder el orden.
  function setFotosDeColor(color: string, next: ProductImageInput[]) {
    setSucio(true);
    setImages((prev) => {
      const otras = prev.filter((i) => (i.color ?? "") !== color);
      const pos = prev.findIndex((i) => (i.color ?? "") === color);
      if (pos < 0) return [...otras, ...next];
      const antes = prev.slice(0, pos).filter((i) => (i.color ?? "") !== color);
      return [...antes, ...next, ...otras.slice(antes.length)];
    });
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
      base_price_cents: baseCents,
      status,
      made_to_order: madeToOrder,
      featured,
      attributes: Object.fromEntries(specs.map((r) => [r.key, r.value])),
      images: images.filter((i) => i.url.trim()).map((i) => ({ url: i.url.trim(), color: i.color })),
      variants: variants
        .filter((v) => v.size_value.trim() && v.color.trim())
        .map((v) => ({
          id: v.id,
          size_value: v.size_value.trim(),
          size_system: v.size_system,
          width: v.width,
          color: v.color.trim().toLowerCase(),
          sku: autoSku(v),
          price_cents: toCents(v.price),
          qty_on_hand: Number(v.qty_on_hand) || 0,
          fuera_de_combo: v.fuera_de_combo,
          exotico: v.exotico,
          activo: v.activo,
        })),
    };
    startTransition(async () => {
      const res = await saveProduct(payload);
      if (res?.error) setError(res.error);
    });
  }

  const portada = images[0]?.url ?? null;
  const promoDelColor = (c: string) => promoPorColor[c] ?? null;
  const TABS = [
    ["colores", `Colores y tallas${colores.length ? ` (${colores.length})` : ""}`],
    ["modelo", "Datos del modelo"],
    ["fotos", "Todas las fotos"],
    ["ficha", "Ficha técnica"],
  ] as const;

  return (
    <div className="space-y-5">
      {/* BARRA FIJA: siempre dice que producto se esta editando */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
            <CaretLeft size={14} /> Productos
          </Link>
          <span className="hidden h-7 w-px bg-border sm:block" />
          <Foto url={portada} alt={name} className="h-12 w-12 rounded-xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-semibold tracking-tight">{name || "Producto nuevo"}</span>
              <EstadoPill status={status} />
              {comboGroup && <Pill>Combo {comboGroup}</Pill>}
            </div>
            <p className="nums truncate text-xs text-muted">
              /products/{effectiveSlug || "…"} · {colores.length} colores · {variants.length} variantes
            </p>
          </div>
          <div className="flex-1" />
          {sucio && <span className="text-xs text-accent">Cambios sin guardar</span>}
          {initial?.id && (
            <a href={`/products/${effectiveSlug}`} target="_blank" rel="noreferrer" className={`${BTN} inline-flex items-center gap-1.5`}>
              <ArrowSquareOut size={14} /> Ver en tienda
            </a>
          )}
          <button
            onClick={submit}
            disabled={isPending}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-50"
          >
            {isPending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>

        <div className="mt-2 flex gap-5 overflow-x-auto">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSeccion(id)}
              className={`shrink-0 border-b-2 pb-2 pt-1 text-sm transition-colors ${
                seccion === id ? "border-accent font-medium text-text" : "border-transparent text-muted hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{error}</p>}

      {seccion === "colores" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted">Un panel por color. Las tallas y las fotos viven dentro de su color.</p>
              <div className="flex-1" />
              <AgregarTalla onAdd={agregarTallaATodos} />
              <button onClick={agregarColor} className="inline-flex items-center gap-1 rounded-lg bg-text px-3 py-1.5 text-sm font-medium text-bg">
                <Plus size={14} weight="bold" /> Agregar color
              </button>
            </div>

            {grupos.map(({ color, idx }) => {
              const open = abierto === color;
              const fotos = fotosDe(color);
              const stock = idx.reduce((s, i) => s + (Number(variants[i].qty_on_hand) || 0), 0);
              const dentroCombo = comboGroup ? idx.some((i) => !variants[i].fuera_de_combo) : false;
              const exotico = idx.some((i) => variants[i].exotico);
              const pct = promoDelColor(color);
              const precioColor = precioDeColor(idx);
              const cents = toCents(precioColor) ?? baseCents;
              return (
                <section key={color || "sin-color"} className={`rounded-2xl border bg-surface ${open ? "border-accent shadow-[var(--shadow-md)]" : "border-border"}`}>
                  <div className="flex flex-wrap items-center gap-3 p-4">
                    <button
                      onClick={() => setAbierto(open ? null : color)}
                      aria-expanded={open}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Foto url={fotos[0]?.url ?? null} alt={`${name} ${color}`} className="h-16 w-16 rounded-xl" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium capitalize">{color || "sin color"}</span>
                          {exotico && <span className="rounded-full bg-text px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bg">exótico</span>}
                          {pct && <Pill tone="accent">-{pct}%</Pill>}
                          {fotos.length === 0 && <Pill tone="warn">sin fotos</Pill>}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {idx.length} tallas · {madeToOrder ? "sobre pedido" : `${stock} en stock`} · {fotos.length === 1 ? "1 foto" : `${fotos.length} fotos`}
                        </span>
                      </span>
                      <CaretDown size={16} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>

                    {/* en pantallas angostas el precio y el combo bajan a su
                        propio renglon en vez de exprimir el nombre del color */}
                    <div className="flex w-full items-center gap-3 xl:w-auto">
                      <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted xl:flex-none">
                        <span className="shrink-0">Precio</span>
                        <input
                          value={precioColor}
                          onChange={(e) => setPrecioColor(idx, e.target.value)}
                          inputMode="decimal"
                          placeholder={`usa el base (${mxn(baseCents)})`}
                          className={`${IN} nums w-full min-w-0 xl:w-52`}
                        />
                      </label>

                      {/* Piel del color: clasica o exotica (cocodrilo, piton, lizard,
                          mantarraya). Decide la tarifa del combo. */}
                      <div role="radiogroup" aria-label={`Piel de ${color}`} className="flex shrink-0 overflow-hidden rounded-lg border border-border text-xs">
                        {([[false, "Clásica"], [true, "Exótica"]] as const).map(([valor, label]) => (
                          <button
                            key={label}
                            type="button"
                            role="radio"
                            aria-checked={exotico === valor}
                            onClick={() => setPielColor(idx, valor)}
                            className={`px-2.5 py-1.5 transition-colors ${exotico === valor ? "bg-text font-semibold text-bg" : "text-muted hover:text-text"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {comboGroup && (
                        <label className="flex shrink-0 items-center gap-2 border-l border-border pl-3 text-xs">
                          <input
                            type="checkbox"
                            checked={dentroCombo}
                            onChange={(e) => setComboColor(idx, e.target.checked)}
                            className="accent-[var(--accent)]"
                          />
                          En el combo
                        </label>
                      )}
                    </div>
                  </div>

                  {open && (
                    <div className="space-y-5 border-t border-border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs text-muted">
                          Nombre del color
                          <input
                            defaultValue={color}
                            onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== color && renombraColor(color, e.target.value.trim())}
                            className={`${IN} ml-2 w-48`}
                          />
                        </label>
                        <div className="flex-1" />
                        <button onClick={() => quitarColor(color)} className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent">
                          <Trash size={14} /> Quitar color
                        </button>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                          Tallas — toca una para editar SKU, precio o stock
                        </p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                          {idx.map((i) => {
                            const v = variants[i];
                            return (
                              <button
                                key={i}
                                onClick={() => setTallaAbierta(i)}
                                className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-text ${
                                  v.activo ? "border-border bg-elevated/50" : "border-dashed border-border bg-transparent opacity-60"
                                }`}
                              >
                                <span className="nums text-sm font-medium">{v.size_value || "—"}</span>
                                <span className="text-[11px] text-muted">
                                  {!v.activo ? "oculta" : madeToOrder ? "s/pedido" : v.qty_on_hand}
                                </span>
                              </button>
                            );
                          })}
                          <AgregarTalla label="+ Talla" onAdd={(t) => agregarTalla(color, t)} />
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                          Fotos de {color || "este color"} — las ve quien elige este color
                        </p>
                        <ImageUploader
                          images={fotos}
                          colors={[color]}
                          productName={name}
                          productId={initial?.id}
                          onChange={(next) => setFotosDeColor(color, next)}
                        />
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* resumen del modelo, siempre a la vista */}
          <aside className="space-y-4 lg:sticky lg:top-40 lg:self-start">
            <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold">Del modelo completo</h2>
              <Campo label="Nombre">
                <input value={name} onChange={(e) => cambia(setName)(e.target.value)} className={`${IN} w-full`} />
              </Campo>
              <Campo label="Precio base (MXN)">
                <input value={basePrice} onChange={(e) => cambia(setBasePrice)(e.target.value)} inputMode="decimal" placeholder="0.00" className={`${IN} nums w-full`} />
              </Campo>
              <Campo label="Estado en la tienda">
                <select value={status} onChange={(e) => cambia(setStatus)(e.target.value as ProductInput["status"])} className={`${IN} w-full`}>
                  <option value="active">Activo — se vende</option>
                  <option value="draft">Borrador — no visible</option>
                  <option value="archived">Archivado</option>
                </select>
              </Campo>
              <Switch
                checked={madeToOrder}
                onChange={cambia(setMadeToOrder)}
                label="Hecho sobre pedido"
                hint="Se vende sin stock; no se muestra disponibilidad."
              />
              <Switch
                checked={featured}
                onChange={cambia(setFeatured)}
                label="Destacado en la portada"
                hint="Aparece en el inicio mientras no haya más vendidos."
              />
            </div>

            {Object.keys(promoPorColor).length > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-4">
                <h2 className="mb-2 text-sm font-semibold">Precio que verá el cliente</h2>
                <ul className="space-y-1 text-sm">
                  {Object.entries(promoPorColor).map(([c, pct]) => (
                    <li key={c} className="flex items-center justify-between gap-2">
                      <span className="truncate capitalize text-muted">{c}</span>
                      <span className="nums">{mxn(Math.round((baseCents * (100 - pct)) / 100))}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">Sale de la promoción vigente en Promociones.</p>
              </div>
            )}
          </aside>
        </div>
      )}

      {seccion === "modelo" && (
        <section className="grid max-w-3xl gap-4 md:grid-cols-2">
          <Campo label="Nombre"><input value={name} onChange={(e) => cambia(setName)(e.target.value)} className={`${IN} w-full`} /></Campo>
          <Campo label="Slug" hint={`/products/${effectiveSlug || "…"}`}>
            <input value={slug} onChange={(e) => cambia(setSlug)(e.target.value)} placeholder={slugify(name)} className={`${IN} w-full`} />
          </Campo>
          <Campo label="Marca">
            <select value={brandId} onChange={(e) => cambia(setBrandId)(e.target.value)} className={`${IN} w-full`}>
              <option value="">Sin marca</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Campo>
          <Campo label="Género">
            <select value={gender} onChange={(e) => cambia(setGender)(e.target.value)} className={`${IN} w-full`}>
              <option value="">—</option>
              <option value="mens">Hombre</option>
              <option value="womens">Mujer</option>
              <option value="kids">Niños</option>
              <option value="unisex">Unisex</option>
            </select>
          </Campo>
          <Campo label="Precio base (MXN)">
            <input value={basePrice} onChange={(e) => cambia(setBasePrice)(e.target.value)} inputMode="decimal" placeholder="0.00" className={`${IN} nums w-full`} />
          </Campo>
          <Campo label="Estado">
            <select value={status} onChange={(e) => cambia(setStatus)(e.target.value as ProductInput["status"])} className={`${IN} w-full`}>
              <option value="active">Activo — se vende</option>
              <option value="draft">Borrador — no visible</option>
              <option value="archived">Archivado</option>
            </select>
          </Campo>
          <Campo label="Descripción" full>
            <textarea value={description} onChange={(e) => cambia(setDescription)(e.target.value)} rows={4} className={`${IN} w-full`} />
          </Campo>
          {initial?.id && (
            <div className="md:col-span-2">
              <button
                onClick={() => { if (confirm("¿Eliminar este producto?")) startTransition(() => deleteProduct(initial.id!)); }}
                className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent"
              >
                <Trash size={15} /> Eliminar producto
              </button>
            </div>
          )}
        </section>
      )}

      {seccion === "fotos" && (
        <section className="max-w-4xl space-y-2">
          <p className="text-sm text-muted">
            Todas las fotos del modelo. La primera es la portada; el color decide en qué galería aparece.
          </p>
          <ImageUploader
            images={images}
            colors={colores}
            productName={name}
            productId={initial?.id}
            onChange={cambia(setImages)}
          />
        </section>
      )}

      {seccion === "ficha" && (
        <section className="max-w-2xl space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">Datos sueltos que salen en la tabla de la ficha (material, suela, horma…).</p>
            <button onClick={() => cambia(setSpecs)([...specs, { key: "", value: "" }])} className="inline-flex items-center gap-1 text-sm text-accent">
              <Plus size={14} weight="bold" /> Agregar
            </button>
          </div>
          {specs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted">Sin especificaciones.</p>
          ) : (
            specs.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={r.key}
                  onChange={(e) => cambia(setSpecs)(specs.map((x, idx) => (idx === i ? { ...x, key: e.target.value } : x)))}
                  list="spec-keys"
                  placeholder="clave"
                  className={`${IN} w-1/2`}
                />
                <input
                  value={r.value}
                  onChange={(e) => cambia(setSpecs)(specs.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))}
                  placeholder={r.key && SPEC_LABELS[r.key] ? specLabel(r.key) : "valor"}
                  className={`${IN} w-1/2`}
                />
                <button onClick={() => cambia(setSpecs)(specs.filter((_, idx) => idx !== i))} aria-label="Quitar especificación" className="shrink-0 px-2 text-muted hover:text-accent">
                  <Trash size={15} />
                </button>
              </div>
            ))
          )}
          <datalist id="spec-keys">
            {Object.keys(SPEC_LABELS).map((k) => <option key={k} value={k}>{SPEC_LABELS[k]}</option>)}
          </datalist>
        </section>
      )}

      {tallaAbierta !== null && variants[tallaAbierta] && (
        <PanelTalla
          v={variants[tallaAbierta]}
          producto={name}
          sku={autoSku(variants[tallaAbierta])}
          baseCents={toCents(precioDeColor(grupos.find((g) => g.color === variants[tallaAbierta!].color.trim())?.idx ?? [])) ?? baseCents}
          promoPct={promoDelColor(variants[tallaAbierta].color.trim())}
          sobrePedido={madeToOrder}
          onChange={(patch) => setVariant(tallaAbierta, patch)}
          onDelete={() => {
            setSucio(true);
            setVariants((vs) => vs.filter((_, i) => i !== tallaAbierta));
            setTallaAbierta(null);
          }}
          onClose={() => setTallaAbierta(null)}
        />
      )}
    </div>
  );
}

// Panel lateral de UNA talla: la miga de pan dice modelo, color y talla, que es
// justo lo que el formulario viejo no decia.
function PanelTalla({
  v, producto, sku, baseCents, promoPct, sobrePedido, onChange, onDelete, onClose,
}: {
  v: VariantRow; producto: string; sku: string; baseCents: number; promoPct: number | null;
  sobrePedido: boolean;
  onChange: (patch: Partial<VariantRow>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const cents = toCents(v.price) ?? baseCents;
  const final = promoPct ? Math.round((cents * (100 - promoPct)) / 100) : cents;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto border-l border-border bg-surface p-5 shadow-[var(--shadow-md)]">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted">
              {producto} · <span className="capitalize">{v.color || "sin color"}</span>
            </p>
            <h2 className="text-lg font-semibold tracking-tight">
              Talla {v.size_system} {v.size_value || "—"}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg border border-border p-1.5 text-muted hover:text-text">
            <X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Talla">
            <input value={v.size_value} onChange={(e) => onChange({ size_value: e.target.value })} className={`${IN} nums w-full`} />
          </Campo>
          <Campo label="Sistema">
            <select value={v.size_system} onChange={(e) => onChange({ size_system: e.target.value as VariantRow["size_system"] })} className={`${IN} w-full`}>
              <option>MX</option><option>US</option><option>EU</option><option>UK</option>
            </select>
          </Campo>
        </div>

        <Campo label="SKU" hint="Se arma solo con modelo, talla y color.">
          <input value={v.sku} onChange={(e) => onChange({ sku: e.target.value })} placeholder={sku} className={`${IN} w-full`} />
        </Campo>

        <Campo label="Precio de esta talla" hint={`Vacío = el del color (${mxn(baseCents)}).`}>
          <input value={v.price} onChange={(e) => onChange({ price: e.target.value })} inputMode="decimal" placeholder={mxn(baseCents)} className={`${IN} nums w-full`} />
        </Campo>
        {promoPct && (
          <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
            Con la promoción de -{promoPct}%, el cliente paga <span className="nums font-semibold">{mxn(final)}</span>.
          </p>
        )}

        <Campo label="Stock en bodega" hint={sobrePedido ? "Hecho sobre pedido: se puede vender en cero." : undefined}>
          <input
            type="number"
            min={0}
            value={v.qty_on_hand}
            onChange={(e) => onChange({ qty_on_hand: Number(e.target.value) })}
            className={`${IN} nums w-32`}
          />
        </Campo>

        <Switch
          checked={v.activo}
          onChange={(activo) => onChange({ activo })}
          label="Visible en la tienda"
          hint="Apágala para dejar de vender esta talla sin borrarla."
        />

        <div className="mt-auto border-t border-border pt-4">
          <button onClick={onDelete} className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent">
            <Trash size={15} /> Eliminar esta talla
          </button>
        </div>
      </div>
    </div>
  );
}

function AgregarTalla({ onAdd, label = "Agregar talla a todos" }: { onAdd: (t: string) => void; label?: string }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted hover:border-text hover:text-text">
        {label}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <input
        ref={ref}
        list="tallas-mx"
        autoFocus
        placeholder="27"
        onKeyDown={(e) => {
          if (e.key === "Enter") { onAdd(e.currentTarget.value.trim()); setAbierto(false); }
          if (e.key === "Escape") setAbierto(false);
        }}
        className={`${IN} nums w-20`}
      />
      <button
        onClick={() => { onAdd(ref.current?.value.trim() ?? ""); setAbierto(false); }}
        className="rounded-lg bg-text px-2.5 py-2 text-sm text-bg"
      >
        Añadir
      </button>
      <datalist id="tallas-mx">{TALLAS_MX.map((t) => <option key={t} value={t} />)}</datalist>
    </span>
  );
}

function Campo({ label, hint, full, children }: { label: string; hint?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-[var(--accent)]" />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "accent" | "warn" }) {
  const cls = tone === "accent" ? "bg-accent-soft text-accent" : tone === "warn" ? "bg-accent-soft text-accent" : "bg-elevated text-muted";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

function EstadoPill({ status }: { status: ProductInput["status"] }) {
  const map = {
    active: ["Activo", "bg-accent-soft text-accent"],
    draft: ["Borrador", "bg-elevated text-muted"],
    archived: ["Archivado", "bg-elevated text-muted"],
  } as const;
  const [label, cls] = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>;
}

// Miniatura con lupa: los modelos se parecen y hay que ver el grabado para
// distinguirlos, asi que al pasar el cursor se abre la foto en grande.
function Foto({ url, alt, className }: { url: string | null; alt: string; className: string }) {
  if (!url) return <span className={`${className} shrink-0 border border-border bg-elevated`} />;
  return (
    <span className="group/foto relative shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className={`${className} border border-border bg-elevated object-cover`} />
      <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-72 rounded-xl border border-border bg-surface p-2 shadow-[var(--shadow-md)] group-hover/foto:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="aspect-square w-full rounded-lg object-cover" />
        <span className="mt-1 block truncate text-center text-xs capitalize text-muted">{alt}</span>
      </span>
    </span>
  );
}
