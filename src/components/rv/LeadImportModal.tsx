'use client'
import { useState } from 'react'
import { FileSpreadsheet, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/rv/client'
import { Button, ErrorNote, Modal } from './ui'

const COLS: { key: string; match: RegExp }[] = [
  { key: 'name', match: /name/i }, { key: 'mobile', match: /mobile|phone|contact no|whats/i }, { key: 'email', match: /mail/i },
  { key: 'company', match: /company|organi|firm/i }, { key: 'source', match: /source|channel/i }, { key: 'occasion', match: /occasion|event/i }, { key: 'notes', match: /note|remark|message|requirement/i },
]

export default function LeadImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [file, setFile] = useState('')
  const [res, setRes] = useState<any>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const close = () => { setRows([]); setFile(''); setRes(null); setErr(''); onClose() }

  const template = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([['Name', 'Mobile', 'Email', 'Company', 'Source', 'Occasion', 'Notes'], ['Asha Roy', '9830012345', 'asha@example.com', 'Acme Pvt Ltd', 'instagram', 'Diwali', 'Wants 100 gift boxes']])
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Leads'); XLSX.writeFile(wb, 'giftops-lead-template.xlsx')
  }
  const onFile = async (f: File) => {
    setErr(''); setRes(null)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
      const data = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false })
      if (!data.length) return setErr('The file has no rows.')
      const hs = Object.keys(data[0]); const map: Record<string, string> = {}
      COLS.forEach(c => { const h = hs.find(h => c.match.test(h) && !Object.values(map).includes(h)); if (h) map[c.key] = h })
      if (!map.name && !map.mobile) return setErr('Could not find a Name or Mobile column. Use the template.')
      setRows(data.map(r => Object.fromEntries(COLS.map(c => [c.key, map[c.key] ? r[map[c.key]] : '']))))
      setFile(f.name)
    } catch (e: any) { setErr('Could not read this file: ' + e.message) }
  }
  const run = async () => {
    setBusy(true); setErr('')
    try { const r: any = await api('/api/rv/leads/import', { body: { rows } }); setRes(r); toast.success(`${r.created} leads added`); onDone() }
    catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={close} title="Import leads (Excel / CSV)"
      footer={<><Button onClick={close}>{res ? 'Done' : 'Cancel'}</Button>{rows.length > 0 && !res && <Button variant="primary" loading={busy} onClick={run}>Import {rows.length} rows</Button>}</>}>
      <div className="space-y-3 text-sm">
        {err && <ErrorNote>{err}</ErrorNote>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={template}><Download className="h-4 w-4" />Download template</Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 hover:bg-gray-50"><FileSpreadsheet className="h-4 w-4 text-emerald-600" />{file || 'Choose file'}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} /></label>
        </div>
        <p className="text-gray-500">Rows with a mobile number that already exists are skipped, not duplicated. Unknown sources are saved as "manual".</p>
        {res && <div className="rounded-lg bg-gray-50 p-3"><b>{res.created}</b> added, <b>{res.duplicates}</b> already existed, <b>{res.rejected.length}</b> rejected{res.rejected.slice(0, 8).map((r: any) => <div key={r.row} className="text-xs text-red-600">Row {r.row}: {r.reason}</div>)}</div>}
      </div>
    </Modal>
  )
}
