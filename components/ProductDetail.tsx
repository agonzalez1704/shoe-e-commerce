"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQueryState, parseAsString } from "nuqs";
import { Truck, ShieldCheck, ArrowsClockwise, Hammer, Lightning, Sparkle, Tag } from "@phosphor-icons/react";
import { activeBrand } from "@/lib/brand";
import { formatCents } from "@/lib/money";
import { comboOf, precioConPromo } from "@/lib/pricing";
import { PdpInfo } from "@/components/PdpInfo";
import { SpecHighlights } from "@/components/SpecHighlights";
import { ZoomImage } from "@/components/ZoomImage";
import { Lightbox } from "@/components/Lightbox";
import { VariantPicker } from "@/components/VariantPicker";
import { Stars } from "@/components/Stars";
import { trackMeta } from "@/components/MetaPixel";
import { metaContentId } from "@/lib/meta-content";
import type { ProductDetail as Product } from "@/lib/catalog";

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
}: {
  product: Product;
  rating?: { average: number; count: number };
  initialColor?: string;
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
  const combo = comboOf(product.comboMinQty, product.comboPriceCents);

  // headline price follows the chosen colour (variant override, else base)
  const colorPriceCents = useMemo(
    () => product.variants.find((v) => v.color === color && v.price_cents != null)?.price_cents ?? product.base_price_cents,
    [product.variants, product.base_price_cents, color],
  );
  // sale price with the active promo (null for combos). precioEfectivo is what
  // the buyer pays and what create_order will charge.
  const precioEfectivo = precioConPromo(colorPriceCents, product.promoPercent);
  const onSale = product.promoPercent != null && precioEfectivo < colorPriceCents;

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
        -{product.promoPercent}%
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

  const comboBox = combo && (
    <div className="rounded-2xl border border-accent/30 bg-accent-soft/60 p-4">
      <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold">
        <Tag size={16} weight="fill" className="text-accent" />
        Combo {combo.minQty} {ITEMS} — <span className="text-accent">{mxn(combo.priceCents)}</span>
      </p>
      <p className="mt-1.5 text-sm text-muted">
        Combina {combo.minQty} {ITEMS} del combo — este u otro modelo, cualquier color. El descuento se aplica
        solo al agregar {combo.minQty} al carrito.
      </p>
      <Link href="/products" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
        Ver modelos del combo →
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

  // La galería del showcase. Sin esto, una tienda con 13 fotos por producto
  // mostraría una sola: el layout nació para un catálogo de una foto.
  const galeria = (
    <div className="order-1 md:order-2">
      <div className={`aspect-square overflow-hidden rounded-3xl ${unaFoto ? "bg-white" : "border border-border bg-elevated"}`}>
        {foto(unaFoto ? "contain" : "cover")}
      </div>
      {rest.length > 0 && (
        <ul className="no-scrollbar mt-3 flex gap-2 overflow-x-auto overscroll-x-contain">
          {rest.map((img, i) => (
            <li key={i} className="w-16 shrink-0 sm:w-20">
              <div className="aspect-square overflow-hidden rounded-xl border border-border bg-elevated">
                <ZoomImage src={img.url} alt={img.alt ?? product.name} onClick={() => setLightbox(i + 1)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // ---- showcase: bandas a sangre, nombre en escala editorial, cifras grandes.
  // Es la lectura del sitio de referencia que estos datos aguantan: una foto por
  // producto y dos a cuatro cifras. Va por marca porque cambiar el layout de una
  // tienda que ya vende no es gratis.
  if (SHOWCASE) {
    return (
      <div>
        {lightboxEl}

        {/* banda del hero */}
        <section className="ml-[calc(50%-50vw)] w-screen border-b border-border bg-elevated/40">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-[1.05fr_1fr] md:items-center md:gap-12 md:py-16">
            <div className="order-2 md:order-1">
              {product.brand && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">{product.brand}</p>
              )}
              <h1 className="mt-3 text-4xl font-semibold uppercase leading-[0.9] tracking-tight sm:text-6xl md:text-7xl">
                {product.name}
              </h1>
              {estrellas && <div className="mt-3">{estrellas}</div>}
              {product.description && (
                <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted">{product.description}</p>
              )}
              <div className="mt-6">{precio}{notaPrecio}</div>
              <a
                href="#comprar"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-accent-contrast shadow-[var(--shadow-md)] transition-transform active:scale-[0.98] md:hidden"
              >
                Comprar
              </a>
            </div>
            {galeria}
          </div>
        </section>

        {/* banda de cifras */}
        <section className="ml-[calc(50%-50vw)] w-screen border-b border-border">
          <div className="mx-auto max-w-6xl">
            <SpecHighlights attributes={product.attributes} variant="band" />
          </div>
        </section>

        {/* comprar */}
        <div id="comprar" className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 py-12 md:grid-cols-2 md:gap-14">
          <div className="space-y-6">
            {valueProps}
            {comboBox}
            {reassuranceBox}
            {info}
          </div>
          <div className="md:sticky md:top-24 md:self-start">
            <div className="rounded-2xl border border-border bg-surface p-5">
              {precio}
              {notaPrecio}
              {picker}
            </div>
          </div>
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
