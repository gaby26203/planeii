import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TripLanding } from "@/components/trip/TripLanding";
import { editorThemeClass, editorThemeStyle } from "@/lib/trip-editor";
import { bookingHrefFor, fetchPublishedPage } from "@/lib/published-page";

export const Route = createFileRoute("/v/$slug")({
  loader: async ({ params }) => {
    const data = await fetchPublishedPage(params.slug);
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Viaje no encontrado" }, { name: "robots", content: "noindex" }] };
    const { trip } = loaderData.document;
    const title = `${trip.destination} · ${trip.brand}`;
    const heroSrc = trip.heroImage?.src ?? "";
    const ogImage = heroSrc.startsWith("http")
      ? heroSrc
      : heroSrc.startsWith("/")
        ? `https://planeii.lovable.app${heroSrc}`
        : "";
    return {
      meta: [
        { title },
        { name: "description", content: trip.subtitle },
        { property: "og:title", content: title },
        { property: "og:description", content: trip.subtitle },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(ogImage ? [{ property: "og:image", content: ogImage }, { name: "twitter:image", content: ogImage }] : []),
      ],
    };
  },
  notFoundComponent: TripNotFound,
  errorComponent: () => <div className="p-8 text-center">No se pudo cargar la página.</div>,
  component: PublishedTrip,
});

function TripNotFound() {
  return (
    <div className="trip-landing flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="eyebrow">Viaje no encontrado</p>
      <h1 className="font-serif text-4xl">Esta página no existe o fue retirada.</h1>
    </div>
  );
}

function PublishedTrip() {
  const { tripId, document } = Route.useLoaderData();
  const { slug } = Route.useParams();
  // Las UTMs de la visita viajan hasta el formulario (se leen tras hidratar).
  const [search, setSearch] = useState("");
  useEffect(() => {
    setSearch(window.location.search);
    const key = `planeii-ref-${slug}`;
    try {
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, window.document.referrer || "directo");
    } catch { /* almacenamiento no disponible */ }
  }, [slug]);
  const trip = { ...document.trip, bookingUrl: bookingHrefFor(document, slug, search) };
  return (
    <div className={editorThemeClass(document.theme)} style={editorThemeStyle(document.theme)}>
      <TripLanding trip={trip} announcement={document.announcement} sectionOrder={document.sectionOrder} hiddenSections={document.hiddenSections} sectionStyles={document.sectionStyles} textStyles={document.textStyles} trackingTripId={tripId} ctaDocument={document} slug={slug} search={search} />
    </div>
  );
}
