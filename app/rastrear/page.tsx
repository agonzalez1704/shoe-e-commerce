import type { Metadata } from "next";
import { TrackOrder } from "@/components/TrackOrder";
import { ordenPorToken } from "./actions";

export const instant = false; // dinámica de punta a punta (sesión/pedido)

export const metadata: Metadata = {
  title: "Rastrear pedido",
  description: "Consulta el estado de tu pedido con tu número y correo.",
  alternates: { canonical: "/rastrear" },
};

// Con ?o=…&t=… (el link de los correos) el pedido se abre directo; sin token,
// el formulario de número + correo de siempre.
export default async function RastrearPage({ searchParams }: { searchParams: Promise<{ o?: string; t?: string }> }) {
  const { o, t } = await searchParams;
  const inicial = o && t ? await ordenPorToken(o, t) : null;

  return (
    <div className="py-12">
      {inicial ? (
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Tu pedido</h1>
      ) : (
        <>
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">Rastrear pedido</h1>
          <p className="mb-8 text-sm text-muted">Ingresa tu número de pedido y el correo con el que compraste.</p>
        </>
      )}
      <TrackOrder defaultOrder={o ?? ""} inicial={inicial} />
    </div>
  );
}
