import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTripsStore } from "@/lib/trips-store";
import { TripEditor } from "@/components/editor/TripEditor";
import type { EditorDocument } from "@/lib/trip-editor";
import type { TripData as LandingTrip } from "@/data/trip";
import { neutralItinerary } from "@/data/neutral-trip";

export const Route = createFileRoute("/_authenticated/viajes/$tripId_/pagina")({
  head: () => ({
    meta: [
      { title: "Página de venta del viaje | Planeii" },
      { name: "description", content: "Editor visual de la página pública de venta del viaje." },
      { property: "og:title", content: "Página de venta del viaje | Planeii" },
      { property: "og:description", content: "Personalizá y publicá la landing de tu viaje." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TripPageEditor,
});

const fmtLong = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
const fmtShort = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

function TripPageEditor() {
  const { tripId } = Route.useParams();
  const trip = useTripsStore((s) => s.trips[tripId]);
  const [published, setPublished] = useState<EditorDocument | null | undefined>(undefined);

  useEffect(() => {
    supabase
      .from("trip_pages")
      .select("document")
      .eq("trip_id", tripId)
      .maybeSingle()
      .then(({ data }) => setPublished((data?.document as unknown as EditorDocument) ?? null));
  }, [tripId]);

  const initialTrip = useMemo<Partial<LandingTrip>>(() => {
    if (!trip) return {};
    const out: Partial<LandingTrip> = {
      destination: trip.destination || trip.name,
      currency: trip.currency || "USD",
    };
    if (trip.country) out.country = trip.country;
    if (trip.pricePerPerson) out.price = `$${trip.pricePerPerson.toLocaleString("en-US")}`;
    if (trip.capacity) {
      out.spots = String(trip.capacity);
      out.groupSize = `Máximo ${trip.capacity} viajeras`;
    }
    if (trip.startDate && trip.endDate) {
      out.dates = `${fmtLong(trip.startDate)} — ${fmtLong(trip.endDate)}`;
      out.datesShort = `${fmtShort(trip.startDate)} — ${fmtShort(trip.endDate)}`;
      const days =
        Math.round((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000) + 1;
      if (days > 0) {
        out.duration = `${days} días`;
        // Solo los días iniciales de una landing nueva; luego se editan libremente.
        out.itinerary = neutralItinerary(days);
      }
    }
    return out;
  }, [trip]);

  if (!trip) {
    return (
      <div className="p-8 text-center">
        <h1 className="font-display text-2xl font-bold mb-2">Viaje no encontrado</h1>
        <Link to="/" className="text-primary underline">Volver a mis viajes</Link>
      </div>
    );
  }
  if (published === undefined) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Cargando editor…</p>;
  }

  return (
    <TripEditor
      tripId={tripId}
      initialTrip={initialTrip}
      publishedDocument={published}
      backHref={`/viajes/${tripId}`}
    />
  );
}
