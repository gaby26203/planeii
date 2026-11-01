import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { bookingHrefFor, fetchPublishedPage } from "@/lib/published-page";
import { ApplyFormView } from "@/components/trip/ApplyFormView";

export const Route = createFileRoute("/v/$slug_/reservar")({
  loader: async ({ params }) => {
    const data = await fetchPublishedPage(params.slug);
    if (!data) throw notFound();
    // Con el formulario en modo externo esta página no recibe solicitudes (la API responde 409).
    // Quien llega con un enlace viejo va al mismo destino que el botón Reservar de la landing.
    if (data.document.bookingForm?.mode !== "internal") {
      const href = bookingHrefFor(data.document, params.slug);
      if (/^https?:\/\//i.test(href ?? "")) throw redirect({ href, statusCode: 302 });
      throw redirect({ to: "/v/$slug", params: { slug: params.slug }, statusCode: 302 });
    }
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Solicitud no disponible" }, { name: "robots", content: "noindex" }] };
    const { trip } = loaderData.document;
    const title = `Solicita tu lugar · ${trip.title}`;
    const description = `Completa tu solicitud para ${trip.title} y te contactamos por WhatsApp.`;
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
