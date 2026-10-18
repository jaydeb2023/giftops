import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/rv/server'
import { intakeLead } from '@/lib/rv/leadIntake'

export const dynamic = 'force-dynamic'

/** Bulk import of past enquiries. { rows: [{name, mobile, email, company, source, occasion, notes}], dry_run? } */
export async function POST(req: NextRequest) {
  const g = await guard(['sales'])
  if (!g.ok) return g.res
  const { rows, dry_run } = await req.json().catch(() => ({}))
  if (!Array.isArray(rows) || !rows.length) return fail('No rows')
  if (rows.length > 2000) return fail('Import at most 2000 rows at a time')
  const out = { created: 0, duplicates: 0, rejected: [] as { row: number; name: string; reason: string }[] }
  const seen = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || {}
    const key = String(r.mobile || '').replace(/\D/g, '').slice(-10)
    if (key && seen.has(key)) { out.duplicates++; continue }
    if (key) seen.add(key)
    if (dry_run) {
      if (!String(r.name || '').trim() && !key) out.rejected.push({ row: i + 2, name: '', reason: 'Name or mobile needed' }); else out.created++
      continue
    }
    const res = await intakeLead(g.db, { name: r.name, mobile: r.mobile, email: r.email, company: r.company, occasion: r.occasion, message: r.notes, source: String(r.source || 'manual').toLowerCase().replace(/\s+/g, '_') })
    if (res.status === 'created') out.created++
    else if (res.status === 'duplicate') out.duplicates++
    else out.rejected.push({ row: i + 2, name: String(r.name || ''), reason: res.reason || 'Rejected' })
  }
  if (!dry_run) await audit(g.db, g.staff, 'rv_leads', null, 'import', { created: out.created, duplicates: out.duplicates, rejected: out.rejected.length })
  return NextResponse.json({ ...out, dry_run: !!dry_run })
}
