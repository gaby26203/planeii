import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Check, Copy, ExternalLink, Globe, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearPageDraft, recordPageVersion } from "@/lib/trip-page-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { externalizeDocumentImages } from "@/lib/trip-page-images";
import { toast } from "sonner";
import type { EditorDocument } from "@/lib/trip-editor";
import type { Json } from "@/integrations/supabase/types";

export function toSlug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

type Availability = "idle" | "checking" | "available" | "taken" | "short";

export function PublishDialog({ open, onOpenChange, document, tripId, onPublished }: { open: boolean; onOpenChange: (open: boolean) => void; document: EditorDocument; tripId: string; onPublished?: (slug: string) => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<"loading" | "ok" | "missing">("loading");
  const [slug, setSlug] = useState("");
  const [existingSlug, setExistingSlug] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>("idle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    setAuthState("loading");
    let cancelled = false;
    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      setUser(data.user ?? null);
      setAuthState(error || !data.user ? "missing" : "ok");
    });
    supabase.from("trip_pages").select("slug").eq("trip_id", tripId).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      if (error) setMessage("No pudimos leer la página publicada. Revisá tu conexión.");
      setExistingSlug(data?.slug ?? null);
      setSlug((current) => current || data?.slug || toSlug(`${document.trip.destination} ${document.trip.datesShort}`));
    });
    return () => { cancelled = true; };
  }, [open, tripId, document.trip.destination, document.trip.datesShort]);

  useEffect(() => {
    if (!open) return;
    const clean = toSlug(slug);
    if (clean.length < 3) return setAvailability("short");
    setAvailability("checking");
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.from("trip_pages").select("trip_id").eq("slug", clean).maybeSingle();
      setAvailability(data && data.trip_id !== tripId ? "taken" : "available");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [slug, open, tripId]);

  const publish = async () => {
    const clean = toSlug(slug);
    if (clean.length < 3) return setMessage("La dirección debe tener al menos 3 caracteres.");
    if (!user) return setMessage("Tu sesión venció. Volvé a iniciar sesión para publicar.");
    setBusy(true);
    setMessage(null);
    try {
      const { data: bySlug, error: slugError } = await supabase.from("trip_pages").select("trip_id").eq("slug", clean).maybeSingle();
      if (slugError) throw slugError;
      if (bySlug && bySlug.trip_id !== tripId) return setMessage("Esa dirección ya está en uso. Probá otra.");
      const { data: existing, error: existingError } = await supabase.from("trip_pages").select("id").eq("trip_id", tripId).maybeSingle();
      if (existingError) throw existingError;
      const doc = await externalizeDocumentImages(tripId, document);
      const now = new Date().toISOString();
      const payload = { slug: clean, trip_id: tripId, document: doc as unknown as Json, updated_at: now, published_at: now };
      const { error } = existing
        ? await supabase.from("trip_pages").update(payload).eq("id", existing.id)
        : await supabase.from("trip_pages").insert({ ...payload, owner_id: user.id });
      if (error) throw error;
      try {
        await recordPageVersion(tripId, doc, user.id);
        await clearPageDraft(tripId);
      } catch (versionError) {
        console.error("No se pudo registrar la versión publicada", versionError);
      }
      setSlug(clean);
      setExistingSlug(clean);
      setPublishedUrl(`${window.location.origin}/v/${clean}`);
      onPublished?.(clean);
      toast.success(existingSlug ? "Página actualizada" : "Página publicada", { description: `${window.location.origin}/v/${clean}` });
    } catch (error) {
      const text = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error);
      console.error("Error al publicar", error);
      const friendly = (
        /too large|payload/i.test(text) ? "Las imágenes son demasiado pesadas. Usá menos fotos o más pequeñas."
        : /permission|policy|row-level/i.test(text) ? "No tenés permiso para publicar este viaje."
        : /fetch|network/i.test(text) ? "Sin conexión. Revisá internet e intentá nuevamente."
        : "No se pudo publicar. Intentá de nuevo.");
      setMessage(friendly);
      toast.error(friendly);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!publishedUrl) return;
    await navigator.clipboard.writeText(publishedUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const hint: Record<Availability, string> = { idle: "", checking: "Comprobando…", available: "Disponible", taken: "Ya está en uso", short: "Mínimo 3 caracteres" };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setPublishedUrl(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{publishedUrl ? "¡Listo para compartir!" : existingSlug ? "Actualizar página" : "Publicar viaje"}</DialogTitle>
          <DialogDescription>{publishedUrl ? "Enviá este enlace a tus viajeras." : "Elegí la dirección del enlace que vas a compartir con las viajeras."}</DialogDescription>
        </DialogHeader>

        {authState === "loading" ? (
          <p className="text-sm text-muted-foreground">Preparando…</p>
        ) : authState === "missing" ? (
          <p className="text-sm text-destructive">Tu sesión venció. Volvé a iniciar sesión para publicar.</p>
        ) : publishedUrl ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-medium"><Check className="h-4 w-4 text-primary" /> Tu página está publicada</p>
            <div className="flex gap-2"><Input readOnly value={publishedUrl} onFocus={(e) => e.currentTarget.select()} /><Button variant="outline" size="icon" onClick={copy} aria-label="Copiar enlace">{copied ? <Check /> : <Copy />}</Button></div>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline"><a href={`https://wa.me/?text=${encodeURIComponent(`${document.trip.destination}: ${publishedUrl}`)}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a></Button>
              <Button asChild><a href={publishedUrl} target="_blank" rel="noreferrer"><ExternalLink /> Abrir página</a></Button>
            </div>
            <p className="text-xs text-muted-foreground">Cuando hagas más cambios, tocá «Actualizar página».</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pub-slug">Dirección de la página</Label>
              <div className="flex items-center gap-1 text-sm"><span className="shrink-0 text-muted-foreground">/v/</span><Input id="pub-slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} /></div>
              <p className={`text-xs ${availability === "taken" || availability === "short" ? "text-destructive" : "text-muted-foreground"}`}>{hint[availability]}</p>
              <p className="break-all text-xs text-muted-foreground">{origin}/v/{toSlug(slug)}</p>
            </div>
            <Button className="w-full" onClick={publish} disabled={busy || availability === "taken" || availability === "short"}><Globe /> {busy ? "Publicando…" : existingSlug ? "Actualizar página" : "Publicar"}</Button>
          </div>
        )}
        {message && <p className="text-sm text-destructive">{message}</p>}
      </DialogContent>
    </Dialog>
  );
}
