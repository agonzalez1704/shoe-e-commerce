import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "@/components/ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProduct() {
  const supabase = await createClient();
  const { data: brands } = await supabase.from("brands").select("id, name").order("name");

  return (
    <div className="space-y-6">
      <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <CaretLeft size={14} /> Productos
      </Link>
      <h1 className="text-xl font-semibold tracking-tight">Nuevo producto</h1>
      <ProductForm brands={brands ?? []} />
    </div>
  );
}
