"use server";

import { requireAdmin } from "@/lib/admin-guard";
import { notifyAdmins } from "@/lib/push";

export type SubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

// One row per device. Re-subscribing on the same browser reuses the endpoint,
// so upsert keeps it to a single row.
export async function savePushSubscription(sub: SubscriptionInput) {
  const supabase = await requireAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión no válida.");

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: sub.endpoint,
      user_id: user.id,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: sub.userAgent ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}

export async function deletePushSubscription(endpoint: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw new Error(error.message);
}

// Lets you confirm the whole chain works from the phone itself.
export async function sendTestNotification() {
  await requireAdmin();
  await notifyAdmins({
    title: "Prueba de notificaciones",
    body: "Si ves esto, las alertas de pedidos están funcionando.",
    url: "/admin/orders",
    tag: "test",
  });
}
