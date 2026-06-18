"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setProductStatus } from "@/app/admin/actions";

type Status = "draft" | "active" | "archived";

export function ProductStatusToggle({ productId, status }: { productId: string; status: Status }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) =>
        startTransition(async () => {
          await setProductStatus(productId, e.target.value as Status);
          router.refresh();
        })
      }
      className="rounded-lg border border-border bg-surface px-2 py-1 text-xs capitalize outline-none focus:border-text"
    >
      <option value="draft">draft</option>
      <option value="active">active</option>
      <option value="archived">archived</option>
    </select>
  );
}
