'use client'

import {
  MessageSquare, Users, Zap, Clock, Bell, BookOpen, AlertTriangle, TrendingUp,
} from 'lucide-react'
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import type { WhatsAppStats } from '@/types/whatsapp'

/** 1400 → "১.৪ সে" ; 45000 → "৪৫ সে" ; 180000 → "৩ মি" */
function humanMs(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  const sec = ms / 1000
  if (sec < 60) return `${sec.toFixed(sec < 10 ? 1 : 0)} সে`
  const min = sec / 60
  if (min < 60) return `${min.toFixed(min < 10 ? 1 : 0)} মি`
  return `${(min / 60).toFixed(1)} ঘ`
}

export default function StatsPanel({ stats, loading }: { stats: WhatsAppStats | null; loading: boolean }) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  const cards = [
    { icon: <MessageSquare size={15} />, label: 'আজকের মেসেজ',    value: String(stats.inbound24h + stats.outbound24h), sub: `${stats.inbound24h} এসেছে · ${stats.outbound24h} গেছে`, color: 'emerald' },
    { icon: <Clock size={15} />,         label: 'গড় উত্তরের সময়', value: humanMs(stats.avgResponseMs),                  sub: `দ্রুততম ${humanMs(stats.fastestResponseMs)}`,           color: 'indigo'  },
    { icon: <Zap size={15} />,           label: 'অটো-উত্তর হার',  value: `${stats.autoReplyRate}%`,                     sub: `${stats.aiReplies7d} AI উত্তর (৭ দিন)`,                 color: 'violet'  },
    { icon: <Users size={15} />,         label: 'মোট কাস্টমার',   value: String(stats.totalContacts),                   sub: `+${stats.newContacts7d} নতুন (৭ দিন)`,                  color: 'sky'     },
    { icon: <Bell size={15} />,          label: 'বাকি ফলোআপ',     value: String(stats.pendingFollowups),                sub: 'পাঠানোর অপেক্ষায়',                                      color: 'amber'   },
    { icon: <BookOpen size={15} />,      label: 'Knowledge Base', value: String(stats.knowledgeEntries),                sub: 'সক্রিয় তথ্য',                                            color: 'teal'    },
    { icon: <TrendingUp size={15} />,    label: 'সক্রিয় অটোমেশন', value: String(stats.activeAutomations),               sub: 'নিয়ম চালু আছে',                                          color: 'rose'    },
    { icon: <AlertTriangle size={15} />, label: 'ব্যর্থ মেসেজ',    value: String(stats.failed7d),                        sub: 'গত ৭ দিনে',                                             color: stats.failed7d > 0 ? 'red' : 'gray' },
  ]

  const TONE: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600', indigo: 'bg-indigo-50 text-indigo-600',
    violet:  'bg-violet-50 text-violet-600',   sky:    'bg-sky-50 text-sky-600',
    amber:   'bg-amber-50 text-amber-600',     teal:   'bg-teal-50 text-teal-600',
    rose:    'bg-rose-50 text-rose-600',       red:    'bg-red-50 text-red-600',
    gray:    'bg-gray-100 text-gray-500',
  }

  const chartData = stats.daily.map(d => ({
    day: new Date(d.date).toLocaleDateString('bn-IN', { weekday: 'short' }),
    এসেছে: d.inbound,
    পাঠানো: d.outbound,
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 ${TONE[c.color]}`}>
              {c.icon}
            </div>
            <div className="text-[20px] font-extrabold text-gray-900 leading-none">{c.value}</div>
            <div className="text-[11px] font-bold text-gray-600 bengali mt-1.5">{c.label}</div>
            <div className="text-[10px] text-gray-400 bengali mt-0.5 truncate">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-[13px] font-extrabold text-gray-900 bengali mb-4">গত ৭ দিনের মেসেজ</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #F3F4F6', fontSize: 12 }}
                  cursor={{ fill: '#F9FAFB' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={7} />
                <Bar dataKey="এসেছে"  fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="পাঠানো" fill="#6366F1" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-[13px] font-extrabold text-gray-900 bengali mb-4">সবচেয়ে বেশি জিজ্ঞাসা</h3>
          {stats.topQuestions.length === 0 ? (
            <p className="text-[12px] text-gray-400 bengali">
              এখনও যথেষ্ট ডেটা নেই। Knowledge Base-এ তথ্য যোগ করলে এখানে দেখাবে কোন প্রশ্নগুলো সবচেয়ে বেশি আসছে।
            </p>
          ) : (
            <div className="space-y-2.5">
              {stats.topQuestions.map((q, i) => (
                <div key={q.title} className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-extrabold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-[12px] text-gray-700 bengali truncate flex-1">{q.title}</span>
                  <span className="text-[11px] font-bold text-emerald-600 flex-shrink-0">{q.hit_count}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
