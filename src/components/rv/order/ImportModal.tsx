'use client'
import { useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, downloadText } from '@/lib/rv/client'
import { toCsv } from '@/lib/rv/util'
import { Button, ErrorNote, Modal, Table, Td } from '../ui'

const TARGETS: { key: string; label: string; match: RegExp }[] = [
  { key: 'name', label: 'Recipient name', match: /^(recipient|receiver|name|full ?name|recipient ?name|customer ?name)$/i },
  { key: 'mobile', label: 'Mobile', match: /(mobile|phone|contact|whatsapp|cell)/i },
  { key: 'address_line', label: 'Address', match: /^(address|full ?address|address ?line|address ?1|delivery ?address|street)/i },
  { key: 'landmark', label: 'Landmark', match: /landmark/i },
  { key: 'pincode', label: 'PIN code', match: /(pin|postal|zip)/i },
  { key: 'zone', label: 'Zone / area', match: /(zone|area|locality|cluster)/i },
  { key: 'instructions', label: 'Delivery instructions', match: /(instruction|remark|note)/i },
  { key: 'items_note', label: 'Gift / items', match: /(gift|item|product|hamper)/i },
  { key: 'card_message', label: 'Card message', match: /(card|message|greeting|wish)/i },
]

export const TEMPLATE_HEADERS = ['Name', 'Mobile', 'Address', 'Landmark', 'PIN code', 'Zone', 'Instructions', 'Gift / items', 'Card message']

export async function downloadTemplate() {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ['Rina Sen', '9830012345', 'Flat 3B, 12 Park Street, Kolkata', 'Near Park Street Metro', '700016', 'Central', 'Call before delivery', 'Sweet box + card', 'Happy Diwali!'],
  ])
  ws['!cols'] = TEMPLATE_HEADERS.map(() => ({ wch: 24 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Recipients')
  XLSX.writeFile(wb, 'giftops-recipient-template.xlsx')
}

interface Result { dry_run: boolean; total: number; inserted: number; valid: number; rejected: { row: number; name: string; reason: string }[]; warnings: { row: number; name: string; reason: string }[] }

export default function ImportModal({ orderId, open, onClose, onDone }: { orderId: string; open: boolean; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [map, setMap] = useState<Record<string, string>>({})
  const [fileName, setFileName] = useState('')
  const [markVerified, setMarkVerified] = useState(true)
  const [res, setRes] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const reset = () => { setRows([]); setHeaders([]); setMap({}); setFileName(''); setRes(null); setErr('') }
  const close = () => { reset(); onClose() }

  const onFile = async (file: File) => {
    setErr(''); setRes(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '', raw: false })
      if (!data.length) return setErr('The file has no data rows.')
      const hs = Object.keys(data[0])
      const m: Record<string, string> = {}
      TARGETS.forEach(t => { const h = hs.find(h => t.match.test(h.trim()) && !Object.values(m).includes(h)); if (h) m[t.key] = h })
      setRows(data); setHeaders(hs); setMap(m); setFileName(file.name)
    } catch (e: any) { setErr('Could not read this file: ' + e.message) }
  }

  const mapped = () => rows.map(r => {
    const o: Record<string, any> = {}
    TARGETS.forEach(t => { if (map[t.key]) o[t.key] = r[map[t.key]] })
    return o
  })

  const run = async (dry: boolean) => {
    if (!map.name) return setErr('Tell me which column holds the recipient name.')
    setBusy(true); setErr('')
    try {
      const r = await api<Result>(`/api/rv/orders/${orderId}/import`, { body: { rows: mapped(), dry_run: dry, mark_complete_verified: markVerified } })
      setRes(r)
      if (!dry) { toast.success(`${r.inserted} recipients imported`); onDone() }
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  const errorReport = () => {
    if (!res) return
    const csv = toCsv([
      ...res.rejected.map(r => ({ type: 'REJECTED', row: r.row, name: r.name, reason: r.reason })),
      ...res.warnings.map(r => ({ type: 'WARNING', row: r.row, name: r.name, reason: r.reason })),
    ], ['type', 'row', 'name', 'reason'])
    downloadText('recipient-import-report.csv', csv)
  }

  return (
    <Modal open={open} onClose={close} title="Upload recipients (Excel / CSV)" wide
      footer={<>
        <Button onClick={close}>{res && !res.dry_run ? 'Done' : 'Cancel'}</Button>
        {rows.length > 0 && !(res && !res.dry_run) && <Button onClick={() => run(true)} loading={busy}>Check file</Button>}
        {rows.length > 0 && !(res && !res.dry_run) && <Button variant="primary" onClick={() => run(false)} loading={busy}>Import {rows.length} rows</Button>}
      </>}>
      <div className="space-y-4">
        {err && <ErrorNote>{err}</ErrorNote>}
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />{fileName || 'Choose .xlsx / .xls / .csv file'}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          <Button size="sm" onClick={downloadTemplate}><Download className="h-3.5 w-3.5" />Download template</Button>
        </div>

        {rows.length > 0 && !(res && !res.dry_run) && (
          <>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Match your columns ({rows.length} rows found)</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {TARGETS.map(t => (
                  <label key={t.key} className="block text-xs text-gray-600">{t.label}{t.key === 'name' && <span className="text-red-500"> *</span>}
                    <select className="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" value={map[t.key] || ''} onChange={e => setMap(m => ({ ...m, [t.key]: e.target.value }))}>
                      <option value="">- not in file -</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={markVerified} onChange={e => setMarkVerified(e.target.checked)} />
              Treat complete addresses (full address + valid PIN) as verified. Incomplete ones go to address collection.
            </label>
            <Table head={['#', ...TARGETS.filter(t => map[t.key]).map(t => t.label)]}>
              {mapped().slice(0, 5).map((r, i) => <tr key={i}><Td>{i + 2}</Td>{TARGETS.filter(t => map[t.key]).map(t => <Td key={t.key} className="max-w-[200px] truncate">{String(r[t.key] ?? '')}</Td>)}</tr>)}
            </Table>
          </>
        )}

        {res && (
          <div className="space-y-3">
            <div className={`rounded-lg border px-3 py-2 text-sm ${res.dry_run ? 'border-sky-200 bg-sky-50 text-sky-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
              {res.dry_run
                ? <>Check complete: <b>{res.valid}</b> of {res.total} rows are importable, <b>{res.rejected.length}</b> rejected, <b>{res.warnings.length}</b> warnings. Nothing has been saved yet.</>
                : <><b>{res.inserted}</b> recipients imported. {res.rejected.length} rows were rejected.</>}
            </div>
            {res.rejected.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">Rejected rows (fix and re-upload just these)</div>
                <Table head={['Row', 'Name', 'Reason']}>{res.rejected.slice(0, 50).map((r, i) => <tr key={i}><Td>{r.row}</Td><Td>{r.name || '-'}</Td><Td className="text-red-700">{r.reason}</Td></tr>)}</Table>
              </div>
            )}
            {res.warnings.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-600">Imported with warnings</div>
                <Table head={['Row', 'Name', 'Warning']}>{res.warnings.slice(0, 50).map((r, i) => <tr key={i}><Td>{r.row}</Td><Td>{r.name}</Td><Td className="text-amber-700">{r.reason}</Td></tr>)}</Table>
              </div>
            )}
            {(res.rejected.length > 0 || res.warnings.length > 0) && <Button size="sm" onClick={errorReport}><Download className="h-3.5 w-3.5" />Download error report (CSV)</Button>}
          </div>
        )}
      </div>
    </Modal>
  )
}
