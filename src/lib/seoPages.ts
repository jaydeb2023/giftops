export type SeoPage = {
  slug: string
  title: string
  description: string
  h1: string
  bn: string
  answer: string
  features: { title: string; text: string }[]
  steps: string[]
  faqs: { q: string; a: string }[]
  related: string[]
}

export const SEO_PAGES: SeoPage[] = [
  {
    slug: 'bengali-ai-business-assistant',
    title: 'Bengali AI Business Assistant for Small Shops',
    description: 'Sahayak AI is a Bengali AI business assistant. Speak or type in Bengali or Banglish to manage stock, sales, customer credit and reports. 7-day free trial.',
    h1: 'Bengali AI Business Assistant',
    bn: 'বাংলায় বলুন, AI আপনার ব্যবসা সামলাবে',
    answer: 'Sahayak AI is a Bengali AI business assistant built for small businesses in West Bengal and Bangladesh. You talk to it in Bengali, Banglish or by voice, and it updates your stock, records sales, tracks customer baki (credit) and prepares reports, with no forms and no English-only screens.',
    features: [
      { title: 'Understands real Bengali', text: 'Works with colloquial Bengali, Banglish (Bengali typed in English letters) and voice input, so you can say it the way you would tell an employee.' },
      { title: 'Does the work, not just answers', text: 'When you say you sold 5 kg of rice, stock goes down, the sale is recorded and any baki is added to the customer.' },
      { title: 'Ready-made for your shop type', text: 'Dedicated assistants for grocery stores, pharmacies, hotels and dhabas, sweet shops and clothing stores.' },
      { title: 'Rupee and Taka', text: 'Supports both ₹ (India) and ৳ (Bangladesh).' },
    ],
    steps: ['Create your free account', 'Pick the assistant that matches your business', 'Type or speak in Bengali, and your records update automatically'],
    faqs: [
      { q: 'What is a Bengali AI business assistant?', a: 'It is software that understands spoken or typed Bengali and performs real business tasks such as updating stock, recording sales and tracking customer credit.' },
      { q: 'Do I need to know English?', a: 'No. Sahayak AI works fully in Bengali and Banglish, with voice input.' },
      { q: 'Is there a free trial?', a: 'Yes, Sahayak AI offers a 7-day free trial with no credit card required.' },
    ],
    related: ['bengali-ai-business-management', 'ai-stock-management', 'customer-management-software'],
  },
  {
    slug: 'bengali-ai-business-management',
    title: 'Bengali AI Business Management: Stock, Sales, Baki',
    description: 'Manage your whole business in Bengali with AI: stock, sales, customer baki, suppliers and daily reports in one dashboard. Try Sahayak AI free for 7 days.',
    h1: 'Bengali AI Business Management',
    bn: 'স্টক, বিক্রি, বাকি ও রিপোর্ট — সব এক জায়গায়',
    answer: 'Bengali AI business management means running your daily shop or clinic work in Bengali through an AI that keeps your books. Sahayak AI combines a dashboard (stock, sales, baki, customers, suppliers, reports) with a chat assistant, so every message you send updates real data.',
    features: [
      { title: 'One dashboard, one chat', text: 'See stock, sales, dues, customers and reports on one screen while the AI chat updates them live.' },
      { title: 'Daily and monthly reports', text: 'Know today’s sales, what is low in stock and who owes you money without opening a notebook.' },
      { title: 'Supplier and follow-up tracking', text: 'Keep supplier details and customer follow-ups in the same place.' },
      { title: 'Voice input', text: 'Speak your entries in Bengali when your hands are busy at the counter.' },
    ],
    steps: ['Sign up and choose your business type', 'Add or import your stock and customers', 'Run the day by chatting in Bengali and check reports any time'],
    faqs: [
      { q: 'What can I manage with Sahayak AI?', a: 'Stock, sales, customer credit (baki), suppliers, follow-ups, invoices and reports.' },
      { q: 'Is my data updated in real time?', a: 'Yes. When the AI confirms an entry, the dashboard reflects it immediately.' },
    ],
    related: ['bengali-ai-business-assistant', 'ai-business-management-software', 'ai-business-agents'],
  },
  {
    slug: 'ai-business-management-software',
    title: 'AI Business Management Software for Small Business',
    description: 'AI business management software that runs on chat: stock, billing, GST invoices, customers and WhatsApp in one tool, built for small businesses in India.',
    h1: 'AI Business Management Software',
    bn: 'ছোট ব্যবসার জন্য AI ম্যানেজমেন্ট সফটওয়্যার',
    answer: 'Sahayak AI is AI business management software for small businesses. Instead of filling forms, you tell the AI what happened and it updates inventory, sales, customer dues and invoices, with dashboards and reports ready when you need them.',
    features: [
      { title: 'Chat-first workflow', text: 'Record a sale, add stock or check a customer’s baki by sending a message.' },
      { title: 'Inventory and billing together', text: 'Stock and invoices stay in sync, so a bill reduces stock automatically.' },
      { title: 'Customer records built in', text: 'Every customer has purchase history and outstanding amount.' },
      { title: 'WhatsApp ready', text: 'Send reminders and messages to customers from the same system.' },
    ],
    steps: ['Start a free trial', 'Connect your business type and data', 'Let the AI handle daily entries while you focus on customers'],
    faqs: [
      { q: 'How is AI business management software different from normal billing software?', a: 'You can update it by talking to it, so there is less manual data entry and no training on complicated menus.' },
      { q: 'Who is it for?', a: 'Small retailers, pharmacies, restaurants, sweet shops, clothing stores and other small businesses.' },
    ],
    related: ['business-billing-software', 'ai-stock-management', 'whatsapp-automation-for-business'],
  },
  {
    slug: 'ai-for-small-businesses',
    title: 'AI for Small Businesses in India and Bangladesh',
    description: 'Practical AI for small businesses: manage stock, sales, credit and customers in Bengali without technical skills. Free 7-day trial, no card needed.',
    h1: 'AI for Small Businesses',
    bn: 'ছোট ব্যবসার জন্য সহজ AI, কোনো টেকনিক্যাল জ্ঞান ছাড়াই',
    answer: 'AI for small businesses should save time on daily paperwork. Sahayak AI does this in Bengali: shop owners speak or type what happened, and the AI keeps stock, sales, baki and reports up to date, with no coding or setup skills needed.',
    features: [
      { title: 'No technical skill', text: 'If you can send a message, you can use it.' },
      { title: 'Saves hours of bookkeeping', text: 'Replace the khata and end-of-day counting with instant records.' },
      { title: 'Fewer mistakes', text: 'Automatic stock deduction and baki calculation reduce manual errors.' },
      { title: 'Affordable', text: 'Start with a 7-day free trial and upgrade only if it helps your business.' },
    ],
    steps: ['Sign up in a minute', 'Tell the AI about your shop', 'Run your daily work by chat'],
    faqs: [
      { q: 'Is AI too complicated for a small shop?', a: 'Not with Sahayak AI. You use ordinary Bengali sentences or voice, and the AI does the data entry.' },
      { q: 'Which small businesses can use it?', a: 'Grocery and general stores, pharmacies, restaurants and dhabas, sweet shops, clothing stores, and other businesses through the custom agent builder.' },
    ],
    related: ['bengali-ai-business-assistant', 'ai-business-agents', 'customer-management-software'],
  },
  {
    slug: 'ai-stock-management',
    title: 'AI Stock Management and Inventory Software',
    description: 'AI stock and inventory management in Bengali: update stock by chat or voice, get low-stock alerts and keep sales and inventory in sync. Try free.',
    h1: 'AI Stock Management (Inventory Management)',
    bn: 'বলুন, স্টক নিজে থেকেই আপডেট হবে',
    answer: 'AI stock management lets you update inventory by describing what came in or went out. With Sahayak AI you say “আজ ৫ কেজি চাল বিক্রি হয়েছে” and the stock is reduced, the sale is recorded, and low-stock items are flagged on your dashboard.',
    features: [
      { title: 'Update stock by chat or voice', text: 'Add purchases and record sales in natural Bengali.' },
      { title: 'Low-stock alerts', text: 'See what is running out before you lose sales.' },
      { title: 'Categories and search', text: 'Browse stock by category, search items and edit quantities quickly.' },
      { title: 'Linked to sales and billing', text: 'Every sale and invoice keeps inventory accurate.' },
    ],
    steps: ['Add your products and opening stock', 'Say or type each purchase and sale', 'Check the low-stock list and reorder'],
    faqs: [
      { q: 'Can I manage inventory in Bengali?', a: 'Yes. Item names, quantities and units can be entered in Bengali, English or Banglish.' },
      { q: 'Does stock update automatically after a sale?', a: 'Yes, recording a sale through the AI reduces the matching stock item.' },
    ],
    related: ['business-billing-software', 'bengali-ai-business-management', 'customer-management-software'],
  },
  {
    slug: 'business-billing-software',
    title: 'Business Billing Software with AI (Bengali)',
    description: 'Create bills and invoices for your shop with AI billing software. Bengali input, customer records, baki tracking and WhatsApp sharing. Try free.',
    h1: 'Business Billing Software',
    bn: 'সহজ বিল ও ইনভয়েস, বাংলায়',
    answer: 'Sahayak AI is billing software that lets you create bills by describing the sale. It links each bill to the customer, adjusts stock, tracks what was paid and what is still baki, and keeps an invoice history you can search.',
    features: [
      { title: 'Describe the sale, get the bill', text: 'AI reads items, quantities and prices from your message to prepare the invoice.' },
      { title: 'Payment and baki tracking', text: 'Record what the customer paid now and what remains due.' },
      { title: 'Invoice history', text: 'Find any past bill by customer or date.' },
      { title: 'Stock stays accurate', text: 'Billing and inventory are connected.' },
    ],
    steps: ['Choose or add the customer', 'Tell the AI what was sold', 'Review the bill and share it'],
    faqs: [
      { q: 'Can I bill in Bengali?', a: 'Yes. You can describe items and amounts in Bengali or Banglish.' },
      { q: 'Does billing track unpaid amounts?', a: 'Yes, any part not paid is recorded as baki against the customer.' },
    ],
    related: ['gst-invoice-software', 'ai-stock-management', 'customer-management-software'],
  },
  {
    slug: 'gst-invoice-software',
    title: 'GST Invoice Software for Small Business (India)',
    description: 'Make GST invoices for your small business with AI. Bengali-friendly, linked to stock and customers, with invoice history. Start a 7-day free trial.',
    h1: 'GST Invoice Software',
    bn: 'GST ইনভয়েস তৈরি করুন সহজে',
    answer: 'Sahayak AI includes GST invoicing for small businesses in India. You describe the sale, the AI helps prepare the invoice, and each invoice is connected to your customer records, stock and invoice history.',
    features: [
      { title: 'GST invoices', text: 'Create tax invoices for your customers from the dashboard.' },
      { title: 'AI-assisted entry', text: 'Describe items and quantities in Bengali instead of typing every line.' },
      { title: 'Searchable history', text: 'Open past invoices when a customer or accountant asks.' },
      { title: 'Connected records', text: 'Invoices update stock and customer dues.' },
    ],
    steps: ['Add your business details', 'Describe the sale or pick items', 'Generate the invoice and keep it in history'],
    faqs: [
      { q: 'Does Sahayak AI support GST invoices?', a: 'Yes, GST invoicing is available on paid plans. Check the current plan details on the pricing section of the site.' },
      { q: 'Is it only for India?', a: 'GST invoicing is for Indian businesses. The rest of the product also serves Bangladesh.' },
    ],
    related: ['business-billing-software', 'ai-business-management-software', 'customer-management-software'],
  },
  {
    slug: 'customer-management-software',
    title: 'Customer Management Software (CRM) for Small Shops',
    description: 'Simple customer management software in Bengali: customer records, purchase history, baki tracking and follow-ups. AI adds customers from a message.',
    h1: 'Customer Management Software',
    bn: 'গ্রাহকের তথ্য, বাকি ও ফলোআপ এক জায়গায়',
    answer: 'Sahayak AI is customer management software for small shops. You can add a customer by sending one message, see their purchase history and outstanding baki, and follow up on dues, without a complicated CRM.',
    features: [
      { title: 'Add customers by chat', text: 'Say the name, area and phone and the AI saves the customer.' },
      { title: 'Baki and payment history', text: 'See who owes what, and record payments as they come in.' },
      { title: 'Follow-ups', text: 'Track who to remind and when.' },
      { title: 'Works with billing and WhatsApp', text: 'Bills and messages link back to the same customer record.' },
    ],
    steps: ['Add customers by message or from the dashboard', 'Record each sale against the customer', 'Follow up on dues from the same screen'],
    faqs: [
      { q: 'Is this a full CRM?', a: 'It is a practical CRM for small businesses: customer details, purchases, dues and follow-ups.' },
      { q: 'Can it track customer credit (baki)?', a: 'Yes. Baki tracking is a core feature.' },
    ],
    related: ['whatsapp-automation-for-business', 'business-billing-software', 'bengali-ai-business-management'],
  },
  {
    slug: 'whatsapp-automation-for-business',
    title: 'WhatsApp Automation for Business (Bengali)',
    description: 'Automate WhatsApp for your business: broadcasts, follow-up reminders and auto-replies connected to your customers and stock. Built for Bengali shops.',
    h1: 'WhatsApp Automation for Business',
    bn: 'হোয়াটসঅ্যাপে গ্রাহকের সঙ্গে সহজ যোগাযোগ',
    answer: 'Sahayak AI connects WhatsApp to your business records so you can send broadcasts, follow up on dues and automate replies, using the same customer list and data you already keep in the dashboard.',
    features: [
      { title: 'Broadcast messages', text: 'Send offers or announcements to your customers.' },
      { title: 'Follow-up reminders', text: 'Remind customers about pending baki.' },
      { title: 'Automations and knowledge base', text: 'Set up automatic replies from information about your business.' },
      { title: 'Same customer data', text: 'No copying contacts between tools.' },
    ],
    steps: ['Connect your WhatsApp', 'Choose the customers or automation', 'Send and track messages from the dashboard'],
    faqs: [
      { q: 'Can I send reminders for unpaid baki on WhatsApp?', a: 'Yes, follow-up messages can be sent to customers with pending dues.' },
      { q: 'Is WhatsApp automation available on every plan?', a: 'Availability depends on your plan. See the pricing section for current details.' },
    ],
    related: ['customer-management-software', 'ai-business-agents', 'business-billing-software'],
  },
  {
    slug: 'ai-business-agents',
    title: 'AI Business Agents: Ready-Made and Custom',
    description: 'AI business agents for shops, pharmacies, hotels, sweet shops and clothing stores, plus a builder for custom agents. Manage your business by chat in Bengali.',
    h1: 'AI Business Agents',
    bn: 'আপনার ব্যবসার জন্য তৈরি AI এজেন্ট',
    answer: 'An AI business agent is an assistant that knows your type of business and updates real data for you. Sahayak AI offers ready-made agents for grocery stores, pharmacies, hotels and dhabas, sweet shops and clothing stores, and lets you build a custom agent for any other business.',
    features: [
      { title: 'Ready-made agents', text: 'Dokan Manager, Pharmacy Assistant, Hotel and Dhaba Manager, Mishti Dokan Manager and Kaporer Dokan Tracker.' },
      { title: 'Custom agent builder', text: 'Create an agent for a business type that is not in the library.' },
      { title: 'Real data, not just chat', text: 'Agents write to your stock, sales and customer records.' },
      { title: 'Bengali voice and text', text: 'Talk to your agent naturally.' },
    ],
    steps: ['Browse the agent library', 'Activate the agent for your business', 'Chat, and the dashboard updates as you go'],
    faqs: [
      { q: 'What is an AI agent for business?', a: 'It is an AI assistant that performs tasks such as recording sales or updating stock, instead of only answering questions.' },
      { q: 'Can I build my own agent?', a: 'Yes, Sahayak AI includes a builder for custom business agents.' },
    ],
    related: ['bengali-ai-business-assistant', 'ai-for-small-businesses', 'ai-stock-management'],
  },
]

export const getSeoPage = (slug: string) => SEO_PAGES.find(p => p.slug === slug)
