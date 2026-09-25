import { EsqueletoReja } from "@/components/Esqueletos";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl pt-4">
      <div className="mx-auto mb-4 h-10 w-48 animate-pulse rounded-lg bg-elevated" />
      <EsqueletoReja cards={8} />
    </div>
  );
}
