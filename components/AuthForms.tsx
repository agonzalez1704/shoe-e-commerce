"use client";

import { useState } from "react";
import { customerSignIn, customerSignUp } from "@/app/cuenta/actions";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const INPUT = "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-text";

export function AuthForms({ error, msg, google = false, next = "/cuenta" }: { error?: string; msg?: string; google?: boolean; next?: string }) {
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

      {/* Google va arriba y con el descuento a la vista: es a donde manda la
          barra de bienvenida, y un alta con correo y contraseña convierte mucho
          peor que un toque. Sólo se pinta si la marca lo tiene activado. */}
      {google && (
        <div className="mb-5">
          <GoogleSignInButton next={next} label={tab === "up" ? "Crear cuenta con Google" : "Continuar con Google"} />
          <div className="mt-3 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" /> o con tu correo <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}

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
