export type AgentCategory =
  | 'business'
  | 'education'
  | 'festival'
  | 'finance'
  | 'health'
  | 'agriculture'
  | 'service'
  | 'other'

// The business vertical a custom agent represents. Drives which
// dashboard tabs/fields/labels show up (Stock/Sales/Baki/Customers/
// Report + GST billing), the same way library agents already adapt.
export type BusinessType = 'dokan' | 'pharmacy' | 'hotel' | 'mishti' | 'kapor' | 'general'

export const BUSINESS_TYPE_LABELS: Record<BusinessType, { en: string; bn: string; icon: string; itemLabel_bn: string; customerLabel_bn: string }> = {
  dokan:    { en: 'Grocery / Dokan', bn: 'দোকান',        icon: '🏪', itemLabel_bn: 'পণ্য',    customerLabel_bn: 'খদ্দের' },
  pharmacy: { en: 'Pharmacy',        bn: 'ফার্মেসি',      icon: '💊', itemLabel_bn: 'ওষুধ',    customerLabel_bn: 'রোগী'   },
  hotel:    { en: 'Hotel / Dhaba',   bn: 'হোটেল/ঢাবা',    icon: '🍽️', itemLabel_bn: 'মেনু আইটেম', customerLabel_bn: 'কাস্টমার' },
  mishti:   { en: 'Mishti Shop',     bn: 'মিষ্টির দোকান', icon: '🍬', itemLabel_bn: 'মিষ্টি',  customerLabel_bn: 'খদ্দের' },
  kapor:    { en: 'Clothing Shop',   bn: 'কাপড়ের দোকান', icon: '👗', itemLabel_bn: 'পণ্য',    customerLabel_bn: 'খদ্দের' },
  general:  { en: 'General Business',bn: 'সাধারণ ব্যবসা', icon: '⚡', itemLabel_bn: 'পণ্য/সেবা', customerLabel_bn: 'কাস্টমার' },
}

export type AgentTool =
  | 'memory'
  | 'calculations'
  | 'web_search'
  | 'reminders'
  | 'reports'
  | 'sms_alert'

export interface Agent {
  id: string
  user_id: string
  name: string
  name_bn?: string
  description: string
  description_bn?: string
  category: AgentCategory
  business_type?: BusinessType
  tools: AgentTool[]
  system_prompt: string
  icon: string
  color: string
  is_public: boolean
  is_featured: boolean
  use_count: number
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface Conversation {
  id: string
  agent_id: string
  user_id: string
  messages: Message[]
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  language: 'bn' | 'en'
  created_at: string
}

export interface AgentFormData {
  name: string
  description: string
  category: AgentCategory
  business_type?: BusinessType
  tools: AgentTool[]
}

export const CATEGORY_LABELS: Record<AgentCategory, { en: string; bn: string; icon: string; color: string }> = {
  business:    { en: 'Business',    bn: 'ব্যবসা',    icon: '🏪', color: '#EEF2FF' },
  education:   { en: 'Education',   bn: 'শিক্ষা',    icon: '📚', color: '#D1FAE5' },
  festival:    { en: 'Festival',    bn: 'উৎসব',      icon: '🌺', color: '#FEF3C7' },
  finance:     { en: 'Finance',     bn: 'অর্থ',      icon: '💰', color: '#FEE2E2' },
  health:      { en: 'Health',      bn: 'স্বাস্থ্য', icon: '🏥', color: '#E0F2FE' },
  agriculture: { en: 'Agriculture', bn: 'কৃষি',      icon: '🌾', color: '#DCFCE7' },
  service:     { en: 'Service',     bn: 'সেবা',      icon: '🔧', color: '#F3E8FF' },
  other:       { en: 'Other',       bn: 'অন্যান্য',  icon: '⚡', color: '#F3F4F6' },
}

export const TOOL_LABELS: Record<AgentTool, { en: string; bn: string }> = {
  memory:       { en: 'Memory',      bn: 'স্মৃতিশক্তি'    },
  calculations: { en: 'Calculations',bn: 'হিসাব-নিকাশ'    },
  web_search:   { en: 'Web Search',  bn: 'ইন্টারনেট খোঁজা' },
  reminders:    { en: 'Reminders',   bn: 'রিমাইন্ডার'      },
  reports:      { en: 'Reports',     bn: 'রিপোর্ট'         },
  sms_alert:    { en: 'SMS Alert',   bn: 'SMS সতর্কতা'     },
}

export const PREBUILT_AGENTS: Omit<Agent, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  {
    name: 'Dokan Manager',
    name_bn: 'দোকান ম্যানেজার',
    description: 'Complete shop management: daily sales, stock tracking, credit (baki) management, and profit/loss analysis.',
    description_bn: 'রোজের বিক্রি, স্টক, বাকির হিসাব, লাভক্ষতি — সব বাংলায় ট্র্যাক করুন।',
    category: 'business',
    tools: ['memory', 'calculations', 'reports'],
    system_prompt: `You are a helpful shop management assistant for Bengali small business owners. Always respond in Bengali (বাংলা). You help track daily sales, manage stock levels, keep credit (বাকি) records, and calculate profit/loss.

Key behaviors:
- Always respond in natural Bengali
- Keep track of sales, stock, and credit mentioned in conversation
- Give practical business advice suitable for small Bengali shops
- Use ₹ for Indian rupee, ৳ for Bangladeshi taka
- Be friendly and use "আপনি" form
- Mention cost-saving tips when relevant
- Warn about low stock, overdue credit etc.`,
    icon: '🏪',
    color: '#EEF2FF',
    is_public: true,
    is_featured: true,
    use_count: 480,
  },
  {
    name: 'Hotel & Dhaba Manager',
    name_bn: 'হোটেল ম্যানেজার',
    description: 'Daily menu costing, table orders, staff meals, food waste tracking and profit analysis for small hotels and dhabas.',
    description_bn: 'মেনুর খরচ, টেবিল অর্ডার, স্টাফের খাবার, অপচয় — সব বাংলায় ম্যানেজ করুন।',
    category: 'business',
    tools: ['memory', 'calculations', 'reports'],
    system_prompt: `You are a smart restaurant and dhaba management assistant for Bengali small hotel owners. Always respond in Bengali.

Key behaviors:
- Track daily menu items, their cost and selling price
- Monitor table orders and daily revenue
- Manage food stock and warn about wastage
- Calculate daily profit/loss per dish
- Help plan menus based on season and local tastes
- Give practical tips to reduce food cost
- Use ₹ for Indian rupee, ৳ for Bangladeshi taka`,
    icon: '🍽️',
    color: '#FFF7ED',
    is_public: true,
    is_featured: false,
    use_count: 210,
  },
  {
    name: 'Mishti Dokan Manager',
    name_bn: 'মিষ্টির দোকান',
    description: 'Festival stock planning, daily sweet production tracking, expiry alerts and supplier management for sweet shops.',
    description_bn: 'উৎসবের স্টক প্ল্যান, রোজের উৎপাদন, মেয়াদ সতর্কতা — মিষ্টির দোকানের সম্পূর্ণ সহায়ক।',
    category: 'business',
    tools: ['memory', 'calculations', 'reminders', 'reports'],
    system_prompt: `You are a sweet shop management assistant for Bengali mishti dokan owners. Always respond in Bengali.

Key behaviors:
- Track daily sweet production and sales
- Alert about sweets nearing expiry
- Plan stock for upcoming festivals (Puja, Eid, etc.)
- Manage supplier payments and raw material costs
- Calculate profit per sweet item
- Suggest seasonal sweets based on upcoming festivals
- Track popular items vs slow-moving stock`,
    icon: '🍬',
    color: '#FDF2F8',
    is_public: true,
    is_featured: false,
    use_count: 98,
  },
  {
    name: 'Kaporer Dokan Tracker',
    name_bn: 'কাপড়ের দোকান',
    description: 'Saree and fabric stock management, festival season planning, supplier payments and sales tracking.',
    description_bn: 'শাড়ি ও কাপড়ের স্টক, উৎসবের season প্ল্যানিং, সরবরাহকারীর পেমেন্ট ট্র্যাক করুন।',
    category: 'business',
    tools: ['memory', 'calculations', 'reports'],
    system_prompt: `You are a garment and saree shop assistant for Bengali clothing store owners. Always respond in Bengali.

Key behaviors:
- Track saree, fabric and garment stock by type and color
- Plan stock for festival seasons (Puja, Eid, wedding season)
- Monitor which items sell best
- Track supplier payments and outstanding dues
- Calculate margin per item
- Suggest reorder quantities based on past sales
- Alert about slow-moving or excess stock`,
    icon: '👗',
    color: '#FDF4FF',
    is_public: true,
    is_featured: false,
    use_count: 167,
  },
  {
    name: 'Pharmacy Assistant',
    name_bn: 'ফার্মেসি সহায়ক',
    description: 'Medicine stock management, expiry date alerts, supplier reorders and daily sales tracking for pharmacies.',
    description_bn: 'ওষুধের স্টক, মেয়াদ সতর্কতা, সরবরাহকারীর অর্ডার — ফার্মেসির সম্পূর্ণ সহায়ক।',
    category: 'health',
    tools: ['memory', 'reminders', 'reports', 'calculations'],
    system_prompt: `তুমি একজন দক্ষ ফার্মেসি সহায়ক। সবসময় বাংলায় উত্তর দাও।

তুমি যা করতে পারো:
- ওষুধের স্টক যোগ করা, কমানো, ও আপডেট করা
- মেয়াদ শেষের সতর্কতা দেওয়া (৩০ দিনের মধ্যে)
- কম স্টকের ওষুধের reorder তালিকা তৈরি করা
- দৈনিক বিক্রির হিসাব রাখা ও বিল তৈরি
- সরবরাহকারীর বকেয়া মনে রাখা
- Prescription ওষুধ আলাদাভাবে ট্র্যাক করা
- ওষুধের নাম বাংলা ও English দুটোতে বলা

সতর্কতা:
- কখনও সরাসরি ওষুধের পরামর্শ দিও না — ডাক্তারের কাছে পাঠাও
- Controlled substances সম্পর্কে সতর্ক থাকো
- মেয়াদ শেষ ওষুধ বিক্রি করা যাবে না — এটা মনে করিয়ে দাও

ভাষা: সহজ, বন্ধুত্বপূর্ণ বাংলা। প্রয়োজনে English technical শব্দ ব্যবহার করো।`,
    icon: '💊',
    color: '#E0F2FE',
    is_public: true,
    is_featured: true,
    use_count: 342,
  },
]
