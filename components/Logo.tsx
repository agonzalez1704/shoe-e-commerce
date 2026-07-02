import Image from "next/image";
import { activeBrand } from "@/lib/brand";

// Brand logo: image if provided; otherwise an optional accent mark + wordmark
// (with the accent character highlighted). Driven entirely by lib/brand.ts.
export function Logo() {
  const b = activeBrand;

  if (b.logo) {
    return (
      <Image
        src={b.logo.src}
        alt={b.logo.alt ?? b.name}
        width={b.logo.width}
        height={b.logo.height}
        priority
        className={b.logo.invertOnLight ? "brand-logo-invert" : undefined}
      />
    );
  }

  let wordmark: React.ReactNode = b.name;
  if (b.accentWord && b.name.includes(b.accentWord)) {
    const [before, after] = b.name.split(b.accentWord);
    wordmark = (
      <>
        {before}
        <span className="text-accent">{b.accentWord}</span>
        {after}
      </>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-text">
      {b.markSrc && (
        <Image src={b.markSrc.src} alt="" aria-hidden width={b.markSrc.width} height={b.markSrc.height} priority />
      )}
      {b.mark && <span className="inline-flex" aria-hidden dangerouslySetInnerHTML={{ __html: b.mark }} />}
      {wordmark}
    </span>
  );
}
