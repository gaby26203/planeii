import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { TripData, Provider } from "./finance-types";
import { costBaseAmount, formatMoney, formatUSD, getTripBaseCurrency } from "./finance-types";
import { calculateTripFinancials } from "./finance";

const CATEGORY_LABEL: Record<string, string> = {
  alojamiento: "Alojamiento",
  transporte: "Transporte",
  guia: "Guía",
  actividad: "Actividad",
  comida: "Comida",
  otro: "Otro",
};
const STATUS_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  contactado: "Contactado",
  confirmado: "Confirmado",
  pagado: "Pagado",
};

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "viaje";
}

function providersRows(providers: Provider[]) {
  return providers.map((p) => [
    p.name,
    CATEGORY_LABEL[p.category] ?? p.category,
    STATUS_LABEL[p.status] ?? p.status,
    p.serviceDate ?? "",
    p.reservationCode ?? "",
    [p.contactName, p.contactPhone, p.contactEmail].filter(Boolean).join(" · "),
    p.notes ?? "",
  ]);
}

/**
 * Filas de logística por viajera activa: vuelo de ida, vuelo de vuelta,
 * seguro y cantidad de archivos adjuntos. La primera fila son encabezados.
 * Siempre refleja los datos completos del viaje (independiente de filtros o
 * del estado de la UI).
 */
function logisticsAoa(trip: TripData): (string | number)[][] {
  const rows: (string | number)[][] = [
    [
      "Viajera",
      "Email",
      "Ida · vuelo",
      "Ida · ruta",
      "Ida · salida → llegada",
      "Ida · reserva",
      "Vuelta · vuelo",
      "Vuelta · ruta",
      "Vuelta · salida → llegada",
      "Vuelta · reserva",
      "Seguro",
      "Póliza",
      "Vigencia desde",
      "Vigencia hasta",
      "Archivos",
    ],
  ];
  const fmt = (v?: string) => (v ? v.replace("T", " ") : "");
  const seg = (s?: { airline?: string; flightNumber?: string; fromAirport?: string; toAirport?: string; departAt?: string; arriveAt?: string; bookingCode?: string }) => {
    const vuelo = [s?.airline, s?.flightNumber].filter(Boolean).join(" ");
    const ruta = s?.fromAirport || s?.toAirport ? `${s?.fromAirport ?? "—"} → ${s?.toAirport ?? "—"}` : "";
    const horas = [fmt(s?.departAt), fmt(s?.arriveAt)].filter(Boolean).join(" → ");
    return [vuelo, ruta, horas, s?.bookingCode ?? ""];
  };
  for (const e of (trip.enrollees ?? []).filter((x) => x.status !== "cancelada")) {
    const l = e.logistics;
    const ins = l?.insurance;
    rows.push([
      e.name,
      e.email ?? "",
      ...seg(l?.outbound),
      ...seg(l?.inbound),
      ins?.hasInsurance ? ins.provider || "Con seguro" : "Sin seguro",
      ins?.policyNumber ?? "",
      ins?.validFrom ?? "",
      ins?.validTo ?? "",
      (l?.attachments ?? []).length,
    ]);
  }
  return rows;
}

/**
 * Devuelve el conteo real de viajeras activas. El campo `trip.enrolled`
 * quedó obsoleto y no se actualiza al agregar/eliminar viajeras, así que
 * lo derivamos siempre desde `trip.enrollees`.
 */
function activeEnrolledCount(trip: TripData): number {
  return (trip.enrollees ?? []).filter((e) => e.status !== "cancelada").length;
}

/**
 * Formatea la tasa siempre como "1 <base> = X <local>", independiente de
 * cómo se almacene internamente (`exchangeRate` = base por 1 local, por lo
 * que la dirección visible es su inverso). Devuelve `null` si no hay
 * moneda local distinta o tasa configurada.
 */
function formatTripRate(trip: TripData): string | null {
  const base = getTripBaseCurrency(trip);
  const local = trip.localCurrency;
  const rate = trip.exchangeRate;
  if (!local || local === base || rate == null || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }
  const inverse = 1 / rate;
  const rounded = Math.round(inverse * 1_000_000) / 1_000_000;
  return `1 ${base} = ${rounded.toLocaleString("es-MX", { maximumFractionDigits: 6 })} ${local}`;
}

// ─── PDF ─────────────────────────────────────────────────────
export function buildTripPDF(
  trip: TripData,
  opts: { includeFinance: boolean },
): { bytes: Uint8Array; filename: string } {

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const marginX = 40;
  let cursorY = 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(trip.name, marginX, cursorY);
  cursorY += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(
    `${trip.destination} · ${trip.startDate} → ${trip.endDate} · ${activeEnrolledCount(trip)}/${trip.capacity} viajeras`,
    marginX,
    cursorY,
  );
  doc.setTextColor(0);
  cursorY += 20;

  const rateLine = formatTripRate(trip);
  if (rateLine) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Tasa: ${rateLine}`, marginX, cursorY);
    doc.setTextColor(0);
    cursorY += 18;
  }

  // Itinerario
  const itinRows = (trip.itinerary ?? []).flatMap((day) =>
    (day.activities ?? []).map((a, idx) => [
      `Día ${day.day}`,
      idx === 0 ? day.title : "",
      a,
    ]),
  );
  if (itinRows.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Itinerario", marginX, cursorY);
    cursorY += 6;
    autoTable(doc, {
      startY: cursorY + 4,
      head: [["Día", "Título", "Actividad"]],
      body: itinRows,

      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [64, 64, 64] },
      margin: { left: marginX, right: marginX },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 24;
  }

  // Proveedores
  const providers = trip.providers ?? [];
  if (providers.length) {
    if (cursorY > 700) {
      doc.addPage();
      cursorY = 50;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Proveedores", marginX, cursorY);
    cursorY += 6;
    autoTable(doc, {
      startY: cursorY + 4,
      head: [["Nombre", "Categoría", "Estado", "Fecha", "Reserva", "Contacto", "Notas"]],
      body: providersRows(providers),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [64, 64, 64] },
      margin: { left: marginX, right: marginX },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 24;
  }

  // Logística de viajeras (vuelos y seguro)
  const logisticsRows = logisticsAoa(trip).slice(1);
  if (logisticsRows.length) {
    if (cursorY > 620) {
      doc.addPage();
      cursorY = 50;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Logística de viajeras", marginX, cursorY);
    cursorY += 6;
    autoTable(doc, {
      startY: cursorY + 4,
      head: [["Viajera", "Vuelo ida", "Vuelo vuelta", "Seguro", "Archivos"]],
      body: logisticsRows.map((r) => [
        String(r[0]),
        [r[2], r[3], r[4]].filter(Boolean).join("\n"),
        [r[6], r[7], r[8]].filter(Boolean).join("\n"),
        [r[10], r[11], r[12] && r[13] ? `${r[12]} → ${r[13]}` : ""].filter(Boolean).join("\n"),
        String(r[14] ?? ""),
      ]),
      styles: { fontSize: 7, cellPadding: 4 },
      headStyles: { fillColor: [64, 64, 64] },
      margin: { left: marginX, right: marginX },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 24;
  }


  // Análisis financiero
  if (opts.includeFinance) {
    const f = calculateTripFinancials(trip, trip.costs);
    if (cursorY > 640) {
      doc.addPage();
      cursorY = 50;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Análisis financiero", marginX, cursorY);
    cursorY += 6;

    autoTable(doc, {
      startY: cursorY + 4,
      head: [["Indicador", "Monto"]],
      body: [
        ["Precio por persona", formatUSD(trip.pricePerPerson)],
        ["Ingreso máximo (capacidad)", formatUSD(f.revenueMax)],
        ["Ingreso actual (paquete)", formatUSD(f.revenueActual)],
        ["Cobrado bruto", formatUSD(f.revenueCollected)],
        ["Cobrado neto (menos comisiones)", formatUSD(f.revenueCollectedNet)],
        ["Comisiones absorbidas", formatUSD(f.revenueFees)],
        ["Comprometido", formatUSD(f.revenueCommitted)],
        ["Reembolsado", formatUSD(f.revenueRefunded)],
        ["Costos fijos", formatUSD(f.totalFixed)],
        ["Costos variables (actual)", formatUSD(f.totalVariableActual)],
        ["Costos variables (capacidad)", formatUSD(f.totalVariableMax)],
        ["Costo total (actual)", formatUSD(f.totalCostActual)],
        ["Costo total (capacidad)", formatUSD(f.totalCostMax)],
        ["Costo por persona", formatUSD(f.costPerPerson)],
        ["Utilidad por persona", formatUSD(f.profitPerPerson)],
        ["Utilidad actual", formatUSD(f.profitActual)],
        ["Utilidad + extras", formatUSD(f.profitWithExtras)],
        ["Extras · cobrado", formatUSD(f.extrasRevenue)],
        ["Extras · utilidad", formatUSD(f.extrasProfit)],
        ["Extras · pendiente", formatUSD(f.extrasPending)],
      ],
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [64, 64, 64] },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: marginX, right: marginX },
    });
    cursorY = (doc as any).lastAutoTable.finalY + 20;

    if (trip.costs?.length) {
      if (cursorY > 700) {
        doc.addPage();
        cursorY = 50;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Detalle de costos", marginX, cursorY);
      const baseCur = getTripBaseCurrency(trip);
      autoTable(doc, {
        startY: cursorY + 6,
        head: [["Descripción", "Categoría", "Por persona", `Monto ${baseCur}`]],
        body: trip.costs.map((c) => [
          c.description,
          c.category ?? "",
          c.perPerson ? "Sí" : "No",
          formatMoney(costBaseAmount(c, trip), baseCur),
        ]),

        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [64, 64, 64] },
        columnStyles: { 3: { halign: "right" } },
        margin: { left: marginX, right: marginX },
      });
    }
  }

  const buf = doc.output("arraybuffer");
  return { bytes: new Uint8Array(buf), filename: `${slug(trip.name)}.pdf` };
}

// ─── Excel ───────────────────────────────────────────────────
export function buildTripXLSX(
  trip: TripData,
  opts: { includeFinance: boolean },
): { bytes: Uint8Array; filename: string } {

  const wb = XLSX.utils.book_new();

  // Resumen
  const xlsxRate = formatTripRate(trip);
  const resumen: (string | number)[][] = [
    ["Viaje", trip.name],
    ["Destino", trip.destination ?? ""],
    ["Inicio", trip.startDate ?? ""],
    ["Fin", trip.endDate ?? ""],
    ["Capacidad", trip.capacity],
    ["Inscritas", activeEnrolledCount(trip)],
    ["Precio por persona (USD)", trip.pricePerPerson],
    ["Moneda base", getTripBaseCurrency(trip)],
    ["Moneda local", trip.localCurrency ?? ""],
    ["Tasa", xlsxRate ?? ""],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), "Resumen");

  // Itinerario
  const itinAoa: (string | number)[][] = [
    ["Día", "Título", "Descripción", "Actividad"],
  ];
  for (const day of trip.itinerary ?? []) {
    const acts = day.activities ?? [];
    if (acts.length === 0) {
      itinAoa.push([day.day, day.title, day.description ?? "", ""]);
    } else {
      acts.forEach((a, idx) => {
        itinAoa.push([
          day.day,
          idx === 0 ? day.title : "",
          idx === 0 ? day.description ?? "" : "",
          a,
        ]);
      });
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itinAoa), "Itinerario");

  // Proveedores
  const xlsxBase = getTripBaseCurrency(trip);
  const provAoa: (string | number)[][] = [
    ["Nombre", "Categoría", "Estado", "Fecha servicio", "Reserva", "Contacto", "Teléfono", "Email", "Notas", "Servicios vinculados", `Total grupo (${xlsxBase})`, `Por persona (${xlsxBase})`],
  ];
  const travelers = (() => {
    const enrolled = (trip.enrollees ?? []).filter((e) => e.status !== "cancelada").length || trip.enrolled || 0;
    if (trip.status === "cerrado" && enrolled > 0) return enrolled;
    return trip.capacity || enrolled || 1;
  })();
  for (const p of trip.providers ?? []) {
    const ids = (p.linkedCostIds && p.linkedCostIds.length > 0)
      ? p.linkedCostIds
      : (p.linkedCostId ? [p.linkedCostId] : []);
    const linked = ids.map((id) => trip.costs.find((c) => c.id === id)).filter(Boolean) as typeof trip.costs;
    let perGroup = 0;
    for (const c of linked) {
      const base = costBaseAmount(c, trip);
      perGroup += c.perPerson ? base * travelers : base;
    }
    const perPerson = travelers > 0 ? perGroup / travelers : perGroup;
    const linkedDesc = linked.map((c) => c.description).filter(Boolean).join(" · ");
    provAoa.push([
      p.name,
      CATEGORY_LABEL[p.category] ?? p.category,
      STATUS_LABEL[p.status] ?? p.status,
      p.serviceDate ?? "",
      p.reservationCode ?? "",
      p.contactName ?? "",
      p.contactPhone ?? "",
      p.contactEmail ?? "",
      p.notes ?? "",
      linkedDesc,
      linked.length > 0 ? perGroup : "",
      linked.length > 0 ? perPerson : "",
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(provAoa), "Proveedores");

  // Logística de viajeras
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(logisticsAoa(trip)), "Logística");

  // Finanzas
  if (opts.includeFinance) {
    const f = calculateTripFinancials(trip, trip.costs);
    const finAoa: (string | number)[][] = [
      ["Indicador", "Monto USD"],
      ["Ingreso máximo (capacidad)", f.revenueMax],
      ["Ingreso actual (paquete)", f.revenueActual],
      ["Cobrado bruto", f.revenueCollected],
      ["Cobrado neto", f.revenueCollectedNet],
      ["Comisiones absorbidas", f.revenueFees],
      ["Comprometido", f.revenueCommitted],
      ["Reembolsado", f.revenueRefunded],
      ["Costos fijos", f.totalFixed],
      ["Costos variables (actual)", f.totalVariableActual],
      ["Costos variables (capacidad)", f.totalVariableMax],
      ["Costo total (actual)", f.totalCostActual],
      ["Costo total (capacidad)", f.totalCostMax],
      ["Costo por persona", f.costPerPerson],
      ["Utilidad por persona", f.profitPerPerson],
      ["Utilidad actual", f.profitActual],
      ["Utilidad + extras", f.profitWithExtras],
      ["Extras · cobrado", f.extrasRevenue],
      ["Extras · utilidad", f.extrasProfit],
      ["Extras · pendiente", f.extrasPending],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(finAoa), "Finanzas");

    const costAoa: (string | number)[][] = [
      ["Descripción", "Categoría", "Por persona", `Monto (${xlsxBase})`, "Moneda origen", "Monto origen"],
    ];
    for (const c of trip.costs ?? []) {
      costAoa.push([
        c.description,
        c.category ?? "",
        c.perPerson ? "Sí" : "No",
        costBaseAmount(c, trip),
        c.originalCurrency ?? c.currency ?? "USD",
        c.originalAmount ?? c.amount ?? c.amountUSD ?? 0,
      ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(costAoa), "Costos");
  }


  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return { bytes: new Uint8Array(buf), filename: `${slug(trip.name)}.xlsx` };

}
