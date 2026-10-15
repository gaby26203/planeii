// Notificaciones en vivo de actividad dentro de un viaje.
//
// Cuando una organizadora / tour leader guarda un cambio, su cliente emite un
// broadcast efímero por el canal `trip-activity:<tripId>`. Los demás clientes
// que tienen ese viaje abierto muestran un toast breve ("Ana actualizó
// Itinerario & Costos"). No se persiste nada en la base de datos.

import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type TripSectionKey = "costos" | "viajeras" | "proveedores" | "resumen" | "notas";

const SECTION_LABELS: Record<string, string> = {
  costos: "Itinerario & Costos",
  viajeras: "Viajeras",
  proveedores: "Proveedores",
  resumen: "Resumen",
  notas: "Notas",
};

export function sectionLabel(section: string | null | undefined): string {
  if (!section) return "el viaje";
  return SECTION_LABELS[section] ?? "el viaje";
}

// ── Sección activa por viaje (la registra el dashboard del viaje) ──
const activeSection = new Map<string, string>();

export function registerTripSection(tripId: string, section: string) {
  activeSection.set(tripId, section);
}

export function clearTripSection(tripId: string) {
  activeSection.delete(tripId);
}

// ── Identidad del actor (cacheada) ──
interface Actor {
  id: string;
  name: string;
}
let actorPromise: Promise<Actor | null> | null = null;

async function getActor(): Promise<Actor | null> {
  if (!actorPromise) {
    actorPromise = (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return null;
      let name = (user.user_metadata?.["display_name"] as string | undefined) ?? "";
      if (!name) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name, email")
          .eq("id", user.id)
          .maybeSingle();
        name = (prof?.display_name as string | null) || (prof?.email as string | null) || "";
      }
      if (!name) name = user.email ?? "Alguien";
      return { id: user.id, name };
    })().catch(() => null);
  }
  return actorPromise;
}

export function resetTripActivityActor() {
  actorPromise = null;
}

// ── Emisión ──
const channelName = (tripId: string) => `trip-activity:${tripId}`;

/**
 * Anuncia a los demás clientes que este usuario acaba de guardar un cambio.
 * Silencioso ante errores: nunca debe romper el guardado.
 */
export async function notifyTripActivity(tripId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const actor = await getActor();
    if (!actor) return;
    const channel = supabase.channel(channelName(tripId), {
      config: { broadcast: { self: false } },
    });
    await new Promise<void>((resolve) => {
      let settled = false;
      let removed = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const removeOnce = () => {
        if (removed) return;
        removed = true;
        void supabase.removeChannel(channel);
      };
      channel.subscribe((status) => {
        if (settled) return;
        if (status === "SUBSCRIBED") {
          void channel
            .send({
              type: "broadcast",
              event: "trip-change",
              payload: {
                actorId: actor.id,
                actorName: actor.name,
                section: activeSection.get(tripId) ?? null,
              },
            })
            .finally(() => {
              setTimeout(() => {
                removeOnce();
                done();
              }, 150);
            });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          removeOnce();
          done();
        }
      });
      setTimeout(done, 3000);
    });
  } catch {
    // Sin ruido: la notificación es best-effort.
  }
}

// ── Recepción ──
const GROUP_WINDOW_MS = 4000;

/**
 * Escucha la actividad del viaje abierto y muestra un toast breve cuando otra
 * persona guarda cambios. Ignora los cambios propios y agrupa ráfagas.
 */
export function useTripActivity(tripId: string | undefined) {
  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    let myId: string | null = null;
    const lastToast = new Map<string, { id: string | number; at: number }>();

    void getActor().then((a) => {
      if (!cancelled) myId = a?.id ?? null;
    });

    const channel = supabase.channel(channelName(tripId), {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "trip-change" }, ({ payload }) => {
      const actorId = (payload as { actorId?: string })?.actorId ?? null;
      const actorName = (payload as { actorName?: string })?.actorName ?? "Alguien";
      const section = (payload as { section?: string | null })?.section ?? null;
      if (!actorId || actorId === myId) return;

      const key = `${actorId}:${section ?? ""}`;
      const now = Date.now();
      const prev = lastToast.get(key);
      const message = `${actorName} actualizó ${sectionLabel(section)}`;
      if (prev && now - prev.at < GROUP_WINDOW_MS) {
        toast(message, { id: prev.id, duration: GROUP_WINDOW_MS });
        lastToast.set(key, { id: prev.id, at: now });
        return;
      }
      const id = toast(message, { duration: GROUP_WINDOW_MS });
      lastToast.set(key, { id, at: now });
    });

    channel.subscribe();

    let removed = false;
    return () => {
      cancelled = true;
      if (removed) return;
      removed = true;
      void supabase.removeChannel(channel);
    };
  }, [tripId]);
}
