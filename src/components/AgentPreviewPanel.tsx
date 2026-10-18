'use client'

import { useState, useEffect } from 'react'
import { AgentCategory, AgentTool, TOOL_LABELS } from '@/types'
import { BusinessTemplate } from '@/lib/agentUtils'
import { AgentBuilderState, CATEGORY_FILTER } from '@/components/AgentBuilderForm'
import { Pencil, Plus, X, Clock, Lightbulb, Sparkles, MessageSquare, Mic, ImageIcon, FileText, BellRing, Languages, Search } from 'lucide-react'

interface ModuleDef { key: string; label: string; icon: string }
const MODULE_CATALOG: ModuleDef[] = [
  { key: 'stock',     label: 'স্টক',          icon: '📦' },
  { key: 'sales',     label: 'বিক্রি',         icon: '📈' },
  { key: 'customer',  label: 'কাস্টমার',       icon: '👥' },
  { key: 'due',       label: 'বাকি',           icon: '৳' },
  { key: 'invoice',   label: 'ইনভয়েস',        icon: '🧾' },
  { key: 'supplier',  label: 'সরবরাহকারী',     icon: '🚚' },
  { key: 'report',    label: 'রিপোর্ট',        icon: '📊' },
  { key: 'appointment', label: 'অ্যাপয়েন্টমেন্ট', icon: '📅' },
  { key: 'attendance', label: 'উপস্থিতি',      icon: '✅' },
]
const DEFAULT_MODULES: Record<AgentCategory, string[]> = {
  business: ['stock', 'sales', 'customer', 'due', 'invoice', 'supplier', 'report'],
  education: ['customer', 'attendance', 'due', 'report'],
  health: ['customer', 'appointment', 'report'],
  finance: ['due', 'customer', 'report'],
  agriculture: ['stock', 'sales', 'report'],
  festival: ['due', 'report'],
  service: ['customer', 'due', 'report'],
  other: ['customer', 'report'],
}

const TOOL_ICON: Record<AgentTool, React.ReactNode> = {
  memory: <MessageSquare size={12} />,
  calculations: <Sparkles size={12} />,
  web_search: <Search size={12} />,
  reminders: <BellRing size={12} />,
  reports: <FileText size={12} />,
  sms_alert: <BellRing size={12} />,
}
// A couple of always-on capabilities the wizard doesn't let you turn off,
// shown for parity with the reference design ("টেক্সট চ্যাট", "ভয়েস ইনপুট" etc).
const FIXED_CAPS = [
  { label: 'টেক্সট চ্যাট', icon: <MessageSquare size={12} /> },
  { label: 'ভয়েস ইনপুট', icon: <Mic size={12} /> },
  { label: 'ছবি পড়া', icon: <ImageIcon size={12} /> },
  { label: 'বাংলায় উত্তর', icon: <Languages size={12} /> },
]

export default function AgentPreviewPanel({ s }: { s: AgentBuilderState }) {
  const { step, setStep, selectedTemplate, setSelectedTemplate, form, setForm } = s
  const [modules, setModules] = useState<string[]>(DEFAULT_MODULES.business)
  const [showAddModule, setShowAddModule] = useState(false)

  const category = selectedTemplate?.category || form.category
  // reset suggested modules whenever a different template is picked
  useEffect(() => { setModules(DEFAULT_MODULES[category] || DEFAULT_MODULES.other) }, [selectedTemplate?.id]) // eslint-disable-line
  const activeModules = modules

  const removeModule = (key: string) => setModules(activeModules.filter(m => m !== key))
  const addModule = (key: string) => { setModules([...activeModules, key]); setShowAddModule(false) }
  const availableToAdd = MODULE_CATALOG.filter(m => !activeModules.includes(m.key))

  const toggleTool = (key: AgentTool) => setForm(f => ({ ...f, tools: f.tools.includes(key) ? f.tools.filter(t => t !== key) : [...f.tools, key] }))

  const catMeta = CATEGORY_FILTER.find(c => c.key === category)

  const checklist = [
    { label: 'Template নির্বাচন', done: !!selectedTemplate || step > 1 },
    { label: 'প্রয়োজন অনুযায়ী কাস্টমাইজেশন', done: step > 1 && !!form.name.trim() },
    { label: 'একটি টেস্ট', done: step === 3 },
    { label: 'Agent চালু', done: step === 3 },
  ]

  return (
    <div className="space-y-5">
      {/* Live setup preview */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-[14px] bengali">Agent সেটআপ (পূর্বভাস)</h3>
          {selectedTemplate && (
            <button onClick={() => { setSelectedTemplate(null); setStep(1) }} className="flex items-center gap-1 text-[11.5px] font-semibold text-indigo-600 bengali">
              <Pencil size={11} /> পরিবর্তন করুন
            </button>
          )}
        </div>

        {!selectedTemplate ? (
          <div className="text-center py-8 text-gray-400 text-[12.5px] bengali">কোনো template এখনো নির্বাচিত হয়নি</div>
        ) : (
          <>
            <div className="flex items-center gap-3 p-3 rounded-xl mb-4" style={{ background: selectedTemplate.light }}>
              <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center text-xl flex-shrink-0">{selectedTemplate.icon}</div>
              <div className="min-w-0">
                <div className="font-bold text-gray-900 text-[13.5px] bengali truncate">{selectedTemplate.name_bn}</div>
                <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/70 bengali" style={{ color: selectedTemplate.accent }}>নির্বাচিত</span>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[11px] font-bold text-gray-400 bengali mb-1.5">ব্যবসার ধরন</div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-[12px] font-semibold bengali">
                {catMeta?.icon} {catMeta?.label}
              </span>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] font-bold text-gray-400 bengali">সক্রিয় মডিউল (প্রস্তাবিত)</div>
                <div className="relative">
                  <button onClick={() => setShowAddModule(v => !v)} className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200"><Plus size={11} /></button>
                  {showAddModule && availableToAdd.length > 0 && (
                    <div className="absolute right-0 top-6 z-20 bg-white border border-gray-100 rounded-xl shadow-lg w-44 py-1 max-h-48 overflow-y-auto">
                      {availableToAdd.map(m => (
                        <button key={m.key} onClick={() => addModule(m.key)} className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-[12px] text-gray-700 hover:bg-gray-50 bengali">
                          <span>{m.icon}</span>{m.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeModules.map(key => {
                  const m = MODULE_CATALOG.find(x => x.key === key)
                  if (!m) return null
                  return (
                    <span key={key} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold bengali">
                      {m.icon} {m.label}
                      <button onClick={() => removeModule(key)} className="w-4 h-4 rounded-full hover:bg-indigo-100 flex items-center justify-center"><X size={9} /></button>
                    </span>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-gray-400 bengali mb-1.5">AI সক্ষমতা (প্রস্তাবিত)</div>
              <div className="flex flex-wrap gap-1.5">
                {FIXED_CAPS.map(c => (
                  <span key={c.label} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 text-[11px] font-semibold bengali">{c.icon}{c.label}</span>
                ))}
                {(Object.entries(TOOL_LABELS) as [AgentTool, typeof TOOL_LABELS[AgentTool]][]).map(([key, val]) => (
                  <button key={key} onClick={() => toggleTool(key)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bengali transition-colors ${
                      form.tools.includes(key) ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                    }`}>
                    {TOOL_ICON[key]}{val.bn}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Time-to-ready checklist */}
      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100 p-5">
        <div className="flex items-center gap-2 mb-3 text-indigo-700 font-bold text-[13px] bengali"><Clock size={14} /> প্রায় ৫-১০ মিনিটে আপনার Agent প্রস্তুত হবে</div>
        <div className="space-y-1.5">
          {checklist.map(c => (
            <div key={c.label} className={`flex items-center gap-2 text-[12px] bengali ${c.done ? 'text-indigo-700' : 'text-indigo-400'}`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${c.done ? 'bg-indigo-600 text-white' : 'bg-white border border-indigo-200'}`}>
                {c.done ? '✓' : ''}
              </span>
              {c.label}
            </div>
          ))}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-3 font-bold text-gray-800 text-[13px] bengali"><Lightbulb size={14} className="text-amber-500" /> কোন template বেছে নেবেন?</div>
        <ul className="space-y-1.5 text-[12px] text-gray-500 bengali">
          <li className="flex gap-1.5"><span className="text-indigo-400">✓</span> আপনার ব্যবসার ধরন নির্বাচন করুন</li>
          <li className="flex gap-1.5"><span className="text-indigo-400">✓</span> প্রয়োজনীয় মডিউলগুলো চালু করুন</li>
          <li className="flex gap-1.5"><span className="text-indigo-400">✓</span> পরে যেকোনো সময় পরিবর্তন করতে পারবেন</li>
        </ul>
      </div>
    </div>
  )
}
