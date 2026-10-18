// src/app/agents/[id]/page.tsx
// Custom agents whose business_type matches a known vertical (dokan/pharmacy/
// hotel/mishti/kapor) get the same rich manager dashboard as the Library.
// Custom agents with business_type 'general' still show AgentRunner + AgentDataPanel.
// Prebuilt agents (accessed by numeric index) keep the original layout.

import { notFound, redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabaseServer'
import { PREBUILT_AGENTS } from '@/types'
import AgentRunner from '@/components/AgentRunner'
import AgentDataPanel from '@/components/AgentDataPanel'
import AgentWorkspace from '@/components/AgentWorkspace'
import ScrollPanel from '@/components/ScrollPanel'
import DokanManagerUI from '@/components/DokanManagerUI'
import PharmacyAssistantUI from '@/components/PharmacyAssistantUI'
import HotelDhabaManagerUI from '@/components/HotelDhabaManagerUI'
import MishtiDokanManagerUI from '@/components/MishtiDokanManagerUI'
import KaporDokanManagerUI from '@/components/KaporDokanManagerUI'
import { ArrowLeft, Share2, Users, Database } from 'lucide-react'
import Link from 'next/link'

interface Props {
  params: { id: string }
}

function isUUID(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}

// Same business verticals the Library maps by slug — here we map by the
// custom agent's stored business_type instead, so "Build Agent" output
// gets the identical rich dashboard as the matching Library agent.
function renderBusinessManagerUI(businessType: string | undefined, userId: string) {
  switch (businessType) {
    case 'dokan':   return <DokanManagerUI userId={userId} />
    case 'pharmacy':return <PharmacyAssistantUI userId={userId} />
    case 'hotel':   return <HotelDhabaManagerUI userId={userId} />
    case 'mishti':  return <MishtiDokanManagerUI userId={userId} />
    case 'kapor':   return <KaporDokanManagerUI userId={userId} />
    default:        return null // 'general' or unrecognized → fall back to AgentDataPanel
  }
}

export default async function AgentDetailPage({ params }: Props) {
  const isCustomAgent = isUUID(params.id)
  let agent: any = null
  let currentUserId: string | undefined

  // Custom (user-built) agents are a paid feature — gate on trial/subscription.
  if (isCustomAgent) {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect(`/login?next=/agents/${params.id}`)
    currentUserId = user!.id

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user!.id).single()

    if (!profile?.is_admin) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status, trial_ends_at, current_period_end')
        .eq('user_id', user!.id)
        .maybeSingle()

      const now = Date.now()
      const stillTrialing = sub?.status === 'trialing' && new Date(sub.trial_ends_at).getTime() > now
      const stillActive = sub?.status === 'active' && sub.current_period_end && new Date(sub.current_period_end).getTime() > now
      if (!stillTrialing && !stillActive) redirect('/subscribe')
    }
  }

  if (!isCustomAgent) {
    // Prebuilt agent by numeric index
    const prebuiltIndex = parseInt(params.id)
    if (!isNaN(prebuiltIndex) && prebuiltIndex >= 0 && prebuiltIndex < PREBUILT_AGENTS.length) {
      agent = { ...PREBUILT_AGENTS[prebuiltIndex], id: params.id }
    }
  } else {
    // User-created agent — fetch from Supabase
    try {
      const supabase = createServerClient()
      const { data } = await supabase
        .from('agents')
        .select('*')
        .eq('id', params.id)
        .single()
      agent = data
    } catch {
      agent = null
    }
  }

  if (!agent) notFound()

  // If this custom agent's business_type matches a known vertical, we render
  // the same rich manager dashboard the Library uses for that vertical.
  const businessManagerUI = isCustomAgent
    ? renderBusinessManagerUI(agent.business_type, currentUserId!)
    : null

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Back */}
        <Link
          href={isCustomAgent ? '/dashboard' : '/library'}
          className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={15} />
          {isCustomAgent ? 'Dashboard-এ ফিরুন' : 'Library-তে ফিরুন'}
        </Link>

        {isCustomAgent ? (
          businessManagerUI ? (
            // ── CUSTOM AGENT, KNOWN BUSINESS TYPE: same rich dashboard as Library ──
            <>
              {/* Agent header card */}
              <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 flex items-center gap-4"
                style={{ borderLeft: `5px solid ${agent.color || '#4F46E5'}` }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                  style={{ background: agent.color || '#EEF2FF' }}>
                  {agent.icon || '🤖'}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="font-extrabold text-gray-900 text-xl bengali">{agent.name_bn || agent.name}</h1>
                  <p className="text-gray-500 text-sm bengali mt-0.5">{agent.description_bn || agent.description}</p>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 flex-shrink-0">
                  <Database size={10} /> Real Data
                </div>
              </div>

              <AgentWorkspace
                dashboard={businessManagerUI}
                chat={<AgentRunner
                    agent={agent}
                    agentId={params.id}
                    isCustomAgent={true}
                    userId={currentUserId}
                  />}
                chatTitle="AI সহায়ক — বাংলায় কথা বলুন"
              />
            </>
          ) : (
          // ── CUSTOM AGENT, GENERAL TYPE: Chat + generic Data Panel ──────────
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Left: Agent info + Chat (3 cols) */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              {/* Agent header card */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5"
                style={{ borderTop: `3px solid ${agent.color || '#4F46E5'}` }}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: agent.color || '#EEF2FF' }}>
                    {agent.icon || '🤖'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="font-extrabold text-gray-900 text-lg leading-tight">{agent.name}</h1>
                    {agent.name_bn && (
                      <p className="text-indigo-600 font-bold bengali text-sm">{agent.name_bn}</p>
                    )}
                    <p className="text-gray-500 text-[13px] leading-relaxed bengali mt-1">
                      {agent.description_bn || agent.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 flex-shrink-0">
                    <Database size={10} />
                    Real Data
                  </div>
                </div>
              </div>

              {/* Chat */}
              <AgentRunner
                agent={agent}
                agentId={params.id}
                isCustomAgent={true}
                userId={currentUserId}
              />
            </div>

            {/* Right: Data Panel (2 cols) */}
            <div className="lg:col-span-2" style={{ height: '700px' }}>
              <AgentDataPanel
                agentId={params.id}
                agentName={agent.name_bn || agent.name}
              />
            </div>
          </div>
          )

        ) : (
          // ── PREBUILT AGENT LAYOUT: original 3-col layout ────────
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agent info */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-6"
                style={{ borderTop: `3px solid ${agent.color}` }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4"
                  style={{ background: agent.color }}>
                  {agent.icon}
                </div>
                <h1 className="font-extrabold text-gray-900 text-xl mb-1">{agent.name}</h1>
                {agent.name_bn && (
                  <p className="text-indigo-600 font-bold bengali mb-3">{agent.name_bn}</p>
                )}
                <p className="text-gray-500 text-[14px] leading-relaxed bengali">
                  {agent.description_bn || agent.description}
                </p>
                <div className="border-t border-gray-100 mt-4 pt-4 flex items-center gap-2 text-gray-400 text-xs">
                  <Users size={12} />
                  <span>{(agent.use_count || 0).toLocaleString()}+ conversations</span>
                </div>
              </div>

              <button className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl text-sm font-medium text-gray-600 transition-colors">
                <Share2 size={15} /> Share করুন
              </button>

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <h4 className="font-bold text-indigo-800 text-[13px] mb-2">💬 কীভাবে ব্যবহার করবেন</h4>
                <ul className="space-y-1.5 text-indigo-700 text-[12px] bengali">
                  <li>• বাংলায় সরাসরি প্রশ্ন করুন</li>
                  <li>• হিসাব-নিকাশ জিজ্ঞেস করুন</li>
                  <li>• তথ্য দিন, সে মনে রাখবে</li>
                  <li>• সমস্যা বললে সমাধান দেবে</li>
                </ul>
              </div>
            </div>

            {/* Chat runner */}
            <div className="lg:col-span-2">
              <AgentRunner agent={agent} agentId={params.id} isCustomAgent={false} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
