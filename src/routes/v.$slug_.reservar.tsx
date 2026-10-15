import { createFileRoute, notFound } from "@tanstack/react-router";
import { fetchPublishedPage } from "@/lib/published-page";
import { ApplyFormView } from "@/components/trip/ApplyFormView";

export const Route = createFileRoute("/v/$slug_/reservar")({
  loader: async ({ params }) => {
    const data = await fetchPublishedPage(params.slug);
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Solicitud no disponible" }, { name: "robots", content: "noindex" }] };
    const { trip } = loaderData.document;
    const title = `Solicitá tu lugar · ${trip.title}`;
    const description = `Completá tu solicitud para ${trip.title} y te contactamos por WhatsApp.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="trip-landing flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="eyebrow">Viaje no encontrado</p>
      <h1 className="font-serif text-4xl">Esta página no existe o fue retirada.</h1>
    </div>
  ),
  errorComponent: () => <div className="p-8 text-center">No se pudo cargar el formulario.</div>,
  component: ApplyPage,
});

function ApplyPage() {
  const { tripId, document } = Route.useLoaderData();
  const { slug } = Route.useParams();
  return <ApplyFormView document={document} slug={slug} tripId={tripId} />;
}
