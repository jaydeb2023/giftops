'use client'

import { useState } from 'react'
import { Mail, MessageSquare, MapPin, Send, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [sending, setSending] = useState(false)

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.message) {
      toast.error('নাম, email এবং message দিন')
      return
    }
    setSending(true)
    // For now opens mailto — replace with your email API later
    const mailto = `mailto:contact@sahayakai.tech?subject=${encodeURIComponent(form.subject || 'Contact from Sahayak AI')}&body=${encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`)}`
    window.location.href = mailto
    setTimeout(() => {
      setSending(false)
      toast.success('আপনার email app খুলছে!')
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-16">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-3 bengali">যোগাযোগ করুন</h1>
          <p className="text-gray-500 bengali text-lg">কোনো প্রশ্ন, পরামর্শ, বা সহায়তা দরকার? আমরা সবসময় আছি।</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Contact info */}
          <div className="space-y-4">
            {[
              { icon: <Mail size={20} className="text-indigo-500" />, title: 'Email', val: 'contact@sahayakai.tech', bg: 'bg-indigo-50' },
              { icon: <MessageSquare size={20} className="text-emerald-500" />, title: 'Response time', val: '২৪ ঘণ্টার মধ্যে উত্তর', bg: 'bg-emerald-50' },
              { icon: <MapPin size={20} className="text-amber-500" />, title: 'Location', val: 'West Bengal, India & Bangladesh', bg: 'bg-amber-50' },
            ].map(c => (
              <div key={c.title} className="bg-white rounded-2xl border border-gray-200 p-5 flex items-start gap-4">
                <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>{c.icon}</div>
                <div>
                  <div className="font-bold text-gray-900 text-sm">{c.title}</div>
                  <div className="text-gray-500 text-sm mt-0.5 bengali">{c.val}</div>
                </div>
              </div>
            ))}

            {/* FAQ hint */}
            <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-5">
              <h3 className="font-bold text-indigo-900 text-sm mb-2 bengali">সাধারণ প্রশ্ন</h3>
              <ul className="space-y-2 text-sm text-indigo-700 bengali">
                <li>• Sahayak AI কি সত্যিই বিনামূল্যে?</li>
                <li>• আমার data কি safe?</li>
                <li>• কোন ব্যবসার জন্য কোন agent?</li>
              </ul>
              <p className="text-indigo-600 text-xs mt-3">এই প্রশ্নগুলোর উত্তর আমাদের blog-এ আছে।</p>
            </div>
          </div>

          {/* Contact form */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-8">
            <h2 className="font-bold text-gray-900 text-xl mb-6 bengali">বার্তা পাঠান</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 bengali">আপনার নাম *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="যেমন: রামপ্রসাদ মণ্ডল"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 bengali"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="your@email.com"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 bengali">বিষয় (Subject)</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="যেমন: ফার্মেসি agent সম্পর্কে প্রশ্ন"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 bengali"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 bengali">বার্তা *</label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="আপনার প্রশ্ন বা পরামর্শ বাংলায় লিখুন..."
                  rows={5}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 resize-none bengali"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={sending}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                <span className="bengali">{sending ? 'পাঠানো হচ্ছে...' : 'বার্তা পাঠান'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
