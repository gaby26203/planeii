import { PublishDialog } from "./PublishDialog";
import { BookingFormEditor } from "./BookingFormEditor";
import { defaultBookingForm, normalizeBookingForm, setBookingFormTextByPath } from "@/lib/booking-form";
import { ImageCropDialog } from "./ImageCropDialog";
import { MobileHeroPositionDialog } from "./MobileHeroPositionDialog";
import { TripContentEditor } from "./TripContentEditor";
import { AiCopyDialog } from "./AiCopyDialog";
import { PrePublishChecklist } from "./PrePublishChecklist";
import { CtaDestinationControls } from "./CtaDestinationControls";
import { CTA_DEFINITIONS, applyToBookingCtas, ctaWarnings } from "@/lib/cta-links";
import { PAGE_IMAGE_MAX_INPUT_BYTES, PAGE_IMAGE_TYPES, externalizeDocumentImages, hasEmbeddedImages, pageImageSizeLabel, uploadPageImage } from "@/lib/trip-page-images";
import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, ChartColumn, ChevronDown, ChevronUp, Eraser, Eye, Globe, GripVertical, History, ImagePlus, Italic, Laptop, Link2, Move, PanelLeftClose, PanelLeftOpen, Redo2, RotateCcw, Smartphone, Sparkles, Underline, Undo2, X } from "lucide-react";
import { normalizeInlineText, safeTextLink, type InlineText } from "@/lib/inline-text";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TripData } from "@/data/trip";
import { neutralTripFor } from "@/data/neutral-trip";
import { tripMetaItems, newMetaItem } from "@/lib/trip-meta";
import { itineraryGroupPlan, setItineraryGroupImage } from "@/lib/trip-itinerary";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createEditorDocument,
  DEFAULT_COLORS,
  normalizeEditorDocument,
  SECTION_LABELS,
  setTripByPath,
  type EditorDocument,
  type SectionKey,
  type TextAlign,
  type TextLeading,
  type TextRole,
  applyTextStyleCommit,
} from "@/lib/trip-editor";
import { clearPageDraft, createPagePreviewSnapshot, loadPageDraft, listPageVersions, savePageDraft, type PageVersion } from "@/lib/trip-page-store";

export const draftKey = (tripId: string) => `planei-trip-editor-draft:${tripId}`;
type Panel = "page" | "design" | "form" | "organization";

const MAX_HISTORY = 50;
const AUTOSAVE_DELAY = 1500;

function contrastRatio(first: string, second: string) {
  const luminance = (hex: string) => {
    const clean = hex.replace("#", "");
    if (clean.length !== 6) return 1;
    const channels = [0, 2, 4].map((index) => Number.parseInt(clean.slice(index, index + 2), 16) / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
  };
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function readDraft(key: string, fallback: () => EditorDocument): EditorDocument {
  if (typeof window === "undefined") return fallback();
  const saved = window.localStorage.getItem(key);
  if (!saved) return fallback();
  try {
    const fallbackDocument = fallback();
    return normalizeEditorDocument(JSON.parse(saved) as EditorDocument, fallbackDocument.trip);
  } catch {
    return fallback();
  }
}

function Field({ label, value, onChange, multiline = false, hint }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  hint?: string;
}) {
  const id = `field-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {multiline ? (
        <Textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} rows={4} />
      ) : (
        <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  );
}

function PanelTabs({ panel, onChange }: { panel: Panel; onChange: (panel: Panel) => void }) {
  const tabs: { key: Panel; label: string }[] = [
    { key: "page", label: "Página" },
    { key: "design", label: "Diseño" },
    { key: "form", label: "Formulario" },
    { key: "organization", label: "Organización" },
  ];
  return (
    <div className="grid grid-cols-4 gap-1 border-b bg-muted/40 p-2">
      {tabs.map((tab) => (
        <Button key={tab.key} type="button" size="sm" variant={panel === tab.key ? "default" : "ghost"} onClick={() => onChange(tab.key)}>
          {tab.label}
        </Button>
      ))}
    </div>
  );
}

function SortableSectionRow({ id, label, visible, index, length, onToggle, onMove }: {
  id: string;
  label: string;
  visible: boolean;
  index: number;
  length: number;
  onToggle: (checked: boolean) => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.55 : undefined }} className="flex items-center gap-2 py-3">
      <button type="button" className="cursor-grab touch-none text-muted-foreground hover:text-foreground" aria-label={`Arrastrar ${label}`} {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <Switch checked={visible} onCheckedChange={onToggle} aria-label={`Mostrar ${label}`} />
      <span className="min-w-0 flex-1 text-sm">{label}</span>
      <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Subir ${label}`}><ChevronUp /></Button>
      <Button type="button" variant="ghost" size="icon" disabled={index === length - 1} onClick={() => onMove(1)} aria-label={`Bajar ${label}`}><ChevronDown /></Button>
    </div>
  );
}

export function TripEditor({ tripId, initialTrip, publishedDocument, backHref }: {
  tripId: string;
  initialTrip: Partial<TripData>;
  publishedDocument?: EditorDocument | null;
  backHref: string;
}) {
  const STORAGE_KEY = draftKey(tripId);
  const fresh = () => createEditorDocument(neutralTripFor(initialTrip));
  const [document, setDocument] = useState<EditorDocument>(fresh);
  const [hydrated, setHydrated] = useState(false);
  const [panel, setPanel] = useState<Panel>("page");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [panelOpen, setPanelOpen] = useState(true);
  const [formView, setFormView] = useState<"form" | "thanks">("form");
  const canvasView: "landing" | "form" | "thanks" = panel === "form" ? formView : "landing";
  const [showGuide, setShowGuide] = useState(() => typeof window === "undefined" || window.localStorage.getItem("planei-editor-guide-dismissed") !== "1");
  const [selectedTextPath, setSelectedTextPath] = useState<string | null>(null);
  const [inlineSelection, setInlineSelection] = useState({ hasSelection: false, bold: false, italic: false, underline: false, href: "" });
  const [imagesOpen, setImagesOpen] = useState(false);
  const [imageTarget, setImageTarget] = useState<string>("heroImage");
  const [publishOpen, setPublishOpen] = useState(false);
  const [liveSlug, setLiveSlug] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase.from("trip_pages").select("slug").eq("trip_id", tripId).maybeSingle().then(({ data }) => { if (!cancelled) setLiveSlug(data?.slug ?? null); }),
    );
    return () => { cancelled = true; };
  }, [tripId]);
  const [aiOpen, setAiOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [mobileHeroPositionOpen, setMobileHeroPositionOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<PageVersion[] | null>(null);
  const [openSections, setOpenSections] = useState<string[]>(["cover"]);
  const [focusField, setFocusField] = useState<string | null>(null);
  const [histVersion, setHistVersion] = useState(0);
  const [highlightSection, setHighlightSection] = useState<string | null>(null);
  const [openStyleSection, setOpenStyleSection] = useState<string | undefined>(undefined);
  const [highlightCta, setHighlightCta] = useState<string | null>(null);

  const announcementStatus = useMemo(() => {
    const announcement = document.announcement;
    if (!announcement.enabled) return "Inactivo";
    const now = Date.now();
    const start = announcement.startsAt ? new Date(announcement.startsAt).getTime() : null;
    const end = announcement.endsAt ? new Date(announcement.endsAt).getTime() : null;
    if (start !== null && Number.isFinite(start) && now < start) return "Programado";
    if (end !== null && Number.isFinite(end) && now >= end) return "Finalizado";
    return "Activo";
  }, [document.announcement]);

  useEffect(() => {
    if (!highlightSection) return;
    const timer = window.setTimeout(() => setHighlightSection(null), 2400);
    return () => window.clearTimeout(timer);
  }, [highlightSection]);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docRef = useRef(document);
  const undoStack = useRef<EditorDocument[]>([]);
  const redoStack = useRef<EditorDocument[]>([]);

  // ============= Carga inicial: borrador del backend > publicado > localStorage =============
  useEffect(() => {
    let cancelled = false;
    const fallback = () => (publishedDocument ? normalizeEditorDocument(publishedDocument, fresh().trip) : readDraft(STORAGE_KEY, fresh));
    loadPageDraft(tripId)
      .then((draft) => {
        if (cancelled) return;
        setDocument(draft ? normalizeEditorDocument(draft, fresh().trip) : fallback());
      })
      .catch(() => { if (!cancelled) setDocument(fallback()); })
      .finally(() => { if (!cancelled) setHydrated(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mantener docRef sincronizado con el documento visible (incluye la carga inicial,
  // que no pasa por mutate): el autoguardado escribe docRef y nunca debe guardar la plantilla vacía.
  useEffect(() => { docRef.current = document; }, [document]);

  // ============= Deshacer / rehacer del documento completo =============
  const mutate = useCallback((updater: (current: EditorDocument) => EditorDocument) => {
    const current = docRef.current;
    const next = updater(current);
    if (next === current) return;
    undoStack.current.push(current);
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
    docRef.current = next;
    setDocument(next);
    setHistVersion((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(docRef.current);
    docRef.current = prev;
    setDocument(prev);
    setHistVersion((v) => v + 1);
  }, []);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(docRef.current);
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    docRef.current = next;
    setDocument(next);
    setHistVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      const el = window.document.activeElement;
      if (el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      event.preventDefault();
      if (key === "y" || event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // ============= Autoguardado: localStorage + backend (respaldo en la nube) =============
  useEffect(() => {
    if (!hydrated) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(docRef.current)); }
      catch { /* Cloud autosave must continue if the local backup is full. */ }
      savePageDraft(tripId, docRef.current)
        .then(() => setSaveState("saved"))
        .catch((error) => { console.error("No se pudo guardar el borrador en el servidor", error); setSaveState("error"); });
    }, AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [document, hydrated, tripId, STORAGE_KEY]);

  useEffect(() => {
    if (saveState === "saved") return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveState]);

  useEffect(() => {
    if (!hydrated) return;
    previewRef.current?.contentWindow?.postMessage({ type: "trip-editor-preview", document, editorPreview: device !== "mobile", view: canvasView, slug: liveSlug }, window.location.origin);
  }, [document, hydrated, device, canvasView, liveSlug]);

  // ============= Mensajes de la vista previa: imágenes y textos =============
  useEffect(() => {
    const receive = (event: MessageEvent<{ type?: string; imageKey?: string; path?: string; styleKey?: string; value?: string; inline?: InlineText; hasSelection?: boolean; marks?: { bold: boolean; italic: boolean; underline: boolean; href: string }; id?: string; section?: string | null; ctaId?: string | null }>) => {
      if (event.origin !== window.location.origin || event.source !== previewRef.current?.contentWindow) return;
      if (event.data.type === "trip-editor-ready") {
        previewRef.current?.contentWindow?.postMessage({ type: "trip-editor-preview", document: docRef.current, editorPreview: device !== "mobile", view: canvasView, slug: liveSlug }, window.location.origin);
        return;
      }
      if (event.data.type === "trip-editor-image-click" && event.data.imageKey) {
        setImageTarget(event.data.imageKey);
        imageInputRef.current?.click();
      }
      if (device !== "mobile" && event.data.type === "trip-editor-meta-add") {
        mutate((current) => ({ ...current, trip: { ...current.trip, metaItems: [...tripMetaItems(current.trip), newMetaItem()] } }));
      }
      if (device !== "mobile" && event.data.type === "trip-editor-meta-remove" && event.data.id) {
        const id = event.data.id;
        mutate((current) => ({ ...current, trip: { ...current.trip, metaItems: tripMetaItems(current.trip).filter((item) => item.id !== id) } }));
      }
      if (device !== "mobile" && event.data.type === "trip-editor-text-commit" && event.data.path && typeof event.data.value === "string") {
        const { path, value, inline } = event.data;
        const styleKey = typeof event.data.styleKey === "string" && event.data.styleKey ? event.data.styleKey : path;
        const update = (current: EditorDocument): EditorDocument => applyTextStyleCommit(current, styleKey, inline, value);
        if (path.startsWith("bookingForm.")) {
          mutate((current) => update({ ...current, bookingForm: setBookingFormTextByPath(current.bookingForm ?? defaultBookingForm(current.trip.title), path, value) }));
        } else if (path.startsWith("ctaLinks.") && path.endsWith(".label")) {
          const ctaId = path.slice("ctaLinks.".length, -".label".length);
          mutate((current) => update({ ...current, ctaLinks: { ...current.ctaLinks, [ctaId]: { ...current.ctaLinks?.[ctaId], label: value } } }));
        } else if (path === "announcement.message" || path === "announcement.mobileMessage" || path === "announcement.buttonLabel") {
          const key = path.split(".")[1] as "message" | "mobileMessage" | "buttonLabel";
          mutate((current) => update({ ...current, announcement: { ...current.announcement, [key]: value } }));
        } else {
          mutate((current) => update({ ...current, trip: setTripByPath(current.trip, path, value) }));
        }
      }
      if (event.data.type === "trip-editor-text-select" && event.data.path) {
        setSelectedTextPath(event.data.path);
        setInlineSelection({ hasSelection: event.data.hasSelection ?? false, bold: false, italic: false, underline: false, href: "", ...event.data.marks });
      }
      if (event.data.type === "trip-editor-button-click") {
        const section = typeof event.data.section === "string" && event.data.section ? event.data.section : "hero";
        setPanelOpen(true);
        setPanel("design");
        setHighlightSection(section);
        setOpenStyleSection(section);
        const ctaId = typeof event.data.ctaId === "string" ? event.data.ctaId : null;
        setHighlightCta(ctaId);
        window.setTimeout(() => window.document.getElementById(ctaId ? `cta-controls-${ctaId}` : `section-style-${section}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [device, canvasView]);

  const canUndo = histVersion >= 0 && undoStack.current.length > 0;
  const canRedo = histVersion >= 0 && redoStack.current.length > 0;

  const updateTrip = (update: Partial<TripData>) => mutate((current) => ({
    ...current,
    trip: { ...current.trip, ...update },
  }));

  const requiredFieldChecks = useMemo(() => [
    { label: "Marca", value: document.trip.brand, fieldId: "landing-marca" },
    { label: "Precio", value: document.trip.price, fieldId: "landing-precio" },
    { label: "Fechas", value: document.trip.dates, fieldId: "landing-fechas" },
  ], [document.trip]);
  const pageCtaWarnings = ctaWarnings(document, liveSlug);
  const missingFields = requiredFieldChecks.filter((field) => !field.value || field.value.includes("["));
  const globalColorWarning = document.theme.customColors && (
    contrastRatio(document.theme.customColors.background, document.theme.customColors.text) < 4.5 ||
    contrastRatio(document.theme.customColors.background, document.theme.customColors.heading) < 3
  );
  const sectionColorWarning = Object.values(document.sectionStyles).some((style) => {
    if (!style?.background) return false;
    return (style.text ? contrastRatio(style.background, style.text) < 4.5 : false) || (style.heading ? contrastRatio(style.background, style.heading) < 3 : false);
  });
  const colorWarning = globalColorWarning || sectionColorWarning;

  const sectionSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const onSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    mutate((current) => {
      const from = current.sectionOrder.indexOf(active.id as SectionKey);
      const to = current.sectionOrder.indexOf(over.id as SectionKey);
      if (from < 0 || to < 0) return current;
      return { ...current, sectionOrder: arrayMove(current.sectionOrder, from, to) };
    });
  };

  const toggleSection = (key: SectionKey, checked: boolean) => mutate((current) => ({
    ...current,
    hiddenSections: checked
      ? current.hiddenSections.filter((item) => item !== key)
      : [...current.hiddenSections, key],
  }));

  const moveSection = (key: SectionKey, direction: -1 | 1) => {
    mutate((current) => {
      const order = [...current.sectionOrder];
      const index = order.indexOf(key);
      const destination = index + direction;
      if (destination < 0 || destination >= order.length) return current;
      const currentItem = order[index];
      const destinationItem = order[destination];
      if (!currentItem || !destinationItem) return current;
      order[index] = destinationItem;
      order[destination] = currentItem;
      return { ...current, sectionOrder: order };
    });
  };

  const replaceImage = (file?: File) => {
    if (!file) return;
    if (!PAGE_IMAGE_TYPES.includes(file.type)) {
      toast.error("Ese archivo no es una foto. Usá JPG, PNG o WebP.");
      return;
    }
    if (file.size > PAGE_IMAGE_MAX_INPUT_BYTES) {
      toast.error(`Esa foto pesa ${pageImageSizeLabel(file.size)} y es demasiado grande. Elegí otra de hasta 25 MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setCropSource(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const embeddedFixRef = useRef(false);
  useEffect(() => {
    if (embeddedFixRef.current || !hasEmbeddedImages(document)) return;
    embeddedFixRef.current = true;
    externalizeDocumentImages(tripId, document)
      .then((converted) => mutate(() => converted))
      .catch((error) => { embeddedFixRef.current = false; console.error("No se pudieron convertir las fotos", error); });
  }, [document, tripId]);

  const applyCroppedImage = async (cropped: Blob) => {
    let imageSource = "";
    try {
      imageSource = await uploadPageImage(tripId, cropped);
    } catch (error) {
      console.error("No se pudo subir la foto", error);
      toast.error("No se pudo subir la foto. Revisá tu conexión e intentá nuevamente.");
      return;
    }
    if (imageTarget.startsWith("itinerary-group-")) {
      const index = Number(imageTarget.split("-")[2]);
      mutate((current) => ({ ...current, trip: setItineraryGroupImage(current.trip, index, imageSource) }));
      setCropSource(null);
      return;
    }
    mutate((current) => {
      const trip = { ...current.trip };
      if (imageTarget === "story") trip.story = { ...trip.story, image: { ...trip.story.image, src: imageSource } };
      else if (imageTarget.startsWith("host-")) {
        const index = Number(imageTarget.split("-")[1]);
        trip.hosts = trip.hosts.map((item, i) => i === index ? { ...item, image: { ...item.image, src: imageSource } } : item);
        trip.host = trip.hosts[0] ?? trip.host;
      }
      else if (imageTarget.startsWith("highlight-")) {
        const index = Number(imageTarget.split("-")[1]);
        trip.highlights = trip.highlights.map((item, i) => i === index ? { ...item, image: { ...item.image, src: imageSource } } : item);
      }
      else if (imageTarget.startsWith("accommodation-")) {
        const index = Number(imageTarget.split("-")[1]);
        trip.accommodations = trip.accommodations.map((item, i) => i === index ? { ...item, image: { ...item.image, src: imageSource } } : item);
      }
      else if (imageTarget.startsWith("gallery-")) {
        const index = Number(imageTarget.split("-")[1]);
        trip.gallery = trip.gallery.map((item, i) => (i === index ? { ...item, src: imageSource } : item));
      } else {
        const key = imageTarget as "heroImage" | "finalImage";
        trip[key] = { ...trip[key], src: imageSource };
      }
      return { ...current, trip };
    });
    setCropSource(null);
  };

  const cropAspect = imageTarget === "heroImage" || imageTarget === "finalImage" ? 16 / 9 : imageTarget.startsWith("host-") || imageTarget.startsWith("highlight-") ? 4 / 5 : imageTarget.startsWith("itinerary-group-") ? (Number(imageTarget.split("-")[2]) % 2 === 0 ? 4 / 5 : 4 / 3) : 4 / 3;

  const chooseImage = (key: string) => {
    setImageTarget(key);
    imageInputRef.current?.click();
  };

  const openHistory = () => {
    setVersions(null);
    setHistoryOpen(true);
    listPageVersions(tripId).then(setVersions).catch(() => setVersions([]));
  };

  const discardChanges = () => {
    if (!window.confirm("¿Descartar los cambios sin publicar y volver a la última versión publicada?")) return;
    const base = publishedDocument ? normalizeEditorDocument(publishedDocument, fresh().trip) : fresh();
    undoStack.current = [];
    redoStack.current = [];
    docRef.current = base;
    setDocument(base);
    setHistVersion((v) => v + 1);
    window.localStorage.removeItem(STORAGE_KEY);
    clearPageDraft(tripId).catch(() => {});
    setSaveState("saved");
  };

  const reset = () => {
    if (!window.confirm("¿Restaurar la plantilla original? Se pierden los cambios sin publicar.")) return;
    mutate(() => fresh());
    window.localStorage.removeItem(STORAGE_KEY);
    clearPageDraft(tripId).catch(() => {});
  };

  const saveNow = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(docRef.current));
    setSaveState("saving");
    savePageDraft(tripId, docRef.current)
      .then(() => setSaveState("saved"))
      .catch((error) => { console.error("No se pudo guardar el borrador en el servidor", error); setSaveState("error"); });
  };

  const updateTextStyle = (patch: Record<string, unknown>) => {
    if (!selectedTextPath) return;
    mutate((current) => ({
      ...current,
      textStyles: { ...current.textStyles, [selectedTextPath]: { ...current.textStyles[selectedTextPath], ...patch } },
    }));
  };

  const formatSelection = (command: string, href?: string) => {
    if (!selectedTextPath || !inlineSelection.hasSelection) return;
    previewRef.current?.contentWindow?.postMessage({ type: "trip-editor-inline-format", path: selectedTextPath, command, href }, window.location.origin);
  };

  const resetTextStyle = () => {
    if (!selectedTextPath) return;
    mutate((current) => {
      const textStyles = { ...current.textStyles };
      delete textStyles[selectedTextPath];
      return { ...current, textStyles };
    });
  };

  const imageItems = useMemo(() => {
    const t = document.trip;
    return [
      { key: "heroImage", label: "Portada", src: t.heroImage.src },
      { key: "story", label: "Historia", src: t.story.image.src },
      ...t.highlights.map((item, i) => ({ key: `highlight-${i}`, label: `Experiencia ${i + 1}`, src: item.image.src })),
      ...t.hosts.map((item, i) => ({ key: `host-${i}`, label: `Anfitrión ${i + 1}`, src: item.image.src })),
      ...t.accommodations.map((item, i) => ({ key: `accommodation-${i}`, label: `Alojamiento ${i + 1}`, src: item.image.src })),
      ...t.gallery.map((item, i) => ({ key: `gallery-${i}`, label: `Galería ${i + 1}`, src: item.src })),
      ...itineraryGroupPlan(t).map((group, i) => ({ key: `itinerary-group-${i}`, label: `Itinerario ${i + 1}`, src: group.image.src })),
      { key: "finalImage", label: "Cierre", src: t.finalImage.src },
    ];
  }, [document.trip]);

  return (
    <div className="editor-shell fixed inset-0 z-50 flex flex-col overflow-hidden bg-muted text-foreground">
      <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b bg-background px-3 py-2 md:px-5">
        <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { replaceImage(event.target.files?.[0]); event.target.value = ""; }} />
        <div className="flex min-w-0 items-center gap-3">
          <a href={backHref} className="text-sm font-semibold">← Volver al viaje</a>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{document.trip.destination}</p>
            <p className={`text-[11px] ${saveState === "error" ? "text-destructive" : "text-muted-foreground"}`}>{saveState === "saved" ? "Guardado automáticamente" : saveState === "saving" ? "Guardando…" : "Error al guardar"}</p>
          </div>
        </div>
        <div className="flex max-w-full items-center gap-1 overflow-x-auto pb-0.5">
          <Button type="button" variant="ghost" size="icon" onClick={() => setPanelOpen((value) => !value)} aria-label={panelOpen ? "Ocultar panel" : "Mostrar panel"} title={panelOpen ? "Ocultar panel" : "Mostrar panel"}>{panelOpen ? <PanelLeftClose /> : <PanelLeftOpen />}</Button>
          <div className="flex items-center rounded-md border p-0.5" role="group" aria-label="Dispositivo de vista previa">
            <Button type="button" variant={device === "desktop" ? "secondary" : "ghost"} size="icon" onClick={() => setDevice("desktop")} aria-label="Vista de computadora" aria-pressed={device === "desktop"} title="Vista de computadora"><Laptop /></Button>
            <Button type="button" variant={device === "mobile" ? "secondary" : "ghost"} size="icon" onClick={() => setDevice("mobile")} aria-label="Vista móvil" aria-pressed={device === "mobile"} title="Vista móvil"><Smartphone /></Button>
          </div>
          <Button type="button" variant="ghost" size="icon" disabled={!canUndo} onClick={undo} aria-label="Deshacer" title="Deshacer (Ctrl+Z)"><Undo2 /></Button>
          <Button type="button" variant="ghost" size="icon" disabled={!canRedo} onClick={redo} aria-label="Rehacer" title="Rehacer (Ctrl+Shift+Z)"><Redo2 /></Button>
          <Button type="button" variant="ghost" size="icon" onClick={openHistory} aria-label="Historial de versiones" title="Historial de versiones publicadas"><History /></Button>
          <Button type="button" variant="ghost" size="icon" onClick={discardChanges} aria-label="Descartar cambios" title="Volver a la última versión publicada"><Eraser /></Button>
          <Button type="button" variant="ghost" size="icon" onClick={reset} aria-label="Restaurar plantilla"><RotateCcw /></Button>
          <Button type="button" variant="outline" className="hidden sm:inline-flex" disabled={!hydrated} onClick={() => {
            const previewWindow = window.open("", "_blank");
            if (!previewWindow) {
              window.alert("El navegador bloqueó la nueva pestaña. Permití ventanas emergentes e intentá nuevamente.");
              return;
            }
            previewWindow.opener = null;
            previewWindow.document.title = "Preparando vista previa…";
            previewWindow.document.body.textContent = "Preparando vista previa…";
            createPagePreviewSnapshot(tripId, docRef.current)
              .then((snapshot) => previewWindow.location.replace(`/preview?trip=${tripId}&snapshot=${snapshot}`))
              .catch((error) => {
                console.error("No se pudo crear la vista previa", error);
                previewWindow.close();
                window.alert("No se pudo preparar la vista previa. Revisá tu conexión e intentá nuevamente.");
              });
          }}><Eye /> Vista previa</Button>
          <Button type="button" variant="outline" className="hidden sm:inline-flex" asChild><a href={`/viajes/${tripId}/metricas`}><ChartColumn /> Métricas</a></Button>
          {liveSlug && <a href={`/v/${liveSlug}`} target="_blank" rel="noreferrer" className="hidden text-xs text-muted-foreground underline-offset-2 hover:underline md:inline">Publicada · ver enlace</a>}
          <Button type="button" onClick={() => { saveNow(); if (liveSlug) setPublishOpen(true); else setChecklistOpen(true); }}><Globe /> {liveSlug ? "Actualizar" : "Publicar"}</Button>
        </div>
      </header>

      {selectedTextPath && device === "desktop" && (
        <div className="editor-formatbar shrink-0 border-b bg-background px-3 py-2">
          <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto">
            <span className="mr-2 max-w-36 truncate text-xs font-medium">Texto seleccionado</span>
            <Select value={document.textStyles[selectedTextPath]?.role ?? "inherit"} onValueChange={(role) => updateTextStyle({ role: role as TextRole })}>
              <SelectTrigger className="h-8 w-36 shrink-0"><SelectValue placeholder="Tamaño" /></SelectTrigger>
              <SelectContent><SelectItem value="inherit">Tamaño original</SelectItem><SelectItem value="label">Etiqueta</SelectItem><SelectItem value="body">Párrafo</SelectItem><SelectItem value="subtitle">Subtítulo</SelectItem><SelectItem value="sectionTitle">Título</SelectItem><SelectItem value="display">Destacado</SelectItem></SelectContent>
            </Select>
            <input type="color" value={document.textStyles[selectedTextPath]?.color ?? DEFAULT_COLORS.text} onChange={(event) => updateTextStyle({ color: event.target.value })} className="h-8 w-9 shrink-0 border bg-transparent p-1" aria-label="Color del texto" />
            <Button type="button" disabled={!inlineSelection.hasSelection} variant={inlineSelection.bold ? "secondary" : "ghost"} size="icon" onPointerDown={(e) => e.preventDefault()} onClick={() => formatSelection("bold")} aria-label="Negrita" title="Negrita en la selección"><Bold /></Button>
            <Button type="button" disabled={!inlineSelection.hasSelection} variant={inlineSelection.italic ? "secondary" : "ghost"} size="icon" onPointerDown={(e) => e.preventDefault()} onClick={() => formatSelection("italic")} aria-label="Cursiva" title="Cursiva en la selección"><Italic /></Button>
            <Button type="button" disabled={!inlineSelection.hasSelection} variant={inlineSelection.underline ? "secondary" : "ghost"} size="icon" onPointerDown={(e) => e.preventDefault()} onClick={() => formatSelection("underline")} aria-label="Subrayar" title="Subrayar selección"><Underline /></Button>
            {(["left", "center", "right"] as TextAlign[]).map((align) => <Button key={align} type="button" variant={document.textStyles[selectedTextPath]?.align === align ? "secondary" : "ghost"} size="icon" onClick={() => updateTextStyle({ align })} aria-label={`Alinear ${align}`}>{align === "left" ? <AlignLeft /> : align === "center" ? <AlignCenter /> : <AlignRight />}</Button>)}
            <Select value={document.textStyles[selectedTextPath]?.leading ?? "normal"} onValueChange={(leading) => updateTextStyle({ leading: leading as TextLeading })}>
              <SelectTrigger className="h-8 w-32 shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="compact">Interlineado compacto</SelectItem><SelectItem value="normal">Interlineado normal</SelectItem><SelectItem value="relaxed">Interlineado amplio</SelectItem></SelectContent>
            </Select>
            <Button type="button" disabled={!inlineSelection.hasSelection} variant={inlineSelection.href ? "secondary" : "ghost"} size="icon" onPointerDown={(e) => e.preventDefault()} onClick={() => { const href = window.prompt("Enlace de la selección (vacío para quitar)", inlineSelection.href); if (href === null) return; if (href && !safeTextLink(href)) { toast.error("Ingresá un enlace válido (https://, mailto: o tel:)."); return; } formatSelection("link", href); }} aria-label="Agregar enlace" title="Enlace en la selección"><Link2 /></Button>
            <Button type="button" disabled={!inlineSelection.hasSelection} variant="ghost" size="icon" onPointerDown={(e) => e.preventDefault()} onClick={() => formatSelection("clear")} aria-label="Quitar formato de selección" title="Quitar formato de selección"><Eraser /></Button>
            <Button type="button" variant="ghost" size="sm" onClick={resetTextStyle}>Restablecer</Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedTextPath(null)} aria-label="Cerrar formato"><X /></Button>
          </div>
        </div>
      )}
      {missingFields.length > 0 && <div className="shrink-0 border-b border-accent bg-accent/15 px-4 py-2 text-xs"><strong>{missingFields.length} datos pendientes:</strong> {missingFields.map((field) => field.label).join(", ")}</div>}
      <div className={`editor-workspace grid min-h-0 flex-1 ${panelOpen ? "editor-panel-open" : ""}`}>
        <aside className={`editor-sidebar z-10 min-h-0 flex-col border-r bg-background ${panelOpen && device !== "mobile" ? "flex" : "hidden"}`}>
          <PanelTabs panel={panel} onChange={setPanel} />
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {missingFields.length > 0 && (
              <div className="mb-5 border border-accent bg-accent/15 p-3 text-xs leading-relaxed">
                <p className="font-medium">Faltan {missingFields.length} datos esenciales antes de publicar:</p>
                <ul className="mt-2 space-y-1">
                  {missingFields.map((field) => (
                    <li key={field.fieldId}>
                      <button
                        type="button"
                        className="underline underline-offset-2 hover:opacity-80"
                        onClick={() => { setPanel("page"); setOpenSections((current) => current.includes("cover") ? current : [...current, "cover"]); setFocusField(field.fieldId); }}
                      >
                        {field.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {panel === "page" && (
              <>
                <Button type="button" variant="outline" className="mb-4 w-full" onClick={() => setAiOpen(true)}><Sparkles /> Generar textos con IA</Button>
                <AiCopyDialog open={aiOpen} onOpenChange={setAiOpen} trip={document.trip} onApply={(trip) => mutate((current) => ({ ...current, trip }))} />
                <TripContentEditor trip={document.trip} onChange={(trip) => mutate((current) => ({ ...current, trip }))} onChooseImage={chooseImage} openSections={openSections} onOpenSections={setOpenSections} focusField={focusField} />
                <div id="page-cta-buttons" className="mt-5 border-t pt-5">
                  <p className="text-sm font-semibold">Botones de la página</p>
                  <p className="mt-1 text-xs text-muted-foreground">Destino de cada botón. Es el mismo ajuste que en Diseño.</p>
                  {pageCtaWarnings.length > 0 && <ul className="mt-3 space-y-1 border border-destructive/40 p-2 text-[11px] text-destructive">{pageCtaWarnings.map((item) => <li key={item.ctaId}><strong>{item.label}:</strong> {item.message}</li>)}</ul>}
                  <label className="mt-3 block text-xs">Aplicar a todos los botones de reserva
                    <Select value="" onValueChange={(target) => mutate((current) => ({ ...current, ctaLinks: applyToBookingCtas(current.ctaLinks, target === "form" ? { target: "form" } : { target: "url", url: current.bookingForm?.externalUrl?.trim() || current.trip.bookingUrl }) }))}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue placeholder="Elegí un destino para todos" /></SelectTrigger>
                      <SelectContent><SelectItem value="form">Formulario interno</SelectItem><SelectItem value="url">URL (enlace de reserva actual)</SelectItem></SelectContent>
                    </Select>
                  </label>
                  {CTA_DEFINITIONS.map((item) => <CtaDestinationControls key={item.id} document={document} ctaId={item.id} label={item.label} slug={liveSlug} onChange={(link) => mutate((current) => ({ ...current, ctaLinks: { ...current.ctaLinks, [item.id]: link } }))} />)}
                </div>
                <div className="mt-5 border-t pt-5">
                  <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Anuncio fijo</p><p className="mt-1 text-xs text-muted-foreground">Promoción visible al recorrer la página.</p></div><Switch checked={document.announcement.enabled} onCheckedChange={(enabled) => mutate((current) => ({ ...current, announcement: { ...current.announcement, enabled } }))} aria-label="Mostrar anuncio" /></div>
                  <div className="mb-4 inline-flex border px-2 py-1 text-xs font-medium">{announcementStatus}</div>
                  <div className="space-y-4">
                    <Field label="Texto promocional" value={document.announcement.message} multiline onChange={(message) => mutate((current) => ({ ...current, announcement: { ...current.announcement, message } }))} />
                    <Field label="Texto breve para móvil" value={document.announcement.mobileMessage ?? ""} multiline onChange={(mobileMessage) => mutate((current) => ({ ...current, announcement: { ...current.announcement, mobileMessage: mobileMessage || undefined } }))} />
                    <Field label="Texto del botón" value={document.announcement.buttonLabel} onChange={(buttonLabel) => mutate((current) => ({ ...current, announcement: { ...current.announcement, buttonLabel } }))} />
                    <CtaDestinationControls document={document} ctaId="announcement" label="Destino del botón del anuncio" slug={liveSlug} onChange={(link) => mutate((current) => ({ ...current, ctaLinks: { ...current.ctaLinks, announcement: link } }))} />
                    <div className="border-y py-4">
                      <p className="mb-3 text-sm font-semibold">Colores del anuncio</p>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          { role: "background", label: "Fondo de la barra", fallback: DEFAULT_COLORS.background },
                          { role: "text", label: "Texto de la barra", fallback: DEFAULT_COLORS.text },
                          { role: "buttonBackground", label: "Fondo del botón", fallback: DEFAULT_COLORS.button },
                          { role: "buttonText", label: "Texto del botón", fallback: DEFAULT_COLORS.background },
                        ] as const).map(({ role, label, fallback }) => (
                          <label key={role} className="space-y-1 text-xs">
                            <span>{label}</span>
                            <input type="color" aria-label={label} value={document.sectionStyles.announcement?.[role] ?? fallback}
                              onChange={(event) => mutate((current) => ({ ...current, sectionStyles: { ...current.sectionStyles, announcement: { ...current.sectionStyles.announcement, [role]: event.target.value } } }))}
                              className="h-9 w-full border bg-transparent p-1" />
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2"><Label htmlFor="announcement-start">Inicio opcional</Label><Input id="announcement-start" type="datetime-local" value={document.announcement.startsAt ?? ""} onChange={(event) => mutate((current) => ({ ...current, announcement: { ...current.announcement, startsAt: event.target.value || undefined } }))} /></div>
                    <div className="space-y-2"><Label htmlFor="announcement-end">Finalización opcional</Label><Input id="announcement-end" type="datetime-local" value={document.announcement.endsAt ?? ""} onChange={(event) => mutate((current) => ({ ...current, announcement: { ...current.announcement, endsAt: event.target.value || undefined } }))} /></div>
                    <div className="flex items-center justify-between gap-3"><Label htmlFor="announcement-countdown">Mostrar cuenta regresiva</Label><Switch id="announcement-countdown" checked={document.announcement.showCountdown} onCheckedChange={(showCountdown) => mutate((current) => ({ ...current, announcement: { ...current.announcement, showCountdown } }))} /></div>
                  </div>
                </div>
              </>
            )}

            {panel === "design" && (
              <div className="space-y-6">
                <div><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Imágenes</p><p className="mt-1 text-xs text-muted-foreground">Elegí una miniatura para reemplazar y reencuadrar la imagen. Cada foto se ajusta sola a ~450 KB.</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setImagesOpen((value) => !value)} aria-label={imagesOpen ? "Ocultar imágenes" : "Mostrar imágenes"}><ImagePlus /></Button></div>{imagesOpen && <div className="mt-4 grid grid-cols-2 gap-3">{imageItems.map((item) => <button key={item.key} type="button" onClick={() => chooseImage(item.key)} className="group overflow-hidden border bg-muted text-left"><img src={item.src} alt="" className="aspect-[4/3] w-full object-cover transition-opacity group-hover:opacity-80" /><span className="block truncate p-2 text-xs font-medium">{item.label}</span></button>)}</div>}</div>
                <div><p className="text-sm font-semibold">Identidad visual</p><p className="mt-1 text-xs text-muted-foreground">Combinaciones cuidadas para mantener contraste y legibilidad.</p></div>
                <div className="space-y-2"><Label>Paleta</Label><Select value={document.theme.palette} onValueChange={(palette) => mutate((current) => ({ ...current, theme: { ...current.theme, palette: palette as typeof current.theme.palette } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="oaxaca">Oaxaca cálido</SelectItem><SelectItem value="pacific">Pacífico sereno</SelectItem><SelectItem value="botanical">Botánico</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Tipografías</Label><Select value={document.theme.fonts} onValueChange={(fonts) => mutate((current) => ({ ...current, theme: { ...current.theme, fonts: fonts as typeof current.theme.fonts } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="editorial">Editorial</SelectItem><SelectItem value="modern">Moderna</SelectItem><SelectItem value="classic">Clásica</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Escala de texto</Label><Select value={document.theme.scale} onValueChange={(scale) => mutate((current) => ({ ...current, theme: { ...current.theme, scale: scale as typeof current.theme.scale } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="compact">Compacta</SelectItem><SelectItem value="balanced">Equilibrada</SelectItem><SelectItem value="editorial">Editorial</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Botones de acción</Label><Select value={document.theme.buttons} onValueChange={(buttons) => mutate((current) => ({ ...current, theme: { ...current.theme, buttons: buttons as typeof current.theme.buttons } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="solid">Sólidos</SelectItem><SelectItem value="outline">Contorno</SelectItem><SelectItem value="quiet">Discretos</SelectItem></SelectContent></Select></div>
                <div className="border-t pt-5"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Colores generales</p><Button type="button" variant="ghost" size="sm" onClick={() => mutate((current) => ({ ...current, theme: { ...current.theme, customColors: undefined } }))}>Restaurar paleta</Button></div><div className="mt-4 grid grid-cols-2 gap-3">{(["background", "heading", "text", "muted", "accent", "button"] as const).map((key) => <label key={key} className="space-y-1 text-xs capitalize"><span>{key}</span><div className="flex gap-2"><input type="color" value={document.theme.customColors?.[key] ?? DEFAULT_COLORS[key]} onChange={(e) => mutate((current) => ({ ...current, theme: { ...current.theme, customColors: { ...DEFAULT_COLORS, ...current.theme.customColors, [key]: e.target.value } } }))} className="h-9 w-10 border bg-transparent p-1" /><Input value={document.theme.customColors?.[key] ?? DEFAULT_COLORS[key]} onChange={(e) => mutate((current) => ({ ...current, theme: { ...current.theme, customColors: { ...DEFAULT_COLORS, ...current.theme.customColors, [key]: e.target.value } } }))} /></div></label>)}</div></div>
                {colorWarning && <div className="border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">El contraste entre fondo y texto es bajo. Ajusta los colores o restaura la paleta para mantener la lectura clara.</div>}
                <div className="border-t pt-5"><p className="text-sm font-semibold">Estilo por sección</p><Accordion type="single" collapsible className="mt-4" value={openStyleSection} onValueChange={(value) => setOpenStyleSection(value || undefined)}>{(["hero", "meta", "story", "highlights", "included", "itinerary", "accommodation", "host", "traveler", "testimonials", "faq", "booking", "gallery", "final", "announcement"] as const).map((key) => <AccordionItem key={key} value={key} id={`section-style-${key}`} className={`mb-2 border px-3 transition-shadow ${highlightSection === key ? "ring-2 ring-primary" : ""}`}><AccordionTrigger className="py-3 text-xs font-semibold capitalize hover:no-underline">{key === "meta" ? "Datos del viaje · Duración, grupo, fechas, precio y lugares" : key === "announcement" ? "Anuncio fijo" : SECTION_LABELS[key as SectionKey] ?? key}</AccordionTrigger><AccordionContent className="pb-4 pt-0"><div className="grid grid-cols-4 gap-2">{(["background", "heading", "text", "accent"] as const).map((role) => <label key={role} className="text-[10px] capitalize">{key === "meta" ? { background: "Fondo", heading: "Etiquetas", text: "Texto", accent: "Acento" }[role] : role === "accent" ? (key === "highlights" ? "Números" : "Acento") : role}<input type="color" value={document.sectionStyles[key]?.[role] ?? DEFAULT_COLORS[role]} onChange={(e) => mutate((current) => ({ ...current, sectionStyles: { ...current.sectionStyles, [key]: { ...current.sectionStyles[key], [role]: e.target.value } } }))} className="mt-1 h-8 w-full border bg-transparent p-1" /></label>)}</div><div className="mt-3 grid grid-cols-2 gap-2"><Select value={document.sectionStyles[key]?.spacing ?? "normal"} onValueChange={(spacing) => mutate((current) => ({ ...current, sectionStyles: { ...current.sectionStyles, [key]: { ...current.sectionStyles[key], spacing: spacing as "compact" | "normal" | "spacious" } } }))}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="compact">Compacta</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="spacious">Amplia</SelectItem></SelectContent></Select><Select value={document.sectionStyles[key]?.align ?? "inherit"} onValueChange={(align) => mutate((current) => ({ ...current, sectionStyles: { ...current.sectionStyles, [key]: { ...current.sectionStyles[key], align: align as "inherit" | "left" | "center" } } }))}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inherit">Alineación original</SelectItem><SelectItem value="left">Izquierda</SelectItem><SelectItem value="center">Centro</SelectItem></SelectContent></Select></div><div className="mt-3 border-t pt-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Botones</p><div className="grid grid-cols-2 gap-2"><label className="text-[10px]">Color del botón<input type="color" value={document.sectionStyles[key]?.buttonBackground ?? "#b5532f"} onChange={(e) => mutate((current) => ({ ...current, sectionStyles: { ...current.sectionStyles, [key]: { ...current.sectionStyles[key], buttonBackground: e.target.value } } }))} className="mt-1 h-8 w-full border bg-transparent p-1" /></label><label className="text-[10px]">Color del texto<input type="color" value={document.sectionStyles[key]?.buttonText ?? "#ffffff"} onChange={(e) => mutate((current) => ({ ...current, sectionStyles: { ...current.sectionStyles, [key]: { ...current.sectionStyles[key], buttonText: e.target.value } } }))} className="mt-1 h-8 w-full border bg-transparent p-1" /></label><Select value={document.sectionStyles[key]?.buttonVariant ?? "solid"} onValueChange={(buttonVariant) => mutate((current) => ({ ...current, sectionStyles: { ...current.sectionStyles, [key]: { ...current.sectionStyles[key], buttonVariant: buttonVariant as "solid" | "outline" | "text" } } }))}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="solid">Relleno</SelectItem><SelectItem value="outline">Solo borde</SelectItem><SelectItem value="text">Texto subrayado</SelectItem></SelectContent></Select><Select value={document.sectionStyles[key]?.buttonShape ?? "square"} onValueChange={(buttonShape) => mutate((current) => ({ ...current, sectionStyles: { ...current.sectionStyles, [key]: { ...current.sectionStyles[key], buttonShape: buttonShape as "square" | "rounded" | "pill" } } }))}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="square">Esquinas rectas</SelectItem><SelectItem value="rounded">Redondeado</SelectItem><SelectItem value="pill">Píldora</SelectItem></SelectContent></Select></div>{CTA_DEFINITIONS.filter((item) => item.group === key).map((item) => <CtaDestinationControls key={item.id} document={document} ctaId={item.id} label={item.label} slug={liveSlug} highlighted={highlightCta === item.id} allowStyle={item.id === "heroItinerary"} onChange={(link) => mutate((current) => ({ ...current, ctaLinks: { ...current.ctaLinks, [item.id]: link } }))} />)}<Button type="button" variant="ghost" size="sm" className="mt-1 h-7 text-xs" onClick={() => mutate((current) => { const style = { ...current.sectionStyles[key] }; delete style.buttonBackground; delete style.buttonText; delete style.buttonVariant; delete style.buttonShape; return { ...current, sectionStyles: { ...current.sectionStyles, [key]: style } }; })}>Botones originales</Button></div><Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => mutate((current) => { const sectionStyles = { ...current.sectionStyles }; delete sectionStyles[key]; return { ...current, sectionStyles }; })}>Restablecer sección</Button></AccordionContent></AccordionItem>)}</Accordion></div>
              </div>
            )}

            {panel === "form" && (
              <BookingFormEditor
                form={normalizeBookingForm(document.bookingForm, document.trip.title)}
                publicUrl={liveSlug ? `/v/${liveSlug}/reservar` : undefined}
                onChange={(fn) => mutate((current) => ({ ...current, bookingForm: fn(normalizeBookingForm(current.bookingForm, current.trip.title)) }))}
              />
            )}

            {panel === "organization" && (
              <div className="space-y-4">
                <div><p className="text-sm font-semibold">Orden y visibilidad</p><p className="mt-1 text-xs text-muted-foreground">Arrastra para reordenar. La portada y el cierre permanecen siempre visibles.</p></div>
                <div className="flex items-center gap-3 border-y py-3 text-sm"><span className="h-2 w-2 bg-primary" /><span className="flex-1">Portada</span><span className="text-xs text-muted-foreground">Obligatoria</span></div>
                <DndContext sensors={sectionSensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
                  <SortableContext items={document.sectionOrder} strategy={verticalListSortingStrategy}>
                    <div className="divide-y border-y">
                      {document.sectionOrder.map((key, index) => (
                        <SortableSectionRow
                          key={key}
                          id={key}
                          label={SECTION_LABELS[key]}
                          visible={!document.hiddenSections.includes(key)}
                          index={index}
                          length={document.sectionOrder.length}
                          onToggle={(checked) => toggleSection(key, checked)}
                          onMove={(direction) => moveSection(key, direction)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <div className="flex items-center gap-3 border-y py-3 text-sm"><span className="h-2 w-2 bg-primary" /><span className="flex-1">Cierre final</span><span className="text-xs text-muted-foreground">Obligatorio</span></div>
              </div>
            )}
          </div>
        </aside>

        <section className="editor-canvas relative min-h-0 min-w-0 overflow-auto p-3 md:p-7" aria-label="Vista previa de la landing">
          {showGuide && device === "desktop" && <div className="mx-auto mb-3 grid max-w-xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border bg-background px-3 py-2 text-xs shadow-sm"><span>Tocá cualquier texto o imagen para editarla directamente.</span><Button type="button" variant="ghost" size="icon" onClick={() => { window.localStorage.setItem("planei-editor-guide-dismissed", "1"); setShowGuide(false); }} aria-label="Cerrar guía"><X /></Button></div>}
          {device === "mobile" && <div className="mx-auto mb-3 grid max-w-[406px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-xs text-muted-foreground"><span className="inline-flex min-w-0 items-center gap-2"><Smartphone className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Teléfono · 390 px</span></span><Button type="button" variant="outline" size="sm" onClick={() => setMobileHeroPositionOpen(true)}><Move /> Ajustar portada móvil</Button></div>}
          {panel === "form" && (
            <div className="mx-auto mb-3 flex max-w-xl flex-wrap items-center justify-center gap-2 text-xs">
              <Button type="button" size="sm" variant={formView === "form" ? "default" : "outline"} onClick={() => setFormView("form")}>Formulario</Button>
              <Button type="button" size="sm" variant={formView === "thanks" ? "default" : "outline"} onClick={() => setFormView("thanks")}>Página de gracias</Button>
              {document.bookingForm?.mode !== "internal" && (
                <span className="inline-flex items-center gap-2 border bg-background px-3 py-1.5">El botón Reservar usa un enlace externo.
                  <Button type="button" size="sm" variant="link" className="h-auto p-0" onClick={() => mutate((current) => ({ ...current, bookingForm: { ...(current.bookingForm ?? defaultBookingForm(current.trip.title)), mode: "internal" } }))}>Usar formulario de Planeii</Button>
                </span>
              )}
            </div>
          )}
          <div className={device === "mobile" ? "editor-phone mx-auto rounded-[28px] border-8 border-foreground bg-background shadow-xl" : ""}>
          <iframe
            ref={previewRef}
            src={`/preview?trip=${tripId}&mode=editor`}
            title={device === "mobile" ? "Vista previa móvil interactiva del viaje" : "Vista previa editable del viaje"}
            onLoad={() => previewRef.current?.contentWindow?.postMessage({ type: "trip-editor-preview", document: docRef.current, editorPreview: device !== "mobile", view: canvasView, slug: liveSlug }, window.location.origin)}
            className={`mx-auto block bg-background ${device === "mobile" ? "editor-phone-frame rounded-[20px]" : "editor-desktop-frame w-full max-w-[1440px] shadow-xl"}`}
          />
          </div>
        </section>
      </div>
      <ImageCropDialog src={cropSource} aspect={cropAspect} title="Recorte recomendado" onCancel={() => setCropSource(null)} onConfirm={applyCroppedImage} />
      <MobileHeroPositionDialog
        open={mobileHeroPositionOpen}
        imageSrc={document.trip.heroImage.src}
        value={document.trip.heroImage.mobilePosition}
        onOpenChange={setMobileHeroPositionOpen}
        onSave={(mobilePosition) => mutate((current) => ({ ...current, trip: { ...current.trip, heroImage: { ...current.trip.heroImage, mobilePosition } } }))}
      />
      <PrePublishChecklist open={checklistOpen} onOpenChange={setChecklistOpen} trip={document.trip} ctaIssues={ctaWarnings(document, liveSlug).map((item) => `${item.label}: ${item.message}`)} onOpenMobile={() => { setDevice("mobile"); setChecklistOpen(false); }} onContinue={() => { setChecklistOpen(false); setPublishOpen(true); }} />
      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} document={document} tripId={tripId} onPublished={(slug) => { window.localStorage.removeItem(STORAGE_KEY); setSaveState("saved"); setLiveSlug(slug); }} />
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de versiones</DialogTitle>
            <DialogDescription>Versiones publicadas de esta página. Restaurar carga la versión en el editor sin publicarla.</DialogDescription>
          </DialogHeader>
          {versions === null ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay versiones publicadas. Cada vez que publiques, se guarda una versión acá.</p>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div key={version.id} className="space-y-2 border p-3">
                  <p className="text-sm font-medium">{new Date(version.publishedAt).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}</p>
                  <p className="text-xs text-muted-foreground">{version.document?.trip?.title ?? version.document?.trip?.destination}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    mutate(() => normalizeEditorDocument(version.document, fresh().trip));
                    setHistoryOpen(false);
                  }}>Restaurar</Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
