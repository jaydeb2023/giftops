import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight, BarChart3, Building2, Camera, ClipboardCheck, FileSpreadsheet, Gift, IndianRupee, Inbox, MessageCircle,
  Package, PlayCircle, Receipt, ShieldCheck, Truck, UserPlus, Users, Phone, Boxes, Wallet, Bot, Globe, Database, Check,
} from 'lucide-react'
import SiteHeader from '@/components/site/SiteHeader'
import ContactForm from '@/components/site/ContactForm'
import { LogoMark } from '@/components/rv/Logo'

export const metadata: Metadata = {
  title: 'GiftOps by Evynta | Gift delivery management system',
  description: 'One system for your entire gift business: leads, orders, bulk recipients, address follow-up, packing, delivery with photo proof, GST invoices, payments and profit reports. Built in India by Evynta.',
  alternates: { canonical: 'https://giftops.evynta.in' },
  robots: { index: true, follow: true },
  openGraph: { title: 'GiftOps by Evynta', description: 'From first enquiry to final payment. One system for your entire gift business.', url: 'https://giftops.evynta.in', siteName: 'GiftOps', images: [{ url: '/giftops-hero.webp' }] },
}

const QUICK = [
  { icon: Users, label: 'Manage Leads & Orders', tone: 'bg-rose-100 text-rose-700' },
  { icon: FileSpreadsheet, label: 'Bulk Recipient Upload', tone: 'bg-sky-100 text-sky-700' },
  { icon: MessageCircle, label: 'Automated Address Follow-up', tone: 'bg-emerald-100 text-emerald-700' },
  { icon: Package, label: 'Packing & Delivery Tracking', tone: 'bg-orange-100 text-orange-700' },
  { icon: Receipt, label: 'GST Invoices & Payments', tone: 'bg-violet-100 text-violet-700' },
  { icon: BarChart3, label: 'Live Reports', tone: 'bg-rose-100 text-rose-700' },
]

const TRUST = [
  { icon: Building2, text: 'Made for growing gifting businesses' },
  { icon: Gift, text: 'Ideal for Corporate Gifting & Festival Hampers' },
  { icon: Users, text: 'Upload hundreds of recipients from one Excel file' },
  { icon: ShieldCheck, text: 'Save time, reduce errors and see your profit' },
  { icon: IndianRupee, text: 'Built in India by Evynta' },
]

const STEPS = [
  { icon: Phone, title: 'Get Enquiries', text: 'From website, WhatsApp, Instagram, phone or Excel.' },
  { icon: Users, title: 'Win the Order', text: 'Convert leads to customers and create orders.' },
  { icon: FileSpreadsheet, title: 'Upload Recipients', text: 'Add hundreds of names and addresses via Excel.' },
  { icon: Package, title: 'Pack & Deliver', text: 'Track packing, assign riders and get photo proof.' },
  { icon: Receipt, title: 'Bill & Get Paid', text: 'Generate GST invoice and record payments.' },
  { icon: BarChart3, title: 'See Profit', text: 'Reports to know what you earned and who owes.' },
]

const FEATURES = [
  { icon: UserPlus, title: 'Leads from every channel', text: 'Website form, WhatsApp, Instagram, Facebook, phone and Excel all land in one list, with no duplicates and follow-up reminders.' },
  { icon: FileSpreadsheet, title: 'Bulk recipient upload', text: 'One order, hundreds of recipients. Upload an Excel file, see errors before importing, and track every gift separately.' },
  { icon: MessageCircle, title: 'Automatic address follow-up', text: 'Missing address? The system asks on WhatsApp, then an AI call, then gives your team a call task. A person confirms every address.' },
  { icon: Boxes, title: 'Vendors & purchases', text: 'Know what you bought for each order, what it cost and what has arrived.' },
  { icon: ClipboardCheck, title: 'Packing & quality check', text: 'A simple checklist for the packing table, so nothing leaves the shop unchecked.' },
  { icon: Truck, title: 'Delivery runs & rider app', text: 'Plan runs, give each rider a phone page with call, map and delivered buttons.' },
  { icon: Camera, title: 'Photo proof of delivery', text: 'Riders take a photo at the door. Failed deliveries become tasks automatically.' },
  { icon: Receipt, title: 'GST invoices & payments', text: 'CGST/SGST or IGST worked out for you. Print or save as PDF, issue credit notes, record payments without double entry.' },
  { icon: Wallet, title: 'Bills, expenses & reports', text: 'See profit on every order, who owes you, who you owe, and download everything to Excel.' },
]

const SERVICES = [
  { icon: Bot, title: 'AI Solutions', text: 'WhatsApp and calling assistants, lead follow-up and smart automation that save your team hours every day.', points: ['WhatsApp & AI calling', 'Chatbots for enquiries', 'Workflow automation'] },
  { icon: Globe, title: 'Web Development', text: 'Fast, good-looking websites and web apps for your business, built to bring in enquiries and orders.', points: ['Business websites', 'Custom web apps', 'SEO & hosting setup'] },
  { icon: Database, title: 'Data Solutions', text: 'Bring your Excel sheets and scattered records into one clean system with dashboards you can trust.', points: ['Excel to system migration', 'Reports & dashboards', 'Data clean-up'] },
]

// EDIT YOUR PRICES HERE (shown on the home page). Set `price` to '' to show "Custom".
const PLANS = [
  { name: 'Starter', price: '1,999', note: 'For small gifting shops getting started', cta: 'Start free trial', featured: false,
    items: ['Up to 3 team logins', 'Leads, customers & orders', 'Bulk recipient upload (Excel)', 'GST invoices & payments', 'Email support'] },
  { name: 'Growth', price: '4,999', note: 'For busy teams with festival-season volume', cta: 'Start free trial', featured: true,
    items: ['Up to 10 team logins', 'Everything in Starter', 'Auto address follow-up (WhatsApp + AI call)', 'Packing, delivery runs & rider app', 'Photo proof of delivery', 'Priority support'] },
  { name: 'Business', price: '', note: 'For large operations and multiple branches', cta: 'Talk to us', featured: false,
    items: ['Unlimited team logins', 'Everything in Growth', 'Your own web address', 'Custom setup & data migration', 'Team training', 'Dedicated support'] },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <SiteHeader />

      {/* HERO */}
      <section id="home" className="relative overflow-hidden bg-gradient-to-br from-rv-50 via-white to-rv-50">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-10 pt-10 sm:px-6 lg:grid-cols-[1fr_1fr] lg:pt-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-rv-100 px-4 py-2 text-sm font-semibold text-rv-700"><Gift className="h-4 w-4" />All-in-One Gift Delivery Management System</span>
            <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-[68px]">
              <span className="relative inline-block text-rv-700">GiftOps
                <svg viewBox="0 0 300 14" className="absolute -bottom-2 left-0 h-3 w-full text-rv-700" preserveAspectRatio="none" aria-hidden><path d="M2 9 C 60 2, 150 2, 298 8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>
              </span>{' '}
              <span className="text-slate-900">by Evynta</span>
            </h1>
            <p className="mt-8 text-3xl font-extrabold leading-tight text-slate-900 lg:text-[28px] xl:text-[32px]">From first enquiry to final payment.<br />One system for your entire gift business.</p>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">Manage leads, customers, bulk recipients, packing, deliveries, GST invoices and payments, all in one place. Built for corporate gifting, festival hampers and bulk orders.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#contact" className="inline-flex items-center gap-3 rounded-xl bg-rv-700 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-rv-700/20 transition hover:bg-rv-800">Get Started <ArrowRight className="h-5 w-5" /></a>
              <a href="#how-it-works" className="inline-flex items-center gap-3 rounded-xl border-2 border-rv-700 bg-white px-8 py-4 text-lg font-semibold text-rv-700 transition hover:bg-rv-50"><PlayCircle className="h-6 w-6" />See how it works</a>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-6">
              {QUICK.map(q => (
                <div key={q.label} className="flex flex-col items-center text-center">
                  <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${q.tone}`}><q.icon className="h-7 w-7" /></span>
                  <span className="mt-2 text-[13px] font-medium leading-tight text-slate-700">{q.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/giftops-hero.webp" alt="GiftOps dashboard on laptop and phone, with gift boxes" className="relative mx-auto w-full max-w-[760px] drop-shadow-xl lg:-mr-24 lg:w-[118%] lg:max-w-none xl:-mr-32 xl:w-[122%]" width={1400} height={933} fetchPriority="high" />
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-y border-rv-100 bg-rv-50/60">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-7 sm:grid-cols-2 sm:px-6 lg:grid-cols-5">
          {TRUST.map(t => (
            <div key={t.text} className="flex items-center gap-3">
              <t.icon className="h-9 w-9 shrink-0 text-rv-700" />
              <span className="text-[15px] font-medium leading-snug text-slate-700">{t.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl text-center">
          <div className="flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-rv-700"><span>How it works</span><span className="h-px w-10 bg-rv-700" /></div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">A simple flow for your entire gift business</h2>
          <p className="mt-3 text-lg text-slate-500">From enquiry to delivery and payment, everything in one system.</p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-6">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative flex flex-col items-center text-center">
                <div className="relative">
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-rv-50 text-rv-700 ring-1 ring-rv-100"><s.icon className="h-9 w-9" /></span>
                  <span className="absolute -left-2 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-rv-100 text-sm font-bold text-rv-700">{i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-1 max-w-[220px] text-[15px] leading-snug text-slate-500">{s.text}</p>
                {i < STEPS.length - 1 && <ArrowRight className="absolute -right-5 top-7 hidden h-5 w-5 text-rv-300 lg:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="scroll-mt-20 bg-rv-50/50 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-rv-700">Features</div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Everything your gifting team does, in one place</h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(f => (
              <div key={f.title} className="rounded-2xl border border-rv-100 bg-white p-6 shadow-sm transition hover:shadow-md">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rv-100 text-rv-700"><f.icon className="h-6 w-6" /></span>
                <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 leading-relaxed text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">WhatsApp, AI calling and Instagram/Facebook connections are set up with your own accounts. We help you connect them.</p>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-rv-700">Our services</div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">AI, Web and Data solutions from Evynta</h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-500">GiftOps is built by Evynta. Beyond the software, we help your business grow with three core services.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {SERVICES.map(s => (
              <div key={s.title} className="rounded-2xl border border-rv-100 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rv-100 text-rv-700"><s.icon className="h-7 w-7" /></span>
                <h3 className="mt-5 text-xl font-bold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-slate-600">{s.text}</p>
                <ul className="mt-4 space-y-2">
                  {s.points.map(x => <li key={x} className="flex items-center gap-2 text-[15px] font-medium text-slate-700"><Check className="h-4 w-4 text-rv-700" />{x}</li>)}
                </ul>
                <a href="#contact" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-rv-700 hover:underline">Ask about this <ArrowRight className="h-4 w-4" /></a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="scroll-mt-20 bg-rv-50/50 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-rv-700">Pricing</div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Simple and fair, sized to your business</h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-slate-600">Every plan starts with a 14-day free trial. No card needed. Prices are per month, excluding GST.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PLANS.map(pl => (
              <div key={pl.name} className={`relative flex flex-col rounded-2xl bg-white p-7 shadow-sm ${pl.featured ? 'border-2 border-rv-700 shadow-lg md:-mt-3 md:pb-10' : 'border border-rv-100'}`}>
                {pl.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-rv-700 px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">Most popular</span>}
                <h3 className="text-xl font-bold">{pl.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{pl.note}</p>
                <div className="mt-5 flex items-end gap-1">
                  {pl.price ? <><span className="text-4xl font-extrabold text-rv-800">&#8377;{pl.price}</span><span className="pb-1 text-slate-500">/month</span></> : <span className="text-4xl font-extrabold text-rv-800">Custom</span>}
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {pl.items.map(x => <li key={x} className="flex items-start gap-2 text-[15px] text-slate-700"><Check className="mt-0.5 h-5 w-5 shrink-0 text-rv-700" />{x}</li>)}
                </ul>
                {pl.price
                  ? <Link href="/app/login?mode=signup" className={`mt-8 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold transition ${pl.featured ? 'bg-rv-700 text-white hover:bg-rv-800' : 'border-2 border-rv-700 text-rv-700 hover:bg-rv-50'}`}>{pl.cta} <ArrowRight className="h-5 w-5" /></Link>
                  : <a href="#contact" className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-rv-700 px-6 py-3.5 font-semibold text-rv-700 transition hover:bg-rv-50">{pl.cta} <ArrowRight className="h-5 w-5" /></a>}
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">One-time setup and training are quoted separately. WhatsApp and AI calling use your own provider accounts.</p>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="scroll-mt-20 bg-slate-900 px-4 py-20 text-white sm:px-6">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[1fr_auto]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-rv-300">About</div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Built in India by Evynta</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-300">Evynta is an AI, web and data solutions company. GiftOps was designed around how real gifting businesses work: lots of recipients, last-minute address changes, riders on the road and GST paperwork at the end. It replaces scattered chats and spreadsheets with one clear system.</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/evynta-logo-light.png" alt="Evynta" className="h-24 w-auto md:h-28" />
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="scroll-mt-20 bg-gradient-to-br from-rv-50 to-white px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-rv-700">Contact</div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">See GiftOps on your own orders</h2>
            <p className="mt-4 text-lg text-slate-600">Leave your details and we will call you to show a live demo and share a quote. No payment needed to talk.</p>
            <ul className="mt-6 space-y-3 text-slate-700">
              <li className="flex items-center gap-3"><Inbox className="h-5 w-5 text-rv-700" />We reply within one working day</li>
              <li className="flex items-center gap-3"><Phone className="h-5 w-5 text-rv-700" />Demo on a call or on screen share</li>
            </ul>
          </div>
          <ContactForm />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5"><LogoMark size={32} /><span className="text-lg font-extrabold text-rv-700">GiftOps</span><span className="text-xs uppercase tracking-[0.2em] text-slate-500">by Evynta</span></div>
          <div className="flex items-center gap-5 text-sm text-slate-500">
            <Link href="/app/login" className="hover:text-rv-700">Login</Link>
            <a href="#contact" className="hover:text-rv-700">Contact</a>
            <span>&copy; {new Date().getFullYear()} Evynta. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
