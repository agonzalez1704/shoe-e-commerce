// Meses sin intereses con tarjeta (Conekta) para el Buen Fin 2026. La comisión
// de MSI la paga la tienda, así que se apagan solos al cerrar la campaña:
// 18-nov-2026 00:00 CDMX. Para extenderlos, mueve MSI_HASTA.
export const MSI_PLAZOS = [3, 6];
export const MSI_HASTA = Date.parse("2026-11-18T00:00:00-06:00");
export const msiVigente = (now = Date.now()) => now < MSI_HASTA;
