'use client'

import { useRef, useCallback, useState, Dispatch, SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { AgentFormData, AgentTool, BusinessType, TOOL_LABELS, BUSINESS_TYPE_LABELS } from '@/types'
import { generateAgentWithAI, BUSINESS_TEMPLATES, BusinessTemplate } from '@/lib/agentUtils'
import { supabase } from '@/lib/supabaseClient'
import toast from 'react-hot-toast'
import {
  Sparkles, CheckCircle2, Mic, MicOff, Globe, Search, ImagePlus, FileUp,
  ArrowLeft, Check, Zap, Send, PlayCircle,
} from 'lucide-react'

// Maps a business-template id to the dashboard "business_type" it should use
// (Stock/Sales/Baki/Customers/Report tabs + GST billing adapt to this).
// Anything not listed here defaults to 'general'.
const TEMPLATE_TO_BUSINESS_TYPE: Record<string, BusinessType> = {
  dokan: 'dokan',
  fish_meat: 'dokan',
  vegetable: 'dokan',
  stationery: 'dokan',
  sweet_shop: 'mishti',
  cloth_store: 'kapor',
  tiffin: 'hotel',
}

const BUSINESS_TYPE_OPTIONS = Object.entries(BUSINESS_TYPE_LABELS) as [BusinessType, typeof BUSINESS_TYPE_LABELS[BusinessType]][]

export const CATEGORY_FILTER = [
  { key: 'all',         label: 'সব',        icon: '⚡' },
  { key: 'business',    label: 'ব্যবসা',    icon: '🏪' },
  { key: 'education',   label: 'শিক্ষা',    icon: '📚' },
  { key: 'health',      label: 'স্বাস্থ্য', icon: '🏥' },
  { key: 'finance',     label: 'অর্থ',      icon: '💰' },
  { key: 'festival',    label: 'উৎসব',      icon: '🌺' },
  { key: 'agriculture', label: 'কৃষি',      icon: '🌾' },
  { key: 'service',     label: 'সার্ভিস',   icon: '🔧' },
  { key: 'other',       label: 'অন্যান্য',  icon: '✨' },
]

// Quick-fill chips under the "describe your business" box.
export const QUICK_DESCRIBE_CHIPS = [
  { label: 'ফার্মেসি ব্যবসা', templateId: 'pharmacy' },
  { label: 'গ্রোসারি দোকান', templateId: 'dokan' },
  { label: 'কাপড়ের দোকান', templateId: 'cloth_store' },
  { label: 'হোটেল / রেস্টুরেন্ট', templateId: 'tiffin' },
  { label: 'মাছের আড়ৎ', templateId: 'fish_meat' },
  { label: 'আমার নিজস্ব ব্যবসা', templateId: 'customs' },
]

// Very small keyword matcher: scores every template's Bengali name/description/
// context/sample-prompts against the free-text business description, so typing
// "আমার একটা ফার্মেসি আছে" can auto-suggest the pharmacy template. This is a
// local heuristic, not an AI call — good enough for a nudge, not a promise.
export function matchTemplate(text: string): BusinessTemplate | null {
  const q = text.trim().toLowerCase()
  if (!q) return null
  let best: { t: BusinessTemplate; score: number } | null = null
  for (const t of BUSINESS_TEMPLATES) {
    if (t.id === 'customs') continue
    const haystack = [t.name_bn, t.name, t.description_bn, t.systemContext, ...t.samplePrompts].join(' ').toLowerCase()
    let score = 0
    for (const word of q.split(/\s+/).filter(w => w.length > 1)) {
      if (haystack.includes(word)) score += 1
    }
    if (score > 0 && (!best || score > best.score)) best = { t, score }
  }
  return best?.t || null
}

export type FormState = AgentFormData & { templateId?: string }

export interface AgentBuilderState {
  step: 1 | 2 | 3
  setStep: Dispatch<SetStateAction<1 | 2 | 3>>
  catFilter: string
  setCatFilter: Dispatch<SetStateAction<string>>
  search: string
  setSearch: Dispatch<SetStateAction<string>>
  describeText: string
  setDescribeText: Dispatch<SetStateAction<string>>
  selectedTemplate: BusinessTemplate | null
  setSelectedTemplate: Dispatch<SetStateAction<BusinessTemplate | null>>
  form: FormState
  setForm: Dispatch<SetStateAction<FormState>>
}

// applies a template's defaults onto the form without changing step —
// selecting a card just highlights it; the bottom CTA advances to step 2.
export function applyTemplate(s: AgentBuilderState, t: BusinessTemplate) {
  s.setSelectedTemplate(t)
  s.setForm(f => ({
    ...f,
    templateId: t.id,
    category: t.category,
    business_type: TEMPLATE_TO_BUSINESS_TYPE[t.id] || 'general',
    tools: t.defaultTools,
    name: f.name || '',
    description: f.description || t.description_bn,
  }))
}

export default function AgentBuilderForm({ s }: { s: AgentBuilderState }) {
  const router = useRouter()
  const { step, setStep, catFilter, setCatFilter, search, setSearch, describeText, setDescribeText, selectedTemplate, setSelectedTemplate, form, setForm } = s

  const [buildState, setBuildStateLocal] = useState<'idle' | 'building' | 'done'>('idle')
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [showHowItWorks, setShowHowItWorks] = useState(false)

  // Voice state
  const [listeningField, setListeningField] = useState<'name' | 'description' | 'describe' | null>(null)
  const [voiceLang, setVoiceLang] = useState<'bn-IN' | 'en-IN'>('bn-IN')
  const recognitionRef = useRef<any>(null)
  const finalTranscriptRef = useRef('')

  const startVoice = useCallback((field: 'name' | 'description' | 'describe') => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { toast.error('আপনার browser voice input support করে না।'); return }
    if (recognitionRef.current) recognitionRef.current.abort()
    finalTranscriptRef.current = ''
    const r = new SR()
    recognitionRef.current = r
    r.lang = voiceLang; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false
    r.onstart  = () => setListeningField(field)
    r.onerror  = (e: any) => {
      setListeningField(null)
      if (e.error === 'not-allowed') toast.error('Microphone permission দিন।')
      else if (e.error === 'no-speech') toast.error('কোনো কথা শোনা যায়নি।')
    }
    const apply = (val: string) => {
      if (field === 'describe') setDescribeText(val)
      else setForm(f => ({ ...f, [field]: val }))
    }
    r.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscriptRef.current += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      apply(finalTranscriptRef.current + interim)
    }
    r.onend = () => {
      setListeningField(null)
      const final = finalTranscriptRef.current.trim()
      if (final) apply(final)
    }
    r.start()
  }, [voiceLang]) // eslint-disable-line

  const stopVoice = useCallback(() => { recognitionRef.current?.stop(); setListeningField(null) }, []) // eslint-disable-line
  const isListening = (f: 'name' | 'description' | 'describe') => listeningField === f

  const tools = Object.entries(TOOL_LABELS) as [AgentTool, typeof TOOL_LABELS[AgentTool]][]

  const pickTemplateAndAdvance = (t: BusinessTemplate) => { applyTemplate(s, t); setStep(2) }

  const runDescribeMatch = () => {
    if (!describeText.trim()) return
    const match = matchTemplate(describeText)
    const t = match || BUSINESS_TEMPLATES.find(bt => bt.id === 'customs')!
    applyTemplate(s, t)
    setForm(f => ({ ...f, description: describeText }))
    toast.success(match ? `${match.name_bn} টেমপ্লেট মিলে গেছে` : 'কাস্টম ব্যবসা হিসেবে সেট করা হয়েছে')
  }

  const applyQuickChip = (templateId: string) => {
    const t = BUSINESS_TEMPLATES.find(bt => bt.id === templateId)
    if (!t) return
    setDescribeText(t.name_bn)
    applyTemplate(s, t)
  }

  const goToStep2 = () => {
    if (selectedTemplate) { setStep(2); return }
    if (describeText.trim()) { runDescribeMatch(); setStep(2); return }
    toast.error('একটি template বেছে নিন বা আপনার ব্যবসা সম্পর্কে বলুন')
  }

  const buildAgent = async () => {
    if (!form.name.trim()) { toast.error('এজেন্টের নাম দিন'); return }
    setBuildStateLocal('building')
    setStep(3)

    const steps = [
      { pct: 20,  label: 'আপনার ব্যবসার ধরন বিশ্লেষণ করছি...' },
      { pct: 40,  label: 'Bengali system prompt তৈরি হচ্ছে...' },
      { pct: 60,  label: 'AI personality সেট হচ্ছে...' },
      { pct: 80,  label: 'Tools সংযুক্ত হচ্ছে...' },
      { pct: 100, label: 'প্রায় শেষ — saving...' },
    ]
    for (const st of steps) {
      await new Promise(r => setTimeout(r, 450))
      setProgress(st.pct); setProgressLabel(st.label)
    }

    try {
      const generated = await generateAgentWithAI(form)
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase.from('agents').insert({
        user_id:        user?.id || '00000000-0000-0000-0000-000000000000',
        name:           form.name,
        name_bn:        form.name,
        description:    form.description || selectedTemplate?.description_bn || '',
        description_bn: form.description || selectedTemplate?.description_bn || '',
        category:       form.category,
        business_type:  form.business_type,
        tools:          form.tools,
        system_prompt:  generated.system_prompt,
        icon:           generated.icon,
        color:          generated.color,
        template_id:    form.templateId || null,
        is_public:      false,
        is_featured:    false,
      }).select().single()

      if (!error && data) {
        setCreatedId(data.id)
        await supabase.from('user_agent_activations').insert({
          user_id: user?.id, kind: 'custom', ref: data.id,
        }).then(({ error: actErr }) => { if (actErr) console.error('user_agent_activations insert:', actErr) })
      }
      setBuildStateLocal('done')
    } catch (err) {
      console.error(err)
      setBuildStateLocal('done')
    }
  }

  // ── STEP 1: Describe + Template Picker ─────────────────────
  if (step === 1) {
    const bySearch = search.trim()
      ? BUSINESS_TEMPLATES.filter(t => (t.name_bn + t.description_bn).toLowerCase().includes(search.trim().toLowerCase()))
      : BUSINESS_TEMPLATES
    const filtered = catFilter === 'all' ? bySearch : bySearch.filter(t => t.category === catFilter)

    return (
      <div>
        {/* AI describe box */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <h3 className="font-bold text-gray-900 text-[15px] bengali flex items-center gap-2"><Sparkles size={16} className="text-indigo-500" /> আপনার ব্যবসা সম্পর্কে বলুন</h3>
            <button onClick={() => setShowHowItWorks(v => !v)} className="flex items-center gap-1.5 text-[12px] font-semibold text-indigo-600 bengali">
              <PlayCircle size={14} /> দেখুন কিভাবে কাজ করে
            </button>
          </div>
          {showHowItWorks && (
            <div className="mb-3 p-3 rounded-xl bg-indigo-50 text-indigo-700 text-[12px] bengali space-y-1">
              <div>১. আপনার ব্যবসা নিয়ে বাংলায় লিখুন বা বলুন — যেমন "আমার একটা ফার্মেসি আছে"</div>
              <div>২. Sahayak AI এর সাথে মিলে যাওয়া template খুঁজে বের করবে</div>
              <div>৩. পরের ধাপে নাম ও tools ঠিক করে Agent চালু করুন</div>
            </div>
          )}
          <div className="relative">
            <textarea value={describeText} onChange={e => setDescribeText(e.target.value)} rows={2}
              placeholder='যেমন: আমার একটি ফার্মেসি আছে, আমি স্টক, বিক্রি, কাস্টমার ও বাকি ম্যানেজ করতে চাই'
              className={`w-full px-4 py-3 pr-32 rounded-xl border text-[14px] focus:outline-none focus:ring-2 resize-none bengali transition-colors ${
                isListening('describe') ? 'border-red-300 bg-red-50 focus:ring-red-50' : 'border-gray-200 focus:border-indigo-400 focus:ring-indigo-50'
              }`} />
            <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
              <button title="ছবি (শীঘ্রই আসছে)" onClick={() => toast('ছবি থেকে বোঝা শীঘ্রই আসছে', { icon: '🛠️' })}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 text-gray-500 hover:bg-gray-200"><ImagePlus size={14} /></button>
              <button title="ফাইল (শীঘ্রই আসছে)" onClick={() => toast('ফাইল আপলোড শীঘ্রই আসছে', { icon: '🛠️' })}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 text-gray-500 hover:bg-gray-200"><FileUp size={14} /></button>
              <button onClick={() => isListening('describe') ? stopVoice() : startVoice('describe')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isListening('describe') ? 'bg-red-500 animate-pulse' : 'bg-gray-100 hover:bg-indigo-100 text-gray-600'}`}>
                {isListening('describe') ? <MicOff size={14} className="text-white" /> : <Mic size={14} />}
              </button>
              <button onClick={runDescribeMatch} disabled={!describeText.trim()}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-600 text-white disabled:opacity-40"><Send size={14} /></button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {QUICK_DESCRIBE_CHIPS.map(c => (
              <button key={c.templateId} onClick={() => applyQuickChip(c.templateId)}
                className="px-3 py-1.5 rounded-full border border-gray-200 text-[12px] font-semibold text-gray-600 hover:border-indigo-300 hover:text-indigo-600 bengali">{c.label}</button>
            ))}
          </div>
        </div>

        {/* Template picker */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h3 className="font-bold text-gray-900 text-[15px] bengali">অথবা একটি template নির্বাচন করুন</h3>
          <div className="relative w-full sm:w-56">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="template খুঁজুন..."
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-[12.5px] bengali focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          </div>
        </div>
        <p className="text-gray-400 text-[12.5px] bengali mb-4">আপনার ব্যবসার ধরন অনুযায়ী প্রস্তুত করা AI Agent template থেকে শুরু করুন।</p>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          {CATEGORY_FILTER.map(c => (
            <button key={c.key} onClick={() => setCatFilter(c.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold transition-all border bengali ${
                catFilter === c.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
              }`}>
              <span>{c.icon}</span>{c.label}
            </button>
          ))}
        </div>

        {/* Template grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-14 bg-gray-50 rounded-2xl text-gray-400 text-sm bengali">কোনো template পাওয়া যায়নি।</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(t => {
              const active = selectedTemplate?.id === t.id
              return (
                <button key={t.id} onClick={() => applyTemplate(s, t)} onDoubleClick={() => pickTemplateAndAdvance(t)}
                  className={`group text-left p-5 rounded-2xl border bg-white transition-all relative ${
                    active ? 'border-indigo-400 ring-2 ring-indigo-100 shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
                  }`}>
                  {active && <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center"><Check size={11} /></div>}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform group-hover:scale-110"
                      style={{ background: t.light }}>{t.icon}</div>
                    <div className="flex-1 min-w-0 pr-4">
                      <span className="font-bold text-gray-900 text-[14px] bengali">{t.name_bn}</span>
                      <div className="text-gray-400 text-[12px] bengali leading-relaxed mt-1 line-clamp-2">{t.description_bn}</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {t.defaultTools.slice(0, 3).map(tool => (
                          <span key={tool} className="text-[10px] px-2 py-0.5 rounded-full bengali font-medium" style={{ background: t.light, color: t.accent }}>
                            {TOOL_LABELS[tool]?.bn || tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Bottom CTA */}
        <button onClick={goToStep2}
          className="w-full mt-6 py-4 font-bold text-[15px] rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 text-white bengali"
          style={{ background: selectedTemplate ? `linear-gradient(135deg, ${selectedTemplate.accent}, ${selectedTemplate.accent}dd)` : 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
          <Sparkles size={18} /> Agent তৈরি করে এগিয়ে যান →
        </button>
      </div>
    )
  }

  // ── STEP 3: Building / Done ────────────────────────────────
  if (step === 3) {
    if (buildState === 'building') {
      return (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: selectedTemplate?.light || '#EEF2FF' }}>
            <span className="text-3xl">{selectedTemplate?.icon || '🤖'}</span>
          </div>
          <h3 className="font-bold text-gray-900 text-xl mb-2 bengali">{form.name} তৈরি হচ্ছে...</h3>
          <p className="text-gray-400 text-sm bengali mb-8">{progressLabel}</p>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3 max-w-sm mx-auto">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: selectedTemplate?.accent || '#4F46E5' }} />
          </div>
          <p className="text-xs text-gray-300">{progress}%</p>
        </div>
      )
    }

    return (
      <div className="bg-white rounded-2xl border border-emerald-200 p-10 text-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="text-emerald-500" size={44} />
        </div>
        <div className="text-4xl mb-3">{selectedTemplate?.icon || '🤖'}</div>
        <h3 className="font-extrabold text-gray-900 text-2xl mb-2 bengali">🎉 তৈরি হয়েছে!</h3>
        <p className="text-gray-500 text-sm bengali mb-6">
          <strong className="text-gray-800">{form.name}</strong> সফলভাবে তৈরি হয়েছে। এখন বাংলায় chat করুন।
        </p>
        <div className="bg-emerald-50 rounded-2xl p-5 text-left mb-6 space-y-2 max-w-sm mx-auto">
          {[
            `${selectedTemplate?.icon || '⚡'} ${selectedTemplate?.name_bn || 'কাস্টম'} template`,
            `🗣️ বাংলায় voice + text input`,
            `💾 সব তথ্য DB-তে save হবে`,
            `📊 রিপোর্ট ও হিসাব সব বাংলায়`,
          ].map(f => (
            <div key={f} className="flex items-center gap-2 text-emerald-700 text-sm bengali">
              <Check size={14} className="flex-shrink-0 text-emerald-500" />{f}
            </div>
          ))}
        </div>
        <div className="flex gap-3 justify-center flex-wrap">
          <button onClick={() => router.push(createdId ? `/agents/${createdId}` : '/dashboard')}
            className="px-7 py-3.5 font-bold rounded-xl text-white transition-all hover:scale-105 bengali flex items-center gap-2"
            style={{ background: selectedTemplate?.accent || '#4F46E5' }}>
            <Zap size={16} /> এখনই চালান →
          </button>
          <button onClick={() => router.push('/dashboard')}
            className="px-7 py-3.5 border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium rounded-xl transition-colors bengali">
            Dashboard
          </button>
        </div>
      </div>
    )
  }

  // ── STEP 2: Customize ─────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 flex items-center gap-4 border-b border-gray-100"
        style={{ background: selectedTemplate ? `${selectedTemplate.accent}10` : '#F9FAFB' }}>
        <button onClick={() => setStep(1)}
          className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors flex-shrink-0">
          <ArrowLeft size={16} className="text-gray-500" />
        </button>
        {selectedTemplate && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: selectedTemplate.light }}>{selectedTemplate.icon}</div>
        )}
        <div className="flex-1">
          <h2 className="font-bold text-gray-900 text-base bengali">
            {selectedTemplate?.name_bn || 'কাস্টম এজেন্ট'} কাস্টমাইজ করুন
          </h2>
          <p className="text-gray-400 text-xs bengali mt-0.5">নাম দিন ও tools বেছে নিন</p>
        </div>
        {/* Voice lang toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <Globe size={11} className="text-gray-400 ml-1" />
          {(['bn-IN', 'en-IN'] as const).map(l => (
            <button key={l} onClick={() => setVoiceLang(l)}
              className={`text-[11px] font-bold px-2 py-1 rounded-md transition-colors ${voiceLang === l ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>
              {l === 'bn-IN' ? 'বাং' : 'EN'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Sample prompts preview */}
        {selectedTemplate && (
          <div className="rounded-2xl p-4 border" style={{ background: selectedTemplate.light, borderColor: selectedTemplate.accent + '30' }}>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2.5" style={{ color: selectedTemplate.accent }}>এভাবে বলতে পারবেন:</p>
            <div className="space-y-1.5">
              {selectedTemplate.samplePrompts.slice(0, 3).map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px] bengali text-gray-600">
                  <span className="text-[10px]" style={{ color: selectedTemplate.accent }}>▸</span>{p}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-[13px] font-bold text-gray-700 mb-2 bengali">আপনার এজেন্টের নাম <span className="text-red-400">*</span></label>
          <div className="flex gap-2">
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={selectedTemplate ? `যেমন: আমার ${selectedTemplate.name_bn}` : 'এজেন্টের নাম লিখুন'}
              className={`flex-1 px-4 py-3 rounded-xl border text-[14px] focus:outline-none focus:ring-2 bengali transition-colors ${
                isListening('name') ? 'border-red-300 bg-red-50 focus:ring-red-50' : 'border-gray-200 focus:border-indigo-400 focus:ring-indigo-50'
              }`} />
            <button onClick={() => isListening('name') ? stopVoice() : startVoice('name')}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${isListening('name') ? 'bg-red-500 animate-pulse' : 'bg-gray-100 hover:bg-indigo-100 text-gray-600'}`}>
              {isListening('name') ? <MicOff size={16} className="text-white" /> : <Mic size={16} />}
            </button>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-[13px] font-bold text-gray-700 mb-2 bengali">বিস্তারিত বিবরণ <span className="text-gray-400 font-normal">(ঐচ্ছিক)</span></label>
          <div className="relative">
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
              placeholder="আপনার ব্যবসার বিশেষ চাহিদা বলুন..."
              className={`w-full px-4 py-3 pr-12 rounded-xl border text-[14px] focus:outline-none focus:ring-2 resize-none bengali transition-colors ${
                isListening('description') ? 'border-red-300 bg-red-50 focus:ring-red-50' : 'border-gray-200 focus:border-indigo-400 focus:ring-indigo-50'
              }`} />
            <button onClick={() => isListening('description') ? stopVoice() : startVoice('description')}
              className={`absolute right-3 bottom-3 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isListening('description') ? 'bg-red-500 animate-pulse' : 'bg-gray-100 hover:bg-indigo-100 text-gray-600'}`}>
              {isListening('description') ? <MicOff size={13} className="text-white" /> : <Mic size={13} />}
            </button>
          </div>
        </div>

        {/* Business type */}
        <div>
          <label className="block text-[13px] font-bold text-gray-700 mb-2 bengali">ব্যবসার ধরন <span className="text-gray-400 font-normal">(ড্যাশবোর্ড এই অনুযায়ী সাজানো হবে)</span></label>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_TYPE_OPTIONS.map(([key, val]) => (
              <button key={key} type="button" onClick={() => setForm(f => ({ ...f, business_type: key }))}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-[12px] font-semibold transition-all bengali ${
                  form.business_type === key ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                }`}
                style={form.business_type === key ? { background: selectedTemplate?.accent || '#4F46E5' } : {}}>
                <span>{val.icon}</span>{val.bn}
              </button>
            ))}
          </div>
        </div>

        {/* Tools */}
        <div>
          <label className="block text-[13px] font-bold text-gray-700 mb-3 bengali">কোন সুবিধাগুলো চান?</label>
          <div className="flex flex-wrap gap-2">
            {tools.map(([key, val]) => (
              <button key={key} onClick={() => setForm(f => ({ ...f, tools: f.tools.includes(key) ? f.tools.filter(tl => tl !== key) : [...f.tools, key] }))}
                className={`px-3.5 py-2 rounded-full border text-[12px] font-semibold transition-all bengali ${
                  form.tools.includes(key) ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                }`}
                style={form.tools.includes(key) ? { background: selectedTemplate?.accent || '#4F46E5', borderColor: 'transparent' } : {}}>
                {form.tools.includes(key) ? '✓ ' : ''}{val.bn}
              </button>
            ))}
          </div>
        </div>

        {/* Build button */}
        <button onClick={buildAgent}
          className="w-full py-4 font-bold text-[15px] rounded-xl flex items-center justify-center gap-2 transition-all hover:opacity-90 text-white bengali"
          style={{ background: selectedTemplate ? `linear-gradient(135deg, ${selectedTemplate.accent}, ${selectedTemplate.accent}dd)` : 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
          <Sparkles size={18} /> {form.name || selectedTemplate?.name_bn || 'এজেন্ট'} তৈরি করুন →
        </button>
      </div>
    </div>
  )
}
