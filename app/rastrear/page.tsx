import type { Metadata } from "next";
import { TrackOrder } from "@/components/TrackOrder";

export const metadata: Metadata = {
  title: "Rastrear pedido",
  description: "Consulta el estado de tu pedido con tu número y correo.",
  alternates: { canonical: "/rastrear" },
};

export default async function RastrearPage({ searchParams }: { searchParams: Promise<{ o?: string }> }) {
  const { o } = await searchParams;
  return (
    <div className="py-12">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Rastrear pedido</h1>
      <p className="mb-8 text-sm text-muted">Ingresa tu número de pedido y el correo con el que compraste.</p>
      <TrackOrder defaultOrder={o ?? ""} />
    </div>
  );
}
