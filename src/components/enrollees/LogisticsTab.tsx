// Vista comparativa de logística de todas las viajeras del viaje:
// vuelo de ida, vuelo de vuelta, seguro y archivos adjuntos.

import { useMemo, useState } from "react";
import { Paperclip, Pencil, Plane, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FlightSegmentEditor } from "./FlightSegmentEditor";
import { InsuranceEditor } from "./InsuranceEditor";
import { EnrolleeAttachments } from "./EnrolleeAttachments";
import { useTripsStore } from "@/lib/trips-store";
import {
  INSURANCE_STATE_LABELS,
  flightLabel,
  formatDateShort,
  formatFlightDateTime,
  hasFlightData,
  insuranceState,
  logisticsProgress,
  routeLabel,
} from "@/lib/enrollee-logistics";
import type { Enrollee, FlightSegment, InsuranceInfo } from "@/lib/finance-types";

type FilterKey = "todas" | "sin_ida" | "sin_vuelta" | "sin_seguro" | "seguro_alerta";

const FILTER_LABELS: Record<FilterKey, string> = {
  todas: "Todas",
  sin_ida: "Sin vuelo de ida",
  sin_vuelta: "Sin vuelo de vuelta",
  sin_seguro: "Sin seguro",
  seguro_alerta: "Seguro con alerta",
};

interface Props {
  tripId: string;
  enrollees: Enrollee[];
  canEdit: boolean;
  tripStart?: string | null;
  tripEnd?: string | null;
}

export function LogisticsTab({ tripId, enrollees, canEdit, tripStart, tripEnd }: Props) {
  const setLogistics = useTripsStore((s) => s.setEnrolleeLogistics);
  const addAttachment = useTripsStore((s) => s.addEnrolleeAttachment);
  const removeAttachment = useTripsStore((s) => s.removeEnrolleeAttachment);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todas");
  const [flightEditor, setFlightEditor] = useState<{
    enrollee: Enrollee;
    leg: "outbound" | "inbound";
  } | null>(null);
  const [insuranceEditor, setInsuranceEditor] = useState<Enrollee | null>(null);
  const [filesFor, setFilesFor] = useState<Enrollee | null>(null);

  const progress = useMemo(
    () => logisticsProgress(enrollees, tripStart, tripEnd),
    [enrollees, tripStart, tripEnd],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrollees.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q) && !e.email.toLowerCase().includes(q)) {
        return false;
      }
      const l = e.logistics;
      const st = insuranceState(l?.insurance, tripStart, tripEnd);
      if (filter === "sin_ida") return !hasFlightData(l?.outbound);
      if (filter === "sin_vuelta") return !hasFlightData(l?.inbound);
      if (filter === "sin_seguro") return st === "sin_seguro";
      if (filter === "seguro_alerta") return st === "cobertura_incompleta" || st === "sin_vigencia";
      return true;
    });
  }, [enrollees, search, filter, tripStart, tripEnd]);

  const saveFlight = (enrollee: Enrollee, leg: "outbound" | "inbound", next: FlightSegment) => {
    setLogistics(
      tripId,
      enrollee.id,
      { [leg]: next },
      `${leg === "outbound" ? "Vuelo de ida" : "Vuelo de vuelta"} actualizado`,
    );
  };

  const saveInsurance = (enrollee: Enrollee, next: InsuranceInfo) => {
    setLogistics(tripId, enrollee.id, { insurance: next }, "Seguro de viaje actualizado");
  };

  if (enrollees.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 p-8 text-center text-sm text-muted-foreground">
        Inscribí viajeras para registrar su logística de vuelos y seguros.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progreso */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Viajeras" value={`${progress.total}`} />
        <MiniStat label="Con vuelo ida" value={`${progress.withOutbound}/${progress.total}`} />
        <MiniStat label="Con vuelo vuelta" value={`${progress.withInbound}/${progress.total}`} />
        <MiniStat
          label="Con seguro"
          value={`${progress.withInsurance}/${progress.total}`}
          hint={progress.insuranceIssues > 0 ? `${progress.insuranceIssues} con alerta` : undefined}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar viajera..."
          className="sm:max-w-xs"
        />
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FILTER_LABELS) as FilterKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {FILTER_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border/60">
        <Table className="min-w-[880px]">
          <TableHeader>
            <TableRow className="bg-secondary/60 hover:bg-secondary/60">
              <TableHead className="font-bold">Viajera</TableHead>
              <TableHead className="font-bold">Vuelo de ida</TableHead>
              <TableHead className="font-bold">Vuelo de vuelta</TableHead>
              <TableHead className="font-bold">Seguro</TableHead>
              <TableHead className="font-bold text-right">Archivos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  Ninguna viajera coincide con el filtro.
                </TableCell>
              </TableRow>
            )}
            {visible.map((e) => {
              const l = e.logistics;
              const st = insuranceState(l?.insurance, tripStart, tripEnd);
              const files = l?.attachments ?? [];
              return (
                <TableRow key={e.id}>
                  <TableCell className="align-top">
                    <div className="font-medium">{e.name}</div>
                    <div className="text-xs text-muted-foreground">{e.email}</div>
                  </TableCell>
                  <FlightCell
                    segment={l?.outbound}
                    canEdit={canEdit}
                    onEdit={() => setFlightEditor({ enrollee: e, leg: "outbound" })}
                  />
                  <FlightCell
                    segment={l?.inbound}
                    canEdit={canEdit}
                    onEdit={() => setFlightEditor({ enrollee: e, leg: "inbound" })}
                  />
                  <TableCell className="align-top">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => setInsuranceEditor(e)}
                      className="text-left disabled:cursor-default"
                    >
                      <Badge
                        variant={st === "ok" ? "default" : "secondary"}
                        className="gap-1 font-normal"
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {INSURANCE_STATE_LABELS[st]}
                      </Badge>
                      {l?.insurance?.hasInsurance && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {[l.insurance.provider, l.insurance.policyNumber]
                            .filter(Boolean)
                            .join(" · ")}
                          {l.insurance.validTo && (
                            <div>Vence {formatDateShort(l.insurance.validTo)}</div>
                          )}
                        </div>
                      )}
                    </button>
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setFilesFor(e)}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {files.length > 0 ? files.length : "Agregar"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {flightEditor && (
        <FlightSegmentEditor
          open
          onOpenChange={(o) => !o && setFlightEditor(null)}
          leg={flightEditor.leg}
          enrolleeName={flightEditor.enrollee.name}
          value={
            flightEditor.leg === "outbound"
              ? flightEditor.enrollee.logistics?.outbound
              : flightEditor.enrollee.logistics?.inbound
          }
          tripStart={tripStart}
          tripEnd={tripEnd}
          onSave={(next) => saveFlight(flightEditor.enrollee, flightEditor.leg, next)}
        />
      )}

      {insuranceEditor && (
        <InsuranceEditor
          open
          onOpenChange={(o) => !o && setInsuranceEditor(null)}
          enrolleeName={insuranceEditor.name}
          value={insuranceEditor.logistics?.insurance}
          tripStart={tripStart}
          tripEnd={tripEnd}
          onSave={(next) => saveInsurance(insuranceEditor, next)}
        />
      )}

      {filesFor && (
        <EnrolleeAttachments
          open
          onOpenChange={(o) => !o && setFilesFor(null)}
          tripId={tripId}
          enrolleeId={filesFor.id}
          enrolleeName={filesFor.name}
          attachments={
            enrollees.find((x) => x.id === filesFor.id)?.logistics?.attachments ?? []
          }
          canEdit={canEdit}
          onAdd={(a) => addAttachment(tripId, filesFor.id, a)}
          onRemove={(id) => removeAttachment(tripId, filesFor.id, id)}
        />
      )}
    </div>
  );
}

function FlightCell({
  segment,
  canEdit,
  onEdit,
}: {
  segment: FlightSegment | undefined;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const filled = hasFlightData(segment);
  return (
    <TableCell className="align-top">
      <button
        type="button"
        disabled={!canEdit}
        onClick={onEdit}
        className="group text-left disabled:cursor-default"
      >
        {filled ? (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Plane className="h-3 w-3 text-primary" />
              {flightLabel(segment)}
              {canEdit && (
                <Pencil className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
              )}
            </div>
            {routeLabel(segment) && (
              <div className="text-xs text-muted-foreground">{routeLabel(segment)}</div>
            )}
            {segment?.departAt && (
              <div className="text-xs text-muted-foreground">
                {formatFlightDateTime(segment.departAt)}
                {segment.arriveAt ? ` → ${formatFlightDateTime(segment.arriveAt)}` : ""}
              </div>
            )}
            {segment?.bookingCode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground">
                    Reserva {segment.bookingCode}
                  </span>
                </TooltipTrigger>
                <TooltipContent>Código de reserva</TooltipContent>
              </Tooltip>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">
            {canEdit ? "+ Registrar vuelo" : "Sin registrar"}
          </span>
        )}
      </button>
    </TableCell>
  );
}

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg bg-secondary/60 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-normal">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
