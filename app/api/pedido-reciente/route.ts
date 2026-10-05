import { NextResponse } from "next/server";
import { pedidoReciente } from "@/lib/pedido-reciente";

// La barra de estado y el ícono de cuenta lo piden desde el cliente: así el
// layout no lee cookies y las páginas siguen prerenderizándose.
export async function GET() {
  const pedido = await pedidoReciente().catch(() => null);
  return NextResponse.json({ pedido }, { headers: { "Cache-Control": "private, no-store" } });
}
