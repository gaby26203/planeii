import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { editorThemeClass, editorThemeStyle, type EditorDocument } from "@/lib/trip-editor";
import { COUNTRY_CODES, defaultBookingForm, formColorStyle, isQuestion, normalizeWhatsapp, type FormBlock } from "@/lib/booking-form";
import { trackTripEvent } from "@/lib/trip-analytics";
import { EditableText, EditorPreviewProvider } from "@/components/trip/shared";
import { Button } from "@/components/ui/button";
import { tripMetaItems } from "@/lib/trip-meta";

type Answers = Record<string, string | string[] | boolean>;

const fieldClass = "mt-2 w-full border border-foreground/25 bg-background px-4 py-3 text-base text-foreground outline-none transition focus:border-primary";

/**
 * Página del formulario de solicitud. Un solo diseño para la página pública (/v/$slug/reservar)
 * y para el lienzo del editor. En modo "editor" no envía, no navega y no registra métricas.
 */
export function ApplyFormView({ document, slug, tripId, mode = "live", forceThanks = false, inlineEditing = false }: {
  document: EditorDocument;
  slug: string;
  tripId: string;
  mode?: "live" | "editor";
  forceThanks?: boolean;
  inlineEditing?: boolean;
}) {
  const editor = mode === "editor";
  const form = document.bookingForm ?? defaultBookingForm(document.trip.title);
  const { trip } = document;
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState("+58");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const started = useRef(false);
  const done = editor ? forceThanks : submitted;

  useEffect(() => { if (!editor) window.scrollTo(0, 0); }, [done, editor]);

  const markStarted = () => {
    if (editor || started.current) return;
    started.current = true;
    trackTripEvent(tripId, "form_start");
  };

  const set = (id: string, value: Answers[string]) => { markStarted(); setAnswers((a) => ({ ...a, [id]: value })); };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (editor) return setError("Vista del editor: el envío está desactivado. Publicá y probalo desde el enlace.");
    setError("");
    const whatsapp = normalizeWhatsapp(code, phone);
    if (fullName.trim().length < 2) return setError("Escribí tu nombre y apellido.");
    if (!/^\+\d{7,16}$/.test(whatsapp)) return setError("Revisá tu número de WhatsApp.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Revisá tu correo.");
    for (const b of form.blocks) {
      if (b.hidden || !b.required || !isQuestion(b.type)) continue;
      const v = answers[b.id];
      if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) return setError(`Falta responder: ${b.label}`);
    }
    if (form.consent.enabled && !consent) return setError("Necesitamos tu aceptación para contactarte.");
    const params = new URLSearchParams(window.location.search);
    let referrer = "";
    try { referrer = sessionStorage.getItem(`planeii-ref-${slug}`) ?? window.document.referrer; } catch { referrer = window.document.referrer; }
    setSending(true);
    try {
      const res = await fetch("/api/public/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug, fullName, whatsapp, email, answers, consent, website: honeypot,
          utm: { source: params.get("utm_source") ?? undefined, medium: params.get("utm_medium") ?? undefined, campaign: params.get("utm_campaign") ?? undefined },
          referrer: referrer.slice(0, 200),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "No se pudo enviar la solicitud.");
      trackTripEvent(tripId, "form_submit");
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la solicitud.");
    } finally {
      setSending(false);
    }
  };

  const meta = tripMetaItems(trip).filter((m) => m.kind === "dates" || m.kind === "price" || m.kind === "spots");
  const toTrip = (className: string, children: ReactNode) => editor
    ? <span className={className}>{children}</span>
    : <Link to="/v/$slug" params={{ slug }} className={className}>{children}</Link>;

  return (
    <EditorPreviewProvider enabled={editor && inlineEditing} textStyles={document.textStyles}>
    <div className={editorThemeClass(document.theme)} style={editorThemeStyle(document.theme)}>
      <div className="apply-form min-h-screen" style={formColorStyle(form.colors)}>
        <header className="border-b">
          <div className="container-ed flex h-16 items-center justify-between">
            {toTrip("font-serif text-lg tracking-tight", <EditableText path="brand" styleKey="form.navigation.brand" value={trip.brand} />)}
            {toTrip("eyebrow opacity-70 hover:opacity-100", <EditableText path="bookingForm.copy.viewTrip" value={form.copy?.viewTrip ?? "Ver el viaje"} />)}
          </div>
        </header>
        {form.showTripHeader && (
          <section className="af-header border-b">
            <div className="container-ed py-6 text-center">
              <p className="eyebrow text-primary"><EditableText path="destination" styleKey="form.destination" value={trip.destination} />{trip.country && <>, <EditableText path="country" styleKey="form.country" value={trip.country} /></>}</p>
              <h1 className="mt-2 font-serif text-2xl md:text-3xl"><EditableText path="title" styleKey="form.tripTitle" value={trip.title} /></h1>
              <dl className="mt-4 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm">
                {meta.map((m) => (
                  <div key={m.id}>
                    <dt className="eyebrow text-muted-foreground"><EditableText path={`copy.${m.kind === "dates" ? "metaDates" : m.kind === "price" ? "metaPrice" : "metaSpots"}`} styleKey={`form.meta.${m.kind}.label`} value={m.kind === "dates" ? trip.copy.metaDates : m.kind === "price" ? trip.copy.metaPrice : trip.copy.metaSpots} /></dt>
                    <dd className="mt-1 font-serif text-lg">{m.kind === "price" ? <><EditableText path="copy.bookingFrom" styleKey="form.meta.price.prefix" value={trip.copy.bookingFrom} /> <EditableText path="price" styleKey="form.meta.price.value" value={trip.price} /> <EditableText path="currency" styleKey="form.meta.price.currency" value={trip.currency} /></> : <EditableText path={m.kind === "dates" ? "datesShort" : "spots"} styleKey={`form.meta.${m.kind}.value`} value={m.kind === "dates" ? trip.datesShort : trip.spots} />}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        )}

        <main className="container-ed py-10 md:py-16">
          <div className="mx-auto max-w-2xl">
            {done ? (
              <div>
                <p className="eyebrow text-primary"><EditableText path="bookingForm.copy.received" value={form.copy?.received ?? "Solicitud recibida"} /></p>
                <h2 className="mt-3 font-serif text-3xl md:text-4xl"><EditableText path="bookingForm.thanks.title" value={form.thanks.title} /></h2>
                <p className="mt-5 text-lg leading-relaxed opacity-85"><EditableText path="bookingForm.thanks.message" value={form.thanks.message} /></p>
                {form.thanks.steps.filter(Boolean).length > 0 && (
                  <ol className="mt-8 space-y-4">
                    {form.thanks.steps.map((step, i) => step ? (
                      <li key={i} className="flex gap-4 border-b pb-4">
                        <span className="font-serif text-2xl text-primary">{String(i + 1).padStart(2, "0")}</span>
                        <span className="pt-1"><EditableText path={`bookingForm.thanks.steps.${i}`} value={step} /></span>
                      </li>
                    ) : null)}
                  </ol>
                )}
                <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                  {form.thanks.ctaLabel && (editor || form.thanks.ctaUrl) && <a href={editor ? undefined : form.thanks.ctaUrl} target="_blank" rel="noreferrer" className="btn-primary"><EditableText path="bookingForm.thanks.ctaLabel" value={form.thanks.ctaLabel} /></a>}
                  {toTrip("btn-ghost", <EditableText path="bookingForm.copy.backToTrip" value={form.copy?.backToTrip ?? "Volver al viaje"} />)}
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate onFocusCapture={markStarted}>
                <h2 className="font-serif text-3xl md:text-4xl"><EditableText path="bookingForm.title" value={form.title} /></h2>
                {form.intro && <p className="mt-4 leading-relaxed opacity-85"><EditableText path="bookingForm.intro" value={form.intro} /></p>}
                <div className="mt-8 space-y-6">
                  <label className="block"><span className="text-sm font-medium"><EditableText path="bookingForm.copy.name" value={form.copy?.name ?? "Nombre y apellido"} /> *</span>
                    <input className={fieldClass} value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} autoComplete="name" required /></label>
                  <div><span className="text-sm font-medium"><EditableText path="bookingForm.copy.whatsapp" value={form.copy?.whatsapp ?? "WhatsApp"} /> *</span>
                    <div className="flex gap-2">
                      <select aria-label="Código de país" className={`${fieldClass.replace("w-full", "w-32")} shrink-0`} value={code} onChange={(e) => setCode(e.target.value)}>
                        {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                      <input className={`${fieldClass} min-w-0`} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel-national" placeholder="Número" maxLength={20} aria-label="Número de WhatsApp" />
                    </div>
                  </div>
                  <label className="block"><span className="text-sm font-medium"><EditableText path="bookingForm.copy.email" value={form.copy?.email ?? "Correo"} /> *</span>
                    <input className={fieldClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} autoComplete="email" /></label>
                  {form.blocks.map((b, index) => !b.hidden && <Block key={b.id} index={index} copy={form.copy} block={b} value={answers[b.id]} onChange={(v) => set(b.id, v)} />)}
                  <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} name="website" />
                  {form.consent.enabled && (
                    <label className="flex items-start gap-3 text-sm">
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                      <span><EditableText path="bookingForm.consent.text" value={form.consent.text} />{form.consent.linkUrl && <> <a className="underline" href={editor ? undefined : form.consent.linkUrl} target="_blank" rel="noreferrer"><EditableText path="bookingForm.consent.linkLabel" value={form.consent.linkLabel || "Política de privacidad"} /></a></>}</span>
                    </label>
                  )}
                </div>
                {error && <p role="alert" className="mt-6 border-l-2 border-primary pl-3 text-sm">{error}</p>}
                <Button asChild disabled={sending}><button type={editor ? "button" : "submit"} className="btn-primary mt-8 h-auto w-full whitespace-normal sm:w-auto disabled:opacity-60"><EditableText path="bookingForm.submitLabel" value={sending ? "Enviando…" : form.submitLabel} /></button></Button>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
    </EditorPreviewProvider>
  );
}

function Block({ block, index, copy, value, onChange }: { index: number; copy: import("@/lib/booking-form").BookingForm["copy"]; block: FormBlock; value: Answers[string] | undefined; onChange: (v: Answers[string]) => void }) {
  const path = `bookingForm.blocks.${index}`;
  if (block.type === "heading") return <div className="pt-4"><h3 className="font-serif text-2xl"><EditableText path={`${path}.label`} value={block.label} /></h3>{block.help && <p className="mt-1 opacity-75"><EditableText path={`${path}.help`} value={block.help} /></p>}</div>;
  if (block.type === "info") return <p className="whitespace-pre-line leading-relaxed opacity-85"><EditableText path={`${path}.label`} value={block.label} /></p>;
  const label = <span className="text-sm font-medium"><EditableText path={`${path}.label`} value={block.label} />{block.required ? " *" : ""}</span>;
  const help = block.help ? <span className="mt-1 block text-xs opacity-70"><EditableText path={`${path}.help`} value={block.help} /></span> : null;
  if (block.type === "short") return <label className="block">{label}{help}<input className={fieldClass} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} maxLength={300} /></label>;
  if (block.type === "long") return <label className="block">{label}{help}<textarea className={`${fieldClass} min-h-28`} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} maxLength={3000} /></label>;
  if (block.type === "date") return <label className="block">{label}{help}<input type="date" className={fieldClass} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} /></label>;
  if (block.type === "yesno") return (
    <fieldset>{label}{help}<div className="mt-2 flex gap-3">
      {[["Sí", true], ["No", false]].map(([l, v]) => (
        <Button key={String(v)} type="button" onClick={() => onChange(v as boolean)} className={`border px-6 py-2 ${value === v ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25"}`}><EditableText path={`bookingForm.copy.${v ? "yes" : "no"}`} value={(v ? copy?.yes : copy?.no) ?? String(l)} /></Button>
      ))}
    </div></fieldset>
  );
  const options = block.options ?? [];
  if (block.type === "single") return (
    <fieldset>{label}{help}<div className="mt-2 space-y-2">
      {options.map((o, optionIndex) => <label key={optionIndex} className="flex items-center gap-3"><input type="radio" className="h-4 w-4 accent-primary" name={block.id} checked={value === o} onChange={() => onChange(o)} /><EditableText path={`${path}.options.${optionIndex}`} value={o} /></label>)}
    </div></fieldset>
  );
  const list = Array.isArray(value) ? value : [];
  return (
    <fieldset>{label}{help}<div className="mt-2 space-y-2">
      {options.map((o, optionIndex) => <label key={optionIndex} className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 accent-primary" checked={list.includes(o)} onChange={(e) => onChange(e.target.checked ? [...list, o] : list.filter((x) => x !== o))} /><EditableText path={`${path}.options.${optionIndex}`} value={o} /></label>)}
    </div></fieldset>
  );
}
