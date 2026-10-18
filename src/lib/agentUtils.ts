// src/lib/agentUtils.ts
import { AgentCategory, AgentTool, AgentFormData } from '@/types'

// ── Business template definitions ────────────────────────────────
export interface BusinessTemplate {
  id: string
  name: string
  name_bn: string
  icon: string
  emoji: string
  category: AgentCategory
  accent: string
  light: string
  description_bn: string
  defaultTools: AgentTool[]
  stockCategories: string[]
  samplePrompts: string[]
  systemContext: string
}

export const BUSINESS_TEMPLATES: BusinessTemplate[] = [
  // ── Already have full library ──
  {
    id: 'dokan',
    name: 'Kirana / General Store',
    name_bn: 'মুদিখানা / জেনারেল স্টোর',
    icon: '🏪', emoji: '🛒',
    category: 'business',
    accent: '#4F46E5', light: '#EEF2FF',
    description_bn: 'চাল, ডাল, তেল, মশলা — রোজের স্টক, বিক্রি, বাকির হিসাব সব বাংলায়।',
    defaultTools: ['memory', 'calculations', 'reports'],
    stockCategories: ['চাল-ডাল', 'তেল-মশলা', 'আটা-ময়দা', 'চা-চিনি', 'সাবান-শ্যাম্পু', 'বিস্কুট', 'সবজি'],
    samplePrompts: ['আজ ৫ কেজি চাল বিক্রি হয়েছে ৬৫ টাকায়', 'চালের স্টক কত আছে?', 'রামবাবুর বাকি কত?'],
    systemContext: 'মুদিখানা / কিরানা দোকান। কেজি/লিটার/পিস হিসাবে বিক্রি হয়। বাকি রাখা, পাইকারি দরে কেনা ও খুচরায় বিক্রি করা হয়।',
  },
  {
    id: 'tailoring',
    name: 'Tailoring Shop',
    name_bn: 'টেইলারিং / দর্জি দোকান',
    icon: '🧵', emoji: '✂️',
    category: 'business',
    accent: '#BE185D', light: '#FCE7F3',
    description_bn: 'অর্ডার ট্র্যাকিং, কাপড়ের হিসাব, delivery date, মাপের রেকর্ড — সব বাংলায়।',
    defaultTools: ['memory', 'reminders', 'reports'],
    stockCategories: ['কাপড়', 'বোতাম-জিপার', 'সুতো', 'আস্তর'],
    samplePrompts: ['রামবাবুর পাঞ্জাবির order নিয়েছি, delivery ১৫ দিনে', 'আজকের orders কী কী আছে?', 'রিমা দিদির মাপ কত ছিল?'],
    systemContext: 'টেইলারিং / দর্জির দোকান। প্রতিটি অর্ডারে খদ্দেরের নাম, মাপ, কাপড়ের ধরন, delivery date, advance payment এবং balance track করতে হয়। মাপের রেকর্ড ভবিষ্যতের জন্য সংরক্ষণ করতে হয়।',
  },
  {
    id: 'mobile_repair',
    name: 'Mobile Repair Shop',
    name_bn: 'মোবাইল সার্ভিসিং সেন্টার',
    icon: '📱', emoji: '🔧',
    category: 'business',
    accent: '#0369A1', light: '#E0F2FE',
    description_bn: 'repair job card, parts inventory, customer tracking, warranty — সব বাংলায় AI দিয়ে।',
    defaultTools: ['memory', 'reminders', 'calculations'],
    stockCategories: ['Screen', 'Battery', 'Charger Port', 'Speaker', 'Camera', 'IC Chip', 'অন্যান্য parts'],
    samplePrompts: ['রামের Redmi Note 12 screen change করতে দিয়েছে, ৫০০ টাকা advance', 'আজকের কাজ কী কী বাকি?', 'Samsung screen এর stock কত?'],
    systemContext: 'মোবাইল ফোন repair ও servicing। প্রতিটি job-এ ফোনের model, সমস্যা, parts লাগবে কিনা, advance payment, expected delivery, warranty (যদি থাকে) track করতে হয়। Parts inventory আলাদা রাখতে হয়।',
  },
  {
    id: 'beauty_parlour',
    name: 'Beauty Parlour / Salon',
    name_bn: 'বিউটি পার্লার / সেলুন',
    icon: '💇', emoji: '💄',
    category: 'business',
    accent: '#9D174D', light: '#FDF2F8',
    description_bn: 'appointment booking, service records, product inventory, regular customer tracking — বাংলায়।',
    defaultTools: ['memory', 'reminders', 'reports'],
    stockCategories: ['Hair Color', 'Face Pack', 'Wax', 'Nail Polish', 'Skincare', 'Thread', 'অন্যান্য'],
    samplePrompts: ['প্রিয়া কাল ২টায় facial করতে আসবে', 'আজকের কতজন customer এলো?', 'Hair color stock কত আছে?'],
    systemContext: 'বিউটি পার্লার / মহিলা সেলুন। Appointment scheduling, service records (facial, waxing, hair color, mehendi), product inventory, regular customer history, এবং দৈনিক income track করতে হয়।',
  },
  {
    id: 'garage',
    name: 'Auto / Garage / Repair',
    name_bn: 'গ্যারেজ / অটো সার্ভিস',
    icon: '🚗', emoji: '🔩',
    category: 'business',
    accent: '#92400E', light: '#FEF3C7',
    description_bn: 'vehicle servicing records, parts billing, customer vehicle history — বাংলায় AI দিয়ে।',
    defaultTools: ['memory', 'calculations', 'reports'],
    stockCategories: ['Engine Oil', 'Filter', 'Brake Pad', 'Tyre', 'Battery', 'Spare Parts', 'অন্যান্য'],
    samplePrompts: ['WB 45 AB 1234 Activa service করলাম, oil change ৩৫০ টাকা', 'রামের গাড়ি কবে আনতে আসবে?', 'Engine oil stock কত?'],
    systemContext: 'গ্যারেজ / অটোমোবাইল সার্ভিস সেন্টার। Vehicle registration number, owner name, সার্ভিসের ধরন, parts used, labour charge, total bill, payment status track করতে হয়। নিয়মিত customer-দের vehicle history মনে রাখতে হয়।',
  },
  {
    id: 'fish_meat',
    name: 'Fish / Meat Market',
    name_bn: 'মাছ / মাংসের দোকান',
    icon: '🐟', emoji: '🥩',
    category: 'business',
    accent: '#0F766E', light: '#CCFBF1',
    description_bn: 'রোজের মাছ/মাংস stock, দরের হিসাব, বাকি খদ্দের — সব বাংলায়।',
    defaultTools: ['memory', 'calculations', 'reports'],
    stockCategories: ['রুই', 'কাতলা', 'ইলিশ', 'চিংড়ি', 'মুরগি', 'খাসি', 'অন্যান্য'],
    samplePrompts: ['আজ ২০ কেজি রুই মাছ এনেছি পাইকারি ১৮০ টাকায়', 'সুমনকে বাকিতে ৫ কেজি মাংস দিলাম', 'আজকের মোট বিক্রি কত?'],
    systemContext: 'মাছ ও মাংসের দোকান। প্রতিদিন পাইকারি বাজার থেকে কেনা, দরদামের হিসাব, retail বিক্রি, বাকির হিসাব track করতে হয়। জিনিস পচনশীল তাই daily stock ক্লিয়ারেন্স important।',
  },
  {
    id: 'vegetable',
    name: 'Vegetable Vendor',
    name_bn: 'সবজি / ফলের দোকান',
    icon: '🥦', emoji: '🌽',
    category: 'business',
    accent: '#166534', light: '#DCFCE7',
    description_bn: 'রোজের সবজি stock, পাইকারি vs খুচরা দর, বাকির হিসাব — বাংলায়।',
    defaultTools: ['memory', 'calculations', 'reports'],
    stockCategories: ['পটল', 'বেগুন', 'আলু', 'পেঁয়াজ', 'টমেটো', 'সবুজ শাক', 'ফল'],
    samplePrompts: ['আজ ৩০ কেজি আলু এনেছি ২৫ টাকায়, বিক্রি হবে ৩৫ টাকায়', 'পেঁয়াজের দর আজ কত?', 'কতটা সবজি বাকি আছে?'],
    systemContext: 'সবজি ও ফলের ব্যবসা। পাইকারি বাজার থেকে কিনে খুচরায় বিক্রি। প্রতিদিন নতুন stock আসে, পচনশীল তাই দ্রুত বিক্রি করতে হয়। দামের ওঠানামা মনে রাখতে হয়।',
  },
  {
    id: 'printing',
    name: 'Printing Press',
    name_bn: 'প্রিন্টিং প্রেস / ফটোকপি',
    icon: '🖨️', emoji: '📄',
    category: 'business',
    accent: '#1D4ED8', light: '#DBEAFE',
    description_bn: 'order tracking, paper/ink inventory, delivery, billing — সব বাংলায় AI দিয়ে।',
    defaultTools: ['memory', 'calculations', 'reminders'],
    stockCategories: ['A4 Paper', 'Color Ink', 'Black Ink', 'Card Stock', 'Lamination', 'অন্যান্য'],
    samplePrompts: ['রামবাবুর ৫০০ visiting card order নিলাম, ৩ দিনে delivery', 'আজ কতটা কাজ বাকি আছে?', 'A4 paper stock কত?'],
    systemContext: 'প্রিন্টিং প্রেস ও ফটোকপি সেন্টার। Order নেওয়া, job type (business card, brochure, photocopy, banner), quantity, price, advance payment, delivery date, paper ও ink inventory track করতে হয়।',
  },
  // ── Education ──
  {
    id: 'coaching',
    name: 'Coaching / Tuition Centre',
    name_bn: 'কোচিং সেন্টার / টিউশন',
    icon: '📚', emoji: '✏️',
    category: 'education',
    accent: '#059669', light: '#D1FAE5',
    description_bn: 'ছাত্রের fee collection, attendance, exam results — বাংলায় AI দিয়ে।',
    defaultTools: ['memory', 'reminders', 'reports'],
    stockCategories: ['Study Material', 'খাতা-পেন', 'Books'],
    samplePrompts: ['রাহুল এ মাসের fee দিয়েছে ১৫০০ টাকা', 'কারা এখনো fee দেয়নি?', 'আজকের attendance কে কে ছিল?'],
    systemContext: 'কোচিং সেন্টার / প্রাইভেট টিউশন। ছাত্রদের নাম, class, monthly fee, payment status, attendance, exam results track করতে হয়। Reminder দিতে হয় যারা fee দেয়নি তাদের জন্য।',
  },
  // ── Health ──
  {
    id: 'doctor',
    name: 'Doctor Chamber',
    name_bn: 'ডাক্তারের চেম্বার',
    icon: '🏥', emoji: '👨‍⚕️',
    category: 'health',
    accent: '#0284C7', light: '#E0F2FE',
    description_bn: 'patient records, appointment booking, prescription history — বাংলায়।',
    defaultTools: ['memory', 'reminders', 'reports'],
    stockCategories: ['Medicine Sample', 'Stationery', 'অন্যান্য'],
    samplePrompts: ['রামবাবু কাল সকাল ১০টায় appointment নিলেন', 'আজকের patient list কী?', 'সুমনা দেবীর শেষ visit কবে ছিল?'],
    systemContext: 'ডাক্তারের চেম্বার। Patient নাম, বয়স, সমস্যা, prescription, next visit date, fees track করতে হয়। Regular patient-দের history মনে রাখতে হয়।',
  },
  // ── Finance ──
  {
    id: 'moneylender',
    name: 'Money Lending / Mahajan',
    name_bn: 'মহাজন / ঋণ ব্যবসা',
    icon: '💰', emoji: '📊',
    category: 'finance',
    accent: '#B45309', light: '#FEF3C7',
    description_bn: 'ঋণের হিসাব, সুদ, কিস্তি, বকেয়া — সব বাংলায় AI দিয়ে।',
    defaultTools: ['memory', 'calculations', 'reminders', 'reports'],
    stockCategories: [],
    samplePrompts: ['রামবাবুকে ৫০০০ টাকা ধার দিলাম ২% সুদে', 'সুমনের কিস্তি কবে?', 'মোট বকেয়া কত?'],
    systemContext: 'ছোট মহাজন / অনানুষ্ঠানিক ঋণ ব্যবসা। ঋণগ্রহীতার নাম, ঋণের পরিমাণ, সুদের হার, কিস্তির তারিখ, পরিশোধ history track করতে হয়।',
  },
  // ── Agriculture ──
  {
    id: 'nursery',
    name: 'Nursery / Plant Shop',
    name_bn: 'নার্সারি / গাছপালার দোকান',
    icon: '🌱', emoji: '🌿',
    category: 'agriculture',
    accent: '#15803D', light: '#DCFCE7',
    description_bn: 'গাছের stock, বীজ, সার, বিক্রি — সব বাংলায় AI দিয়ে।',
    defaultTools: ['memory', 'calculations', 'reports'],
    stockCategories: ['ফুলের গাছ', 'ফলের গাছ', 'সবজির চারা', 'সার', 'মাটি', 'টব', 'বীজ'],
    samplePrompts: ['আজ ২০টি গোলাপ গাছ এনেছি ৫০ টাকায়, বিক্রি হবে ১০০ টাকায়', 'কোন গাছ কম আছে?', 'আজকের বিক্রি কত?'],
    systemContext: 'নার্সারি ও গাছপালার দোকান। গাছের প্রকার, stock, cost ও selling price, seeding, seasonal demand track করতে হয়।',
  },
  // ── Festival ──
  {
    id: 'puja_committee',
    name: 'Puja Committee / Event',
    name_bn: 'পূজা কমিটি / অনুষ্ঠান',
    icon: '🌺', emoji: '🎉',
    category: 'festival',
    accent: '#B45309', light: '#FEF3C7',
    description_bn: 'budget, চাঁদা, sponsor, খরচ — পূজা কমিটির সব হিসাব বাংলায়।',
    defaultTools: ['memory', 'calculations', 'reports', 'reminders'],
    stockCategories: ['Decoration', 'Prasad Material', 'Lighting', 'Sound', 'অন্যান্য'],
    samplePrompts: ['রামবাবু ৫০০ টাকা চাঁদা দিয়েছেন', 'মোট বাজেট কত হলো?', 'কারা এখনো চাঁদা দেননি?'],
    systemContext: 'পূজা কমিটি / সামাজিক অনুষ্ঠান ব্যবস্থাপনা। চাঁদা সংগ্রহ, sponsor, বিভিন্ন খরচের category (decoration, food, sound, lighting), volunteer management track করতে হয়।',
  },
  // ── Service ──
  {
    id: 'electrician',
    name: 'Electrician / Plumber',
    name_bn: 'ইলেকট্রিশিয়ান / প্লাম্বার',
    icon: '🔌', emoji: '⚡',
    category: 'service',
    accent: '#D97706', light: '#FEF9C3',
    description_bn: 'কাজের order, materials, payment, customer history — বাংলায় AI দিয়ে।',
    defaultTools: ['memory', 'calculations', 'reminders'],
    stockCategories: ['Wire', 'Switch', 'Pipe', 'Fitting', 'অন্যান্য'],
    samplePrompts: ['রামবাবুর বাড়িতে wiring করলাম ১৫০০ টাকা', 'আজকের কাজের list কী?', 'কারা payment দেয়নি?'],
    systemContext: 'ইলেকট্রিশিয়ান / প্লাম্বার সার্ভিস। Job order, customer address, কাজের ধরন, materials used, labour charge, total bill, payment status track করতে হয়।',
  },
  {
    id: 'tiffin',
    name: 'Tiffin / Home Food Service',
    name_bn: 'টিফিন সার্ভিস / হোম ফুড',
    icon: '🍱', emoji: '🍛',
    category: 'business',
    accent: '#EA580C', light: '#FFF7ED',
    description_bn: 'daily tiffin subscription, payment, menu, delivery — বাংলায় AI দিয়ে।',
    defaultTools: ['memory', 'reminders', 'calculations', 'reports'],
    stockCategories: ['চাল', 'ডাল', 'তেল', 'সবজি', 'মশলা'],
    samplePrompts: ['রামবাবু এ মাসের tiffin charge দিয়েছেন ১৮০০ টাকা', 'আজকের menu কী রাখবো?', 'কতজন subscriber আছে?'],
    systemContext: 'টিফিন সার্ভিস / হোম ফুড ডেলিভারি। Subscriber list, monthly/daily charge, payment status, menu planning, grocery cost calculation করতে হয়।',
  },
  {
    id: 'stationery',
    name: 'Stationery / Book Shop',
    name_bn: 'স্টেশনারি / বইয়ের দোকান',
    icon: '📝', emoji: '📖',
    category: 'business',
    accent: '#7C3AED', light: '#F5F3FF',
    description_bn: 'বই, খাতা, পেন, school supplies — stock ও বিক্রির হিসাব বাংলায়।',
    defaultTools: ['memory', 'calculations', 'reports'],
    stockCategories: ['খাতা', 'পেন-পেন্সিল', 'রঙ', 'Geometry Box', 'School Bag', 'পাঠ্যবই', 'অন্যান্য'],
    samplePrompts: ['আজ ২০ টা Classmate খাতা এলো ৩০ টাকায়', 'Class 5 এর Bengali বই কতটা আছে?', 'আজকের বিক্রি কত?'],
    systemContext: 'স্টেশনারি ও বইয়ের দোকান। School supplies, পাঠ্যবই, খাতা-পেন এর stock tracking, পাইকারি কেনা ও খুচরা বিক্রি, বিশেষত পরীক্ষার আগে চাহিদা বাড়ে।',
  },
  {
    id: 'sweet_shop',
    name: 'Tea Stall / Snack Shop',
    name_bn: 'চায়ের দোকান / স্ন্যাকস',
    icon: '☕', emoji: '🍵',
    category: 'business',
    accent: '#92400E', light: '#FEF3C7',
    description_bn: 'চা, বিস্কুট, স্ন্যাকস — রোজের বিক্রি, raw material, cash হিসাব বাংলায়।',
    defaultTools: ['memory', 'calculations', 'reports'],
    stockCategories: ['চা পাতা', 'চিনি', 'দুধ', 'বিস্কুট', 'ডিম', 'পাউরুটি', 'অন্যান্য'],
    samplePrompts: ['আজ ২০০ কাপ চা বিক্রি হয়েছে ৭ টাকায়', 'চা পাতার stock কত আছে?', 'আজকের cash কত হলো?'],
    systemContext: 'চায়ের দোকান / ছোট স্ন্যাকস বার। Daily sales count, raw material consumption, cash in hand, daily profit calculation। সহজ ও দ্রুত হিসাব দরকার।',
  },
  {
    id: 'cloth_store',
    name: 'Readymade Cloth Store',
    name_bn: 'রেডিমেড কাপড়ের দোকান',
    icon: '👔', emoji: '🛍️',
    category: 'business',
    accent: '#7C3AED', light: '#F5F3FF',
    description_bn: 'শাড়ি, পাঞ্জাবি, জামা — stock, বিক্রি, supplier, season planning বাংলায়।',
    defaultTools: ['memory', 'calculations', 'reports'],
    stockCategories: ['শাড়ি', 'সালোয়ার', 'পাঞ্জাবি', 'শার্ট', 'প্যান্ট', 'শিশুর পোশাক'],
    samplePrompts: ['৩ পিস লাল শাড়ি এলো ৫০০ টাকায়', 'পুজোর আগে কী কী আনতে হবে?', 'আজকের বিক্রি কত?'],
    systemContext: 'রেডিমেড পোশাকের দোকান। Style, color, size অনুযায়ী stock track, উৎসবের আগে seasonal demand, supplier payment, customer বাকি ট্র্যাক করতে হয়।',
  },
  {
    id: 'customs',
    name: 'Custom Business',
    name_bn: 'আমার নিজের ব্যবসা',
    icon: '⚡', emoji: '✨',
    category: 'other',
    accent: '#374151', light: '#F3F4F6',
    description_bn: 'আপনার নিজের ব্যবসার জন্য কাস্টম AI। বাংলায় বিস্তারিত বলুন।',
    defaultTools: ['memory', 'calculations'],
    stockCategories: [],
    samplePrompts: ['আমার ব্যবসা সম্পর্কে বলুন', 'আজকের হিসাব কী?'],
    systemContext: 'কাস্টম ব্যবসা। User-এর বর্ণনা অনুযায়ী যেকোনো ব্যবসার জন্য সাহায্য করতে হবে।',
  },
]

// ── Build system prompt ────────────────────────────────────────────
export function buildSystemPrompt(data: AgentFormData & { templateId?: string }): string {
  const template = BUSINESS_TEMPLATES.find(t => t.id === data.templateId)

  const toolInstructions: Record<AgentTool, string> = {
    memory:       '- Remember all information shared in the conversation and refer back to it',
    calculations: '- Perform accurate calculations for money, quantities, percentages etc.',
    web_search:   '- You can reference current information when asked',
    reminders:    '- Help set up reminders and follow-up tasks',
    reports:      '- Generate structured summaries and reports when asked',
    sms_alert:    '- Mention when SMS alerts should be sent for critical events',
  }

  const activeToolInstructions = data.tools.map(t => toolInstructions[t]).join('\n')
  const businessContext = template?.systemContext || data.description

  const samplePromptsSection = template?.samplePrompts
    ? `\nSAMPLE INTERACTIONS:\n${template.samplePrompts.map(p => `User: "${p}"`).join('\n')}`
    : ''

  const stockSection = template?.stockCategories?.length
    ? `\nSTOCK CATEGORIES: ${template.stockCategories.join(', ')}`
    : ''

  return `তুমি "${data.name}" নামের একটি AI সহায়ক — Sahayak AI (সহায়ক AI) প্ল্যাটফর্মে তৈরি।

ব্যবসার ধরন: ${businessContext}
${stockSection}

ভাষার নিয়ম:
- সবসময় বাংলায় উত্তর দাও (user ইংরেজিতে লিখলে ইংরেজিতে উত্তর দাও)
- স্বাভাবিক, কথ্য বাংলা ব্যবহার করো — অতিরিক্ত আনুষ্ঠানিক নয়
- Technical শব্দ যেমন "stock", "order", "payment" স্বাভাবিকভাবে মিশিয়ে নাও
- "আপনি" সম্বোধন করো (বিনম্র)
${samplePromptsSection}

তোমার ক্ষমতা:
${activeToolInstructions}

ডেটা সেভ করার নিয়ম:
User যখন নতুন তথ্য জানায় (বিক্রি, stock, বাকি, খরচ, নতুন খদ্দের), তখন বাংলায় স্বাভাবিকভাবে confirm করো এবং response-এর শেষে এই hidden tag যোগ করো:
<!--SAVE:{"type":"sale","label":"চাল ৫কেজি বিক্রি","amount":250,"data":{"item":"চাল","qty":5,"unit":"কেজি","customer":"রামবাবু","status":"paid"}}-->

record_type: "sale" | "stock" | "credit" | "expense" | "customer" | "note" | "order" | "job"
- বিক্রি → "sale"
- stock যোগ → "stock"  
- বাকি/ধার → "credit"
- খরচ → "expense"
- নতুন খদ্দের → "customer"
- order/job → "order"
- অন্য তথ্য → "note"

শুধুমাত্র নতুন তথ্য রিপোর্ট করার সময় SAVE tag দাও।
প্রশ্ন, রিপোর্ট, বিশ্লেষণ — এতে কোনো SAVE tag দেবে না।

ব্যক্তিত্ব:
- বন্ধুসুলভ, ব্যবহারিক — যেন একজন জানকার বন্ধু
- Bengali context বুঝে পরামর্শ দাও
- সংক্ষিপ্ত কিন্তু সম্পূর্ণ উত্তর
- বাস্তব সমস্যায় (লোডশেডিং, payment delay, উৎসব মরসুম) practical advice দাও`
}

export async function generateAgentWithAI(data: AgentFormData & { templateId?: string }): Promise<{
  name_bn: string
  description_bn: string
  system_prompt: string
  icon: string
  color: string
}> {
  const template = BUSINESS_TEMPLATES.find(t => t.id === data.templateId)

  return {
    name_bn:        data.name,
    description_bn: data.description,
    system_prompt:  buildSystemPrompt(data),
    icon:           template?.icon || '⚡',
    // NOTE: this must be the strong, saturated "accent" colour, not the pale
    // "light" tint. `color` is used everywhere downstream (dashboard header
    // icon chip, and — critically — as `accentColor` in
    // GenericBusinessManagerUI, which paints button backgrounds with WHITE
    // text on top of it). Using `light` here made every custom agent's
    // buttons/tabs render as near-invisible white-on-pale-pastel text.
    color:          template?.accent || '#4F46E5',
  }
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
