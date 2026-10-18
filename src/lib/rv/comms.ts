import type { Db } from './server'
import { normMobile } from './util'

export interface CommInput {
  lead_id?: string | null
  customer_id?: string | null
  order_id?: string | null
  recipient_id?: string | null
  channel: 'whatsapp' | 'call' | 'ai_call' | 'sms' | 'email' | 'note'
  direction?: 'in' | 'out'
  mobile?: string | null
  body?: string | null
  status?: string | null
  outcome?: string | null
  provider_ref?: string | null
  owner_id?: string | null
  next_action?: string | null
  meta?: any
}

export async function logComm(db: Db, c: CommInput) {
  const { data, error } = await db.from('rv_communications').insert({
    lead_id: c.lead_id ?? null,
    customer_id: c.customer_id ?? null,
    order_id: c.order_id ?? null,
    recipient_id: c.recipient_id ?? null,
    channel: c.channel,
    direction: c.direction ?? 'out',
    mobile_norm: normMobile(c.mobile) || null,
    body: c.body ?? null,
    status: c.status ?? null,
    outcome: c.outcome ?? null,
    provider_ref: c.provider_ref ?? null,
    owner_id: c.owner_id ?? null,
    next_action: c.next_action ?? null,
    meta: c.meta ?? null,
  }).select().single()
  if (error) console.error('[rv comms] log failed', error.message)
  return data
}

export async function openTask(db: Db, t: {
  kind: 'follow_up' | 'address' | 'exception' | 'other'
  title: string
  due_at?: string | null
  assigned_to?: string | null
  lead_id?: string | null
  order_id?: string | null
  recipient_id?: string | null
}) {
  // avoid duplicate open tasks of the same kind for the same recipient/lead
  let q = db.from('rv_tasks').select('id').eq('status', 'open').eq('kind', t.kind)
  if (t.recipient_id) q = q.eq('recipient_id', t.recipient_id)
  else if (t.lead_id) q = q.eq('lead_id', t.lead_id).eq('title', t.title)
  else if (t.order_id) q = q.eq('order_id', t.order_id).eq('title', t.title)
  const { data: dup } = await q.limit(1)
  if (dup && dup.length) return dup[0]
  const { data } = await db.from('rv_tasks').insert({
    kind: t.kind,
    title: t.title,
    due_at: t.due_at ?? new Date(Date.now() + 4 * 3600e3).toISOString(),
    assigned_to: t.assigned_to ?? null,
    lead_id: t.lead_id ?? null,
    order_id: t.order_id ?? null,
    recipient_id: t.recipient_id ?? null,
  }).select().single()
  return data
}
