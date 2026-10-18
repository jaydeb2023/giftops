import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit, nextNo, pick } from '@/lib/rv/server'
import { RESOURCES } from '@/lib/rv/resources'
import { normMobile } from '@/lib/rv/util'

export const dynamic = 'force-dynamic'

/** GET /api/rv/r/:resource?q=&limit=&offset=&<filter>=  -> { data, count } */
export async function GET(req: NextRequest, { params }: { params: { resource: string } }) {
  const cfg = RESOURCES[params.resource]
  if (!cfg) return fail('Unknown resource', 404)
  const g = await guard(cfg.read)
  if (!g.ok) return g.res
  const { db } = g

  const sp = req.nextUrl.searchParams
  let q = db.from(cfg.table).select(cfg.select, { count: 'exact' })

  for (const f of cfg.filters || []) {
    const v = sp.get(f)
    if (v !== null && v !== '') q = q.eq(f, v === 'true' ? true : v === 'false' ? false : v)
  }
  // date range helpers: ?from=YYYY-MM-DD&to=YYYY-MM-DD applies to the default order column
  const orderCol = cfg.order?.col || 'created_at'
  const from = sp.get('from'), to = sp.get('to')
  if (from) q = q.gte(orderCol, from)
  if (to) q = q.lte(orderCol, to + 'T23:59:59')

  const term = (sp.get('q') || '').trim().replace(/[,()%]/g, ' ')
  if (term && cfg.search?.length) {
    q = q.or(cfg.search.map(c => `${c}.ilike.%${term}%`).join(','))
  }

  const limit = Math.min(Number(sp.get('limit') || 200), 1000)
  const offset = Math.max(Number(sp.get('offset') || 0), 0)
  q = q.order(orderCol, { ascending: cfg.order?.asc ?? false }).range(offset, offset + limit - 1)

  const { data, error, count } = await q
  if (error) return fail(error.message, 500)
  return NextResponse.json({ data: data || [], count: count ?? (data || []).length })
}

/** POST /api/rv/r/:resource  (creates). Leads/customers return 409 + duplicate on same mobile unless force. */
export async function POST(req: NextRequest, { params }: { params: { resource: string } }) {
  const cfg = RESOURCES[params.resource]
  if (!cfg) return fail('Unknown resource', 404)
  const g = await guard(cfg.write)
  if (!g.ok) return g.res
  const { db, staff } = g

  const body = await req.json().catch(() => ({}))
  let row = pick(body, cfg.fields)
  for (const r of cfg.required || []) {
    if (row[r] === undefined || row[r] === null || row[r] === '') return fail(`${r.replace(/_/g, ' ')} is required`)
  }
  if (cfg.prepare) row = cfg.prepare(row)

  if (params.resource === 'leads') {
    if (!row.owner_id && staff.role === 'sales') row.owner_id = staff.id
    if (row.stage === 'lost' && !row.lost_reason) return fail('Lost reason is required when a lead is marked lost')
  }
  if (params.resource === 'orders' && !row.owner_id) row.owner_id = staff.id

  // Duplicate detection by mobile (leads + customers)
  if ((params.resource === 'leads' || params.resource === 'customers') && row.mobile_norm && !body.force) {
    const dupes: any[] = []
    const { data: dl } = await db.from('rv_leads').select('id,lead_no,name,company,mobile,stage').eq('mobile_norm', row.mobile_norm).limit(5)
    const { data: dc } = await db.from('rv_customers').select('id,customer_no,name,company,mobile').eq('mobile_norm', row.mobile_norm).limit(5)
    ;(dl || []).forEach(d => dupes.push({ kind: 'lead', ...d }))
    ;(dc || []).forEach(d => dupes.push({ kind: 'customer', ...d }))
    if (dupes.length) return NextResponse.json({ error: 'A record with this mobile number already exists.', code: 'DUPLICATE', duplicates: dupes }, { status: 409 })
  }

  if (cfg.numbering) {
    const n = cfg.numbering
    row[n.column] = await nextNo(db, n.counter, n.prefix, n.pad ?? 5)
  }

  const { data, error } = await db.from(cfg.table).insert(row).select().single()
  if (error) return fail(error.message, 400)
  if (!cfg.noAudit) await audit(db, staff, cfg.table, data.id, 'create', row)
  return NextResponse.json({ data })
}
