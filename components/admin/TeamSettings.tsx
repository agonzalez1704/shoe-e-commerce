"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash, BellRinging, BellSlash } from "@phosphor-icons/react";
import { addAdminByEmail, removeAdmin, type TeamMember } from "@/app/admin/team-actions";

export function TeamSettings({ members }: { members: TeamMember[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      setErr(null);
      setMsg(null);
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Error");
      }
    });

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    run(async () => {
      await addAdminByEmail(email);
      setMsg(`${email} ahora tiene acceso al panel.`);
      form.reset();
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <div>
        <h2 className="text-sm font-semibold">Equipo</h2>
        <p className="mt-0.5 text-xs text-muted">
          Quien tenga acceso ve todos los pedidos y recibe las mismas alertas.
        </p>
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
            <span className="font-medium">{m.email}</span>
            {m.isSelf && <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] text-muted">tú</span>}
            <span
              className={`ml-auto inline-flex items-center gap-1 text-xs ${m.devices ? "text-accent" : "text-muted"}`}
              title={m.devices ? `${m.devices} dispositivo(s) con alertas` : "Sin alertas activadas"}
            >
              {m.devices ? <BellRinging size={13} weight="fill" /> : <BellSlash size={13} />}
              {m.devices || "—"}
            </span>
            {!m.isSelf && (
              <button
                disabled={isPending}
                onClick={() => run(() => removeAdmin(m.userId))}
                aria-label={`Quitar acceso a ${m.email}`}
                className="text-muted transition-colors hover:text-accent disabled:opacity-50"
              >
                <Trash size={15} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={onAdd} className="flex flex-wrap gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="correo@ejemplo.com"
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-accent"
        />
        <button
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-50"
        >
          <UserPlus size={15} weight="bold" /> Dar acceso
        </button>
      </form>

      <p className="text-xs text-muted">
        La persona debe registrarse primero en <span className="font-medium text-text">/cuenta</span>; aquí solo le
        das el rol. Luego, desde su teléfono, que abra el panel y active las alertas.
      </p>

      {msg && <p className="text-xs text-accent">{msg}</p>}
      {err && <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">{err}</p>}
    </div>
  );
}
