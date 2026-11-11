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
  // 44px tall on phones so a thumb hits it; compact on desktop
  return (
    <button
      disabled={isPending}
      onClick={() => start(() => ACTIONS[kind](orderIds))}
      className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-50 sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-xs ${className}`}
    >
      {isPending ? "…" : label}
    </button>
  );
}
