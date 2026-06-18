export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-accent-soft text-accent",
    paid: "bg-elevated text-text",
    fulfilled: "bg-elevated text-text",
    cancelled: "bg-elevated text-muted",
    refunded: "bg-elevated text-muted",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] ?? "bg-elevated text-muted"}`}>
      {status}
    </span>
  );
}
