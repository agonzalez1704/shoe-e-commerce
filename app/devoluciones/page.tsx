import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { LegalPending, shippingConfigured } from "@/components/LegalGate";
import { activeBrand, whatsappDisplay } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Cambios y Garantía",
  description: `Política de cambios y garantía de ${activeBrand.name}: cambios por talla o defecto de fabricación.`,
  alternates: { canonical: "/devoluciones" },
};

// NOTE: los plazos y coberturas deben coincidir EXACTO con lo que ofreces en
// el sitio (PDP dice: sin devoluciones por gusto · primer cambio de talla sin
// costo · 30 días · garantía 6 meses).
// Ajusta si tus condiciones reales son distintas.
export default function DevolucionesPage() {
  // Misma razón que /envios: plazos, cambios y garantía son promesas de esta
  // tienda, y la nota de arriba exige que coincidan con la PDP. Si la PDP no
  // las declara (pdp.shipping vacío), esta página no puede declararlas sola.
  if (!shippingConfigured()) {
    return (
      <LegalPending
        page="Cambios y Garantía"
        heading="Falta configurar la política de devoluciones"
        body="Esta página fija plazos, cambios y garantía. La marca no los tiene definidos, así que no se publican los de otra tienda."
        field="pdp.shipping"
      />
    );
  }
  return (
    <LegalPage title="Cambios y Garantía">
      <p>
        Cada par se fabrica sobre pedido para ti, por eso <strong>no aceptamos devoluciones por gusto</strong> o
        cambio de opinión. Te pedimos revisar bien tu talla antes de comprar (consulta la guía de tallas en cada
        producto). Solo hacemos cambios en estos dos casos:
      </p>

      <h2>1. No te quedó la talla</h2>
      <ul>
        <li>Te cambiamos el par por otra talla del mismo modelo.</li>
        <li>El <strong>primer cambio de talla es sin costo</strong> de envío.</li>
        <li>Cuentas con <strong>30 días naturales</strong> a partir de la entrega para solicitarlo.</li>
        <li>El producto debe estar sin uso, en su empaque original y con evidencia de compra.</li>
      </ul>

      <h2>2. Defecto de fabricación</h2>
      <p>
        Tu calzado tiene una <strong>garantía de 6 meses</strong> contra defectos de fabricación (costuras, suela o
        materiales). Lo reparamos o lo reponemos sin costo para ti; si no es posible, te reembolsamos. No cubre
        desgaste normal por uso, mal uso ni daños por accidentes.
      </p>
      <p>
        Si recibiste un producto defectuoso o distinto al que pediste, contáctanos dentro de los 5 días posteriores
        a la entrega y lo resolvemos sin costo para ti.
      </p>

      <h2>No aplica</h2>
      <ul>
        <li>Devoluciones o reembolsos porque el modelo o el color no te gustó, o porque cambiaste de opinión.</li>
        <li>Pares usados, sin su empaque original o fuera de los plazos de arriba.</li>
      </ul>

      <h2>Cómo iniciar</h2>
      <p>
        Escríbenos a <a href={`mailto:${activeBrand.legal.supportEmail}`}>{activeBrand.legal.supportEmail}</a>
        {whatsappDisplay(activeBrand.legal.whatsapp) && (
          <> o por WhatsApp <strong>{whatsappDisplay(activeBrand.legal.whatsapp)}</strong></>
        )}{" "}
        con tu número de pedido. Te guiamos en el proceso y te compartimos la guía de
        retorno cuando aplique.
      </p>

      <p className="text-xs">
        Esta política respeta los derechos que la Ley Federal de Protección al Consumidor otorga a los consumidores.
      </p>
    </LegalPage>
  );
}
