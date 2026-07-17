import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Devoluciones y Cambios",
  description: "Política de devoluciones, cambios y garantía de Blade.",
  alternates: { canonical: "/devoluciones" },
};

// NOTE: los plazos y coberturas deben coincidir EXACTO con lo que ofreces en
// el sitio (PDP dice: primer cambio sin costo · 30 días · garantía 6 meses).
// Ajusta si tus condiciones reales son distintas.
export default function DevolucionesPage() {
  return (
    <LegalPage title="Devoluciones y Cambios" updated="16 de julio de 2026">
      <p>
        Queremos que ames tu par. Como cada Blade se <strong>fabrica sobre pedido</strong>, te pedimos revisar bien
        tu talla antes de comprar (consulta la guía de tallas en cada producto). Aun así, te damos estas opciones:
      </p>

      <h2>Cambios de talla</h2>
      <ul>
        <li>El <strong>primer cambio de talla es sin costo</strong> de envío.</li>
        <li>Cuentas con <strong>30 días naturales</strong> a partir de la entrega para solicitarlo.</li>
        <li>El producto debe estar sin uso, en su empaque original y con evidencia de compra.</li>
      </ul>

      <h2>Devoluciones</h2>
      <ul>
        <li>Aceptamos devoluciones dentro de los <strong>30 días naturales</strong> posteriores a la entrega, siempre que el producto esté sin uso y en su empaque original.</li>
        <li>El reembolso se realiza al mismo método de pago, una vez que recibimos y validamos el producto.</li>
        <li>Por tratarse de producto hecho sobre pedido, los productos personalizados o en promoción especial pueden estar sujetos a condiciones distintas, que se indicarán al momento de la compra.</li>
      </ul>

      <h2>Garantía</h2>
      <p>
        Tu calzado tiene una <strong>garantía de 6 meses</strong> contra defectos de fabricación (costuras, suela o
        materiales). No cubre desgaste normal por uso, mal uso ni daños por accidentes.
      </p>

      <h2>Producto con defecto o error en el envío</h2>
      <p>
        Si recibiste un producto defectuoso o distinto al que pediste, contáctanos dentro de los 5 días posteriores
        a la entrega y lo resolvemos sin costo para ti (cambio, reposición o reembolso).
      </p>

      <h2>Cómo iniciar</h2>
      <p>
        Escríbenos a <a href="mailto:pedidos@calzadoblade.com">pedidos@calzadoblade.com</a> o por WhatsApp{" "}
        <strong>[TELÉFONO]</strong> con tu número de pedido. Te guiamos en el proceso y te compartimos la guía de
        retorno cuando aplique.
      </p>

      <p className="text-xs">
        Esta política respeta los derechos que la Ley Federal de Protección al Consumidor otorga a los consumidores.
      </p>
    </LegalPage>
  );
}
