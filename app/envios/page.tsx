import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Política de Envíos",
  description: "Tiempos, cobertura y seguimiento de los envíos de Blade en México.",
  alternates: { canonical: "/envios" },
};

export default function EnviosPage() {
  return (
    <LegalPage title="Política de Envíos" updated="16 de julio de 2026">
      <h2>Cobertura y costo</h2>
      <ul>
        <li><strong>Envío gratis</strong> a todo México en todos los pedidos.</li>
        <li>Realizamos envíos a domicilio en todo el territorio nacional.</li>
      </ul>

      <h2>Tiempos de entrega</h2>
      <p>
        Como cada par se <strong>fabrica sobre pedido</strong>, el tiempo total estimado es de{" "}
        <strong>4 a 7 días hábiles</strong> a partir de que se confirma tu pago. Este tiempo incluye la fabricación
        y el envío. Los días hábiles no consideran fines de semana ni días festivos.
      </p>

      <h2>Seguimiento</h2>
      <p>
        Cuando tu pedido sale a reparto te enviamos un correo con la paquetería y el número de guía. También puedes
        consultar el estado en cualquier momento en <a href="/rastrear">Rastrear pedido</a> con tu número de pedido
        y correo.
      </p>

      <h2>Datos de entrega</h2>
      <p>
        Asegúrate de capturar correctamente tu dirección. No nos hacemos responsables por retrasos causados por
        datos incompletos o incorrectos. Si la paquetería no logra entregar tras varios intentos, el paquete puede
        regresar a nuestro almacén; te contactaremos para reprogramar.
      </p>

      <h2>Incidencias</h2>
      <p>
        Ante cualquier problema con tu envío (retraso, daño o extravío), escríbenos a{" "}
        <a href="mailto:pedidos@calzadoblade.com">pedidos@calzadoblade.com</a> con tu número de pedido y lo
        resolvemos.
      </p>
    </LegalPage>
  );
}
