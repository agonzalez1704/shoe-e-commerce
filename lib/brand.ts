// ============================================================
// White-label brand config. ONE place controls name, theme colors, logo,
// copy + email identity. Pick a brand per deployment with NEXT_PUBLIC_BRAND;
// to add a brand, copy a preset below and change the values. Nothing else
// in the app hardcodes brand identity.
// ============================================================

export type ThemeMode = {
  accent: string;
  accentSoft: string;
  accentContrast: string;
  // optional neutral overrides; omit to inherit the defaults in globals.css
  bg?: string;
  surface?: string;
  elevated?: string;
  text?: string;
  muted?: string;
  border?: string;
};

// Who legally sells. Terms and the privacy notice must name the real operator —
// a second store cannot reuse the first one's entity, so this lives in config
// rather than in the page copy.
export type LegalEntity = {
  operator: string;      // "Ma. de Lourdes Cifuentes Huerta"
  rfc: string;
  address: string;       // full street address as it should read in the notice
  supportEmail: string;  // where privacy/returns requests go
  whatsapp?: string;     // digits only, country code included: "5214771234567"
};

// The storefront's editorial content. It's the most brand-specific screen, so
// it's data: a new store fills this in instead of editing the page.
export type HomeFeature = {
  eyebrow: string;
  titleTop: string;      // rendered on two lines
  titleBottom: string;
  body: string;
  points: string[];
  ctaLabel: string;
  ctaHref: string;
  main: string;          // image URL (full)
  macro: string;
  alt: string;
  flip?: boolean;
};

// Ships from here. Skydropx quotes and labels start at this address, so it
// belongs to the store, not to the shipping module.
export type Warehouse = {
  name: string; phone: string; street1: string;
  state: string; city: string; neighborhood: string; postalCode: string;
};

// An icon row. `icon` is a KEY, not a component: BrandConfig is imported by
// server and client files alike, so it has to stay plain data. Each consumer
// resolves the key against its own local map, from its own Phosphor entry point
// (`/dist/ssr` on the server, the client entry in "use client" files).
export type IconRow = { icon: string; title: string; sub?: string };

export type HomeConfig = {
  hero: { image: string; eyebrow: string; titleTop: string; titleBottom: string; body: string };
  features: HomeFeature[];
  editorial: { img: string; name: string; href: string }[];
  editorialTitle?: string;
  editorialBody?: string;
  benefits?: IconRow[];
  howItWorks?: { title: string; sub: string; steps: IconRow[] };
  finalCta?: { title: string; body: string; ctaLabel: string; ctaHref: string };
};

// PDP copy. Every field optional, and absent means the block does not render —
// a store that has not settled its shipping terms shows no shipping promise,
// rather than inheriting someone else's. This is what was publishing "Piel
// genuina · Primer cambio sin costo" on a scooter.
export type PdpConfig = {
  valueProps?: { icon: string; label: string }[];
  reassurance?: { title: string; body: string };
  shipping?: string[];                       // "Envío y devoluciones" bullets
  // Two bullets that depend on the product, not the brand: a lead time only
  // applies to made-to-order items, a size-exchange promise only to sized ones.
  shippingMadeToOrder?: string;
  shippingSized?: string;
  care?: { title: string; items: string[] }; // shown when a product has no specs
  // The size chart is footwear-specific (MX / cm / US). It renders only for
  // sized products AND only when the brand supplies one, so a store whose sized
  // items are helmets does not publish a shoe conversion table.
  sizeGuide?: { intro: string; note: string; rows: { mx: string; cm: string; us: string }[] };
  sizeHint?: string;   // one line under the size picker
};

// The handful of phrases that recur across the cart, the checkout, the order
// pages and the transactional emails. They are the same two claims repeated —
// what the store sells, and how fast it arrives — and both were written for
// shoes, so a scooter buyer was told his order was "hecho a mano sobre pedido"
// on the thank-you page and again by email. Unset means the line is omitted.
export type CopyConfig = {
  itemSingular?: string;    // "par" → "unidad"; used in headings and counters
  itemPlural?: string;
  deliveryLine?: string;    // one-line delivery promise, cart + checkout
  madeToOrderLine?: string; // lead time for made-to-order items, order + email
  exchangeLine?: string;    // the cart's exchange reassurance
  relatedNote?: string;     // subtitle over the related-products strip
  seoLine?: string;         // appended to a product's meta description
  paymentNote?: string;     // footer + Store JSON-LD; names the actual providers
  // BNPL anchor under the price. It is a claim about a provider the store must
  // actually have enabled, so it is per brand and hidden when unset.
  installments?: { provider: string; payments: number };
};

// The Meta Commerce feed. Same problem as the PDP: every one of these fields is
// a claim made to Facebook about what is in the box.
export type CatalogFeedConfig = {
  titleSuffix?: string;      // appended after "<name> <color>"
  description?: string;      // fallback for products with no description; {name} is replaced
  googleCategory?: string;
  material?: string;
  ageGroup?: string;
  shipping?: string;         // Meta's "MX::Label:0.00 MXN" shipping string
  shippingWeight?: string;
};

export type BrandConfig = {
  key: string;
  name: string;          // shown in header/footer/metadata, e.g. "sole&co"
  domain: string;        // "calzadoblade.com" — shown in copy and share cards
  accentWord?: string;   // a substring of name rendered in the accent color (wordmark)
  tagline: string;
  description: string;   // SEO meta description
  emailFrom: string;     // "Name <pedidos@domain.mx>"
  legal: LegalEntity;
  warehouse?: Warehouse;   // required to quote shipping labels
  home?: HomeConfig;     // storefront editorial; falls back to a bare hero
  pdp?: PdpConfig;       // product-page copy; each block hides when unset
  copy?: CopyConfig;     // phrases repeated across cart, checkout and email
  catalogFeed?: CatalogFeedConfig; // Meta Commerce feed claims
  logo?: { src: string; width: number; height: number; alt?: string; invertOnLight?: boolean }; // optional full image (mark+wordmark); falls back to wordmark
  markSrc?: { src: string; width: number; height: number }; // optional logo-mark IMAGE shown before the wordmark text (keeps its own colors in both themes)
  mark?: string; // optional inline SVG (uses var(--accent)/currentColor) shown before the wordmark
  announcement?: string; // top bar text
  seoSuffix?: string;    // appended to <title> default + OG, e.g. "calzado de piel hecho en México"
  catalogNote?: string;  // the line under "Tienda" on the catalogue, e.g. "envío gratis a todo México"
  refineLogoUrl?: string; // brand logo (public path) applied by auto-toon logo correction
  theme: { light: ThemeMode; dark: ThemeMode };
};

// Brand editorial art lives in the store's own Storage bucket, so the base URL
// follows whichever Supabase project this deployment points at.
const STORAGE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images`;
const BLADE_ASSETS = `${STORAGE}/blade`;
const BLADE_LANDING = `${BLADE_ASSETS}/landing`;

const BRANDS: Record<string, BrandConfig> = {
  // ---- Brand 1 (live) — Blade · calzadoblade.com ----
  // Identity: cool graphite monochrome + a razor crimson accent ("the edge").
  blade: {
    key: "blade",
    name: "Blade",
    domain: "calzadoblade.com",
    legal: {
      operator: "Ma. de Lourdes Cifuentes Huerta",
      rfc: "CIHL580621SK1",
      address: "Blvd. Mariano Escobedo Ote. 221-A, Col. San Juan de Dios, C.P. 37004, León, Guanajuato",
      supportEmail: "pedidos@calzadoblade.com",
    },
    warehouse: {
      name: "Blade", phone: "4773791352", street1: "Tres Guerras 213-B",
      state: "Guanajuato", city: "León", neighborhood: "Obregón", postalCode: "37000",
    },
    home: {
      hero: {
        image: "/hero-moto.jpg",
        eyebrow: "Hecho sobre pedido",
        titleTop: "Piel con filo,",
        titleBottom: "hecha a tu paso.",
        body: "Sneakers de piel fabricados a mano cuando los pides. Tallas MX 25–30, envío gratis en 4–7 días hábiles a todo México.",
      },
      features: [
        {
          eyebrow: "El detalle",
          titleTop: "El lujo está",
          titleBottom: "en la piel.",
          body: "Cada par nace de piel genuina trabajada a mano — texturas cocodrilo, pitón y lizard que se sienten distintas al primer paso. Sin producción en masa: solo el par que pediste.",
          points: ["Piel exótica grabada a mano", "Suela Phylon ultra ligera", "Se fabrica solo cuando lo ordenas"],
          ctaLabel: "Descubre New York",
          ctaHref: "/products/new-york?color=moka",
          main: `${BLADE_LANDING}/new-york-still.jpg`,
          macro: `${BLADE_LANDING}/croc-macro.jpg`,
          alt: "New York en piel de cocodrilo café",
        },
        {
          eyebrow: "Ligereza",
          titleTop: "Perforado.",
          titleBottom: "Ligero. Diario.",
          body: "Piel perforada que respira y una suela Phylon ultra ligera: la comodidad de un sneaker con el acabado de la piel fina. Hecho para caminar todo el día.",
          points: ["Piel perforada que respira", "Suela ultra ligera", "Silueta limpia, todos los días"],
          ctaLabel: "Descubre Manhattan",
          ctaHref: "/products/manhattan?color=blanco",
          main: `${BLADE_LANDING}/manhattan-water.jpg`,
          macro: `${BLADE_LANDING}/perforado-macro.jpg`,
          alt: "Manhattan blanco perforado",
          flip: true,
        },
      ],
      editorial: [
        { img: `${BLADE_ASSETS}/new-york/new-york-lifestyle-1.jpg`, name: "New York", href: "/products/new-york?color=moka" },
        { img: `${BLADE_ASSETS}/londres/londres-lifestyle-1.jpg`, name: "Londres", href: "/products/londres?color=negro" },
        { img: `${BLADE_ASSETS}/new-jersey/new-jersey-cafe-social-1.png`, name: "New Jersey", href: "/products/new-jersey?color=caf%C3%A9" },
      ],
      editorialTitle: "Hechos para la vida diaria",
      editorialBody: "Piel que combina con todo — de la oficina al café. Así se ven en el día a día.",
      benefits: [
        { icon: "package", title: "Hecho sobre pedido", sub: "Fabricado a mano para ti" },
        { icon: "truck", title: "Envío gratis", sub: "Entrega en 4–7 días hábiles" },
        { icon: "card", title: "Paga como quieras", sub: "Tarjeta, efectivo o Aplazo" },
        { icon: "pin", title: "Todo México", sub: "Con factura disponible" },
      ],
      howItWorks: {
        title: "Cómo funciona",
        sub: "Sin inventario muerto. Piel de verdad, hecha a pedido.",
        steps: [
          { icon: "pencil", title: "Eliges tu par", sub: "Modelo, color y talla MX 25–30." },
          { icon: "hammer", title: "Lo fabricamos a mano", sub: "Cada par se hace especialmente para ti." },
          { icon: "sparkle", title: "Llega en 4–7 días", sub: "Envío gratis a todo México, con factura." },
        ],
      },
      finalCta: {
        title: "Tu próximo par te está esperando.",
        body: "Piel, filo y comodidad — hechos a tu medida. Envío gratis a todo México.",
        ctaLabel: "Ver toda la tienda",
        ctaHref: "/products",
      },
    },
    pdp: {
      valueProps: [
        { icon: "truck", label: "Envío gratis" },
        { icon: "exchange", label: "Primer cambio sin costo" },
        { icon: "shield", label: "Garantía 6 meses" },
        { icon: "hammer", label: "Hecho a mano" },
      ],
      reassurance: {
        title: "¿No te queda? Te lo cambiamos",
        body: "Si tu talla no queda como esperabas, el primer cambio es sin costo. Piel genuina, envío gratis y entrega en 4-7 días hábiles.",
      },
      // *asteriscos* marcan énfasis: el bullet llevaba <span> en línea antes de
      // moverse aquí, y perderlo habría restilado la PDP viva de Blade.
      shipping: [
        "Envío *gratis* a todo México.",
        "Devoluciones dentro de los 30 días posteriores a la entrega.",
      ],
      shippingMadeToOrder: "Hecho sobre pedido: se fabrica y entrega en *4 a 7 días hábiles*.",
      shippingSized: "Primer cambio de talla *sin costo*.",
      sizeHint: "Queda fiel a tu talla — pide tu número habitual.",
      sizeGuide: {
        intro: "Nuestro calzado *queda fiel a tu talla*: pide tu número mexicano habitual.",
        note: "Mide tu pie de talón a punta y elige el cm más cercano. ¿Dudas? Escríbenos.",
        // MX sizing ≈ foot length in cm; US is an approximate conversion.
        rows: [
          { mx: "25", cm: "25.0", us: "7" },
          { mx: "26", cm: "26.0", us: "8" },
          { mx: "27", cm: "27.0", us: "9" },
          { mx: "28", cm: "28.0", us: "10" },
          { mx: "29", cm: "29.0", us: "11" },
          { mx: "30", cm: "30.0", us: "12" },
        ],
      },
      care: {
        title: "Materiales y cuidado",
        items: [
          "Piel *genuina*, hecha a mano.",
          "Suela Phylon ultra ligera.",
          "Limpia con un paño suave húmedo; evita sol directo y calor.",
          "Usa horma y guarda en lugar fresco y seco para conservar la forma.",
        ],
      },
    },
    copy: {
      itemSingular: "par",
      itemPlural: "pares",
      deliveryLine: "Envío gratis · entrega en 4 a 7 días hábiles a todo México.",
      madeToOrderLine: "Tu calzado se fabrica sobre pedido y se envía en 4 a 7 días hábiles.",
      exchangeLine: "Si tu talla no queda como esperabas, el primer cambio es sin costo.",
      relatedNote: "Otros modelos hechos a mano, mismo envío gratis.",
      seoLine: "Calzado hecho sobre pedido, envío a todo México.",
      paymentNote: "Pagos con tarjeta, efectivo y Aplazo. Facturación disponible.",
      installments: { provider: "Aplazo", payments: 6 },
    },
    catalogFeed: {
      titleSuffix: "— Sneaker de piel",
      description: "{name} en piel genuina. Hecho a mano en México.",
      googleCategory: "Apparel & Accessories > Shoes",
      material: "piel genuina",
      ageGroup: "adult",
      shipping: "MX::Envío gratis:0.00 MXN",
      shippingWeight: "1.2 kg",
    },
    tagline: "Filo en cada paso.",
    description:
      "Calzado de piel hecho sobre pedido en México. Diseño afilado, todas las tallas y anchos, envío a todo el país. Pago con tarjeta, efectivo o Aplazo.",
    emailFrom: "Blade <pedidos@calzadoblade.com>",
    announcement: "2 PARES POR $1,999 · combina cualquier modelo · Envío gratis a todo México",
    seoSuffix: "calzado de piel hecho en México",
    catalogNote: "hechos sobre pedido · envío gratis",
    // silver wordmark (transparent PNG); inverted to dark on light theme
    logo: { src: "/blade-logo.png", width: 565, height: 220, alt: "Blade", invertOnLight: true },
    // angular blade glyph fallback: filled with the accent
    mark: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 20 L17 4 L20 4 L9 20 Z" fill="var(--accent)"/></svg>',
    theme: {
      light: {
        accent: "#dc2626",
        accentSoft: "#fef2f2",
        accentContrast: "#ffffff",
        bg: "#f7f7f8",
        surface: "#ffffff",
        elevated: "#f2f2f4",
        text: "#0e0f13",
        muted: "#5c6068",
        border: "#e3e4e8",
      },
      dark: {
        accent: "#f04a4c",
        accentSoft: "#2a1315",
        accentContrast: "#ffffff",
        bg: "#0a0b0e",
        surface: "#121317",
        elevated: "#1a1c22",
        text: "#f4f5f6",
        muted: "#979ca6",
        border: "#262932",
      },
    },
  },

  // ---- Shoes Art (demo) — calzado infantil/juvenil, shoesart.com.mx ----
  shoesart: {
    key: "shoesart",
    domain: "shoesart.com.mx",
    // Sin lanzar: la entidad va vacía a propósito. Las páginas legales
    // muestran un aviso de "pendiente" en vez de inventar un RFC.
    legal: { operator: "", rfc: "", address: "", supportEmail: "ventas@shoesart.com.mx" },
    name: "Shoes Art",
    // Sin `home.hero`: cae al hero desnudo. Los bloques de abajo sí se definen
    // porque, sin ellos, esta tienda venía pintando la copy de Blade — "hecho
    // sobre pedido", "piel genuina" — sobre calzado infantil de temporada.
    home: {
      hero: {
        image: "/hero-moto.jpg",
        eyebrow: "Nuevas colecciones",
        titleTop: "La tendencia",
        titleBottom: "en cada paso.",
        body: "Calzado infantil y juvenil de moda. Envíos a todo México.",
      },
      features: [],
      editorial: [],
      benefits: [
        { icon: "sparkle", title: "Colecciones nuevas", sub: "Cada temporada" },
        { icon: "truck", title: "Envíos a todo México", sub: "Con guía y rastreo" },
        { icon: "card", title: "Pago seguro", sub: "En línea" },
      ],
      finalCta: {
        title: "Encuentra su próximo par.",
        body: "Calzado infantil y juvenil de moda, con envíos a todo México.",
        ctaLabel: "Ver toda la tienda",
        ctaHref: "/products",
      },
    },
    pdp: {
      valueProps: [
        { icon: "truck", label: "Envíos a todo México" },
        { icon: "sparkle", label: "Colecciones de temporada" },
      ],
      // shipping / reassurance / care sin definir: esta tienda no ha fijado sus
      // términos, y heredarlos de otra marca es justo lo que se está corrigiendo.
    },
    copy: {
      itemSingular: "par",
      itemPlural: "pares",
      seoLine: "Envíos a todo México.",
    },
    tagline: "La tendencia que marca la pauta en tu estilo.",
    description:
      "Calzado infantil y juvenil de moda. Colecciones comerciales alineadas a la tendencia urbana. Envíos a todo México.",
    emailFrom: "Shoes Art <ventas@shoesart.com.mx>",
    announcement: "Calzado de moda · Envíos a todo México · Nuevas colecciones cada temporada",
    seoSuffix: "calzado infantil de moda en México",
    // distinctive red mark from shoesart.com.mx (keeps its red in both themes) + text wordmark
    markSrc: { src: "/shoesart-mark.png", width: 26, height: 26 },
    // fallback logo for auto-toon logo correction — dark wordmark so it stays
    // visible on light footwear; the admin can override it in /admin/ajustes
    refineLogoUrl: "/shoesart-logo-dark.png",
    theme: {
      light: {
        accent: "#D4252A", accentSoft: "#fdecec", accentContrast: "#ffffff",
        bg: "#fafafa", surface: "#ffffff", elevated: "#f3f3f4", text: "#15151a", muted: "#5d6068", border: "#e6e6ea",
      },
      dark: {
        // deliberate elevation ramp: canvas → panel → raised, with a visible hairline
        accent: "#f5514e", accentSoft: "#2c1413", accentContrast: "#ffffff",
        bg: "#0b0b0d", surface: "#16161a", elevated: "#212129", text: "#f5f5f7", muted: "#9d9da8", border: "#2e2e38",
      },
    },
  },

  // ---- Movilidad eléctrica — distribuidor autorizado Honey Whale ----
  // Supabase project `honey-whale` (zcuilugerwmswjqlxtxp).
  //
  // TODO before this goes to a real domain: `name`, `domain` and `emailFrom`
  // are the distributor's, NOT the manufacturer's — a storefront titled "Honey
  // Whale" would read as the official brand site rather than a dealer's. And
  // `legal` stays empty until the client hands over RFC and domicilio fiscal;
  // LegalGate refuses to render terms and privacy until it is filled, which is
  // what stops one store publishing another's entity.
  honeywhale: {
    key: "honeywhale",
    name: "TODO Distribuidor",
    domain: "",
    legal: { operator: "", rfc: "", address: "", supportEmail: "" },
    home: {
      hero: {
        // Lives in public/ rather than Storage: a brand asset served straight
        // off Vercel's CDN costs no Supabase egress at all.
        image: "/hero-honeywhale.webp",
        eyebrow: "Movilidad eléctrica",
        titleTop: "La ciudad,",
        titleBottom: "sin gasolina.",
        body: "Scooters, bicicletas y motos eléctricas. Distribuidor autorizado, con garantía y envío a todo México.",
      },
      features: [],
      editorial: [],
      benefits: [
        { icon: "shield", title: "Distribuidor autorizado", sub: "Productos originales" },
        { icon: "truck", title: "Envíos a todo México", sub: "Con guía y rastreo" },
        { icon: "card", title: "Pago seguro", sub: "En línea, a meses o de contado" },
        { icon: "lightning", title: "100% eléctrico", sub: "Cero emisiones" },
      ],
      finalCta: {
        title: "Muévete distinto.",
        body: "Scooters, bicicletas y motos eléctricas. Envíos a todo México.",
        ctaLabel: "Ver toda la tienda",
        ctaHref: "/products",
      },
      // howItWorks / editorialTitle: sin definir a propósito. No hay tiempos de
      // entrega ni proceso confirmados por el cliente, y una promesa inventada
      // en la home es la misma falla que puso "Hecho sobre pedido" en un scooter.
    },
    pdp: {
      valueProps: [
        { icon: "shield", label: "Distribuidor autorizado" },
        { icon: "truck", label: "Envíos a todo México" },
        { icon: "lightning", label: "100% eléctrico" },
      ],
      // reassurance / shipping / care: vacíos hasta que el cliente entregue sus
      // términos reales de envío, garantía y devolución. Sin ellos los bloques
      // no se pintan — es preferible a heredar los de una zapatería.
    },
    copy: {
      itemSingular: "producto",
      itemPlural: "productos",
      seoLine: "Envíos a todo México.",
      paymentNote: "Pagos con tarjeta, efectivo y transferencia.",
      // deliveryLine / madeToOrderLine / exchangeLine: sin tiempos ni política
      // de cambio confirmados. Omitirlos deja el carrito y el checkout sin
      // promesa, que es lo correcto mientras no exista una.
    },
    // catalogFeed sin definir: el feed de Meta no está conectado para esta
    // tienda, y sin config no emite categoría, material ni peso en vez de
    // declararle a Facebook que un scooter es un zapato de piel.
    tagline: "Movilidad eléctrica para la ciudad.",
    description:
      "Scooters, bicicletas y motos eléctricas. Distribuidor autorizado. Envíos a todo México.",
    emailFrom: "",
    announcement: "Scooters y motos eléctricas · Envíos a todo México",
    seoSuffix: "scooters y motos eléctricas en México",
    catalogNote: "envío a todo México",
    // amber on near-black — placeholder until the client's palette is settled
    theme: {
      light: {
        accent: "#E8A317", accentSoft: "#fdf4e3", accentContrast: "#1a1a1a",
        bg: "#fafafa", surface: "#ffffff", elevated: "#f2f2f3", text: "#141417", muted: "#5c5f66", border: "#e5e5e9",
      },
      dark: {
        accent: "#F5B935", accentSoft: "#2a2113", accentContrast: "#1a1a1a",
        bg: "#0a0a0c", surface: "#151518", elevated: "#1f1f25", text: "#f5f5f7", muted: "#9c9ca6", border: "#2c2c34",
      },
    },
  },

  // ---- Brand 2 (template — replace name/colors/logo/email) ----
  altura: {
    key: "altura",
    domain: "",
    // Sin lanzar: la entidad va vacía a propósito. Las páginas legales
    // muestran un aviso de "pendiente" en vez de inventar un RFC.
    legal: { operator: "", rfc: "", address: "", supportEmail: "hola@altura.mx" },
    name: "Altura",
    tagline: "Hecho a mano, paso a paso.",
    description:
      "Calzado de piel de alta gama fabricado sobre pedido en México. Tallas y anchos a elegir, envío a todo el país.",
    emailFrom: "Altura <pedidos@altura.mx>",
    theme: {
      light: { accent: "#059669", accentSoft: "#e7f6f0", accentContrast: "#ffffff" },
      dark: { accent: "#34d399", accentSoft: "#07271d", accentContrast: "#052e23" },
    },
  },

  // ---- Brand 3 (template) ----
  vellora: {
    key: "vellora",
    domain: "",
    // Sin lanzar: la entidad va vacía a propósito. Las páginas legales
    // muestran un aviso de "pendiente" en vez de inventar un RFC.
    legal: { operator: "", rfc: "", address: "", supportEmail: "hola@vellora.mx" },
    name: "Vellora",
    tagline: "Piel mexicana, diseño atemporal.",
    description:
      "Zapatos de piel artesanales hechos sobre pedido en México. Todas las tallas, envío a todo el país con factura disponible.",
    emailFrom: "Vellora <pedidos@vellora.mx>",
    theme: {
      light: { accent: "#2563eb", accentSoft: "#eaf0ff", accentContrast: "#ffffff" },
      dark: { accent: "#5b8cff", accentSoft: "#0f1a33", accentContrast: "#0a1020" },
    },
  },
};

// An unknown key used to fall back to Blade. That is the worst possible
// default: a typo in NEXT_PUBLIC_BRAND, or a deployment whose brand has not
// been added yet, silently served Blade's name, domain and — through the terms
// and privacy pages — Blade's operator and RFC on someone else's URL. LegalGate
// cannot catch it, because by then the config *is* a fully valid one.
//
// So: unset still means Blade (its own deployment predates the variable), but a
// key that does not resolve now fails the build instead of impersonating.
function resolveBrand(): BrandConfig {
  const key = process.env.NEXT_PUBLIC_BRAND;
  if (!key) return BRANDS.blade;
  const found = BRANDS[key];
  if (!found) {
    throw new Error(
      `NEXT_PUBLIC_BRAND="${key}" no existe en lib/brand.ts. ` +
        `Marcas disponibles: ${Object.keys(BRANDS).join(", ")}. ` +
        `Se aborta en vez de caer a Blade: eso publicaría su RFC y su dominio en esta tienda.`,
    );
  }
  return found;
}

export const activeBrand: BrandConfig = resolveBrand();

// Build a <style> body that overrides the theme tokens for the active brand.
function modeVars(m: ThemeMode): string {
  const v: Record<string, string | undefined> = {
    "--accent": m.accent,
    "--accent-soft": m.accentSoft,
    "--accent-contrast": m.accentContrast,
    "--bg": m.bg,
    "--surface": m.surface,
    "--elevated": m.elevated,
    "--text": m.text,
    "--muted": m.muted,
    "--border": m.border,
  };
  return Object.entries(v)
    .filter(([, val]) => val)
    .map(([k, val]) => `${k}:${val}`)
    .join(";");
}

export function brandThemeCss(b: BrandConfig = activeBrand): string {
  const light = modeVars(b.theme.light);
  const dark = modeVars(b.theme.dark);
  return (
    `:root,[data-theme="light"]{${light}}` +
    `[data-theme="dark"]{${dark}}` +
    `@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){${dark}}}`
  );
}
