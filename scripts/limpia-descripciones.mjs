// Quita de las descripciones la cola de especificaciones que dejó la
// importación del Excel, y deja la prosa.
//
//   node scripts/limpia-descripciones.mjs .env.honeywhale            (simulacro)
//   node scripts/limpia-descripciones.mjs .env.honeywhale --aplicar
//
// Es un script y no una migración a propósito: las migraciones corren contra el
// proyecto que esté enlazado en ese momento, y esto no debe tocar Blade.
//
// La descripción traía pegada la misma cifra que ya vive en `attributes` —de
// hecho los specs se sembraron desde ahí—, así que la PDP mostraba
// "25 km/h · 15 km · 120 kg" en los tiles y justo debajo, otra vez,
// "25 KM 15 AUTONOMIA 120 KG 36V/5.2AH".
//
// No borra la descripción entera. Corta por dos señales que están en los datos:
// la cola pegada siempre termina en la palabra AUTONOMIA, y la prosa de esta
// hoja siempre lleva comas mientras que la sopa nunca. Lo demás se conserva:
//
//   "55KM 45 AUTONOMIA 120 KG"                  -> null
//   "90 KM 90 AUTONOMIA EQUIPO TOP DE HW"       -> "EQUIPO TOP DE HW"
//   "Aleación de aluminio… trasero. 10 KM/H"    -> "Aleación de aluminio… trasero."
//
// Nada se pierde en silencio: los specs que la cola declara y `attributes` no
// tiene se reportan al final para que alguien decida, en vez de escribirlos
// aquí. La prosa y la cola se contradicen en varios productos (una dice 14
// km/h, la otra 15) y esa contradicción es del proveedor, no del código.
import { writeFileSync } from "node:fs";

const [archivoEnv, ...flags] = process.argv.slice(2);
const aplicar = flags.includes("--aplicar");
if (!archivoEnv) {
  console.error("uso: node scripts/limpia-descripciones.mjs <.env.marca> [--aplicar]");
  process.exit(1);
}
process.loadEnvFile(archivoEnv);

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const LLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !LLAVE) {
  console.error(`${archivoEnv} no trae NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY`);
  process.exit(1);
}
const cabeceras = { apikey: LLAVE, Authorization: `Bearer ${LLAVE}`, "Content-Type": "application/json" };

// Un token es "de especificación" si es una cifra con unidad, una unidad
// suelta, o una de las palabras que la hoja usaba como etiqueta.
const PALABRAS = /^(AUTONOMIA|AUTONOMÍA|KM|KMS|KG|KGS|PENDIENTE|MAX|MAXIMA|MÁXIMA)$/i;
// La unidad suelta: "25 KM/H 35 AUTONOMIA" se tokeniza como 25 · KM/H · 35 ·
// AUTONOMIA, y sin esto "KM/H" quedaba en medio y salvaba toda la cadena.
const UNIDADES = /^(KM\/H|KMH|KM|KG|W|V|A|AH|MPH)$/i;
const CIFRAS = /^\d+(\.\d+)?$/;
// 55KM · 48V/15AH · 60V/20.8AH · 750-1000W · 36V/5.2AAH · 35-40AUTONOMIA
// La hoja pega la unidad y hasta la etiqueta al número, sin espacio.
const CIFRA_UNIDAD =
  /^\d+(\.\d+)?(-\d+(\.\d+)?)?\s*(KM\/H|KMH|KM|KG|W|A?AH|A|V)?(\/\d+(\.\d+)?\s*(A?AH|A|W|V)?)?(AUTONOM[IÍ]A)?$/i;

// Palabras que sólo cuentan como especificación cuando van junto a una cifra.
// "MOTOR 700 W" es una ficha; "MOTOR CON CADENA" y "ALARMA CON BLOQUEO DE
// MOTOR" son descripción, y sin esta distinción se perdían.
const ETIQUETAS = /^(MOTOR|BATERIA|BATERÍA|BATERA|VELOCIDAD|POTENCIA)$/i;

const limpio = (t) => t.replace(/[.,;:]+$/, "");
const esCifra = (t) => {
  const s = limpio(t);
  return !!s && (CIFRAS.test(s) || CIFRA_UNIDAD.test(s));
};

const esSpec = (t, vecino) => {
  const s = limpio(t);
  if (!s) return false;
  if (ETIQUETAS.test(s)) return !!vecino && esCifra(vecino);
  return PALABRAS.test(s) || UNIDADES.test(s) || esCifra(s);
};

// La cola que pegó la importación tiene forma fija: "<n> KM/H … <n> KM
// AUTONOMIA" al final de todo. Exigir el AUTONOMIA literal es lo que impide
// comerse los números de una frase real — sin él, "MOTOR DE 200 W" se quedaba
// en "MOTOR DE".
const COLA = /[\s.,]+\d+(\.\d+)?\s*KM\/?H?\b[\s\d.,]*(KM|KMS)?\s*AUTONOM[IÍ]A\s*$/i;

// La prosa de esta hoja siempre lleva comas ("VELOCIDAD MAXIMA 10KM/H,
// AUTONOMIA 10KM, LLANTAS DE GOMA…"); la sopa nunca. Es lo que distingue una
// oración que empieza con una cifra de una fila de cifras.
const tieneProsa = (s) => s.includes(",");

function limpia(desc) {
  let s = desc.trim();
  const quitados = [];

  const conCola = s.replace(COLA, "");
  if (conCola !== s) { quitados.push(s.slice(conCola.length).trim()); s = conCola.trim(); }

  if (!tieneProsa(s)) {
    // Sin comas: recorta la corrida de specs del inicio y del final. El centro
    // no se toca, así que "65 KM 50 AUTONOMIA 150 KG MOTOR CON CADENA"
    // conserva su frase.
    const tokens = s.split(/\s+/).filter(Boolean);
    let ini = 0;
    while (ini < tokens.length && esSpec(tokens[ini], tokens[ini + 1])) ini++;
    let fin = tokens.length;
    while (fin > ini && esSpec(tokens[fin - 1], tokens[fin - 2])) fin--;
    if (ini > 0 || fin < tokens.length) {
      quitados.push([...tokens.slice(0, ini), ...tokens.slice(fin)].join(" "));
      s = tokens.slice(ini, fin).join(" ");
    }
  }

  s = s.replace(/^[.,;:\s-]+/, "").replace(/[\s,;:-]+$/, "").trim();
  // Un resto sin ninguna palabra de tres letras o más es basura ("K M", "DE"),
  // no una descripción.
  const restante = /[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}/.test(s) ? s : "";
  if (!restante && s) quitados.push(s);
  return { restante, quitados: quitados.filter(Boolean) };
}

const r = await fetch(
  `${URL_BASE}/rest/v1/products?select=id,slug,description,attributes&status=eq.active&order=slug`,
  { headers: cabeceras },
);
const productos = await r.json();
if (!Array.isArray(productos)) {
  console.error("Supabase respondió:", productos);
  process.exit(1);
}

const cambios = [];
const intactos = [];
for (const p of productos) {
  const desc = (p.description ?? "").trim();
  if (!desc) continue;
  const { restante, quitados } = limpia(desc);
  if (!quitados.length) { intactos.push(p.slug); continue; }
  cambios.push({ id: p.id, slug: p.slug, antes: desc, despues: restante || null, quitados, attributes: p.attributes ?? {} });
}

const aNull = cambios.filter((c) => c.despues === null);
const recortados = cambios.filter((c) => c.despues !== null);

console.log(`Proyecto ${URL_BASE}`);
console.log(`Productos activos con descripción: ${productos.filter((p) => (p.description ?? "").trim()).length}`);
console.log(`  se vacían por completo : ${aNull.length}`);
console.log(`  se les recorta la cola : ${recortados.length}`);
console.log(`  se dejan intactos      : ${intactos.length}\n`);

for (const c of recortados) {
  console.log(`~ ${c.slug}`);
  console.log(`    antes:  ${c.antes.replace(/\s+/g, " ")}`);
  console.log(`    queda:  ${c.despues}`);
}
console.log();
for (const c of aNull) console.log(`- ${c.slug}: "${c.antes.replace(/\s+/g, " ")}" -> null`);

// Cifras que la cola declaraba y attributes no tiene. No se escriben: la prosa
// y la cola se contradicen en varios productos y elegir por ellos sería
// inventar una ficha técnica.
const huerfanos = cambios.filter((c) => {
  const vals = Object.values(c.attributes).map((v) => String(v).toLowerCase());
  return c.quitados.some((t) => /\d/.test(t) && !vals.some((v) => v.includes(t.replace(/[^\d.]/g, "")) && t.replace(/[^\d.]/g, "")));
});
if (huerfanos.length) {
  console.log(`\nRevisar a mano (${huerfanos.length}): la cola trae cifras que attributes no refleja.`);
  for (const c of huerfanos.slice(0, 15)) console.log(`  ${c.slug}: ${c.quitados.join(" ")}  |  attributes: ${JSON.stringify(c.attributes)}`);
}

if (!aplicar) {
  console.log("\nSimulacro. Nada se escribió. Añade --aplicar para guardar.");
  process.exit(0);
}

const respaldo = `descripciones-respaldo-${archivoEnv.replace(/^\./, "")}.json`;
writeFileSync(respaldo, JSON.stringify(cambios.map(({ id, slug, antes }) => ({ id, slug, description: antes })), null, 2));
console.log(`\nRespaldo de los originales en ${respaldo}`);

let ok = 0;
for (const c of cambios) {
  const res = await fetch(`${URL_BASE}/rest/v1/products?id=eq.${c.id}`, {
    method: "PATCH",
    headers: cabeceras,
    body: JSON.stringify({ description: c.despues }),
  });
  if (res.ok) ok++;
  else console.error(`  fallo ${c.slug}: ${res.status} ${await res.text()}`);
}
console.log(`Actualizados ${ok}/${cambios.length}.`);
