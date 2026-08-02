"use client";

import { useTransition } from "react";
import { setCommissionPaid } from "@/app/admin/commission-actions";

export function CommissionPayButton({
  orderIds,
  paid,
  label,
  className = "",
}: {
  orderIds: string[];
  paid: boolean; // target state to set
  label: string;
  className?: string;
}) {
  const [isPending, start] = useTransition();
  if (!orderIds.length) return null;
  return (
    <button
      disabled={isPending}
      onClick={() => start(() => setCommissionPaid(orderIds, paid))}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${className}`}
    >
      {isPending ? "…" : label}
    </button>
  );
}
