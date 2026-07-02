// DEMO seed for Shoes Art (shoesart.com.mx). Wipes the existing catalog and
// inserts the "Nuestra Colección" products with their template images.
//   node --env-file=.env.local scripts/seed-shoesart.mjs
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !SK) { console.error("Falta NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const auth = { apikey: SK, Authorization: `Bearer ${SK}` };
const IMG_BASE = "https://shoesart.com.mx/assets/img/portfolio";

const PRODUCTS = [
  { name: "Venecia 549",   color: "Blanco/Negro/Gris", material: "Nairobi", tipo: "Ranil", desde: 22, img: "app-1.jpg",      price: 42900 },
  { name: "Roma 191",      color: "Maquillaje",        material: "Nairobi", tipo: "PVC",   desde: 22, img: "product-1.jpg",  price: 39900 },
  { name: "Florencia 190", color: "Negro",             material: "Nairobi", tipo: "PVC",   desde: 22, img: "branding-1.jpg", price: 39900 },
  { name: "Bolonia 271",   color: "Negro",             material: "Nairobi", tipo: "PVC",   desde: 23, img: "books-1.jpg",    price: 41900 },
  { name: "Capri 252",     color: "Maquillaje",        material: "Mezcala", tipo: "PVC",   desde: 23, img: "app-2.jpg",      price: 40900 },
  { name: "Nápoles 254",   color: "Negro",             material: "Mezcala", tipo: "PVC",   desde: 23, img: "product-2.jpg",  price: 40900 },
  { name: "Nápoles 274",   color: "Negro",             material: "Mezcala", tipo: "PVC",   desde: 23, img: "branding-2.jpg", price: 40900 },
  { name: "Pompeya 416",   color: "Maquillaje",        material: "Nairobi", tipo: "Ranil", desde: 22, img: "books-2.jpg",    price: 43900 },
  { name: "Lazio 415",     color: "Negro",             material: "Nairobi", tipo: "Ranil", desde: 22, img: "app-3.jpg",      price: 43900 },
  { name: "Toscana 6050",  color: "Negro",             material: "Nairobi", tipo: "PVC",   desde: 22, img: "product-3.jpg",  price: 39900 },
  { name: "Sicilia 1001",  color: "Blanco/Plata",      material: "Nairobi", tipo: "Ranil", desde: 22, img: "branding-3.jpg", price: 44900 },
  { name: "Atalanta 1906", color: "Negro",             material: "Nairobi", tipo: "Ranil", desde: 22, img: "books-3.jpg",    price: 43900 },
  { name: "Cagliari 412",  color: "Negro",             material: "Buck",    tipo: "Ranil", desde: 22, img: "Tenis1.jpg",     price: 45900 },
  { name: "Fiorentina 2644", color: "Blanco",          material: "Cabra",   tipo: "Ranil", desde: 22, img: "Tenis2.jpg",     price: 47900 },
];

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function rest(method, path, body, extra = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    method,
    headers: { ...auth, "Content-Type": "application/json", ...extra },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

console.log("Limpiando catálogo existente…");
await rest("DELETE", "products?id=not.is.null");
await rest("DELETE", "brands?id=not.is.null");

console.log("Insertando marcas (líneas)…");
const materiales = [...new Set(PRODUCTS.map((p) => p.material))];
const brands = await rest("POST", "brands", materiales.map((m) => ({ name: m, slug: slug(m) })), { Prefer: "return=representation" });
const brandId = Object.fromEntries(brands.map((b) => [b.name, b.id]));

for (const p of PRODUCTS) {
  const s = slug(p.name);
  const desc = `Modelo ${p.name}. Color ${p.color}, línea ${p.material}, suela ${p.tipo}. Tallas mexicanas del ${p.desde} al 26. Calzado de moda, envío a todo México.`;
  const [prod] = await rest("POST", "products", [{
    brand_id: brandId[p.material], name: p.name, slug: s, description: desc,
    gender: "kids", base_price_cents: p.price, status: "active", made_to_order: false,
  }], { Prefer: "return=representation" });

  // variants: tallas desde..26 (color único)
  const tallas = [];
  for (let t = p.desde; t <= 26; t++) tallas.push(t);
  const variants = await rest("POST", "variants",
    tallas.map((t) => ({
      product_id: prod.id, sku: `${s}-${t}`.toUpperCase(), size_value: String(t), size_system: "MX",
      width: "medium", color: p.color.toLowerCase(), status: "active",
    })),
    { Prefer: "return=representation" });

  // inventory: 8 por variante
  await rest("POST", "inventory", variants.map((v) => ({ variant_id: v.id, qty_on_hand: 8, qty_reserved: 0, reorder_level: 2 })));

  // imagen: descargar de shoesart -> subir a bucket -> product_images
  try {
    const ir = await fetch(`${IMG_BASE}/${p.img}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (ir.ok) {
      const buf = Buffer.from(await ir.arrayBuffer());
      const obj = `shoesart/${s}.jpg`;
      const up = await fetch(`${SB}/storage/v1/object/product-images/${obj}`, {
        method: "POST", headers: { ...auth, "Content-Type": "image/jpeg", "x-upsert": "true" }, body: buf,
      });
      if (up.ok) {
        await rest("POST", "product_images", [{ product_id: prod.id, url: `${SB}/storage/v1/object/public/product-images/${obj}`, alt: p.name, position: 0 }]);
      } else console.warn(`  img upload fail ${p.name}: ${up.status}`);
    } else console.warn(`  img download fail ${p.name}: ${ir.status}`);
  } catch (e) { console.warn(`  img error ${p.name}:`, e.message); }

  console.log(`✓ ${p.name} (${tallas.length} tallas)`);
}
console.log("\nListo. Demo Shoes Art sembrado.");
