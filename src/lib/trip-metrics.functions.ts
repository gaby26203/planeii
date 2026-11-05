import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TripPageMetrics = {
  totalViews: number;
  views7d: number;
  views30d: number;
  bookingClicks: number;
  announcementClicks: number;
  formStarts: number;
  formSubmits: number;
  applications: number;
  confirmed: number;
  byCountry: { label: string; count: number }[];
  byDevice: { label: string; count: number }[];
  byReferrer: { label: string; count: number }[];
  byDay: { day: string; count: number }[];
};

const emptyMetrics = (): TripPageMetrics => ({
  totalViews: 0,
  views7d: 0,
  views30d: 0,
  bookingClicks: 0,
  announcementClicks: 0,
  formStarts: 0,
  formSubmits: 0,
  applications: 0,
  confirmed: 0,
  byCountry: [],
  byDevice: [],
  byReferrer: [],
  byDay: [],
});

export const getTripPageMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tripId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("trip_page_events")
      .select("event, target, country, device, referrer, created_at")
      .eq("trip_id", data.tripId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;

    const metrics = emptyMetrics();
    const now = Date.now();
    const country = new Map<string, number>();
    const device = new Map<string, number>();
    const referrer = new Map<string, number>();
    const day = new Map<string, number>();

    for (const row of rows ?? []) {
      const age = now - new Date(row.created_at).getTime();
      if (row.event === "view") {
        metrics.totalViews += 1;
        if (age <= 7 * 86400000) metrics.views7d += 1;
        if (age <= 30 * 86400000) metrics.views30d += 1;
        const key = row.created_at.slice(0, 10);
        day.set(key, (day.get(key) ?? 0) + 1);
        const c = row.country ?? "Desconocido";
        country.set(c, (country.get(c) ?? 0) + 1);
        const d = row.device ?? "Desconocido";
        device.set(d, (device.get(d) ?? 0) + 1);
        const r = row.referrer ?? "directo";
        referrer.set(r, (referrer.get(r) ?? 0) + 1);
      } else if (row.event === "click") {
        if (row.target === "announcement") metrics.announcementClicks += 1;
        else metrics.bookingClicks += 1;
      } else if (row.event === "form_start") metrics.formStarts += 1;
      else if (row.event === "form_submit") metrics.formSubmits += 1;
    }

    const toList = (map: Map<string, number>) =>
      [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
    metrics.byCountry = toList(country);
    metrics.byDevice = toList(device);
    metrics.byReferrer = toList(referrer);
    metrics.byDay = [...day.entries()].map(([d, count]) => ({ day: d, count })).sort((a, b) => a.day.localeCompare(b.day));
    const { data: apps } = await context.supabase
      .from("trip_applications")
      .select("status")
      .eq("trip_id", data.tripId)
      .gte("created_at", since);
    metrics.applications = apps?.length ?? 0;
    metrics.confirmed = (apps ?? []).filter((a) => a.status === "confirmada").length;
    return metrics;
  });
