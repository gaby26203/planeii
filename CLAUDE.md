@AGENTS.md

# Documentación viva

- Antes de cambiar un flujo, lee su sección en `docs/flujos.md` y el grafo de `docs/arquitectura.md`.
- Si un cambio agrega, quita o modifica un flujo, una tabla, una ruta, una server function o un
  límite entre capas, actualiza el diagrama Mermaid correspondiente en el mismo commit.
- Si arreglas un problema listado en `docs/estado.md`, sácalo de la lista en el mismo commit.
- Las secciones nuevas o completadas del menú se reflejan en `docs/secciones.md`.

# Idioma

- Textos de la interfaz, correos y documentación en español neutro con tú, pensado para un
  público venezolano. Sin voseo ni modismos de otros países.

# Comandos

- `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`.
- Migraciones nuevas: `supabase/migrations/<timestamp>_<nombre>.sql`, y después `bun run db:types`.
