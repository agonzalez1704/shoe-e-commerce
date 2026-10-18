"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ligarPedidosDeInvitado } from "@/lib/cuenta";
import { pasoCampana } from "@/lib/reviews-shared";

export async function customerSignUp(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }, // handle_new_user copies this to customers
  });
  if (error) redirect(`/cuenta?error=${encodeURIComponent(error.message)}`);
  // confirmations off -> session returned (logged in); on -> must confirm via email
  if (!data.session) redirect(`/cuenta?msg=${encodeURIComponent("Revisa tu correo para confirmar tu cuenta.")}`);
  redirect("/cuenta");
}

export async function customerSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/cuenta?error=${encodeURIComponent(error.message)}`);
  redirect("/cuenta");
}

export async function customerSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/cuenta");
}

// Aviso del 10% al entrar: el pedido entregado más reciente al que le falta
// la reseña o la foto etiquetada. null si no hay sesión o nada pendiente.
export async function campanaResenaPendiente(): Promise<{ numero: string; token: string; paso: "resena" | "foto"; total: number } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  await ligarPedidosDeInvitado(user);
  const { data } = await supabase
    .from("orders")
    .select("order_number, review_token, cupon_resena, foto_estado, reviews(id)")
    .eq("customer_id", user.id)
    .not("delivered_at", "is", null)
    .in("status", ["paid", "fulfilled"])
    .order("delivered_at", { ascending: false });
  const pendientes = (data ?? []).flatMap((o) => {
    const paso = pasoCampana({ resenado: o.reviews.length > 0, foto_estado: o.foto_estado, cupon_resena: o.cupon_resena });
    return o.review_token && (paso === "resena" || paso === "foto") ? [{ numero: o.order_number, token: o.review_token, paso }] : [];
  });
  return pendientes[0] ? { ...pendientes[0], total: pendientes.length } : null;
}
