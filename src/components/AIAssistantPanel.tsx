'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Maximize2, X, Sparkles, Pencil, Lock, RefreshCw, Check } from 'lucide-react'
import AgentRunner from '@/components/AgentRunner'
import { supabase } from '@/lib/supabaseClient'
import { ChatRole, Scope, effectiveScope, promptsFor, SCOPE_LABEL_BN } from '@/lib/chatPolicy'

import { tr } from '@/lib/i18n/tr'
export interface AgentTarget {
  isLibrary: boolean
  slug?: string
  id?: string
  name: string
  name_bn?: string
  icon: string
  color?: string
}

interface RecentActivityItem { id: string; icon: string; text: string; ts: number }
interface LiveItem { id: string; kind: string; text: string; ts: number }

const ROLE_LABEL: Record<ChatRole, { label: string; cls: string }> = {
  owner: { label: 'মালিক',   cls: 'bg-indigo-50 text-indigo-700' },
  admin: { label: 'অ্যাডমিন', cls: 'bg-violet-50 text-violet-700' },
  sales: { label: 'সেলস',    cls: 'bg-emerald-50 text-emerald-700' },
  stock: { label: 'স্টক',    cls: 'bg-amber-50 text-amber-700' },
}

const CAN_DO: Record<Scope, string[]> = {
  all:   ['বিক্রি, স্টক, গ্রাহক ও বাকি — সবকিছু', 'রিপোর্ট ও হিসাব দেখা'],
  sales: ['বিক্রি ও বিলিং রেকর্ড', 'গ্রাহক ও বাকির হিসাব', 'স্টক শুধু দেখা — বদলানো যাবে না'],
  stock: ['স্টক যোগ ও আপডেট', 'কম স্টক ও মেয়াদের খবর', 'বিক্রি / বাকি / গ্রাহক — এই মোডে নয়'],
}

const AVATAR_ICONS = ['🤖', '🧠', '✨', '🦾', '👩‍💼', '👨‍💼', '🛒', '📦', '💬', '⚡', '🌟', '🧑‍🔧']
// literal class strings so Tailwind keeps them
const AVATAR_GRADS = [
  'from-indigo-600 to-fuchsia-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-sky-500 to-blue-600',
  'from-rose-500 to-pink-600',
  'from-slate-700 to-slate-900',
]
const KIND_ICON: Record<string, string> = { sales: '🧾', stock: '📦', customer: '👤', other: '🤖' }

const agentKey = (a: AgentTarget) => (a.isLibrary ? `lib:${a.slug}` : `c:${a.id}`)

function lsGet<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}
function lsSet(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ } }

// Chat surface used on the dashboard pages.
//  - agents: every agent this person may chat with (Starter: up to 3 → agent filter;
//    an employee only gets the agents the owner granted).
//  - role / canFocus: Business plan. An employee is locked to their role (sales-only /
//    stock-only); the owner may narrow the chat with the সব / বিক্রি / স্টক filter.
//  The server enforces all of this too — the UI only shows what is allowed.
export default function AIAssistantPanel({
  agentTarget, agents, userId, role = 'owner', canFocus = false, onDataChange, recentActivity, suggestions, badge,
}: {
  agentTarget?: AgentTarget | null
  agents?: AgentTarget[]
  userId: string
  role?: ChatRole
  canFocus?: boolean
  suggestions?: string[]
  badge?: string
  onDataChange?: () => void
  /** Legacy prop (old, sales-derived feed). The panel now keeps its own live feed. */
  recentActivity?: RecentActivityItem[]
}) {
  const list: AgentTarget[] = useMemo(
    () => (agents && agents.length ? agents : agentTarget ? [agentTarget] : []),
    [agents, agentTarget],
  )

  const [expanded, setExpanded] = useState(false)
  const [promptNonce, setPromptNonce] = useState(0)
  const [promptText, setPromptText] = useState('')
  const [conversationStarted, setConversationStarted] = useState(false)

  // ── agent filter (remembered per user) ──
  const [selectedKey, setSelectedKey] = useState<string>('')
  useEffect(() => { setSelectedKey(lsGet<string>(`sahayak:ai-agent:${userId}`, '')) }, [userId])
  const current = list.find(a => agentKey(a) === selectedKey) || list[0] || null
  const pickAgent = (a: AgentTarget) => { setSelectedKey(agentKey(a)); lsSet(`sahayak:ai-agent:${userId}`, agentKey(a)) }

  // ── focus filter (owner on Business) / locked role (employee) ──
  const lockedRole = role === 'sales' || role === 'stock'
  const [focus, setFocus] = useState<'all' | 'sales' | 'stock'>('all')
  useEffect(() => { setFocus(lsGet(`sahayak:ai-focus:${userId}`, 'all')) }, [userId])
  const scope: Scope = effectiveScope(role, canFocus ? focus : 'all')
  const pickFocus = (f: 'all' | 'sales' | 'stock') => { setFocus(f); lsSet(`sahayak:ai-focus:${userId}`, f); setConversationStarted(false) }

  // ── editable AI identity (icon / colour / name) ──
  const [prefs, setPrefs] = useState({ icon: '🤖', grad: 0, name: 'AI Assistant' })
  const [editOpen, setEditOpen] = useState(false)
  useEffect(() => { setPrefs(p => ({ ...p, ...lsGet(`sahayak:ai-prefs:${userId}`, {}) })) }, [userId])
  const savePrefs = (next: Partial<typeof prefs>) => setPrefs(p => { const n = { ...p, ...next }; lsSet(`sahayak:ai-prefs:${userId}`, n); return n })

  // new agent or new focus → fresh start, shortcuts come back
  useEffect(() => { setConversationStarted(false) }, [current?.id, current?.slug])

  // ── live "recent AI work" ──
  const [serverItems, setServerItems] = useState<LiveItem[]>([])
  const [localItems, setLocalItems] = useState<LiveItem[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [tick, setTick] = useState(0)

  const fetchActivity = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      setRefreshing(true)
      const r = await fetch(`/api/chat/activity${canFocus && focus !== 'all' ? `?focus=${focus}` : ''}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store',
      })
      if (r.ok) {
        const j = await r.json()
        setServerItems(j.items || [])
        setLocalItems([])
      }
    } catch { /* offline — keep what we have */ } finally { setRefreshing(false) }
  }, [canFocus, focus])

  useEffect(() => {
    fetchActivity()
    const poll = setInterval(() => { if (document.visibilityState === 'visible') fetchActivity() }, 20000)
    const clock = setInterval(() => setTick(t => t + 1), 30000)
    const onVis = () => { if (document.visibilityState === 'visible') fetchActivity() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', fetchActivity)
    return () => { clearInterval(poll); clearInterval(clock); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', fetchActivity) }
  }, [fetchActivity])

  const onActivity = (a: { text: string; kind: string }) => {
    // show it instantly, then replace with the saved server row a moment later
    setLocalItems(prev => [{ id: `l-${Date.now()}`, kind: a.kind, text: a.text, ts: Date.now() }, ...prev].slice(0, 4))
    setTimeout(fetchActivity, 1500)
  }

  const feed = [...localItems, ...serverItems].slice(0, 8)

  const timeAgo = (ts: number) => {
    void tick
    const m = Math.max(0, Math.round((Date.now() - ts) / 60000))
    if (m < 1) return 'এইমাত্র'
    if (m < 60) return `${m} মিনিট আগে`
    const h = Math.round(m / 60)
    if (h < 24) return `${h} ঘণ্টা আগে`
    return `${Math.round(h / 24)} দিন আগে`
  }

  const sendSuggestion = (text: string) => {
    setConversationStarted(true)
    setPromptText(text)
    setPromptNonce(n => n + 1)
  }

  const chips = suggestions && suggestions.length ? suggestions : promptsFor(scope, current?.slug)
  const showFilters = list.length > 1 || canFocus || lockedRole
  const roleInfo = ROLE_LABEL[role]
  const grad = AVATAR_GRADS[prefs.grad] || AVATAR_GRADS[0]

  // ── pieces reused in the compact and the expanded layout ──
  const focusControl = lockedRole ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full bengali whitespace-nowrap">
      <Lock size={11} /> {tr('শুধু')} {SCOPE_LABEL_BN[scope]}
    </span>
  ) : canFocus ? (
    <div className="inline-flex bg-gray-100 rounded-full p-0.5 flex-shrink-0">
      {([['all', 'সব'], ['sales', 'বিক্রি'], ['stock', 'স্টক']] as const).map(([id, label]) => (
        <button key={id} onClick={() => pickFocus(id)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold bengali transition-colors ${focus === id ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
          {label}
        </button>
      ))}
    </div>
  ) : null

  const liveFeed = (
    <>
      {feed.length === 0 ? (
        <p className="text-[11px] text-gray-400 bengali leading-relaxed">{tr('এখনো কোনো কাজ নেই — চ্যাটে বিক্রি বা স্টকের কথা বলুন, এখানে সঙ্গে সঙ্গে দেখা যাবে।')}</p>
      ) : (
        <div className="space-y-2.5">
          {feed.map(r => (
            <div key={r.id} className="flex items-start gap-2 text-[11px]">
              <span className="flex-shrink-0 mt-0.5 text-sm leading-none">{KIND_ICON[r.kind] || '🤖'}</span>
              <div className="min-w-0">
                <div className="text-gray-700 bengali leading-snug line-clamp-2">{r.text}</div>
                <div className="text-gray-400 bengali">{timeAgo(r.ts)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  const liveHeader = (
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-xs font-bold text-gray-700 bengali flex items-center gap-1.5">
        {tr('সাম্প্রতিক AI কাজ')}
        <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> LIVE
        </span>
      </h3>
      <button onClick={fetchActivity} title={tr('রিফ্রেশ')} className="p-1 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50">
        <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
      </button>
    </div>
  )

  return (
    <>
      {expanded && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={() => setExpanded(false)} />}

      <div className={`relative bg-white flex border-2 border-indigo-100 ${expanded
        ? 'fixed z-50 inset-0 sm:inset-4 lg:inset-8 sm:rounded-3xl shadow-2xl overflow-hidden'
        : 'h-full rounded-2xl'}`}>

        {/* ── main column ── */}
        <div className="flex flex-col min-w-0 min-h-0 flex-1">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button onClick={() => setEditOpen(o => !o)} title={tr('আইকন ও নাম বদলান')}
                className={`group relative w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xl flex-shrink-0 shadow-sm`}>
                {prefs.icon}
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border border-gray-200 text-gray-500 flex items-center justify-center group-hover:text-indigo-600">
                  <Pencil size={8} />
                </span>
              </button>
              <div className="min-w-0">
                <div className="font-bold text-gray-900 text-sm truncate">{prefs.name || 'AI Assistant'}</div>
                <div className="flex items-center gap-1.5 text-[11px] min-w-0">
                  <span className="flex items-center gap-1 text-emerald-500 font-medium flex-shrink-0">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Online
                  </span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold bengali flex-shrink-0 ${roleInfo.cls}`}>{roleInfo.label}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {badge && <span className="hidden sm:inline text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full bengali">{badge}</span>}
              <button onClick={() => setExpanded(e => !e)} title={expanded ? tr('ছোট করুন') : tr('বড় করে দেখুন')}
                className="flex items-center gap-1 h-8 px-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                {expanded ? <X size={16} /> : <Maximize2 size={14} />}
                {!expanded && <span className="hidden md:inline text-[11px] font-medium bengali">{tr('বড় করুন')}</span>}
              </button>
            </div>
          </div>

          {/* Edit identity popover */}
          {editOpen && (
            <div className="absolute left-3 top-14 z-50 w-72 max-w-[calc(100%-1.5rem)] bg-white border border-gray-200 rounded-2xl shadow-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-700 bengali">{tr('AI-এর আইকন ও নাম')}</span>
                <button onClick={() => setEditOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
              <div className="grid grid-cols-6 gap-1.5 mb-2.5">
                {AVATAR_ICONS.map(ic => (
                  <button key={ic} onClick={() => savePrefs({ icon: ic })}
                    className={`h-9 rounded-lg text-lg flex items-center justify-center border ${prefs.icon === ic ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:bg-gray-50'}`}>{ic}</button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mb-2.5">
                {AVATAR_GRADS.map((g, i) => (
                  <button key={g} onClick={() => savePrefs({ grad: i })} aria-label={`colour ${i + 1}`}
                    className={`w-7 h-7 rounded-full bg-gradient-to-br ${g} flex items-center justify-center ${prefs.grad === i ? 'ring-2 ring-offset-1 ring-indigo-500' : ''}`}>
                    {prefs.grad === i && <Check size={12} className="text-white" />}
                  </button>
                ))}
              </div>
              <input value={prefs.name} maxLength={20} onChange={e => savePrefs({ name: e.target.value })} placeholder="AI Assistant"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-indigo-300" />
              <p className="text-[10px] text-gray-400 bengali mt-1.5">{tr('শুধু এই ডিভাইসে আপনার জন্য সেভ থাকবে।')}</p>
            </div>
          )}

          {/* Filters: agent + focus */}
          {showFilters && current && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-50 flex-shrink-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {list.length > 1 ? list.map(a => {
                const on = agentKey(a) === agentKey(current)
                return (
                  <button key={agentKey(a)} onClick={() => pickAgent(a)}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-[11px] font-bold bengali border transition-colors ${on ? 'text-white border-transparent shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    style={on ? { background: a.color || '#4F46E5' } : undefined}>
                    <span className="text-sm leading-none">{a.icon}</span>{a.name_bn || a.name}
                  </button>
                )
              }) : (
                <span className="flex-shrink-0 inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full text-[11px] font-bold bengali bg-gray-50 text-gray-600 border border-gray-100">
                  <span className="text-sm leading-none">{current.icon}</span>{current.name_bn || current.name}
                </span>
              )}
              {(canFocus || lockedRole) && <span className="w-px h-4 bg-gray-200 flex-shrink-0" />}
              {focusControl}
            </div>
          )}

          {!current ? (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <p className="text-sm text-gray-400 bengali">{tr('প্রথমে লাইব্রেরি থেকে একটি Agent বেছে নিন — তারপর এখানে AI সহায়তা শুরু হবে।')}</p>
            </div>
          ) : (
            <>
              {/* Shortcut chips — before the conversation starts (compact), always on phones */}
              {!conversationStarted ? (
                <div className={`px-3 pt-3 pb-1 flex-shrink-0 flex gap-2 overflow-x-auto scrollbar-hide ${expanded ? 'lg:hidden' : ''}`}>
                  {chips.map(s => (
                    <button key={s} onClick={() => sendSuggestion(s)}
                      className="flex-shrink-0 whitespace-nowrap text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-3 py-1.5 hover:bg-indigo-100 transition-colors bengali">
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <div className={`px-3 pt-2 flex-shrink-0 ${expanded ? 'lg:hidden' : ''}`}>
                  <button onClick={() => setConversationStarted(false)}
                    className="flex items-center gap-1 text-[11px] font-medium text-indigo-500 hover:text-indigo-700 bengali">
                    <Sparkles size={11} /> {tr('শর্টকাট ও সাম্প্রতিক কাজ দেখান')}
                  </button>
                </div>
              )}

              {/* Chat — same element in both layouts, so switching size never loses the conversation */}
              <div className={`flex-1 min-h-0 px-3 pb-3 pt-2 ${expanded ? 'w-full max-w-3xl mx-auto' : ''}`}>
                <AgentRunner
                  key={agentKey(current)}
                  compact
                  agent={{ ...current, name_bn: current.name_bn || current.name }}
                  agentId={current.isLibrary ? undefined : current.id}
                  agentSlugOverride={current.isLibrary ? current.slug : undefined}
                  isCustomAgent={!current.isLibrary}
                  userId={userId}
                  focus={scope === 'all' ? 'all' : scope}
                  onDataChange={onDataChange}
                  onActivity={onActivity}
                  externalPrompt={promptText ? { text: promptText, nonce: promptNonce } : undefined}
                  onSend={() => setConversationStarted(true)}
                />
              </div>

              {/* Live feed under the chat (compact layout only) */}
              {!expanded && !conversationStarted && (
                <div className="border-t border-gray-100 p-3 flex-shrink-0">
                  {liveHeader}
                  <div className="max-h-32 overflow-y-auto">{liveFeed}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── side column (expanded, desktop) ── */}
        {expanded && (
          <aside className="hidden lg:flex flex-col w-80 flex-shrink-0 border-l border-gray-100 bg-gray-50/60 overflow-y-auto">
            <div className="p-4 border-b border-gray-100">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2 bengali">{tr('আপনার মোড')}</div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold bengali ${roleInfo.cls}`}>{roleInfo.label}</span>
                <span className="text-[11px] font-semibold text-gray-600 bengali">{SCOPE_LABEL_BN[scope]}</span>
              </div>
              {focusControl && <div className="mb-2.5">{focusControl}</div>}
              <ul className="space-y-1">
                {CAN_DO[scope].map(t => (
                  <li key={t} className="text-[12px] text-gray-600 bengali flex gap-1.5"><span className="text-emerald-500">•</span>{t}</li>
                ))}
              </ul>
            </div>

            {list.length > 1 && (
              <div className="p-4 border-b border-gray-100">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2 bengali">{tr('এজেন্ট')}</div>
                <div className="space-y-1.5">
                  {list.map(a => {
                    const on = current && agentKey(a) === agentKey(current)
                    return (
                      <button key={agentKey(a)} onClick={() => pickAgent(a)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border text-left transition-colors ${on ? 'bg-white border-indigo-200 shadow-sm' : 'border-transparent hover:bg-white'}`}>
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ background: `${a.color || '#4F46E5'}1A` }}>{a.icon}</span>
                        <span className="text-[13px] font-bold text-gray-800 bengali truncate flex-1">{a.name_bn || a.name}</span>
                        {on && <Check size={14} className="text-indigo-600" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="p-4 border-b border-gray-100">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2 bengali">{tr('দ্রুত প্রশ্ন')}</div>
              <div className="flex flex-col gap-1.5">
                {chips.map(s => (
                  <button key={s} onClick={() => sendSuggestion(s)}
                    className="text-left text-[12px] font-medium bg-white text-indigo-700 border border-indigo-100 rounded-xl px-3 py-2 hover:bg-indigo-50 transition-colors bengali">
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4">
              {liveHeader}
              {liveFeed}
            </div>
          </aside>
        )}
      </div>
    </>
  )
}
