"use server";

import { redirect } from "next/navigation";
import { addToCart } from "@/app/cart/actions";

// Cierra el wizard: mete los dos pares al carrito y manda a pagar (o a seguir
// viendo). El precio del combo lo calcula el carrito/create_order, no aqui.
export async function agregarCombo(
  variantIds: [string, string],
  destino: "checkout" | "cart" = "checkout",
): Promise<{ ok: false; error: string } | never> {
  try {
    for (const id of variantIds) await addToCart(id, 1);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo agregar el combo" };
  }
  redirect(destino === "checkout" ? "/checkout" : "/cart");
}
