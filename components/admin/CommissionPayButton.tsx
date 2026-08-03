"use client";

import { useTransition } from "react";
import { markCommissionPaid, confirmCommissionPaid, resetCommission } from "@/app/admin/commission-actions";

const ACTIONS = {
  mark: markCommissionPaid,
  confirm: confirmCommissionPaid,
  reset: resetCommission,
} as const;

export function CommissionPayButton({
  orderIds,
  kind,
  label,
  className = "",
}: {
  orderIds: string[];
  kind: keyof typeof ACTIONS;
  label: string;
  className?: string;
}) {
  const [isPending, start] = useTransition();
  if (!orderIds.length) return null;
  return (
    <button
      disabled={isPending}
      onClick={() => start(() => ACTIONS[kind](orderIds))}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${className}`}
    >
      {isPending ? "…" : label}
    </button>
  );
}
