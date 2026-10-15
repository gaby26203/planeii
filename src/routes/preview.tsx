import { createFileRoute } from "@tanstack/react-router";
import { TripPreview } from "@/components/editor/TripPreview";

export const Route = createFileRoute("/preview")({
  head: () => ({
    meta: [
      { title: "Vista previa del viaje | Planeii" },
      { name: "description", content: "Vista previa privada de la landing de un viaje." },
      { property: "og:title", content: "Vista previa del viaje | Planeii" },
      { property: "og:description", content: "Revisión visual de una landing de viaje antes de publicarla." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TripPreview,
});