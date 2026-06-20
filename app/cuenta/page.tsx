import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { customerSignOut } from "@/app/cuenta/actions";
import { AuthForms } from "@/components/AuthForms";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";

const mxn = (c: number) => formatCents(c, "MXN", "es-MX");

export default async function CuentaPage({ searchParams }: { searchParams: Promise<{ error?: string; msg?: string }> }) {
  const { error, msg } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="py-12">
        <h1 className="mb-8 text-center text-2xl font-semibold tracking-tight">Mi cuenta</h1>
        <AuthForms error={error} msg={msg} />
      </div>
    );
  }

  const [{ data: customer }, { data: orders }] = await Promise.all([
    supabase.from("customers").select("full_name, email").eq("id", user.id).maybeSingle(),
    supabase.from("orders").select("order_number, status, total_cents, created_at").eq("customer_id", user.id).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hola, {customer?.full_name ?? "bienvenido"}</h1>
          <p className="text-sm text-muted">{customer?.email ?? user.email}</p>
        </div>
        <form action={customerSignOut}>
          <button className="rounded-full border border-border px-4 py-2 text-sm text-muted transition-colors hover:text-text">Salir</button>
        </form>
      </div>

      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Mis pedidos</h2>
      {(orders ?? []).length === 0 ? (
        <p className="text-sm text-muted">Aún no tienes pedidos. <Link href="/products" className="text-accent underline">Ir a la tienda</Link></p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {(orders ?? []).map((o) => (
            <li key={o.order_number} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="nums font-medium">{o.order_number}</span>
              <StatusBadge status={o.status} />
              <span className="text-muted">{new Date(o.created_at).toLocaleDateString("es-MX")}</span>
              <span className="nums">{mxn(o.total_cents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
