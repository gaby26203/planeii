// Cliente: dispara la generación server-side y descarga el archivo.
// La lógica pesada (jsPDF/xlsx) y el gating por permisos vive en el servidor.

import { generateTripExport } from "./trip-exports.functions";
import { saveTripNow } from "./trips-store";

/**
 * Antes de exportar, forzamos el flush del auto-save debounced para que el
 * servidor lea la última versión del viaje (por ejemplo, un nombre recién
 * editado inline) sin necesidad de recargar la pantalla.
 */
async function flushPendingChanges(tripId: string) {
  try {
    await saveTripNow(tripId);
  } catch {
    // Si el guardado falla, seguimos con la exportación de lo persistido.
  }
}

function b64ToBlob(base64: string, mime: string): Blob {
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportTripPDF(tripId: string, opts: { includeFinance: boolean }) {
  await flushPendingChanges(tripId);
  const res = await generateTripExport({
    data: { tripId, format: "pdf", includeFinance: opts.includeFinance },
  });
  triggerDownload(b64ToBlob(res.base64, res.mime), res.filename);
  return res;
}

export async function exportTripXLSX(tripId: string, opts: { includeFinance: boolean }) {
  await flushPendingChanges(tripId);
  const res = await generateTripExport({
    data: { tripId, format: "xlsx", includeFinance: opts.includeFinance },
  });
  triggerDownload(b64ToBlob(res.base64, res.mime), res.filename);
  return res;
}
