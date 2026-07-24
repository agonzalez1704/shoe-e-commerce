"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// First-party analytics beacon: one pageview per navigation, plus tracked clicks
// on links and buttons. No PII — a random session id (30-min sliding window) is
// the only identifier. Admin/api paths are ignored server-side too.

const SID_KEY = "blade_sid";
const TS_KEY = "blade_sid_ts";
const WINDOW = 30 * 60 * 1000;

function sessionId(): string {
  try {
    const now = Date.now();
    const last = Number(localStorage.getItem(TS_KEY) || 0);
    let sid = localStorage.getItem(SID_KEY);
    if (!sid || now - last > WINDOW) {
      sid = crypto.randomUUID();
      localStorage.setItem(SID_KEY, sid);
    }
    localStorage.setItem(TS_KEY, String(now));
    return sid;
  } catch {
    return "anon";
  }
}

function device(): "mobile" | "desktop" {
  return window.innerWidth < 768 ? "mobile" : "desktop";
}

// where the visit came from: utm_source, else the referring host, else nothing
function source(): string {
  const utm = new URLSearchParams(window.location.search).get("utm_source");
  if (utm) return utm.slice(0, 60);
  const ref = document.referrer;
  if (!ref) return "";
  try {
    const host = new URL(ref).host;
    return host && host !== window.location.host ? host : "";
  } catch {
    return "";
  }
}

function send(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ ...payload, sid: sessionId() });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    else fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
  } catch {
    /* analytics must never break the page */
  }
}

export function AnalyticsBeacon() {
  const pathname = usePathname();

  // pageview on every navigation (skip our own admin)
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    send({ type: "pageview", path: pathname, referrer: document.referrer.slice(0, 300), source: source(), device: device() });
  }, [pathname]);

  // delegated click tracking on links and buttons
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement)?.closest?.("a, button, [role=button]") as HTMLElement | null;
      if (!el) return;
      const text = el.textContent?.trim() ?? "";
      const anchor = el.closest("a") as HTMLAnchorElement | null;
      // aria-label wins; then short button/link text; else the link's path
      // (a whole product card's text is useless as a label)
      let label = el.getAttribute("aria-label") || "";
      if (!label) label = text.length > 0 && text.length <= 40 ? text : "";
      if (!label && anchor) {
        try { label = new URL(anchor.href).pathname; } catch { label = anchor.getAttribute("href") ?? ""; }
      }
      if (!label) label = text || el.tagName.toLowerCase();
      send({ type: "click", path: pathname, target: label.slice(0, 120), device: device() });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  return null;
}
