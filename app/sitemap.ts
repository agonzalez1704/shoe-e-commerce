import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600; // refresh hourly

type Row = { slug: string; updated_at: string };

async function fetchRows(path: string): Promise<Record<string, string>[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return [];
  try {
    const res = await fetch(`${base}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

const activeProducts = () =>
  fetchRows("products?select=slug,updated_at&status=eq.active&order=updated_at.desc") as Promise<Row[]>;
const categories = () => fetchRows("categories?select=slug") as Promise<{ slug: string }[]>;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, cats] = await Promise.all([activeProducts(), categories()]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/products`, changeFrequency: "daily", priority: 0.9 },
    ...["envios", "devoluciones", "terminos", "privacidad"].map((s) => ({
      url: `${SITE_URL}/${s}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];

  const categoryRoutes: MetadataRoute.Sitemap = cats.map((c) => ({
    url: `${SITE_URL}/categoria/${c.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/products/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
