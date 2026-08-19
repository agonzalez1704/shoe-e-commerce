import { EsqueletoEncabezado } from "@/components/Esqueletos";

export default function Loading() {
  return (
    <div className="py-8">
      <EsqueletoEncabezado />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-2xl bg-elevated" />
        ))}
      </div>
    </div>
  );
}
