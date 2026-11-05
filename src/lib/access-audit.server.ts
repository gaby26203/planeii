// Helper server-only para escribir en la bitácora de accesos.
// Se importa dinámicamente dentro de handlers de server functions.

type AuditAction =
  | "member_added"
  | "member_updated"
  | "member_removed"
  | "invitation_created"
  | "invitation_updated"
  | "invitation_revoked"
  | "invitation_accepted"
  | "owner_granted"
  | "owner_revoked";

export interface AuditEntry {
  action: AuditAction;
  actorId?: string | null;
  actorEmail?: string | null;
  tripId?: string | null;
  targetUserId?: string | null;
  targetEmail?: string | null;
  details?: Record<string, unknown>;
}

export async function logAccessAudit(entry: AuditEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("access_audit_log").insert({
      action: entry.action,
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      trip_id: entry.tripId ?? null,
      target_user_id: entry.targetUserId ?? null,
      target_email: entry.targetEmail?.toLowerCase() ?? null,
      details: (entry.details ?? {}) as any,
    });
  } catch (e) {
    // La bitácora no debe romper la operación principal.
    console.error("[access-audit] failed to log entry", e);
  }
}
