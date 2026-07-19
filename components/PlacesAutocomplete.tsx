"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

// Google Places autocomplete bound to the #line1 field. On selection it fills
// the colonia/ciudad/estado/CP inputs by id. No-ops (renders nothing) unless
// NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set — so it's inert until you add the key.
const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

function fill(id: string, v: string) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el && v) el.value = v; // floating label reacts to :placeholder-shown flipping
}

export function PlacesAutocomplete() {
  const ready = useRef(false);

  function init() {
    if (ready.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google;
    const input = document.getElementById("line1") as HTMLInputElement | null;
    if (!g?.maps?.places || !input) return;
    ready.current = true;

    const ac = new g.maps.places.Autocomplete(input, {
      componentRestrictions: { country: "mx" },
      fields: ["address_components"],
      types: ["address"],
    });
    ac.addListener("place_changed", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = ac.getPlace().address_components ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const get = (t: string) => parts.find((p: any) => p.types.includes(t))?.long_name ?? "";
      fill("line1", [get("route"), get("street_number")].filter(Boolean).join(" "));
      fill("neighborhood", get("sublocality_level_1") || get("neighborhood"));
      fill("city", get("locality") || get("administrative_area_level_2"));
      fill("region", get("administrative_area_level_1"));
      fill("postal", get("postal_code"));
    });
  }

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (KEY && (window as any).google?.maps?.places) init();
  }, []);

  if (!KEY) return null;
  return (
    <Script
      src={`https://maps.googleapis.com/maps/api/js?key=${KEY}&libraries=places&language=es&region=MX`}
      strategy="afterInteractive"
      onLoad={init}
    />
  );
}
