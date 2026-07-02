"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAngleJobsStore, type AngleJobRow } from "@/lib/stores/angle-jobs";

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

    (async () => {
      // only in-flight jobs seed the UI; finished ones are transient toasts
      // surfaced live via Realtime, not resurrected on every load
      const { data } = await supabase
        .from("angle_jobs")
        .select("id, product_id, product_name, status, result_urls, error")
        .eq("status", "processing")
        .order("created_at", { ascending: false })
        .limit(20);
      if (active && data) hydrate(data as AngleJobRow[]);
    })();

    const channel = supabase
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

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [hydrate, upsertFromRow, remove]);

  return <>{children}</>;
}
