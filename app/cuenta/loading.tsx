import { EsqueletoEncabezado } from "@/components/Esqueletos";

export default function Loading() {
  return (
    <div className="py-12">
      <EsqueletoEncabezado />
      <div className="h-64 animate-pulse rounded-2xl bg-elevated" />
    </div>
  );
}
