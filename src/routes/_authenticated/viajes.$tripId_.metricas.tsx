import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getTripPageMetrics } from "@/lib/trip-metrics.functions";
import { useTripsStore } from "@/lib/trips-store";

export const Route = createFileRoute("/_authenticated/viajes/$tripId_/metricas")({
  head: () => ({
    meta: [
      { title: "Métricas de la landing | Planeii" },
      { name: "description", content: "Visitas, ubicación, dispositivo y clics de la página pública del viaje." },
      { property: "og:title", content: "Métricas de la landing | Planeii" },
      { property: "og:description", content: "Visitas, ubicación, dispositivo y clics de la página pública del viaje." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TripMetricsPage,
});

const COUNTRY_NAMES = new Intl.DisplayNames(["es"], { type: "region" });
const countryName = (code: string) => {
  if (code === "Desconocido") return code;
  try {
    return COUNTRY_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
};

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-sm">{label}</span>
      <div className="h-2 min-w-0 flex-1 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${max > 0 ? Math.max(4, (count / max) * 100) : 0}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{count}</span>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function TripMetricsPage() {
  const { tripId } = Route.useParams();
  const trip = useTripsStore((s) => s.trips[tripId]);
  const { data: metrics, isLoading, isError } = useQuery({
    queryKey: ["trip-page-metrics", tripId],
    queryFn: () => getTripPageMetrics({ data: { tripId } }),
  });

  if (!trip) {
    return (
      <div className="p-8 text-center">
        <h1 className="mb-2 font-display text-2xl font-bold">Viaje no encontrado</h1>
        <Link to="/" className="text-primary underline">Volver a mis viajes</Link>
      </div>
    );
  }

  const maxDay = Math.max(1, ...(metrics?.byDay.map((d) => d.count) ?? [1]));
  const clickRate = metrics && metrics.totalViews > 0 ? Math.round((metrics.bookingClicks / metrics.totalViews) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Métricas de la landing</h1>
          <p className="text-sm text-muted-foreground">{trip.destination || trip.name} · últimos 30 días</p>
        </div>
        <Link to="/viajes/$tripId/pagina" params={{ tripId }} className="text-sm font-semibold text-primary underline">
          Volver al editor
        </Link>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Cargando métricas…</p> : null}
      {isError ? <p className="text-sm text-destructive">No se pudieron cargar las métricas. Intentá nuevamente.</p> : null}

      {metrics ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Visitas totales" value={metrics.totalViews} />
            <StatCard label="Últimos 7 días" value={metrics.views7d} />
            <StatCard label="Clics en reserva" value={metrics.bookingClicks} hint={`${clickRate}% de las visitas`} />
            <StatCard label="Clics en el anuncio" value={metrics.announcementClicks} />
          </div>

          <section className="rounded-xl border bg-background p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Funnel de solicitudes</h2>
              <Link to="/viajes/$tripId/solicitudes" params={{ tripId }} className="text-sm font-semibold text-primary underline">Ver solicitudes</Link>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard label="Visitas" value={metrics.totalViews} />
              <StatCard label="Clic en reservar" value={metrics.bookingClicks} />
              <StatCard label="Formulario iniciado" value={metrics.formStarts} />
              <StatCard label="Solicitudes" value={metrics.applications} hint={`${metrics.totalViews ? Math.round((metrics.applications / metrics.totalViews) * 100) : 0}% de las visitas`} />
              <StatCard label="Confirmadas" value={metrics.confirmed} hint={`${metrics.applications ? Math.round((metrics.confirmed / metrics.applications) * 100) : 0}% de las solicitudes`} />
            </div>
          </section>

          <section className="rounded-xl border bg-background p-4">
            <h2 className="mb-4 text-sm font-semibold">Visitas por día</h2>
            {metrics.byDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay visitas registradas.</p>
            ) : (
              <div className="flex h-32 items-end gap-1">
                {metrics.byDay.map((d) => (
                  <div key={d.day} className="group relative min-w-0 flex-1">
                    <div className="w-full rounded-t bg-primary/80" style={{ height: `${Math.max(4, (d.count / maxDay) * 100)}%` }} />
                    <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded bg-foreground px-2 py-0.5 text-[10px] text-background group-hover:block">
                      {d.day.slice(5)}: {d.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            <section className="rounded-xl border bg-background p-4">
              <h2 className="mb-3 text-sm font-semibold">País</h2>
              <div className="space-y-2">
                {metrics.byCountry.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos todavía.</p> : null}
                {metrics.byCountry.map((c) => (
                  <Bar key={c.label} label={countryName(c.label)} count={c.count} max={metrics.byCountry[0]?.count ?? 1} />
                ))}
              </div>
            </section>
            <section className="rounded-xl border bg-background p-4">
              <h2 className="mb-3 text-sm font-semibold">Dispositivo</h2>
              <div className="space-y-2">
                {metrics.byDevice.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos todavía.</p> : null}
                {metrics.byDevice.map((d) => (
                  <Bar key={d.label} label={d.label} count={d.count} max={metrics.byDevice[0]?.count ?? 1} />
                ))}
              </div>
            </section>
            <section className="rounded-xl border bg-background p-4">
              <h2 className="mb-3 text-sm font-semibold">Origen</h2>
              <div className="space-y-2">
                {metrics.byReferrer.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos todavía.</p> : null}
                {metrics.byReferrer.map((r) => (
                  <Bar key={r.label} label={r.label} count={r.count} max={metrics.byReferrer[0]?.count ?? 1} />
                ))}
              </div>
            </section>
          </div>

          <p className="text-xs text-muted-foreground">
            El país es aproximado y se detecta automáticamente; no se guarda ningún dato personal de los visitantes.
          </p>
        </>
      ) : null}
    </div>
  );
}
