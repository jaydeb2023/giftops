import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Sahayak AI',
  description: 'Sahayak AI গোপনীয়তা নীতি',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-12">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
            <p className="text-gray-500 bengali">গোপনীয়তা নীতি</p>
            <p className="text-xs text-gray-400 mt-2">Last updated: April 2026</p>
          </div>

          <div className="space-y-8 text-[15px] leading-relaxed">

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">1. Information We Collect</h2>
              <div className="text-gray-600 space-y-2">
                <p><strong>Account information:</strong> Your email address and name when you sign up or log in via Google.</p>
                <p><strong>Business data:</strong> Sales records, expenses, credit entries, and stock information you enter into the dashboard.</p>
                <p><strong>Conversation data:</strong> Your chat messages with AI agents, used to provide responses and improve our service.</p>
                <p><strong>Usage data:</strong> Which features you use, how often, and from which region — to improve the product.</p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">2. How We Use Your Information</h2>
              <ul className="list-disc pl-5 text-gray-600 space-y-2">
                <li>To provide and improve the Sahayak AI service</li>
                <li>To generate your business reports and analytics</li>
                <li>To train and improve our Bengali AI models (anonymized only)</li>
                <li>To send important service notifications (not marketing spam)</li>
                <li>To prevent fraud and ensure platform security</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">3. Data Storage & Security</h2>
              <p className="text-gray-600">Your data is stored securely on Supabase servers with Row Level Security (RLS) enabled. This means only you can access your own data. We use industry-standard encryption for data in transit and at rest.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">4. We Never Sell Your Data</h2>
              <p className="text-gray-600 bengali font-semibold text-indigo-700">আমরা কখনো আপনার ব্যক্তিগত বা ব্যবসায়িক তথ্য তৃতীয় পক্ষের কাছে বিক্রি করি না।</p>
              <p className="text-gray-600 mt-2">We do not sell, rent, or trade your personal or business data to any third party for any purpose.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">5. Third-Party Services</h2>
              <p className="text-gray-600">We use the following trusted third-party services:</p>
              <ul className="list-disc pl-5 text-gray-600 space-y-1 mt-2">
                <li><strong>Supabase</strong> — database and authentication</li>
                <li><strong>Groq</strong> — AI inference (your messages are processed here)</li>
                <li><strong>Google OAuth</strong> — optional login method</li>
                <li><strong>Netlify</strong> — hosting</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">6. Your Rights</h2>
              <ul className="list-disc pl-5 text-gray-600 space-y-2">
                <li>You can request a copy of all data we hold about you.</li>
                <li>You can request deletion of your account and all associated data.</li>
                <li>You can opt out of any non-essential communications at any time.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">7. Cookies</h2>
              <p className="text-gray-600">We use essential cookies only — for authentication and session management. We do not use advertising or tracking cookies.</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-gray-900 mb-3">8. Contact</h2>
              <p className="text-gray-600">For privacy-related requests or questions, contact us at our <a href="/contact" className="text-indigo-600 hover:underline">contact page</a>.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
