// Genera el SQL de la demo guiada. Uso:
//   bun scripts/demo/generate.ts --owner-email tu@correo.com > demo.sql
//   bun scripts/demo/generate.ts --remove > borrar-demo.sql
// Después se pega en el SQL Editor de Supabase o se corre con psql. Ver docs/demo.md.

import { buildDemo } from "./build";
import { removeSql, seedSql } from "./sql";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (args.includes("--remove")) {
  process.stdout.write(removeSql());
} else {
  const ownerEmail = flag("--owner-email");
  if (!ownerEmail || !ownerEmail.includes("@")) {
    console.error(
      "Falta --owner-email: el correo de la cuenta owner que va a ver los viajes vitrina.",
    );
    process.exit(1);
  }
  process.stdout.write(seedSql(buildDemo(), ownerEmail));
}
