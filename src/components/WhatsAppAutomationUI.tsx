'use client'

import { MessageCircle, Link2, Send, Inbox } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'

// NOTE: This is a scaffold/placeholder. Real WhatsApp number connection,
// message sending, and inbox view will be wired up once the integration
// (e.g. WhatsApp Business Cloud API) spec is provided.
export default function WhatsAppAutomationUI({ userId }: { userId: string }) {
  const { t } = useLanguage()

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border border-gray-100 p-8 sm:p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5">
          <MessageCircle size={28} className="text-emerald-600" />
        </div>
        <h1 className="text-xl font-extrabold text-gray-900 bengali mb-2">{t('whatsapp.title')}</h1>
        <p className="text-gray-400 text-sm bengali max-w-md mx-auto mb-6">{t('whatsapp.comingSoonBody')}</p>

        <button
          disabled
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-sm opacity-50 cursor-not-allowed bengali"
        >
          <Link2 size={15} /> {t('whatsapp.connectCta')}
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 text-left">
          <div className="bg-gray-50 rounded-xl p-4">
            <Link2 size={16} className="text-gray-400 mb-2" />
            <div className="text-[12px] font-bold text-gray-700 bengali">নম্বর কানেক্ট</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <Send size={16} className="text-gray-400 mb-2" />
            <div className="text-[12px] font-bold text-gray-700 bengali">মেসেজ পাঠান</div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <Inbox size={16} className="text-gray-400 mb-2" />
            <div className="text-[12px] font-bold text-gray-700 bengali">ইনবক্স দেখুন</div>
          </div>
        </div>

        <div className="mt-8 inline-block px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-[11px] font-bold bengali">
          {t('common.comingSoon')}
        </div>
      </div>
    </div>
  )
}
