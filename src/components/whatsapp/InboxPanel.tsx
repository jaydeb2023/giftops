'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Search, Send, Bot, BotOff, Loader2, Check, CheckCheck, AlertCircle, ArrowLeft, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { WhatsAppContact, WhatsAppMessage } from '@/types/whatsapp'

export default function InboxPanel() {
  const [contacts, setContacts]   = useState<WhatsAppContact[]>([])
  const [active, setActive]       = useState<WhatsAppContact | null>(null)
  const [messages, setMessages]   = useState<WhatsAppMessage[]>([])
  const [q, setQ]                 = useState('')
  const [loading, setLoading]     = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [draft, setDraft]         = useState('')
  const [sending, setSending]     = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadContacts = useCallback(async () => {
    const res = await fetch(`/api/whatsapp/contacts${q ? `?q=${encodeURIComponent(q)}` : ''}`)
    const json = await res.json()
    setContacts(json.contacts || [])
    setLoading(false)
  }, [q])

  const loadMessages = useCallback(async (contactId: string) => {
    setLoadingMsgs(true)
    const res = await fetch(`/api/whatsapp/messages?contact_id=${contactId}`)
    const json = await res.json()
    setMessages(json.messages || [])
    setLoadingMsgs(false)
  }, [])

  useEffect(() => { loadContacts() }, [loadContacts])

  // Poll while a thread is open so incoming replies appear without a refresh.
  useEffect(() => {
    if (!active) return
    loadMessages(active.id)
    const id = setInterval(() => { loadMessages(active.id); loadContacts() }, 12000)
    return () => clearInterval(id)
  }, [active, loadMessages, loadContacts])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!draft.trim() || !active) return
    setSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: active.id, body: draft }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDraft('')
      setActive(a => (a ? { ...a, is_bot_paused: true } : a))
      loadMessages(active.id)
    } catch (e: any) {
      toast.error(e.message || 'পাঠানো যায়নি')
    } finally {
      setSending(false)
    }
  }

  const toggleBot = async () => {
    if (!active) return
    const next = !active.is_bot_paused
    await fetch('/api/whatsapp/contacts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: active.id, is_bot_paused: next }),
    })
    setActive({ ...active, is_bot_paused: next })
    toast.success(next ? 'বট থামানো হলো — এখন আপনি উত্তর দিন' : 'বট আবার চালু')
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex h-[calc(100vh-280px)] min-h-[460px]">
      {/* ── Contact list ── */}
      <aside className={`w-full sm:w-72 border-r border-gray-100 flex flex-col ${active ? 'hidden sm:flex' : 'flex'}`}>
        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="খুঁজুন..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-gray-50 text-[12px] bengali focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
          </div>
          <button onClick={loadContacts} className="p-2 rounded-lg hover:bg-gray-100">
            <RefreshCw size={13} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center text-[12px] text-gray-400 bengali">লোড হচ্ছে...</div>
          ) : contacts.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-gray-400 bengali">
              এখনও কোনো মেসেজ আসেনি। কাস্টমার আপনার WhatsApp নম্বরে মেসেজ করলে এখানে দেখাবে।
            </div>
          ) : contacts.map(c => (
            <button key={c.id} onClick={() => setActive(c)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-b border-gray-50 transition-colors ${
                active?.id === c.id ? 'bg-emerald-50' : 'hover:bg-gray-50'
              }`}>
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-[13px] font-extrabold text-gray-500 flex-shrink-0">
                {(c.name || c.wa_id).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-gray-800 truncate bengali">{c.name || c.wa_id}</div>
                <div className="text-[10px] text-gray-400 truncate">
                  {c.is_bot_paused ? '👤 আপনি উত্তর দিচ্ছেন' : '🤖 বট চালু'}
                </div>
              </div>
              {c.unread_count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold flex-shrink-0">
                  {c.unread_count}
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* ── Thread ── */}
      <section className={`flex-1 flex flex-col ${active ? 'flex' : 'hidden sm:flex'}`}>
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-gray-400 bengali">
            একটি কথোপকথন বেছে নিন
          </div>
        ) : (
          <>
            <header className="px-4 py-3 border-b border-gray-100 flex items-center gap-2.5">
              <button onClick={() => setActive(null)} className="sm:hidden p-1.5 rounded-lg hover:bg-gray-100">
                <ArrowLeft size={15} className="text-gray-500" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-extrabold text-gray-900 truncate bengali">
                  {active.name || active.wa_id}
                </div>
                <div className="text-[10px] text-gray-400">+{active.wa_id}</div>
              </div>
              <button onClick={toggleBot} title={active.is_bot_paused ? 'বট চালু করুন' : 'বট থামান'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bengali transition-colors ${
                  active.is_bot_paused ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                }`}>
                {active.is_bot_paused ? <BotOff size={12} /> : <Bot size={12} />}
                {active.is_bot_paused ? 'বট বন্ধ' : 'বট চালু'}
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#F7F8FA]">
              {loadingMsgs && messages.length === 0 ? (
                <div className="text-center text-[12px] text-gray-400 bengali py-8">লোড হচ্ছে...</div>
              ) : messages.map(m => <Bubble key={m.id} m={m} />)}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-gray-100 flex items-end gap-2">
              <textarea
                rows={1} value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="উত্তর লিখুন..."
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 text-[13px] bengali resize-none max-h-28 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
              <button onClick={send} disabled={sending || !draft.trim()}
                className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center flex-shrink-0 transition-colors">
                {sending ? <Loader2 size={15} className="text-white animate-spin" /> : <Send size={15} className="text-white" />}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function Bubble({ m }: { m: WhatsAppMessage }) {
  const out = m.direction === 'outbound'
  const time = new Date(m.created_at).toLocaleTimeString('bn-IN', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${
        out ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
      }`}>
        <p className="text-[13px] whitespace-pre-wrap break-words bengali">{m.body}</p>
        <div className={`flex items-center gap-1 mt-1 text-[9px] ${out ? 'text-emerald-100 justify-end' : 'text-gray-400'}`}>
          {m.ai_generated && <span className="font-bold">AI</span>}
          {m.ai_generated && m.response_ms ? <span>· {(m.response_ms / 1000).toFixed(1)}s</span> : null}
          <span>{time}</span>
          {out && (
            m.status === 'failed'    ? <AlertCircle size={10} /> :
            m.status === 'read'      ? <CheckCheck size={11} /> :
            m.status === 'delivered' ? <CheckCheck size={11} className="opacity-60" /> :
                                       <Check size={11} className="opacity-60" />
          )}
        </div>
        {m.status === 'failed' && m.error_message && (
          <p className="text-[10px] text-red-200 mt-1 break-words">{m.error_message}</p>
        )}
      </div>
    </div>
  )
}
