import Link from 'next/link'
import {
  Bot, Package, ShoppingCart, Users, LayoutGrid, BarChart3, FileText, NotebookPen,
  Truck, Lock, Check, Crown, UserCog, ShieldCheck, GitBranch, Headphones, MessageCircle,
} from 'lucide-react'

const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '919477581817' // TODO: replace with your real support number

type Feature = { icon: any; text: string; locked?: boolean }

const PLANS: {
  id: string; name: string; tab: string; tagline: string; tabColor: string
  price: string | null; popular: boolean; dark?: boolean; features: Feature[]
}[] = [
  {
    id: 'basic', name: 'Basic', tab: 'ক', tagline: 'ছোট দোকান শুরু করার জন্য',
    tabColor: '#8A6A2E', price: '৯৯', popular: false,
    features: [
      { icon: Bot,          text: '১টি এজেন্ট' },
      { icon: Package,      text: 'স্টক ম্যানেজমেন্ট' },
      { icon: ShoppingCart, text: 'বিক্রি (সেলস) ট্র্যাকিং' },
      { icon: Users,        text: 'গ্রাহক ম্যানেজমেন্ট' },
      { icon: Lock,         text: 'ক্যাটালগ ও রিপোর্ট', locked: true },
      { icon: Lock,         text: 'ইনভয়েস ও নোটবুক', locked: true },
      { icon: Lock,         text: 'ডিস্ট্রিবিউটর ম্যানেজমেন্ট', locked: true },
    ],
  },
  {
    id: 'starter', name: 'Starter', tab: 'খ', tagline: 'বেড়ে ওঠা ব্যবসার জন্য',
    tabColor: '#9C2B34', price: '১৯৯', popular: true,
    features: [
      { icon: Bot,          text: 'সর্বোচ্চ ৩টি এজেন্ট' },
      { icon: Package,      text: 'স্টক ম্যানেজমেন্ট' },
      { icon: ShoppingCart, text: 'সেলস ট্র্যাকিং' },
      { icon: LayoutGrid,   text: 'প্রোডাক্ট ক্যাটালগ' },
      { icon: Users,        text: 'গ্রাহক ম্যানেজমেন্ট' },
      { icon: BarChart3,    text: 'রিপোর্ট' },
      { icon: FileText,     text: 'ইনভয়েস ও বিলিং' },
      { icon: NotebookPen,  text: 'নোটবুক' },
      { icon: Truck,        text: 'ডিস্ট্রিবিউটর ম্যানেজমেন্ট' },
    ],
  },
  {
    id: 'business', name: 'Enterprise', tab: 'গ', tagline: 'বড় ব্যবসা ও টিমের জন্য',
    tabColor: '#5B2A1E', price: null, popular: false, dark: true,
    features: [
      { icon: Crown,       text: 'সব অ্যাডভান্সড ফিচারের পূর্ণ অ্যাক্সেস' },
      { icon: Bot,         text: 'আনলিমিটেড এজেন্ট ও কাস্টম এজেন্ট বিল্ড' },
      { icon: UserCog,     text: 'টিম অনুযায়ী আলাদা কর্মী — সেলস, স্টক ইত্যাদি' },
      { icon: ShieldCheck, text: 'মেইন অ্যাডমিনের হাতে সব নিয়ন্ত্রণ' },
      { icon: GitBranch,   text: 'মাল্টি-ব্রাঞ্চ সাপোর্ট' },
      { icon: Headphones,  text: 'প্রায়োরিটি সাপোর্ট ও ডেডিকেটেড টিম' },
      { icon: MessageCircle, text: 'আরও অনেক কিছু — আমাদের টিমের সঙ্গে কথা বলুন' },
    ],
  },
]

// Palette drawn from the জামা কাপড়ে বাঁধা লাল খাতা — the red cloth-bound
// ledger every Bengali shopkeeper keeps under the counter — rather than a
// generic SaaS card grid. Cover = deep oxblood cloth; each plan is a page
// stitched into it, with a brass thread rule and an ink-stamp for the
// recommended plan. Enterprise is the dark "owner's copy" page.
const COVER = '#521019'
const COVER_DEEP = '#350A10'
const PAGE = '#F2E6C7'
const PAGE_STARTER = '#F7EEDA'
const INK = '#2C1B12'
const INK_FADE = '#8A7458'
const BRASS = '#A9812F'
const BRASS_LIGHT = '#E3C277'
const STAMP = '#9C2B34'

export default function PricingSection() {
  return (
    <section
      className="py-20 px-4 relative overflow-hidden"
      style={{ background: `linear-gradient(155deg, ${COVER} 0%, ${COVER_DEEP} 100%)` }}
    >
      {/* cloth weave texture */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(45deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)',
      }} />
      {/* soft brass glow behind the recommended plan */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[620px] rounded-full pointer-events-none opacity-25"
        style={{ background: `radial-gradient(circle, ${BRASS} 0%, transparent 65%)` }} />

      <div className="max-w-5xl mx-auto relative">

        <div className="text-center mb-14">
          <span className="inline-block text-[11px] tracking-wide px-3 py-1 rounded-full mb-4 bengali"
            style={{ color: '#E8D9AE', border: `1px solid ${BRASS}66` }}>
            সাহায্যকারীর হিসাবের খাতা
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold mb-3 bengali" style={{ color: PAGE }}>
            আপনার দোকানের জন্য একটা পাতা বেছে নিন
          </h2>
          <p className="bengali max-w-md mx-auto" style={{ color: '#C9B98F' }}>
            ব্যবসার আকার অনুযায়ী প্ল্যান বেছে নিন। ৭ দিনের ফ্রি ট্রায়াল সহ, কোনো কার্ড লাগবে না।
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {PLANS.map((p, i) => {
            const dark = !!p.dark
            const text = dark ? PAGE : '#4A3928'
            return (
              <div key={i}
                className={`relative rounded-md pt-9 pb-6 px-6 flex flex-col ${p.popular ? 'md:-my-4 md:py-11' : ''}`}
                style={{
                  backgroundColor: dark ? INK : p.popular ? PAGE_STARTER : PAGE,
                  boxShadow: p.popular
                    ? `0 24px 44px -14px rgba(0,0,0,0.6), 0 0 0 2px ${BRASS}`
                    : dark
                      ? `0 14px 28px -16px rgba(0,0,0,0.7), 0 0 0 1px ${BRASS}88`
                      : '0 14px 28px -16px rgba(0,0,0,0.5)',
                }}>

                {/* stitched top edge, binding the page into the cover */}
                <div className="absolute top-0 left-4 right-4 h-px" style={{
                  backgroundImage: `repeating-linear-gradient(90deg, ${BRASS} 0px, ${BRASS} 5px, transparent 5px, transparent 10px)`,
                }} />

                {/* index tab */}
                <div className="absolute -top-3.5 left-6 w-7 h-7 rounded-sm flex items-center justify-center bengali text-xs font-bold shadow-sm"
                  style={{ backgroundColor: dark ? BRASS : p.tabColor, color: dark ? INK : PAGE }}>
                  {p.tab}
                </div>

                {p.popular && (
                  <div className="absolute -top-5 -right-3 w-16 h-16 rounded-full flex items-center justify-center text-center leading-tight rotate-[9deg] select-none"
                    style={{
                      color: '#F4EAD2',
                      backgroundColor: STAMP,
                      boxShadow: `0 0 0 1.5px ${STAMP}, 0 0 0 3px ${PAGE_STARTER}, 0 3px 8px rgba(0,0,0,0.35)`,
                    }}>
                    <span className="text-[9px] font-bold bengali">সেরা<br/>পছন্দ</span>
                  </div>
                )}

                <h3 className="font-extrabold text-lg mb-0.5" style={{ color: dark ? BRASS_LIGHT : INK }}>{p.name}</h3>
                <p className="text-[12px] bengali mb-3" style={{ color: dark ? '#C9B98F' : INK_FADE }}>{p.tagline}</p>
                <div className="w-8 h-[2px] mb-4" style={{ backgroundColor: dark ? BRASS : p.tabColor }} />

                <div className="mb-6 flex items-baseline gap-1.5 min-h-[44px]">
                  {p.price ? (
                    <>
                      <span className="text-4xl font-extrabold tabular-nums bengali" style={{ color: INK }}>₹{p.price}</span>
                      <span className="text-xs bengali" style={{ color: INK_FADE }}>/মাস</span>
                    </>
                  ) : (
                    <span className="text-2xl font-extrabold bengali" style={{ color: PAGE }}>কাস্টম প্রাইসিং</span>
                  )}
                </div>

                <ul className="space-y-3 mb-7 flex-1">
                  {p.features.map((f, j) => {
                    const Icon = f.icon
                    return (
                      <li key={j} className="flex items-start gap-2.5 text-[13px] bengali leading-snug"
                        style={{ color: f.locked ? `${INK_FADE}` : text, opacity: f.locked ? 0.75 : 1 }}>
                        <span className="mt-[1px] flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{
                            backgroundColor: f.locked ? 'transparent' : dark ? `${BRASS}33` : p.popular ? `${STAMP}18` : `${p.tabColor}1F`,
                            color: f.locked ? INK_FADE : dark ? BRASS_LIGHT : p.popular ? STAMP : p.tabColor,
                          }}>
                          <Icon size={12} strokeWidth={2.4} />
                        </span>
                        <span className={f.locked ? 'line-through decoration-[1px]' : ''}>{f.text}</span>
                      </li>
                    )
                  })}
                </ul>

                {p.id === 'business' ? (
                  <a href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('আমি SahayakAI Enterprise প্ল্যান সম্পর্কে জানতে চাই')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="block text-center py-3 rounded-md text-sm font-bold transition-opacity hover:opacity-90 bengali"
                    style={{ backgroundColor: BRASS_LIGHT, color: INK }}>
                    আমাদের টিমের সঙ্গে কথা বলুন
                  </a>
                ) : (
                  <Link href={`/subscribe?plan=${p.id}`}
                    className="block text-center py-3 rounded-md text-sm font-bold transition-opacity hover:opacity-90 bengali"
                    style={{ backgroundColor: p.popular ? STAMP : INK, color: PAGE }}>
                    শুরু করুন
                  </Link>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-center text-[12px] bengali mt-12 flex items-center justify-center gap-1.5" style={{ color: '#C9B98F' }}>
          <Check size={13} /> যেকোনো সময় বাতিল করা যাবে &nbsp;·&nbsp; UPI / কার্ডে নিরাপদ পেমেন্ট
        </p>
      </div>
    </section>
  )
}
