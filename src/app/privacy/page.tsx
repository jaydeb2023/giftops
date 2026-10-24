import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How GiftOps by Evynta collects, uses and protects your data.',
  alternates: { canonical: 'https://giftops.evynta.in/privacy' },
}

const UPDATED = '24 October 2026'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-slate-800">
      <header className="border-b border-slate-200 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" aria-label="GiftOps home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/giftops-logo.png" alt="GiftOps by Evynta" className="h-12 w-auto" />
          </Link>
          <Link href="/" className="text-sm font-medium text-rv-700 hover:underline">&larr; Home</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {UPDATED}</p>

        <div className="mt-8 space-y-8 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold">Who we are</h2>
            <p className="mt-2">GiftOps is gift delivery business management software run by Evynta, an Indian AI, web and data solutions company. This policy explains what information we handle when you use giftops.evynta.in.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold">Information we collect</h2>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li><strong>Account details:</strong> your name, email address and, if you sign in with Google, your basic Google profile (name and email). We never see your Google password.</li>
              <li><strong>Business data you enter:</strong> leads, customers, orders, recipient names, mobile numbers and delivery addresses, invoices, payments and delivery photos.</li>
              <li><strong>Messages and calls:</strong> WhatsApp messages and call records that your company sends or receives through GiftOps.</li>
              <li><strong>Technical data:</strong> basic logs such as sign-in time, so we can keep the service secure and working.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-bold">How we use it</h2>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>To provide GiftOps to you and your team and to keep your account secure.</li>
              <li>To send the messages and make the calls your company asks GiftOps to send or make.</li>
              <li>To fix problems, improve the service and contact you about your account.</li>
            </ul>
            <p className="mt-2">We do not sell your data and we do not use your business data for advertising.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold">Your company's data stays separate</h2>
            <p className="mt-2">Each company has its own private workspace. People from other companies cannot see your data. Inside your company, access depends on the role each person has (admin, sales, operations, finance or rider).</p>
          </section>
          <section>
            <h2 className="text-xl font-bold">Service providers</h2>
            <p className="mt-2">We use trusted providers to run GiftOps, such as cloud hosting and database services, Google for sign-in, and messaging and calling providers that your company connects. They process data only to provide their service.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold">Keeping data safe and how long we keep it</h2>
            <p className="mt-2">Data is stored with access controls and encrypted connections. We keep your data while your account is active. You can ask us to export or delete your company's data at any time.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold">Recipient information</h2>
            <p className="mt-2">Your company is responsible for having the right to contact the recipients whose details it adds to GiftOps. Recipients who do not want to be contacted can ask the sending company, or write to us, and we will help.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold">Contact us</h2>
            <p className="mt-2">For any privacy question or to request deletion of data, use the contact form on our <Link href="/#contact" className="font-medium text-rv-700 hover:underline">home page</Link> and we will reply within one working day.</p>
          </section>
        </div>
      </main>
    </div>
  )
}
