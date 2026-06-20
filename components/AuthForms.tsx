"use client";

import { useState } from "react";
import { customerSignIn, customerSignUp } from "@/app/cuenta/actions";

const INPUT = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-text";

export function AuthForms({ error, msg }: { error?: string; msg?: string }) {
  const [tab, setTab] = useState<"in" | "up">("in");

  return (
    <div className="mx-auto max-w-sm">
      <div className="mb-6 flex gap-1 rounded-full border border-border p-1 text-sm">
        <button
          onClick={() => setTab("in")}
          className={`flex-1 rounded-full px-3 py-1.5 font-medium transition-colors ${tab === "in" ? "bg-text text-bg" : "text-muted"}`}
        >
          Ingresar
        </button>
        <button
          onClick={() => setTab("up")}
          className={`flex-1 rounded-full px-3 py-1.5 font-medium transition-colors ${tab === "up" ? "bg-text text-bg" : "text-muted"}`}
        >
          Crear cuenta
        </button>
      </div>

      {msg && <p className="mb-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{msg}</p>}
      {error && <p className="mb-3 text-sm text-accent">{error}</p>}

      {tab === "in" ? (
        <form action={customerSignIn} className="space-y-3">
          <input name="email" type="email" placeholder="Correo" required className={INPUT} />
          <input name="password" type="password" placeholder="Contraseña" required className={INPUT} />
          <button className="w-full rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-contrast">Ingresar</button>
        </form>
      ) : (
        <form action={customerSignUp} className="space-y-3">
          <input name="full_name" placeholder="Nombre completo" required className={INPUT} />
          <input name="email" type="email" placeholder="Correo" required className={INPUT} />
          <input name="password" type="password" placeholder="Contraseña (mín. 6)" required minLength={6} className={INPUT} />
          <button className="w-full rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-contrast">Crear cuenta</button>
        </form>
      )}
    </div>
  );
}
