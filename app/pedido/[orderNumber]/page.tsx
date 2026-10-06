import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle, Clock } from "@phosphor-icons/react/dist/ssr";
import { Estado } from "@/components/TrackOrder";
import { ordenPorToken } from "@/app/rastrear/actions";
import { leePedidoReciente } from "@/lib/pedido-reciente";
import { PagoComplemento } from "@/components/PagoComplemento";
import { pagarPedido, cancelarPedido } from "./combo/cobro";

export const instant = false; // dinámica de punta a punta (pedido por token)

export const metadata: Metadata = { title: "Tu pedido", robots: { index: false, follow: false } };

// La casa del pedido: aquí cae el comprador al pagar, desde la barra de estado
// y desde los correos. Se abre con el token del pedido (?t=) o, sin él, con la
// cookie del pedido reciente de este navegador. Solo el número no basta: es
// consecutivo y se adivina.
export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ t?: string; nuevo?: string }>;
}) {
  const numero = decodeURIComponent((await params).orderNumber).toUpperCase();
  const { t, nuevo } = await searchParams;
  const reciente = await leePedidoReciente();
  const token = t ?? (reciente?.numero === numero ? reciente.token : null);
  const orden = token ? await ordenPorToken(numero, token) : null;
  if (!orden) redirect(`/rastrear?o=${encodeURIComponent(numero)}`);

  const pagado = orden.status === "paid" || orden.status === "fulfilled";
  // Pago fallido o abandonado: aqui mismo puede pagar con otro metodo o cancelar.
  const pendiente = orden.status === "pending";
  const recienComprado = nuevo === "1" && orden.status !== "cancelled";

  return (
    <div className="mx-auto max-w-2xl py-8 sm:py-12">
      {recienComprado && (
        <div className="mb-6 flex flex-col items-center text-center">
          <span className={`grid h-14 w-14 place-items-center rounded-full ${pagado ? "bg-[#1f3a2a] text-[#5fd08a]" : "bg-[#2a2412] text-[#e8b84a]"}`}>
            {pagado ? <CheckCircle size={32} weight="fill" /> : <Clock size={30} weight="fill" />}
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {pagado ? "¡Pago confirmado!" : "Recibimos tu pedido"}
          </h1>
          <p className="mt-1.5 max-w-sm text-sm text-muted">
            {pagado
              ? "Gracias. Ya empezamos a hacer tus pares. Te mandamos esta página a tu correo, y arriba de la tienda siempre verás cómo va."
              : "En cuanto se confirme tu pago te avisamos por correo. Arriba de la tienda siempre verás cómo va."}
          </p>
          <span className="nums mt-3 rounded-full border border-border px-4 py-1.5 text-sm font-semibold tracking-wide">
            Pedido {orden.orderNumber}
          </span>
        </div>
      )}
      {!recienComprado && (
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">{pendiente ? "Completa tu pago" : "Tu pedido"}</h1>
      )}
      {/* Recien regresado del proveedor el pago puede estar confirmandose
          (webhook en camino): plegado para no invitar a pagar dos veces. */}
      {pendiente && token && (
        <details open={!recienComprado} className="mb-8 [&_summary]:cursor-pointer">
          <summary className="text-sm font-medium text-accent">¿No pasó tu pago? Paga con otro método</summary>
          <p className="mt-2 text-sm text-muted">
            Intenta con otra tarjeta o con otro método. Si prefieres no seguir, cancela el pedido y tus pares vuelven
            al carrito.
          </p>
          <PagoComplemento
            cobrar={pagarPedido.bind(null, numero, token)}
            cambiar={cancelarPedido.bind(null, numero, token)}
            cambiarTexto="Cancelar pedido"
            childOrderNumber={numero}
            mpHref={`/pedido/${numero}/pagar?t=${token}`}
            totalCents={orden.totalCents}
            elegido={null}
            conektaPublicKey={process.env.NEXT_PUBLIC_CONEKTA_PUBLIC_KEY ?? ""}
            mpEnabled={!!process.env.MERCADOPAGO_ACCESS_TOKEN}
            fichaGenerada={false}
          />
        </details>
      )}
      <Estado orden={orden} />
      <p className="mt-8 text-center">
        <Link href="/products" className="text-sm font-medium text-accent">Seguir viendo la tienda</Link>
      </p>
    </div>
  );
}
