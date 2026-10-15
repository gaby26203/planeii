@AGENTS.md

# Documentación viva

- Antes de cambiar un flujo, leé su sección en `docs/flujos.md` y el grafo de `docs/arquitectura.md`.
- Si un cambio agrega, quita o modifica un flujo, una tabla, una ruta, una server function o un
  límite entre capas, actualizá el diagrama Mermaid correspondiente en el mismo commit.
- Si arreglás un problema listado en `docs/estado.md`, sacalo de la lista en el mismo commit.
- Las secciones nuevas o completadas del menú se reflejan en `docs/secciones.md`.

# Comandos

- `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`.
- Migraciones nuevas: `supabase/migrations/<timestamp>_<nombre>.sql`, y después `bun run db:types`.
