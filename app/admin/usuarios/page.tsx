import { requirePagePermiso } from "@/lib/permisos-guard";
import { listUsuarios, listRoles } from "@/app/admin/usuarios/actions";
import { UsuariosView } from "@/components/admin/UsuariosView";

// Ruta bloqueante a proposito: dinamica de punta a punta (sesion/pago); un
// shell prerenderizado no aporta aqui.
export const instant = false;


export default async function UsuariosPage() {
  await requirePagePermiso("usuarios_gestionar");
  const [usuarios, roles] = await Promise.all([listUsuarios(), listRoles()]);
  return <UsuariosView usuarios={usuarios} roles={roles} />;
}
