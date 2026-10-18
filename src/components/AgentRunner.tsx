'use client'
// src/components/AgentRunner.tsx
// ─────────────────────────────────────────────────────────────────
// ONE shared chat panel used by every agent dashboard in the app —
// prebuilt agents, Library (dokan/hotel/mishti/kapor/pharmacy) agents,
// and user-built custom agents. Previously the Library page kept its
// own richer copy of this component (session history, "new chat",
// chat download, edit & resend) while custom-agent dashboards used a
// slimmer version without those features. This file merges the two so
// every template's dashboard has the same chat panel, look and
// functionality — only the backend endpoint/payload differs per agent
// type, picked automatically below.
//
// Endpoint routing:
// - Custom (user-created) agents           → /api/agent-chat   (real data, write-back)
// - Library "business" agents (dokan etc.) → /api/business-chat (real data, write-back)
// - Library pharmacy agent                 → /api/pharmacy-chat (real data, write-back)
// - Everything else (prebuilt agents)      → /api/chat          (generic, no DB)
// ─────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from 'react'
import { Agent } from '@/types'
import {
  Send, Mic, MicOff, Globe, Database, CheckCircle2, ChevronDown, ChevronUp,
  MessageSquarePlus, MessageSquare, History as HistoryIcon, Download, Pencil, X, Check, Loader2,
  Type, Image as ImageIcon, FileText, Trash2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabaseClient'
import { v4 as uuidv4 } from 'uuid'
import { DOKAN_UNITS } from '@/lib/localIntent'
import { formatImageContext, type VisionResult } from '@/lib/chatVocab'
import { useWhisperVoice } from '@/lib/useVoiceInput'
import { fetchVoiceHints } from '@/lib/voiceHints'
import { ALL_UNITS } from '@/lib/stockParser'
import VoiceWaveform from '@/components/VoiceWaveform'
import { LIBRARY_AGENT_IDS, LIBRARY_AGENT_SLUGS } from '@/lib/libraryAgentIds'

// agentSlug → the fixed stock_items.agent_id it writes under (see
// libraryAgentIds.ts). Used by the Image/File "add stock in bulk" flow so
// it can save under the right agent for ANY of the 4 library verticals,
// not just Dokan — the confirmAction round-trip through /api/business-chat
// only supports Dokan today, so bulk items are written directly here
// instead, the same way StockManager.tsx already does.
const LIBRARY_AGENT_ID_BY_SLUG: Record<string, string> = {}
for (const v of Object.keys(LIBRARY_AGENT_IDS) as (keyof typeof LIBRARY_AGENT_IDS)[]) {
  LIBRARY_AGENT_ID_BY_SLUG[LIBRARY_AGENT_SLUGS[v]] = LIBRARY_AGENT_IDS[v]
}

// A proposed stock entry the server understood but has NOT saved yet.
interface PendingStock {
  type: 'add_stock'
  name: string
  heardAs?: string
  qty: number | string
  unit: string
  price: number | string
  cost: number | string
  category?: string
  existingQty?: number | null
  existingUnit?: string | null
  isNew?: boolean
}

// Multiple stock entries read from a photo or an attached product-list
// file (see the "Image"/"File" input modes below) — reviewed and edited
// as a batch before any of them are saved.
interface PendingStockBulkItem {
  name: string
  qty: number | string
  unit: string
  unit_cost: number | string
  sell_price: number | string
  category: string
  expiry?: string   // pharmacy: from a medicine strip / purchase bill (MM/YY, YYYY-MM …)
  // set when the row was read from the owner's own words (chat / voice):
  heardAs?: string        // what was heard, when it was matched to a different name
  flags?: string[]        // fields the owner must check: name | qty | unit | price | expiry
  note?: string           // short Bengali explanation of what was unclear
  status?: 'ok' | 'check' | 'unknown'
}
interface PendingStockBulk {
  type: 'add_stock_bulk'
  source: 'image' | 'file' | 'chat'
  items: PendingStockBulkItem[]
}

// A sale to a customer the shop hasn't seen before — held for review so a
// mis-heard/garbled voice name never silently becomes a real customer
// record. Sales to already-known customers skip this and save instantly.
interface PendingSaleItem {
  name: string
  qty: number | string
  unit: string
  price: number | string
  paid: number | string
}
interface PendingSale {
  type: 'add_sale'
  customerName: string
  phone?: string
  items: PendingSaleItem[]
}

type Pending = PendingStock | PendingStockBulk | PendingSale

interface Message {
  role: 'user' | 'assistant'
  content: string
  pending?: Pending
  vision?: VisionResult   // result card of a photo the user sent (items read from it, with action buttons)
  pendingState?: 'open' | 'saving' | 'done' | 'cancelled'
  saved?: number          // how many records were auto-saved (custom agents)
  savedIntents?: any[]
  dataRefs?: any[]        // row ids this reply wrote — used by edit & resend
}

interface Props {
  agent: Agent | typeof import('@/types').PREBUILT_AGENTS[0] | any
  agentId?: string
  isCustomAgent?: boolean     // true = user-created, uses /api/agent-chat
  userId?: string             // enables 24h chat history + persistence
  businessName?: string       // passed through to business/pharmacy endpoints
  agentSlugOverride?: string  // Library pages already know their resolved slug
  onDataChange?: () => void   // let the dashboard panel refetch after a save
  externalPrompt?: { text: string; nonce: number } // e.g. a suggestion chip click from a wrapper panel — sends automatically when nonce changes
  quickPrompts?: string[]    // override the default category quick-replies with a caller-supplied list, shown as a vertical stack; omit to keep the default horizontal pills
  compact?: boolean          // fill the parent's height (100%) instead of a fixed 600px — for embedding in a sidebar panel with its own height (e.g. the Overview page's AI Assistant panel)
  onSend?: () => void        // fires the moment a message (chip or typed) is actually sent — lets a wrapper panel (e.g. AIAssistantPanel) know the conversation has started, so it can get its own static chips out of the way
  focus?: 'all' | 'sales' | 'stock' // Business plan: narrow the chat to sales-only or stock-only work (the server also enforces the caller's role)
  onActivity?: (a: { text: string; kind: string }) => void // a reply that really saved something — lets the wrapper panel update its live feed instantly
  onLoadingChange?: (loading: boolean) => void // mirrors the "AI is thinking" state outward, so a wrapper can show its own busy indicator if it wants one
}

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

function isUUID(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

function agentSlug(name: string) {
  return (name || '').toLowerCase().replace(/[&]/g, 'and').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// Library agents whose chat writes real data via /api/business-chat.
const BUSINESS_AGENT_SLUGS = new Set([
  'kaporer-dokan', 'kaporer-dokan-tracker', 'kapor-dokan',
  'mishti-dokan-manager', 'hotel-and-dhaba-manager',
  'dokan-manager', 'dokan-crm',
])

// Merges a newly-finalized speech chunk into what we've built so far,
// without ever duplicating words. Handles two real-world engine quirks:
//  - the new chunk is a longer restatement that already contains
//    everything we had ("আজকে" → "আজকে আজকে" → keep only the longer one)
//  - the new chunk is a stale repeat already contained in what we have
//    (ignore it)
// Only genuinely new, non-overlapping content gets appended.
function mergeFinalSegment(existing: string, incoming: string): string {
  const e = existing.trim()
  const inc = incoming.trim()
  if (!inc) return e
  if (!e) return inc
  const eLower = e.toLowerCase()
  const incLower = inc.toLowerCase()
  if (incLower.includes(eLower)) return inc   // incoming grew to a superset → replace
  if (eLower.includes(incLower)) return e     // incoming is a stale subset → keep existing
  return `${e} ${inc}`                        // genuinely new, distinct content → append
}

// ── Voice hook — continuous listening, only ever fills the input box.
// Sending is always a separate, explicit user action (tap Send / Enter),
// so a misheard word never goes straight into a saved sale/stock/due row
// unseen. `continuous = true` also means a natural mid-sentence pause
// doesn't cut the recording short.
function useVoice(onFinalResult: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const [lang, setLang] = useState<'bn-IN' | 'en-IN'>('bn-IN')
  const [interim, setInterim] = useState('')
  const ref = useRef<any>(null)
  // A single coalesced string, built with a content-aware merge instead of
  // blind concatenation or index tracking. Two different broken patterns
  // show up in the wild and both need handling:
  //  1. Desktop Chrome (bn-IN): occasionally re-fires an already-final
  //     result under the SAME index.
  //  2. Mobile/Android Chrome (bn-IN): repeatedly re-transcribes the WHOLE
  //     utterance so far as a fresh "final" result under a NEW index each
  //     time, each one longer than the last ("আজকে" → "আজকে আজকে" →
  //     "আজকে আজকে আজকে" → ...). Index-based dedup doesn't catch this
  //     because every restatement gets its own new index.
  // mergeFinalSegment below fixes both: if the incoming chunk already
  // contains everything we have so far, it's a growing restatement →
  // replace. If what we have already contains the incoming chunk, it's a
  // stale repeat → ignore. Only truly new content gets appended.
  const finalRef = useRef('')
  const manualStopRef = useRef(false)

  useEffect(() => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) setSupported(false)
  }, [])

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast.error('Browser voice support নেই'); return }
    if (ref.current) ref.current.stop()
    finalRef.current = ''
    setInterim('')
    manualStopRef.current = false
    const r = new SR()
    ref.current = r
    r.lang = lang
    r.interimResults = true
    r.continuous = true
    r.onstart = () => setListening(true)
    r.onresult = (e: any) => {
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        const transcript = (result[0].transcript || '').trim()
        if (result.isFinal) {
          finalRef.current = mergeFinalSegment(finalRef.current, transcript)
        } else {
          interimText += result[0].transcript
        }
      }
      setInterim(interimText)
    }
    r.onerror = (e: any) => {
      // 'no-speech' just means the browser's own silence timeout fired —
      // not that the user is done. Let onend below handle it (auto-restart),
      // so a pause mid-sentence never ends the recording on its own.
      if (e?.error === 'no-speech') return
      manualStopRef.current = true
      setListening(false)
      setInterim('')
      if (e?.error === 'not-allowed') toast.error('Microphone permission দিন।')
    }
    r.onend = () => {
      // Chrome (especially mobile) silently ends recognition after a short
      // silence even with continuous=true — that's the "time limit" users
      // hit. If the user didn't explicitly tap stop, transparently restart
      // so listening effectively continues until they choose to stop.
      if (!manualStopRef.current) {
        try { r.start() } catch { /* already starting/started — ignore */ }
        return
      }
      setListening(false)
      setInterim('')
      const final = finalRef.current.trim()
        .trim()
      if (final) onFinalResult(final)
    }
    r.start()
  }, [lang, onFinalResult])

  const stop = useCallback(() => { manualStopRef.current = true; ref.current?.stop() }, [])
  useEffect(() => () => ref.current?.abort(), [])
  return { listening, supported, lang, setLang, start, stop, interim }
}

// Signed-in session token — the chat API identifies the caller from this, not from the body.
async function authHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`
  } catch { /* fall through without a token */ }
  return h
}

export default function AgentRunner({
    agent, agentId, isCustomAgent, userId, businessName, agentSlugOverride, onDataChange, externalPrompt, quickPrompts, compact, onSend, onLoadingChange, focus, onActivity,
}: Props) {
  const useRealData = isCustomAgent || (!!agentId && isUUID(agentId))
  const resolvedSlug = agentSlugOverride || agentSlug(agent.name)
  const isPharmacy = !useRealData && (
    resolvedSlug === 'pharmacy-assistant' ||
    agent.name?.toLowerCase().includes('pharmacy') ||
    agent.name_bn?.includes('ফার্মেসি')
  )
  const isBusinessAgent = !useRealData && BUSINESS_AGENT_SLUGS.has(resolvedSlug)
  const writesRealData = useRealData || isPharmacy || isBusinessAgent
  // Where Image/File-extracted stock items get saved (see PendingStockBulk).
  const stockAgentId = isCustomAgent ? (agentId || null) : (LIBRARY_AGENT_ID_BY_SLUG[resolvedSlug] || null)

  const defaultGreeting = (): Message[] => [{
    role: 'assistant',
    content: `নমস্কার! আমি **${agent.name_bn || agent.name}**। ${agent.description_bn || agent.description || ''}\n\nআপনাকে কীভাবে সাহায্য করতে পারি?`,
  }]

  const [messages, setMessages] = useState<Message[]>(defaultGreeting())
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [expandedSave, setExpandedSave] = useState<string | null>(null)
  const [extracting, setExtracting] = useState<'image' | 'file' | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── History key: a stable identity used to save/load chat sessions.
  // Custom agents use their real UUID; library/prebuilt agents use their slug.
  const historyKey = useRealData ? (agentId || 'custom-agent') : resolvedSlug

  // ── 24h session history (shared table across all agent types) ────
  const [sessionId, setSessionId] = useState<string>(() => uuidv4())
  const [historySessions, setHistorySessions] = useState<{ id: string; preview: string; time: string }[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)

  useEffect(() => {
    if (!userId) { setHistoryLoaded(true); return }
    let cancelled = false
    ;(async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('library_chat_messages')
        .select('session_id, role, content, created_at, data_refs')
        .eq('user_id', userId).eq('agent_slug', historyKey)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
      if (error) { console.error('library_chat_messages fetch:', error); if (!cancelled) setHistoryLoaded(true); return }
      if (cancelled) return

      if (data && data.length > 0) {
        const bySession: Record<string, any[]> = {}
        for (const row of data) { (bySession[row.session_id] ||= []).push(row) }
        const sessionIds = Object.keys(bySession)
        const latestId = sessionIds[sessionIds.length - 1]

        setHistorySessions(sessionIds.map(sid => {
          const rows = bySession[sid]
          const firstUserMsg = rows.find(r => r.role === 'user')
          return {
            id: sid,
            preview: (firstUserMsg?.content || rows[0].content).slice(0, 40),
            time: new Date(rows[0].created_at).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }),
          }
        }).reverse())

        setSessionId(latestId)
        setMessages(bySession[latestId].map(r => ({ role: r.role, content: r.content, dataRefs: r.data_refs || [] })))
      }
      setHistoryLoaded(true)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, historyKey])

  const saveMessage = useCallback((role: 'user' | 'assistant', content: string, sid: string, dataRefs?: any[]) => {
    if (!userId) return
    supabase.from('library_chat_messages')
      .insert({ user_id: userId, agent_slug: historyKey, session_id: sid, role, content, data_refs: dataRefs || [] })
      .then(({ error }) => { if (error) console.error('library_chat_messages insert:', error) })
  }, [userId, historyKey])

  const startNewChat = () => {
    setSessionId(uuidv4())
    setMessages(defaultGreeting())
    setShowHistory(false)
    toast.success('নতুন চ্যাট শুরু হলো')
  }

  const openHistorySession = async (sid: string) => {
    if (!userId) return
    const { data, error } = await supabase
      .from('library_chat_messages').select('role, content, data_refs')
      .eq('user_id', userId).eq('agent_slug', historyKey).eq('session_id', sid)
      .order('created_at', { ascending: true })
    if (error) { console.error('library_chat_messages fetch session:', error); return }
    setSessionId(sid)
    setMessages((data && data.length > 0) ? data.map(r => ({ role: r.role, content: r.content, dataRefs: r.data_refs || [] })) : defaultGreeting())
    setShowHistory(false)
  }

  const downloadChat = () => {
    const agentLabel = agent.name_bn || agent.name
    const lines = messages.map(m => {
      const role = m.role === 'user' ? 'আপনি' : agentLabel
      return `[${role}]\n${m.content}\n`
    }).join('\n')
    const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-${historyKey}-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // ── Quick replies per category (shown until the chat gets going) ──
  const quickReplies: Record<string, string[]> = {
    business:    ['আজকের বিক্রি কত?', 'স্টক চেক করো', 'বাকির হিসাব দেখাও', 'এই মাসের লাভ কত?'],
    education:   ['পড়ার রুটিন বানাও', 'কোন subject আগে পড়ব?', 'সময় বাঁচানোর উপায়', 'পরীক্ষার tips দাও'],
    festival:    ['বাজেট কত হলো?', 'কাজের তালিকা দেখাও', 'স্পনসর কারা আছেন?', 'কতদিন বাকি?'],
    finance:     ['এই মাসের খরচ?', 'সঞ্চয় কীভাবে বাড়াবো?', 'বাজেট plan বানাও', 'EMI হিসাব করো'],
    health:      ['আজকের ওষুধ?', 'appointment কবে?', 'স্বাস্থ্য tips দাও', 'রিপোর্ট দেখাও'],
    agriculture: ['এই মাসের কাজ কী?', 'ফসলের দাম কত?', 'আবহাওয়া কেমন?', 'সার কতটুকু দেব?'],
    service:     ['আজকের কাজ কী?', 'payment বাকি কত?', 'স্টক চেক করো', 'মাসের আয় কত?'],
  }
  const qr = quickReplies[agent.category] || []

  const handleVoiceFinal = useCallback((text: string) => {
    setInput(prev => (prev ? `${prev} ${text}` : text))
  }, [])
  const voice = useVoice(handleVoiceFinal)           // browser engine — fallback only
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const getVoiceHint = useCallback(() => fetchVoiceHints(supabase, resolvedSlug, userId), [resolvedSlug, userId])
  // Main voice engine: records audio, Whisper transcribes it on the server (better with
  // Bengali + English mixed speech and this shop's own product names). Text only ever
  // lands in the input box — the user still reviews it and taps Send.
  const whisper = useWhisperVoice({
    onText: (t) => { handleVoiceFinal(t); setTimeout(() => inputRef.current?.focus(), 0) },
    onError: (m) => toast.error(m),
    getHint: getVoiceHint,
    getExtra: () => ({ agent: resolvedSlug || '' }),
    lang: voice.lang === 'en-IN' ? 'en' : 'bn',
  })

  // Set when the user taps ✏️ on an earlier message — resend UPDATES the
  // same sale/stock/due/customer row instead of creating a duplicate.
  const [correcting, setCorrecting] = useState<{ preview: string; previousRefs: any[] } | null>(null)
  // Data read from the last photo. It stays attached to the next few messages, so "এগুলো স্টকে যোগ করো" /
  // "রহিমের নামে বিল করো" work like they do in ChatGPT: the photo is part of the conversation.
  const [imageCtx, setImageCtx] = useState<{ data: VisionResult; left: number } | null>(null)

  const sendMessage = async (text?: string, previousRefsArg?: any[]) => {
    const msg = (typeof text === 'string' ? text : input).trim()
    if (!msg || loading) return
    onSend?.()
    const previousRefs = previousRefsArg || correcting?.previousRefs || []
    setInput('')
    setCorrecting(null)
    const newMessages: Message[] = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    saveMessage('user', msg, sessionId)
    setLoading(true)

    // The model also sees what was read from the photo (the chat window shows only what was typed).
    const attachCtx = !!imageCtx && isBusinessAgent && !!userId
    const bodyMessages = newMessages.map(({ vision, ...m }, i) =>
      attachCtx && i === newMessages.length - 1 && m.role === 'user'
        ? { ...m, content: `${m.content}\n\n${formatImageContext(imageCtx!.data)}` } : m)
    if (imageCtx) setImageCtx(c => (c && c.left > 1 ? { ...c, left: c.left - 1 } : null))

    try {
      let endpoint = '/api/chat'
      let body: any = { messages: bodyMessages, systemPrompt: agent.system_prompt }

      if (useRealData) {
        endpoint = '/api/agent-chat'
        body = { messages: bodyMessages, systemPrompt: agent.system_prompt, agentId, previousRefs, focus }
      } else if (isPharmacy) {
        endpoint = '/api/pharmacy-chat'
        body = { messages: bodyMessages, userId, businessName: businessName || 'আমার ফার্মেসি', focus }
      } else if (isBusinessAgent && userId) {
        endpoint = '/api/business-chat'
        body = { messages: bodyMessages, userId, agentSlug: resolvedSlug, businessName, previousRefs, focus }
      }

      const res = await fetch(endpoint, {
        method: 'POST', headers: await authHeaders(), body: JSON.stringify(body),
      })
      // 401/403 carry a readable explanation (session ended / role not allowed) — show it instead of a generic error
      if (!res.ok && res.status !== 401 && res.status !== 403) throw new Error('Failed')
      const data = await res.json()

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.content,
        saved: data.saved || 0,
        savedIntents: data.savedIntents || [],
        dataRefs: data.dataRefs || [],
        pending: data.pendingAction || undefined,
        pendingState: data.pendingAction ? 'open' : undefined,
      }
      setMessages([...newMessages, assistantMsg])
      saveMessage('assistant', data.content, sessionId, data.dataRefs || [])
      if (data.dataWritten || data.customerSaved || data.saved > 0) {
        onActivity?.({ text: String(data.content || '').replace(/[*_`#]/g, '').split('\n')[0].slice(0, 140), kind: 'other' })
      }

      // ── Client-side insert for mishti (bypasses server RLS issues) ──
      if (data.mishtiAction && resolvedSlug === 'mishti-dokan-manager' && userId) {
        try {
          const parseP = (raw: string) => {
            const r: Record<string, string> = {}
            raw.split(',').forEach((pair: string) => {
              const [k, ...rest] = pair.split('=')
              if (k) r[k.trim().toLowerCase()] = rest.join('=').trim()
            })
            return r
          }
          const todayStr = new Date().toISOString().slice(0, 10)
          const { mishtiAction: ma } = data
          const p = parseP(ma.params)

          if (ma.type === 'add_item') {
            const { error: e } = await supabase.from('mishti_items').insert({
              user_id: userId, name: p.name || 'নতুন মিষ্টি',
              name_bn: p.name_bn || p.name || 'নতুন মিষ্টি',
              category: p.category || 'অন্যান্য',
              price_per_kg: Number(p.price || 0), cost_per_kg: Number(p.cost || 0),
              stock_kg: Number(p.stock || 0), min_stock_kg: Number(p.min_stock || 1),
              shelf_life_days: Number(p.shelf_life || 3),
              is_available: true, made_today_kg: 0, production_date: todayStr,
            })
            if (e) console.error('mishti_items insert:', e.message)
          } else if (ma.type === 'add_customer') {
            const { data: ex } = await supabase.from('mishti_customers').select('id').eq('user_id', userId).eq('phone', p.phone || '').maybeSingle()
            if (!ex) {
              const { error: e } = await supabase.from('mishti_customers').insert({
                user_id: userId, name: p.name || 'নতুন খদ্দের',
                phone: p.phone || '', address: p.address || '', notes: p.notes || '',
                total_due: 0, total_spent: 0, last_purchase: todayStr, is_regular: false,
              })
              if (e) console.error('mishti_customers insert:', e.message)
            }
          } else if (ma.type === 'add_sale') {
            const qty = Number(p.qty_kg || p.qty || 1)
            const price = Number(p.price || 0)
            const paid = Number(p.paid || price * qty)
            const total = qty * price
            const { error: e } = await supabase.from('mishti_sales').insert({
              user_id: userId, item_name: p.item || p.name || 'অজানা',
              quantity_kg: qty, price_per_kg: price, total_amount: total,
              paid_amount: paid, due_amount: Math.max(0, total - paid),
              customer_name: p.customer || 'নগদ', customer_phone: p.phone || '',
              sale_date: todayStr, payment_status: total - paid > 0 ? 'partial' : 'paid',
              occasion: p.occasion || '', notes: '',
            })
            if (e) console.error('mishti_sales insert:', e.message)
          }
        } catch (e) { console.error('Client mishti insert error:', e) }
      }

      // ── Let the dashboard panel refetch after a real-data write ────
      if (writesRealData && onDataChange) {
        setTimeout(() => onDataChange(), 800)
        setTimeout(() => onDataChange(), 2500)
      }
      if (data.saved > 0) toast.success(`✅ ${data.saved}টি তথ্য সংরক্ষিত হয়েছে`, { duration: 3000 })
      if (data.patientSaved) toast.success('রোগী যোগ হয়েছে ✓')
      else if (data.customerSaved) toast.success('খদ্দের যোগ হয়েছে ✓')
      else if (data.dataWritten || data.mishtiAction) toast.success('ডেটা আপডেট হয়েছে ✓')
    } catch {
      toast.error('উত্তর পেতে সমস্যা হয়েছে। আবার চেষ্টা করুন।')
      setMessages(newMessages.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  const lastPromptNonce = useRef<number | null>(null)
  useEffect(() => {
    if (!externalPrompt) return
    if (lastPromptNonce.current === externalPrompt.nonce) return
    lastPromptNonce.current = externalPrompt.nonce
      sendMessage(externalPrompt.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPrompt?.nonce])

  useEffect(() => { onLoadingChange?.(loading) }, [loading, onLoadingChange])

  // ── Confirmation card for "add stock" / new-customer "add sale" (nothing
  // is saved until the owner taps সেভ করুন) ──
  const editPending = (i: number, patch: Partial<PendingStock>) =>
    setMessages(prev => prev.map((m, k) => (k === i && m.pending?.type === 'add_stock' ? { ...m, pending: { ...m.pending, ...patch } } : m)))

  const editPendingSale = (i: number, patch: Partial<Omit<PendingSale, 'items'>>) =>
    setMessages(prev => prev.map((m, k) => (k === i && m.pending?.type === 'add_sale' ? { ...m, pending: { ...m.pending, ...patch } } : m)))

  const editPendingSaleItem = (i: number, itemIdx: number, patch: Partial<PendingSaleItem>) =>
    setMessages(prev => prev.map((m, k) => {
      if (k !== i || m.pending?.type !== 'add_sale') return m
      const items = m.pending.items.map((it, j) => (j === itemIdx ? { ...it, ...patch } : it))
      return { ...m, pending: { ...m.pending, items } }
    }))

  // ── Bulk stock items read from a photo or attached product-list file ──
  const editBulkItem = (i: number, itemIdx: number, patch: Partial<PendingStockBulkItem>) =>
    setMessages(prev => prev.map((m, k) => {
      if (k !== i || m.pending?.type !== 'add_stock_bulk') return m
      const FIELD_FLAG: Record<string, string> = { name: 'name', qty: 'qty', unit: 'unit', sell_price: 'price', unit_cost: 'price', expiry: 'expiry' }
      const items = m.pending.items.map((it, j) => {
        if (j !== itemIdx) return it
        const fixed = Object.keys(patch).map(key => FIELD_FLAG[key]).filter(Boolean)
        const flags = (it.flags || []).filter(f => !fixed.includes(f))
        return { ...it, ...patch, flags, heardAs: 'name' in patch ? '' : it.heardAs, status: flags.some(f => f === 'name' || f === 'qty') ? it.status : 'ok' }
      })
      return { ...m, pending: { ...m.pending, items } }
    }))

  const removeBulkItem = (i: number, itemIdx: number) =>
    setMessages(prev => prev.map((m, k) => {
      if (k !== i || m.pending?.type !== 'add_stock_bulk') return m
      return { ...m, pending: { ...m.pending, items: m.pending.items.filter((_, j) => j !== itemIdx) } }
    }))

  // Bulk items save directly from the client (like StockManager.tsx) rather
  // than round-tripping through /api/business-chat's confirmAction, which
  // today only understands Dokan's single-item add_stock — this way Image/
  // File extraction works for every business vertical and custom agent.
  // "YYYY-MM" (what the pharmacy table stores) from 03/27, 3-2027, 2027-03-15 …
  const toYearMonth = (raw?: string): string => {
    const t = String(raw || '').trim()
    let m = t.match(/^(\d{4})[-/](\d{1,2})/)
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}`
    m = t.match(/^(\d{1,2})[-/ .](\d{2}|\d{4})$/)
    if (m) return `${m[2].length === 2 ? '20' + m[2] : m[2]}-${m[1].padStart(2, '0')}`
    return ''
  }

  // Each library agent keeps its products in ITS OWN table (only Dokan / custom agents use the shared
  // stock_items). Saving a photo / file list anywhere else would put the products where that agent's
  // dashboard and chat never look — so route by agent.
  const confirmBulkStock = async (i: number) => {
    const m = messages[i]
    if (!m?.pending || m.pending.type !== 'add_stock_bulk' || m.pendingState !== 'open' || !userId) return
    const vertical = isCustomAgent ? 'stock' : resolvedSlug
    if (vertical === 'stock' || vertical === 'dokan-manager') {
      if (!stockAgentId) { toast.error('কোন এজেন্টে সেভ হবে বোঝা যায়নি।'); return }
    }
    const items = m.pending.items.filter(it => it.name.trim() && Number(it.qty) > 0)
    if (!items.length) { toast.error('অন্তত একটি সঠিক পণ্য দরকার (নাম ও পরিমাণ)।'); return }
    const skippedRows = m.pending.items.length - items.length
    if (skippedRows > 0) {
      // never silently drop a row — the owner must know which ones still need a name / quantity
      const ok = typeof window !== 'undefined' ? window.confirm(`${skippedRows}টি পণ্যে নাম বা পরিমাণ নেই — সেগুলো বাদ দিয়ে বাকি ${items.length}টি সেভ করবেন?`) : true
      if (!ok) return
    }
    setMessages(prev => prev.map((x, k) => (k === i ? { ...x, pendingState: 'saving' } : x)))
    const esc = (n: string) => n.replace(/[\\%_]/g, ch => '\\' + ch)
    let saved = 0
    try {
      for (const it of items) {
        const name = it.name.trim().slice(0, 60)
        const qty = Number(it.qty) || 0
        const unit = String(it.unit || 'পিস').slice(0, 20)
        const sell = Number(it.sell_price) || 0
        const cost = Number(it.unit_cost) || 0
        const category = it.category || 'অন্যান্য'
        let ok = false

        // [table, name column, quantity column, insert row, price patch on update]
        const upsert = async (table: string, nameCol: string, qtyCol: string, row: any, patchExtra: any) => {
          const { data: found } = await supabase.from(table).select(`id,${qtyCol}`).eq('user_id', userId)
            .ilike(nameCol, esc(name)).limit(1)
          const existing: any = Array.isArray(found) ? found[0] : null
          if (existing) {
            const total = Math.round((Number(existing[qtyCol] || 0) + qty) * 1000) / 1000
            const { error } = await supabase.from(table).update({ [qtyCol]: total, ...patchExtra }).eq('id', existing.id)
            return !error
          }
          const { error } = await supabase.from(table).insert({ user_id: userId, ...row })
          return !error
        }

        if (vertical === 'kaporer-dokan-tracker') {
          ok = await upsert('kapor_products', 'name', 'stock_qty',
            { name, category, stock_qty: qty, min_stock: 5, sell_price: sell, purchase_price: cost, is_available: true },
            { ...(sell > 0 ? { sell_price: sell } : {}), ...(cost > 0 ? { purchase_price: cost } : {}) })
        } else if (vertical === 'mishti-dokan-manager') {
          ok = await upsert('mishti_items', 'name', 'stock_kg',
            { name, name_bn: name, category, stock_kg: qty, price_per_kg: sell, cost_per_kg: cost, is_available: true },
            { ...(sell > 0 ? { price_per_kg: sell } : {}), ...(cost > 0 ? { cost_per_kg: cost } : {}) })
        } else if (vertical === 'hotel-and-dhaba-manager') {
          ok = await upsert('hotel_stock', 'name', 'quantity',
            { name, category, quantity: qty, unit, min_quantity: 5, cost_per_unit: cost },
            cost > 0 ? { cost_per_unit: cost } : {})
        } else if (vertical === 'pharmacy-assistant') {
          const expiry = toYearMonth(it.expiry)
          ok = await upsert('pharmacy_medicines', 'name', 'stock',
            { name, category: category === 'অন্যান্য' ? 'Other' : category, stock: qty, unit: ({ 'পিস': 'strip', 'পাতা': 'strip', 'ট্যাবলেট': 'tablet', 'ক্যাপসুল': 'capsule', 'বোতল': 'bottle', 'প্যাকেট': 'packet', 'বক্স': 'box', 'টিউব': 'tube', 'ভায়াল': 'vial' } as Record<string, string>)[unit] || unit, expiry, mrp: sell, cost_price: cost, min_stock: 20 },
            { ...(sell > 0 ? { mrp: sell } : {}), ...(cost > 0 ? { cost_price: cost } : {}), ...(expiry ? { expiry } : {}), updated_at: new Date().toISOString() })
        } else {
          // Dokan manager + custom agents → shared stock_items
          ok = await upsert('stock_items', 'item_name', 'current_qty',
            { agent_id: stockAgentId, item_name: name, category, unit, current_qty: qty, min_qty: 5, sell_price: sell, unit_cost: cost },
            { ...(sell > 0 ? { sell_price: sell } : {}), ...(cost > 0 ? { unit_cost: cost } : {}) })
        }
        if (ok) saved++
      }
      const content = saved > 0
        ? `✅ ${saved}টি পণ্য স্টকে যোগ/আপডেট হয়েছে।${saved < items.length ? ` (${items.length - saved}টি ব্যর্থ হয়েছে)` : ''}`
        : '⚠️ কোনো পণ্য সেভ করা যায়নি।'
      const nextState: 'done' | 'open' = saved > 0 ? 'done' : 'open'
      setMessages(prev => [
        ...prev.map((x, k) => (k === i ? { ...x, pendingState: nextState } : x)),
        ...(saved > 0 ? [{ role: 'assistant' as const, content }] : []),
      ])
      if (saved > 0) {
        saveMessage('assistant', content, sessionId)
        toast.success(content.replace(/^✅\s*/, ''))
        if (onDataChange) { setTimeout(() => onDataChange(), 500); setTimeout(() => onDataChange(), 2000) }
      } else {
        toast.error('সেভ করা যায়নি। আবার চেষ্টা করুন।')
      }
    } catch (e) {
      console.error('bulk stock save:', e)
      setMessages(prev => prev.map((x, k) => (k === i ? { ...x, pendingState: 'open' as const } : x)))
      toast.error('সেভ করতে সমস্যা হয়েছে।')
    }
  }

  const cancelPending = (i: number) =>
    setMessages(prev => prev.map((m, k) => (k === i ? { ...m, pendingState: 'cancelled' } : m)))

  const confirmPending = async (i: number) => {
    const m = messages[i]
    if (!m?.pending || m.pendingState !== 'open' || !userId) return
    setMessages(prev => prev.map((x, k) => (k === i ? { ...x, pendingState: 'saving' } : x)))
    try {
      const res = await fetch('/api/business-chat', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ userId, agentSlug: resolvedSlug, businessName, confirmAction: m.pending, focus }),
      })
      if (!res.ok && res.status !== 401 && res.status !== 403) throw new Error('Failed')
      const data = await res.json()
      if (data.dataWritten) {
        setMessages(prev => [...prev.map((x, k) => (k === i ? { ...x, pendingState: 'done' as const } : x)), { role: 'assistant' as const, content: data.content }])
        saveMessage('assistant', data.content, sessionId)
        toast.success('✅ স্টকে সেভ হয়েছে')
        onActivity?.({ text: String(data.content || '').replace(/[*_`#]/g, '').split('\n')[0].slice(0, 140), kind: 'other' })
        if (onDataChange) { setTimeout(() => onDataChange(), 500); setTimeout(() => onDataChange(), 2000) }
      } else {
        // validation / database problem — keep the card open so it can be fixed and retried
        setMessages(prev => prev.map((x, k) => (k === i ? { ...x, pendingState: 'open' as const } : x)))
        toast.error(String(data.content || 'সেভ হয়নি').replace(/^⚠️\s*/, ''), { duration: 5000 })
      }
    } catch {
      setMessages(prev => prev.map((x, k) => (k === i ? { ...x, pendingState: 'open' as const } : x)))
      toast.error('সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।')
    }
  }

  const renderPendingSaleCard = (p: PendingSale, i: number, busy: boolean) => {
    const inputCls = 'w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] bengali outline-none focus:border-emerald-400 bg-white'
    return (
      <div className="mt-2 w-full bg-white border border-amber-200 rounded-xl p-3 space-y-2.5">
        <div className="text-[11px] font-bold text-amber-700 bengali">এটা নতুন খদ্দের মনে হচ্ছে — সেভ করার আগে দেখে নিন</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] font-semibold text-gray-500 bengali">খদ্দেরের নাম
            <input className={inputCls} value={p.customerName} disabled={busy} onChange={e => editPendingSale(i, { customerName: e.target.value })} />
          </label>
          <label className="text-[10px] font-semibold text-gray-500 bengali">ফোন (ঐচ্ছিক)
            <input className={inputCls} value={p.phone || ''} disabled={busy} onChange={e => editPendingSale(i, { phone: e.target.value })} />
          </label>
        </div>
        <div className="space-y-2">
          {p.items.map((it, j) => (
            <div key={j} className="grid grid-cols-4 gap-1.5 items-end border-t border-gray-100 pt-2 first:border-t-0 first:pt-0">
              <label className="col-span-4 text-[10px] font-semibold text-gray-500 bengali">পণ্য {p.items.length > 1 ? j + 1 : ''}
                <input className={inputCls} value={it.name} disabled={busy} onChange={e => editPendingSaleItem(i, j, { name: e.target.value })} />
              </label>
              <label className="text-[10px] font-semibold text-gray-500 bengali">পরিমাণ
                <input className={inputCls} inputMode="decimal" value={it.qty} disabled={busy} onChange={e => editPendingSaleItem(i, j, { qty: e.target.value })} />
              </label>
              <label className="text-[10px] font-semibold text-gray-500 bengali">একক
                <select className={inputCls} value={it.unit} disabled={busy} onChange={e => editPendingSaleItem(i, j, { unit: e.target.value })}>
                  {DOKAN_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <label className="text-[10px] font-semibold text-gray-500 bengali">দাম ₹
                <input className={inputCls} inputMode="decimal" value={it.price} disabled={busy} onChange={e => editPendingSaleItem(i, j, { price: e.target.value })} />
              </label>
              <label className="text-[10px] font-semibold text-gray-500 bengali">জমা ₹
                <input className={inputCls} inputMode="decimal" value={it.paid} placeholder="সম্পূর্ণ" disabled={busy} onChange={e => editPendingSaleItem(i, j, { paid: e.target.value })} />
              </label>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => confirmPending(i)} disabled={busy}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[13px] font-bold rounded-lg py-2 bengali">
            {busy ? 'সেভ হচ্ছে…' : '✅ সেভ করুন'}
          </button>
          <button onClick={() => cancelPending(i)} disabled={busy}
            className="px-4 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-600 text-[13px] font-semibold rounded-lg py-2 bengali">
            বাতিল
          </button>
        </div>
      </div>
    )
  }

  // Plain function (NOT a nested component) so inputs keep focus while typing.
  // ── Image / File input modes — read a stock/khata photo or a plain
  // product-list file via /api/stock-extract, then show the result as an
  // editable "add all?" card (renderPendingBulkStockCard) — nothing is
  // saved until the owner reviews and confirms. ──
  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  const fileToText = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })

  // Shrink the photo first: phones take 4–10 MB pictures, the server limit is ~4 MB, and a
  // 1600 px JPEG is still sharper than needed to read handwriting.
  const downscale = (file: File, maxDim = 1600, quality = 0.82): Promise<{ base64: string; mime: string }> =>
    new Promise(resolve => {
      const fallback = async () => resolve({ base64: await fileToBase64(file), mime: file.type })
      try {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
          const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale))
          const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
          const c2d = canvas.getContext('2d')
          if (!c2d) { URL.revokeObjectURL(url); void fallback(); return }
          c2d.drawImage(img, 0, 0, w, h)
          const data = canvas.toDataURL('image/jpeg', quality)
          URL.revokeObjectURL(url)
          resolve({ base64: data.split(',')[1] || '', mime: 'image/jpeg' })
        }
        img.onerror = () => { URL.revokeObjectURL(url); void fallback() }
        img.src = url
      } catch { void fallback() }
    })

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('একটি ছবি ফাইল বেছে নিন'); return }
    setExtracting('image')
    const note = input.trim()      // anything typed before attaching tells the reader what the photo is for
    if (note) setInput('')
    setMessages(prev => [...prev, { role: 'user', content: `📷 ছবি পাঠানো হয়েছে${note ? `: ${note}` : ''}` }])
    try {
      const { base64, mime } = await downscale(file)
      const res = await fetch('/api/vision-extract', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ imageBase64: base64, mimeType: mime, agentSlug: resolvedSlug, instruction: note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Reader unavailable → fall back to the older stock-list reader so the photo is never wasted
        const old = await fetch('/api/stock-extract', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: mime }),
        }).then(r => r.json()).catch(() => ({ items: [] }))
        const oldItems: PendingStockBulkItem[] = (old.items || []).map((it: any) => ({
          name: it.name, qty: it.qty || '', unit: it.unit || 'পিস', unit_cost: it.unit_cost || '', sell_price: it.sell_price || '', category: it.category || 'অন্যান্য',
        }))
        if (oldItems.length) {
          const content = `📝 ছবি থেকে ${oldItems.length}টি পণ্য পেয়েছি। নিচে দেখে, ঠিক করে **সব যোগ করুন** চাপুন।`
          setMessages(prev => [...prev, { role: 'assistant', content, pending: { type: 'add_stock_bulk', source: 'image', items: oldItems }, pendingState: 'open' }])
          saveMessage('assistant', content, sessionId)
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: `😕 ${data?.message || 'ছবিতে কিছু পড়তে পারিনি।'} আরেকটু স্পষ্ট ছবি তুলে আবার চেষ্টা করুন।` }])
        }
        return
      }
      const v = data as VisionResult
      if (!v.items?.length && !v.text) {
        setMessages(prev => [...prev, { role: 'assistant', content: '😕 ছবিতে কিছু পড়তে পারিনি। আলো ঠিক রেখে, লেখাটা পুরো ফ্রেমে এনে আবার তুলুন।' }])
        return
      }
      const content = v.summary || `📷 ছবি থেকে ${v.items.length}টি লাইন পড়েছি।`
      setMessages(prev => [...prev, { role: 'assistant', content, vision: v }])
      saveMessage('assistant', `${content}\n${v.items.map(it => `${it.name} ${it.qty ?? ''}${it.unit ?? ''}`).join(', ')}`, sessionId)
      setImageCtx({ data: v, left: 6 })
    } catch (e) {
      console.error('image read:', e)
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ ছবি পড়তে সমস্যা হয়েছে। আবার চেষ্টা করুন।' }])
    } finally { setExtracting(null) }
  }

  const handleDocFile = async (file: File) => {
    const okExt = /\.(csv|txt)$/i.test(file.name)
    if (!okExt) { toast.error('শুধু .csv বা .txt ফাইল সাপোর্ট করা হয় এখন'); return }
    setExtracting('file')
    setMessages(prev => [...prev, { role: 'user', content: `📎 ফাইল পাঠানো হয়েছে: ${file.name}` }])
    try {
      const textContent = await fileToText(file)
      const res = await fetch('/api/stock-extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textContent }),
      })
      const data = await res.json()
      const items: PendingStockBulkItem[] = (data.items || []).map((it: any) => ({
        name: it.name, qty: it.qty || '', unit: it.unit || 'পিস', unit_cost: it.unit_cost || '', sell_price: it.sell_price || '', category: it.category || 'অন্যান্য',
      }))
      if (!items.length) {
        setMessages(prev => [...prev, { role: 'assistant', content: '😕 ফাইলে কোনো পণ্য পড়তে পারিনি। ফরম্যাট ঠিক আছে কিনা দেখুন।' }])
      } else {
        const content = `📝 ফাইল থেকে ${items.length}টি পণ্য পেয়েছি। নিচে দেখে, ঠিক করে **সব যোগ করুন** চাপুন।`
        setMessages(prev => [...prev, { role: 'assistant', content, pending: { type: 'add_stock_bulk', source: 'file', items }, pendingState: 'open' }])
        saveMessage('assistant', content, sessionId)
      }
    } catch (e) {
      console.error('file stock-extract:', e)
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ ফাইল পড়তে সমস্যা হয়েছে। আবার চেষ্টা করুন।' }])
    } finally { setExtracting(null) }
  }

  const renderPendingBulkStockCard = (p: PendingStockBulk, i: number, busy: boolean) => {
    const inputCls = 'w-full border border-gray-200 rounded-lg px-2 py-1 text-[12px] bengali outline-none focus:border-emerald-400 bg-white'
    const warnCls = ' !border-amber-400 !bg-amber-50'
    const isPharm = resolvedSlug === 'pharmacy-assistant'
    const fl = (it: PendingStockBulkItem, f: string) => (it.flags || []).includes(f)
    // price / expiry are "nice to have" — only the name and quantity block a row
    const incomplete = p.items.filter(it => !String(it.name || '').trim() || !(Number(it.qty) > 0)).length
    const title = p.source === 'image' ? '📷 ছবি থেকে' : p.source === 'file' ? '📎 ফাইল থেকে' : '🗣️ আপনার কথা থেকে'
    return (
      <div className="mt-2 w-full bg-white border border-emerald-200 rounded-xl p-3 space-y-2.5">
        <div className="text-[11px] font-bold text-emerald-700 bengali">
          {title} {p.items.length}টি {isPharm ? 'ওষুধ' : 'পণ্য'} পেয়েছি — সেভ করার আগে দেখে নিন
        </div>
        {incomplete > 0 && <div className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1 bengali">⚠️ {incomplete}টিতে নাম বা পরিমাণ নেই — হলুদ ঘর পূরণ করুন</div>}
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {p.items.map((it, j) => {
            const rowWarn = it.status === 'unknown' || it.status === 'check' || (it.flags || []).some(f => f === 'name' || f === 'qty')
            return (
              <div key={j} className={`border rounded-lg p-2 space-y-1.5 relative ${rowWarn ? 'border-amber-300 bg-amber-50/30' : 'border-gray-100'}`}>
                <button disabled={busy} onClick={() => removeBulkItem(i, j)} className="absolute top-1.5 right-1.5 text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                <div className="text-[10px] font-bold text-gray-400 bengali">#{j + 1}</div>
                <input className={inputCls + ' font-bold pr-6' + (fl(it, 'name') ? warnCls : '')} value={it.name} disabled={busy} onChange={e => editBulkItem(i, j, { name: e.target.value })} placeholder={isPharm ? 'ওষুধের নাম' : 'পণ্যের নাম'} />
                {it.heardAs ? <div className="text-[10px] text-amber-700 bengali">শুনেছি "{it.heardAs}" → "{it.name}" ধরেছি</div> : null}
                <div className="grid grid-cols-3 gap-1.5">
                  <input className={inputCls + (fl(it, 'qty') ? warnCls : '')} type="number" value={it.qty} disabled={busy} onChange={e => editBulkItem(i, j, { qty: e.target.value })} placeholder="পরিমাণ" />
                  <select className={inputCls + (fl(it, 'unit') ? warnCls : '')} value={it.unit} disabled={busy} onChange={e => editBulkItem(i, j, { unit: e.target.value })}>
                    {(ALL_UNITS.includes(it.unit) ? ALL_UNITS : [it.unit, ...ALL_UNITS]).map(u => <option key={u}>{u}</option>)}
                  </select>
                  <input className={inputCls} value={it.category} disabled={busy} onChange={e => editBulkItem(i, j, { category: e.target.value })} placeholder="ক্যাটাগরি" />
                </div>
                <div className={`grid gap-1.5 ${isPharm ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <input className={inputCls} type="number" value={it.unit_cost} disabled={busy} onChange={e => editBulkItem(i, j, { unit_cost: e.target.value })} placeholder="ক্রয়মূল্য ₹" />
                  <input className={inputCls + (fl(it, 'price') ? warnCls : '')} type="number" value={it.sell_price} disabled={busy} onChange={e => editBulkItem(i, j, { sell_price: e.target.value })} placeholder={isPharm ? 'MRP / দাম ₹' : 'বিক্রয়মূল্য ₹'} />
                  {isPharm && <input className={inputCls + (fl(it, 'expiry') ? warnCls : '')} type="month" value={it.expiry || ''} disabled={busy} onChange={e => editBulkItem(i, j, { expiry: e.target.value })} title="মেয়াদ" />}
                </div>
                {it.note ? <div className="text-[10px] text-gray-500 bengali leading-snug">{it.note}</div> : null}
              </div>
            )
          })}
          {p.items.length === 0 && <div className="text-[11px] text-gray-400 bengali text-center py-3">কোনো পণ্য নেই — বাতিল করুন</div>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => confirmBulkStock(i)} disabled={busy || p.items.length === 0}
            className="flex-1 bg-emerald-600 text-white rounded-lg py-2 text-[12px] font-bold bengali disabled:opacity-60 flex items-center justify-center gap-1">
            {busy ? <Loader2 className="animate-spin" size={13} /> : <Check size={13} />} সব যোগ করুন ({p.items.length})
          </button>
          <button onClick={() => cancelPending(i)} disabled={busy} className="px-3 bg-gray-100 text-gray-600 rounded-lg text-[12px] font-bold bengali">বাতিল</button>
        </div>
      </div>
    )
  }

  // ── Photo result card: what was read + one-tap next steps ──
  const KIND_BN: Record<string, string> = {
    handwritten_list: 'হাতে লেখা তালিকা', printed_bill: 'ছাপা বিল', purchase_bill: 'কেনার বিল / চালান', prescription: 'প্রেসক্রিপশন',
    product_label: 'পণ্যের লেবেল', price_list: 'দামের তালিকা', order_note: 'অর্ডার নোট', screenshot: 'স্ক্রিনশট', other: 'ছবি',
  }
  const inlineList = (v: VisionResult) =>
    v.items.map(it => `${it.matched?.name || it.name}${it.qty ? ` ${it.qty}${it.unit ? ' ' + it.unit : ''}` : ''}${it.price ? ` @${it.price}` : ''}`).join(', ')

  const visionAddStock = (v: VisionResult) => {
    const purchase = v.kind === 'purchase_bill'
    const items: PendingStockBulkItem[] = v.items.map(it => ({
      name: it.matched?.name || it.name,
      qty: it.qty ?? '',
      unit: it.unit || it.matched?.unit || 'পিস',
      unit_cost: purchase ? (it.price ?? '') : '',
      sell_price: purchase ? (it.matched?.price ?? it.mrp ?? '') : (it.price ?? it.mrp ?? it.matched?.price ?? ''),
      category: 'অন্যান্য',
      expiry: it.expiry || '',
    } as any))
    const content = `📝 ছবির ${items.length}টি পণ্য স্টকে যোগের জন্য সাজিয়েছি। দেখে, ঠিক করে **সব যোগ করুন** চাপুন।`
    setMessages(prev => [...prev, { role: 'assistant', content, pending: { type: 'add_stock_bulk', source: 'image', items }, pendingState: 'open' }])
    saveMessage('assistant', content, sessionId)
  }
  const visionSell = (v: VisionResult, credit: boolean) => {
    const who = v.partyMatched || v.party?.name
    if (credit && !who) {
      setInput('ছবির এই বিল ____ এর নামে বাকিতে লিখো')
      setTimeout(() => inputRef.current?.focus(), 0)
      toast('কার নামে বাকি — নামটি লিখে পাঠান')
      return
    }
    const tail = credit ? 'বাকিতে লিখো' : 'বিক্রি করো'
    const base = `${who ? `${who}-কে ` : ''}${tail}`
    // Business agents already receive the photo data with the message; other agents need the list in the text.
    sendMessage(isBusinessAgent && userId ? `ছবির এই পণ্যগুলো ${base}` : `${base}: ${inlineList(v)}`)
  }

  const renderVisionCard = (msg: Message, i: number) => {
    const v = msg.vision
    if (!v) return null
    const shown = v.items.slice(0, 12)
    const confCls = v.confidence === 'high' ? 'bg-emerald-50 text-emerald-700' : v.confidence === 'low' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'
    const confBn = v.confidence === 'high' ? 'স্পষ্ট' : v.confidence === 'low' ? 'অস্পষ্ট — মিলিয়ে নিন' : 'মোটামুটি স্পষ্ট'
    return (
      <div key={`vision-${i}`} className="mt-2 ml-9 bg-white border border-indigo-100 rounded-2xl overflow-hidden text-[12px] max-w-[92%]">
        <div className="px-3 py-2 bg-indigo-50 flex items-center justify-between gap-2">
          <span className="font-bold text-indigo-700 bengali flex items-center gap-1.5"><ImageIcon size={13} /> {KIND_BN[v.kind] || 'ছবি'}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bengali ${confCls}`}>{confBn}</span>
        </div>
        {(v.party?.name || v.date) && (
          <div className="px-3 pt-2 text-gray-600 bengali">
            {v.party?.name && <>👤 <b>{v.partyMatched || v.party.name}</b>{v.partyMatched ? ' ✓' : ''}{v.party.phone ? ` · ${v.party.phone}` : ''}</>}
            {v.date && <span className="text-gray-400"> {v.party?.name ? '· ' : ''}{v.date}</span>}
          </div>
        )}
        {shown.length > 0 && (
          <div className="px-3 py-2 overflow-x-auto">
            <table className="w-full min-w-[260px]">
              <thead>
                <tr className="text-[10px] text-gray-400 text-left bengali"><th className="font-semibold pb-1">পণ্য</th><th className="font-semibold pb-1">পরিমাণ</th><th className="font-semibold pb-1 text-right">দর</th><th className="font-semibold pb-1 text-right">টাকা</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {shown.map((it, k) => (
                  <tr key={k}>
                    <td className="py-1 pr-2 bengali">
                      <div className="font-semibold text-gray-800">{it.matched?.name || it.name}</div>
                      <div className="text-[10px] text-gray-400">
                        {it.matched ? <span className="text-emerald-600">✓ আছে</span> : <span className="text-indigo-500">🆕 নতুন</span>}
                        {(it.sku || it.matched?.sku) ? ` · SKU ${it.sku || it.matched?.sku}` : ''}{it.batch ? ` · ব্যাচ ${it.batch}` : ''}{it.expiry ? ` · মেয়াদ ${it.expiry}` : ''}{it.size ? ` · ${it.size}` : ''}
                      </div>
                    </td>
                    <td className="py-1 pr-2 whitespace-nowrap bengali">{it.qty ?? '—'} {it.unit || ''}</td>
                    <td className="py-1 pr-2 text-right whitespace-nowrap">{it.price ? `₹${it.price}` : '—'}</td>
                    <td className="py-1 text-right whitespace-nowrap font-semibold">{it.amount ? `₹${it.amount}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {v.items.length > shown.length && <div className="text-[10px] text-gray-400 bengali mt-1">+ আরও {v.items.length - shown.length}টি</div>}
          </div>
        )}
        {v.totals?.total ? <div className="px-3 pb-2 text-gray-600 bengali">মোট: <b>₹{v.totals.total}</b>{v.totals.paid ? ` · জমা ₹${v.totals.paid}` : ''}{v.totals.due ? ` · বাকি ₹${v.totals.due}` : ''}</div> : null}
        {v.items.length > 0 && (
          <div className="px-3 pb-3 flex flex-wrap gap-1.5">
            <button onClick={() => visionAddStock(v)} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold bengali hover:bg-emerald-700">📦 স্টকে যোগ করুন</button>
            <button onClick={() => visionSell(v, false)} className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-bold bengali hover:bg-indigo-700">🧾 বিল / বিক্রি করুন</button>
            <button onClick={() => visionSell(v, true)} className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-[11px] font-bold bengali hover:bg-rose-100">📒 বাকিতে লিখুন</button>
          </div>
        )}
        {v.text && (
          <details className="px-3 pb-3 text-gray-500">
            <summary className="cursor-pointer text-[11px] font-semibold bengali">পুরো লেখা দেখুন</summary>
            <pre className="mt-1.5 whitespace-pre-wrap text-[11px] leading-snug bengali">{v.text}</pre>
          </details>
        )}
        <div className="px-3 pb-2.5 text-[10px] text-gray-400 bengali">💬 এখন লিখুন বা বলুন — যেমন "এগুলো স্টকে যোগ করো" বা "রহিমের নামে বিল করো"</div>
      </div>
    )
  }

  const renderPendingCard = (msg: Message, i: number) => {
    const p = msg.pending
    if (!p) return null
    if (msg.pendingState === 'done') return <div className="mt-1.5 text-[11px] font-semibold text-emerald-600 bengali">✅ সেভ করা হয়েছে</div>
    if (msg.pendingState === 'cancelled') return <div className="mt-1.5 text-[11px] text-gray-400 bengali">বাতিল করা হয়েছে — কিছু সেভ হয়নি</div>
    const busy = msg.pendingState === 'saving'
    if (p.type === 'add_sale') return renderPendingSaleCard(p, i, busy)
    if (p.type === 'add_stock_bulk') return renderPendingBulkStockCard(p, i, busy)
    const qtyN = Number(String(p.qty).replace(/,/g, ''))
    const showTotal = p.existingQty != null && p.existingUnit === p.unit && Number.isFinite(qtyN)
    const inputCls = 'w-full border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] bengali outline-none focus:border-emerald-400 bg-white'
    return (
      <div className="mt-2 w-full bg-white border border-emerald-200 rounded-xl p-3 space-y-2.5">
        <div className="text-[11px] font-bold text-emerald-700 bengali">সেভ করার আগে দেখে নিন — ভুল থাকলে ঠিক করুন</div>
        {p.heardAs ? <div className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1 bengali">"{p.heardAs}" → আপনার স্টকের "{p.name}" ধরে নিয়েছি</div> : null}
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 text-[10px] font-semibold text-gray-500 bengali">পণ্যের নাম
            <input className={inputCls} value={p.name} disabled={busy} onChange={e => editPending(i, { name: e.target.value, heardAs: '' })} />
          </label>
          <label className="text-[10px] font-semibold text-gray-500 bengali">পরিমাণ
            <input className={inputCls} inputMode="decimal" value={p.qty} disabled={busy} onChange={e => editPending(i, { qty: e.target.value })} />
          </label>
          <label className="text-[10px] font-semibold text-gray-500 bengali">একক
            <select className={inputCls} value={p.unit} disabled={busy} onChange={e => editPending(i, { unit: e.target.value })}>
              {DOKAN_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-semibold text-gray-500 bengali">বিক্রয়মূল্য ₹ (প্রতি {p.unit})
            <input className={inputCls} inputMode="decimal" value={p.price || ''} placeholder="ঐচ্ছিক" disabled={busy} onChange={e => editPending(i, { price: e.target.value })} />
          </label>
          <label className="text-[10px] font-semibold text-gray-500 bengali">ক্রয়মূল্য ₹ (প্রতি {p.unit})
            <input className={inputCls} inputMode="decimal" value={p.cost || ''} placeholder="ঐচ্ছিক" disabled={busy} onChange={e => editPending(i, { cost: e.target.value })} />
          </label>
        </div>
        {p.existingQty != null && (
          <div className="text-[11px] text-gray-600 bengali">
            আগে স্টকে আছে: <b>{p.existingQty} {p.existingUnit}</b>{showTotal ? <> → যোগ হলে মোট <b>{Math.round((p.existingQty! + qtyN) * 1000) / 1000} {p.unit}</b></> : null}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => confirmPending(i)} disabled={busy}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[13px] font-bold rounded-lg py-2 bengali">
            {busy ? 'সেভ হচ্ছে…' : '✅ সেভ করুন'}
          </button>
          <button onClick={() => cancelPending(i)} disabled={busy}
            className="px-4 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-600 text-[13px] font-semibold rounded-lg py-2 bengali">
            বাতিল
          </button>
        </div>
      </div>
    )
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // ── Saved records indicator (custom agents only — /api/agent-chat
  // is the only endpoint that returns itemized savedIntents) ────────
  function SavedBadge({ msg }: { msg: Message }) {
    if (!msg.saved || msg.saved === 0) return null
    const msgId = msg.content.slice(0, 20)
    const open = expandedSave === msgId
    return (
      <div className="mt-2">
        <button
          onClick={() => setExpandedSave(open ? null : msgId)}
          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 hover:bg-emerald-100 transition-colors"
        >
          <Database size={11} />
          {msg.saved}টি তথ্য সংরক্ষিত
          {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
        {open && msg.savedIntents && (
          <div className="mt-1.5 space-y-1">
            {msg.savedIntents.map((intent: any, i: number) => (
              <div key={i} className="text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-emerald-800">
                <CheckCircle2 size={11} className="inline mr-1" />
                <span className="font-semibold">{intent.type}</span>
                {intent.label && <span className="ml-1.5 text-emerald-700">— {intent.label}</span>}
                {intent.amount && <span className="ml-1.5 font-mono">₹{intent.amount}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const displayValue = voice.listening && voice.interim ? voice.interim : input

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden" style={{ height: compact ? '100%' : '600px' }}>
      {/* ── Header ──
          Standalone use (e.g. Dokan Manager's own tab): full dark bar with
          agent identity — there's no other header around it there.
          Compact/embedded use (inside AIAssistantPanel on Overview/Sales/
          Stock/etc.): that wrapper already shows its own "AI Assistant"
          header with the agent's identity, so repeating it here read as a
          second, oddly-truncated chatbot. Compact mode instead shows just
          a slim strip of the same icon controls (new chat/history/download/
          language), no duplicate identity block. */}
      {!compact ? (
        <div className="bg-gray-900 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: agent.color || '#EEF2FF' }}>
            {agent.icon || '🤖'}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white text-[13px] bengali truncate">{agent.name_bn || agent.name}</div>
            <div className="text-emerald-400 text-[10px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
              {writesRealData ? <span className="flex items-center gap-1"><Database size={10} />Real data</span> : 'AI সহায়ক · Online'}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 relative">
            <button onClick={startNewChat} title="নতুন চ্যাট" className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors">
              <MessageSquarePlus size={13} className="text-gray-300" />
            </button>
            {userId && (
              <div className="relative">
                <button
                  onClick={() => setShowHistory(s => !s)}
                  title="চ্যাট ইতিহাস (২৪ ঘণ্টা)"
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${showHistory ? 'bg-indigo-600' : 'bg-gray-800 hover:bg-gray-700'}`}
                >
                  <HistoryIcon size={13} className="text-gray-300" />
                </button>
                {showHistory && (
                  <div className="absolute right-0 top-10 z-20 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100 text-[11px] font-bold text-gray-400 bengali">গত ২৪ ঘণ্টার চ্যাট</div>
                    <div className="max-h-64 overflow-y-auto">
                      {historySessions.length === 0 ? (
                        <div className="px-3 py-4 text-[12px] text-gray-400 bengali text-center">কোনো পুরোনো চ্যাট নেই</div>
                      ) : historySessions.map(s => (
                        <button key={s.id} onClick={() => openHistorySession(s.id)}
                          className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 ${s.id === sessionId ? 'bg-indigo-50' : ''}`}>
                          <div className="text-[12px] text-gray-700 bengali truncate">{s.preview}{s.preview.length >= 40 ? '…' : ''}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{s.time}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button onClick={downloadChat} title="চ্যাট ডাউনলোড করুন" className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors">
              <Download size={13} className="text-gray-300" />
            </button>
            {(voice.supported || whisper.supported) && (
              <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
                <Globe size={11} className="text-gray-400 ml-1" />
                {(['bn-IN', 'en-IN'] as const).map(l => (
                  <button key={l} onClick={() => voice.setLang(l)} className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${voice.lang === l ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>
                    {l === 'bn-IN' ? 'বাং' : 'EN'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-1 px-2 py-1.5 border-b border-gray-100 flex-shrink-0 relative">
          <button onClick={startNewChat} title="নতুন চ্যাট" className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
            <MessageSquarePlus size={13} className="text-gray-400" />
          </button>
          {userId && (
            <div className="relative">
              <button
                onClick={() => setShowHistory(s => !s)}
                title="চ্যাট ইতিহাস (২৪ ঘণ্টা)"
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${showHistory ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-gray-100 text-gray-400'}`}
              >
                <HistoryIcon size={13} />
              </button>
              {showHistory && (
                <div className="absolute right-0 top-9 z-20 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100 text-[11px] font-bold text-gray-400 bengali">গত ২৪ ঘণ্টার চ্যাট</div>
                  <div className="max-h-64 overflow-y-auto">
                    {historySessions.length === 0 ? (
                      <div className="px-3 py-4 text-[12px] text-gray-400 bengali text-center">কোনো পুরোনো চ্যাট নেই</div>
                    ) : historySessions.map(s => (
                      <button key={s.id} onClick={() => openHistorySession(s.id)}
                        className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 ${s.id === sessionId ? 'bg-indigo-50' : ''}`}>
                        <div className="text-[12px] text-gray-700 bengali truncate">{s.preview}{s.preview.length >= 40 ? '…' : ''}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{s.time}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <button onClick={downloadChat} title="চ্যাট ডাউনলোড করুন" className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
            <Download size={13} className="text-gray-400" />
          </button>
          {(voice.supported || whisper.supported) && (
            <div className="flex items-center gap-0.5 bg-gray-50 rounded-lg p-0.5 ml-0.5">
              {(['bn-IN', 'en-IN'] as const).map(l => (
                <button key={l} onClick={() => voice.setLang(l)} className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors ${voice.lang === l ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>
                  {l === 'bn-IN' ? 'বাং' : 'EN'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex items-start gap-1 group ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm mr-2 mt-0.5 flex-shrink-0" style={{ background: agent.color || '#EEF2FF' }}>
                {agent.icon || '🤖'}
              </div>
            )}
            {msg.role === 'user' && !loading && (
              <button
                onClick={() => {
                  const nextMsg = messages[i + 1]
                  setCorrecting({ preview: msg.content, previousRefs: (nextMsg?.role === 'assistant' ? nextMsg.dataRefs : null) || [] })
                  setInput(msg.content)
                }}
                title="এডিট করে আবার পাঠান"
                className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 mt-2 rounded-md hover:bg-gray-100 flex items-center justify-center flex-shrink-0"
              >
                <Pencil size={11} className="text-gray-400" />
              </button>
            )}
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed bengali ${
                msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-gray-50 text-gray-800 border border-gray-100 rounded-tl-sm'
              }`}>
                {msg.role === 'assistant' ? <ReactMarkdown className="prose prose-sm max-w-none">{msg.content}</ReactMarkdown> : msg.content}
              </div>
              {msg.role === 'assistant' && <SavedBadge msg={msg} />}
              {msg.role === 'assistant' && msg.pending ? renderPendingCard(msg, i) : null}
              {msg.role === 'assistant' && msg.vision ? renderVisionCard(msg, i) : null}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm mr-2" style={{ background: agent.color || '#EEF2FF' }}>{agent.icon || '🤖'}</div>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick replies — a caller-supplied `quickPrompts` list renders as a
          vertical stack of full-width rows; otherwise the default per-category
          horizontal pills. (AIAssistantPanel on Overview renders its own chips
          above this component instead, via externalPrompt — quickPrompts is
          for callers that don't.) */}
      {messages.length <= 2 && quickPrompts && quickPrompts.length > 0 && (
        <div className="px-4 pb-2 space-y-1.5">
          {quickPrompts.map((q, i) => (
            <button key={i} onClick={() => sendMessage(q)}
              className="w-full flex items-center gap-2 text-xs font-medium text-left bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 border border-gray-100 hover:border-indigo-100 rounded-xl px-3 py-2 transition-colors bengali">
              <MessageSquare size={12} className="flex-shrink-0 text-gray-400"/> {q}
            </button>
          ))}
        </div>
      )}
      {messages.length <= 2 && !quickPrompts && qr.length > 0 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {qr.map((q, i) => (
            <button key={i} onClick={() => sendMessage(q)}
              className="flex-shrink-0 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-3 py-1.5 hover:bg-indigo-100 transition-colors bengali whitespace-nowrap">
              {q}
            </button>
          ))}
        </div>
      )}

      {correcting && (
        <div className="mx-4 mb-2 flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          <Pencil size={11} className="flex-shrink-0" />
          <span className="bengali truncate flex-1">সংশোধন করছেন — ঠিক করে Send চাপুন, আগের ডেটা আপডেট হয়ে যাবে (নতুন করে যোগ হবে না)</span>
          <button onClick={() => { setCorrecting(null); setInput('') }} className="w-5 h-5 rounded hover:bg-amber-100 flex items-center justify-center flex-shrink-0">
            <X size={11} />
          </button>
        </div>
      )}

      {/* Input — Grok-style: while recording the box becomes  ✕  ▁▂▅▂▁ 0:07  ✓ */}
      <div className="px-4 pb-4">
        {/* Mode row — Text is just the default state; Voice/Image/File are
            real actions: Voice toggles the existing mic recorder, Image
            opens the camera (or gallery) and Image/File both round-trip
            through /api/stock-extract → an editable "add all?" card
            (see handleImageFile/handleDocFile) — nothing is invented or
            auto-saved without the owner reviewing it first. */}
        {imageCtx && (
          <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-700 bengali">
            <ImageIcon size={12} className="flex-shrink-0" />
            <span className="flex-1 min-w-0 truncate">ছবির {imageCtx.data.items.length}টি পণ্য সংযুক্ত — "এগুলো স্টকে যোগ করো" / "রহিমের নামে বিল করো" বলুন</span>
            <button onClick={() => setImageCtx(null)} aria-label="ছবির তথ্য সরান" className="flex-shrink-0 text-indigo-400 hover:text-indigo-700"><X size={13} /></button>
          </div>
        )}
        <div className="flex items-center gap-1.5 mb-2 overflow-x-auto scrollbar-none">
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bengali flex-shrink-0 ${!voice.listening && whisper.phase === 'idle' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
            <Type size={11} /> Text
          </span>
          {(whisper.supported || voice.supported) && (
            <button type="button" onClick={whisper.supported ? whisper.start : (voice.listening ? voice.stop : voice.start)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bengali flex-shrink-0 transition-colors ${voice.listening || whisper.phase !== 'idle' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              <Mic size={11} /> Voice
            </button>
          )}
          {writesRealData && (
            <>
              <button type="button" disabled={!!extracting} onClick={() => imageInputRef.current?.click()}
                title="ছবি তুলে/আপলোড করে পণ্য যোগ করুন"
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bengali flex-shrink-0 bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50 transition-colors">
                {extracting === 'image' ? <Loader2 size={11} className="animate-spin" /> : <ImageIcon size={11} />} Image
              </button>
              <button type="button" disabled={!!extracting} onClick={() => fileInputRef.current?.click()}
                title="CSV/TXT ফাইল থেকে পণ্য যোগ করুন"
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bengali flex-shrink-0 bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-50 transition-colors">
                {extracting === 'file' ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />} File
              </button>
              <input ref={imageInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = '' }} />
              <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleDocFile(f); e.target.value = '' }} />
            </>
          )}
        </div>
        {whisper.phase !== 'idle' ? (
          <div className="flex items-center gap-2 bg-gray-50 border border-indigo-300 rounded-2xl px-3 py-2.5">
            {whisper.phase === 'recording' ? (
              <>
                <button onClick={whisper.cancel} aria-label="বাতিল করুন" title="বাতিল"
                  className="w-9 h-9 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center flex-shrink-0 transition-colors">
                  <X size={16} className="text-gray-600" />
                </button>
                <VoiceWaveform levels={whisper.levels} seconds={whisper.seconds} />
                <button onClick={whisper.accept} aria-label="রেকর্ডিং শেষ করুন" title="শেষ করুন"
                  className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center flex-shrink-0 transition-colors">
                  <Check size={17} />
                </button>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center gap-2 h-9 text-sm text-gray-500 bengali" role="status">
                <Loader2 size={16} className="animate-spin" /> লিখছি…
              </div>
            )}
          </div>
        ) : (
        <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 focus-within:border-indigo-300 transition-colors">
          <textarea
            ref={inputRef}
            value={displayValue}
            onChange={e => { if (!voice.listening) setInput(e.target.value) }}
            onKeyDown={handleKey}
            placeholder={voice.listening ? '🎤 শুনছি... (থামতে মাইক চাপুন)' : 'আপনার কাজ লিখুন বা বলুন...'}
            rows={1}
            readOnly={voice.listening}
            className={`flex-1 bg-transparent resize-none outline-none text-sm bengali placeholder-gray-400 max-h-24 ${voice.listening ? 'text-red-600' : 'text-gray-800'}`}
            style={{ lineHeight: '1.5' }}
          />
          {(whisper.supported || voice.supported) && (
            <button onClick={whisper.supported ? whisper.start : (voice.listening ? voice.stop : voice.start)}
              aria-label="মাইক্রোফোনে বলুন"
              className={`p-1.5 rounded-xl transition-colors ${voice.listening ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}>
              {voice.listening ? <MicOff size={17} /> : <Mic size={17} />}
            </button>
          )}
          <button onClick={() => sendMessage()} disabled={(!input.trim() && !voice.interim) || loading}
            className="p-1.5 rounded-xl bg-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors flex-shrink-0">
            <Send size={15} />
          </button>
        </div>
        )}
        {voice.listening && voice.interim && (
          <div className="mt-1 text-[11px] text-red-500 bengali px-1 truncate">🎤 {voice.interim}</div>
        )}
      </div>
    </div>
  )
}
