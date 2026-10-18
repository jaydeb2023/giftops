import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'

/**
 * Plan a run.
 *  { add: [recipient_ids], force?: bool }  -> adds stops (verified addresses only unless force)
 *  { remove: [recipient_ids] }             -> takes stops off the run (back to pending)
 *  { order: [recipient_ids in new order] } -> re-sequences stops
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['ops'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const body = await req.json().catch(() => ({}))

  const { data: run } = await db.from('rv_delivery_runs').select('*').eq('id', params.id).maybeSingle()
  if (!run) return fail('Run not found', 404)
  if (['completed', 'cancelled'].includes(run.status)) return fail('This run is closed.')

  if (Array.isArray(body.add) && body.add.length) {
    const { data: recs } = await db.from('rv_recipients').select('id,name,address_status,delivery_status,run_id,zone').in('id', body.add)
    const list = recs || []
    const unverified = list.filter(r => r.address_status !== 'verified')
    if (unverified.length && !body.force) {
      return fail(`${unverified.length} selected address(es) are not verified yet: ${unverified.slice(0, 5).map(r => r.name).join(', ')}${unverified.length > 5 ? '...' : ''}`, 409, { code: 'UNVERIFIED', ids: unverified.map(r => r.id) })
    }
    const ok = list.filter(r => ['pending', 'failed', 'returned'].includes(r.delivery_status) || (r.run_id === null && r.delivery_status === 'assigned'))
    const { data: last } = await db.from('rv_recipients').select('stop_seq').eq('run_id', params.id).order('stop_seq', { ascending: false }).limit(1)
    let seq = (last?.[0]?.stop_seq ?? 0)
    for (const r of ok) {
      seq += 1
      await db.from('rv_recipients').update({
        run_id: params.id, stop_seq: seq, delivery_status: 'assigned', zone: r.zone || run.zone || null,
      }).eq('id', r.id)
    }
    await audit(db, staff, 'rv_delivery_runs', params.id, 'assign_stops', { added: ok.length, skipped: list.length - ok.length })
    return NextResponse.json({ ok: true, added: ok.length, skipped: list.length - ok.length })
  }

  if (Array.isArray(body.remove) && body.remove.length) {
    await db.from('rv_recipients').update({ run_id: null, stop_seq: null, delivery_status: 'pending' })
      .in('id', body.remove).eq('run_id', params.id).in('delivery_status', ['assigned'])
    await audit(db, staff, 'rv_delivery_runs', params.id, 'unassign_stops', { removed: body.remove.length })
    return NextResponse.json({ ok: true })
  }

  if (Array.isArray(body.order) && body.order.length) {
    for (let i = 0; i < body.order.length; i++) {
      await db.from('rv_recipients').update({ stop_seq: i + 1 }).eq('id', body.order[i]).eq('run_id', params.id)
    }
    return NextResponse.json({ ok: true })
  }
  return fail('Nothing to do')
}
