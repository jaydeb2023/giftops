'use client'

import { useState } from 'react'
import AgentBuilderForm, { FormState } from '@/components/AgentBuilderForm'
import AgentPreviewPanel from '@/components/AgentPreviewPanel'
import { BUSINESS_TEMPLATES, BusinessTemplate } from '@/lib/agentUtils'
import { useAccess } from '@/lib/useAccess'
import { useAgentActivation } from '@/lib/useAgentActivation'
import { Check, Zap, Shield, Globe, Lock } from 'lucide-react'
import Link from 'next/link'

const STEPS = [
  { n: 1, label: 'Template নির্বাচন',    sub: 'আপনার ব্যবসার ধরন নির্বাচন করুন' },
  { n: 2, label: 'কাস্টমাইজ করুন',       sub: 'আপনার Agent সেটআপ করুন' },
  { n: 3, label: 'চালু করুন',            sub: 'টেস্ট করে প্রকাশ করুন' },
]

// Self-contained: fetches its own user/access/activation state, so it can be
// dropped in anywhere — the standalone /agents/new page, or embedded inline
// inside the main dashboard shell (see 'build-agent' view in
// src/app/dashboard/page.tsx) — without needing any props from the parent.
export default function BuildAgentWizard() {
  const { user, loading: authLoading, hasAccess, subscription, isTrialing, isAdmin } = useAccess()
  const { canActivateMore: rawCanActivateMore, activeCount, limit, loading: actLoading } = useAgentActivation(user?.id || null, subscription)
  const canActivateMore = isAdmin || rawCanActivateMore

  // ── wizard state, lifted here so the preview panel can react live ──
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [catFilter, setCatFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [describeText, setDescribeText] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<BusinessTemplate | null>(null)
  const [form, setForm] = useState<FormState>({
    name: '', description: '', category: 'business', business_type: 'general',
    tools: ['memory', 'calculations'], templateId: undefined,
  })
  const wizardState = { step, setStep, catFilter, setCatFilter, search, setSearch, describeText, setDescribeText, selectedTemplate, setSelectedTemplate, form, setForm }

  if (authLoading || !user || (hasAccess && actLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#fafaf8' }}>
        <div className="flex flex-col items-center gap-3 text-gray-300">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="bengali text-sm">লোড হচ্ছে...</span>
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#fafaf8' }}>
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4"><Lock size={26} /></div>
          <h2 className="text-xl font-bold text-gray-900 bengali mb-2">কাস্টম Agent তৈরি করতে সাবস্ক্রিপশন প্রয়োজন</h2>
          <p className="text-gray-500 text-sm bengali mb-6">আপনার ফ্রি ট্রায়াল শেষ হয়ে গেছে। নিজের Agent তৈরি ও লাইব্রেরি ব্যবহার করতে মাসিক ₹১৯৯ সাবস্ক্রিপশন নিন।</p>
          <Link href="/subscribe" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors bengali">এখনই সাবস্ক্রাইব করুন</Link>
        </div>
      </div>
    )
  }

  if (!canActivateMore) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#fafaf8' }}>
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4"><Lock size={26} /></div>
          <h2 className="text-xl font-bold text-gray-900 bengali mb-2">এজেন্ট সীমা শেষ ({activeCount}/{limit === Infinity ? '∞' : limit})</h2>
          <p className="text-gray-500 text-sm bengali mb-6">{isTrialing ? 'ট্রায়ালে' : 'আপনার প্ল্যানে'} ১টি এজেন্ট ব্যবহার করা যাবে। আরও এজেন্ট পেতে সাবস্ক্রাইব বা আপগ্রেড করুন।</p>
          <Link href="/subscribe" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors bengali">আপগ্রেড করুন</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#fafaf8' }}>

      {/* ── Compact header ────────────────────────────────── */}
      <div className="text-center pt-10 pb-8 px-4">
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2 bengali">নিজের AI Agent তৈরি করুন</h1>
        <p className="text-gray-400 text-[14px] bengali max-w-xl mx-auto">
          একটি template থেকে শুরু করুন অথবা আপনার ব্যবসার সম্পর্কে বলুন — Sahayak AI নিজেই সেটআপ করে দেবে।
        </p>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-0 mt-7 max-w-lg mx-auto">
          {STEPS.map((st, i) => (
            <div key={st.n} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step > st.n ? 'bg-indigo-600 text-white' : step === st.n ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-gray-100 text-gray-400'
                }`}>
                  {step > st.n ? <Check size={14} /> : st.n}
                </div>
                <div className="hidden sm:block text-center mt-1.5">
                  <div className={`text-[11px] font-bold bengali ${step === st.n ? 'text-indigo-600' : 'text-gray-400'}`}>{st.label}</div>
                  <div className="text-[10px] text-gray-300 bengali">{st.sub}</div>
                </div>
              </div>
              {i < STEPS.length - 1 && <div className={`h-0.5 w-16 mx-2 transition-all mb-5 ${step > st.n ? 'bg-indigo-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 min-w-0">
            <AgentBuilderForm s={wizardState} />
          </div>
          <div className="min-w-0">
            <AgentPreviewPanel s={wizardState} />
          </div>
        </div>

        {/* Trust badges */}
        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100 p-5 mt-8 max-w-xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {[
              { icon: <Shield size={14} className="text-indigo-500" />, t: 'আপনার data সুরক্ষিত' },
              { icon: <Globe size={14} className="text-indigo-500" />, t: 'India ও Bangladesh উভয়ে' },
              { icon: <Zap size={14} className="text-indigo-500" />, t: '২ মিনিটে তৈরি হয়' },
            ].map(b => (
              <div key={b.t} className="flex items-center gap-2 text-[12px] font-medium text-indigo-700 bengali">{b.icon}{b.t}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
