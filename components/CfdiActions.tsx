"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { stampInvoice } from "@/app/admin/actions";

type Doc = {
  status: "pending" | "stamped" | "failed" | "cancelled";
  uuid_fiscal: string | null;
  xml_url: string | null;
  pdf_url: string | null;
  pac_error: string | null;
} | null;

export function CfdiActions({ orderId, doc }: { orderId: string; doc: Doc }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(doc?.status === "failed" ? doc.pac_error : null);
  const router = useRouter();

  function stamp() {
    setError(null);
    startTransition(async () => {
      const res = await stampInvoice(orderId);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  }

  if (doc?.status === "stamped" && doc.uuid_fiscal) {
    return (
      <div className="space-y-1 text-muted">
        <p className="nums text-xs">UUID: {doc.uuid_fiscal}</p>
        <div className="flex gap-3 text-xs">
          {doc.pdf_url && <a href={doc.pdf_url} target="_blank" rel="noreferrer" className="text-accent underline">PDF</a>}
          {doc.xml_url && <a href={doc.xml_url} target="_blank" rel="noreferrer" className="text-accent underline">XML</a>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={stamp}
        disabled={isPending}
        className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-accent-contrast disabled:opacity-50"
      >
        {isPending ? "Timbrando…" : doc?.status === "failed" ? "Reintentar timbrado" : "Generar factura"}
      </button>
      {error && <p className="text-xs text-accent">{error}</p>}
    </div>
  );
}
