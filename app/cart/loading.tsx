import { EsqueletoEncabezado } from "@/components/Esqueletos";

export default function Loading() {
  return (
    <div className="py-8">
      <EsqueletoEncabezado />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-elevated" />
        ))}
      </div>
    </div>
  );
}
