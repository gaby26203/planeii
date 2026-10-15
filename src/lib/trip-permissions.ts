// Claves de permisos granulares que el owner puede activar/desactivar
// por miembro de viaje. Cuando `trip_members.permissions` es null,
// se aplican los defaults del rol.

export type TripPermKey =
  | "ver_finanzas"
  | "editar_costos"
  | "editar_itinerario"
  | "editar_proveedores"
  | "gestionar_viajeras"
  | "registrar_pagos"
  | "editar_extras"
  | "marcar_operativo";

export interface TripPermMap {
  ver_finanzas: boolean;
  editar_costos: boolean;
  editar_itinerario: boolean;
  editar_proveedores: boolean;
  gestionar_viajeras: boolean;
  registrar_pagos: boolean;
  editar_extras: boolean;
  marcar_operativo: boolean;
}

export const PERM_LABELS: Record<TripPermKey, { title: string; desc: string }> = {
  ver_finanzas: { title: "Ver finanzas", desc: "Costos, resumen y montos del viaje" },
  editar_costos: { title: "Editar costos", desc: "Agregar/modificar costos del viaje" },
  editar_itinerario: { title: "Editar itinerario", desc: "Modificar días y actividades" },
  editar_proveedores: { title: "Editar proveedores", desc: "Gestionar proveedores del viaje" },
  gestionar_viajeras: { title: "Gestionar viajeras", desc: "Inscribir, editar y eliminar viajeras" },
  registrar_pagos: { title: "Registrar pagos", desc: "Cobrar cuotas y abonos" },
  editar_extras: { title: "Editar extras", desc: "Agregar y cobrar servicios adicionales" },
  marcar_operativo: { title: "Marcar operativo", desc: "Check-ins y notas del día" },
};

// Defaults por rol (se usan cuando `permissions` es null).
export function defaultsForRole(role: "organizadora" | "tour_leader"): TripPermMap {
  if (role === "organizadora") {
    return {
      ver_finanzas: true,
      editar_costos: true,
      editar_itinerario: true,
      editar_proveedores: true,
      gestionar_viajeras: true,
      registrar_pagos: true,
      editar_extras: true,
      marcar_operativo: true,
    };
  }
  // tour_leader: solo operativo
  return {
    ver_finanzas: false,
    editar_costos: false,
    editar_itinerario: false,
    editar_proveedores: false,
    gestionar_viajeras: false,
    registrar_pagos: false,
    editar_extras: false,
    marcar_operativo: true,
  };
}

export function normalize(input: unknown, role: "organizadora" | "tour_leader"): TripPermMap {
  const base = defaultsForRole(role);
  if (!input || typeof input !== "object") return base;
  const src = input as Record<string, unknown>;
  const out: TripPermMap = { ...base };
  (Object.keys(base) as TripPermKey[]).forEach((k) => {
    if (typeof src[k] === "boolean") out[k] = src[k] as boolean;
  });
  return out;
}

export const PERM_KEYS: TripPermKey[] = [
  "ver_finanzas",
  "editar_costos",
  "editar_itinerario",
  "editar_proveedores",
  "gestionar_viajeras",
  "registrar_pagos",
  "editar_extras",
  "marcar_operativo",
];
