// Fire-and-forget audit logging — a logging failure must never break
// the real action it's describing, so every call is wrapped and errors
// are only console.error'd, never thrown.
export async function logAudit(
  supabase: any,
  params: {
    ownerUserId: string
    actorId: string
    actorLabel?: string
    action: string
    targetTable?: string
    targetId?: string
    details?: Record<string, any>
  }
) {
  try {
    await supabase.from('audit_logs').insert({
      owner_user_id: params.ownerUserId,
      actor_id: params.actorId,
      actor_label: params.actorLabel || '',
      action: params.action,
      target_table: params.targetTable || null,
      target_id: params.targetId || null,
      details: params.details || {},
    })
  } catch (e) {
    console.error('logAudit error:', e)
  }
}
