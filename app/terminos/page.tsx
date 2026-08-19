import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { activeBrand, whatsappDisplay } from "@/lib/brand";
import { legalConfigured, LegalPending } from "@/components/LegalGate";

const L = activeBrand.legal;

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description: `Términos y condiciones de compra en ${activeBrand.domain}.`,
  alternates: { canonical: "/terminos" },
};

// NOTE: valida el contenido con tu asesor legal antes de operar en vivo.
export default function TerminosPage() {
  if (!legalConfigured()) return <LegalPending page="Términos y condiciones" />;
  return (
    <LegalPage title="Términos y Condiciones" updated="16 de julio de 2026">
      <p>
        Estos Términos y Condiciones regulan el uso del sitio {activeBrand.domain} (el “Sitio”) y la compra de
        productos de la marca {activeBrand.name}, operada por <strong>{L.operator}</strong>, con RFC{" "}
        <strong>{L.rfc}</strong> y domicilio en <strong>{L.address}</strong> (“nosotros”). Al realizar una
        compra aceptas estos términos en su totalidad.
      </p>

      <h2>1. Productos y tiempos de entrega</h2>
      <p>
        Nuestro calzado es de piel y se elabora de forma artesanal. El tiempo estimado de entrega es de{" "}
        <strong>4 a 7 días hábiles</strong> a partir de la confirmación del pago. Las cancelaciones aplican
        según la sección de Devoluciones.
      </p>

      <h2>2. Precios y pagos</h2>
      <ul>
        <li>Todos los precios están en pesos mexicanos (MXN) e incluyen IVA.</li>
        <li>Aceptamos tarjeta de crédito/débito, pago en efectivo en tiendas (7-Eleven, Walmart, Bodega Aurrerá, Circle K, Sam's Club, Farmacias del Ahorro, Soriana y más) y Aplazo, procesados por Conekta.</li>
        <li>El pedido se confirma únicamente cuando el pago se acredita. Los pagos en efectivo tienen una fecha límite; si vencen, el pedido se cancela automáticamente.</li>
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
        <strong>{L.operator}</strong> y no puede reproducirse sin autorización.
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
        partes se someten a los tribunales competentes de <strong>León, Guanajuato</strong>, sin perjuicio de los
        derechos que la Procuraduría Federal del Consumidor (PROFECO) reconoce a los consumidores.
      </p>

      <h2>11. Contacto</h2>
      <p>
        Dudas o aclaraciones: <a href={`mailto:${L.supportEmail}`}>{L.supportEmail}</a>
        {whatsappDisplay(L.whatsapp) && <> · WhatsApp <strong>{whatsappDisplay(L.whatsapp)}</strong></>}.
      </p>
    </LegalPage>
  );
}
