"use client";

import { useState } from "react";

export function CopiarCodigo({ code }: { code: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(code).then(() => {
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1800);
        });
      }}
      className="h-10 shrink-0 rounded-full border border-border px-4 text-sm transition-colors hover:bg-surface"
    >
      <span aria-live="polite">{copiado ? "Copiado ✓" : "Copiar"}</span>
    </button>
  );
}
