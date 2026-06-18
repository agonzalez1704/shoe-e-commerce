import Image from "next/image";
import { activeBrand } from "@/lib/brand";

// Brand logo: image if the active brand provides one, otherwise a wordmark with
// the accent character highlighted. Swap by setting NEXT_PUBLIC_BRAND.
export function Logo() {
  const b = activeBrand;

  if (b.logo) {
    return <Image src={b.logo.src} alt={b.logo.alt ?? b.name} width={b.logo.width} height={b.logo.height} priority />;
  }

  if (b.accentWord && b.name.includes(b.accentWord)) {
    const [before, after] = b.name.split(b.accentWord);
    return (
      <span className="text-lg font-semibold tracking-tight">
        {before}
        <span className="text-accent">{b.accentWord}</span>
        {after}
      </span>
    );
  }

  return <span className="text-lg font-semibold tracking-tight">{b.name}</span>;
}
