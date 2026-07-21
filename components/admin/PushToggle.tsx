"use client";

import { useEffect, useState } from "react";
import { BellRinging, BellSlash } from "@phosphor-icons/react";
import { savePushSubscription, deletePushSubscription, sendTestNotification } from "@/app/admin/push-actions";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

// base64url -> Uint8Array, the format PushManager wants for the app server key
function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushToggle() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [standalone, setStandalone] = useState(true);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && !!VAPID;
    setSupported(ok);
    // iOS only delivers Web Push to an installed (Home Screen) PWA
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setStandalone(!isIOS || installed);
    if (!ok) return;
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMsg("Permiso denegado. Actívalo en los ajustes del navegador.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      setSubscribed(true);
      setMsg("Este dispositivo recibirá alertas de pedidos.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo activar.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMsg("Alertas desactivadas en este dispositivo.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo desactivar.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
        Este navegador no soporta notificaciones push.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            {subscribed ? <BellRinging size={17} weight="fill" className="text-accent" /> : <BellSlash size={17} />}
            Alertas de pedidos
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Pedido nuevo, pago recibido, pago rechazado y cambios de etapa.
          </p>
        </div>
        <div className="flex gap-2">
          {subscribed && (
            <button
              disabled={busy}
              onClick={() => sendTestNotification()}
              className="rounded-full border border-border px-3.5 py-2 text-xs font-medium transition-colors hover:bg-elevated disabled:opacity-50"
            >
              Probar
            </button>
          )}
          <button
            disabled={busy}
            onClick={subscribed ? disable : enable}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-transform active:scale-[0.98] disabled:opacity-50 ${
              subscribed ? "border border-border" : "bg-accent text-accent-contrast"
            }`}
          >
            {busy ? "…" : subscribed ? "Desactivar" : "Activar"}
          </button>
        </div>
      </div>

      {!standalone && (
        <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
          En iPhone primero agrega esta página a la pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde
          ahí. Safari no entrega notificaciones fuera de la app instalada.
        </p>
      )}
      {msg && <p className="mt-3 text-xs text-muted">{msg}</p>}
    </div>
  );
}
