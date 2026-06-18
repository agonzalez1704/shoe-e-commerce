"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  // brute-force guard: 5 attempts / 5 min / IP
  const ip = await clientIp();
  if (!(await rateLimit("login", ip, 5, 300))) {
    redirect(`/login?error=${encodeURIComponent("Demasiados intentos. Intenta en unos minutos.")}`);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
