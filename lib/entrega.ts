// Fecha de llegada para mostrar junto al botón de compra ("Llega entre el 1 y
// el 4 de dic"). Sale de los mismos días que se declaran a Google en el JSON-LD
// (merchant.handlingDays + transitDays), así que la ficha y el buscador
// prometen lo mismo. Cuenta días hábiles: sábado y domingo no se fabrica ni se
// reparte. No conoce días festivos; el rango ya trae holgura.

function sumarHabiles(desde: Date, dias: number): Date {
  const d = new Date(desde);
  let faltan = dias;
  while (faltan > 0) {
    d.setDate(d.getDate() + 1);
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) faltan--;
  }
  return d;
}

export function rangoEntrega(
  m: { handlingDays: [number, number]; transitDays: [number, number] },
  hoy: Date = new Date(),
): string {
  const min = sumarHabiles(hoy, m.handlingDays[0] + m.transitDays[0]);
  const max = sumarHabiles(hoy, m.handlingDays[1] + m.transitDays[1]);
  const dia = (d: Date) => d.toLocaleDateString("es-MX", { day: "numeric", timeZone: "America/Mexico_City" });
  const mes = (d: Date) => d.toLocaleDateString("es-MX", { month: "short", timeZone: "America/Mexico_City" }).replace(".", "");
  return mes(min) === mes(max)
    ? `Llega entre el ${dia(min)} y el ${dia(max)} de ${mes(max)}`
    : `Llega entre el ${dia(min)} de ${mes(min)} y el ${dia(max)} de ${mes(max)}`;
}
