'use client'
// src/components/AgentDataPanel.tsx
// ─────────────────────────────────────────────────────────────────
// Sidebar panel shown next to AgentRunner for custom agents.
// Shows real stored data, lets user add/delete records manually,
// and shows quick stats (today's sales, total baki, etc.)
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import {
  Database, Plus, Trash2, RefreshCw, TrendingUp,
  CreditCard, Package, Receipt, ChevronDown, ChevronUp,
  Settings, CheckCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Record {
  id: string
  record_type: string
  label: string
  amount: number | null
  data: any
  recorded_at: string
  source: string
}

interface Props {
  agentId: string
  agentName: string
  currency?: string
}

const RECORD_TYPES = [
  { type: 'sale',     label: 'বিক্রি',    icon: '🛒', color: 'bg-green-50  text-green-700  border-green-100' },
  { type: 'stock',    label: 'স্টক',      icon: '📦', color: 'bg-blue-50   text-blue-700   border-blue-100'  },
  { type: 'credit',   label: 'বাকি',      icon: '💳', color: 'bg-orange-50 text-orange-700 border-orange-100'},
  { type: 'expense',  label: 'খরচ',       icon: '💸', color: 'bg-red-50    text-red-700    border-red-100'   },
  { type: 'customer', label: 'কাস্টমার',  icon: '👤', color: 'bg-purple-50 text-purple-700 border-purple-100'},
  { type: 'note',     label: 'নোট',       icon: '📝', color: 'bg-gray-50   text-gray-700   border-gray-200'  },
]

function getTypeConfig(type: string) {
  return RECORD_TYPES.find(t => t.type === type) || RECORD_TYPES[5]
}

export default function AgentDataPanel({ agentId, agentName, currency = '₹' }: Props) {
  const [records, setRecords]             = useState<Record[]>([])
  const [loading, setLoading]             = useState(true)
  const [activeTab, setActiveTab]         = useState<string>('all')
  const [showAddForm, setShowAddForm]     = useState(false)
  const [showSettings, setShowSettings]   = useState(false)
  const [saving, setSaving]               = useState(false)
  const [refreshKey, setRefreshKey]       = useState(0)

  // Settings form
  const [bizName, setBizName]     = useState('')
  const [bizCurrency, setBizCurrency] = useState(currency)

  // Add form
  const [newType, setNewType]     = useState('sale')
  const [newLabel, setNewLabel]   = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newData, setNewData]     = useState('')

  // ── Fetch records ───────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const url = activeTab === 'all'
          ? `/api/agent-chat?agentId=${agentId}&limit=60`
          : `/api/agent-chat?agentId=${agentId}&type=${activeTab}&limit=60`
        const res  = await fetch(url)
        const data = await res.json()
        setRecords(data.records || [])
      } catch {
        toast.error('তথ্য লোড হয়নি')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [agentId, activeTab, refreshKey])

  // ── Stats ────────────────────────────────────────────────────
  const today       = new Date().toISOString().slice(0, 10)
  const todaySales  = records.filter(r => r.record_type === 'sale' && r.recorded_at === today)
  const todayRev    = todaySales.reduce((s, r) => s + Number(r.amount || 0), 0)
  const totalDue    = records
    .filter(r => r.record_type === 'credit' && r.data?.status !== 'paid')
    .reduce((s, r) => s + Number(r.amount || 0), 0)
  const lowStock    = records.filter(r =>
    r.record_type === 'stock' &&
    Number(r.data?.qty) <= Number(r.data?.min_qty || 0)
  )

  // ── Add record manually ──────────────────────────────────────
  async function addRecord() {
    if (!newLabel.trim()) { toast.error('label দিন'); return }
    setSaving(true)
    try {
      let extraData: any = {}
      if (newData.trim()) {
        try { extraData = JSON.parse(newData) } catch { extraData = { note: newData } }
      }

      const res = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // We send a special system message to force a save
          messages: [{
            role: 'user',
            content: `[MANUAL_SAVE] type:${newType} label:${newLabel} amount:${newAmount || 0}`,
          }],
          systemPrompt: `You are a data entry assistant. The user is manually adding a record.
Respond in Bengali confirming the save and append exactly:
<!--SAVE:{"type":"${newType}","label":"${newLabel}","amount":${newAmount || 0},"data":${JSON.stringify({ ...extraData, manual: true })}  }-->`,
          agentId,
        }),
      })

      if (res.ok) {
        toast.success('তথ্য যোগ হয়েছে ✅')
        setNewLabel('')
        setNewAmount('')
        setNewData('')
        setShowAddForm(false)
        setRefreshKey(k => k + 1)
      }
    } catch {
      toast.error('যোগ করা যায়নি')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete record ────────────────────────────────────────────
  async function deleteRecord(recordId: string) {
    try {
      const res = await fetch('/api/agent-chat', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ recordId }),
      })
      if (res.ok) {
        setRecords(prev => prev.filter(r => r.id !== recordId))
        toast.success('মুছে গেছে')
      }
    } catch {
      toast.error('মুছতে পারেনি')
    }
  }

  // ── Save settings ────────────────────────────────────────────
  async function saveSettings() {
    setSaving(true)
    try {
      await fetch('/api/agent-settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          agentId,
          settings: { business_name: bizName, currency: bizCurrency },
        }),
      })
      toast.success('সেটিংস সংরক্ষিত ✅')
      setShowSettings(false)
    } catch {
      toast.error('সেভ হয়নি')
    } finally {
      setSaving(false)
    }
  }

  // ── Load settings on mount ───────────────────────────────────
  useEffect(() => {
    fetch(`/api/agent-settings?agentId=${agentId}`)
      .then(r => r.json())
      .then(d => {
        if (d.settings?.business_name) setBizName(d.settings.business_name)
        if (d.settings?.currency)      setBizCurrency(d.settings.currency)
      })
      .catch(() => {})
  }, [agentId])

  return (
    <div className="bg-white rounded-2xl border border-gray-200 flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Database size={15} className="text-indigo-600" />
            <span className="font-bold text-gray-900 text-sm">Real Data</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setRefreshKey(k => k + 1)}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <RefreshCw size={13} />
            </button>
            <button onClick={() => setShowSettings(s => !s)}
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <Settings size={13} />
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 bengali">{bizName || agentName}-এর ডেটা</p>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
          <p className="text-xs font-bold text-indigo-800 mb-2 bengali">⚙️ সেটিংস</p>
          <input
            value={bizName}
            onChange={e => setBizName(e.target.value)}
            placeholder="ব্যবসার নাম (যেমন: রামের মুদি দোকান)"
            className="w-full text-xs border border-indigo-200 rounded-lg px-2.5 py-1.5 mb-2 bg-white bengali focus:outline-none focus:border-indigo-400"
          />
          <div className="flex gap-2 mb-2">
            {['₹', '৳', '$'].map(c => (
              <button key={c} onClick={() => setBizCurrency(c)}
                className={`px-3 py-1 text-xs rounded-lg border font-mono transition-colors ${
                  bizCurrency === c
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
                }`}>
                {c}
              </button>
            ))}
          </div>
          <button onClick={saveSettings} disabled={saving}
            className="w-full py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving ? 'সংরক্ষণ হচ্ছে...' : 'সেভ করুন'}
          </button>
        </div>
      )}

      {/* Stats strip */}
      <div className="px-4 py-3 grid grid-cols-3 gap-2 border-b border-gray-100">
        <div className="text-center">
          <div className="text-base font-bold text-green-600">{bizCurrency}{todayRev.toFixed(0)}</div>
          <div className="text-[10px] text-gray-400 bengali">আজকের বিক্রি</div>
        </div>
        <div className="text-center border-x border-gray-100">
          <div className="text-base font-bold text-orange-500">{bizCurrency}{totalDue.toFixed(0)}</div>
          <div className="text-[10px] text-gray-400 bengali">মোট বাকি</div>
        </div>
        <div className="text-center">
          <div className={`text-base font-bold ${lowStock.length > 0 ? 'text-red-500' : 'text-gray-500'}`}>
            {lowStock.length}
          </div>
          <div className="text-[10px] text-gray-400 bengali">কম স্টক</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-2 flex gap-1 overflow-x-auto border-b border-gray-100">
        <button onClick={() => setActiveTab('all')}
          className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors bengali ${
            activeTab === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
          }`}>
          সব ({records.length})
        </button>
        {RECORD_TYPES.map(t => {
          const count = records.filter(r => r.record_type === t.type).length
          if (count === 0 && activeTab !== t.type) return null
          return (
            <button key={t.type} onClick={() => setActiveTab(t.type)}
              className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors bengali ${
                activeTab === t.type ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}>
              {t.icon} {t.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Records list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading ? (
          <div className="text-center py-8 text-gray-300">
            <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs bengali">লোড হচ্ছে...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-gray-300">
            <Database size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs bengali text-gray-400">এখনো কোনো তথ্য নেই।</p>
            <p className="text-[11px] bengali text-gray-300 mt-1">AI-কে বলুন অথবা নিচে যোগ করুন।</p>
          </div>
        ) : (
          records.map(record => {
            const tc = getTypeConfig(record.record_type)
            return (
              <div key={record.id}
                className={`flex items-start justify-between p-2.5 rounded-xl border text-xs ${tc.color} group`}>
                <div className="flex items-start gap-2 min-w-0">
                  <span className="text-sm flex-shrink-0">{tc.icon}</span>
                  <div className="min-w-0">
                    <div className="font-semibold bengali truncate">{record.label || '—'}</div>
                    <div className="text-[10px] opacity-60 bengali">{record.recorded_at}</div>
                    {record.data?.customer && (
                      <div className="text-[10px] opacity-70 bengali">{record.data.customer}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {record.amount !== null && (
                    <span className="font-bold font-mono">{bizCurrency}{record.amount}</span>
                  )}
                  <button
                    onClick={() => deleteRecord(record.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded-lg transition-all text-red-400 hover:text-red-600">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-700 mb-2 bengali">নতুন এন্ট্রি যোগ করুন</p>
          <select value={newType} onChange={e => setNewType(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2 bg-white focus:outline-none focus:border-indigo-400 bengali">
            {RECORD_TYPES.map(t => (
              <option key={t.type} value={t.type}>{t.icon} {t.label}</option>
            ))}
          </select>
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
            placeholder="বিবরণ (যেমন: চাল ৫ কেজি বিক্রি)"
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2 bg-white focus:outline-none focus:border-indigo-400 bengali"
          />
          <input value={newAmount} onChange={e => setNewAmount(e.target.value)}
            type="number" placeholder={`পরিমাণ (${bizCurrency})`}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2 bg-white focus:outline-none focus:border-indigo-400"
          />
          <div className="flex gap-2">
            <button onClick={addRecord} disabled={saving}
              className="flex-1 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors bengali">
              {saving ? 'যোগ হচ্ছে...' : '✅ যোগ করুন'}
            </button>
            <button onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              বাতিল
            </button>
          </div>
        </div>
      )}

      {/* Add button */}
      <div className="px-4 py-3 border-t border-gray-100">
        <button onClick={() => setShowAddForm(s => !s)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-indigo-700 border-2 border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors bengali">
          <Plus size={13} />
          ম্যানুয়ালি এন্ট্রি যোগ করুন
        </button>
      </div>
    </div>
  )
}
