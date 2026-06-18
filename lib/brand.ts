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
  logo?: { src: string; width: number; height: number; alt?: string }; // optional image; falls back to wordmark
  theme: { light: ThemeMode; dark: ThemeMode };
};

const BRANDS: Record<string, BrandConfig> = {
  // ---- Brand 1 (current) ----
  soleco: {
    key: "soleco",
    name: "sole&co",
    accentWord: "&",
    tagline: "Calzado para cada paso.",
    description:
      "Calzado de piel hecho sobre pedido en México. Todas las tallas y anchos, envío a todo el país. Pago con tarjeta, OXXO o SPEI.",
    emailFrom: "sole&co <pedidos@soleco.mx>",
    theme: {
      light: { accent: "#ea580c", accentSoft: "#fff1e8", accentContrast: "#ffffff" },
      dark: { accent: "#fb7137", accentSoft: "#2a1a10", accentContrast: "#18120c" },
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
  BRANDS[process.env.NEXT_PUBLIC_BRAND ?? "soleco"] ?? BRANDS.soleco;

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
