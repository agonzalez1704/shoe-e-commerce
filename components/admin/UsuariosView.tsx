"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash, PencilSimple, ShieldCheck, X } from "@phosphor-icons/react";
import {
  crearUsuario, cambiarRolUsuario, quitarAcceso,
  crearRol, actualizarRol, eliminarRol,
  type RolRow, type UsuarioRow, type Res,
} from "@/app/admin/usuarios/actions";
import { CATALOGO_PERMISOS, type Permiso } from "@/lib/permissions";

const CARD = "rounded-2xl border border-border bg-surface p-5";
const INPUT = "h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-accent";

export function UsuariosView({ usuarios, roles }: { usuarios: UsuarioRow[]; roles: RolRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<RolRow | null | "nuevo">(null);

  const run = (fn: () => Promise<Res>, ok?: string) =>
    startTransition(async () => {
      setErr(null); setMsg(null);
      const r = await fn();
      if (!r.ok) { setErr(r.error); return; }
      if (ok) setMsg(ok);
      setCreando(false); setEditando(null);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Usuarios y roles</h1>
        <p className="mt-1 text-sm text-muted">
          Crea cuentas para tu equipo y define qué puede hacer cada quien. Puedes armar roles nuevos con los
          permisos que quieras.
        </p>
      </div>

      {err && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{err}</p>}
      {msg && <p className="rounded-lg bg-elevated px-3 py-2 text-sm text-muted">{msg}</p>}

      {/* ---------------- usuarios ---------------- */}
      <section className={CARD}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Usuarios con acceso</h2>
          <button
            onClick={() => { setCreando(true); setErr(null); setMsg(null); }}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-contrast"
          >
            <UserPlus size={14} weight="bold" /> Crear usuario
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-elevated text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5">Persona</th>
                <th className="px-4 py-2.5">Rol</th>
                <th className="px-4 py-2.5 text-right">Acceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usuarios.map((u) => (
                <tr key={u.userId}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium">
                      {u.nombre ?? u.email}
                      {u.isSelf && <span className="ml-2 rounded-full bg-elevated px-2 py-0.5 text-[10px] text-muted">tú</span>}
                    </p>
                    {u.nombre && <p className="text-xs text-muted">{u.email}</p>}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      defaultValue={u.roleId ?? ""}
                      disabled={isPending || u.isSelf}
                      onChange={(e) => run(() => cambiarRolUsuario(u.userId, e.target.value), "Rol actualizado.")}
                      className="h-9 rounded-lg border border-border bg-bg px-2 text-sm outline-none focus:border-accent disabled:opacity-50"
                      title={u.isSelf ? "No puedes cambiar tu propio rol" : undefined}
                    >
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!u.isSelf && (
                      <button
                        disabled={isPending}
                        onClick={() => run(() => quitarAcceso(u.userId), "Acceso retirado.")}
                        className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-accent"
                      >
                        <Trash size={13} /> Quitar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------- roles ---------------- */}
      <section className={CARD}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Roles</h2>
          <button
            onClick={() => { setEditando("nuevo"); setErr(null); setMsg(null); }}
            className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium transition-colors hover:border-text"
          >
            + Rol nuevo
          </button>
        </div>

        <ul className="divide-y divide-border rounded-xl border border-border">
          {roles.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  {r.name}
                  {r.permisos.includes("admin_total") && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                      <ShieldCheck size={11} weight="fill" /> control total
                    </span>
                  )}
                  {r.isSystem && <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] text-muted">sistema</span>}
                </p>
                {r.description && <p className="truncate text-xs text-muted">{r.description}</p>}
              </div>
              <span className="text-xs text-muted">
                {r.permisos.includes("admin_total") ? "todos los permisos" : `${r.permisos.length} permiso${r.permisos.length === 1 ? "" : "s"}`}
                {" · "}{r.usuarios} usuario{r.usuarios === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditando(r); setErr(null); setMsg(null); }}
                  className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-text"
                >
                  <PencilSimple size={13} /> Editar
                </button>
                {!r.isSystem && (
                  <button
                    disabled={isPending}
                    onClick={() => run(() => eliminarRol(r.id), "Rol eliminado.")}
                    className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-accent"
                  >
                    <Trash size={13} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {creando && (
        <CrearUsuario roles={roles} isPending={isPending} onClose={() => setCreando(false)}
          onSubmit={(v) => run(() => crearUsuario(v), `Cuenta creada para ${v.email}.`)} />
      )}
      {editando && (
        <RolEditor
          rol={editando === "nuevo" ? null : editando}
          isPending={isPending}
          onClose={() => setEditando(null)}
          onSubmit={(v) =>
            run(() => (editando === "nuevo" ? crearRol(v) : actualizarRol(editando.id, v)),
              editando === "nuevo" ? "Rol creado." : "Rol actualizado.")}
        />
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-text"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CrearUsuario({
  roles, isPending, onClose, onSubmit,
}: {
  roles: RolRow[]; isPending: boolean; onClose: () => void;
  onSubmit: (v: { email: string; password: string; nombre: string; roleId: string }) => void;
}) {
  const sinAdmin = roles.filter((r) => !r.permisos.includes("admin_total"));
  const [roleId, setRoleId] = useState((sinAdmin[0] ?? roles[0])?.id ?? "");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Modal title="Crear usuario" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={INPUT} placeholder="Nombre y apellido" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Correo</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={INPUT} placeholder="persona@correo.com" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Contraseña temporal</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="text" className={INPUT} placeholder="mínimo 8 caracteres" />
          <p className="mt-1 text-xs text-muted">Compártesela por un medio seguro; puede cambiarla al entrar.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Rol</label>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={INPUT}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm">Cancelar</button>
          <button
            disabled={isPending}
            onClick={() => onSubmit({ email, password, nombre, roleId })}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-50"
          >
            {isPending ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RolEditor({
  rol, isPending, onClose, onSubmit,
}: {
  rol: RolRow | null; isPending: boolean; onClose: () => void;
  onSubmit: (v: { name: string; description: string; permisos: string[] }) => void;
}) {
  const [name, setName] = useState(rol?.name ?? "");
  const [description, setDescription] = useState(rol?.description ?? "");
  const [sel, setSel] = useState<Set<Permiso>>(new Set(rol?.permisos ?? []));

  const toggle = (k: Permiso) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });

  return (
    <Modal title={rol ? `Editar ${rol.name}` : "Rol nuevo"} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} placeholder="Ej. Almacén" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Descripción</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT} placeholder="Qué hace este rol" />
          </div>
        </div>

        <div className="max-h-[45vh] space-y-4 overflow-y-auto pr-1">
          {CATALOGO_PERMISOS.map((g) => (
            <div key={g.grupo}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{g.grupo}</p>
              <div className="space-y-1.5">
                {g.permisos.map((p) => (
                  <label key={p.key} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={sel.has(p.key)}
                      onChange={() => toggle(p.key)}
                      className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{p.label}</span>
                      <span className="block text-xs text-muted">{p.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-sm">Cancelar</button>
          <button
            disabled={isPending}
            onClick={() => onSubmit({ name, description, permisos: [...sel] })}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-50"
          >
            {isPending ? "Guardando…" : rol ? "Guardar" : "Crear rol"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
