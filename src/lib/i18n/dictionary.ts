// ── Kaaj AI / Sahayak AI — Translation Dictionary ──────────────────
// Add new keys here as more pages/components adopt the language system.
// Structure: dictionary[key] = { bn: '...', en: '...', hi: '...' }
// Usage: const { t } = useLanguage(); t('nav.home')

export type Lang = 'bn' | 'en' | 'hi'
export const SUPPORTED_LANGS: Lang[] = ['bn', 'hi', 'en']

export const dictionary = {
  // ── Generic / shared ──────────────────────────────────────────
  'common.save': { bn: 'সেভ করুন',              en: 'Save' , hi: 'सेव करें' },
  'common.saving': { bn: 'সেভ হচ্ছে...',          en: 'Saving...' , hi: 'सेव हो रहा है...' },
  'common.cancel': { bn: 'বাতিল',                 en: 'Cancel' , hi: 'रद्द करें' },
  'common.back': { bn: 'ফিরুন',                 en: 'Back' , hi: 'वापस' },
  'common.loading': { bn: 'লোড হচ্ছে...',          en: 'Loading...' , hi: 'लोड हो रहा है...' },
  'common.comingSoon': { bn: 'শীঘ্রই আসছে',           en: 'Coming Soon' , hi: 'जल्द आ रहा है' },
  'common.online': { bn: 'Online',                 en: 'Online' , hi: 'Online' },
  'common.refresh': { bn: 'Refresh',                en: 'Refresh' , hi: 'Refresh' },

  // ── Sidebar nav ──────────────────────────────────────────────
  'nav.home': { bn: 'হোম',                    en: 'Home' , hi: 'होम' },
  'nav.overview': { bn: 'Overview',                en: 'Overview' , hi: 'ओवरव्यू' },
  'nav.myAgents': { bn: 'আমার এজেন্ট',           en: 'My Agents' , hi: 'मेरे एजेंट' },
  'nav.stock': { bn: 'স্টক',                   en: 'Stock' , hi: 'स्टॉक' },
  'nav.sales': { bn: 'বিক্রি',                 en: 'Sales' , hi: 'बिक्री' },
  'nav.dues': { bn: 'বাকি',                   en: 'Dues' , hi: 'बकाया' },
  'nav.notebook': { bn: 'AI নোটবুক',              en: 'AI Notebook' , hi: 'AI नोटबुक' },
  'nav.crmBilling': { bn: 'CRM ও বিলিং',             en: 'CRM & Billing' , hi: 'CRM और बिलिंग' },
  'nav.customer': { bn: 'কাস্টমার',               en: 'Customers' , hi: 'ग्राहक' },
  'nav.invoice': { bn: 'ইনভয়েস তৈরি করুন',      en: 'Create Invoice' , hi: 'इनवॉइस बनाएं' },
  'nav.invoiceHistory': { bn: 'ইনভয়েস হিস্ট্রি',       en: 'Invoice History' , hi: 'इनवॉइस हिस्ट्री' },
  'nav.supply': { bn: 'সরবরাহ',                 en: 'Supply' , hi: 'सप्लाई' },
  'nav.followup': { bn: 'ফলোআপ',                  en: 'Follow-up' , hi: 'फॉलो-अप' },
  'nav.reports': { bn: 'রিপোর্ট',                en: 'Reports' , hi: 'रिपोर्ट' },
  'nav.buildAgent': { bn: 'Build Agent',             en: 'Build Agent' , hi: 'एजेंट बनाएं' },
  'nav.library': { bn: 'Library',                 en: 'Library' , hi: 'लाइब्रेरी' },
  'nav.whatsapp': { bn: 'হোয়াটসঅ্যাপ অটোমেশন',   en: 'WhatsApp Automation' , hi: 'व्हाट्सऐप ऑटोमेशन' },
  'nav.catalog': { bn: 'প্রোডাক্ট ক্যাটালগ',     en: 'Product Catalog' , hi: 'प्रोडक्ट कैटलॉग' },
  'nav.settings': { bn: 'সেটিংস',                 en: 'Settings' , hi: 'सेटिंग्स' },
  'nav.logout': { bn: 'Logout',                  en: 'Logout' , hi: 'लॉगआउट' },
  'nav.lowStockBadge': { bn: 'টি কম স্টক',             en: ' low stock' , hi: ' आइटम कम स्टॉक' },

  // ── Top bar ──────────────────────────────────────────────────
  'topbar.newAgent': { bn: 'নতুন Agent',             en: 'New Agent' , hi: 'नया एजेंट' },
  'topbar.language': { bn: 'ভাষা',                    en: 'Language' , hi: 'भाषा' },

  // ── Overview ─────────────────────────────────────────────────
  'overview.greeting': { bn: 'নমস্কার,',               en: 'Hello,' , hi: 'नमस्ते,' },
  'overview.subtitle': { bn: 'আজকের ব্যবসার সারসংক্ষেপ', en: "Today's business summary" , hi: 'आज के व्यवसाय का सारांश' },
  'overview.newAgent': { bn: 'নতুন Agent',              en: 'New Agent' , hi: 'नया एजेंट' },
  'overview.kpi.todaySales': { bn: 'আজকের মোট বিক্রি',       en: "Today's Total Sales" , hi: 'आज की कुल बिक्री' },
  'overview.kpi.totalRecords': { bn: 'মোট রেকর্ড',            en: 'Total Records' , hi: 'कुल रिकॉर्ड' },
  'overview.kpi.totalAgents': { bn: 'মোট Agent',              en: 'Total Agents' , hi: 'कुल एजेंट' },
  'overview.kpi.lowStock': { bn: 'কম স্টক',                en: 'Low Stock' , hi: 'कम स्टॉक' },
  'overview.kpi.totalStock': { bn: 'মোট স্টক (পণ্য)',        en: 'Total Stock (Items)' , hi: 'कुल स्टॉक (आइटम)' },
  'overview.kpi.totalCustomers': { bn: 'মোট গ্রাহক',          en: 'Total Customers' , hi: 'कुल ग्राहक' },
  'overview.kpi.expiringSoon': { bn: 'মেয়াদ শেষ হতে চলছে',   en: 'Expiring Soon' , hi: 'जल्द समाप्त होने वाले' },
  'overview.kpi.yesterday': { bn: 'গতকাল',                   en: 'Yesterday' , hi: 'कल' },
  'overview.kpi.newThisWeek': { bn: 'নতুন',                     en: 'new' , hi: 'नए' },
  'overview.viewLink': { bn: 'দেখুন',                    en: 'View' , hi: 'देखें' },
  'overview.today': { bn: 'আজ',                       en: 'Today' , hi: 'आज' },
  'overview.tasksTitle': { bn: 'আজকের গুরুত্বপূর্ণ কাজ',  en: "Today's Important Tasks" , hi: 'आज के ज़रूरी काम' },
  'overview.tasksEmpty': { bn: 'কোনো নতুন কাজ নেই ✅',     en: 'No new tasks ✅' , hi: 'कोई नया काम नहीं ✅' },
  'overview.allAgents': { bn: 'সব Agent',                en: 'All Agents' , hi: 'सभी एजेंट' },
  'overview.exploreLibrary': { bn: 'Library থেকে এজেন্ট চালু করুন', en: 'Activate an agent from Library' , hi: 'लाइब्रेरी से एजेंट चालू करें' },
  'overview.exploreLibrarySub': { bn: 'দোকান, হোটেল, মিষ্টি, ফার্মেসি...', en: 'Shop, Hotel, Sweets, Pharmacy...' , hi: 'दुकान, होटल, मिठाई, फार्मेसी...' },
  'overview.newAgentCard': { bn: 'নতুন Agent তৈরি করুন',   en: 'Create a New Agent' , hi: 'नया एजेंट बनाएं' },
  'overview.newAgentCardSub': { bn: '১৯+ business template',  en: '19+ business templates' , hi: '19+ बिज़नेस टेम्पलेट' },

  // ── My Agents ────────────────────────────────────────────────
  'myAgents.title': { bn: 'আমার Custom Agent',       en: 'My Custom Agents' , hi: 'मेरे कस्टम एजेंट' },
  'myAgents.count': { bn: 'টি agent তৈরি আছে',      en: ' agents created' , hi: ' एजेंट बनाए गए हैं' },
  'myAgents.subtitle': { bn: 'আপনার সক্রিয় এবং কাস্টমাইজড AI এজেন্টসমূহ এখানে দেখুন এবং পরিচালনা করুন।', en: 'View and manage your active and custom AI agents here.' , hi: 'अपने सक्रिय और कस्टमाइज़ किए गए AI एजेंट यहाँ देखें और मैनेज करें।' },
  'myAgents.totalAgents': { bn: 'মোট এজেন্ট',              en: 'Total Agents' , hi: 'कुल एजेंट' },
  'myAgents.activeAgents': { bn: 'সক্রিয় এজেন্ট',          en: 'Active Agents' , hi: 'सक्रिय एजेंट' },
  'myAgents.inactiveAgents': { bn: 'নিষ্ক্রিয় এজেন্ট',        en: 'Inactive Agents' , hi: 'निष्क्रिय एजेंट' },
  'myAgents.yourPlan': { bn: 'আপনার প্ল্যান',           en: 'Your Plan' , hi: 'आपका प्लान' },
  'myAgents.filterAll': { bn: 'সব এজেন্ট',               en: 'All Agents' , hi: 'सभी एजेंट' },
  'myAgents.filterActive': { bn: 'সক্রিয়',                  en: 'Active' , hi: 'सक्रिय' },
  'myAgents.filterInactive': { bn: 'নিষ্ক্রিয়',               en: 'Inactive' , hi: 'निष्क्रिय' },
  'myAgents.filterLibrary': { bn: 'লাইব্রেরী থেকে',          en: 'From Library' , hi: 'लाइब्रेरी से' },
  'myAgents.filterCustom': { bn: 'কাস্টম এজেন্ট',           en: 'Custom Agents' , hi: 'कस्टम एजेंट' },
  'myAgents.searchPlaceholder': { bn: 'এজেন্টের নাম বা ব্যবসার ধরন খুঁজুন...', en: 'Search agent name or business type...' , hi: 'एजेंट का नाम या व्यवसाय का प्रकार खोजें...' },
  'myAgents.sortNewest': { bn: 'নতুন থেকে পুরোনো',        en: 'Newest first' , hi: 'नए से पुराने' },
  'myAgents.sortOldest': { bn: 'পুরোনো থেকে নতুন',        en: 'Oldest first' , hi: 'पुराने से नए' },
  'myAgents.libraryTag': { bn: 'লাইব্রেরী এজেন্ট',        en: 'Library Agent' , hi: 'लाइब्रेरी एजेंट' },
  'myAgents.customTag': { bn: 'কাস্টম এজেন্ট',           en: 'Custom Agent' , hi: 'कस्टम एजेंट' },
  'myAgents.openWorkspace': { bn: 'ওপেন ওয়ার্কস্পেস',       en: 'Open Workspace' , hi: 'वर्कस्पेस खोलें' },
  'myAgents.chatWithAI': { bn: 'AI এর সাথে চ্যাট',        en: 'Chat with AI' , hi: 'AI से चैट करें' },
  'myAgents.noResults': { bn: 'কোনো এজেন্ট পাওয়া যায়নি', en: 'No agents found' , hi: 'कोई एजेंट नहीं मिला' },
  'myAgents.createNew': { bn: 'নতুন এজেন্ট তৈরি করুন',   en: 'Create a New Agent' , hi: 'नया एजेंट बनाएं' },
  'myAgents.createNewSub': { bn: 'নিজের ব্যবসার জন্য কাস্টম AI এজেন্ট তৈরি করুন', en: 'Build a custom AI agent for your business' , hi: 'अपने व्यवसाय के लिए कस्टम AI एजेंट बनाएं' },
  'myAgents.getFromLibrary': { bn: 'লাইব্রেরী থেকে এজেন্ট নিন', en: 'Get an Agent from Library' , hi: 'लाइब्रेरी से एजेंट लें' },
  'myAgents.getFromLibrarySub': { bn: 'রেডিমেড এজেন্ট থেকে আপনার ব্যবসার জন্য একটি বেছে নিন', en: 'Pick a ready-made agent for your business' , hi: 'तैयार एजेंट में से अपने व्यवसाय के लिए चुनें' },
  'myAgents.viewLibrary': { bn: 'Library দেখুন',           en: 'View Library' , hi: 'लाइब्रेरी देखें' },
  'myAgents.viewReport': { bn: 'রিপোর্ট দেখুন',           en: 'View Report' , hi: 'रिपोर्ट देखें' },
  'myAgents.newAgent': { bn: 'নতুন Agent',              en: 'New Agent' , hi: 'नया एजेंट' },
  'myAgents.emptyTitle': { bn: 'কোনো custom agent নেই',  en: 'No custom agents yet' , hi: 'अभी कोई कस्टम एजेंट नहीं' },
  'myAgents.emptySub': { bn: 'আপনার ব্যবসার জন্য AI agent তৈরি করুন', en: 'Create an AI agent for your business' , hi: 'अपने व्यवसाय के लिए AI एजेंट बनाएं' },
  'myAgents.emptyCta': { bn: 'Agent তৈরি করুন →',      en: 'Create Agent →' , hi: 'एजेंट बनाएं →' },
  'myAgents.dashboard': { bn: 'কাজের ড্যাশবোর্ড',       en: 'Work Dashboard' , hi: 'काम का डैशबोर्ड' },
  'myAgents.customerCrm': { bn: 'কাস্টমার / CRM',         en: 'Customer / CRM' , hi: 'ग्राहक / CRM' },
  'myAgents.aiAssistant': { bn: 'AI সহায়ক — বাংলায় কথা বলুন', en: 'AI Assistant — Chat Now' , hi: 'AI सहायक — हिंदी में बात करें' },

  // ── Library ──────────────────────────────────────────────────
  'library.title': { bn: 'Library Agents',          en: 'Library Agents' , hi: 'लाइब्रेरी एजेंट' },
  'library.subtitle': { bn: '৫টি বিশেষ AI — সরাসরি চালু করুন', en: '5 specialized AIs — activate instantly' , hi: '5 खास AI — तुरंत चालू करें' },
  'library.tipTitle': { bn: 'Library agent-এ click করলে সরাসরি চলে যাবেন', en: 'Clicking a Library agent takes you straight there' , hi: 'लाइब्रेरी एजेंट पर क्लिक करने से आप सीधे वहाँ पहुँच जाएंगे' },
  'library.tipSub': { bn: 'সেখানে stock, বিক্রি, খদ্দের, রিপোর্ট — সব আছে।', en: 'Stock, sales, customers, reports — everything is there.' , hi: 'वहाँ स्टॉक, बिक्री, ग्राहक, रिपोर्ट — सब कुछ है।' },

  // ── Reports / CRM ────────────────────────────────────────────
  'reports.title': { bn: 'রিপোর্ট ও হিসাব',        en: 'Reports & Accounts' , hi: 'रिपोर्ट और हिसाब' },
  'reports.subtitle': { bn: 'Agent বেছে রিপোর্ট দেখুন', en: 'Select an agent to view reports' , hi: 'रिपोर्ट देखने के लिए एजेंट चुनें' },
  'reports.empty': { bn: 'কোনো custom agent নেই। Library agent-এর রিপোর্ট সেই agent-এ দেখুন।', en: 'No custom agents. View a Library agent’s report inside that agent.' , hi: 'कोई कस्टम एजेंट नहीं। लाइब्रेरी एजेंट की रिपोर्ट उसी एजेंट में देखें।' },
  'reports.goLibrary': { bn: 'Library দেখুন →',        en: 'View Library →' , hi: 'लाइब्रेरी देखें →' },
  'reports.selectPrompt': { bn: 'উপরে একটি agent বেছে নিন', en: 'Select an agent above' , hi: 'ऊपर से एक एजेंट चुनें' },
  'crm.title': { bn: 'CRM — Customer Management', en: 'CRM — Customer Management' , hi: 'CRM — ग्राहक प्रबंधन' },
  'crm.subtitle': { bn: 'Agent বেছে CRM দেখুন',   en: 'Select an agent to view CRM' , hi: 'CRM देखने के लिए एजेंट चुनें' },
  'crm.empty': { bn: 'কোনো custom agent নেই।', en: 'No custom agents yet.' , hi: 'अभी कोई कस्टम एजेंट नहीं।' },

  // ── WhatsApp Automation (placeholder) ───────────────────────
  'whatsapp.title': { bn: 'হোয়াটসঅ্যাপ অটোমেশন',   en: 'WhatsApp Automation' , hi: 'व्हाट्सऐप ऑटोमेशन' },
  'whatsapp.subtitle': { bn: 'আপনার হোয়াটসঅ্যাপ নম্বর কানেক্ট করুন এবং কাস্টমারদের মেসেজ পাঠান', en: 'Connect your WhatsApp number and message customers' , hi: 'अपना व्हाट्सऐप नंबर कनेक्ट करें और ग्राहकों को मैसेज भेजें' },
  'whatsapp.connectCta': { bn: 'হোয়াটসঅ্যাপ কানেক্ট করুন', en: 'Connect WhatsApp' , hi: 'व्हाट्सऐप कनेक्ट करें' },
  'whatsapp.comingSoonBody': { bn: 'এই ফিচারটি শীঘ্রই আসছে — এখান থেকে আপনি হোয়াটসঅ্যাপ নম্বর কানেক্ট করতে পারবেন, কাস্টমারদের মেসেজ পাঠাতে পারবেন এবং তাদের রিপ্লাই দেখতে পারবেন।', en: 'This feature is coming soon — you’ll be able to connect a WhatsApp number, send messages to customers, and view their replies right here.' , hi: 'यह फीचर जल्द आ रहा है — यहाँ से आप व्हाट्सऐप नंबर कनेक्ट कर सकेंगे, ग्राहकों को मैसेज भेज सकेंगे और उनके जवाब देख सकेंगे।' },

  // ── Product Catalog (placeholder) ───────────────────────────
  'catalog.title': { bn: 'প্রোডাক্ট ক্যাটালগ',     en: 'Product Catalog' , hi: 'प्रोडक्ट कैटलॉग' },
  'catalog.subtitle': { bn: 'সুন্দর প্রোডাক্ট ক্যাটালগ তৈরি করুন এবং হোয়াটসঅ্যাপে শেয়ার করুন', en: 'Design a beautiful product catalog and share it on WhatsApp' , hi: 'सुंदर प्रोडक्ट कैटलॉग बनाएं और व्हाट्सऐप पर शेयर करें' },
  'catalog.createCta': { bn: 'ক্যাটালগ তৈরি করুন',      en: 'Create Catalog' , hi: 'कैटलॉग बनाएं' },
  'catalog.comingSoonBody': { bn: 'এই ফিচারটি শীঘ্রই আসছে — আপনার প্রোডাক্টের একটি কাস্টমাইজড ক্যাটালগ ডিজাইন করে সরাসরি হোয়াটসঅ্যাপে শেয়ার করতে পারবেন।', en: 'This feature is coming soon — design a customized catalog of your products and share it directly to WhatsApp.' , hi: 'यह फीचर जल्द आ रहा है — अपने प्रोडक्ट का कस्टम कैटलॉग डिज़ाइन करके सीधे व्हाट्सऐप पर शेयर कर सकेंगे।' },

  // ── Settings ─────────────────────────────────────────────────
  'settings.title': { bn: 'সেটিংস',                  en: 'Settings' , hi: 'सेटिंग्स' },
  'settings.profile': { bn: 'প্রোফাইল',                en: 'Profile' , hi: 'प्रोफ़ाइल' },
  'settings.shopBilling': { bn: 'দোকান ও বিলিং তথ্য',      en: 'Shop & Billing Info' , hi: 'दुकान और बिलिंग जानकारी' },
  'settings.shopBillingSub': { bn: 'ইনভয়েস/রসিদে এই তথ্য দেখানো হবে', en: 'This info will appear on invoices/receipts' , hi: 'यह जानकारी इनवॉइस/रसीद पर दिखाई जाएगी' },
  'settings.shopName': { bn: 'দোকানের নাম',             en: 'Shop Name' , hi: 'दुकान का नाम' },
  'settings.ownerName': { bn: 'মালিকের নাম',             en: "Owner's Name" , hi: 'मालिक का नाम' },
  'settings.phone': { bn: 'ফোন নম্বর',               en: 'Phone Number' , hi: 'फ़ोन नंबर' },
  'settings.gstin': { bn: 'GSTIN (ঐচ্ছিক)',          en: 'GSTIN (optional)' , hi: 'GSTIN (वैकल्पिक)' },
  'settings.upi': { bn: 'UPI ID (ঐচ্ছিক)',         en: 'UPI ID (optional)' , hi: 'UPI ID (वैकल्पिक)' },
  'settings.address': { bn: 'ঠিকানা',                  en: 'Address' , hi: 'पता' },
  'settings.receiptFooter': { bn: 'রসিদের নিচে বার্তা (ঐচ্ছিক)', en: 'Receipt footer message (optional)' , hi: 'रसीद के नीचे संदेश (वैकल्पिक)' },
  'settings.voiceLang': { bn: 'Voice ভাষা',              en: 'Voice Language' , hi: 'वॉइस भाषा' },
  'settings.appLang': { bn: 'অ্যাপের ভাষা',            en: 'App Language' , hi: 'ऐप की भाषा' },
  'settings.account': { bn: 'Account',                  en: 'Account' , hi: 'अकाउंट' },

  // ── Mobile bottom nav ────────────────────────────────────────
  'mobile.home': { bn: 'হোম',                    en: 'Home' , hi: 'होम' },
  'mobile.agents': { bn: 'এজেন্ট',                 en: 'Agents' , hi: 'एजेंट' },
  'mobile.stock': { bn: 'স্টক',                   en: 'Stock' , hi: 'स्टॉक' },
  'mobile.sales': { bn: 'বিক্রি',                 en: 'Sales' , hi: 'बिक्री' },
  'mobile.more': { bn: 'আরও',                    en: 'More' , hi: 'और' },
} as const

export type DictionaryKey = keyof typeof dictionary
