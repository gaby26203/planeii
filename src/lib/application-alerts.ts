import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Punto rojo de «Solicitudes»: cuenta solicitudes creadas después de la última
// vez que la organizadora abrió la página de solicitudes de ese viaje.
// El "visto" se guarda por viaje en localStorage (por dispositivo/navegador).

const seenKey = (tripId: string) => `applications-seen:${tripId}`;

export function markApplicationsSeen(tripId: string) {
  try {
    localStorage.setItem(seenKey(tripId), new Date().toISOString());
  } catch {
    // localStorage no disponible: el punto simplemente no se apaga
  }
}

function lastSeen(tripId: string): string {
  try {
    return localStorage.getItem(seenKey(tripId)) ?? "";
  } catch {
    return "";
  }
}

export function useNewApplicationsCount(tripId: string) {
  return useQuery({
    queryKey: ["trip-applications-new", tripId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const seen = lastSeen(tripId);
      let q = supabase
        .from("trip_applications")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", tripId);
      if (seen) q = q.gt("created_at", seen);
      const { count, error } = await q;
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Marca las solicitudes del viaje como vistas y apaga el punto rojo. */
export function useMarkApplicationsSeen(tripId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    markApplicationsSeen(tripId);
    queryClient.invalidateQueries({ queryKey: ["trip-applications-new", tripId] });
  }, [tripId, queryClient]);
}

/** Slug público de la página de venta del viaje (null si no tiene página publicada). */
export function useTripPageSlug(tripId: string) {
  return useQuery({
    queryKey: ["trip-page-slug", tripId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("trip_pages")
        .select("slug")
        .eq("trip_id", tripId)
        .maybeSingle();
      return (data?.slug as string | undefined) ?? null;
    },
  });
}
