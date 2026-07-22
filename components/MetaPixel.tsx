"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

type Fbq = (...args: unknown[]) => void;
declare global {
  interface Window {
    fbq?: Fbq;
  }
}

// Fire a standard Meta event. Safe to call anywhere: it no-ops when the pixel
// isn't configured or hasn't loaded (ad blockers, consent, first paint).
// eventId ties a browser event to its Conversions API twin so Meta dedupes them.
export function trackMeta(event: string, params?: Record<string, unknown>, eventId?: string) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", event, params ?? {}, eventId ? { eventID: eventId } : undefined);
}

export function MetaPixel() {
  const pathname = usePathname();

  // the SPA doesn't reload, so PageView has to be re-sent on navigation
  useEffect(() => {
    if (PIXEL_ID) trackMeta("PageView");
  }, [pathname]);

  if (!PIXEL_ID) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${PIXEL_ID}');fbq('track','PageView');`}
    </Script>
  );
}
