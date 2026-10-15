import { useEffect, useState } from "react";
import { NEUTRAL_TRIP_DATA } from "@/data/neutral-trip";
import { TripLanding } from "@/components/trip/TripLanding";
import { ApplyFormView } from "@/components/trip/ApplyFormView";
import { createEditorDocument, editorThemeClass, editorThemeStyle, normalizeEditorDocument, type EditorDocument } from "@/lib/trip-editor";
import { loadPagePreviewSnapshot } from "@/lib/trip-page-store";

function localDraft(trip: string | null) {
  const storageKey = trip ? `planei-trip-editor-draft:${trip}` : "planei-trip-editor-draft";
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return createEditorDocument(NEUTRAL_TRIP_DATA);
    return normalizeEditorDocument(JSON.parse(stored) as EditorDocument, NEUTRAL_TRIP_DATA);
  } catch {
    return createEditorDocument(NEUTRAL_TRIP_DATA);
  }
}

export function TripPreview() {
  const [document, setDocument] = useState<EditorDocument | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editorPreview, setEditorPreview] = useState(false);
  const [view, setView] = useState<"landing" | "form" | "thanks">("landing");
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const trip = params.get("trip");
    const snapshot = params.get("snapshot");
    const embeddedEditor = params.get("mode") === "editor" && window.parent !== window;

    if (!embeddedEditor && trip && snapshot) {
      loadPagePreviewSnapshot(trip, snapshot)
        .then((stored) => {
          if (!cancelled) setDocument(stored ? normalizeEditorDocument(stored, NEUTRAL_TRIP_DATA) : null);
        })
        .catch(() => { if (!cancelled) setDocument(null); })
        .finally(() => { if (!cancelled) setLoaded(true); });
      return () => { cancelled = true; };
    }

    setDocument(localDraft(trip));
    setLoaded(true);
    if (!embeddedEditor) return () => { cancelled = true; };
    const receive = (event: MessageEvent<{ type?: string; document?: EditorDocument; editorPreview?: boolean; view?: "landing" | "form" | "thanks"; slug?: string | null }>) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data.type !== "trip-editor-preview" || !event.data.document) return;
      setDocument(event.data.document);
      setEditorPreview(event.data.editorPreview ?? true);
      setView(event.data.view ?? "landing");
      setPreviewSlug(event.data.slug ?? null);
    };
    window.addEventListener("message", receive);
    // Pedir el documento actual al editor: evita quedarse con el borrador local viejo si el primer mensaje se pierde.
    if (window.parent !== window) window.parent.postMessage({ type: "trip-editor-ready" }, window.location.origin);
    return () => {
      cancelled = true;
      window.removeEventListener("message", receive);
    };
  }, []);

  // En modo editor, el clic en un botón de acción no navega: abre su edición en el panel.
  // Se intercepta a nivel DOM (capture) porque el texto editable dentro del botón detiene la propagación de React.
  useEffect(() => {
    if (!editorPreview || view !== "landing") return;
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.("a.btn-primary, a.btn-ghost");
      if (!anchor) return;
      event.preventDefault();
      event.stopPropagation();
      const section = anchor.closest("[data-editor-section]")?.getAttribute("data-editor-section") ?? null;
      window.parent.postMessage({ type: "trip-editor-button-click", section, ctaId: anchor.getAttribute("data-cta-id"), href: anchor.getAttribute("href") }, window.location.origin);
    };
    window.document.addEventListener("click", onClick, true);
    return () => window.document.removeEventListener("click", onClick, true);
  }, [editorPreview, view]);

  if (!document) return <p className="p-6 text-center text-muted-foreground">{loaded ? "Esta vista previa ya no está disponible. Abrí Vista previa nuevamente desde el editor para ver tus cambios actuales." : "Cargando vista previa…"}</p>;

  if (view !== "landing") return <ApplyFormView document={document} slug="vista-previa" tripId="" mode="editor" inlineEditing={editorPreview} forceThanks={view === "thanks"} />;

  return (
    <div className={editorThemeClass(document.theme)} style={editorThemeStyle(document.theme)}>
      <TripLanding trip={document.trip} announcement={document.announcement} sectionOrder={document.sectionOrder} hiddenSections={document.hiddenSections} sectionStyles={document.sectionStyles} textStyles={document.textStyles} editorPreview={editorPreview} ctaDocument={document} slug={previewSlug} />
    </div>
  );
}