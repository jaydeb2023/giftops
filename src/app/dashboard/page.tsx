'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'
import {
  Plus, Bot, ArrowRight, Mic, MicOff, Globe, LayoutDashboard,
  BookOpen, Settings, LogOut, TrendingUp, Users, Zap, RefreshCw,
  ChevronRight, BarChart2, Package, CreditCard, AlertTriangle,
  MessageSquare, Activity, Bell, Search, Star, Clock, Home,
  ShoppingBag, X, Check, Truck, Menu, IndianRupee, FileText,
  MessageCircle, NotebookPen, Trash2, Send, ExternalLink,
  Building2, Lock, UserCog, ChevronDown, ChevronUp,
  CalendarClock, CalendarDays, CheckCircle2, Info, MoreVertical,
} from 'lucide-react'
import { getAgentLimit, PLAN_LABELS } from '@/lib/planLimits'
import AgentRunner from '@/components/AgentRunner'
import AgentWorkspace from '@/components/AgentWorkspace'
import ScrollPanel from '@/components/ScrollPanel'
import { reloadLibraryPanels } from '@/lib/panelReload'
import ReportsHub from '@/components/ReportsHub'
import CRMDashboard from '@/components/CRMDashboard'
import GenericBusinessManagerUI from '@/components/GenericBusinessManagerUI'
import { renderLibraryAgentPanel } from '@/components/LibraryAgentPanel'
import BuildAgentWizard from '@/components/BuildAgentWizard'
import OverviewInsights, { type OverviewStats, type TaskItem, type RecentActivityItem } from '@/components/OverviewInsights'
import AIAssistantPanel from '@/components/AIAssistantPanel'
import StockOverview from '@/components/StockOverview'
import SalesOverview from '@/components/SalesOverview'
import SupplyDashboard from '@/components/SupplyDashboard'
import FollowUpDashboard from '@/components/FollowUpDashboard'
import DuesOverview from '@/components/DuesOverview'
import CustomerBillingTable from '@/components/CustomerBillingTable'
import InvoiceBuilder from '@/components/InvoiceBuilder'
import InvoiceHistory from '@/components/InvoiceHistory'
import WhatsAppDashboard from '@/components/whatsapp/WhatsAppDashboard'
import ProductCatalogUI from '@/components/ProductCatalogUI'
import LanguageToggle from '@/components/LanguageToggle'
import toast from 'react-hot-toast'
import { PREBUILT_AGENTS, CATEGORY_LABELS, BUSINESS_TYPE_LABELS, type BusinessType, type AgentCategory } from '@/types'
import { fetchSubscription, computeAccess } from '@/lib/subscription'
import { useAgentActivation } from '@/lib/useAgentActivation'
import { readCache, writeCache, clearAllCache } from '@/lib/swrCache'
import { useLanguage } from '@/lib/LanguageContext'
import { LIBRARY_AGENT_IDS, LIBRARY_AGENT_NAMES_BN, libraryAgentDisplayById } from '@/lib/libraryAgentIds'
import { hasFeature, lockedMessageBn } from '@/lib/planFeatures'
import { ROLE_DEFAULT_VIEW, ROLE_LABELS_BN, canSeeView, type TeamRole } from '@/lib/roleTabs'
import { getDashboardTier, TIER_UI } from '@/lib/dashboardTier'


import { tr } from '@/lib/i18n/tr'
// ── Custom ("Build Agent") agents always render GenericBusinessManagerUI,
// regardless of business_type. It's already correctly wired: reads/writes
// the canonical tables (stock_items/daily_sales/crm_customers/credit_entries)
// tagged with this agent's own real agent_id, matching what /api/agent-chat
// writes.
//
// The 5 vertical UIs (DokanManagerUI etc.) are NOT reused here on purpose —
// each one is hardcoded to one fixed library agent_id (see
// src/lib/libraryAgentIds.ts) shared by every user's copy of that one
// prebuilt Library agent. Routing a custom agent through them would make it
// read/write the exact same rows as the Library agent of that type, mixing
// two different agents' data together.
function renderBusinessManagerUI(agent: any, userId: string) {
  return (
    <GenericBusinessManagerUI
      userId={userId}
      agentId={agent.id}
      agentName={agent.name_bn || agent.name}
      icon={agent.icon}
      accentColor={agent.color}
      businessType={agent.business_type || 'general'}
      templateId={agent.template_id}
    />
  )
}

// ── Library agents definition ────────────────────────────────────
const LIBRARY_AGENTS = [
  // dokan-manager's backend (/api/business-chat + DokanManagerUI) was
  // migrated onto the canonical tables (see src/lib/libraryAgentIds.ts) —
  // table/statsTable below are unused for it; loadAllStats special-cases it.
  { slug: 'dokan-manager',            name: 'দোকান ম্যানেজার',    icon: '🏪', accent: '#4F46E5', light: '#EEF2FF', table: 'daily_sales',   statsTable: 'stock_items',   canonical: true, categoryLabel: 'General Store' },
  { slug: 'hotel-and-dhaba-manager',  name: 'হোটেল ম্যানেজার',    icon: '🍽️', accent: '#EA580C', light: '#FFF7ED', table: 'hotel_orders',   statsTable: 'hotel_menu',    categoryLabel: 'Hotel' },
  { slug: 'mishti-dokan-manager',     name: 'মিষ্টির দোকান',      icon: '🍬', accent: '#C026D3', light: '#FDF4FF', table: 'mishti_sales',   statsTable: 'mishti_items',  categoryLabel: 'Sweet Shop' },
  { slug: 'kaporer-dokan-tracker',    name: 'কাপড়ের দোকান',      icon: '👗', accent: '#7C3AED', light: '#F5F3FF', table: 'kapor_sales',    statsTable: 'kapor_products',categoryLabel: 'Clothing' },
  { slug: 'pharmacy-assistant',       name: 'ফার্মেসি সহায়ক',     icon: '💊', accent: '#0284C7', light: '#E0F2FE', table: 'pharmacy_sales', statsTable: 'medicines',     categoryLabel: 'Pharmacy' },
]

// ── Floating Mic ─────────────────────────────────────────────────
function FloatingMic({ onTranscript, lang, onLangToggle }: {
  onTranscript: (t: string) => void; lang: 'bn-IN'|'en-IN'; onLangToggle: () => void
}) {
  const [listening, setListening] = useState(false)
  const recRef = useRef<any>(null)
  const toggle = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { toast.error('Voice support নেই'); return }
    if (listening) { recRef.current?.stop(); setListening(false); return }
    const r = new SR()
    recRef.current = r
    r.lang = lang; r.interimResults = false; r.continuous = false
    r.onstart  = () => setListening(true)
    r.onend    = () => setListening(false)
    r.onerror  = (e: any) => { setListening(false); if (e.error === 'not-allowed') toast.error('Microphone permission দিন') }
    r.onresult = (e: any) => {
      const text = Array.from(e.results).map((r: any) => r[0].transcript).join('')
      onTranscript(text)
    }
    r.start()
  }, [listening, lang, onTranscript])
  useEffect(() => () => { recRef.current?.abort() }, [])
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      <div className="flex items-center gap-1 bg-gray-900 rounded-full px-3 py-1.5">
        <Globe size={10} className="text-gray-500"/>
        {(['bn-IN','en-IN'] as const).map(l => (
          <button key={l} onClick={onLangToggle}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors ${lang===l ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>
            {l==='bn-IN'?tr('বাং'):'EN'}
          </button>
        ))}
      </div>
      {listening && (
        <div className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
          {tr('🔴 বলুন...')}
        </div>
      )}
      <button onClick={toggle}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
          listening ? 'bg-red-500 animate-pulse shadow-red-500/40' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/40'
        }`}>
        {listening ? <MicOff size={22} className="text-white"/> : <Mic size={22} className="text-white"/>}
      </button>
    </div>
  )
}

// ── Agent Stats Card ─────────────────────────────────────────────
// ── Agent Stats Card ─────────────────────────────────────────────
function AgentStatsCard({ agent, stats, onClick, locked = false, lockedLabel }: { agent: any; stats: any; onClick: () => void; locked?: boolean; lockedLabel?: string }) {
  const accent = agent.accent || agent.color || '#4F46E5'
  const tint = agent.light || `${accent}1A`
  return (
    <div onClick={onClick} style={{ background: locked ? '#F9FAFB' : tint, borderColor: locked ? '#E5E7EB' : `${accent}30`, boxShadow: `0 0 0 rgba(0,0,0,0)` }}
      onMouseEnter={e => { if (!locked) e.currentTarget.style.boxShadow = `0 12px 28px -8px ${accent}55` }}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = `0 0 0 rgba(0,0,0,0)`)}
      className={`relative rounded-2xl border overflow-hidden transition-all cursor-pointer group ${locked ? 'opacity-60' : 'hover:-translate-y-0.5'}`}>
      {locked && (
        <div className="absolute top-3 right-3 z-10 text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full bg-gray-900/80 text-white flex items-center gap-1 bengali">
          <Lock size={10}/> {lockedLabel || tr('আপগ্রেড করুন')}
        </div>
      )}
      <div className="h-1.5 w-full" style={{ background: locked ? '#D1D5DB' : `linear-gradient(90deg, ${accent}, ${accent}99, ${accent})` }}/>
      <div className="p-3 sm:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 bg-white shadow-sm">
              {agent.icon}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-gray-900 text-[13px] sm:text-[14px] bengali truncate">{agent.name_bn || agent.name}</div>
              {!locked && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                  <span className="text-[10px] text-emerald-600 font-medium">Active</span>
                </div>
              )}
            </div>
          </div>
          <ChevronRight size={13} className="text-gray-400 group-hover:translate-x-0.5 transition-transform mt-1 flex-shrink-0" style={{ color: accent }}/>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-1.5 sm:p-2.5 text-center">
            <div className="text-[12px] sm:text-[15px] font-extrabold text-gray-900">₹{stats?.todaySales ?? 0}</div>
            <div className="text-[9px] sm:text-[10px] text-gray-500 bengali">{tr('আজ বিক্রি')}</div>
          </div>
          <div className="bg-white/70 backdrop-blur-sm rounded-lg p-1.5 sm:p-2.5 text-center">
            <div className="text-[12px] sm:text-[15px] font-extrabold text-gray-900">{stats?.totalRecords ?? 0}</div>
            <div className="text-[9px] sm:text-[10px] text-gray-500 bengali">{tr('রেকর্ড')}</div>
          </div>
          <div className={`rounded-lg p-1.5 sm:p-2.5 text-center ${(stats?.lowStock ?? 0) > 0 ? 'bg-amber-100' : 'bg-white/70 backdrop-blur-sm'}`}>
            <div className={`text-[12px] sm:text-[15px] font-extrabold ${(stats?.lowStock ?? 0) > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
              {stats?.lowStock ?? 0}
            </div>
            <div className="text-[9px] sm:text-[10px] text-gray-500 bengali">{tr('কম স্টক')}</div>
          </div>
        </div>

        {/* Quick actions */}
        {locked ? (
          <button onClick={e => { e.stopPropagation(); onClick() }}
            className="w-full flex items-center justify-center gap-1 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors">
            <Lock size={10}/> <span className="bengali">{tr('Library-তে গিয়ে বেছে নিন')}</span>
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button onClick={e => { e.stopPropagation(); onClick() }}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold text-white transition-all hover:opacity-90"
              style={{ background: agent.accent || '#4F46E5' }}>
              <MessageSquare size={10}/> <span className="bengali">Chat</span>
            </button>
            <button onClick={e => { e.stopPropagation(); onClick() }}
              className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors">
              <BarChart2 size={12}/>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Compact KPI tile (Overview) ──────────────────────────────────
function KpiCard({ gradient, shadow, icon, value, delta, label, sub, onClick, className = '', big = false, subMobile = false }: {
  className?: string; big?: boolean; subMobile?: boolean
  gradient: string; shadow: string; icon: React.ReactNode; value: React.ReactNode
  delta?: string; label: string; sub?: React.ReactNode; onClick?: () => void
}) {
  const Tag: any = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick}
      className={`text-left rounded-2xl p-3 max-sm:p-2 sm:p-3.5 text-white bg-gradient-to-br ${gradient} shadow-lg ${shadow} hover:shadow-xl hover:-translate-y-0.5 transition-all relative overflow-hidden flex flex-col justify-between min-w-0 ${className}`}>
      <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-white/10"/>
      <div className="flex items-start justify-between gap-1 relative">
        <div className="text-[11px] max-sm:text-[10px] sm:text-[12px] text-white/85 bengali leading-tight">{label}</div>
        <div className="max-sm:hidden w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/20">{icon}</div>
      </div>
      <div className="flex items-baseline gap-1.5 mt-1.5 relative">
        <span className={`${big ? 'text-3xl max-sm:text-base lg:text-2xl' : 'text-xl max-sm:text-base sm:text-2xl'} font-extrabold leading-none`}>{value}</span>
        {delta && <span className="text-[11px] font-bold text-white/90">{delta}</span>}
      </div>
      <div className={`text-[10px] text-white/75 bengali mt-1 min-h-[14px] truncate relative max-sm:hidden`}>{sub}</div>
    </Tag>
  )
}

// ── Sidebar Nav Item ─────────────────────────────────────────────
function NavItem({ icon, label, active, onClick, badge, collapsed, locked, onLockedClick }: {
  icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; badge?: number; collapsed?: boolean
  locked?: boolean; onLockedClick?: () => void
}) {
  return (
    <button
      onClick={locked ? onLockedClick : onClick}
      title={collapsed ? label : (locked ? tr('Business প্ল্যানে আপগ্রেড করুন') : undefined)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 text-left bengali active:scale-[0.98] ${
        active
          ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-300/50'
          : locked
          ? 'text-gray-400 hover:bg-gray-50'
          : 'text-gray-500 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-fuchsia-50 hover:text-indigo-700'
      } ${collapsed ? 'justify-center' : ''}`}>
      <span className={`flex-shrink-0 transition-colors ${active ? 'text-white' : locked ? 'text-gray-300' : 'text-gray-400'}`}>{icon}</span>
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && locked && <Lock size={12} className="text-gray-300 flex-shrink-0" />}
      {!collapsed && !locked && badge ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/25 text-white' : 'bg-fuchsia-100 text-fuchsia-600'}`}>{badge}</span> : null}
    </button>
  )
}

// ── Sidebar Nav Group — a collapsible category header + its NavItems.
// When the sidebar itself is icon-only (collapsed=true), the header and
// toggle are skipped entirely and children render flat, same as before.
function NavGroup({ label, icon, children, collapsed, defaultOpen = true }: {
  label: string; icon: React.ReactNode; children: React.ReactNode; collapsed?: boolean; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (collapsed) return <>{children}</>
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 sm:py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600 active:scale-[0.98] transition-all"
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className="flex-1 text-left bengali">{label}</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────
type View = 'overview' | 'my-agents' | 'library' | 'build-agent' | 'stock' | 'sales' | 'dues' | 'notebook' | 'invoice' | 'invoice-history' | 'customer' | 'supply' | 'followup' | 'reports' | 'crm' | 'whatsapp' | 'catalog' | 'settings'

type AgentNote = {
  id: string
  agent_id: string | null
  library_slug: string | null
  agent_name: string
  agent_icon: string | null
  content: string
  source: 'text' | 'voice'
  created_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const { t, lang } = useLanguage()
  const [user, setUser]                     = useState<any>(null)
  const [loading, setLoading]               = useState(true)
  const [agents, setAgents]                 = useState<any[]>([])
  const [selectedAgent, setSelectedAgent]   = useState<any>(null)
  // Which library agent's own CRM is showing in the CRM & Billing view
  // (only set for canonical library agents — see CANONICAL_LIB_SLUGS).
  const [selectedCrmLibSlug, setSelectedCrmLibSlug] = useState<string | null>(null)
  // Bumped after the CRM AI Assistant panel writes data (new customer, new
  // purchase, etc.) so CRMDashboard's own fetch re-runs and shows it.
  const [crmRefreshNonce, setCrmRefreshNonce] = useState(0)
  const [agentView, setAgentView]           = useState<'chat'|'reports'|'crm'>('chat')
  const [view, setView]                     = useState<View>('overview')
  // Clear the library-CRM selection whenever the person navigates to any
  // other view, so coming back to CRM later — or a stale nav highlight —
  // doesn't show a library agent that isn't actually selected anymore.
  useEffect(() => { if (view !== 'crm') setSelectedCrmLibSlug(null) }, [view])
  // ── Enterprise team login ──────────────────────────────────────
  // 'owner' for every normal single-user account (including this app's own
  // admins) — only an active team_members row changes this. effectiveOwnerId
  // is whose data every query below reads/writes: the owner's, always —
  // never the logged-in team member's own (blank) user_id.
  const [teamRole, setTeamRole]             = useState<TeamRole>('owner')
  const [effectiveOwnerId, setEffectiveOwnerId] = useState<string | null>(null)
  const ownerId = effectiveOwnerId || user?.id || ''
  const canFullDashboard = teamRole === 'owner' || teamRole === 'admin'
  // Safety net: however `view` got set (quick action, agent open, a stale
  // link), bounce a restricted role back to their own default tab rather
  // than ever rendering something their role shouldn't see.
  useEffect(() => {
    if (teamRole === 'owner' || teamRole === 'admin') return
    if (!canSeeView(teamRole, view)) setView(ROLE_DEFAULT_VIEW[teamRole])
  }, [view, teamRole])
  const [micLang, setMicLang]               = useState<'bn-IN'|'en-IN'>('bn-IN')
  const [libStats, setLibStats]             = useState<Record<string, any>>({})
  const [aiOpen, setAiOpen]                 = useState(false) // phone: full-screen AI assistant
  const [agentStats, setAgentStats]         = useState<Record<string, any>>({})
  const [overallToday, setOverallToday]     = useState(0)
  const [overallRecords, setOverallRecords] = useState(0)
  const [lowStockTotal, setLowStockTotal]   = useState(0)
  // Extra Overview KPIs + "today's important tasks", both bubbled up from
  // OverviewInsights (which already fetches all the underlying per-vertical
  // data — no need to re-fetch it here).
  const [overviewStats, setOverviewStats]   = useState<OverviewStats | null>(null)
  const [overviewTasks, setOverviewTasks]   = useState<TaskItem[]>([])
  const [recentAIActivity, setRecentAIActivity] = useState<RecentActivityItem[]>([])
  // My Agents page: local filter/search/sort/view-mode + which card's kebab menu is open
  const [maFilter, setMaFilter]   = useState<'all' | 'active' | 'inactive' | 'library' | 'custom'>('all')
  const [maSearch, setMaSearch]   = useState('')
  const [maSort, setMaSort]       = useState<'newest' | 'oldest'>('newest')
  const [maViewMode, setMaViewMode] = useState<'grid' | 'list'>('grid')
  const [maMenuOpenKey, setMaMenuOpenKey] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen]       = useState(false) // opens on desktop via useEffect
  const [subscription, setSubscription]     = useState<any>(null)
  const [isAdmin, setIsAdmin]               = useState(false)
  // Basic-plan profile dropdown (Home / Logout)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  // Admin-only: open /dashboard?previewPlan=basic to see exactly what a ₹99 user sees
  // (platform admins bypass subscriptions, so they can't see the Basic layout otherwise).
  const [previewPlan, setPreviewPlan] = useState<string | null>(null)
  const [debugPlan, setDebugPlan] = useState(false)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setPreviewPlan(q.get('previewPlan'))
    setDebugPlan(q.get('debugPlan') === '1')   // /dashboard?debugPlan=1 → shows why the layout is what it is
  }, [])
  useEffect(() => {
    if (!profileMenuOpen) return
    const close = (e: Event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) setProfileMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close) }
  }, [profileMenuOpen])
  const [shopProfile, setShopProfile] = useState({ shop_name: '', owner_name: '', phone: '', address: '', gstin: '', upi_id: '', print_footer: '', logo_url: '' as string | null, signature_url: '' as string | null })
  const [savingShopProfile, setSavingShopProfile] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingSignature, setUploadingSignature] = useState(false)
  const [notes, setNotes]                   = useState<AgentNote[]>([])
  const [notesLoading, setNotesLoading]     = useState(false)
  const [noteText, setNoteText]             = useState('')
  const [noteAgentKey, setNoteAgentKey]     = useState<string>('') // 'lib:<slug>' or 'custom:<id>'
  const [noteSaving, setNoteSaving]         = useState(false)
  const [noteListening, setNoteListening]   = useState(false)
  const { activations, isActivated, loading: actLoading } = useAgentActivation(user?.id || null, subscription)

  // AI chat agents for an employee (hooks must stay above the early `if (loading) return` below)
  const [memberChatAgents, setMemberChatAgents] = useState<any[] | null>(null)
  useEffect(() => {
    if (!user || teamRole === 'owner') { setMemberChatAgents(null); return }
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        const r = await fetch('/api/chat/context', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' })
        if (r.ok) setMemberChatAgents((await r.json()).agents || [])
      } catch { /* leave the list empty */ }
    })()
  }, [user, teamRole])
  const agentLimit = getAgentLimit(subscription)
  const activeLibCount = activations.length
  // IST-aware "today" — toISOString() is UTC and lags India local time by
  // up to 5.5h, mislabeling sales made 12:00–5:30 AM IST as "yesterday".
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  // For .gte('created_at', ...) below: created_at is a timestamp column, so a
  // bare date string gets compared against UTC midnight, not IST midnight.
  // Use an explicit +05:30 instant for "start of today, India time" instead.
  const todayStartUTC = new Date(`${today}T00:00:00+05:30`).toISOString()

  // ── Open sidebar on desktop only ────────────────────────────
  // Mic (voice) language follows the app language by default — one language
  // control for the whole top bar instead of two. Power users can still
  // override just the voice language from Settings → Voice ভাষা.
  useEffect(() => { setMicLang(lang === 'en' ? 'en-IN' : 'bn-IN') }, [lang])

  // Default the notebook agent picker once we know which agents exist
  useEffect(() => {
    if (noteAgentKey) return
    const first = [
      ...LIBRARY_AGENTS.filter(lib => isActivated('library', lib.slug)).map(lib => `lib:${lib.slug}`),
      ...agents.map(a => `custom:${a.id}`),
    ][0]
    if (first) setNoteAgentKey(first)
  }, [agents, activations]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Open sidebar on desktop only ────────────────────────────
  useEffect(() => {
    const check = () => setSidebarOpen(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Load user + agents ───────────────────────────────────────
  // Speed: (1) getSession() reads the saved login — no server round-trip (getUser() was
  // a blocking call every time); (2) all queries run in parallel instead of one after
  // another; (3) the last result is cached on this device, so a repeat visit paints the
  // dashboard instantly and refreshes quietly. Data access is still enforced server-side
  // (RLS), this only decides what the browser shows first.
  useEffect(() => {
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const authUser = session?.user
      if (!authUser) { router.push('/login'); return }

      const applyBundle = (b: any) => {
        setTeamRole(b.role)
        setEffectiveOwnerId(b.ownerId)
        setIsAdmin(!!b.isAdmin)
        setSubscription(b.subscription)
        if (b.shop) setShopProfile(b.shop)
        setAgents(b.agents || [])
        setUser(authUser)
        // Restricted roles never land on the combined Overview screen.
        if (b.role === 'sales' || b.role === 'stock') setView(ROLE_DEFAULT_VIEW[b.role as 'sales' | 'stock'])
      }

      // 1) Instant paint from the last visit
      const cacheKey = `init:${authUser.id}`
      const cached = readCache<any>(cacheKey)
      if (cached) {
        applyBundle(cached)
        hydrateStats(cached.ownerId)
        setLoading(false)
        loadAllStats(cached.ownerId)
        loadNotes(cached.ownerId)
      }

      // 2) Fresh data — everything for one account in parallel
      const fetchAccount = (uid: string) => Promise.all([
        supabase.from('profiles').select('is_admin').eq('id', uid).single(),
        fetchSubscription(uid),
        supabase.from('user_agent_activations').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('profiles')
          .select('shop_name, owner_name, phone, address, gstin, upi_id, print_footer, logo_url, signature_url').eq('id', uid).single(),
        supabase.from('agents').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      ])

      // Is this login a team member of someone else's shop? Only an *active* team_members
      // row counts — anyone else is the owner of their own account. Looked up in parallel
      // with the owner's own data (the 99% case); only a team member needs a second round.
      const [membershipRes, own] = await Promise.all([
        supabase.from('team_members').select('owner_user_id, role, status')
          .eq('member_user_id', authUser.id).eq('status', 'active').maybeSingle(),
        fetchAccount(authUser.id),
      ])
      const membership = membershipRes.data
      const resolvedRole: TeamRole = !membership ? 'owner'
        : membership.role === 'admin' ? 'admin'
        : membership.role === 'stock' ? 'stock' : 'sales'
      const resolvedOwnerId = membership?.owner_user_id || authUser.id
      const [profileRes, sub0, activationRes, shopRes, agentsRes] =
        resolvedOwnerId === authUser.id ? own : await fetchAccount(resolvedOwnerId)

      const profile = profileRes.data
      // Platform-superadmin bypass only ever applies to the owner logging into their own
      // account — a team member never inherits it.
      const adminFlag = !!profile?.is_admin && resolvedRole === 'owner'
      const sub = profile?.is_admin ? null : sub0
      if (!profile?.is_admin && !computeAccess(sub).hasAccess && resolvedRole === 'owner') { router.push('/subscribe'); return }
      // Brand-new owner (no agent ever picked yet) → Library first. A team member has no
      // activations of their own to check.
      if (!activationRes.count && resolvedRole === 'owner') { router.push('/library'); return }

      const shopData: any = shopRes.data
      const bundle = {
        role: resolvedRole, ownerId: resolvedOwnerId, isAdmin: adminFlag, subscription: sub,
        shop: shopData ? {
          shop_name: shopData.shop_name || '', owner_name: shopData.owner_name || '',
          phone: shopData.phone || '', address: shopData.address || '',
          gstin: shopData.gstin || '', upi_id: shopData.upi_id || '',
          print_footer: shopData.print_footer || 'ধন্যবাদ! আবার আসবেন 🙏',
          logo_url: shopData.logo_url || null, signature_url: shopData.signature_url || null,
        } : null,
        agents: agentsRes.data || [],
      }
      applyBundle(bundle)
      writeCache(cacheKey, bundle)
      if (!cached || cached.ownerId !== resolvedOwnerId) {
        hydrateStats(resolvedOwnerId)
        loadAllStats(resolvedOwnerId)
        loadNotes(resolvedOwnerId)
      }
      setLoading(false)
    })()
  }, [router])

  // ── Load stats for all agents ────────────────────────────────
  const loadAllStats = async (uid: string) => {
    let totalToday = 0, totalRec = 0, totalLow = 0

    // Library stats — all parallel (and in parallel with the custom-agent queries below)
    const libResults: Record<string, any> = {}
    const libPromise = Promise.all(LIBRARY_AGENTS.map(async (lib: any) => {
      try {
        if (lib.canonical) {
          const agentId = LIBRARY_AGENT_IDS.dokan
          const [todayRes, allRes, lowRes, stockCountRes, custRes] = await Promise.all([
            supabase.from('daily_sales').select('total_amount').eq('user_id', uid).eq('agent_id', agentId).gte('created_at', todayStartUTC),
            supabase.from('daily_sales').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('agent_id', agentId),
            supabase.from('stock_items').select('id').eq('user_id', uid).eq('agent_id', agentId).lte('current_qty', 5).gt('current_qty', 0),
            supabase.from('stock_items').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('agent_id', agentId),
            supabase.from('crm_customers').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('agent_id', agentId),
          ])
          const todayTotal = (todayRes.data || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0)
          const recs = allRes.count ?? 0
          const low = lowRes.data?.length ?? 0
          libResults[lib.slug] = { todaySales: Math.round(todayTotal), totalRecords: recs, lowStock: low, totalStock: stockCountRes.count ?? 0, totalCustomers: custRes.count ?? 0 }
          totalToday += todayTotal; totalRec += recs; totalLow += low
          return
        }
        if (lib.slug === 'hotel-and-dhaba-manager') {
          const [todayRes, allRes, lowRes, custRes] = await Promise.all([
            supabase.from('hotel_orders').select('total_amount').eq('user_id', uid).gte('created_at', todayStartUTC),
            supabase.from('hotel_orders').select('*', { count: 'exact', head: true }).eq('user_id', uid),
            supabase.from('hotel_stock').select('quantity,min_quantity').eq('user_id', uid),
            supabase.from('crm_customers').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('agent_id', LIBRARY_AGENT_IDS.hotel),
          ])
          const todayTotal = (todayRes.data || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0)
          const recs = allRes.count ?? 0
          const low = (lowRes.data || []).filter((r: any) => Number(r.quantity) > 0 && Number(r.quantity) <= Number(r.min_quantity || 5)).length
          libResults[lib.slug] = { todaySales: Math.round(todayTotal), totalRecords: recs, lowStock: low, totalStock: lowRes.data?.length ?? 0, totalCustomers: custRes.count ?? 0 }
          totalToday += todayTotal; totalRec += recs; totalLow += low
          return
        }
        if (lib.slug === 'mishti-dokan-manager') {
          const [todayRes, allRes, lowRes, custRes] = await Promise.all([
            supabase.from('mishti_sales').select('total_amount').eq('user_id', uid).gte('created_at', todayStartUTC),
            supabase.from('mishti_sales').select('*', { count: 'exact', head: true }).eq('user_id', uid),
            supabase.from('mishti_items').select('stock_kg,min_stock_kg').eq('user_id', uid),
            supabase.from('crm_customers').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('agent_id', LIBRARY_AGENT_IDS.mishti),
          ])
          const todayTotal = (todayRes.data || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0)
          const recs = allRes.count ?? 0
          const low = (lowRes.data || []).filter((r: any) => Number(r.stock_kg) > 0 && Number(r.stock_kg) <= Number(r.min_stock_kg || 1)).length
          libResults[lib.slug] = { todaySales: Math.round(todayTotal), totalRecords: recs, lowStock: low, totalStock: lowRes.data?.length ?? 0, totalCustomers: custRes.count ?? 0 }
          totalToday += todayTotal; totalRec += recs; totalLow += low
          return
        }
        if (lib.slug === 'kaporer-dokan-tracker') {
          const [todayRes, allRes, lowRes, custRes] = await Promise.all([
            supabase.from('kapor_sales').select('total_amount').eq('user_id', uid).gte('created_at', todayStartUTC),
            supabase.from('kapor_sales').select('*', { count: 'exact', head: true }).eq('user_id', uid),
            supabase.from('kapor_products').select('stock_qty,min_stock').eq('user_id', uid),
            supabase.from('crm_customers').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('agent_id', LIBRARY_AGENT_IDS.kapor),
          ])
          const todayTotal = (todayRes.data || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0)
          const recs = allRes.count ?? 0
          const low = (lowRes.data || []).filter((r: any) => Number(r.stock_qty) > 0 && Number(r.stock_qty) <= Number(r.min_stock || 5)).length
          libResults[lib.slug] = { todaySales: Math.round(todayTotal), totalRecords: recs, lowStock: low, totalStock: lowRes.data?.length ?? 0, totalCustomers: custRes.count ?? 0 }
          totalToday += todayTotal; totalRec += recs; totalLow += low
          return
        }
        if (lib.slug === 'pharmacy-assistant') {
          const [todayRes, allRes, lowRes, custRes] = await Promise.all([
            supabase.from('crm_purchases').select('total_amount,crm_customers!inner(business_type)').eq('user_id', uid).eq('crm_customers.business_type', 'pharmacy').gte('created_at', todayStartUTC),
            supabase.from('crm_purchases').select('id,crm_customers!inner(business_type)', { count: 'exact', head: true }).eq('user_id', uid).eq('crm_customers.business_type', 'pharmacy'),
            supabase.from('pharmacy_medicines').select('stock,min_stock').eq('user_id', uid),
            supabase.from('crm_customers').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('business_type', 'pharmacy'),
          ])
          const todayTotal = (todayRes.data || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0)
          const recs = allRes.count ?? 0
          const low = (lowRes.data || []).filter((r: any) => Number(r.stock) > 0 && Number(r.stock) <= Number(r.min_stock || 20)).length
          libResults[lib.slug] = { todaySales: Math.round(todayTotal), totalRecords: recs, lowStock: low, totalStock: lowRes.data?.length ?? 0, totalCustomers: custRes.count ?? 0 }
          totalToday += todayTotal; totalRec += recs; totalLow += low
          return
        }
      } catch { libResults[lib.slug] = { todaySales: 0, totalRecords: 0, lowStock: 0, totalStock: 0, totalCustomers: 0 } }
    }))

    // Custom agent stats (from agent_records) + per-agent customer counts
    const [, { data: records }, { data: custRows }] = await Promise.all([
      libPromise,
      supabase.from('agent_records').select('agent_id, record_type, amount, recorded_at').eq('user_id', uid),
      supabase.from('crm_customers').select('agent_id').eq('user_id', uid).not('agent_id', 'is', null),
    ])
    const custCountByAgent: Record<string, number> = {}
    for (const c of custRows || []) custCountByAgent[c.agent_id] = (custCountByAgent[c.agent_id] || 0) + 1
    const recByAgent: Record<string, any> = {}
    for (const r of records || []) {
      if (!recByAgent[r.agent_id]) recByAgent[r.agent_id] = { todaySales: 0, totalRecords: 0, lowStock: 0 }
      recByAgent[r.agent_id].totalRecords++
      if (r.recorded_at?.slice(0, 10) === today && r.record_type === 'sale')
        recByAgent[r.agent_id].todaySales += Number(r.amount || 0)
    }
    for (const agentId of Object.keys(custCountByAgent)) {
      if (!recByAgent[agentId]) recByAgent[agentId] = { todaySales: 0, totalRecords: 0, lowStock: 0 }
      recByAgent[agentId].totalCustomers = custCountByAgent[agentId]
    }
    // agent_records doesn't distinguish "stock" line items from sales/expenses
    // cleanly enough to total per-agent, so custom-agent cards show customers
    // (real) + records (real) rather than a stock count.
    setAgentStats(recByAgent)

    setLibStats(libResults)

    // Overall (same agent_records rows as above — no second query)
    const extraToday = (records || []).filter(r => r.recorded_at?.slice(0, 10) === today && r.record_type === 'sale')
      .reduce((s, r) => s + Number(r.amount || 0), 0)
    const extraRecs = records?.length ?? 0
    setOverallToday(Math.round(totalToday + extraToday))
    setOverallRecords(totalRec + extraRecs)
    setLowStockTotal(totalLow)
    writeCache(`stats:${uid}`, {
      lib: libResults, agent: recByAgent,
      today: Math.round(totalToday + extraToday), records: totalRec + extraRecs, low: totalLow,
    })
  }

  // Instantly show the last known numbers while fresh ones load
  const hydrateStats = (uid: string) => {
    const c = readCache<any>(`stats:${uid}`)
    if (!c) return
    setLibStats(c.lib || {}); setAgentStats(c.agent || {})
    setOverallToday(c.today || 0); setOverallRecords(c.records || 0); setLowStockTotal(c.low || 0)
  }

  // Overview's quick-actions row + task-card "view" links all funnel through
  // here — maps each action id to the closest matching sidebar view.
  const handleQuickAction = (actionId: string) => {
    const map: Partial<Record<string, View>> = {
      sales: 'sales', stock: 'stock', customer: 'customer', invoice: 'invoice',
      expiry: 'stock', reports: 'reports', expense: 'notebook', more: 'my-agents',
    }
    const target = map[actionId]
    if (target) { setView(target); setSelectedAgent(null) }
  }

  // ── AI Notebook: load + add notes ──────────────────────────────
  const loadNotes = async (uid: string) => {
    setNotesLoading(true)
    const { data, error } = await supabase.from('agent_notes')
      .select('*').eq('user_id', uid).order('created_at', { ascending: false })
    if (!error && data) setNotes(data as AgentNote[])
    setNotesLoading(false)
  }

  const addNote = async (content: string, source: 'text' | 'voice') => {
    if (!content.trim() || !user) return
    const target = noteAgentOptions.find(o => o.key === noteAgentKey) || noteAgentOptions[0]
    if (!target) { toast.error('আগে একটা Agent সিলেক্ট করুন'); return }
    setNoteSaving(true)
    const payload: any = {
      user_id: ownerId,
      agent_id: target.isLibrary ? null : target.id,
      library_slug: target.isLibrary ? target.slug : null,
      agent_name: target.name,
      agent_icon: target.icon,
      content: content.trim(),
      source,
    }
    const { data, error } = await supabase.from('agent_notes').insert(payload).select().single()
    if (error) { toast.error('নোট সেভ করা যায়নি'); console.error('agent_notes insert:', error) }
    else { setNotes(prev => [data as AgentNote, ...prev]); setNoteText(''); toast.success('নোট যোগ হয়েছে') }
    setNoteSaving(false)
  }

  const deleteNote = async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id))
    const { error } = await supabase.from('agent_notes').delete().eq('id', id)
    if (error) toast.error('মুছে ফেলা যায়নি')
  }

  const toggleNoteVoice = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { toast.error('Voice support নেই'); return }
    if (noteListening) { setNoteListening(false); return }
    const r = new SR()
    r.lang = micLang; r.interimResults = false; r.continuous = false
    r.onstart = () => setNoteListening(true)
    r.onend   = () => setNoteListening(false)
    r.onerror = (e: any) => { setNoteListening(false); if (e.error === 'not-allowed') toast.error('Microphone permission দিন') }
    r.onresult = (e: any) => {
      const text = Array.from(e.results).map((r: any) => r[0].transcript).join('')
      addNote(text, 'voice')
    }
    r.start()
  }, [noteListening, micLang, noteAgentKey, user, notes])

  const handleMicTranscript = useCallback((text: string) => {
    window.dispatchEvent(new CustomEvent('sahayak-voice-input', { detail: { text } }))
    toast.success(`বললেন: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`)
  }, [])

  const openLibAgent = (lib: typeof LIBRARY_AGENTS[0]) => {
    // Plan enforcement: only agents this account has actually activated
    // (within its plan's agent limit) can be opened. Anything else goes
    // to /library, where activation / upgrade is handled.
    if (!isActivated('library', lib.slug)) { router.push('/library'); return }
    setSelectedAgent({ ...lib, name_bn: lib.name, color: lib.light, isLibrary: true })
    setAgentView('chat')
    setView('my-agents')
  }

  const openCustomAgent = (agent: any) => {
    setSelectedAgent(agent); setAgentView('chat'); setView('my-agents')
  }
    // Mobile-friendly nav: after picking any sidebar item on a phone/small
  // screen, auto-close the drawer so the new view is actually visible
  // instead of staying hidden behind the open sidebar overlay. On
  // desktop (>=1024px) this is a no-op — sidebarOpen there controls the
  // icon-only vs expanded rail, not an overlay, so it must stay untouched.
  const navigateTo = (fn: () => void) => {
    fn()
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut(); clearAllCache(); router.push('/')
  }

  // Unified list for the My Agents page — library + custom agents normalized
  // to one shape so search/filter/sort/rendering don't need to branch on kind.
  // "Active" has no real DB column (no such status exists yet) — approximated
  // here as "has ever recorded at least one record/sale", which is the best
  // available signal for "in real use" vs "set up but untouched".
  type MyAgentEntry = {
    key: string; kind: 'library' | 'custom'; name: string; icon: string; color: string
    category: string; isActive: boolean; createdAt: number
    stats: { todaySales: number; secondaryLabel: string; secondaryVal: number; totalCustomers: number }
    onOpen: () => void
  }
  const myAgentEntries: MyAgentEntry[] = useMemo(() => {
    const libEntries: MyAgentEntry[] = LIBRARY_AGENTS.filter(lib => isActivated('library', lib.slug)).map(lib => {
      const s = libStats[lib.slug] || {}
      return {
        key: `lib:${lib.slug}`, kind: 'library', name: lib.name, icon: lib.icon, color: lib.accent,
        category: lib.categoryLabel, isActive: (s.totalRecords ?? 0) > 0, createdAt: 0,
        stats: { todaySales: s.todaySales ?? 0, secondaryLabel: t('overview.kpi.totalStock'), secondaryVal: s.totalStock ?? 0, totalCustomers: s.totalCustomers ?? 0 },
        onOpen: () => openLibAgent(lib),
      }
    })
    const customEntries: MyAgentEntry[] = agents.map(agent => {
      const s = agentStats[agent.id] || {}
      const category = agent.business_type ? BUSINESS_TYPE_LABELS[agent.business_type as BusinessType].en : (CATEGORY_LABELS[agent.category as AgentCategory]?.en || 'Business')
      return {
        key: `custom:${agent.id}`, kind: 'custom', name: agent.name_bn || agent.name, icon: agent.icon, color: agent.color,
        category, isActive: (s.totalRecords ?? 0) > 0, createdAt: new Date(agent.created_at).getTime(),
        stats: { todaySales: s.todaySales ?? 0, secondaryLabel: 'মোট রেকর্ড', secondaryVal: s.totalRecords ?? 0, totalCustomers: s.totalCustomers ?? 0 },
        onOpen: () => openCustomAgent(agent),
      }
    })
    return [...libEntries, ...customEntries]
  }, [agents, libStats, agentStats, isActivated])

  const maCounts = useMemo(() => ({
    all: myAgentEntries.length,
    active: myAgentEntries.filter(a => a.isActive).length,
    inactive: myAgentEntries.filter(a => !a.isActive).length,
    library: myAgentEntries.filter(a => a.kind === 'library').length,
    custom: myAgentEntries.filter(a => a.kind === 'custom').length,
  }), [myAgentEntries])

  const maFiltered = useMemo(() => {
    let list = myAgentEntries
    if (maFilter === 'active') list = list.filter(a => a.isActive)
    else if (maFilter === 'inactive') list = list.filter(a => !a.isActive)
    else if (maFilter === 'library') list = list.filter(a => a.kind === 'library')
    else if (maFilter === 'custom') list = list.filter(a => a.kind === 'custom')
    if (maSearch.trim()) {
      const q = maSearch.trim().toLowerCase()
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => maSort === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt)
  }, [myAgentEntries, maFilter, maSearch, maSort])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"/>
        <span className="text-gray-400 text-sm bengali">{tr('লোড হচ্ছে...')}</span>
      </div>
    </div>
  )
  if (!user) return null

  const userName = user.user_metadata?.full_name || user.user_metadata?.business_name || user.email?.split('@')[0] || 'বন্ধু'
  const userInitial = userName.slice(0, 1).toUpperCase()
  // First name only for greeting / header (e.g. "JAYDEB SARADER" -> "Jaydeb")
  const firstName = (() => {
    const f = String(userName).trim().split(/\s+/)[0] || userName
    return /^[A-Za-z]+$/.test(f) ? f.charAt(0).toUpperCase() + f.slice(1).toLowerCase() : f
  })()
  // Language switcher is for Starter / Business / Admin. Paid Basic (₹99) doesn't get it.
  // Plan → dashboard chrome. All rules live in src/lib/dashboardTier.ts
  const tier = getDashboardTier(subscription, isAdmin, previewPlan)
  const tierUI = TIER_UI[tier]
  const isBasicPlan = tierUI.profileMenuOnly
  const showLangToggle = tierUI.languageToggle
  const showSidebarMenu = tierUI.sidebarMenu
  const previewing = isAdmin && !!previewPlan && previewPlan === tier

  const allAgents = [
    ...LIBRARY_AGENTS.map(l => ({ ...l, isLibrary: true, id: l.slug, name_bn: l.name, color: l.light })),
    ...agents.map(a => ({ ...a, isLibrary: false })),
  ]
  const agentNameById: Record<string, string> = {}
  const agentColorById: Record<string, string> = {}
  const libDisplay = libraryAgentDisplayById()
  for (const [id, info] of Object.entries(libDisplay)) { agentNameById[id] = info.name; agentColorById[id] = info.color }
  for (const a of agents) { agentNameById[a.id] = a.name_bn || a.name; agentColorById[a.id] = a.color || '#6366F1' }

  // Agents the Notebook can attach a note to: library agents in use + custom agents
  const noteAgentOptions = [
    ...LIBRARY_AGENTS.filter(lib => isActivated('library', lib.slug))
      .map(lib => ({ key: `lib:${lib.slug}`, id: lib.slug, slug: lib.slug, isLibrary: true, name: lib.name, icon: lib.icon, accent: lib.accent })),
    ...agents.map(a => ({ key: `custom:${a.id}`, id: a.id, slug: null as string | null, isLibrary: false, name: a.name_bn || a.name, icon: a.icon, accent: a.color })),
  ]
  const lowStockAgents = allAgents.filter(a =>
    a.isLibrary ? (libStats[a.slug]?.lowStock ?? 0) > 0 : false
  ).length

  // Library agents this user actually has data in (used for smart sidebar routing)
  const usedLibs = LIBRARY_AGENTS.filter(lib => isActivated('library', lib.slug))

  // ── AI chat: which agents / which role ───────────────────────────
  // Owner: their own activated library agents + custom agents (Starter → up to 3 → agent filter).
  // Employee: the owner's agents narrowed to the ones they were granted (resolved server-side,
  // because an employee has no activations of their own).
  const chatAgents = teamRole === 'owner'
    ? [
        ...usedLibs.map(lib => ({ isLibrary: true, slug: lib.slug, name: lib.name, icon: lib.icon, color: lib.accent })),
        ...agents.map(a => ({ isLibrary: false, id: a.id, name: a.name_bn || a.name, name_bn: a.name_bn || a.name, icon: a.icon, color: a.color })),
      ]
    : (memberChatAgents || [])
  // Business plan owners/admins may narrow the chat to sales-only / stock-only work.
  const canFocusChat = (teamRole === 'owner' || teamRole === 'admin') && (isAdmin || hasFeature(subscription?.plan, 'roles_permissions'))

  // "Library" nav: if exactly one library is in use and no custom agents exist,
  // skip the picker grid entirely and go straight to that dashboard.
  const goToLibrary = () => {
    if (usedLibs.length === 1 && agents.length === 0) {
      router.push(`/library/${usedLibs[0].slug}`)
    } else {
      setView('library'); setSelectedAgent(null)
    }
  }
  // "রিপোর্ট"/"CRM" nav: these only work for custom agents today. If the user has
  // no custom agents but does use exactly one library, deep-link into that
  // library's report/customer tab instead of showing a dead "no agent" message.
  const goToReports = () => {
    if (agents.length === 0 && usedLibs.length === 1) {
      router.push(`/library/${usedLibs[0].slug}?tab=report`)
    } else {
      setView('reports'); setSelectedAgent(null)
    }
  }
  const goToCRM = () => {
    if (agents.length === 0 && usedLibs.length === 1) {
      router.push(`/library/${usedLibs[0].slug}?tab=customers`)
    } else {
      setView('crm'); setSelectedAgent(null)
    }
  }

   // ── Sidebar ──────────────────────────────────────────────────
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024

  // Left content padding needs to track the sidebar's current width so the
  // main column never sits underneath (collapsed rail) or is cramped next
  // to (expanded rail) the fixed sidebar on desktop. On mobile the sidebar
  // is an overlay drawer, not part of layout flow, so no left padding there.
  const mainPad = sidebarOpen ? 'lg:pl-60' : 'lg:pl-16'

  const sidebar = (
    <>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)}/>
      )}
      <aside className={`fixed left-0 z-40 transition-all duration-300 bg-white border-r border-gray-100 flex flex-col
        ${sidebarOpen
          ? 'w-[85vw] max-w-[280px] translate-x-0 sm:w-60'
          : '-translate-x-full w-[85vw] max-w-[280px] sm:w-60 lg:translate-x-0 lg:w-16'
        }
      `} style={{ top: 0, height: '100dvh' }}>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-100 flex-shrink-0 ${!sidebarOpen ? 'justify-center' : ''}`} style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}>
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0 shadow-md shadow-violet-200">{tr('স')}</div>
        {sidebarOpen && <span className="font-extrabold text-gray-900 text-[15px] bengali">Sahayak AI</span>}
        {/* Explicit close button — easier to tap than the backdrop on a phone */}
        {sidebarOpen && (
          <button onClick={() => setSidebarOpen(false)} className="ml-auto w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center lg:hidden">
            <X size={16} className="text-gray-400"/>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto overscroll-contain">
        {sidebarOpen && <p className="text-[10px] font-bold bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent uppercase tracking-wider px-3 mb-2">{tr('মেনু')}</p>}

        {/* Home → back to the main marketing website, not the dashboard overview */}
        <NavItem icon={<Home size={16}/>} label={t('nav.home')} active={false} onClick={() => navigateTo(() => router.push('/'))} collapsed={!sidebarOpen}/>
        {canFullDashboard && (<>
          <NavItem icon={<LayoutDashboard size={16}/>} label={t('nav.overview')} active={view==='overview'} onClick={() => navigateTo(() => { setView('overview'); setSelectedAgent(null) })} collapsed={!sidebarOpen}/>
          <NavItem icon={<Bot size={16}/>} label={t('nav.myAgents')} active={view==='my-agents'} onClick={() => navigateTo(() => { setView('my-agents'); setSelectedAgent(null) })} badge={agents.length} collapsed={!sidebarOpen}/>
        </>)}

        <NavGroup label={tr('কাজের হিসাব')} icon={<Package size={13}/>} collapsed={!sidebarOpen} defaultOpen={true}>
          {canSeeView(teamRole,'stock') && <NavItem icon={<Package size={16}/>} label={t('nav.stock')} active={view==='stock'} onClick={() => navigateTo(() => { setView('stock'); setSelectedAgent(null) })} badge={lowStockTotal || undefined} collapsed={!sidebarOpen}/>}
          {canSeeView(teamRole,'sales') && <NavItem icon={<TrendingUp size={16}/>} label={t('nav.sales')} active={view==='sales'} onClick={() => navigateTo(() => { setView('sales'); setSelectedAgent(null) })} collapsed={!sidebarOpen}/>}
          {canSeeView(teamRole,'dues') && <NavItem icon={<IndianRupee size={16}/>} label={t('nav.dues')} active={view==='dues'} onClick={() => navigateTo(() => { setView('dues'); setSelectedAgent(null) })} collapsed={!sidebarOpen}/>}
          {canSeeView(teamRole,'customer') && <NavItem icon={<Users size={16}/>} label={t('nav.customer')} active={view==='customer'} onClick={() => navigateTo(() => { setView('customer'); setSelectedAgent(null) })} collapsed={!sidebarOpen}/>}
          {canSeeView(teamRole,'crm') && <NavItem icon={<Users size={16}/>} label={t('nav.crmBilling')} active={view==='crm'} onClick={() => navigateTo(goToCRM)} collapsed={!sidebarOpen}/>}
          {canSeeView(teamRole,'invoice') && <NavItem icon={<FileText size={16}/>} label={t('nav.invoice')} active={view==='invoice'} onClick={() => navigateTo(() => { setView('invoice'); setSelectedAgent(null) })} collapsed={!sidebarOpen}/>}
          {canSeeView(teamRole,'invoice-history') && <NavItem icon={<FileText size={16}/>} label={t('nav.invoiceHistory')} active={view==='invoice-history'} onClick={() => navigateTo(() => { setView('invoice-history'); setSelectedAgent(null) })} collapsed={!sidebarOpen}/>}
          {canSeeView(teamRole,'supply') && <NavItem icon={<Truck size={16}/>} label={t('nav.supply')} active={view==='supply'} onClick={() => navigateTo(() => { setView('supply'); setSelectedAgent(null) })} collapsed={!sidebarOpen}/>}
        </NavGroup>

        {canFullDashboard && (
        <NavGroup label="AI Tools" icon={<Zap size={13}/>} collapsed={!sidebarOpen} defaultOpen={true}>
          <NavItem icon={<NotebookPen size={16}/>} label={t('nav.notebook')} active={view==='notebook'} onClick={() => navigateTo(() => { setView('notebook'); setSelectedAgent(null) })} collapsed={!sidebarOpen}/>
          <NavItem icon={<Bell size={16}/>} label={t('nav.followup')} active={view==='followup'} onClick={() => navigateTo(() => { setView('followup'); setSelectedAgent(null) })} collapsed={!sidebarOpen}/>
        </NavGroup>
        )}

        {canFullDashboard && (<>
        <NavItem icon={<MessageCircle size={16}/>} label={t('nav.whatsapp')} active={view==='whatsapp'} onClick={() => navigateTo(() => { setView('whatsapp'); setSelectedAgent(null) })} collapsed={!sidebarOpen}/>
        <NavItem icon={<ShoppingBag size={16}/>} label={t('nav.catalog')} active={view==='catalog'} onClick={() => navigateTo(() => { setView('catalog'); setSelectedAgent(null) })} collapsed={!sidebarOpen}/>
        <NavItem icon={<BarChart2 size={16}/>} label={t('nav.reports')} active={view==='reports'} onClick={() => navigateTo(goToReports)} collapsed={!sidebarOpen}/>
        <NavItem icon={<Plus size={16}/>} label={t('nav.buildAgent')} active={view==='build-agent'} onClick={() => navigateTo(() => { setView('build-agent'); setSelectedAgent(null) })} collapsed={!sidebarOpen}/>
        <NavItem icon={<BookOpen size={16}/>} label={t('nav.library')} active={view==='library'} onClick={() => navigateTo(goToLibrary)} collapsed={!sidebarOpen}/>

        <NavGroup label={tr('টিম ও ব্যবসা')} icon={<Building2 size={13}/>} collapsed={!sidebarOpen} defaultOpen={true}>
          <NavItem
            icon={<UserCog size={16}/>}
            label={tr('টিম / Employees')}
            active={false}
            locked={!isAdmin && !hasFeature(subscription?.plan, 'employees')}
            onLockedClick={() => toast.error(lockedMessageBn('employees'))}
            onClick={() => navigateTo(() => router.push('/team'))}
            collapsed={!sidebarOpen}
          />
          <NavItem
            icon={<Building2 size={16}/>}
            label={tr('ব্রাঞ্চসমূহ')}
            active={false}
            locked={!isAdmin && !hasFeature(subscription?.plan, 'branches')}
            onLockedClick={() => toast.error(lockedMessageBn('branches'))}
            onClick={() => navigateTo(() => router.push('/branches'))}
            collapsed={!sidebarOpen}
          />
        </NavGroup>
        </>)}

        {sidebarOpen && lowStockAgents > 0 && (
          <div className="mx-1 mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle size={13}/>
              <span className="text-[12px] font-bold bengali">{lowStockTotal}{t('nav.lowStockBadge')}</span>
            </div>
          </div>
        )}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-gray-100 space-y-1 flex-shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        {canFullDashboard && <NavItem icon={<Settings size={16}/>} label={t('nav.settings')} active={view==='settings'} onClick={() => navigateTo(() => setView('settings'))} collapsed={!sidebarOpen}/>}
        <NavItem icon={<LogOut size={16}/>} label={t('nav.logout')} onClick={handleLogout} collapsed={!sidebarOpen}/>
        <div className={`mt-3 ${sidebarOpen ? 'px-3 py-3 bg-gray-50 rounded-xl' : 'flex justify-center'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm shadow-violet-200">{userInitial}</div>
            {sidebarOpen && <div className="min-w-0">
              <div className="text-[12px] font-bold text-gray-800 truncate bengali">{userName}</div>
              <div className="text-[10px] text-gray-400 truncate">{user.email}</div>
              {!canFullDashboard && (
                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[9.5px] font-bold bengali">{ROLE_LABELS_BN[teamRole]}</span>
              )}
            </div>}
          </div>
        </div>
      </div>
    </aside>
    </>
  )
  // ── OVERVIEW ─────────────────────────────────────────────────
  // ── OVERVIEW ─────────────────────────────────────────────────
  // Today's date, displayed in the header badge — Bengali locale gives
  // Bengali numerals ("২৪ সেপ্টেম্বর ২০২৫"); fall back to a plain ISO
  // slice if the runtime's Intl data doesn't have bn-BD.
  const todayLabel = (() => {
    try { return new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }) }
    catch { return today }
  })()

  const todaySalesDeltaPct = overviewStats && overviewStats.yesterdayTotal > 0
    ? Math.round(((overallToday - overviewStats.yesterdayTotal) / overviewStats.yesterdayTotal) * 100)
    : (overallToday > 0 ? 100 : 0)

  const taskToneStyle: Record<TaskItem['tone'], { bg: string; text: string; icon: React.ReactNode }> = {
    warning: { bg: 'bg-amber-50', text: 'text-amber-700', icon: <AlertTriangle size={14}/> },
    success: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: <CheckCircle2 size={14}/> },
    info:    { bg: 'bg-sky-50', text: 'text-sky-700', icon: <Info size={14}/> },
  }

  // Today's important tasks — third card of the bottom row (rendered inside OverviewInsights)
  const overviewTasksCard = (
    <div className={`bg-white rounded-2xl border border-gray-100 p-4 max-sm:p-2.5 lg:p-3.5 flex flex-col min-h-0 max-sm:max-h-[96px] max-sm:overflow-hidden lg:overflow-hidden`}>
      <h2 className="font-bold text-gray-900 bengali mb-2 max-sm:mb-1 text-sm max-sm:text-xs shrink-0">{t('overview.tasksTitle')}</h2>
      {overviewTasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400 bengali text-center py-8 max-sm:py-1 max-sm:text-[11px] lg:py-2">{t('overview.tasksEmpty')}</div>
      ) : (
        <div className="space-y-1.5 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          {overviewTasks.map(task => {
            const style = taskToneStyle[task.tone]
            return (
              <button key={task.id} onClick={() => task.actionId && handleQuickAction(task.actionId)}
                className={`w-full flex items-start gap-2 p-2 max-sm:py-1 rounded-xl text-left ${style.bg} hover:opacity-80 transition-opacity`}>
                <span className={`flex-shrink-0 mt-0.5 ${style.text}`}>{style.icon}</span>
                <span className={`text-xs font-medium bengali leading-snug ${style.text}`}>{task.text}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── OVERVIEW ─────────────────────────────────────────────────
  // Desktop (lg+): exactly one screen tall (viewport minus the 57px top bar),
  // no page scroll. Left = header → KPI row → flexible insights that stretch
  // to fill the leftover height; right = docked AI panel at the same height.
  // Below lg it's the normal stacked, scrolling layout.
  const overviewAiPanel = user ? (
    <AIAssistantPanel
      agentTarget={chatAgents[0] || null}
      agents={chatAgents}
      role={teamRole}
      canFocus={canFocusChat}
      userId={ownerId}
      onDataChange={() => loadAllStats(ownerId)}
      recentActivity={recentAIActivity}
    />
  ) : null

  // Phones: Stock / Sales / Baki / Customer are one fixed screen — header, totals and
  // filters stay put and only the list scrolls inside itself. AI opens full screen.
  const phoneFit = 'max-sm:h-[calc(100dvh-57px-4rem)] max-sm:overflow-hidden max-sm:flex max-sm:flex-col max-sm:gap-2'
  const phoneInner = 'max-sm:flex-1 max-sm:min-h-0 max-sm:flex max-sm:flex-col'
  const phoneAiBar = (
    <button onClick={() => setAiOpen(true)}
      className="sm:hidden shrink-0 w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-2xl border border-indigo-200 bg-white text-left shadow-sm active:scale-[0.99] transition-transform">
      <span className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center flex-shrink-0"><Bot size={16} className="text-white"/></span>
      <span className="flex-1 text-[13px] text-gray-400 bengali truncate">{tr('AI-কে জিজ্ঞেস করুন…')}</span>
      <Mic size={17} className="text-gray-400 flex-shrink-0"/>
      <span className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0"><Send size={14} className="text-white"/></span>
    </button>
  )
  const phoneAiOverlay = aiOpen ? (
    <div className="sm:hidden fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
        <span className="font-bold text-gray-900 bengali">{tr('AI সহায়ক')}</span>
        <button onClick={() => setAiOpen(false)} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X size={18}/></button>
      </div>
      <div className="flex-1 min-h-0 p-2">{overviewAiPanel}</div>
    </div>
  ) : null

  const overviewView = (
    <div className="p-3 sm:p-6 lg:p-4 max-w-[1600px] mx-auto max-sm:h-[calc(100dvh-57px-4rem)] max-sm:overflow-hidden lg:h-[calc(100vh-57px)] lg:min-h-[600px]">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 lg:gap-4 items-start lg:items-stretch max-sm:h-full lg:h-full">
        <div className="min-w-0 max-sm:flex max-sm:flex-col max-sm:h-full max-sm:min-h-0 lg:flex lg:flex-col lg:min-h-0 lg:h-full">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 max-sm:mb-2 lg:mb-3 shrink-0">
            <div>
              <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900 bengali leading-tight">
                {t('overview.greeting')} <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">{firstName}</span> 👋
              </h1>
              <p className="text-gray-400 text-xs sm:text-sm mt-0.5 bengali"><span className="max-sm:hidden">{t('overview.subtitle')}</span><span className="sm:hidden">📅 {todayLabel}</span></p>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-600 text-sm font-semibold bengali justify-center">
              <CalendarDays size={15} className="text-gray-400"/> {t('overview.today')}, {todayLabel}
            </div>
          </div>

          {/* Phone: AI ask bar — opens the full-screen assistant */}
          <button onClick={() => setAiOpen(true)}
            className="sm:hidden shrink-0 mb-2 w-full flex items-center gap-2.5 px-2.5 py-2 rounded-2xl border border-indigo-200 bg-white text-left shadow-sm active:scale-[0.99] transition-transform">
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center flex-shrink-0"><Bot size={18} className="text-white"/></span>
            <span className="flex-1 text-[13px] text-gray-400 bengali truncate">{tr('আপনার ব্যবসা সম্পর্কে জিজ্ঞেস করুন…')}</span>
            <Mic size={18} className="text-gray-400 flex-shrink-0"/>
            <span className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0"><Send size={15} className="text-white"/></span>
          </button>

          {/* KPI cards */}
          <div className="grid grid-cols-2 max-sm:grid-cols-4 lg:grid-cols-5 gap-3 max-sm:gap-2 mb-4 max-sm:mb-2 lg:mb-3 shrink-0">
            <KpiCard gradient="from-indigo-500 to-violet-600" shadow="shadow-indigo-200" className="col-span-2 max-sm:col-span-1 lg:col-span-1" big subMobile
              icon={<TrendingUp size={15}/>} label={t('overview.kpi.todaySales')}
              value={`₹${overallToday.toLocaleString()}`}
              delta={todaySalesDeltaPct !== 0 ? `${todaySalesDeltaPct > 0 ? '↑' : '↓'}${Math.abs(todaySalesDeltaPct)}%` : undefined}
              sub={overviewStats ? `${t('overview.kpi.yesterday')}: ₹${overviewStats.yesterdayTotal.toLocaleString()}` : undefined}/>
            <KpiCard gradient="from-emerald-500 to-teal-600" shadow="shadow-emerald-200"
              icon={<Package size={15}/>} label={t('overview.kpi.totalStock')}
              value={overviewStats?.totalStockItems ?? 0}
              delta={overviewStats?.newStockThisWeek ? `↑${overviewStats.newStockThisWeek}` : undefined}
              sub={overviewStats?.newStockThisWeek ? `${overviewStats.newStockThisWeek} ${t('overview.kpi.newThisWeek')}` : undefined}/>
            <KpiCard gradient="from-fuchsia-500 to-pink-600" shadow="shadow-fuchsia-200"
              icon={<Users size={15}/>} label={t('overview.kpi.totalCustomers')}
              value={overviewStats?.totalCustomers ?? 0}
              delta={overviewStats?.newCustomersThisWeek ? `↑${overviewStats.newCustomersThisWeek}` : undefined}
              sub={overviewStats?.newCustomersThisWeek ? `${overviewStats.newCustomersThisWeek} ${t('overview.kpi.newThisWeek')}` : undefined}/>
            <KpiCard gradient="from-amber-400 to-orange-500" shadow="shadow-amber-200" onClick={() => handleQuickAction('stock')}
              icon={<AlertTriangle size={15}/>} label={t('overview.kpi.lowStock')} value={lowStockTotal}
              sub={<span className="font-bold text-white inline-flex items-center gap-0.5">{t('overview.viewLink')} <ArrowRight size={10}/></span>}/>
            <KpiCard gradient="from-rose-500 to-red-600" shadow="shadow-rose-200" className="max-sm:hidden" onClick={() => handleQuickAction('expiry')}
              icon={<CalendarClock size={15}/>} label={t('overview.kpi.expiringSoon')} value={overviewStats?.expiringSoon ?? 0}
              sub={<span className="font-bold text-white inline-flex items-center gap-0.5">{t('overview.viewLink')} <ArrowRight size={10}/></span>}/>
          </div>

          {/* Quick actions · trend · category · recent sales · low stock · tasks */}
          {user && (
            <OverviewInsights
              userId={ownerId}
              libraryAgents={LIBRARY_AGENTS.filter(lib => isActivated('library', lib.slug)).map(lib => ({ slug: lib.slug, name: lib.name, icon: lib.icon }))}
              customAgents={agents.map(a => ({ id: a.id, name: a.name_bn || a.name, icon: a.icon }))}
              onStats={setOverviewStats}
              onTasks={setOverviewTasks}
              onRecentActivity={setRecentAIActivity}
              onQuickAction={handleQuickAction}
              tasksCard={overviewTasksCard}
            />
          )}
        </div>{/* close left column */}

        <div className="max-sm:hidden h-[70vh] min-h-[460px] lg:h-full lg:min-h-0">
          {overviewAiPanel}
        </div>
      </div>{/* close grid */}

      {aiOpen && (
        <div className="sm:hidden fixed inset-0 z-50 bg-white flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 shrink-0">
            <span className="font-bold text-gray-900 bengali">{tr('AI সহায়ক')}</span>
            <button onClick={() => setAiOpen(false)} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X size={18}/></button>
          </div>
          <div className="flex-1 min-h-0 p-2">{overviewAiPanel}</div>
        </div>
      )}
    </div>
  )

  // ── MY AGENTS ────────────────────────────────────────────────
  const myAgentsView = (
    <div className={`p-3 sm:p-6 lg:p-5 max-w-5xl 2xl:max-w-7xl mx-auto ${selectedAgent ? '' : 'max-sm:h-[calc(100dvh-57px-4rem)] max-sm:overflow-hidden max-sm:flex max-sm:flex-col lg:h-[calc(100vh-57px)] lg:min-h-[560px] lg:flex lg:flex-col'}`}>
      {selectedAgent ? (
        // Agent detail
        <div>
          <div className="flex items-center gap-3 mb-6 max-sm:mb-3">
            <button onClick={() => setSelectedAgent(null)} className="flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm transition-colors">
              ← {t('common.back')}
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl" style={{ background: selectedAgent.color }}>{selectedAgent.icon}</div>
              <span className="font-bold text-gray-900 bengali">{selectedAgent.name_bn || selectedAgent.name}</span>
              <span className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/> {t('common.online')}
              </span>
            </div>
          </div>
          {/* Left: dashboard · Right: Chat — same layout as library agents.
              If this agent's business_type matches a known vertical, show the
              exact same rich manager UI the Library uses for it; otherwise
              use the flexible GenericBusinessManagerUI (stock/sales/customers/
              dues/reports in one tabbed view, adapts to any business). */}
          {(() => {
            const businessManagerUI = selectedAgent.isLibrary
              ? renderLibraryAgentPanel(selectedAgent.slug, ownerId)
              : renderBusinessManagerUI(selectedAgent, ownerId)
            const chatEl = selectedAgent.isLibrary
              ? <AgentRunner agent={selectedAgent} agentSlugOverride={selectedAgent.slug} userId={ownerId} onDataChange={reloadLibraryPanels}/>
              : <AgentRunner agent={selectedAgent} agentId={selectedAgent.id} isCustomAgent userId={ownerId}/>
            return (
              <AgentWorkspace
                dashboardTitle={t('myAgents.dashboard')}
                chatTitle={t('myAgents.aiAssistant')}
                dashboard={businessManagerUI}
                chat={chatEl}
              />
            )
          })()}
        </div>
      ) : (
        <div className="max-sm:flex-1 max-sm:min-h-0 max-sm:flex max-sm:flex-col lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
          {/* Breadcrumb */}
          <div className="max-sm:hidden flex items-center gap-1.5 text-xs text-gray-400 mb-3 lg:shrink-0 bengali">
            <button onClick={() => { setView('overview'); setSelectedAgent(null) }} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
              <Home size={12}/> {t('nav.overview')}
            </button>
            <ChevronRight size={12}/>
            <span className="text-gray-600 font-semibold">{t('nav.myAgents')}</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 max-sm:gap-3 mb-6 max-sm:mb-3 lg:mb-4 lg:shrink-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 bengali">{t('nav.myAgents')}</h1>
                <p className="text-gray-400 text-sm max-sm:hidden bengali mt-0.5">{t('myAgents.subtitle')}</p>
              </div>
              <div className="sm:hidden flex-shrink-0 flex items-center gap-1.5">
                <button onClick={() => setView('library')}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-600 text-xs font-bold bengali">
                  <BookOpen size={14}/> {tr('লাইব্রেরি')}
                </button>
                <button onClick={() => { setView('build-agent'); setSelectedAgent(null) }}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold bengali shadow-md shadow-indigo-200">
                  <Plus size={14}/> {tr('নতুন')}
                </button>
              </div>
            </div>
            {/* Stat strip */}
            <div className="grid grid-cols-2 max-sm:grid-cols-4 sm:grid-cols-4 gap-2.5 max-sm:gap-1.5">
              <div className="flex items-center max-sm:flex-col max-sm:items-start gap-2 max-sm:gap-1 px-3.5 max-sm:px-2 py-2.5 max-sm:py-2 rounded-xl border border-indigo-100 bg-indigo-50">
                <div className="w-8 h-8 max-sm:w-6 max-sm:h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center"><Bot size={15}/></div>
                <div><div className="font-extrabold text-gray-900 leading-none">{maCounts.all}</div><div className="text-[10px] text-gray-500 bengali mt-0.5">{t('myAgents.totalAgents')}</div></div>
              </div>
              <div className="flex items-center max-sm:flex-col max-sm:items-start gap-2 max-sm:gap-1 px-3.5 max-sm:px-2 py-2.5 max-sm:py-2 rounded-xl border border-emerald-100 bg-emerald-50">
                <div className="w-8 h-8 max-sm:w-6 max-sm:h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center"><Bot size={15}/></div>
                <div><div className="font-extrabold text-gray-900 leading-none">{maCounts.active}</div><div className="text-[10px] text-gray-500 bengali mt-0.5">{t('myAgents.activeAgents')}</div></div>
              </div>
              <div className="flex items-center max-sm:flex-col max-sm:items-start gap-2 max-sm:gap-1 px-3.5 max-sm:px-2 py-2.5 max-sm:py-2 rounded-xl border border-amber-100 bg-amber-50">
                <div className="w-8 h-8 max-sm:w-6 max-sm:h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center"><Bot size={15}/></div>
                <div><div className="font-extrabold text-gray-900 leading-none">{maCounts.inactive}</div><div className="text-[10px] text-gray-500 bengali mt-0.5">{t('myAgents.inactiveAgents')}</div></div>
              </div>
              <div className="flex items-center max-sm:flex-col max-sm:items-start gap-2 max-sm:gap-1 px-3.5 max-sm:px-2 py-2.5 max-sm:py-2 rounded-xl border border-sky-100 bg-white">
                <div className="w-8 h-8 max-sm:w-6 max-sm:h-6 rounded-lg bg-sky-500 text-white flex items-center justify-center"><CreditCard size={14}/></div>
                <div>
                  <div className="font-extrabold text-gray-900 leading-none">{maCounts.all}/{agentLimit === Infinity ? '∞' : agentLimit}</div>
                  <div className="text-[10px] text-gray-500 bengali mt-0.5">{t('myAgents.yourPlan')} · <span className="text-sky-600 font-bold">{PLAN_LABELS[subscription?.plan || 'basic']?.name_bn} Plan</span></div>
                </div>
              </div>
            </div>
          </div>

          {myAgentEntries.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-14 text-center">
              <div className="text-5xl mb-4">🤖</div>
              <h3 className="font-bold text-gray-900 text-lg mb-2 bengali">{t('myAgents.emptyTitle')}</h3>
              <p className="text-gray-400 text-sm bengali mb-6">{t('myAgents.emptySub')}</p>
              <button onClick={() => { setView('build-agent'); setSelectedAgent(null) }} className="inline-flex items-center gap-2 px-7 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors bengali">
                <Plus size={15}/> {t('myAgents.emptyCta')}
              </button>
            </div>
          ) : (
            <>
              {/* Filter tabs */}
              <div className="flex gap-2 mb-3 sm:mb-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:-mx-3 max-sm:px-3 sm:flex-wrap lg:shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {([
                  ['all', t('myAgents.filterAll'), maCounts.all],
                  ['active', t('myAgents.filterActive'), maCounts.active],
                  ['inactive', t('myAgents.filterInactive'), maCounts.inactive],
                  ['library', t('myAgents.filterLibrary'), maCounts.library],
                  ['custom', t('myAgents.filterCustom'), maCounts.custom],
                ] as const).map(([key, label, count]) => (
                  <button key={key} onClick={() => setMaFilter(key)}
                    className={`whitespace-nowrap shrink-0 px-4 max-sm:px-3 py-2 max-sm:py-1.5 rounded-xl text-xs font-bold bengali transition-colors ${maFilter === key ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {label} ({count})
                  </button>
                ))}
              </div>

              {/* Search + sort + view toggle */}
              <div className="flex flex-row gap-2 sm:gap-2.5 mb-3 sm:mb-5 lg:mb-4 lg:shrink-0">
                <div className="flex-1 relative min-w-0">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300"/>
                  <input value={maSearch} onChange={e => setMaSearch(e.target.value)} placeholder={t('myAgents.searchPlaceholder')}
                    className="w-full pl-10 pr-3 sm:pr-4 py-2.5 max-sm:py-2 rounded-xl border border-gray-200 text-sm bengali focus:outline-none focus:border-indigo-300"/>
                </div>
                <select value={maSort} onChange={e => setMaSort(e.target.value as any)}
                  className="px-3.5 max-sm:px-2 py-2.5 max-sm:py-2 max-sm:max-w-[104px] rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 bengali bg-white cursor-pointer focus:outline-none focus:border-indigo-300">
                  <option value="newest">{t('myAgents.sortNewest')}</option>
                  <option value="oldest">{t('myAgents.sortOldest')}</option>
                </select>
                <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden">
                  <button onClick={() => setMaViewMode('grid')} className={`p-2.5 ${maViewMode === 'grid' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400'}`}><LayoutDashboard size={15}/></button>
                  <button onClick={() => setMaViewMode('list')} className={`p-2.5 ${maViewMode === 'list' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-400'}`}><MessageSquare size={15} className="rotate-90"/></button>
                </div>
              </div>

              {maFiltered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-sm text-gray-400 bengali">{t('myAgents.noResults')}</div>
              ) : (
                <div className={(maViewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-sm:gap-2.5 mb-6 max-sm:mb-3' : 'space-y-3 max-sm:space-y-2.5 mb-6 max-sm:mb-3') + ' max-sm:flex-1 max-sm:min-h-0 max-sm:overflow-y-auto max-sm:content-start lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:content-start lg:mb-3 lg:pr-1'}>
                  {maFiltered.map(a => (
                    <div key={a.key} className="bg-white rounded-2xl border border-gray-100 p-4 max-sm:p-3 relative hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3 max-sm:mb-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-11 h-11 max-sm:w-9 max-sm:h-9 rounded-xl flex items-center justify-center text-xl max-sm:text-lg flex-shrink-0" style={{ background: `${a.color}1A` }}>{a.icon}</div>
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 text-sm bengali truncate">{a.name}</div>
                            <div className="text-[11px] text-gray-400 bengali truncate">
                              {a.kind === 'library' ? t('myAgents.libraryTag') : t('myAgents.customTag')} · {a.category}
                            </div>
                          </div>
                        </div>
                        <div className="relative flex-shrink-0 flex items-center gap-1">
                          <span className={`sm:hidden inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bengali ${a.isActive ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 bg-gray-100'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${a.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`}/> {a.isActive ? t('myAgents.filterActive') : t('myAgents.filterInactive')}
                          </span>
                          <button onClick={() => setMaMenuOpenKey(maMenuOpenKey === a.key ? null : a.key)} className="p-1 text-gray-300 hover:text-gray-500">
                            <MoreVertical size={16}/>
                          </button>
                          {maMenuOpenKey === a.key && (
                            <div className="absolute right-0 top-7 z-10 w-40 bg-white rounded-xl border border-gray-100 shadow-lg py-1.5" onMouseLeave={() => setMaMenuOpenKey(null)}>
                              <button onClick={() => { a.onOpen(); setMaMenuOpenKey(null) }} className="w-full text-left px-3.5 py-2 text-xs text-gray-600 hover:bg-gray-50 bengali">{t('myAgents.openWorkspace')}</button>
                              <button onClick={() => { setView('reports'); setMaMenuOpenKey(null) }} className="w-full text-left px-3.5 py-2 text-xs text-gray-600 hover:bg-gray-50 bengali">{t('myAgents.viewReport')}</button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mb-3 max-sm:hidden">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bengali ${a.isActive ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 bg-gray-100'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${a.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`}/> {a.isActive ? t('myAgents.filterActive') : t('myAgents.filterInactive')}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 max-sm:gap-1.5 mb-3 max-sm:mt-2.5 max-sm:mb-2.5">
                        <div className="bg-gray-50 rounded-lg p-2 max-sm:p-1.5">
                          <div className="max-sm:hidden flex items-center gap-1 text-indigo-500"><IndianRupee size={11}/></div>
                          <div className="font-extrabold text-gray-900 text-sm truncate">₹{a.stats.todaySales.toLocaleString()}</div>
                          <div className="text-[9px] text-gray-400 bengali leading-tight">{t('overview.kpi.todaySales')}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2 max-sm:p-1.5">
                          <div className="max-sm:hidden flex items-center gap-1 text-emerald-500"><Package size={11}/></div>
                          <div className="font-extrabold text-gray-900 text-sm truncate">{a.stats.secondaryVal}</div>
                          <div className="text-[9px] text-gray-400 bengali leading-tight">{a.stats.secondaryLabel}</div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2 max-sm:p-1.5">
                          <div className="max-sm:hidden flex items-center gap-1 text-fuchsia-500"><Users size={11}/></div>
                          <div className="font-extrabold text-gray-900 text-sm truncate">{a.stats.totalCustomers}</div>
                          <div className="text-[9px] text-gray-400 bengali leading-tight">{t('overview.kpi.totalCustomers')}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={a.onOpen} className="flex-[1.3] whitespace-nowrap flex items-center justify-center gap-1 px-3 max-sm:px-2 lg:px-2 py-2 max-sm:py-1.5 rounded-xl text-white text-xs lg:text-[11px] font-bold bengali transition-opacity hover:opacity-90" style={{ background: a.color }}>
                          {t('myAgents.openWorkspace')} <ArrowRight size={12}/>
                        </button>
                        <button onClick={a.onOpen} className="flex-1 whitespace-nowrap px-3 max-sm:px-2 lg:px-2 py-2 max-sm:py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs lg:text-[11px] font-bold bengali hover:bg-gray-200 transition-colors">
                          {t('myAgents.chatWithAI')}
                        </button>
                        <button onClick={() => setView('reports')} className="p-2 max-sm:p-1.5 rounded-xl bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                          <BarChart2 size={15}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Bottom CTAs */}
          <div className="max-sm:hidden grid grid-cols-2 gap-4 lg:gap-3 lg:shrink-0">
            <div onClick={() => { setView('build-agent'); setSelectedAgent(null) }} className="bg-white rounded-2xl border border-gray-100 p-5 lg:p-3 max-sm:p-2.5 flex items-center gap-4 max-sm:gap-2 max-sm:cursor-pointer">
              <button onClick={() => { setView('build-agent'); setSelectedAgent(null) }}
                className="w-11 h-11 max-sm:w-9 max-sm:h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center flex-shrink-0 transition-colors">
                <Plus size={20}/>
              </button>
              <div className="min-w-0">
                <div className="font-bold text-gray-900 text-sm max-sm:text-xs bengali">{t('myAgents.createNew')}</div>
                <div className="text-xs max-sm:text-[10px] max-sm:leading-tight text-gray-400 bengali mt-0.5">{t('myAgents.createNewSub')}</div>
              </div>
              <button onClick={() => { setView('build-agent'); setSelectedAgent(null) }}
                className="max-sm:hidden ml-auto flex-shrink-0 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold bengali transition-colors">
                + Build Agent
              </button>
            </div>
            <div onClick={() => setView('library')} className="bg-white rounded-2xl border border-gray-100 p-5 lg:p-3 max-sm:p-2.5 flex items-center gap-4 max-sm:gap-2 max-sm:cursor-pointer">
              <div className="w-11 h-11 max-sm:w-9 max-sm:h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 text-xl">📚</div>
              <div className="min-w-0">
                <div className="font-bold text-gray-900 text-sm max-sm:text-xs bengali">{t('myAgents.getFromLibrary')}</div>
                <div className="text-xs max-sm:text-[10px] max-sm:leading-tight text-gray-400 bengali mt-0.5">{t('myAgents.getFromLibrarySub')}</div>
              </div>
              <button onClick={() => setView('library')}
                className="max-sm:hidden ml-auto flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-bold bengali hover:border-gray-300 transition-colors">
                {t('myAgents.viewLibrary')} <ArrowRight size={12}/>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ── LIBRARY VIEW ─────────────────────────────────────────────
  const libraryView = (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-gray-900 bengali">{t('library.title')}</h1>
        <p className="text-gray-400 text-sm bengali mt-0.5">{t('library.subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {LIBRARY_AGENTS.map(lib => {
          const activated = isActivated('library', lib.slug)
          return (
            <AgentStatsCard key={lib.slug} agent={{ ...lib, name_bn: lib.name, color: lib.light }}
              stats={libStats[lib.slug]} locked={!activated}
              lockedLabel={activeLibCount >= agentLimit ? 'আপগ্রেড করুন' : 'নির্বাচন করুন'}
              onClick={() => openLibAgent(lib)}/>
          )
        })}
      </div>
      <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex items-center gap-4">
        <div className="text-2xl">💡</div>
        <div>
          <div className="font-bold text-indigo-800 bengali text-sm mb-1">{t('library.tipTitle')}</div>
          <div className="text-indigo-600 text-xs bengali">{t('library.tipSub')}</div>
        </div>
      </div>
    </div>
  )

  // ── BUILD AGENT VIEW ─────────────────────────────────────────
  const buildAgentView = (
    <BuildAgentWizard/>
  )

  // ── REPORTS VIEW ─────────────────────────────────────────────
  // Cross-agent Reports page (see components/ReportsHub.tsx): every agent's
  // sales / purchases / dues combined, with an AI panel docked on the right.
  // NB: primaryAgentTarget is declared further down, so the same target is
  // built inline here (reading it now would hit the const before init).
  const reportsAgentInfo: Record<string, { name: string; icon: string; color: string }> = {}
  for (const [id, info] of Object.entries(libDisplay)) reportsAgentInfo[id] = { name: info.name, icon: info.icon, color: info.color }
  for (const a of agents) reportsAgentInfo[a.id] = { name: a.name_bn || a.name, icon: a.icon, color: a.color || '#6366F1' }
  const reportsView = (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      {agents.length === 0 && usedLibs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center max-w-xl mx-auto">
          <BarChart2 size={40} className="text-gray-200 mx-auto mb-4"/>
          <p className="text-gray-400 bengali">{t('reports.empty')}</p>
          <button onClick={() => setView('library')} className="mt-4 text-indigo-600 text-sm font-bold bengali">{t('reports.goLibrary')}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
          <ReportsHub userId={ownerId} agentInfo={reportsAgentInfo}/>
          <div className="xl:sticky xl:top-20 h-[75vh] xl:h-[calc(100vh-5rem)] min-h-[560px] w-full">
            <AIAssistantPanel
              agentTarget={
                usedLibs.length
                  ? { isLibrary: true, slug: usedLibs[0].slug, name: usedLibs[0].name, icon: usedLibs[0].icon, color: usedLibs[0].light }
                  : agents.length
                    ? { isLibrary: false, id: agents[0].id, name: agents[0].name_bn || agents[0].name, icon: agents[0].icon, color: agents[0].color }
                    : null
              }
              userId={ownerId}
              badge="Reports Assistant"
              suggestions={['এই মাসের রিপোর্ট দাও', 'লাভ কত?', 'কোন Agent বেশি বিক্রি করেছে?', 'কাস্টমার বাকি তালিকা দেখাও', 'কম স্টকের পণ্য দেখাও', 'বিক্রি বনাম ক্রয় দেখাও']}
              onDataChange={() => { loadAllStats(ownerId) }}
            />
          </div>
        </div>
      )}
    </div>
  )

  // ── CRM VIEW ────────────────────────────────────────────────
  // Shows BOTH custom ("Build Agent") agents and the library agents this
  // user actually uses, in one picker — previously this only listed
  // custom agents, so e.g. Dokan Manager's own customers never appeared
  // here even though the user was actively using it.
  //
  // Only dokan-manager is wired onto the canonical crm_customers table
  // under a stable agent_id (see libraryAgentIds.ts) — the other 4
  // verticals (hotel/mishti/kapor/pharmacy) still keep their customer
  // data in their own bespoke UI, not this shared one. Rather than
  // showing an empty or wrong CRMDashboard for those, clicking them
  // deep-links to that library agent's own working কাস্টমার tab.
  const CANONICAL_LIB_SLUGS: Record<string, keyof typeof LIBRARY_AGENT_IDS> = { 'dokan-manager': 'dokan' }
  const crmPickerItems = [
    ...agents.map(a => ({ kind: 'custom' as const, key: a.id, icon: a.icon, label: a.name_bn || a.name, agent: a })),
    ...usedLibs.map(lib => ({ kind: 'library' as const, key: lib.slug, icon: lib.icon, label: lib.name, lib })),
  ]
  // The AI Assistant panel needs to know which agent's data it's chatting
  // against — mirrors whichever picker button is currently selected, so
  // asking it to "add a customer" while viewing Dokan Manager's CRM writes
  // into Dokan Manager's data, not some unrelated default agent.
  const crmLibMeta = selectedCrmLibSlug ? LIBRARY_AGENTS.find(l => l.slug === selectedCrmLibSlug) : null
  const crmAgentTarget = selectedAgent
    ? { isLibrary: false as const, id: selectedAgent.id, name: selectedAgent.name_bn || selectedAgent.name, icon: selectedAgent.icon, color: selectedAgent.color }
    : selectedCrmLibSlug
      ? { isLibrary: true as const, slug: selectedCrmLibSlug, name: crmLibMeta?.name || LIBRARY_AGENT_NAMES_BN[CANONICAL_LIB_SLUGS[selectedCrmLibSlug]], icon: crmLibMeta?.icon || '🤖' }
      : null

  const primaryAgentTarget = usedLibs.length
    ? { isLibrary: true, slug: usedLibs[0].slug, name: usedLibs[0].name, icon: usedLibs[0].icon, color: usedLibs[0].light }
    : agents.length
      ? { isLibrary: false, id: agents[0].id, name: agents[0].name_bn || agents[0].name, icon: agents[0].icon, color: agents[0].color }
      : null

  const crmView = (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-extrabold text-gray-900 bengali">{t('crm.title')}</h1>
        <p className="text-gray-400 text-sm bengali mt-0.5">{t('crm.subtitle')}</p>
      </div>
      {crmPickerItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <Users size={40} className="text-gray-200 mx-auto mb-4"/>
          <p className="text-gray-400 bengali">{t('crm.empty')}</p>
        </div>
      ) : (
        <div>
          {/* Agent tiles — "সব Agent" first (the default, combined view via
              CustomerBillingTable below), then one card per agent the user
              actually uses. Card grid instead of the old flex-wrap pills so
              this reads as a proper picker, not a row of chips. The count
              under each tile is the same real per-agent number shown
              elsewhere (agentStats/libStats); the "সব Agent" tile sums
              those as a quick preview — the exact total (which also counts
              customers with no agent tagged) is what actually renders
              inside the combined table once you're on this default view. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            {(() => {
              const isAllSelected = !selectedAgent && !selectedCrmLibSlug
              const allTotal = crmPickerItems.reduce((sum, item) => sum + (Number(
                item.kind === 'custom' ? agentStats[item.key]?.totalCustomers : libStats[item.key]?.totalCustomers
              ) || 0), 0)
              return (
                <button onClick={() => { setSelectedAgent(null); setSelectedCrmLibSlug(null) }}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${isAllSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'}`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${isAllSelected ? 'bg-white/20' : 'bg-indigo-50'}`}>
                    <Users size={19} className={isAllSelected ? 'text-white' : 'text-indigo-600'}/>
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm bengali truncate">{tr('সব Agent')}</div>
                    <div className={`text-[11px] font-medium bengali ${isAllSelected ? 'text-indigo-100' : 'text-gray-400'}`}>{allTotal} {tr('কাস্টমার')}</div>
                  </div>
                </button>
              )
            })()}
            {crmPickerItems.map(item => {
              const isSelected = item.kind === 'custom'
                ? selectedAgent?.id === item.key
                : selectedCrmLibSlug === item.key
              const customerCount = item.kind === 'custom'
                ? agentStats[item.key]?.totalCustomers
                : libStats[item.key]?.totalCustomers
              return (
                <button key={`${item.kind}-${item.key}`} onClick={() => {
                  if (item.kind === 'custom') { setSelectedAgent(item.agent); setSelectedCrmLibSlug(null) }
                  else {
                    setSelectedAgent(null)
                    const canonical = CANONICAL_LIB_SLUGS[item.lib.slug]
                    if (canonical) setSelectedCrmLibSlug(item.key)
                    else router.push(`/library/${item.lib.slug}?tab=customers`)
                  }
                }}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300'}`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${isSelected ? 'bg-white/20' : 'bg-gray-50'}`}>
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm bengali truncate flex items-center gap-1">
                      {item.label}
                      {item.kind === 'library' && !CANONICAL_LIB_SLUGS[item.lib.slug] && <ExternalLink size={11} className="opacity-60 flex-shrink-0"/>}
                    </div>
                    {typeof customerCount === 'number' && (
                      <div className={`text-[11px] font-medium bengali ${isSelected ? 'text-indigo-100' : 'text-gray-400'}`}>{customerCount} {tr('কাস্টমার')}</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {selectedAgent || selectedCrmLibSlug ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
              <div className="min-w-0 space-y-4">
                {selectedAgent ? (
                  <CRMDashboard userId={ownerId} agentId={selectedAgent.id}
                    businessType={selectedAgent.business_type || 'general'}
                    agentName={selectedAgent.name_bn||selectedAgent.name}
                    refreshSignal={crmRefreshNonce}/>
                ) : (
                  <CRMDashboard userId={ownerId} agentId={LIBRARY_AGENT_IDS[CANONICAL_LIB_SLUGS[selectedCrmLibSlug!]]}
                    businessType={CANONICAL_LIB_SLUGS[selectedCrmLibSlug!]}
                    agentName={LIBRARY_AGENT_NAMES_BN[CANONICAL_LIB_SLUGS[selectedCrmLibSlug!]]}
                    refreshSignal={crmRefreshNonce}/>
                )}
              </div>
              <div className="lg:sticky lg:top-20 h-[75vh] lg:h-[calc(100vh-5rem)] min-h-[560px] w-full">
                <AIAssistantPanel
                  agentTarget={crmAgentTarget}
                  userId={ownerId}
                  onDataChange={() => { loadAllStats(ownerId); setCrmRefreshNonce(n => n + 1) }}
                  recentActivity={recentAIActivity}
                />
              </div>
            </div>
          ) : (
            // "সব Agent" — the combined cross-agent view: every customer
            // across every agent, one table, real invoicing/WhatsApp/Excel
            // (same component already used by the কাস্টমার page).
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-6 items-start w-full min-w-0">
              <div className="w-full min-w-0"><CustomerBillingTable userId={ownerId}/></div>
              <div className="xl:sticky xl:top-20 h-[75vh] xl:h-[calc(100vh-5rem)] min-h-[520px] w-full min-w-0">
                <AIAssistantPanel
                  agentTarget={primaryAgentTarget} agents={chatAgents} role={teamRole} canFocus={canFocusChat}
                  userId={ownerId}
                  onDataChange={() => { loadAllStats(ownerId); setCrmRefreshNonce(n => n + 1) }}
                  recentActivity={recentAIActivity}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )

  // ── STOCK / SALES / SUPPLY / FOLLOW-UP (cross-agent) ──────────
  const stockView = (
    <div className={`p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-6 items-start max-w-[1600px] mx-auto lg:p-4 lg:gap-4 lg:items-stretch lg:h-[calc(100vh-57px)] lg:min-h-[600px] lg:overflow-hidden ${phoneFit}`}>
      {phoneAiBar}
      <div className={`min-w-0 ${phoneInner} lg:flex lg:flex-col lg:min-h-0`}><StockOverview userId={ownerId} agentNameById={agentNameById} agentColorById={agentColorById}/></div>
      <div className="max-sm:hidden h-[75vh] min-h-[560px] lg:h-full lg:min-h-0 w-full">
        <AIAssistantPanel
          agentTarget={primaryAgentTarget} agents={chatAgents} role={teamRole} canFocus={canFocusChat}
          userId={ownerId}
          onDataChange={() => loadAllStats(ownerId)}
          recentActivity={recentAIActivity}
        />
      </div>
      {phoneAiOverlay}
    </div>
  )

  const salesView = (
    <div className={`p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 sm:gap-6 items-start ${phoneFit}`}>
      {phoneAiBar}
      <div className={`max-w-4xl w-full min-w-0 ${phoneInner}`}><SalesOverview userId={ownerId} agentNameById={agentNameById}/></div>
      <div className="max-sm:hidden lg:sticky lg:top-20 h-[75vh] lg:h-[calc(100vh-5rem)] min-h-[560px] w-full">
        <AIAssistantPanel
          agentTarget={primaryAgentTarget} agents={chatAgents} role={teamRole} canFocus={canFocusChat}
          userId={ownerId}
          onDataChange={() => loadAllStats(ownerId)}
          recentActivity={recentAIActivity}
        />
      </div>
      {phoneAiOverlay}
    </div>
  )
  const duesView = (
    <div className={`p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 sm:gap-6 items-start ${phoneFit}`}>
      {phoneAiBar}
      <div className={`max-w-4xl w-full min-w-0 ${phoneInner}`}><DuesOverview userId={ownerId}/></div>
      <div className="max-sm:hidden lg:sticky lg:top-20 h-[75vh] lg:h-[calc(100vh-5rem)] min-h-[560px] w-full">
        <AIAssistantPanel
          agentTarget={primaryAgentTarget} agents={chatAgents} role={teamRole} canFocus={canFocusChat}
          userId={ownerId}
          onDataChange={() => loadAllStats(ownerId)}
          recentActivity={recentAIActivity}
        />
      </div>
      {phoneAiOverlay}
    </div>
  )
  const invoiceView = (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto min-w-0"><InvoiceBuilder userId={ownerId}/></div>
  )
  const invoiceHistoryView = (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto min-w-0"><InvoiceHistory userId={ownerId}/></div>
  )
  const customerView = (
    <div className={`p-3 sm:p-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-6 items-start w-full min-w-0 ${phoneFit}`}>
      {phoneAiBar}
      <div className={`w-full min-w-0 ${phoneInner}`}><CustomerBillingTable userId={ownerId}/></div>
      <div className="max-sm:hidden xl:sticky xl:top-20 h-[75vh] xl:h-[calc(100vh-5rem)] min-h-[520px] w-full min-w-0">
        <AIAssistantPanel
          agentTarget={primaryAgentTarget} agents={chatAgents} role={teamRole} canFocus={canFocusChat}
          userId={ownerId}
          onDataChange={() => loadAllStats(ownerId)}
          recentActivity={recentAIActivity}
        />
      </div>
      {phoneAiOverlay}
    </div>
  )
  const supplyView = (
    <div className="p-3 sm:p-6 w-full min-w-0"><SupplyDashboard userId={ownerId} refreshSignal={crmRefreshNonce}/></div>
  )
  const followupView = (
    <div className="p-3 sm:p-6 w-full min-w-0"><FollowUpDashboard userId={ownerId}/></div>
  )
  const whatsappView = (
    <div className="p-4 sm:p-6"><WhatsAppDashboard userId={ownerId}/></div>
  )
  const catalogView = (
    <div className="p-3 sm:p-6 min-w-0"><ProductCatalogUI userId={ownerId}/></div>
  )

  // ── AI NOTEBOOK VIEW ─────────────────────────────────────────
  const notesByDate = notes.reduce((acc: Record<string, AgentNote[]>, n) => {
    const d = n.created_at.slice(0, 10)
    ;(acc[d] ||= []).push(n)
    return acc
  }, {})
  const noteDates = Object.keys(notesByDate).sort((a, b) => b.localeCompare(a))
  const activeNoteAgent = noteAgentOptions.find(o => o.key === noteAgentKey)

  const notebookView = (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-extrabold bengali bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
          {t('nav.notebook')}
        </h1>
        <p className="text-gray-400 text-sm mt-1 bengali">{tr('যেকোনো Agent নিয়ে ভয়েস বা লিখে নোট রাখুন — তারিখ ও সময় অনুযায়ী সাজানো থাকবে')}</p>
      </div>

      {/* Composer */}
      <div className="rounded-2xl p-[1px] bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg shadow-indigo-100 mb-8">
        <div className="rounded-2xl bg-white p-4 sm:p-5">
          {noteAgentOptions.length === 0 ? (
            <p className="text-sm text-gray-400 bengali">{tr('আগে একটা Agent Activate করুন, তারপর এখানে নোট রাখতে পারবেন।')}</p>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-[11px] font-bold text-gray-400 bengali">Agent:</span>
                <select value={noteAgentKey} onChange={e => setNoteAgentKey(e.target.value)}
                  className="text-[13px] font-semibold bengali border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-200">
                  {noteAgentOptions.map(o => (
                    <option key={o.key} value={o.key}>{o.icon} {o.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-start gap-2">
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2}
                  placeholder={tr('নোট লিখুন... (যেমন: আজ রহিম দা ১০০০ টাকা বাকি রাখলেন)')}
                  className="flex-1 resize-none px-3.5 py-3 rounded-xl border border-gray-200 text-[13px] bengali focus:outline-none focus:ring-2 focus:ring-indigo-200"/>
                <button onClick={toggleNoteVoice} title={tr('ভয়েস নোট')}
                  className={`w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center transition-all shadow-md ${
                    noteListening ? 'bg-red-500 animate-pulse shadow-red-200' : 'bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-indigo-200'
                  }`}>
                  {noteListening ? <MicOff size={17} className="text-white"/> : <Mic size={17} className="text-white"/>}
                </button>
                <button onClick={() => addNote(noteText, 'text')} disabled={noteSaving || !noteText.trim()}
                  title={tr('নোট যোগ করুন')}
                  className="w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br from-fuchsia-600 to-pink-600 hover:from-fuchsia-700 hover:to-pink-700 shadow-md shadow-fuchsia-200 disabled:opacity-40 transition-all">
                  <Send size={16} className="text-white"/>
                </button>
              </div>
              {noteListening && <p className="text-[11px] text-red-500 font-bold mt-2 bengali animate-pulse">{tr('🔴 বলুন... আবার ট্যাপ করলে থেমে যাবে')}</p>}
            </>
          )}
        </div>
      </div>

      {/* Notes list, grouped by date */}
      {notesLoading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/></div>
      ) : noteDates.length === 0 ? (
        <div className="text-center py-14">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-gray-400 text-sm bengali">{tr('এখনও কোনো নোট নেই। উপরে লিখে বা ভয়েস দিয়ে প্রথম নোটটা যোগ করুন।')}</p>
        </div>
      ) : (
        <div className="space-y-7">
          {noteDates.map(date => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-gradient-to-r from-indigo-50 to-fuchsia-50 text-indigo-700 border border-indigo-100 bengali">
                  {new Date(date).toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <div className="h-px flex-1 bg-gray-100"/>
              </div>
              <div className="space-y-2.5">
                {notesByDate[date].map(n => (
                  <div key={n.id} className="group flex items-start gap-3 bg-white rounded-2xl border border-gray-100 p-3.5 hover:shadow-md hover:border-indigo-100 transition-all">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-gradient-to-br from-indigo-50 to-fuchsia-50">
                      {n.agent_icon || '🤖'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[11px] font-bold text-gray-500 bengali">{n.agent_name}</span>
                        <span className="text-[10px] text-gray-300">•</span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock size={9}/> {new Date(n.created_at).toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {n.source === 'voice' && (
                          <span className="text-[9px] font-bold text-fuchsia-600 bg-fuchsia-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Mic size={8}/> {tr('ভয়েস')}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-gray-800 bengali whitespace-pre-wrap break-words">{n.content}</p>
                    </div>
                    <button onClick={() => deleteNote(n.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 flex-shrink-0">
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── SETTINGS VIEW ────────────────────────────────────────────
  // ── Business logo / signature (used on printed invoices) ──────
  const uploadBrandImage = async (file: File, kind: 'logo' | 'signature') => {
    const setUploading = kind === 'logo' ? setUploadingLogo : setUploadingSignature
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${ownerId}/${kind}-${uuidv4()}.${ext}`
      const { error: upErr } = await supabase.storage.from('catalog-images').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('catalog-images').getPublicUrl(path)
      const field = kind === 'logo' ? 'logo_url' : 'signature_url'
      const { error: dbErr } = await supabase.from('profiles').update({ [field]: pub.publicUrl }).eq('id', ownerId)
      if (dbErr) throw dbErr
      setShopProfile(p => ({ ...p, [field]: pub.publicUrl }))
      toast.success(kind === 'logo' ? 'লোগো আপডেট হয়েছে!' : 'স্বাক্ষর আপডেট হয়েছে!')
    } catch (e: any) {
      toast.error(e.message || 'ছবি আপলোড করা যায়নি')
    } finally {
      setUploading(false)
    }
  }

  const removeBrandImage = async (kind: 'logo' | 'signature') => {
    const field = kind === 'logo' ? 'logo_url' : 'signature_url'
    const { error } = await supabase.from('profiles').update({ [field]: null }).eq('id', ownerId)
    if (error) { toast.error('মুছে ফেলা যায়নি'); return }
    setShopProfile(p => ({ ...p, [field]: null }))
    toast.success(kind === 'logo' ? 'লোগো মুছে ফেলা হয়েছে' : 'স্বাক্ষর মুছে ফেলা হয়েছে')
  }

  const settingsView = (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-extrabold text-gray-900 mb-6 bengali">{t('settings.title')}</h1>
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-4 bengali">{t('settings.profile')}</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-extrabold text-xl">{userInitial}</div>
            <div>
              <div className="font-bold text-gray-900 bengali">{userName}</div>
              <div className="text-gray-400 text-sm">{user.email}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-1 bengali">{t('settings.shopBilling')}</h2>
          <p className="text-gray-400 text-[12px] bengali mb-4">{t('settings.shopBillingSub')}</p>

          {/* Business logo + signature — shown on every printed invoice */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 bengali block mb-1.5">{tr('ব্যবসার লোগো')}</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {shopProfile.logo_url
                    ? <img src={shopProfile.logo_url} alt={tr('লোগো')} className="w-full h-full object-cover" />
                    : <span className="text-2xl">🏪</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[12px] font-bold bengali cursor-pointer text-center">
                    {uploadingLogo ? tr('আপলোড হচ্ছে...') : shopProfile.logo_url ? tr('পরিবর্তন করুন') : tr('আপলোড করুন')}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadBrandImage(f, 'logo'); e.target.value = '' }} />
                  </label>
                  {shopProfile.logo_url && (
                    <button onClick={() => removeBrandImage('logo')} className="text-[11px] text-red-500 font-semibold bengali">{tr('মুছে ফেলুন')}</button>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 bengali block mb-1.5">{tr('স্বাক্ষর (ঐচ্ছিক)')}</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {shopProfile.signature_url
                    ? <img src={shopProfile.signature_url} alt={tr('স্বাক্ষর')} className="w-full h-full object-contain" />
                    : <span className="text-xl text-gray-300">✍️</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[12px] font-bold bengali cursor-pointer text-center">
                    {uploadingSignature ? tr('আপলোড হচ্ছে...') : shopProfile.signature_url ? tr('পরিবর্তন করুন') : tr('আপলোড করুন')}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingSignature}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadBrandImage(f, 'signature'); e.target.value = '' }} />
                  </label>
                  {shopProfile.signature_url && (
                    <button onClick={() => removeBrandImage('signature')} className="text-[11px] text-red-500 font-semibold bengali">{tr('মুছে ফেলুন')}</button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder={t('settings.shopName')} value={shopProfile.shop_name}
              onChange={e => setShopProfile(p => ({ ...p, shop_name: e.target.value }))}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-[13px] bengali"/>
            <input placeholder={t('settings.ownerName')} value={shopProfile.owner_name}
              onChange={e => setShopProfile(p => ({ ...p, owner_name: e.target.value }))}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-[13px] bengali"/>
            <input placeholder={t('settings.phone')} value={shopProfile.phone}
              onChange={e => setShopProfile(p => ({ ...p, phone: e.target.value }))}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-[13px]"/>
            <input placeholder={t('settings.gstin')} value={shopProfile.gstin}
              onChange={e => setShopProfile(p => ({ ...p, gstin: e.target.value }))}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-[13px]"/>
            <input placeholder={t('settings.upi')} value={shopProfile.upi_id}
              onChange={e => setShopProfile(p => ({ ...p, upi_id: e.target.value }))}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-[13px]"/>
            <input placeholder={t('settings.address')} value={shopProfile.address}
              onChange={e => setShopProfile(p => ({ ...p, address: e.target.value }))}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-[13px] bengali"/>
          </div>
          <textarea placeholder={t('settings.receiptFooter')} value={shopProfile.print_footer}
            onChange={e => setShopProfile(p => ({ ...p, print_footer: e.target.value }))} rows={2}
            className="w-full mt-3 px-3 py-2.5 rounded-lg border border-gray-200 text-[13px] bengali"/>
          <button onClick={async () => {
            setSavingShopProfile(true)
            const { error } = await supabase.from('profiles').update(shopProfile).eq('id', ownerId)
            if (error) { toast.error('সেভ করতে সমস্যা হয়েছে'); console.error('profile update:', error) }
            else toast.success('সেভ হয়েছে!')
            setSavingShopProfile(false)
          }} disabled={savingShopProfile}
            className="mt-4 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[13px] bengali disabled:opacity-50">
            {savingShopProfile ? t('common.saving') : t('common.save')}
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-4 bengali">{t('settings.appLang')}</h2>
          <p className="text-gray-400 text-[12px] bengali mb-3">{tr('গোটা সিস্টেম এই ভাষায় দেখাবে (মেনু, ড্যাশবোর্ড ইত্যাদি)')}</p>
          {showLangToggle
            ? <LanguageToggle align="left"/>
            : <p className="text-[12px] text-gray-400 bengali">{tr('ভাষা পরিবর্তনের সুবিধা Starter ও Enterprise প্ল্যানে পাওয়া যায়।')}</p>}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-4 bengali">{t('settings.voiceLang')}</h2>
          <div className="flex gap-3">
            {[{val:'bn-IN',label:'বাংলা'},{val:'en-IN',label:'English'}].map(l => (
              <button key={l.val} onClick={() => setMicLang(l.val as any)}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm border transition-all ${micLang===l.val ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-4 bengali">{t('settings.account')}</h2>
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-2.5 border border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 transition-colors text-sm bengali">
            <LogOut size={14}/> {t('nav.logout')}
          </button>
        </div>
      </div>
    </div>
  )

  const VIEWS: Record<View, React.ReactNode> = {
    overview: overviewView,
    'my-agents': myAgentsView,
    library: libraryView,
    'build-agent': buildAgentView,
    stock: stockView,
    sales: salesView,
    dues: duesView,
    notebook: notebookView,
    invoice: invoiceView,
    'invoice-history': invoiceHistoryView,
    customer: customerView,
    supply: supplyView,
    followup: followupView,
    reports: reportsView,
    crm: crmView,
    whatsapp: whatsappView,
    catalog: catalogView,
    settings: settingsView,
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/40 via-white to-white">
      {sidebar}
      <div className={`${mainPad} transition-all duration-300 min-h-screen pb-16 lg:pb-0 min-w-0 overflow-x-hidden`}>
        {debugPlan && (
          <div className="fixed bottom-16 left-2 right-2 sm:right-auto sm:max-w-sm z-[60] rounded-xl bg-gray-900/95 text-green-300 text-[11px] leading-snug p-3 font-mono shadow-xl">
            <div>email: {user?.email}</div>
            <div>is_admin: {String(isAdmin)} · role: {String(teamRole)}</div>
            <div>sub.status: {String(subscription?.status ?? 'null')}</div>
            <div>sub.plan: {String(subscription?.plan ?? 'null')}</div>
            <div>trial_ends: {String(subscription?.trial_ends_at ?? '-').slice(0, 10)} · period_end: {String(subscription?.current_period_end ?? '-').slice(0, 10)}</div>
            <div className="text-amber-300">→ dashboard tier: {tier}</div>
          </div>
        )}
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {showSidebarMenu && (
              <button onClick={() => setSidebarOpen(s => !s)} aria-label="Menu" className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors flex-shrink-0">
              <div className="space-y-1">
                <div className="w-4 h-0.5 bg-gray-500"/>
                <div className="w-3 h-0.5 bg-gray-500"/>
                <div className="w-4 h-0.5 bg-gray-500"/>
              </div>
            </button>
            )}
            {/* Sahayak AI logo + name — same brand as the sidebar. Shown on phones/tablets because the sidebar is hidden there. */}
            <div className="flex items-center gap-2 min-w-0 lg:hidden">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0 shadow-md shadow-violet-200">{tr('স')}</div>
              <span className="font-extrabold text-gray-900 text-[15px] bengali truncate">Sahayak AI</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <span className="text-xs text-gray-400 hidden md:block font-medium">{new Date().toLocaleDateString('bn-BD', { weekday:'long', day:'numeric', month:'long' })}</span>
            {/* Single language control — sets both the UI language AND the
                voice-input language. Hidden for the Basic plan. */}
            {previewing && <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">Preview: {tier}</span>}
            {showLangToggle && <LanguageToggle compact/>}
            {/* Profile: circle avatar, then first name.
                Basic (₹99): tapping it opens a small menu with Home + Logout (no sidebar/menu button).
                Starter / Enterprise / Admin: plain display, full sidebar as before. */}
            {isBasicPlan ? (
              <div ref={profileMenuRef} className="relative pl-2 sm:pl-3 border-l border-gray-100">
                <button onClick={() => setProfileMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={profileMenuOpen}
                  className="flex items-center gap-2 rounded-full active:scale-95 transition-transform">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-violet-200">{userInitial}</div>
                  <span className="hidden sm:block text-[12px] font-bold text-gray-800 bengali truncate max-w-[110px]">{firstName}</span>
                  <ChevronDown size={14} className={`hidden sm:block text-gray-400 transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`}/>
                </button>
                {profileMenuOpen && (
                  <div role="menu" className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl border border-gray-100 shadow-lg shadow-gray-300/40 p-1.5 z-50">
                    <button role="menuitem" onClick={() => { setProfileMenuOpen(false); router.push('/') }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 bengali text-left">
                      <Home size={15}/> {t('nav.home')}
                    </button>
                    <button role="menuitem" onClick={() => { setProfileMenuOpen(false); handleLogout() }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold text-red-600 hover:bg-red-50 bengali text-left">
                      <LogOut size={15}/> {t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-gray-100">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-violet-200">{userInitial}</div>
                <span className="hidden sm:block text-[12px] font-bold text-gray-800 bengali truncate max-w-[110px]">{firstName}</span>
              </div>
            )}
          </div>
        </div>
        {/* Content */}
        {VIEWS[view]}
      </div>

      {/* Mobile bottom tab bar — top 4 sections + More (opens drawer for the rest) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 flex items-stretch lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[
          { id: 'overview' as View, icon: <LayoutDashboard size={18}/>, label: t('mobile.home') },
          { id: 'customer' as View, icon: <Users size={18}/>, label: t('nav.customer') },
          { id: 'stock' as View, icon: <Package size={18}/>, label: t('mobile.stock') },
          { id: 'sales' as View, icon: <TrendingUp size={18}/>, label: t('mobile.sales') },
          { id: 'my-agents' as View, icon: <Bot size={18}/>, label: t('mobile.agents') },
        ].map(t2 => (
          <button key={t2.id} onClick={() => { setView(t2.id); setSelectedAgent(null); setSidebarOpen(false) }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold bengali transition-colors ${view===t2.id ? 'bg-gradient-to-t from-indigo-50 to-transparent text-fuchsia-600' : 'text-gray-400'}`}>
            {t2.icon}{t2.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
