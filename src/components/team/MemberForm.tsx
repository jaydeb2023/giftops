'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Loader2, Plus } from 'lucide-react'
import { POSITION_OPTIONS_BN } from '@/lib/teamPositions'

export interface AgentOption { kind: 'library' | 'custom'; ref: string; label: string }

export interface MemberFormValues {
  name: string
  mobile: string
  email: string
  positionTitle: string
  selectedAgentKeys: string[] // "kind:ref"
}

const emptyValues: MemberFormValues = { name: '', mobile: '', email: '', positionTitle: POSITION_OPTIONS_BN[0], selectedAgentKeys: [] }

// A small custom "checklist dropdown" — visually a single select-like
// trigger (matching the mockup's one-line "এজেন্ট নির্বাচন করুন" field)
// but opens a checklist so more than one agent can still be granted,
// which the DB (team_member_agent_access) already supports.
function AgentMultiSelect({ options, selected, onChange }: { options: AgentOption[]; selected: string[]; onChange: (keys: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const toggle = (key: string) => onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key])
  const label = selected.length === 0 ? 'এজেন্ট নির্বাচন করুন' : selected.length === 1
    ? options.find(o => `${o.kind}:${o.ref}` === selected[0])?.label || `১টি নির্বাচিত`
    : `${selected.length}টি এজেন্ট নির্বাচিত`

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-sm bengali outline-none focus:border-indigo-400 bg-white text-left">
        <span className={selected.length ? 'text-gray-800' : 'text-gray-400'}>{label}</span>
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto p-1.5">
          {options.length === 0 && <p className="text-xs text-gray-400 bengali px-2 py-2">কোনো এজেন্ট পাওয়া যায়নি — আগে একটা এজেন্ট activate করুন।</p>}
          {options.map(o => {
            const key = `${o.kind}:${o.ref}`
            return (
              <label key={key} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer bengali">
                <input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)} />
                {o.label}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function MemberForm({ initial, agentOptions, busy, error, submitLabel, onSubmit }: {
  initial?: Partial<MemberFormValues>
  agentOptions: AgentOption[]
  busy: boolean
  error: string
  submitLabel: string
  onSubmit: (values: MemberFormValues) => void
}) {
  const [values, setValues] = useState<MemberFormValues>({ ...emptyValues, ...initial })
  const set = <K extends keyof MemberFormValues>(k: K, v: MemberFormValues[K]) => setValues(prev => ({ ...prev, [k]: v }))

  const canSubmit = values.mobile.trim().length >= 8 && !!values.email.trim()

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 bengali mb-1">নাম</label>
      <input value={values.name} onChange={e => set('name', e.target.value)}
        placeholder="কর্মীর নাম লিখুন"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 bengali outline-none focus:border-indigo-400" />

      <label className="block text-xs font-semibold text-gray-500 bengali mb-1">মোবাইল *</label>
      <input value={values.mobile} onChange={e => set('mobile', e.target.value)}
        placeholder="01XXXXXXXXX"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-indigo-400" />

      <label className="block text-xs font-semibold text-gray-500 bengali mb-1">ইমেইল *</label>
      <input type="email" value={values.email} onChange={e => set('email', e.target.value)}
        placeholder="example@gmail.com"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-indigo-400" />

      <label className="block text-xs font-semibold text-gray-500 bengali mb-1">পদবী</label>
      <select value={values.positionTitle} onChange={e => set('positionTitle', e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 bengali outline-none focus:border-indigo-400">
        {POSITION_OPTIONS_BN.map(p => <option key={p} value={p}>{p}</option>)}
      </select>

      <label className="block text-xs font-semibold text-gray-500 bengali mb-1.5">আসাইন এজেন্ট</label>
      <div className="mb-4">
        <AgentMultiSelect options={agentOptions} selected={values.selectedAgentKeys} onChange={keys => set('selectedAgentKeys', keys)} />
      </div>

      {error && <p className="text-red-600 text-xs bengali mb-3">{error}</p>}

      <button onClick={() => canSubmit && onSubmit(values)} disabled={busy || !canSubmit}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg px-5 py-2.5 text-sm bengali">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
        {busy ? 'যোগ হচ্ছে…' : submitLabel}
      </button>
    </div>
  )
}
