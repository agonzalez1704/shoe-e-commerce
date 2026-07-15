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

export type BrandConfig = {
  key: string;
  name: string;          // shown in header/footer/metadata, e.g. "sole&co"
  accentWord?: string;   // a substring of name rendered in the accent color (wordmark)
  tagline: string;
  description: string;   // SEO meta description
  emailFrom: string;     // "Name <pedidos@domain.mx>"
  logo?: { src: string; width: number; height: number; alt?: string; invertOnLight?: boolean }; // optional full image (mark+wordmark); falls back to wordmark
  markSrc?: { src: string; width: number; height: number }; // optional logo-mark IMAGE shown before the wordmark text (keeps its own colors in both themes)
  mark?: string; // optional inline SVG (uses var(--accent)/currentColor) shown before the wordmark
  announcement?: string; // top bar text
  seoSuffix?: string;    // appended to <title> default + OG, e.g. "calzado de piel hecho en México"
  refineLogoUrl?: string; // brand logo (public path) applied by auto-toon logo correction
  theme: { light: ThemeMode; dark: ThemeMode };
};

const BRANDS: Record<string, BrandConfig> = {
  // ---- Brand 1 (live) — Blade · calzadoblade.com ----
  // Identity: cool graphite monochrome + a razor crimson accent ("the edge").
  blade: {
    key: "blade",
    name: "Blade",
    tagline: "Filo en cada paso.",
    description:
      "Calzado de piel hecho sobre pedido en México. Diseño afilado, todas las tallas y anchos, envío a todo el país. Pago con tarjeta, OXXO o SPEI.",
    emailFrom: "Blade <pedidos@calzadoblade.com>",
    announcement: "Hecho sobre pedido · Envío en 4-7 días hábiles · Envíos a todo México",
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

export const activeBrand: BrandConfig =
  BRANDS[process.env.NEXT_PUBLIC_BRAND ?? "blade"] ?? BRANDS.blade;

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
