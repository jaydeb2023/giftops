export interface WhatsAppAccount {
  id: string
  user_id: string
  phone_number_id: string
  waba_id: string | null
  display_phone: string | null
  verified_name: string | null
  status: 'connected' | 'error' | 'disconnected'
  auto_reply: boolean
  ai_tone: 'friendly' | 'formal' | 'short'
  language: 'bn' | 'en' | 'auto'
  business_hours_start: number
  business_hours_end: number
  away_message: string | null
  greeting_message: string | null
  handoff_keywords: string[]
  last_error: string | null
  connected_at: string | null
}

export interface WhatsAppContact {
  id: string
  wa_id: string
  name: string | null
  last_message_at: string | null
  last_inbound_at: string | null
  unread_count: number
  is_bot_paused: boolean
  tags: string[]
  notes: string | null
}

export interface WhatsAppMessage {
  id: string
  contact_id: string
  wa_message_id: string | null
  direction: 'inbound' | 'outbound'
  msg_type: string
  body: string | null
  media_url: string | null
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'received'
  error_message: string | null
  ai_generated: boolean
  response_ms: number | null
  created_at: string
}

export interface KnowledgeEntry {
  id: string
  title: string
  content: string
  category: string
  keywords: string[]
  is_active: boolean
  hit_count: number
  created_at: string
}

export type TriggerType =
  | 'keyword' | 'first_message' | 'no_reply' | 'due_payment' | 'low_stock' | 'schedule'

export interface Automation {
  id: string
  name: string
  trigger_type: TriggerType
  trigger_value: string | null
  delay_minutes: number
  action_type: 'send_message' | 'ai_reply' | 'create_followup'
  message_body: string | null
  is_active: boolean
  run_count: number
  last_run_at: string | null
}

export interface FollowUp {
  id: string
  contact_id: string | null
  reason: string | null
  message_body: string
  due_at: string
  status: 'pending' | 'sent' | 'failed' | 'canceled'
  sent_at: string | null
  whatsapp_contacts?: { name: string | null; wa_id: string } | null
}

export interface WhatsAppStats {
  connected: boolean
  totalContacts: number
  newContacts7d: number
  inbound24h: number
  outbound24h: number
  inbound7d: number
  outbound7d: number
  aiReplies7d: number
  autoReplyRate: number
  avgResponseMs: number | null
  fastestResponseMs: number | null
  pendingFollowups: number
  activeAutomations: number
  knowledgeEntries: number
  failed7d: number
  daily: { date: string; inbound: number; outbound: number }[]
  topQuestions: { title: string; hit_count: number }[]
}

export const TRIGGER_LABELS: Record<TriggerType, { bn: string; en: string; hint_bn: string }> = {
  keyword:       { bn: 'কীওয়ার্ড',        en: 'Keyword',        hint_bn: 'কমা দিয়ে শব্দ লিখুন — দাম, price, rate' },
  first_message: { bn: 'প্রথম মেসেজ',      en: 'First message',  hint_bn: 'নতুন কাস্টমার প্রথমবার মেসেজ করলে' },
  no_reply:      { bn: 'উত্তর না দিলে',    en: 'No reply',       hint_bn: 'কত ঘণ্টা পরে ফলোআপ করবে (যেমন 24)' },
  due_payment:   { bn: 'বাকি বকেয়া',       en: 'Payment due',    hint_bn: 'due_date পেরোনোর কত দিন পরে (যেমন 1)' },
  low_stock:     { bn: 'কম স্টক',          en: 'Low stock',      hint_bn: 'স্টক min এর নিচে নামলে আপনাকে জানাবে' },
  schedule:      { bn: 'নির্দিষ্ট সময়',    en: 'Scheduled',      hint_bn: '24-ঘণ্টা ফরম্যাটে সময় — 10:00' },
}
