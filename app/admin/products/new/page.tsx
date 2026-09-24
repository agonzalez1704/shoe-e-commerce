import { createClient } from "@/lib/supabase/server";
import { ProductEditor } from "@/components/admin/ProductEditor";

// Ruta bloqueante a proposito: dinamica de punta a punta (sesion/pago); un
// shell prerenderizado no aporta aqui.
export const instant = false;


export default async function NewProduct() {
  const supabase = await createClient();
  const { data: brands } = await supabase.from("brands").select("id, name").order("name");

  return <ProductEditor brands={brands ?? []} />;
}
