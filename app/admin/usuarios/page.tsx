import { requirePagePermiso } from "@/lib/permisos-guard";
import { listUsuarios, listRoles } from "@/app/admin/usuarios/actions";
import { UsuariosView } from "@/components/admin/UsuariosView";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  await requirePagePermiso("usuarios_gestionar");
  const [usuarios, roles] = await Promise.all([listUsuarios(), listRoles()]);
  return <UsuariosView usuarios={usuarios} roles={roles} />;
}
