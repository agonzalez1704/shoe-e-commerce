"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/app/admin/actions";

type Status = "pending" | "paid" | "fulfilled" | "cancelled" | "refunded";

// allowed transitions per current status
const NEXT: Record<Status, Status[]> = {
  pending: ["cancelled"],
  paid: ["fulfilled", "refunded"],
  fulfilled: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function OrderStatusActions({ orderId, status }: { orderId: string; status: Status }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const options = NEXT[status] ?? [];

  if (options.length === 0) {
    return <p className="text-xs text-muted">Sin acciones disponibles.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((next) => (
        <button
          key={next}
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await updateOrderStatus(orderId, next);
              router.refresh();
            })
          }
          className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition-transform active:scale-[0.98] disabled:opacity-50 ${
            next === "cancelled" || next === "refunded"
              ? "border border-border text-muted hover:text-text"
              : "bg-accent text-accent-contrast"
          }`}
        >
          {next === "fulfilled" ? "Marcar enviado" : next === "refunded" ? "Reembolsado" : "Cancelar"}
        </button>
      ))}
    </div>
  );
}
