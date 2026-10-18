'use client'

import StockManager from '@/components/StockManager'

import { tr } from '@/lib/i18n/tr'
export default function StockOverview({ userId, agentNameById, agentColorById }: { userId: string; agentNameById: Record<string, string>; agentColorById?: Record<string, string> }) {
  return (
    <StockManager
      userId={userId}
      agentNameById={agentNameById}
      agentColorById={agentColorById}
      title={tr('সব পণ্য / স্টক')}
      slim
    />
  )
}
