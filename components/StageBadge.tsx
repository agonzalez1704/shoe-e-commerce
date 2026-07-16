import { STAGES } from "@/lib/fulfillment";

const COLOR: Record<string, string> = {
  pending: "bg-elevated text-muted",
  in_production: "bg-accent-soft text-accent",
  ready: "bg-elevated text-text",
  shipped: "bg-blue-500/15 text-blue-500",
  delivered: "bg-green-500/15 text-green-600 dark:text-green-400",
};

export function StageBadge({ stage }: { stage: string }) {
  const label = STAGES.find((s) => s.key === stage)?.short ?? stage;
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR[stage] ?? "bg-elevated text-muted"}`}>
      {label}
    </span>
  );
}
