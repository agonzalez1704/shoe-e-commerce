import { createClient } from "@/lib/supabase/server";

export type Review = {
  rating: number;
  body: string | null;
  fit_feedback: "runs_small" | "true_to_size" | "runs_large" | null;
  verified_purchase: boolean;
  created_at: string;
};

export type ReviewSummary = { count: number; average: number; items: Review[] };

export const FIT_LABEL: Record<string, string> = {
  runs_small: "Talla chica",
  true_to_size: "Talla correcta",
  runs_large: "Talla grande",
};

export async function getProductReviews(productId: string): Promise<ReviewSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("rating, body, fit_feedback, verified_purchase, created_at")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  const items = (data ?? []) as Review[];
  const count = items.length;
  const average = count ? items.reduce((s, r) => s + r.rating, 0) / count : 0;
  return { count, average, items };
}
