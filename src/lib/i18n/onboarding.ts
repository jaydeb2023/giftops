import type { Lang } from './dictionary'

// Copy for the first-run onboarding flow (/welcome), in all three languages.
const bn = {
  tagline: 'বাংলার ব্যবসার AI সহকারী',
  values: ['সহজে', 'দ্রুত', 'আপনার ভাষায়'],
  chips: { sales: 'বিক্রি', stock: 'স্টক', customers: 'গ্রাহক', dues: 'বাকি', invoice: 'ইনভয়েস', ai: 'সবকিছু\nAI দিয়ে', supplier: 'সরবরাহকারী', reports: 'রিপোর্ট' },
  splash: {
    h1: 'আপনার ব্যবসা,', h2: 'এখন আরও সহজ',
    sub: 'স্টক, বিক্রি, গ্রাহক, বাকি, ইনভয়েস, রিপোর্ট এবং আরও অনেক কিছু — এখন আপনার নিজের AI সহকারী Sahayak এর সাথে।',
    start: 'শুরু করুন', returning: 'আমি আগে ব্যবহার করেছি',
  },
  slide2: {
    h1: 'আপনার ব্যবসার', h2: 'সব কিছু এক জায়গায়',
    sub: 'স্টক, বিক্রি, গ্রাহক, বাকি, ইনভয়েস, সরবরাহকারী, রিপোর্ট এবং আরও অনেক কিছু — এখন একটাই অ্যাপে, Sahayak AI এর সাথে।',
  },
  slide3: {
    h1: 'AI দিয়ে আপনার', h2: 'ব্যবসা আরও সহজ',
    sub: 'শুধু বলুন বা লিখুন, Sahayak AI করে দেবে আপনার সব কাজ।',
    stats: { sales: 'আজকের বিক্রি', stock: 'মোট স্টক', customers: 'মোট গ্রাহক', low: 'কম স্টক', view: 'দেখুন' },
    features: [
      { t: 'কথা বলুন বা লিখুন', s: 'প্রাকৃতিক ভাষায় আপনার কাজ বলুন' },
      { t: 'স্টক ও পণ্য ব্যবস্থাপনা', s: 'স্টক যোগ, আপডেট, কম স্টকের সতর্কতা' },
      { t: 'গ্রাহক ও বাকি', s: 'নতুন গ্রাহক, বাকি ট্র্যাক ও ফলো-আপ' },
      { t: 'বিক্রি ও ইনভয়েস', s: 'দ্রুত বিক্রি যোগ করুন ও ইনভয়েস তৈরি করুন' },
      { t: 'রিপোর্ট ও বিশ্লেষণ', s: 'আপনার ব্যবসার উন্নতি দেখুন' },
    ],
  },
  next: 'পরবর্তী', skip: 'এড়িয়ে যান', back: 'ফিরুন',
  steps: ['ভাষা', 'অ্যাকাউন্ট', 'প্রস্তুত'],
  language: { h1: 'আপনার', h2: 'ভাষা নির্বাচন করুন', sub: 'Sahayak AI আপনার পছন্দের ভাষায় আপনার সাথে কথা বলবে।', hint: { bn: 'বাংলায় কথা বলুন', hi: 'हिंदी में बात करें', en: 'Use in English' } },
  account: {
    h1: 'অ্যাকাউন্ট', h2: 'তৈরি করুন', sub: 'কয়েকটি তথ্য দিয়ে শুরু করুন, আর AI আপনাকে সাহায্য করবে আপনার ব্যবসা সহজ করতে।',
    name: 'আপনার নাম', email: 'ইমেইল', password: 'পাসওয়ার্ড তৈরি করুন', create: 'অ্যাকাউন্ট তৈরি করুন', or: 'অথবা', google: 'Google দিয়ে শুরু করুন',
    termsPre: 'অ্যাকাউন্ট তৈরি করলে আপনি আমাদের ', terms: 'গোপনীয়তা নীতি', termsPost: '-তে সম্মত হন।',
    errFill: 'নাম, ইমেইল ও পাসওয়ার্ড দিন', errPass: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', errExists: 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে', errGeneric: 'সমস্যা হয়েছে। আবার চেষ্টা করুন।', errGoogle: 'Google লগইনে সমস্যা হয়েছে। আবার চেষ্টা করুন।',
  },
  ready: {
    h: 'সব প্রস্তুত!', sub: 'আপনার অ্যাকাউন্ট তৈরি হয়েছে। ৭ দিনের ফ্রি ট্রায়াল শুরু হলো।',
    verify: 'আপনার ইমেইলে একটি লিঙ্ক পাঠানো হয়েছে। সেটিতে ক্লিক করে ভেরিফাই করুন, তারপর লগইন করুন।',
    go: 'ড্যাশবোর্ডে যান', login: 'লগইন করুন',
  },
}
type Copy = typeof bn

const hi: Copy = {
  tagline: 'आपके व्यवसाय का AI सहायक',
  values: ['आसान', 'तेज़', 'आपकी भाषा में'],
  chips: { sales: 'बिक्री', stock: 'स्टॉक', customers: 'ग्राहक', dues: 'बकाया', invoice: 'इनवॉइस', ai: 'सब कुछ\nAI से', supplier: 'सप्लायर', reports: 'रिपोर्ट' },
  splash: {
    h1: 'आपका व्यवसाय,', h2: 'अब और आसान',
    sub: 'स्टॉक, बिक्री, ग्राहक, बकाया, इनवॉइस, रिपोर्ट और बहुत कुछ — अब आपके अपने AI सहायक Sahayak के साथ।',
    start: 'शुरू करें', returning: 'मैं पहले इस्तेमाल कर चुका हूँ',
  },
  slide2: {
    h1: 'आपके व्यवसाय का', h2: 'सब कुछ एक जगह',
    sub: 'स्टॉक, बिक्री, ग्राहक, बकाया, इनवॉइस, सप्लायर, रिपोर्ट और बहुत कुछ — अब एक ही ऐप में, Sahayak AI के साथ।',
  },
  slide3: {
    h1: 'AI से आपका', h2: 'व्यवसाय और आसान',
    sub: 'बस बोलिए या लिखिए, Sahayak AI आपके सारे काम कर देगा।',
    stats: { sales: 'आज की बिक्री', stock: 'कुल स्टॉक', customers: 'कुल ग्राहक', low: 'कम स्टॉक', view: 'देखें' },
    features: [
      { t: 'बोलें या लिखें', s: 'अपनी भाषा में अपना काम बताएं' },
      { t: 'स्टॉक और प्रोडक्ट मैनेजमेंट', s: 'स्टॉक जोड़ें, अपडेट करें, कम स्टॉक की चेतावनी' },
      { t: 'ग्राहक और बकाया', s: 'नए ग्राहक, बकाया ट्रैक और फॉलो-अप' },
      { t: 'बिक्री और इनवॉइस', s: 'तुरंत बिक्री जोड़ें और इनवॉइस बनाएं' },
      { t: 'रिपोर्ट और विश्लेषण', s: 'अपने व्यवसाय की तरक्की देखें' },
    ],
  },
  next: 'अगला', skip: 'छोड़ें', back: 'वापस',
  steps: ['भाषा', 'अकाउंट', 'तैयार'],
  language: { h1: 'अपनी', h2: 'भाषा चुनें', sub: 'Sahayak AI आपसे आपकी पसंद की भाषा में बात करेगा।', hint: { bn: 'বাংলায় কথা বলুন', hi: 'हिंदी में बात करें', en: 'Use in English' } },
  account: {
    h1: 'अकाउंट', h2: 'बनाएं', sub: 'कुछ जानकारी देकर शुरू करें, और AI आपके व्यवसाय को आसान बनाने में मदद करेगा।',
    name: 'आपका नाम', email: 'ईमेल', password: 'पासवर्ड बनाएं', create: 'अकाउंट बनाएं', or: 'या', google: 'Google से शुरू करें',
    termsPre: 'अकाउंट बनाकर आप हमारी ', terms: 'गोपनीयता नीति', termsPost: ' से सहमत होते हैं।',
    errFill: 'नाम, ईमेल और पासवर्ड भरें', errPass: 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए', errExists: 'इस ईमेल से पहले से अकाउंट है', errGeneric: 'कुछ गड़बड़ हुई। फिर से कोशिश करें।', errGoogle: 'Google लॉगिन में समस्या हुई। फिर से कोशिश करें।',
  },
  ready: {
    h: 'सब तैयार!', sub: 'आपका अकाउंट बन गया है। 7 दिन का फ्री ट्रायल शुरू हो गया।',
    verify: 'आपके ईमेल पर एक लिंक भेजा गया है। उस पर क्लिक करके वेरिफाई करें, फिर लॉगिन करें।',
    go: 'डैशबोर्ड पर जाएं', login: 'लॉगिन करें',
  },
}

const en: Copy = {
  tagline: "Your business's AI assistant",
  values: ['Simple', 'Fast', 'In your language'],
  chips: { sales: 'Sales', stock: 'Stock', customers: 'Customers', dues: 'Dues', invoice: 'Invoice', ai: 'Everything\nwith AI', supplier: 'Suppliers', reports: 'Reports' },
  splash: {
    h1: 'Your business,', h2: 'now much easier',
    sub: 'Stock, sales, customers, dues, invoices, reports and more — now with your very own AI assistant, Sahayak.',
    start: 'Get started', returning: "I've used it before",
  },
  slide2: {
    h1: 'Your whole business', h2: 'in one place',
    sub: 'Stock, sales, customers, dues, invoices, suppliers, reports and more — now in a single app, with Sahayak AI.',
  },
  slide3: {
    h1: 'Make your business', h2: 'easier with AI',
    sub: 'Just speak or type, and Sahayak AI will get your work done.',
    stats: { sales: "Today's sales", stock: 'Total stock', customers: 'Total customers', low: 'Low stock', view: 'View' },
    features: [
      { t: 'Speak or type', s: 'Tell your work in your own language' },
      { t: 'Stock & product management', s: 'Add stock, update, low-stock alerts' },
      { t: 'Customers & dues', s: 'New customers, track dues and follow-ups' },
      { t: 'Sales & invoices', s: 'Add sales fast and create invoices' },
      { t: 'Reports & insights', s: 'See how your business is growing' },
    ],
  },
  next: 'Next', skip: 'Skip', back: 'Back',
  steps: ['Language', 'Account', 'Ready'],
  language: { h1: 'Choose your', h2: 'language', sub: 'Sahayak AI will talk to you in the language you prefer.', hint: { bn: 'বাংলায় কথা বলুন', hi: 'हिंदी में बात करें', en: 'Use in English' } },
  account: {
    h1: 'Create your', h2: 'account', sub: 'Share a few details to get started, and AI will help make your business easier.',
    name: 'Your name', email: 'Email', password: 'Create a password', create: 'Create account', or: 'or', google: 'Continue with Google',
    termsPre: 'By creating an account you agree to our ', terms: 'Privacy Policy', termsPost: '.',
    errFill: 'Please enter name, email and password', errPass: 'Password must be at least 6 characters', errExists: 'An account with this email already exists', errGeneric: 'Something went wrong. Please try again.', errGoogle: 'Google sign-in failed. Please try again.',
  },
  ready: {
    h: "You're all set!", sub: 'Your account is created. Your 7-day free trial has started.',
    verify: "We've sent a link to your email. Click it to verify, then log in.",
    go: 'Go to dashboard', login: 'Log in',
  },
}

export const ONBOARDING: Record<Lang, Copy> = { bn, hi, en }
export const ONBOARDED_KEY = 'sahayak_onboarded'
export const PENDING_LANG_KEY = 'kaaj_lang_pending'
