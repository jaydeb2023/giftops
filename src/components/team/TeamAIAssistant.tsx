'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Mic, Type, Image as ImageIcon, Paperclip, Loader2, ChevronDown } from 'lucide-react'

interface RosterRow {
  name: string | null
  email: string
  mobile: string | null
  positionTitle: string | null
  status: string
  agents: string[]
  lastActiveAt: string | null
}

interface ChatMsg { role: 'user' | 'assistant'; text: string }

const QUICK_ACTIONS = [
  { key: 'add', label: 'নতুন কর্মী যোগ করা' },
  { key: 'lastlogin', label: 'কোন কর্মী কখন লগইন করেছে?' },
  { key: 'byagent', label: 'এজেন্ট অনুযায়ী টিম দেখাও' },
] as const

const PERSONAS = [
  { key: 'hr', label: 'HR Assistant' },
  { key: 'recruiter', label: 'Recruiter Assistant' },
  { key: 'payroll', label: 'Payroll Assistant' },
] as const
type PersonaKey = typeof PERSONAS[number]['key']

export default function TeamAIAssistant({ roster, onOpenAddForm, onGroupByAgent, onSortByLastActive }: {
  roster: RosterRow[]
  onOpenAddForm: () => void
  onGroupByAgent: () => void
  onSortByLastActive: () => void
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [persona, setPersona] = useState<PersonaKey>('hr')
  const [personaOpen, setPersonaOpen] = useState(false)
  const personaRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, busy])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => { if (personaRef.current && !personaRef.current.contains(e.target as Node)) setPersonaOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const ask = async (text: string) => {
    if (!text.trim() || busy) return
    setMessages(m => [...m, { role: 'user', text }])
    setInput('')
    setBusy(true)
    try {
      const res = await fetch('/api/team/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, roster, persona }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'assistant', text: data.answer || 'উত্তর পাওয়া যায়নি।' }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: 'সমস্যা হয়েছে, আবার চেষ্টা করুন।' }])
    }
    setBusy(false)
  }

  const runQuickAction = (key: typeof QUICK_ACTIONS[number]['key']) => {
    if (key === 'add') { onOpenAddForm(); return }
    if (key === 'byagent') { onGroupByAgent(); setMessages(m => [...m, { role: 'assistant', text: 'তালিকা এখন এজেন্ট অনুযায়ী সাজানো হয়েছে — নিচের টেবিলে দেখুন।' }]); return }
    if (key === 'lastlogin') {
      onSortByLastActive()
      const withLogin = roster.filter(r => r.lastActiveAt).sort((a, b) => new Date(b.lastActiveAt!).getTime() - new Date(a.lastActiveAt!).getTime())
      const line = withLogin.length
        ? withLogin.slice(0, 5).map(r => `${r.name || r.email} — ${new Date(r.lastActiveAt!).toLocaleDateString('bn-BD')}`).join('\n')
        : 'কেউ এখনো লগইন করেননি।'
      setMessages(m => [...m, { role: 'assistant', text: `সাম্প্রতিক লগইন অনুযায়ী তালিকা সাজানো হয়েছে:\n${line}` }])
    }
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-indigo-100 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center text-white text-lg flex-shrink-0">🤖</div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-gray-900 text-sm truncate">AI Assistant</div>
          <div className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Online
          </div>
        </div>
        <div className="relative flex-shrink-0" ref={personaRef}>
          <button onClick={() => setPersonaOpen(o => !o)}
            className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg px-2 py-1.5">
            {PERSONAS.find(p => p.key === persona)?.label}
            <ChevronDown size={12} />
          </button>
          {personaOpen && (
            <div className="absolute right-0 top-8 z-20 bg-white border border-gray-100 rounded-lg shadow-lg py-1 w-40">
              {PERSONAS.map(p => (
                <button key={p.key} onClick={() => { setPersona(p.key); setPersonaOpen(false) }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-gray-50 ${persona === p.key ? 'text-indigo-600' : 'text-gray-600'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-[160px] max-h-72 overflow-y-auto px-4 py-3 space-y-2.5">
        <div className="bg-indigo-50 text-indigo-900 text-[13px] rounded-2xl rounded-tl-sm px-3.5 py-2.5 bengali max-w-[92%]">
          আমি আপনাকে টিম ও কর্মচারী ব্যবস্থাপনায় সাহায্য করতে পারি!
        </div>
        {messages.map((m, i) => (
          <div key={i} className={`text-[13px] rounded-2xl px-3.5 py-2.5 max-w-[92%] whitespace-pre-line bengali ${
            m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm ml-auto' : 'bg-gray-100 text-gray-800 rounded-tl-sm'
          }`}>
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="bg-gray-100 text-gray-400 text-[13px] rounded-2xl rounded-tl-sm px-3.5 py-2.5 flex items-center gap-1.5 w-fit">
            <Loader2 size={13} className="animate-spin" /> <span className="bengali">লিখছে…</span>
          </div>
        )}
      </div>

      <div className="px-3 pb-2 flex-shrink-0 flex flex-col gap-1.5">
        {QUICK_ACTIONS.map(a => (
          <button key={a.key} onClick={() => runQuickAction(a.key)}
            className="w-full text-left text-[12px] font-medium bg-gray-50 hover:bg-indigo-50 text-gray-600 hover:text-indigo-700 border border-gray-100 rounded-lg px-3 py-2 transition-colors bengali flex items-center gap-2">
            <span className="text-indigo-400">›</span> {a.label}
          </button>
        ))}
      </div>

      <div className="border-t border-gray-100 px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-1 mb-2 text-gray-300">
          <button className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center" title="Text"><Type size={13} /></button>
          <button className="w-7 h-7 rounded-lg hover:bg-gray-50 flex items-center justify-center" title="Voice"><Mic size={13} /></button>
          <button className="w-7 h-7 rounded-lg hover:bg-gray-50 flex items-center justify-center" title="Image"><ImageIcon size={13} /></button>
          <button className="w-7 h-7 rounded-lg hover:bg-gray-50 flex items-center justify-center" title="File"><Paperclip size={13} /></button>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') ask(input) }}
            placeholder="আপনার প্রশ্ন লিখুন বা বলুন..."
            className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-[13px] bengali outline-none focus:border-indigo-400"
          />
          <button onClick={() => ask(input)} disabled={busy || !input.trim()}
            className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0">
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
