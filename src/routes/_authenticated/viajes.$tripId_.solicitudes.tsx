import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, MessageCircle, Search, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTripsStore } from "@/lib/trips-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { APPLICATION_STATUSES, defaultBookingForm, formatAnswer, statusLabel, whatsappLink, type BookingForm, type StoredAnswer } from "@/lib/booking-form";
import { useMarkApplicationsSeen } from "@/lib/application-alerts";

export const Route = createFileRoute("/_authenticated/viajes/$tripId_/solicitudes")({
  head: () => ({
    meta: [
      { title: "Solicitudes del viaje | Planeii" },
      { name: "description", content: "Solicitudes recibidas desde la página de venta: estado, notas y contacto por WhatsApp." },
      { property: "og:title", content: "Solicitudes del viaje | Planeii" },
      { property: "og:description", content: "Seguimiento de las solicitudes recibidas desde la landing del viaje." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApplicationsPage,
});

type Application = {
  id: string; trip_id: string; full_name: string; whatsapp: string; email: string; answers: unknown; status: string;
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; referrer: string | null;
  consent_accepted: boolean; enrollee_id: string | null; duplicate_of: string | null; created_at: string; page_slug: string | null;
  contacted_by: string | null;
};

type Organizer = { id: string; name: string };

const dateFmt = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });
const origin = (a: Application) => [a.utm_source, a.utm_medium, a.utm_campaign].filter(Boolean).join(" · ") || (a.referrer && a.referrer !== "directo" ? a.referrer.replace(/^https?:\/\//, "").split("/")[0] : "Directo");

async function currentActor() {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Sesión no válida");
  const { data: profile } = await supabase.from("profiles").select("display_name, email").eq("id", id).maybeSingle();
  return { id, name: profile?.display_name || profile?.email || data.user?.email || "Organizadora" };
}

function ApplicationsPage() {
  const { tripId } = Route.useParams();
  const trip = useTripsStore((s) => s.trips[tripId]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  useMarkApplicationsSeen(tripId);

  const apps = useQuery({
    queryKey: ["trip-applications", tripId],
    queryFn: async () => {
      const { data, error } = await supabase.from("trip_applications").select("*").eq("trip_id", tripId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Application[];
    },
  });
  const page = useQuery({
    queryKey: ["trip-page-form", tripId],
    queryFn: async () => {
      const { data } = await supabase.from("trip_pages").select("document, slug").eq("trip_id", tripId).maybeSingle();
      const doc = data?.document as { bookingForm?: BookingForm; trip?: { title?: string } } | undefined;
      return { form: doc?.bookingForm ?? defaultBookingForm(), title: doc?.trip?.title ?? "", slug: data?.slug ?? null };
    },
  });

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (apps.data ?? []).filter((a) => (status === "all" || a.status === status) && (!q || `${a.full_name} ${a.email} ${a.whatsapp}`.toLowerCase().includes(q)));
  }, [apps.data, query, status]);
  const open = apps.data?.find((a) => a.id === openId) ?? null;
  const tripName = page.data?.title || trip?.name || "el viaje";

  if (!trip) {
    return <div className="p-8 text-center"><h1 className="mb-2 font-display text-2xl font-bold">Viaje no encontrado</h1><Link to="/" className="text-primary underline">Volver a mis viajes</Link></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/viajes/$tripId" params={{ tripId }} className="text-xs text-muted-foreground hover:underline">← {trip.name}</Link>
          <h1 className="font-display text-2xl font-bold">Solicitudes</h1>
          <p className="text-sm text-muted-foreground">Personas que completaron el formulario. Una solicitud no es una reserva hasta que la confirmes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild><Link to="/viajes/$tripId/metricas" params={{ tripId }}>Métricas</Link></Button>
          <Button variant="outline" size="sm" asChild><Link to="/viajes/$tripId/pagina" params={{ tripId }}>Editar formulario</Link></Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, correo o WhatsApp" className="pl-9" /></div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos los estados</SelectItem>{APPLICATION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {apps.isLoading && <p className="text-sm text-muted-foreground">Cargando solicitudes…</p>}
      {apps.isError && <p className="text-sm text-destructive">No se pudieron cargar las solicitudes.</p>}
      {apps.data && list.length === 0 && (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {apps.data.length === 0 ? (page.data?.form.mode === "internal" && page.data.slug ? `Todavía no llegaron solicitudes. El formulario está en /v/${page.data.slug}/reservar.` : "Todavía no hay solicitudes. Activá el formulario de Planeii en la pestaña Formulario del editor y publicá la página.") : "Ninguna solicitud coincide con el filtro."}
        </div>
      )}

      {list.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-background">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-3">Nombre</th><th className="p-3">WhatsApp</th><th className="p-3">Email</th><th className="p-3">Fecha</th><th className="p-3">Estado</th><th className="p-3">Origen</th></tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/30" onClick={() => setOpenId(a.id)}>
                  <td className="p-3 font-medium">{a.full_name}{a.duplicate_of && <Badge variant="outline" className="ml-2 gap-1 text-[10px]"><AlertTriangle className="h-3 w-3" />Posible duplicado</Badge>}</td>
                  <td className="p-3 tabular-nums">{a.whatsapp}</td>
                  <td className="p-3">{a.email}</td>
                  <td className="p-3 whitespace-nowrap">{dateFmt.format(new Date(a.created_at))}</td>
                  <td className="p-3"><Badge variant={a.status === "confirmada" ? "default" : "secondary"}>{statusLabel(a.status)}</Badge></td>
                  <td className="p-3 text-muted-foreground">{origin(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open && <ApplicationDetail app={open} tripId={tripId} tripName={tripName} template={page.data?.form.whatsappTemplate ?? defaultBookingForm().whatsappTemplate} onDeleted={() => setOpenId(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ApplicationDetail({ app, tripId, tripName, template, onDeleted }: { app: Application; tripId: string; tripName: string; template: string; onDeleted: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const enrollees = useTripsStore((s) => s.trips[tripId]?.enrollees ?? []);
  const addEnrollee = useTripsStore((s) => s.addEnrollee);
  const linkedEnrollee = enrollees.find((e) => e.id === app.enrollee_id);

  const notes = useQuery({
    queryKey: ["trip-application-notes", app.id],
    queryFn: async () => {
      const [n, e] = await Promise.all([
        supabase.from("trip_application_notes").select("*").eq("application_id", app.id).order("created_at", { ascending: false }),
        supabase.from("trip_application_events").select("*").eq("application_id", app.id).order("created_at", { ascending: false }),
      ]);
      if (n.error) throw n.error;
      if (e.error) throw e.error;
      return { notes: n.data, events: e.data };
    },
  });
  const organizers = useQuery({
    queryKey: ["trip-organizers", tripId],
    queryFn: async () => {
      const [t, m] = await Promise.all([
        supabase.from("trips").select("owner_id").eq("id", tripId).single(),
        supabase.from("trip_members").select("user_id").eq("trip_id", tripId),
      ]);
      if (t.error) throw t.error;
      if (m.error) throw m.error;
      const ids = [...new Set([t.data.owner_id, ...(m.data ?? []).map((r) => r.user_id)])];
      const { data: profiles, error } = await supabase.from("profiles").select("id, display_name, email").in("id", ids);
      if (error) throw error;
      return ids.map((id) => {
        const p = profiles?.find((x) => x.id === id);
        return { id, name: p?.display_name || p?.email || "Organizadora" };
      }) as Organizer[];
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["trip-applications", tripId] }); qc.invalidateQueries({ queryKey: ["trip-application-notes", app.id] }); };

  const changeStatus = useMutation({
    mutationFn: async (to: string) => {
      const actor = await currentActor();
      const { error } = await supabase.from("trip_applications").update({ status: to }).eq("id", app.id);
      if (error) throw error;
      await supabase.from("trip_application_events").insert({ application_id: app.id, trip_id: tripId, actor_id: actor.id, actor_name: actor.name, kind: "status", from_value: app.status, to_value: to });
    },
    onSuccess: refresh,
    onError: () => toast.error("No se pudo cambiar el estado."),
  });
  const addNote = useMutation({
    mutationFn: async () => {
      const actor = await currentActor();
      const { error } = await supabase.from("trip_application_notes").insert({ application_id: app.id, trip_id: tripId, author_id: actor.id, author_name: actor.name, body: note.trim().slice(0, 4000) });
      if (error) throw error;
    },
    onSuccess: () => { setNote(""); refresh(); },
    onError: () => toast.error("No se pudo guardar la nota."),
  });
  const changeContactedBy = useMutation({
    mutationFn: async (to: string | null) => {
      const actor = await currentActor();
      const { error } = await supabase.from("trip_applications").update({ contacted_by: to }).eq("id", app.id);
      if (error) throw error;
      const toName = to ? organizers.data?.find((o) => o.id === to)?.name ?? "Organizadora" : null;
      await supabase.from("trip_application_events").insert({ application_id: app.id, trip_id: tripId, actor_id: actor.id, actor_name: actor.name, kind: "contacted_by", from_value: app.contacted_by, to_value: toName ?? "sin asignar" });
    },
    onSuccess: refresh,
    onError: () => toast.error("No se pudo guardar quién la contactó."),
  });
  const createEnrollee = useMutation({
    mutationFn: async () => {
      // Si ya existe una viajera con el mismo correo, se relaciona en vez de duplicarla.
      const existing = enrollees.find((e) => e.email.trim().toLowerCase() === app.email.toLowerCase());
      const id = existing?.id ?? addEnrollee(tripId, { name: app.full_name, email: app.email, phone: app.whatsapp, enrolledAt: new Date().toISOString().slice(0, 10) });
      if (!id) throw new Error("No se pudo crear la viajera");
      const actor = await currentActor();
      const { error } = await supabase.from("trip_applications").update({ enrollee_id: id }).eq("id", app.id);
      if (error) throw error;
      await supabase.from("trip_application_events").insert({ application_id: app.id, trip_id: tripId, actor_id: actor.id, actor_name: actor.name, kind: "enrollee", to_value: existing ? "relacionada" : "creada" });
      return existing ? "relacionada" : "creada";
    },
    onSuccess: (kind) => { toast.success(kind === "creada" ? "Viajera creada en el viaje." : "Relacionada con la viajera existente."); refresh(); },
    onError: () => toast.error("No se pudo crear la viajera."),
  });

  const deleteApp = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("trip_applications").delete().eq("id", app.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Solicitud eliminada."); qc.invalidateQueries({ queryKey: ["trip-applications", tripId] }); onDeleted(); },
    onError: () => toast.error("No se pudo eliminar la solicitud."),
  });

  const answers = (Array.isArray(app.answers) ? app.answers : []) as StoredAnswer[];

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>{app.full_name}</SheetTitle>
        <SheetDescription>{dateFmt.format(new Date(app.created_at))} · {origin(app)}</SheetDescription>
      </SheetHeader>
      {app.duplicate_of && <p className="flex items-center gap-2 rounded-md border border-dashed p-3 text-xs"><AlertTriangle className="h-4 w-4 shrink-0" />Posible duplicado: esta persona ya envió una solicitud para este viaje con el mismo correo o WhatsApp.</p>}

      <div className="flex flex-col gap-2">
        <Button asChild className="gap-2"><a href={whatsappLink(app.whatsapp, template, { name: app.full_name, trip: tripName })} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />Escribir por WhatsApp</a></Button>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><p className="text-xs text-muted-foreground">WhatsApp</p><p className="tabular-nums">{app.whatsapp}</p></div>
          <div><p className="text-xs text-muted-foreground">Email</p><a className="break-all underline" href={`mailto:${app.email}`}>{app.email}</a></div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Estado</p>
        <Select value={app.status} onValueChange={(v) => changeStatus.mutate(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{APPLICATION_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        {app.status === "confirmada" && (
          linkedEnrollee
            ? <p className="text-xs text-muted-foreground">Vinculada a la viajera {linkedEnrollee.name}.</p>
            : <Button variant="outline" size="sm" className="gap-2" disabled={createEnrollee.isPending} onClick={() => createEnrollee.mutate()}><UserPlus className="h-4 w-4" />Crear viajera con estos datos</Button>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Contactada por</p>
        <Select value={app.contacted_by ?? "none"} onValueChange={(v) => changeContactedBy.mutate(v === "none" ? null : v)} disabled={organizers.isLoading}>
          <SelectTrigger><SelectValue placeholder="Elegí quién la contactó" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin asignar</SelectItem>
            {(organizers.data ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Respuestas</p>
        {answers.length === 0 ? <p className="text-xs text-muted-foreground">Sin preguntas adicionales.</p> : answers.map((a) => (
          <div key={a.id} className="border-b pb-2"><p className="text-xs text-muted-foreground">{a.label}</p><p className="whitespace-pre-line text-sm">{formatAnswer(a)}</p></div>
        ))}
        <p className="text-xs text-muted-foreground">Aceptó uso de datos: {app.consent_accepted ? "Sí" : "No se pidió"}</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Notas internas</p>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: prefiere llamada por la tarde" />
        <Button size="sm" disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate()}>Guardar nota</Button>
        {notes.data?.notes.map((n) => (
          <div key={n.id} className="rounded-md bg-muted/40 p-3 text-sm"><p className="whitespace-pre-line">{n.body}</p><p className="mt-1 text-[11px] text-muted-foreground">{n.author_name} · {dateFmt.format(new Date(n.created_at))}</p></div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Historial</p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {notes.data?.events.map((e) => (
            <li key={e.id}>{dateFmt.format(new Date(e.created_at))} · {e.actor_name}: {e.kind === "status" ? `${statusLabel(e.from_value ?? "")} → ${statusLabel(e.to_value ?? "")}` : e.kind === "contacted_by" ? `contactada por ${e.to_value}` : `viajera ${e.to_value}`}</li>
          ))}
          <li>{dateFmt.format(new Date(app.created_at))} · Solicitud recibida</li>
        </ul>
      </div>

      <div className="border-t pt-4">
        {confirmDelete ? (
          <div className="space-y-2 rounded-md border border-destructive/40 p-3">
            <p className="text-xs">¿Eliminar esta solicitud? Se borran también sus notas e historial. Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" className="gap-2" disabled={deleteApp.isPending} onClick={() => deleteApp.mutate()}><Trash2 className="h-4 w-4" />Sí, eliminar</Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" />Eliminar solicitud</Button>
        )}
      </div>
    </div>
  );
}
