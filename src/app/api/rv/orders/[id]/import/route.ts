import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/rv/server'
import { checkAddress, isValidMobile, normMobile, isValidPincode } from '@/lib/rv/util'

export const dynamic = 'force-dynamic'

interface InRow {
  name?: string; mobile?: string; address_line?: string; landmark?: string; pincode?: string | number
  zone?: string; instructions?: string; items_note?: string; card_message?: string
}

/**
 * Bulk recipient upload. The browser parses the Excel/CSV and posts mapped rows.
 *  - Rejected (error report): missing name, bad mobile, duplicate of an earlier row / existing recipient.
 *  - Imported with a warning: missing/invalid PIN or short address -> status "pending" so the
 *    WhatsApp -> AI call -> human call chase picks it up.
 *  - Complete addresses supplied by the customer are imported as "verified" (can be turned off).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['sales', 'ops'])
  if (!g.ok) return g.res
  const { db, staff } = g

  const body = await req.json().catch(() => ({}))
  const rows: InRow[] = Array.isArray(body.rows) ? body.rows : []
  const markVerified = body.mark_complete_verified !== false
  const dryRun = !!body.dry_run
  if (!rows.length) return fail('No rows received')
  if (rows.length > 1000) return fail('Maximum 1000 rows per upload. Please split the file.')

  const { data: order } = await db.from('rv_orders').select('id,order_no,status').eq('id', params.id).maybeSingle()
  if (!order) return fail('Order not found', 404)
  if (['cancelled', 'closed'].includes(order.status)) return fail('This order is closed.')

  const { data: existing } = await db.from('rv_recipients').select('mobile_norm,address_line,name,pincode').eq('order_id', params.id)
  const seen = new Set<string>()
  const key = (m: string, pin: string, name: string) => `${m}|${pin}|${name.toLowerCase().trim()}`
  ;(existing || []).forEach(e => seen.add(key(e.mobile_norm || '', e.pincode || '', e.name || '')))

  const rejected: { row: number; name: string; reason: string }[] = []
  const warnings: { row: number; name: string; reason: string }[] = []
  const toInsert: any[] = []
  let seq = (existing || []).length

  rows.forEach((r, idx) => {
    const rowNo = idx + 2 // spreadsheet row (header = 1)
    const name = String(r.name ?? '').trim()
    const mobileRaw = String(r.mobile ?? '').trim()
    const pin = String(r.pincode ?? '').trim().replace(/\.0$/, '')
    const line = String(r.address_line ?? '').trim()

    if (!name) { rejected.push({ row: rowNo, name: '', reason: 'Recipient name is missing' }); return }
    if (mobileRaw && !isValidMobile(mobileRaw)) { rejected.push({ row: rowNo, name, reason: `Invalid mobile number "${mobileRaw}"` }); return }
    const k = key(normMobile(mobileRaw), pin, name)
    if (seen.has(k)) { rejected.push({ row: rowNo, name, reason: 'Duplicate recipient (same name, mobile and PIN)' }); return }
    seen.add(k)

    const chk = checkAddress({ name, address_line: line, pincode: pin, mobile: mobileRaw })
    if (!chk.ok) {
      const probs = chk.problems.filter(p => !p.startsWith('Recipient name'))
      warnings.push({ row: rowNo, name, reason: `${probs.join('; ')} - queued for address collection` })
    }
    if (!mobileRaw) warnings.push({ row: rowNo, name, reason: 'No mobile number - WhatsApp/AI call not possible, needs manual follow-up' })

    seq += 1
    toInsert.push({
      delivery_no: `${order.order_no}-${String(seq).padStart(3, '0')}`,
      order_id: params.id,
      name,
      mobile: mobileRaw || null,
      mobile_norm: normMobile(mobileRaw) || null,
      address_line: line || null,
      landmark: String(r.landmark ?? '').trim() || null,
      pincode: isValidPincode(pin) ? pin : (pin || null),
      zone: String(r.zone ?? '').trim() || null,
      instructions: String(r.instructions ?? '').trim() || null,
      items_note: String(r.items_note ?? '').trim() || null,
      card_message: String(r.card_message ?? '').trim() || null,
      address_status: chk.ok && markVerified ? 'verified' : 'pending',
      verified_at: chk.ok && markVerified ? new Date().toISOString() : null,
      verified_by: chk.ok && markVerified ? staff.id : null,
    })
  })

  if (!dryRun && toInsert.length) {
    // insert in chunks so a big sheet never exceeds request limits
    for (let i = 0; i < toInsert.length; i += 200) {
      const { error } = await db.from('rv_recipients').insert(toInsert.slice(i, i + 200))
      if (error) return fail(`Import stopped: ${error.message}`, 400)
    }
    await audit(db, staff, 'rv_recipients', params.id, 'bulk_import', { inserted: toInsert.length, rejected: rejected.length })
  }

  return NextResponse.json({
    dry_run: dryRun,
    total: rows.length,
    inserted: dryRun ? 0 : toInsert.length,
    valid: toInsert.length,
    rejected,
    warnings,
  })
}
