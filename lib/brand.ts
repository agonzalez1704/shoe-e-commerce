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

export type HomeConfig = {
  hero: { image: string; eyebrow: string; titleTop: string; titleBottom: string; body: string };
  features: HomeFeature[];
  editorial: { img: string; name: string; href: string }[];
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
  logo?: { src: string; width: number; height: number; alt?: string; invertOnLight?: boolean }; // optional full image (mark+wordmark); falls back to wordmark
  markSrc?: { src: string; width: number; height: number }; // optional logo-mark IMAGE shown before the wordmark text (keeps its own colors in both themes)
  mark?: string; // optional inline SVG (uses var(--accent)/currentColor) shown before the wordmark
  announcement?: string; // top bar text
  seoSuffix?: string;    // appended to <title> default + OG, e.g. "calzado de piel hecho en México"
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
    },
    tagline: "Filo en cada paso.",
    description:
      "Calzado de piel hecho sobre pedido en México. Diseño afilado, todas las tallas y anchos, envío a todo el país. Pago con tarjeta, efectivo o Aplazo.",
    emailFrom: "Blade <pedidos@calzadoblade.com>",
    announcement: "2 PARES POR $1,999 · combina cualquier modelo · Envío gratis a todo México",
    seoSuffix: "calzado de piel hecho en México",
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
