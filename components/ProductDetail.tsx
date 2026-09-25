"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQueryState, parseAsString } from "nuqs";
import { Truck, ShieldCheck, ArrowsClockwise, Hammer, Lightning, Sparkle, Tag } from "@phosphor-icons/react";
import { activeBrand } from "@/lib/brand";
import { formatCents } from "@/lib/money";
import { comboOf, precioConPromo, precioPar } from "@/lib/pricing";
import { PdpInfo } from "@/components/PdpInfo";
import { SpecHighlights } from "@/components/SpecHighlights";
import { ZoomImage } from "@/components/ZoomImage";
import { Lightbox } from "@/components/Lightbox";
import { VariantPicker } from "@/components/VariantPicker";
import { GaleriaPdp } from "@/components/pdp/GaleriaPdp";
import { CompraPdp } from "@/components/pdp/CompraPdp";
import { Stars } from "@/components/Stars";
import { trackMeta } from "@/components/MetaPixel";
import { metaContentId } from "@/lib/meta-content";
import type { ProductDetail as Product, ProductCard } from "@/lib/catalog";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

// BNPL anchor under the price. Per brand: naming a provider the store has not
// enabled is a promise it cannot keep at checkout.
const BNPL = activeBrand.copy?.installments;

// Icon keys → components, resolved from the client entry point (this file is
// "use client"). BrandConfig only carries the key; see lib/brand.ts.
const ICONS: Record<string, typeof Truck> = {
  truck: Truck,
  exchange: ArrowsClockwise,
  shield: ShieldCheck,
  hammer: Hammer,
  lightning: Lightning,
  sparkle: Sparkle,
};

const VALUE_PROPS = activeBrand.pdp?.valueProps ?? [];
const REASSURANCE = activeBrand.pdp?.reassurance;
const ITEMS = activeBrand.copy?.itemPlural ?? "productos";
// Layout de la PDP. El showcase es el default: sirve igual a un catálogo de una
// foto y a uno con galería, y es lo que el cliente pidió para todas las tiendas.
// "classic" queda como la salida explícita.
const SHOWCASE = activeBrand.pdp?.layout !== "classic";

export function ProductDetail({
  product,
  rating,
  initialColor,
  sugeridos = [],
}: {
  product: Product;
  rating?: { average: number; count: number };
  initialColor?: string;
  sugeridos?: ProductCard[]; // pares del combo para la invitacion al segundo par
}) {
  const colors = useMemo(
    () => Array.from(new Set(product.variants.map((v) => v.color))),
    [product.variants],
  );
  // colour lives in the URL (?color=) so a picked colourway is shareable and the
  // server render agrees with it — the page already reads the same param.
  // No default on the parser on purpose: nuqs strips a param that equals its
  // default, which would silently drop ?color= from a link the buyer is sharing.
  const fallbackColor = (initialColor && colors.includes(initialColor) ? initialColor : colors[0]) ?? "";
  const [colorParam, setColor] = useQueryState("color", parseAsString.withOptions({ history: "replace" }));
  const color = colorParam && colors.includes(colorParam) ? colorParam : fallbackColor;

  // images for the chosen color + any general (null-color) shots; fallback to all
  const gallery = useMemo(() => {
    const matched = product.images.filter((i) => i.color === color || i.color == null);
    return matched.length ? matched : product.images;
  }, [product.images, color]);

  const [hero, ...rest] = gallery;
  const [lightbox, setLightbox] = useState<number | null>(null);
  // el combo es por color: el color elegido puede estar fuera aunque el modelo este dentro
  const combo = product.coloresFueraCombo.includes(color) ? null : comboOf(product.comboMinQty, product.comboPriceCents, product.comboMixtoCents, product.comboExoticoCents);
  const esExotico = product.coloresExoticos.includes(color);

  // headline price follows the chosen colour (variant override, else base)
  const colorPriceCents = useMemo(
    () => product.variants.find((v) => v.color === color && v.price_cents != null)?.price_cents ?? product.base_price_cents,
    [product.variants, product.base_price_cents, color],
  );
  // sale price with the active promo (null for combos). precioEfectivo is what
  // the buyer pays and what create_order will charge.
  const promoPercent = product.promoPorColor[color] ?? null; // la promo puede ser solo de algunos colores
  const precioEfectivo = precioConPromo(colorPriceCents, promoPercent);
  const onSale = promoPercent != null && precioEfectivo < colorPriceCents;

  // Meta: ViewContent per colour, since each colour is its own catalog item —
  // dynamic ads match on this id
  useEffect(() => {
    if (!color) return;
    trackMeta("ViewContent", {
      content_ids: [metaContentId(product.slug, color)],
      content_name: `${product.name} ${color}`,
      content_type: "product",
      value: precioEfectivo / 100,
      currency: "MXN",
    });
  }, [product.slug, product.name, color, colorPriceCents]);

  const lightboxEl = lightbox !== null && (
    <Lightbox
      images={gallery}
      index={lightbox}
      name={product.name}
      onClose={() => setLightbox(null)}
      onIndex={setLightbox}
    />
  );

  const precio = onSale ? (
    <p className="nums flex items-baseline gap-2.5">
      <span className="text-2xl font-medium text-accent">{mxn(precioEfectivo)}</span>
      <span className="text-lg text-muted line-through">{mxn(colorPriceCents)}</span>
      <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-contrast">
        -{promoPercent}%
      </span>
    </p>
  ) : (
    <p className="nums text-2xl font-medium">{mxn(colorPriceCents)}</p>
  );

  const notaPrecio = (
    <p className="mt-1 text-xs text-muted">
      Precio con IVA incluido
      {BNPL && (
        <>
          {" "}· o {BNPL.payments} pagos de{" "}
          <span className="font-medium text-text">{mxn(Math.round(precioEfectivo / BNPL.payments))}</span> con {BNPL.provider}
        </>
      )}
    </p>
  );

  const valueProps = VALUE_PROPS.length > 0 && (
    // The count is per brand now, so an odd one out would sit alone in a
    // half-width tile; it stretches across instead.
    <ul className="grid grid-cols-2 gap-2 [&>li:last-child:nth-child(odd)]:col-span-2">
      {VALUE_PROPS.map(({ icon: k, label }) => {
        const Icon = ICONS[k] ?? ShieldCheck;
        return (
          <li key={label} className="flex items-center gap-2 rounded-lg border border-border bg-elevated/60 px-2.5 py-2 text-xs">
            <Icon size={15} weight="bold" className="shrink-0 text-accent" />
            {label}
          </li>
        );
      })}
    </ul>
  );

  // Entrada al wizard desde la ficha: este color entra como par 1. El precio
  // depende de la piel de los dos (0066), asi que se muestran las dos salidas.
  const comboBox = combo && (
    <div className="rounded-2xl border border-accent/40 bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <Tag size={16} weight="fill" className="text-accent" /> Llévate 2 {ITEMS}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            Este par + un clásico <strong className="nums text-text">{mxn(precioPar(combo, esExotico ? 1 : 0))}</strong>
            {combo.mixtoCents != null && <> · + un exótico <strong className="nums text-text">{mxn(precioPar(combo, esExotico ? 2 : 1))}</strong></>}
          </p>
        </div>
        {esExotico && <span className="shrink-0 rounded-full bg-text px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bg">exótico</span>}
      </div>
      <Link
        href={`/combo/armar?par1=${product.slug}&color=${encodeURIComponent(color)}`}
        className="mt-3 flex h-12 items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-semibold text-accent-contrast transition-transform active:scale-[0.99]"
      >
        Armar combo con este par →
      </Link>
    </div>
  );

  const reassuranceBox = REASSURANCE && (
    <div className="space-y-2 rounded-xl border border-accent/25 bg-accent-soft/60 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <ArrowsClockwise size={18} weight="fill" className="text-accent" />
        {REASSURANCE.title}
      </p>
      <p className="flex items-start gap-2 text-sm text-muted">
        <ShieldCheck size={17} className="mt-0.5 shrink-0" />
        {REASSURANCE.body}
      </p>
    </div>
  );

  const picker = (
    <VariantPicker
      slug={product.slug}
      variants={product.variants}
      basePriceCents={product.base_price_cents}
      color={color}
      onColorChange={setColor}
      madeToOrder={product.made_to_order}
    />
  );

  const info = (
    <PdpInfo
      sized={product.variants.some((v) => v.size_value !== null)}
      madeToOrder={product.made_to_order}
      attributes={product.attributes}
    />
  );

  const estrellas = rating && (
    <p className="flex items-center gap-2 text-sm text-muted">
      <Stars value={rating.average} />
      <span className="nums">{rating.average.toFixed(1)} · {rating.count} reseñas</span>
    </p>
  );

  const foto = (fit: "cover" | "contain") =>
    hero ? (
      <ZoomImage src={hero.url} alt={hero.alt ?? product.name} priority fit={fit} onClick={() => setLightbox(0)} />
    ) : (
      <div className="grid h-full w-full place-items-center text-sm text-muted">Sin foto por ahora</div>
    );

  // Una sola foto casi siempre es el póster del proveedor sobre blanco: se
  // encaja entera en un panel blanco. Con galería son fotos producidas y el
  // recorte cerrado es el correcto.
  const unaFoto = gallery.length === 1;

  // ---- showcase (default de todas las tiendas). Rediseño 2026-09: la compra
  // manda. En celular (96% de las visitas) foto deslizable, precio, color y
  // talla sin bajar, y una barra fija con las dos compras. En escritorio,
  // fotos en rejilla y el panel de compra fijo a la derecha. Los detalles van
  // plegados abajo: antes empujaban la talla ~1,500 px.
  if (SHOWCASE) {
    const colores = colors.map((c) => ({
      color: c,
      foto: product.images.find((i) => i.color === c)?.url ?? null,
    }));
    const conClasico = combo ? precioPar(combo, esExotico ? 1 : 0) : null;
    return (
      <div className="pb-28 md:pb-0">
        {lightboxEl}

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_420px] md:gap-12 lg:gap-16">
          <GaleriaPdp images={gallery} name={product.name} onOpen={setLightbox} />

          <div className="space-y-5 md:sticky md:top-24 md:self-start">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {product.brand && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent">{product.brand}</p>
                )}
                <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight md:text-4xl">{product.name}</h1>
                {estrellas && <div className="mt-1.5">{estrellas}</div>}
              </div>
              <div className="shrink-0 text-right">
                {onSale ? (
                  <>
                    <p className="nums text-[22px] font-bold text-accent md:text-[28px]">{mxn(precioEfectivo)}</p>
                    <p className="nums text-xs text-muted line-through">{mxn(colorPriceCents)}</p>
                  </>
                ) : (
                  <p className="nums text-[22px] font-bold md:text-[28px]">{mxn(colorPriceCents)}</p>
                )}
                {conClasico != null && (
                  <p className="text-xs text-muted">o 2 pares <strong className="nums text-text">{mxn(conClasico)}</strong></p>
                )}
              </div>
            </div>
            {notaPrecio}

            <CompraPdp
              slug={product.slug}
              name={product.name}
              variants={product.variants}
              color={color}
              colores={colores}
              onColorChange={setColor}
              madeToOrder={product.made_to_order}
              precioCents={precioEfectivo}
              combo={combo}
              esExotico={esExotico}
              sugeridos={sugeridos.filter((s) => s.slug !== product.slug)}
              sizeHint={activeBrand.pdp?.sizeHint}
            />

            {valueProps}
          </div>
        </div>

        {/* los detalles, plegados */}
        <div className="mx-auto mt-10 max-w-3xl md:mt-16">
          <SpecHighlights attributes={product.attributes} variant="band" />
          {product.description && (
            <details open className="group border-b border-border py-1">
              <summary className="flex cursor-pointer list-none items-center py-3 text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                Descripción
                <span className="ml-auto text-muted transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-muted">{product.description}</p>
            </details>
          )}
          {reassuranceBox && <div className="my-4">{reassuranceBox}</div>}
          {info}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-14">
      <div className="grid grid-cols-2 gap-3 self-start md:sticky md:top-24">
        {hero ? (
          <div className="col-span-2 aspect-square overflow-hidden rounded-2xl border border-border bg-elevated">
            {foto(unaFoto ? "contain" : "cover")}
          </div>
        ) : (
          <div className="col-span-2 grid aspect-square place-items-center rounded-2xl border border-border bg-elevated text-sm text-muted">
            Sin foto por ahora
          </div>
        )}
        {rest.map((img, i) => (
          <div key={i} className="aspect-square overflow-hidden rounded-xl border border-border bg-elevated">
            <ZoomImage src={img.url} alt={img.alt ?? product.name} onClick={() => setLightbox(i + 1)} />
          </div>
        ))}
      </div>

      {lightboxEl}

      <div>
        {product.brand && <p className="text-sm uppercase tracking-wide text-muted">{product.brand}</p>}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{product.name}</h1>
        {estrellas && <div className="mt-2">{estrellas}</div>}
        <div className="mt-3">{precio}{notaPrecio}</div>
        <div className="mt-4">{valueProps}</div>
        <SpecHighlights attributes={product.attributes} />
        {comboBox && <div className="mt-6">{comboBox}</div>}
        {product.description && (
          <p className="mt-5 max-w-prose text-sm leading-relaxed text-muted">{product.description}</p>
        )}
        {reassuranceBox && <div className="mt-6">{reassuranceBox}</div>}
        {picker}
        {info}
      </div>
    </div>
  );
}
