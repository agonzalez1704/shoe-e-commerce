# Crédito Blade — propuesta

Idea tomada del video de Redeemly (Shopify): en vez de descontar en esta venta,
regalar **crédito para la siguiente compra, con vencimiento**, y avisar antes de
que venza. El crédito se siente como dinero propio ("tienes $150"), el miedo a
perderlo empuja la recompra, y el margen solo se paga si el cliente regresa.

Estado: **fases 1 y 2 en producción** (2026-11-18): $150 fijos, 30 días, compartible. Arranca el 18 nov; sin lote retroactivo (decisión del dueño).

---

## 1. Mecánica

| Regla | Propuesta | Por qué |
|---|---|---|
| Cuándo se gana | Al **pagarse** un pedido (no al crearlo) | Un pedido OXXO/SPEI que vence no debe regalar nada |
| Cuánto | **$150 fijos** por pedido | Monto en pesos se lee como dinero; % se lee como cupón. Es ~11% de un par y ~7.5% de un combo |
| Vencimiento | **30 días** | Urgencia sin ser imposible para un zapato |
| Cómo se usa | Código `CREDITO-XXXXXX`, un uso, en el checkout | Reusa los códigos que ya existen |
| Se suma al combo y a promos | **Sí** (`suma_combo = true`) | Si "el mejor de los dos" se lo comiera, el crédito no valdría nada en un combo y el truco se rompe |
| Pedido mínimo | Ninguno | Todo el catálogo cuesta más de $1,000 |
| Lo que no genera crédito | Pedidos complementarios del combo (`combo_parent_order_id`), cancelados y reembolsados | Ya es un precio especial; y no se regala por dinero devuelto |
| Si el pedido se cancela o reembolsa | Se desactiva el código si no se ha usado | Igual que hoy con los cupones |

Alternativa si prefieres que escale con el ticket: 10% del total pagado,
redondeado a $50, con tope de $300. Más justo, menos claro en el mensaje.

## 2. Dónde lo ve el cliente

1. **Página de confirmación** (`app/pedido/[orderNumber]/page.tsx`, cuando
   `pagado`): recuadro tipo el del video — *"🎉 Ganaste $150 para tu próximo par ·
   CREDITO-7KQ2MX · vence el 16 de diciembre"* con botón copiar.
2. **Correo de pago** (`sendPaidEmail` en `lib/email.ts`): el mismo bloque. No
   hace falta un correo aparte.
3. **Mi cuenta → Cupones** (`app/cuenta/page.tsx`): ya lista códigos ligados a
   pedidos (`cupon_resena`); se agrega el de crédito con su estado
   Activo / Usado / Vencido.
4. **Aviso de vencimiento**: correo 5 días antes — *"Tus $150 vencen el viernes"*
   — con botón a la tienda. Opcional después: el mismo aviso por WhatsApp (Kapso
   ya está integrado).

## 3. Cómo encaja en lo que ya tenemos

Casi todo existe. **No hay que tocar `create_order`** (la función de precios, la
más delicada):

| Pieza | Hoy | Cambio |
|---|---|---|
| `discount_codes` | Soporta `fixed`, un uso, vencimiento, `suma_combo` (0069) | Nada |
| `lib/codigos.ts` → `crearCodigoUnico` | Solo crea códigos de porcentaje | Aceptar monto fijo |
| `orders` | Tiene `cupon_resena` | Columna nueva `credito_codigo` (+ `credito_recordado_at` para no avisar dos veces) |
| `lib/order-fulfillment.ts` → `markOrderPaid` | Bloque "efectos una sola vez" (correo, Meta, push) | Emitir el crédito ahí mismo, con el mismo candado |
| Cancelar/reembolsar en admin (`app/admin/actions.ts`) | Cambia status | Desactivar el código si no se ha usado |
| Crons (`vercel.json`) | 5 diarios/horarios | Uno nuevo `/api/cron/credito-por-vencer`, diario |
| `lib/email.ts` | Resend, plantillas `shell()`/`button()` | `sendCreditoPorVencerEmail` + bloque en `sendPaidEmail` |

**Migración:** solo agrega columnas (`orders.credito_codigo`,
`orders.credito_recordado_at`). No renombra nada, así que no rompe el código
desplegado. Se sube primero la migración y luego el código.

## 4. Lo que hay que decidir

1. **Monto y vigencia**: ¿$150 / 30 días, o el 10% con tope?
2. **¿Personal o compartible?** Hoy un código lo puede usar cualquiera. Si se
   comparte, funciona como referido (un amigo compra con tus $150), lo cual no
   está mal. Atarlo al correo del comprador requiere cambiar `create_order`;
   propongo **no hacerlo en la v1** y medir.
3. **Un solo código por pedido**: el checkout acepta un código. Si el cliente
   tiene crédito y cupón de reseña, usa uno. Aceptable para la v1.
4. **Compradores del Buen Fin (13–17 nov)**: emitirles el crédito de una vez,
   con vencimiento **~10 de diciembre** (ajustar a los días de fabricación para
   que llegue antes de Navidad). Es la forma más rápida de probarlo. Implica
   mandar un correo a esos clientes.

## 5. Plan

| Fase | Qué | Esfuerzo |
|---|---|---|
| 1 | Emitir al pagar + página de confirmación + correo de pago + Mi cuenta + desactivar al cancelar | ~1 día |
| 2 | Cron de aviso de vencimiento | ~medio día |
| 3 | Lote retroactivo Buen Fin (con tu OK del correo) | ~1 hora |
| 4 (si funciona) | Sugerir el crédito en el checkout cuando el correo coincide; aviso por WhatsApp; atar al correo | después |

## 6. Cómo sabremos si sirve

En el admin de descuentos, filtrar por prefijo `CREDITO-`:

- **Tasa de canje**: códigos usados ÷ emitidos.
- **Días a la recompra** de quienes lo usan vs. el histórico.
- **Costo real**: $150 × canjes, comparado con lo que se regaló en descuentos
  directos en el mismo periodo.

Revisar a los 30 días del primer lote: si casi nadie canjea, el monto es bajo o
el aviso no llega. Si canjea casi todo el mundo, estamos regalando margen a
gente que iba a volver de todos modos, y hay que bajar el monto.
