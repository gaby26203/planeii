#!/usr/bin/env node
// Descarga las fotos de la plantilla de Oaxaca desde la app publicada en Lovable
// hacia public/template-assets/, para servirlas sin depender del CDN de Lovable.
//
// Uso:  bun run assets:download
//       LOVABLE_SITE_URL=https://mi-app.lovable.app bun run assets:download
//
// Lee los manifiestos de scripts/lovable-assets/*.asset.json (exportados por Lovable)
// y comprueba el tamaño de cada archivo contra el manifiesto.
import { mkdir, readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestDir = join(root, "scripts", "lovable-assets");
const outDir = join(root, "public", "template-assets");
const site = (process.env.LOVABLE_SITE_URL || "https://planeii.lovable.app").replace(/\/+$/, "");

await mkdir(outDir, { recursive: true });
const files = (await readdir(manifestDir)).filter((f) => f.endsWith(".asset.json"));
let failures = 0;

for (const file of files) {
  const manifest = JSON.parse(await readFile(join(manifestDir, file), "utf8"));
  const target = join(outDir, manifest.original_filename);
  const existing = await stat(target).catch(() => null);
  if (existing && existing.size === manifest.size) {
    console.log(`= ${manifest.original_filename} ya existe`);
    continue;
  }
  const url = `${site}${manifest.url}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length !== manifest.size) {
      console.warn(
        `! ${manifest.original_filename}: ${bytes.length} bytes, el manifiesto dice ${manifest.size}`,
      );
    }
    await writeFile(target, bytes);
    console.log(`+ ${manifest.original_filename} (${bytes.length} bytes)`);
  } catch (error) {
    failures += 1;
    console.error(`x ${manifest.original_filename}: ${url} -> ${error.message}`);
  }
}

if (failures) {
  console.error(
    `\n${failures} archivo(s) sin descargar. Si la app de Lovable ya no está publicada,`,
  );
  console.error("copiá las fotos a mano en public/template-assets/ con esos nombres.");
  process.exit(1);
}
