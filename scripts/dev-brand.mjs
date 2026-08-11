// Arranca `next dev` con el .env de una marca concreta.
//
//   node scripts/dev-brand.mjs honeywhale 3009   -> lee .env.honeywhale
//
// No usa `node --env-file`: Next reenvía los flags del proceso padre a sus
// procesos hijo a través de NODE_OPTIONS, y ahí --env-file está prohibido, así
// que el servidor muere al arrancar. process.loadEnvFile() hace lo mismo sin
// dejar rastro en la línea de comandos.
//
// Las variables cargadas aquí ganan a .env.local: @next/env no sobreescribe lo
// que ya está en process.env.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const [marca, puerto = "3000"] = process.argv.slice(2);
if (!marca) {
  console.error("uso: node scripts/dev-brand.mjs <marca> [puerto]");
  process.exit(1);
}

const archivo = `.env.${marca}`;
if (!existsSync(archivo)) {
  console.error(`No existe ${archivo}. Cópialo de .env.example y pon las claves de esa tienda.`);
  process.exit(1);
}
process.loadEnvFile(archivo);

const real = process.env.NEXT_PUBLIC_BRAND;
if (real !== marca) {
  // Ejecutar con la marca de otra tienda es exactamente el fallo que este
  // repo ya cometió una vez: publicar el RFC de Blade en otro dominio.
  console.error(`${archivo} declara NEXT_PUBLIC_BRAND=${real ?? "(vacío)"}, no ${marca}. Se aborta.`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
console.log(`▲ marca ${marca} · puerto ${puerto} · datos ${url}`);

spawn("node", ["node_modules/next/dist/bin/next", "dev", "-p", puerto], {
  stdio: "inherit",
  env: process.env,
}).on("exit", (code) => process.exit(code ?? 0));
