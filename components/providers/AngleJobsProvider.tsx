"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAngleJobsStore, type AngleJobRow } from "@/lib/stores/angle-jobs";
import { reconcileJob } from "@/app/admin/angle-actions";

// Wires Supabase Realtime -> the angle-jobs store. Mounted once in the admin
// layout: seeds recent jobs on mount (so state survives reloads/navigation) and
// keeps them live via postgres_changes. RLS scopes this to admins only.
export function AngleJobsProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAngleJobsStore((s) => s.hydrate);
  const upsertFromRow = useAngleJobsStore((s) => s.upsertFromRow);
  const remove = useAngleJobsStore((s) => s.remove);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      // postgres_changes is RLS-filtered: the Realtime socket must carry the
      // admin's JWT or is_admin() denies every row and no events arrive. This
      // is why completions only showed after a manual refresh.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      if (!active) return;

      // only in-flight jobs seed the UI; finished ones are transient toasts
      const { data } = await supabase
        .from("angle_jobs")
        .select("id, product_id, product_name, status, result_urls, error")
        .eq("status", "processing")
        .order("created_at", { ascending: false })
        .limit(20);
      if (active && data) hydrate(data as AngleJobRow[]);

      channel = supabase
        .channel("angle_jobs")
        .on("postgres_changes", { event: "*", schema: "public", table: "angle_jobs" }, (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: string };
            if (old?.id) remove(old.id);
            return;
          }
          const row = payload.new as AngleJobRow;
          if (row?.id) upsertFromRow(row);
        })
        .subscribe();
    })();

    // Reliable backstop: Realtime can be blocked by project config / RLS on the
    // socket, so while any job is in flight we poll our own table every 5s. The
    // webhook is still the server-side source of truth; this just reflects it.
    const poll = setInterval(async () => {
      const ids = Object.values(useAngleJobsStore.getState().jobs)
        .filter((j) => j.status === "processing")
        .map((j) => j.id);
      if (!ids.length) return;
      const { data } = await supabase
        .from("angle_jobs")
        .select("id, product_id, product_name, status, result_urls, error")
        .in("id", ids);
      if (active && data) (data as AngleJobRow[]).forEach(upsertFromRow);
    }, 5000);

    // Reliability net: the webhook is fire-and-forget with no retry, so every
    // 15s ask the server to reconcile any in-flight job against auto-toon and
    // finalize it if the set is ready/failed. Makes completion webhook-optional.
    const reconcile = setInterval(() => {
      Object.values(useAngleJobsStore.getState().jobs)
        .filter((j) => j.status === "processing")
        .forEach((j) => void reconcileJob(j.id));
    }, 15000);

    return () => {
      active = false;
      clearInterval(poll);
      clearInterval(reconcile);
      if (channel) supabase.removeChannel(channel);
    };
  }, [hydrate, upsertFromRow, remove]);

  return <>{children}</>;
}
