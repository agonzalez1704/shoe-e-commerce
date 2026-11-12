// Meses sin intereses con tarjeta (Conekta) para el Buen Fin 2026. La comisión
// de MSI la paga la tienda, así que solo corren durante la campaña:
// 13-nov 00:00 a 18-nov 00:00 CDMX. Para moverla, cambia MSI_DESDE / MSI_HASTA.
export const MSI_PLAZOS = [3, 6];
export const MSI_DESDE = Date.parse("2026-11-13T00:00:00-06:00");
export const MSI_HASTA = Date.parse("2026-11-18T00:00:00-06:00");
export const msiVigente = (now = Date.now()) => now >= MSI_DESDE && now < MSI_HASTA;
