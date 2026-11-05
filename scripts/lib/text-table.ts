/** Tabla de texto con columnas alineadas para la salida de los scripts de migración. */
export type Align = "left" | "right";

/** `plural(1, "objeto", "objetos")` → `1 objeto`. */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function formatTable(headers: string[], rows: string[][], align: Align[] = []): string {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => (row[column] ?? "").length)),
  );
  const line = (cells: string[]) =>
    widths
      .map((width, column) => {
        const cell = cells[column] ?? "";
        return align[column] === "right" ? cell.padStart(width) : cell.padEnd(width);
      })
      .join("  ")
      .trimEnd();
  return [
    line(headers),
    widths.map((width) => "-".repeat(width)).join("  "),
    ...rows.map(line),
  ].join("\n");
}
