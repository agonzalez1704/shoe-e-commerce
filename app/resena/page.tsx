import type { Metadata } from "next";
import { ResenaAcceso } from "@/components/ResenaAcceso";

export const metadata: Metadata = {
  title: "Deja tu reseña",
  description: "Reseña tu compra con tu número de pedido.",
  robots: { index: false },
};

export default function ResenaPage() {
  return (
    <div className="mx-auto max-w-lg py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Deja tu reseña</h1>
      <p className="mb-8 mt-1 text-sm text-muted">
        Ingresa tu número de pedido y el correo con el que compraste. Solo pedidos ya entregados pueden reseñarse.
      </p>
      <ResenaAcceso />
    </div>
  );
}
