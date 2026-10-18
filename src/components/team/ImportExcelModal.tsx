'use client'

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { X, UploadCloud, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

interface ParsedRow { name?: string; mobile?: string; email: string; positionTitle?: string }
interface ResultRow { email: string; ok: boolean; error?: string }

const HEADER_ALIASES: Record<string, keyof ParsedRow> = {
  name: 'name', নাম: 'name',
  mobile: 'mobile', phone: 'mobile', মোবাইল: 'mobile',
  email: 'email', ইমেইল: 'email',
  position: 'positionTitle', title: 'positionTitle', পদবী: 'positionTitle', role: 'positionTitle',
}

function normalizeRow(raw: Record<string, any>): ParsedRow | null {
  const row: ParsedRow = { email: '' }
  for (const [key, value] of Object.entries(raw)) {
    const mapped = HEADER_ALIASES[key.trim().toLowerCase()]
    if (mapped && value != null && String(value).trim()) (row as any)[mapped] = String(value).trim()
  }
  return row.email ? row : null
}

export default function ImportExcelModal({ userId, onClose, onDone }: {
  userId: string
  onClose: () => void
  onDone: () => void // caller reloads the member list
}) {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<ResultRow[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setParseError(''); setResults(null); setFileName(file.name)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' })
      const parsed = json.map(normalizeRow).filter((r): r is ParsedRow => !!r)
      if (!parsed.length) {
        setParseError('কোনো বৈধ সারি পাওয়া যায়নি। কলামে name, mobile, email, position থাকা দরকার।')
      }
      setRows(parsed)
    } catch (e) {
      console.error(e)
      setParseError('ফাইলটি পড়া যায়নি। .xlsx, .xls বা .csv ফাইল দিন।')
    }
  }

  const submit = async () => {
    if (!rows.length) return
    setBusy(true)
    try {
      const res = await fetch('/api/team/bulk-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, rows }),
      })
      const data = await res.json()
      if (!res.ok) { setParseError(data.error || 'সমস্যা হয়েছে।'); setBusy(false); return }
      setResults(data.results || [])
      onDone()
    } catch {
      setParseError('সমস্যা হয়েছে, আবার চেষ্টা করুন।')
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-bold text-gray-900 bengali">Excel থেকে কর্মী Import করুন</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X size={16} /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {!results ? (
            <>
              <p className="text-xs text-gray-500 bengali">
                একটি .xlsx / .xls / .csv ফাইল দিন — প্রথম সারিতে হেডার (name, mobile, email, position) থাকা দরকার।
              </p>
              <button onClick={() => inputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 hover:border-indigo-300 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 hover:text-indigo-500 transition-colors">
                <UploadCloud size={28} />
                <span className="text-sm font-medium bengali">{fileName || 'ফাইল বেছে নিতে ক্লিক করুন'}</span>
              </button>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

              {parseError && <p className="text-red-600 text-xs bengali">{parseError}</p>}

              {rows.length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-2 bengali">
                    <FileSpreadsheet size={14} /> {rows.length} জন পাওয়া গেছে
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-gray-50">
                    {rows.slice(0, 20).map((r, i) => (
                      <div key={i} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-700 truncate">{r.name || '—'}</span>
                        <span className="text-gray-400 truncate">{r.email}</span>
                      </div>
                    ))}
                    {rows.length > 20 && <div className="px-3 py-2 text-[11px] text-gray-400 bengali">+ আরও {rows.length - 20} জন</div>}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-800 bengali mb-2">
                {results.filter(r => r.ok).length} / {results.length} জন সফলভাবে যোগ হয়েছে
              </p>
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-xl">
                {results.map((r, i) => (
                  <div key={i} className="px-3 py-2 text-xs flex items-center justify-between gap-2">
                    <span className="truncate text-gray-600">{r.email}</span>
                    {r.ok
                      ? <span className="flex items-center gap-1 text-emerald-600 font-medium flex-shrink-0"><CheckCircle2 size={13} /> যোগ হয়েছে</span>
                      : <span className="flex items-center gap-1 text-red-500 font-medium flex-shrink-0"><XCircle size={13} /> {r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 flex-shrink-0">
          {!results ? (
            <>
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:bg-gray-50 bengali">বাতিল</button>
              <button onClick={submit} disabled={!rows.length || busy}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 bengali flex items-center gap-2">
                {busy && <Loader2 size={14} className="animate-spin" />} Import করুন
              </button>
            </>
          ) : (
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 bengali">বন্ধ করুন</button>
          )}
        </div>
      </div>
    </div>
  )
}
