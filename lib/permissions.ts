// Permission catalog — client-safe (pure data, no server imports), so the role
// editor UI and the server guards share one source of truth.
//
// Permission KEYS are code-defined: each gates a capability the app actually
// checks. An admin composes roles out of these; they can't invent a key nothing
// honors. Adding a capability means adding a key here AND the check that reads it.

export const PERMISOS = [
  "admin_total",
  "pedidos_ver",
  "pedidos_gestionar",
  "facturar",
  "productos_gestionar",
  "inventario_ver",
  "inventario_gestionar",
  "descuentos_gestionar",
  "promociones_gestionar",
  "metricas_ver",
  "comisiones_ver",
  "usuarios_gestionar",
  "ajustes_gestionar",
] as const;

export type Permiso = (typeof PERMISOS)[number];

export const CATALOGO_PERMISOS: {
  grupo: string;
  permisos: { key: Permiso; label: string; desc: string }[];
}[] = [
  {
    grupo: "Pedidos",
    permisos: [
      { key: "pedidos_ver", label: "Ver pedidos", desc: "Consultar la lista y el detalle de cada pedido." },
      { key: "pedidos_gestionar", label: "Gestionar pedidos", desc: "Cambiar la etapa, contactar al cliente y reenviar instrucciones de pago." },
      { key: "facturar", label: "Facturar", desc: "Timbrar y administrar los CFDI." },
    ],
  },
  {
    grupo: "Catálogo e inventario",
    permisos: [
      { key: "productos_gestionar", label: "Gestionar productos", desc: "Crear y editar modelos, colores y fotos." },
      { key: "inventario_ver", label: "Ver inventario", desc: "Consultar existencias por talla." },
      { key: "inventario_gestionar", label: "Gestionar inventario", desc: "Ajustar existencias y resurtir." },
    ],
  },
  {
    grupo: "Marketing",
    permisos: [
      { key: "descuentos_gestionar", label: "Gestionar descuentos", desc: "Crear y desactivar códigos de descuento." },
      { key: "promociones_gestionar", label: "Gestionar promociones", desc: "Programar promociones por porcentaje." },
      { key: "metricas_ver", label: "Ver métricas", desc: "Tráfico, fuentes y comportamiento de la tienda." },
    ],
  },
  {
    grupo: "Administración",
    permisos: [
      { key: "comisiones_ver", label: "Ver comisiones", desc: "Pagos al desarrollador. Información sensible." },
      { key: "usuarios_gestionar", label: "Gestionar usuarios y roles", desc: "Crear usuarios, definir roles y asignar permisos." },
      { key: "ajustes_gestionar", label: "Ajustes de la tienda", desc: "Configuración general y notificaciones." },
      { key: "admin_total", label: "Control total", desc: "Acceso completo, incluida la escritura directa en la base. Equivale a dueño." },
    ],
  },
];

export const LABEL_PERMISO: Record<Permiso, string> = Object.fromEntries(
  CATALOGO_PERMISOS.flatMap((g) => g.permisos.map((p) => [p.key, p.label])),
) as Record<Permiso, string>;
