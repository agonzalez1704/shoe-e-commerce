import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Aviso de Privacidad",
  description: "Aviso de privacidad de calzadoblade.com conforme a la LFPDPPP.",
  alternates: { canonical: "/privacidad" },
};

// NOTE: plantilla base conforme a la Ley Federal de Protección de Datos
// Personales en Posesión de los Particulares. Valida con tu asesor legal.
export default function PrivacidadPage() {
  return (
    <LegalPage title="Aviso de Privacidad" updated="16 de julio de 2026">
      <p>
        <strong>[RAZÓN SOCIAL]</strong> (“Blade”), con domicilio en <strong>[DOMICILIO FISCAL]</strong>, es
        responsable del tratamiento y protección de tus datos personales conforme a la Ley Federal de Protección de
        Datos Personales en Posesión de los Particulares (LFPDPPP).
      </p>

      <h2>1. Datos que recabamos</h2>
      <ul>
        <li>Identificación y contacto: nombre, correo electrónico, teléfono.</li>
        <li>Dirección de envío y, en su caso, de facturación.</li>
        <li>Datos fiscales (RFC, régimen, uso de CFDI) cuando solicitas factura.</li>
        <li>Datos de la transacción. <strong>No almacenamos los datos completos de tu tarjeta</strong>: el pago lo procesa Conekta de forma segura.</li>
      </ul>

      <h2>2. Finalidades</h2>
      <p>Primarias (necesarias para el servicio):</p>
      <ul>
        <li>Procesar, fabricar, facturar y enviar tu pedido.</li>
        <li>Darte seguimiento, soporte y atención posventa.</li>
        <li>Cumplir obligaciones fiscales y legales.</li>
      </ul>
      <p>Secundarias (puedes oponerte sin afectar tu compra):</p>
      <ul>
        <li>Enviarte promociones, novedades y encuestas de satisfacción.</li>
      </ul>

      <h2>3. Transferencias</h2>
      <p>
        Compartimos datos únicamente con proveedores necesarios para operar: procesador de pagos (Conekta),
        paquetería para el envío, proveedor de facturación (PAC) y servicios de correo. No vendemos tus datos a
        terceros.
      </p>

      <h2>4. Derechos ARCO</h2>
      <p>
        Tienes derecho a <strong>Acceder, Rectificar, Cancelar u Oponerte</strong> al tratamiento de tus datos, así
        como a revocar tu consentimiento. Envía tu solicitud a{" "}
        <a href="mailto:privacidad@calzadoblade.com">privacidad@calzadoblade.com</a> indicando tu nombre y la
        solicitud concreta. Responderemos en los plazos que marca la ley.
      </p>

      <h2>5. Cookies</h2>
      <p>
        Usamos cookies y tecnologías similares para el funcionamiento del carrito, la sesión y métricas de uso.
        Puedes deshabilitarlas desde tu navegador, aunque algunas funciones podrían verse afectadas.
      </p>

      <h2>6. Cambios al aviso</h2>
      <p>
        Cualquier modificación se publicará en esta página. Te recomendamos revisarla periódicamente.
      </p>

      <h2>7. Contacto</h2>
      <p>
        Departamento de datos personales: <a href="mailto:privacidad@calzadoblade.com">privacidad@calzadoblade.com</a>.
      </p>
    </LegalPage>
  );
}
