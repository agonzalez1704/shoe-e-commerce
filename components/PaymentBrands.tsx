// Simplified, brand-colored payment indicators (not exact logo artwork) — the
// standard "accepted payments" cue on a checkout.

export function OxxoMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-6 items-center rounded bg-[#E4002B] px-1.5 text-[11px] font-extrabold italic tracking-tight text-white ${className}`}>
      OXXO
    </span>
  );
}

export function SpeiMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-6 items-center rounded bg-[#12326b] px-1.5 text-[11px] font-bold tracking-wide text-white ${className}`}>
      SPEI
    </span>
  );
}

export function AplazoMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-6 items-center rounded bg-[#1b1b1b] px-1.5 text-[11px] font-bold lowercase text-[#c8f560] ${className}`}>
      aplazo
    </span>
  );
}

export function VisaMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-6 items-center rounded bg-white px-1.5 text-[12px] font-bold italic tracking-tight text-[#1a1f71] ring-1 ring-black/10 ${className}`}>
      VISA
    </span>
  );
}

// two overlapping circles — the universal card-network cue
export function MastercardMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 24" className={`h-6 w-auto rounded bg-white p-0.5 ring-1 ring-black/10 ${className}`} aria-label="Mastercard">
      <circle cx="14" cy="12" r="7" fill="#EB001B" />
      <circle cx="22" cy="12" r="7" fill="#F79E1B" fillOpacity="0.9" />
    </svg>
  );
}

export function AmexMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex h-6 items-center rounded bg-[#2e77bb] px-1.5 text-[10px] font-bold text-white ${className}`}>
      AMEX
    </span>
  );
}
