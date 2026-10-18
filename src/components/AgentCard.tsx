import Link from 'next/link'
import { Agent, CATEGORY_LABELS } from '@/types'
import { Users, ArrowRight } from 'lucide-react'

interface Props {
  agent: Agent | typeof import('@/types').PREBUILT_AGENTS[0]
  showTryButton?: boolean
  id?: string
}

export default function AgentCard({ agent, showTryButton = true, id }: Props) {
  const cat = CATEGORY_LABELS[agent.category as keyof typeof CATEGORY_LABELS]

  return (
    <div
      className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all group cursor-pointer"
      style={{ borderTop: `3px solid ${agent.color}` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
          style={{ background: agent.color }}
        >
          {agent.icon}
        </div>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: cat.color, color: '#374151' }}
        >
          {cat.bn}
        </span>
      </div>

      <h3 className="font-bold text-gray-900 text-[15px] mb-0.5">{agent.name}</h3>
      {agent.name_bn && (
        <p className="text-indigo-600 text-[13px] font-semibold mb-2 bengali">{agent.name_bn}</p>
      )}
      <p className="text-gray-500 text-[13px] leading-relaxed mb-4 bengali line-clamp-2">
        {agent.description_bn || agent.description}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
          <Users size={12} />
          <span>{(agent.use_count || 0).toLocaleString()}+ uses</span>
        </div>
        {showTryButton && (
          <Link
            href={id ? `/agents/${id}` : '/library'}
            className="flex items-center gap-1 text-indigo-600 text-xs font-semibold group-hover:gap-2 transition-all"
          >
            চেষ্টা করুন <ArrowRight size={12} />
          </Link>
        )}
      </div>
    </div>
  )
}
