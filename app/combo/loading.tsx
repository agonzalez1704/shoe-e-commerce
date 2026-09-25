import { EsqueletoEncabezado } from "@/components/Esqueletos";

export default function Loading() {
  return (
    <div className="mx-auto max-w-md py-8">
      <EsqueletoEncabezado />
      <div className="space-y-2.5">
        {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-elevated" />)}
      </div>
      <div className="mt-5 h-14 animate-pulse rounded-full bg-elevated" />
    </div>
  );
}
