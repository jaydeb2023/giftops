'use client'

import { ReactNode, useEffect, useState } from 'react'
import ScrollPanel from '@/components/ScrollPanel'

/**
 * Inside view of an agent (library or custom): business dashboard + AI chat.
 *
 * Desktop (lg+): the same two columns as before (dashboard | chat).
 * Phones / small tablets: two tabs instead of one long stacked page.
 *   - 📊 Dashboard: flows as normal page scroll (no nested scroll area).
 *   - 🤖 Chat: fills the screen height, the conversation scrolls inside it.
 * Both tabs stay mounted (inactive one is just hidden) so switching tabs never
 * loses the chat conversation or reloads the dashboard.
 */
export default function AgentWorkspace({
  dashboard, chat,
  dashboardTitle = 'কাজের ড্যাশবোর্ড',
  chatTitle = 'AI সহায়ক',
  phoneChatHeight = 'calc(100dvh - 16rem)',
  defaultTab = 'chat',
}: {
  dashboard: ReactNode
  chat: ReactNode
  dashboardTitle?: string
  chatTitle?: string
  phoneChatHeight?: string
  defaultTab?: 'dashboard' | 'chat'
}) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)
  const [tab, setTab] = useState<'dashboard' | 'chat'>(defaultTab)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const on = () => setIsDesktop(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  if (isDesktop === null) return null

  if (isDesktop) {
    return (
      <div className="grid grid-cols-2 gap-5">
        <div>
          <h2 className="font-bold text-gray-700 bengali mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center text-xs font-bold">📊</span>
            {dashboardTitle}
          </h2>
          <ScrollPanel>{dashboard}</ScrollPanel>
        </div>
        <div>
          <h2 className="font-bold text-gray-700 bengali mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-green-100 text-green-700 rounded-lg flex items-center justify-center text-xs font-bold">🤖</span>
            {chatTitle}
          </h2>
          {chat}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex p-1 bg-gray-100 rounded-xl mb-3">
        {([['dashboard', '📊 ড্যাশবোর্ড'], ['chat', '🤖 AI চ্যাট']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-2 rounded-lg text-[13px] font-bold bengali transition-colors ${tab === id ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className={tab === 'dashboard' ? '' : 'hidden'}>{dashboard}</div>
      <div className={tab === 'chat' ? '[&>div]:!h-full' : 'hidden'} style={{ height: phoneChatHeight, minHeight: 360 }}>{chat}</div>
    </div>
  )
}
