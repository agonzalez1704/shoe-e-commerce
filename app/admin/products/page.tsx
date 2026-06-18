import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { ProductStatusToggle } from "@/components/ProductStatusToggle";

export const dynamic = "force-dynamic";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

export default async function AdminProducts() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, slug, status, base_price_cents, brands(name), variants(id)")
    .order("created_at", { ascending: false });

  type Row = {
    id: string; name: string; slug: string; status: "draft" | "active" | "archived";
    base_price_cents: number; brands: { name: string } | null; variants: { id: string }[];
  };
  const products = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Productos</h1>
          <span className="text-sm text-muted">{products.length}</span>
        </div>
        <Link href="/admin/products/new" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-contrast">
          Nuevo producto
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3 text-right">Variantes</th>
              <th className="px-4 py-3 text-right">Precio</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Editar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-elevated">
                <td className="px-4 py-3">
                  <Link href={`/products/${p.slug}`} className="font-medium hover:text-accent">{p.name}</Link>
                  {p.brands?.name && <p className="text-xs text-muted">{p.brands.name}</p>}
                </td>
                <td className="nums px-4 py-3 text-right">{p.variants?.length ?? 0}</td>
                <td className="nums px-4 py-3 text-right">{mxn(p.base_price_cents)}</td>
                <td className="px-4 py-3"><ProductStatusToggle productId={p.id} status={p.status} /></td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/products/${p.id}/edit`} className="text-sm text-accent hover:underline">Editar</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
