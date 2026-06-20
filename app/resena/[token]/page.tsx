import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReviewForm } from "@/components/ReviewForm";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, status")
    .eq("review_token", token)
    .maybeSingle();
  if (!order) notFound();

  const { data: items } = await admin
    .from("order_items")
    .select("product_name, variants(product_id, products(name))")
    .eq("order_id", order.id);

  type Row = { product_name: string; variants: { product_id: string; products: { name: string } | null } | null };
  const rows = (items ?? []) as unknown as Row[];

  const seen = new Set<string>();
  const products: { id: string; name: string }[] = [];
  for (const r of rows) {
    const id = r.variants?.product_id;
    if (id && !seen.has(id)) {
      seen.add(id);
      products.push({ id, name: r.variants?.products?.name ?? r.product_name });
    }
  }

  const paid = order.status === "paid" || order.status === "fulfilled";

  return (
    <div className="mx-auto max-w-lg py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Reseña tu compra</h1>
      <p className="nums mt-1 text-sm text-muted">Pedido {order.order_number}</p>

      {!paid ? (
        <p className="mt-6 text-sm text-muted">Podrás dejar tu reseña cuando se confirme el pago de tu pedido.</p>
      ) : products.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No encontramos productos para reseñar.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {products.map((p) => (
            <ReviewForm key={p.id} token={token} productId={p.id} productName={p.name} />
          ))}
        </div>
      )}
    </div>
  );
}
