'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Link2, Inbox, Zap, Bell, BookOpen, BarChart2,
} from 'lucide-react'
import type { WhatsAppAccount, WhatsAppStats } from '@/types/whatsapp'
import ConnectPanel from './ConnectPanel'
import InboxPanel from './InboxPanel'
import AutomationPanel from './AutomationPanel'
import FollowUpPanel from './FollowUpPanel'
import KnowledgePanel from './KnowledgePanel'
import StatsPanel from './StatsPanel'

type Tab = 'stats' | 'connect' | 'inbox' | 'automation' | 'followup' | 'knowledge'

const TABS: { key: Tab; label: string; icon: typeof Link2 }[] = [
  { key: 'stats',      label: 'ওভারভিউ',        icon: BarChart2 },
  { key: 'connect',    label: 'কানেক্ট',         icon: Link2 },
  { key: 'inbox',      label: 'ইনবক্স',          icon: Inbox },
  { key: 'automation', label: 'অটোমেশন',        icon: Zap },
  { key: 'followup',   label: 'ফলোআপ',          icon: Bell },
  { key: 'knowledge',  label: 'নলেজ বেস',        icon: BookOpen },
]

export default function WhatsAppDashboard({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>('stats')
  const [account, setAccount] = useState<WhatsAppAccount | null>(null)
  const [accountLoading, setAccountLoading] = useState(true)
  const [stats, setStats] = useState<WhatsAppStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const loadAccount = useCallback(async () => {
    setAccountLoading(true)
    try {
      const res = await fetch('/api/whatsapp/connect')
      const json = await res.json()
      setAccount(json.account ?? null)
    } finally {
      setAccountLoading(false)
    }
  }, [])

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await fetch('/api/whatsapp/stats')
      const json = await res.json()
      setStats(json)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAccount()
    loadStats()
  }, [loadAccount, loadStats])

  const handleAccountChange = () => {
    loadAccount()
    loadStats()
  }

  const isConnected = account?.status === 'connected'

  return (
    <div className="max-w-6xl mx-auto">
      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-5 border-b border-gray-100">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-bold whitespace-nowrap border-b-2 transition-colors bengali ${
              tab === key
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {!accountLoading && !isConnected && tab !== 'connect' && (
        <div className="mb-5 flex items-center justify-between gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <p className="text-[12px] font-bold text-amber-700 bengali">
            হোয়াটসঅ্যাপ নম্বর এখনো কানেক্ট করা হয়নি — মেসেজ পাঠাতে/পেতে আগে কানেক্ট করুন।
          </p>
          <button
            onClick={() => setTab('connect')}
            className="shrink-0 text-[12px] font-bold text-emerald-700 underline bengali"
          >
            কানেক্ট করুন
          </button>
        </div>
      )}

      {tab === 'stats' && <StatsPanel stats={stats} loading={statsLoading} />}
      {tab === 'connect' && <ConnectPanel account={account} onChange={handleAccountChange} />}
      {tab === 'inbox' && <InboxPanel />}
      {tab === 'automation' && <AutomationPanel />}
      {tab === 'followup' && <FollowUpPanel />}
      {tab === 'knowledge' && <KnowledgePanel />}
    </div>
  )
}
