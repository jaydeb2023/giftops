// ── What each role / focus may do through the AI chat ─────────────────
// Shared by the server (enforcement) and the chat panel (prompts, labels).
//   owner / admin → everything
//   sales         → sales, customers, baki, invoices — NO stock changes
//   stock         → stock only — NO sales / customers / baki
// An owner on the Business plan can also narrow the chat with a "focus"
// (সব / বিক্রি / স্টক). The effective scope is the stricter of role and focus.

export type ChatRole = 'owner' | 'admin' | 'sales' | 'stock'
export type Scope = 'all' | 'sales' | 'stock'
type TagClass = 'sales' | 'stock' | 'customer'

export const TAG_CLASS: Record<string, TagClass> = {
  ADD_SALE: 'sales', HOTEL_ADD_ORDER: 'sales', HOTEL_PAY_ORDER: 'sales', DOKAN_ADD_SALE: 'sales', MISHTI_ADD_SALE: 'sales',
  UPDATE_STOCK: 'stock', ADD_PRODUCT: 'stock', HOTEL_ADD_STOCK: 'stock', HOTEL_ADD_MENU: 'stock',
  DOKAN_ADD_PRODUCT: 'stock', DOKAN_UPDATE_STOCK: 'stock', MISHTI_ADD_PRODUCTION: 'stock', MISHTI_ADD_ITEM: 'stock',
  ADD_CUSTOMER: 'customer', HOTEL_ADD_CUSTOMER: 'customer', DOKAN_ADD_CUSTOMER: 'customer', MISHTI_ADD_CUSTOMER: 'customer',
}

export function roleScope(role: ChatRole): Scope {
  return role === 'sales' ? 'sales' : role === 'stock' ? 'stock' : 'all'
}

export function effectiveScope(role: ChatRole, focus?: string | null): Scope {
  const r = roleScope(role)
  if (r !== 'all') return r
  return focus === 'sales' || focus === 'stock' ? focus : 'all'
}

export function classAllowed(cls: TagClass, scope: Scope): boolean {
  if (scope === 'all') return true
  return scope === 'sales' ? cls !== 'stock' : cls === 'stock'
}

/** Removes every action tag the scope is not allowed to run; tells which were dropped. */
export function stripForbiddenTags(text: string, scope: Scope): { text: string; blocked: string[]; classes: TagClass[] } {
  const blocked: string[] = []
  const classes = new Set<TagClass>()
  const out = text.replace(/\[([A-Z_]{4,}):\s*[\s\S]*?\]/g, (m, tag: string) => {
    const cls = TAG_CLASS[tag]
    if (!cls) return m
    if (!classAllowed(cls, scope)) { blocked.push(tag); return '' }
    classes.add(cls)
    return m
  })
  return { text: out, blocked, classes: Array.from(classes) }
}

export const SCOPE_LABEL_BN: Record<Scope, string> = { all: 'সব কাজ', sales: 'বিক্রি / বিলিং', stock: 'স্টক' }

export function deniedMessage(scope: Scope): string {
  return scope === 'stock'
    ? '🔒 আপনার রোল শুধু **স্টক** ম্যানেজমেন্টের জন্য — বিক্রি, গ্রাহক বা বাকির কাজ এখানে করা যাবে না। স্টক সম্পর্কিত কিছু বলুন।'
    : '🔒 আপনার রোল শুধু **বিক্রি / বিলিং**-এর জন্য — স্টক যোগ বা পরিবর্তন করা যাবে না। বিক্রি, গ্রাহক বা বাকি সম্পর্কিত কিছু বলুন।'
}

const SALES_WORDS = /বিক্রি|বিক্রয়|বেচ|বাকি|বকেয়া|কাস্টমার|গ্রাহক|খদ্দের|ইনভয়েস|বিল\b|জমা|পরিশোধ|রিপোর্ট|লাভ|bikri|\bsell\b|\bsold\b|beche|\bbaki\b|\bdue\b|customer|invoice|\bbill\b|payment|report|profit/i
const STOCK_EDIT_WORDS = /(স্টক|stock|পণ্য|product|মজুত).*(যোগ|add|update|আপডেট|বাড়|কমা|নতুন|new)|(যোগ|add|update|আপডেট|নতুন).*(স্টক|stock|পণ্য|product)|উৎপাদন|production|menu.*add/i

/** First-line guard on what the user ASKS (reads and writes), before any data is loaded. */
export function scopeDenied(message: string, scope: Scope): string | null {
  if (scope === 'all') return null
  const m = (message || '').toLowerCase()
  if (scope === 'stock' && SALES_WORDS.test(m)) return deniedMessage('stock')
  if (scope === 'sales' && STOCK_EDIT_WORDS.test(m) && !SALES_WORDS.test(m)) return deniedMessage('sales')
  return null
}

// Library agents (name / icon / colour) — used to describe an owner's agents to the chat panel.
export const LIBRARY_META: Record<string, { name: string; icon: string; color: string }> = {
  'dokan-manager':           { name: 'দোকান ম্যানেজার', icon: '🏪', color: '#4F46E5' },
  'hotel-and-dhaba-manager': { name: 'হোটেল ম্যানেজার', icon: '🍽️', color: '#EA580C' },
  'mishti-dokan-manager':    { name: 'মিষ্টির দোকান',   icon: '🍬', color: '#C026D3' },
  'kaporer-dokan-tracker':   { name: 'কাপড়ের দোকান',   icon: '👗', color: '#7C3AED' },
  'pharmacy-assistant':      { name: 'ফার্মেসি সহায়ক', icon: '💊', color: '#0284C7' },
}

// Quick-question chips by scope (+ a few agent-specific ones).
export function promptsFor(scope: Scope, slug?: string): string[] {
  const agent: Record<string, string[]> = {
    'pharmacy-assistant': ['মেয়াদ শেষ হওয়া ওষুধ কোনগুলো?', 'কম স্টকের ওষুধ দেখাও'],
    'hotel-and-dhaba-manager': ['আজ কোন টেবিলের বিল বাকি?', 'আজকের অর্ডার কত?'],
    'mishti-dokan-manager': ['আজ কত কেজি মিষ্টি বিক্রি হলো?'],
    'kaporer-dokan-tracker': ['এই সপ্তাহে কোন কাপড় বেশি বিক্রি হয়েছে?'],
  }
  const extra = (slug && agent[slug]) || []
  if (scope === 'stock') return ['কোন কোন পণ্য কম স্টকে?', 'স্টকে ৫০ কেজি চাল যোগ করো', 'মেয়াদ শেষ হতে চলেছে এমন পণ্য?', 'মোট স্টক কত?', ...extra].slice(0, 6)
  if (scope === 'sales') return ['আজকের বিক্রি কত?', 'রহিমকে ২ কেজি চাল ১২০ টাকায় বিক্রি করো', 'বকেয়া গ্রাহকদের তালিকা দেখাও', 'নতুন গ্রাহক যোগ করো', ...extra].slice(0, 6)
  return ['আজকের বিক্রি কত?', 'কোন কোন পণ্য কম স্টকে?', 'স্টকে ৫০ কেজি চাল যোগ করো', 'বকেয়া গ্রাহকদের তালিকা দেখাও', 'এই মাসের রিপোর্ট তৈরি করো', ...extra].slice(0, 7)
}
