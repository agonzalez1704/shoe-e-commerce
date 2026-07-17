import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description: "Términos y condiciones de compra en calzadoblade.com.",
  alternates: { canonical: "/terminos" },
};

// NOTE: plantilla base. Reemplaza los [CAMPOS] con los datos reales y valida
// el contenido con tu asesor legal antes de operar con clientes reales.
export default function TerminosPage() {
  return (
    <LegalPage title="Términos y Condiciones" updated="16 de julio de 2026">
      <p>
        Estos Términos y Condiciones regulan el uso del sitio calzadoblade.com (el “Sitio”) y la compra de
        productos de la marca Blade, operada por <strong>[RAZÓN SOCIAL]</strong>, con RFC{" "}
        <strong>[RFC]</strong> y domicilio en <strong>[DOMICILIO FISCAL]</strong> (“nosotros”). Al realizar una
        compra aceptas estos términos en su totalidad.
      </p>

      <h2>1. Productos hechos sobre pedido</h2>
      <p>
        Nuestro calzado se fabrica de forma artesanal <strong>una vez que confirmas tu compra</strong>. El tiempo
        estimado de entrega es de <strong>4 a 7 días hábiles</strong> a partir de la confirmación del pago. Por
        tratarse de producción bajo demanda, las cancelaciones aplican según la sección de Devoluciones.
      </p>

      <h2>2. Precios y pagos</h2>
      <ul>
        <li>Todos los precios están en pesos mexicanos (MXN) e incluyen IVA.</li>
        <li>Aceptamos tarjeta de crédito/débito, OXXO, transferencia SPEI y Aplazo, procesados por Conekta.</li>
        <li>El pedido se confirma únicamente cuando el pago se acredita. Los pagos en efectivo (OXXO) y SPEI tienen una fecha límite; si vencen, el pedido se cancela automáticamente.</li>
      </ul>

      <h2>3. Combos y promociones</h2>
      <p>
        Las promociones tipo combo (por ejemplo “2 pares por un precio especial”) aplican únicamente bajo las
        condiciones mostradas en el producto y en el carrito, y no son acumulables con otras promociones salvo que
        se indique lo contrario.
      </p>

      <h2>4. Envíos</h2>
      <p>
        Realizamos envíos a todo México. Los detalles de tiempos, cobertura y seguimiento se describen en nuestra{" "}
        <a href="/envios">Política de Envíos</a>.
      </p>

      <h2>5. Devoluciones y cambios</h2>
      <p>
        Las condiciones de cambio, devolución y garantía se detallan en la{" "}
        <a href="/devoluciones">Política de Devoluciones y Cambios</a>.
      </p>

      <h2>6. Facturación (CFDI)</h2>
      <p>
        Si requieres factura, puedes solicitarla durante el proceso de compra proporcionando tus datos fiscales.
        La factura se emite conforme a la normatividad del SAT.
      </p>

      <h2>7. Propiedad intelectual</h2>
      <p>
        Todo el contenido del Sitio (marca, logotipos, imágenes, textos y diseño) es propiedad de{" "}
        <strong>[RAZÓN SOCIAL]</strong> y no puede reproducirse sin autorización.
      </p>

      <h2>8. Responsabilidad</h2>
      <p>
        Nos esforzamos por mostrar los productos con la mayor fidelidad posible; pueden existir variaciones menores
        de color por tratarse de piel genuina y por la configuración de cada pantalla.
      </p>

      <h2>9. Modificaciones</h2>
      <p>
        Podemos actualizar estos términos en cualquier momento. La versión vigente es la publicada en esta página.
      </p>

      <h2>10. Ley aplicable</h2>
      <p>
        Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Para cualquier controversia, las
        partes se someten a los tribunales competentes de <strong>[CIUDAD, ESTADO]</strong>, sin perjuicio de los
        derechos que la Procuraduría Federal del Consumidor (PROFECO) reconoce a los consumidores.
      </p>

      <h2>11. Contacto</h2>
      <p>
        Dudas o aclaraciones: <a href="mailto:pedidos@calzadoblade.com">pedidos@calzadoblade.com</a>{" "}
        · WhatsApp <strong>[TELÉFONO]</strong>.
      </p>
    </LegalPage>
  );
}
