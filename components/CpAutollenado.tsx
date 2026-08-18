"use client";

import { useEffect, useRef, useState } from "react";

// El código postal llena el estado y ofrece las colonias que le corresponden.
//
// El estado llegaba escrito de 34 formas distintas en 52 pedidos —"OAX.",
// "EDO. MEX.", "MICH.", "tamaulipas", "Michoacan" y "Michoacán"— y eso viaja tal
// cual a la paquetería como `area_level1`. El CP es la autoridad, así que gana
// sobre lo tecleado.
//
// api.zippopotam.us es gratis y sin llave. Sólo viaja el código postal: ni
// nombre, ni calle, ni correo. No devuelve municipio, así que ese campo sigue
// siendo manual.
const API = "https://api.zippopotam.us/mx";

// La fuente escribe sin acentos y con nombres que no son los de uso ("Veracruz
// Llave"). Se corrigen los que aparecen en pedidos reales; el resto pasa igual.
const ESTADOS: Record<string, string> = {
  "veracruz llave": "Veracruz",
  "mexico": "Estado de México",
  "michoacan de ocampo": "Michoacán",
  "nuevo leon": "Nuevo León",
  "queretaro de arteaga": "Querétaro",
  "san luis potosi": "San Luis Potosí",
  "distrito federal": "Ciudad de México",
  "ciudad de mexico": "Ciudad de México",
  "yucatan": "Yucatán",
  "peninsula de yucatan": "Yucatán",
};

const bonito = (s: string) => ESTADOS[s.trim().toLowerCase()] ?? s.trim();

export function CpAutollenado() {
  const [colonias, setColonias] = useState<string[]>([]);
  const ultimo = useRef("");

  useEffect(() => {
    const cp = document.getElementById("postal") as HTMLInputElement | null;
    const estado = document.getElementById("region") as HTMLInputElement | null;
    if (!cp || !estado) return;

    const consultar = async () => {
      const v = cp.value.replace(/\D/g, "").slice(0, 5);
      if (v.length !== 5 || v === ultimo.current) return;
      ultimo.current = v;
      try {
        const r = await fetch(`${API}/${v}`);
        if (!r.ok) return; // CP inexistente: se deja escribir a mano, sin ruido
        const j = await r.json();
        const lugares: { "place name": string; state: string }[] = j.places ?? [];
        if (!lugares.length) return;

        estado.value = bonito(lugares[0].state);
        // El input es no controlado y su etiqueta flotante reacciona al valor,
        // así que hay que avisarle a React que cambió.
        estado.dispatchEvent(new Event("input", { bubbles: true }));

        setColonias([...new Set(lugares.map((p) => p["place name"].trim()))].sort());
      } catch {
        // Sin red o servicio caído: el formulario sigue funcionando a mano.
      }
    };

    cp.addEventListener("input", consultar);
    cp.addEventListener("blur", consultar);
    if (cp.value) consultar(); // datos recordados del navegador
    return () => {
      cp.removeEventListener("input", consultar);
      cp.removeEventListener("blur", consultar);
    };
  }, []);

  // `datalist` en vez de un select: sugiere sin encerrar. Un CP puede tener una
  // colonia que la fuente no trae, y obligar a elegir de la lista dejaría a esa
  // persona sin poder comprar.
  return (
    <datalist id="colonias-cp">
      {colonias.map((c) => (
        <option key={c} value={c} />
      ))}
    </datalist>
  );
}
