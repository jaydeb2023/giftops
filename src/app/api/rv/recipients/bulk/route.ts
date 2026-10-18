import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'

/** Bulk edits for packing / planning: { ids: [], patch: { zone?, packed?, qc_ok? } } */
export async function POST(req: NextRequest) {
  const g = await guard(['ops', 'sales'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const { ids, patch } = await req.json().catch(() => ({}))
  if (!Array.isArray(ids) || !ids.length) return fail('Select at least one recipient')
  if (ids.length > 1000) return fail('Too many rows selected')
  const row: Record<string, any> = {}
  if (patch?.zone !== undefined) row.zone = patch.zone || null
  if (patch?.packed !== undefined) {
    row.packed = !!patch.packed
    row.packed_by = patch.packed ? staff.id : null
    row.packed_at = patch.packed ? new Date().toISOString() : null
  }
  if (patch?.qc_ok !== undefined) row.qc_ok = patch.qc_ok
  if (!Object.keys(row).length) return fail('Nothing to update')
  const { error } = await db.from('rv_recipients').update(row).in('id', ids)
  if (error) return fail(error.message, 400)
  await audit(db, staff, 'rv_recipients', null, 'bulk_update', { count: ids.length, patch: row })
  return NextResponse.json({ ok: true, updated: ids.length })
}
