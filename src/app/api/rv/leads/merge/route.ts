import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'

/** Merge duplicate lead `merge_id` into `keep_id`: fills blanks, moves history, deletes the duplicate. */
export async function POST(req: NextRequest) {
  const g = await guard(['sales'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const { keep_id, merge_id } = await req.json().catch(() => ({}))
  if (!keep_id || !merge_id || keep_id === merge_id) return fail('keep_id and merge_id are required and must differ')

  const { data: keep } = await db.from('rv_leads').select('*').eq('id', keep_id).maybeSingle()
  const { data: dup } = await db.from('rv_leads').select('*').eq('id', merge_id).maybeSingle()
  if (!keep || !dup) return fail('Lead not found', 404)

  const patch: Record<string, any> = {}
  for (const k of ['company', 'email', 'mobile', 'mobile_norm', 'occasion', 'expected_value', 'owner_id', 'customer_id', 'next_followup_at']) {
    if ((keep[k] === null || keep[k] === '') && dup[k]) patch[k] = dup[k]
  }
  if (dup.notes) patch.notes = [keep.notes, `[merged from ${dup.lead_no}] ${dup.notes}`].filter(Boolean).join('\n')
  if (Object.keys(patch).length) await db.from('rv_leads').update(patch).eq('id', keep_id)

  await db.from('rv_communications').update({ lead_id: keep_id }).eq('lead_id', merge_id)
  await db.from('rv_tasks').update({ lead_id: keep_id }).eq('lead_id', merge_id)
  await db.from('rv_orders').update({ lead_id: keep_id }).eq('lead_id', merge_id)
  await db.from('rv_leads').delete().eq('id', merge_id)
  await audit(db, staff, 'rv_leads', keep_id, 'merge', { merged: dup.lead_no, removed_id: merge_id, filled: patch })
  return NextResponse.json({ ok: true })
}
