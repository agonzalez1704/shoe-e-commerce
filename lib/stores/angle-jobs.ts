"use client";

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

// Global client state for async auto-toon jobs. Dumb by design (SRP): it only
// holds job state. The provider feeds it from Supabase Realtime; server actions
// start jobs and seed a row here. Any component can read status for a global UI.

export type AngleJobStatus = "processing" | "ready" | "failed";

export type AngleJob = {
  id: string;
  productId: string | null;
  productName: string | null;
  status: AngleJobStatus;
  resultUrls: string[];
  error: string | null;
};

// shape of the angle_jobs row as it arrives from Realtime / a select
export type AngleJobRow = {
  id: string;
  product_id: string | null;
  product_name: string | null;
  status: string;
  result_urls: string[] | null;
  error: string | null;
};

export const fromRow = (r: AngleJobRow): AngleJob => ({
  id: r.id,
  productId: r.product_id,
  productName: r.product_name,
  status: (["processing", "ready", "failed"].includes(r.status) ? r.status : "processing") as AngleJobStatus,
  resultUrls: r.result_urls ?? [],
  error: r.error,
});

type Store = {
  jobs: Record<string, AngleJob>;
  upsert: (job: AngleJob) => void;
  upsertFromRow: (row: AngleJobRow) => void;
  hydrate: (rows: AngleJobRow[]) => void;
  remove: (id: string) => void;
};

export const useAngleJobsStore = create<Store>((set) => ({
  jobs: {},
  upsert: (job) => set((s) => ({ jobs: { ...s.jobs, [job.id]: job } })),
  upsertFromRow: (row) => set((s) => ({ jobs: { ...s.jobs, [row.id]: fromRow(row) } })),
  hydrate: (rows) => set(() => ({ jobs: Object.fromEntries(rows.map((r) => [r.id, fromRow(r)])) })),
  remove: (id) =>
    set((s) => {
      const jobs = { ...s.jobs };
      delete jobs[id];
      return { jobs };
    }),
}));

// --- selectors ---
export const useAngleJobList = () =>
  useAngleJobsStore(useShallow((s) => Object.values(s.jobs)));

export const useAngleJob = (id?: string): AngleJob | undefined =>
  useAngleJobsStore((s) => (id ? s.jobs[id] : undefined));
