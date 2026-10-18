import type { Db } from './server'
import { nextNo } from './server'
import { logComm } from './comms'
import { normMobile, isValidMobile } from './util'
import { LEAD_SOURCES } from './constants'

export interface IntakeInput {
  name?: string | null
  mobile?: string | null
  email?: string | null
  company?: string | null
  occasion?: string | null
  message?: string | null
  source?: string | null
  external_id?: string | null     // social sender id when there is no phone number
  meta?: any
}

export interface IntakeResult { status: 'created' | 'duplicate' | 'rejected'; lead_id?: string; lead_no?: string; reason?: string }

/** One entry point for every channel (website form, Meta lead ads, DMs, Excel). Never creates a second lead for the same phone / social id. */
export async function intakeLead(db: Db, i: IntakeInput): Promise<IntakeResult> {
  const source = (LEAD_SOURCES as readonly string[]).includes(String(i.source)) ? String(i.source) : 'website'
  const mobile = normMobile(i.mobile) || null
  const name = String(i.name || '').trim() || (mobile ? `Lead ${mobile}` : '')
  if (mobile && !isValidMobile(mobile)) return { status: 'rejected', reason: 'Invalid mobile number' }
  if (!mobile && !i.external_id && !i.email) return { status: 'rejected', reason: 'Needs a mobile number, email or social id' }
  if (!name && !i.email) return { status: 'rejected', reason: 'Name is required' }
  const message = i.message ? String(i.message).slice(0, 2000) : null

  // duplicate? same phone (lead or customer) or same social id
  let existing: { id: string; lead_no: string | null } | null = null
  if (mobile) {
    const { data } = await db.from('rv_leads').select('id,lead_no').eq('mobile_norm', mobile).order('created_at', { ascending: false }).limit(1).maybeSingle()
    existing = data
    if (!existing) {
      const { data: cust } = await db.from('rv_customers').select('id').eq('mobile_norm', mobile).maybeSingle()
      if (cust) {
        await logComm(db, { customer_id: cust.id, channel: 'note', direction: 'in', mobile, body: `New ${source} enquiry from existing customer: ${message || '(no message)'}`, meta: i.meta })
        return { status: 'duplicate', reason: 'Existing customer' }
      }
    }
  }
  if (!existing && i.external_id) {
    const { data } = await db.from('rv_leads').select('id,lead_no').eq('external_id', i.external_id).limit(1).maybeSingle()
    existing = data
  }
  if (existing) {
    await logComm(db, { lead_id: existing.id, channel: 'note', direction: 'in', mobile, body: `Enquiry again via ${source}: ${message || '(no message)'}`, meta: i.meta })
    await db.from('rv_leads').update({ next_followup_at: new Date().toISOString() }).eq('id', existing.id)
    return { status: 'duplicate', lead_id: existing.id, lead_no: existing.lead_no || undefined }
  }

  const { data: lead, error } = await db.from('rv_leads').insert({
    lead_no: await nextNo(db, 'lead', 'RV-L-', 5),
    name: name || String(i.email), company: i.company || null, mobile, mobile_norm: mobile, email: i.email || null,
    source, stage: 'new', occasion: i.occasion || null, external_id: i.external_id || null,
    notes: message ? `[${source}] ${message}` : `Created automatically from ${source}.`,
    next_followup_at: new Date().toISOString(),
  }).select('id,lead_no').single()
  if (error || !lead) return { status: 'rejected', reason: error?.message || 'Could not save' }
  if (message) await logComm(db, { lead_id: lead.id, channel: 'note', direction: 'in', mobile, body: message, meta: i.meta })
  return { status: 'created', lead_id: lead.id, lead_no: lead.lead_no || undefined }
}
