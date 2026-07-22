// Single source of truth for Meta catalog content ids, shared by the pixel
// (browser events), the Conversions API and the product feed. If the pixel and
// the feed disagree here, dynamic ads can't match a viewed product to its
// catalog entry — so both must derive the id the same way.

export function slugifyColor(color: string): string {
  return color
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// matches the catalog feed's row id: `${slug}__${colorslug}`
export function metaContentId(slug: string, color: string): string {
  return `${slug}__${slugifyColor(color)}`;
}
