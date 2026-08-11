// Enlaza el proyecto de Supabase de una tienda y empuja sus migraciones.
//
//   pnpm db:push:blade
//   pnpm db:push:honeywhale
//
// Un repo sirve a varias tiendas y cada una tiene su propio proyecto, pero
// `supabase db push` va contra el que esté enlazado en ese momento. Acordarse de
// cambiar el link a mano es justo el paso que se olvida, y equivocarse manda la
// migración de una tienda a medio construir contra otra con pedidos reales.
//
// El ref se deriva de NEXT_PUBLIC_SUPABASE_URL del mismo archivo .env que tiene
// las llaves, así que el destino y las credenciales no pueden desincronizarse.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const [archivoEnv] = process.argv.slice(2);
if (!archivoEnv || !existsSync(archivoEnv)) {
  console.error(`uso: node scripts/db-push.mjs <.env.marca>   (no existe ${archivoEnv ?? "(nada)"})`);
  process.exit(1);
}
process.loadEnvFile(archivoEnv);

const marca = process.env.NEXT_PUBLIC_BRAND;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/)?.[1];

if (!ref) {
  console.error(
    `NEXT_PUBLIC_SUPABASE_URL de ${archivoEnv} no es un proyecto remoto: ${url || "(vacía)"}\n` +
      "Debe ser https://<ref>.supabase.co sin ruta. Con la URL local (127.0.0.1) usa `supabase migration up --local`.",
  );
  process.exit(1);
}

const correr = (args) => execFileSync("supabase", args, { stdio: "inherit" });

console.log(`▲ marca ${marca} · proyecto ${ref}\n`);
correr(["link", "--project-ref", ref]);

// Se listan antes de empujar: ver qué falta es lo que distingue "no hay nada
// pendiente" de "estoy a punto de aplicar la migración de otra tienda".
console.log("\nMigraciones:");
correr(["migration", "list", "--linked"]);

console.log(`\nEmpujando a ${marca} (${ref})…`);
correr(["db", "push", "--linked"]);
