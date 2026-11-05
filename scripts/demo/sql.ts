// Convierte los datos de la demo en SQL para correr en el SQL Editor de Supabase o con psql.
// La carga borra antes los viajes vitrina de la demo (por id fijo) y los vuelve a crear, así que
// se puede repetir; el borrado en cascada se lleva páginas, solicitudes, miembros y métricas.

import { DEMO_TRIPS } from "./data";
import type { DemoData } from "./build";

const literal = (value: string | null) =>
  value === null ? "null" : `'${value.replace(/'/g, "''")}'`;
const json = (value: unknown) => `${literal(JSON.stringify(value))}::jsonb`;
const tripIdList = () => DEMO_TRIPS.map((t) => literal(t.id)).join(", ");

function ownerCheck(ownerEmail: string) {
  const email = literal(ownerEmail.trim().toLowerCase());
  return [
    "do $$ begin",
    `  if not exists (select 1 from auth.users where lower(email) = ${email}) then`,
    `    raise exception 'No hay ninguna cuenta con el correo %. Regístrate primero en la app.', ${email};`,
    "  end if;",
    "end $$;",
    `create temp table demo_owner on commit drop as select id from auth.users where lower(email) = ${email} limit 1;`,
  ];
}

export function seedSql(data: DemoData, ownerEmail: string, generatedAt = new Date()): string {
  const lines: string[] = [
    `-- Demo guiada de PlanEII: viajes vitrina con datos ficticios. Generado el ${generatedAt.toISOString()}.`,
    "-- Ver docs/demo.md. Se puede correr varias veces: reemplaza los viajes de la demo.",
    "begin;",
    ...ownerCheck(ownerEmail),
    `delete from public.trips where id in (${tripIdList()});`,
  ];
  for (const trip of data.trips) {
    lines.push(
      "insert into public.trips (id, owner_id, name, destination, start_date, end_date, status, data)",
      `select ${literal(trip.id)}, id, ${literal(trip.name)}, ${literal(trip.destination)}, ` +
        `${literal(trip.startDate)}, ${literal(trip.endDate)}, ${literal(trip.status)}, ${json(trip)} from demo_owner;`,
      "insert into public.trip_members (trip_id, user_id, role)",
      `select ${literal(trip.id)}, id, 'organizadora' from demo_owner;`,
    );
  }
  for (const page of data.pages) {
    lines.push(
      "insert into public.trip_pages (trip_id, owner_id, slug, document, published_at, updated_at)",
      `select ${literal(page.trip_id)}, id, ${literal(page.slug)}, ${json(page.document)}, now(), now() from demo_owner;`,
    );
  }
  if (data.applications.length) {
    lines.push(
      "insert into public.trip_applications (id, trip_id, full_name, email, whatsapp, status, page_slug, consent_accepted, created_at) values",
      data.applications
        .map(
          (a) =>
            `  (${literal(a.id)}, ${literal(a.trip_id)}, ${literal(a.full_name)}, ${literal(a.email)}, ` +
            `${literal(a.whatsapp)}, ${literal(a.status)}, ${literal(a.page_slug)}, ${a.consent_accepted}, ${literal(a.created_at)})`,
        )
        .join(",\n") + ";",
    );
  }
  if (data.events.length) {
    lines.push(
      "insert into public.trip_page_events (trip_id, event, target, country, device, referrer, created_at) values",
      data.events
        .map(
          (e) =>
            `  (${literal(e.trip_id)}, ${literal(e.event)}, ${literal(e.target)}, ${literal(e.country)}, ` +
            `${literal(e.device)}, ${literal(e.referrer)}, ${literal(e.created_at)})`,
        )
        .join(",\n") + ";",
    );
  }
  lines.push("commit;", "");
  return lines.join("\n");
}

export function removeSql(): string {
  return [
    "-- Borra los viajes vitrina de la demo guiada y todo lo que cuelga de ellos.",
    "begin;",
    `delete from public.trips where id in (${tripIdList()});`,
    "commit;",
    "",
  ].join("\n");
}
