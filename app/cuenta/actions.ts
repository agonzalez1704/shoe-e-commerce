"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
