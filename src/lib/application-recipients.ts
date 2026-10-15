/** Quiénes reciben el aviso de una solicitud: la dueña del viaje y las organizadoras (nunca tour leaders), sin repetir. */
export function organizerRecipientIds(ownerId: string, members: { user_id: string; role: string }[]): string[] {
  const ids = [ownerId, ...members.filter((m) => m.role === "organizadora").map((m) => m.user_id)];
  return [...new Set(ids)];
}
