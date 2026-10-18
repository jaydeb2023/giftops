// src/lib/productDictionary.ts
// ─────────────────────────────────────────────────────────────────
// Built-in product dictionary + sound-alike matcher.
//
// Voice input (Whisper) and Bengali typing turn "Paracetamol" into
// "প্রারাসিটামন", "তেরাসিটমাল", "প্যারাসিটামল" … so exact / simple fuzzy
// matching misses it and the chat model starts guessing. Every product
// here has English + Bengali + common mis-spellings. Matching works on
// three levels:
//   1. exact alias           (প্যারাসিটামল, napa, dolo)
//   2. sound-alike skeleton  (consonant skeleton of the Latin spelling)
//   3. plain edit distance
// and returns a confidence so the caller can decide: auto-match,
// "did you mean…?", or "unknown — show the form". It NEVER invents a
// product: unknown stays unknown.
// ─────────────────────────────────────────────────────────────────
import { toLatin } from '@/lib/catalogSlug'

export interface DictEntry {
  name: string          // canonical name shown to the owner
  aliases: string[]     // Bengali / Banglish / brand names / common mis-spellings
  category: string
  unit: string          // default unit
  kind: 'medicine' | 'grocery' | 'cloth' | 'sweet' | 'food' | 'other'
}

// name | aliases (| separated) | category | unit
type Row = [string, string, string, string]

const MEDICINES: Row[] = [
  ['Paracetamol', 'প্যারাসিটামল|প্যারাসিটামোল|প্যারাসেটামল|প্যারা|নাপা|napa|ace|এস|dolo|ডোলো|calpol|ক্যালপল|crocin|ক্রোসিন|pacimol|প্যাসিমল', 'জ্বর/ব্যথা', 'পাতা'],
  ['Ibuprofen', 'আইবুপ্রোফেন|ibugesic|brufen|ব্রুফেন|combiflam|কম্বিফ্লাম', 'জ্বর/ব্যথা', 'পাতা'],
  ['Diclofenac', 'ডাইক্লোফেনাক|ডাইক্লো|voveran|ভোভেরান|clofenac', 'জ্বর/ব্যথা', 'পাতা'],
  ['Aceclofenac', 'অ্যাসিক্লোফেনাক|aceclo|zerodol|জেরোডল|flexon|ফ্লেক্সন', 'জ্বর/ব্যথা', 'পাতা'],
  ['Naproxen', 'ন্যাপ্রোক্সেন|naprosyn|ন্যাপ্রোসিন', 'জ্বর/ব্যথা', 'পাতা'],
  ['Nimesulide', 'নিমেসুলাইড|nise|নাইস|nimulid', 'জ্বর/ব্যথা', 'পাতা'],
  ['Aspirin', 'অ্যাসপিরিন|ecosprin|ইকোসপ্রিন|disprin|ডিসপ্রিন', 'হার্ট', 'পাতা'],
  ['Amoxicillin', 'অ্যামোক্সিসিলিন|অ্যামক্সিসিলিন|amoxy|মক্সিল|mox|novamox', 'অ্যান্টিবায়োটিক', 'পাতা'],
  ['Amoxicillin Clavulanate', 'অগমেন্টিন|augmentin|ক্লাভুলানেট|clavam|ক্ল্যাভাম|moxclav', 'অ্যান্টিবায়োটিক', 'পাতা'],
  ['Azithromycin', 'অ্যাজিথ্রোমাইসিন|আজিথ্রোমাইসিন|azithral|অ্যাজিথ্রাল|azee|আজি|zithrox', 'অ্যান্টিবায়োটিক', 'পাতা'],
  ['Ciprofloxacin', 'সিপ্রোফ্লক্সাসিন|সিপ্রো|cipro|ciplox|সিপ্লক্স', 'অ্যান্টিবায়োটিক', 'পাতা'],
  ['Levofloxacin', 'লেভোফ্লক্সাসিন|levoflox|লেভো|tavanic', 'অ্যান্টিবায়োটিক', 'পাতা'],
  ['Ofloxacin', 'অফ্লক্সাসিন|oflox|zanocin', 'অ্যান্টিবায়োটিক', 'পাতা'],
  ['Cefixime', 'সেফিক্সিম|cefix|সেফিক্স|taxim-o|zifi|জিফি', 'অ্যান্টিবায়োটিক', 'পাতা'],
  ['Cefpodoxime', 'সেফপোডক্সিম|cefpo|ক্যান্টাব|monocef', 'অ্যান্টিবায়োটিক', 'পাতা'],
  ['Cefuroxime', 'সেফুরক্সিম|zinnat|জিন্যাট|ceftum', 'অ্যান্টিবায়োটিক', 'পাতা'],
  ['Doxycycline', 'ডক্সিসাইক্লিন|ডক্সি|doxy|doxt', 'অ্যান্টিবায়োটিক', 'পাতা'],
  ['Metronidazole', 'মেট্রোনিডাজল|মেট্রো|flagyl|ফ্ল্যাজিল|metrogyl|মেট্রোজিল', 'অ্যান্টিবায়োটিক', 'পাতা'],
  ['Norfloxacin Tinidazole', 'নরফ্লক্সাসিন|norflox|নরফ্লক্স|norflox-tz|টিনিডাজল|tinidazole|টিনি', 'পেটের', 'পাতা'],
  ['Ornidazole', 'অর্নিডাজল|ornof|অরনফ|oflox-oz', 'পেটের', 'পাতা'],
  ['Fluconazole', 'ফ্লুকোনাজল|forcan|ফোর্ক্যান|zocon', 'ছত্রাক', 'পাতা'],
  ['Albendazole', 'অ্যালবেন্ডাজল|albendazole|zentel|জেন্টেল|বেনডেক্স|কৃমির ওষুধ', 'কৃমি', 'পাতা'],
  ['Cetirizine', 'সেটিরিজিন|সিটিরিজিন|cetrizine|cetzine|সেটজিন|okacet|অকাসেট|alerid|অ্যালারিড', 'অ্যালার্জি', 'পাতা'],
  ['Levocetirizine', 'লেভোসেটিরিজিন|levocet|লেভোসেট|xyzal|vozet', 'অ্যালার্জি', 'পাতা'],
  ['Fexofenadine', 'ফেক্সোফেনাডিন|fexo|allegra|অ্যালেগ্রা', 'অ্যালার্জি', 'পাতা'],
  ['Montelukast', 'মন্টেলুকাস্ট|montair|মন্টেয়ার|montek|singulair', 'অ্যালার্জি', 'পাতা'],
  ['Chlorpheniramine', 'ক্লোরফেনিরামিন|cpm|avil|অ্যাভিল', 'অ্যালার্জি', 'পাতা'],
  ['Omeprazole', 'ওমিপ্রাজল|ওমেপ্রাজল|omez|ওমেজ|prilosec|ocid|ওসিড', 'গ্যাস/অম্বল', 'পাতা'],
  ['Pantoprazole', 'প্যান্টোপ্রাজল|প্যান্টোপ|pantop|pan 40|pan-d|প্যান|pantocid|প্যান্টোসিড', 'গ্যাস/অম্বল', 'পাতা'],
  ['Rabeprazole', 'রেবিপ্রাজল|razo|রেজো|rabicip|rablet', 'গ্যাস/অম্বল', 'পাতা'],
  ['Esomeprazole', 'এসোমিপ্রাজল|nexium|নেক্সিয়াম|sompraz', 'গ্যাস/অম্বল', 'পাতা'],
  ['Ranitidine', 'র‍্যানিটিডিন|ranitidine|zinetac|জিনেট্যাক|rantac', 'গ্যাস/অম্বল', 'পাতা'],
  ['Domperidone', 'ডমপেরিডন|domstal|ডমস্টাল|vomistop|domperi', 'গ্যাস/অম্বল', 'পাতা'],
  ['Ondansetron', 'অনডানসেট্রন|ondem|অনডেম|emeset|zofran|বমির ওষুধ', 'বমি', 'পাতা'],
  ['Gelusil', 'জেলুসিল|antacid|অ্যান্টাসিড|digene|ডাইজিন|mucaine|eno|ইনো|gaviscon', 'গ্যাস/অম্বল', 'বোতল'],
  ['Dicyclomine', 'ডাইসাইক্লোমিন|cyclopam|সাইক্লোপাম|meftal-spas|মেফটাল স্পাস|spasmo', 'পেটের', 'পাতা'],
  ['Loperamide', 'লোপেরামাইড|eldoper|এলডোপার|imodium|ইমোডিয়াম', 'পেটের', 'পাতা'],
  ['ORS', 'ওআরএস|ও আর এস|ors|স্যালাইন|ওরস্যালাইন|electral|ইলেক্ট্রাল', 'পেটের', 'প্যাকেট'],
  ['Zinc', 'জিঙ্ক|zinc|zincovit|জিনকোভিট|zinconia', 'ভিটামিন', 'পাতা'],
  ['Metformin', 'মেটফরমিন|মেটফর্মিন|glycomet|গ্লাইকোমেট|glucophage|গ্লুকোফেজ', 'ডায়াবেটিস', 'পাতা'],
  ['Glimepiride', 'গ্লিমিপিরাইড|amaryl|অ্যামারিল|glimy|glimestar', 'ডায়াবেটিস', 'পাতা'],
  ['Gliclazide', 'গ্লিক্লাজাইড|diamicron|ডায়ামাইক্রন|reclide', 'ডায়াবেটিস', 'পাতা'],
  ['Insulin', 'ইনসুলিন|mixtard|মিক্সটার্ড|lantus|ল্যান্টাস|human insulin', 'ডায়াবেটিস', 'বোতল'],
  ['Amlodipine', 'অ্যামলোডিপিন|amlodac|amlogard|অ্যামলোগার্ড|norvasc|stamlo', 'প্রেসার', 'পাতা'],
  ['Atenolol', 'অ্যাটেনোলল|aten|tenormin|বিটা ব্লকার', 'প্রেসার', 'পাতা'],
  ['Metoprolol', 'মেটোপ্রোলল|metolar|betaloc', 'প্রেসার', 'পাতা'],
  ['Losartan', 'লোসার্টান|losar|লোসার|cozaar|repace', 'প্রেসার', 'পাতা'],
  ['Telmisartan', 'টেলমিসার্টান|telma|টেলমা|telsartan', 'প্রেসার', 'পাতা'],
  ['Enalapril', 'এনালাপ্রিল|envas|এনভাস|enam', 'প্রেসার', 'পাতা'],
  ['Hydrochlorothiazide', 'হাইড্রোক্লোরোথায়াজাইড|hctz|aquazide', 'প্রেসার', 'পাতা'],
  ['Furosemide', 'ফুরোসেমাইড|lasix|লাসিক্স|frusemide', 'প্রেসার', 'পাতা'],
  ['Atorvastatin', 'অ্যাটোরভাস্টাটিন|atorva|অ্যাটোর্ভা|lipitor|storvas|টরভাস', 'কোলেস্টেরল', 'পাতা'],
  ['Rosuvastatin', 'রসুভাস্টাটিন|rosuvas|ক্রেস্টর|crestor|rozavel', 'কোলেস্টেরল', 'পাতা'],
  ['Clopidogrel', 'ক্লোপিডোগ্রেল|clopilet|ক্লোপিলেট|plavix|deplatt', 'হার্ট', 'পাতা'],
  ['Salbutamol', 'সালবিউটামল|asthalin|অ্যাসথালিন|ventolin|ভেন্টোলিন|সালবুটামল', 'শ্বাসকষ্ট', 'বোতল'],
  ['Deriphyllin', 'ডেরিফাইলিন|theophylline|থিওফাইলিন|etofylline', 'শ্বাসকষ্ট', 'পাতা'],
  ['Prednisolone', 'প্রেডনিসোলন|wysolone|ওয়াইসোলোন|omnacortil', 'স্টেরয়েড', 'পাতা'],
  ['Dexamethasone', 'ডেক্সামেথাসোন|dexona|ডেক্সোনা|decdan', 'স্টেরয়েড', 'পাতা'],
  ['Pregabalin', 'প্রিগাবালিন|lyrica|লিরিকা|pregabid|nervijen', 'স্নায়ু', 'পাতা'],
  ['Gabapentin', 'গ্যাবাপেনটিন|gabapin|গ্যাবাপিন|neurontin', 'স্নায়ু', 'পাতা'],
  ['Alprazolam', 'অ্যালপ্রাজোলাম|alprax|অ্যালপ্র্যাক্স|restyl', 'ঘুম/স্নায়ু', 'পাতা'],
  ['Vitamin C', 'ভিটামিন সি|vit c|limcee|লিমসি|celin|সেলিন|চিউয়েবল সি', 'ভিটামিন', 'পাতা'],
  ['Vitamin B Complex', 'ভিটামিন বি কমপ্লেক্স|b complex|বি কমপ্লেক্স|becosules|বেকসুলস|neurobion|নিউরোবিয়ন|polybion', 'ভিটামিন', 'পাতা'],
  ['Vitamin D3', 'ভিটামিন ডি থ্রি|vitamin d|ভিটামিন ডি|calcirol|ক্যালসিরল|d rise|uprise|কোলেক্যালসিফেরল', 'ভিটামিন', 'পাতা'],
  ['Calcium', 'ক্যালসিয়াম|shelcal|শেলক্যাল|calcium sandoz|ওস্টিওকেয়ার|calcimax|ক্যালসিমাক্স|cal-d', 'ভিটামিন', 'পাতা'],
  ['Iron Folic Acid', 'আয়রন|আয়রন ফলিক|orofer|ওরোফার|autrin|ferrous|ফেরাস|dexorange|ডেক্সোরেঞ্জ|ফলিক অ্যাসিড|folic acid|folvite', 'ভিটামিন', 'পাতা'],
  ['Multivitamin', 'মাল্টিভিটামিন|মাল্টি ভিটামিন|supradyn|সুপ্রাডিন|revital|রিভাইটাল|zincovit', 'ভিটামিন', 'পাতা'],
  ['Cough Syrup', 'কাশির সিরাপ|কাশির ওষুধ|কফ সিরাপ|benadryl|বেনাড্রিল|corex|কোরেক্স|ascoril|অ্যাসকরিল|grilinctus|টসেক্স|tossex|phensedyl|ফেনসিডিল', 'কাশি', 'বোতল'],
  ['Ambroxol', 'অ্যামব্রক্সল|ambrodil|ambrolite|mucolite|মিউকোলাইট', 'কাশি', 'বোতল'],
  ['Bromhexine', 'ব্রোমহেক্সিন|solvin|সলভিন|bisolvon', 'কাশি', 'বোতল'],
  ['Betadine', 'বিটাডিন|বেটাডিন|povidone|পোভিডন|পোভিডোন', 'ফার্স্ট এইড', 'বোতল'],
  ['Savlon', 'স্যাভলন|সেভলন|antiseptic|অ্যান্টিসেপটিক', 'ফার্স্ট এইড', 'বোতল'],
  ['Dettol', 'ডেটল|ডেটোল', 'ফার্স্ট এইড', 'বোতল'],
  ['Band-Aid', 'ব্যান্ড এইড|ব্যান্ডেজ|bandage|ban-aid|ব্যান্ডেড', 'ফার্স্ট এইড', 'বক্স'],
  ['Cotton', 'তুলো|তুলা|cotton|কটন|ক্যাটন', 'ফার্স্ট এইড', 'প্যাকেট'],
  ['Volini', 'ভোলিনি|ভলিনি|moov|মুভ|pain balm|বাম|ব্যথার মলম|diclogesic|জেল|gel', 'ব্যথার মলম', 'টিউব'],
  ['Burnol', 'বার্নল|বার্ণল|silverex|সিলভারেক্স|পোড়ার মলম', 'মলম', 'টিউব'],
  ['Soframycin', 'সফ্রামাইসিন|neosporin|নিওস্পোরিন|framycin|ক্ষতের মলম', 'মলম', 'টিউব'],
  ['Clotrimazole', 'ক্লোট্রিমাজল|candid|ক্যানডিড|surfaz|daktarin', 'মলম', 'টিউব'],
  ['Eye Drop', 'আই ড্রপ|চোখের ড্রপ|চোখের ওষুধ|ciplox eye|টোব্রামাইসিন|tobramycin|refresh tears|রিফ্রেশ', 'চোখ', 'বোতল'],
  ['Ear Drop', 'কান ড্রপ|কানের ড্রপ|কানের ওষুধ|otogesic|waxol', 'কান', 'বোতল'],
  ['Nasal Drop', 'নাকের ড্রপ|নেজাল ড্রপ|otrivin|অট্রিভিন|nasivion|নাসিভিয়ন', 'সর্দি', 'বোতল'],
  ['Sinarest', 'সিনারেস্ট|sinarest|সর্দির ওষুধ|cold act|কোল্ড অ্যাক্ট|d cold|ডি কোল্ড|vicks action|ভিকস অ্যাকশন', 'সর্দি', 'পাতা'],
  ['Vicks', 'ভিক্স|ভিকস|vicks vaporub|vaporub|ভেপোরাব', 'সর্দি', 'টিউব'],
  ['Thermometer', 'থার্মোমিটার|থার্মোমিটর|জ্বর মাপার যন্ত্র', 'ডিভাইস', 'পিস'],
  ['Glucometer Strip', 'গ্লুকোমিটার|গ্লুকোমিটার স্ট্রিপ|সুগার মাপার|accu-chek|অ্যাকিউ চেক|onetouch|ওয়ান টাচ', 'ডিভাইস', 'বক্স'],
  ['BP Machine', 'বিপি মেশিন|প্রেশার মেশিন|ব্লাড প্রেসার মেশিন|omron|ওমরন', 'ডিভাইস', 'পিস'],
  ['Mask', 'মাস্ক|mask|n95|এন নাইন্টি ফাইভ', 'ফার্স্ট এইড', 'প্যাকেট'],
  ['Sanitizer', 'স্যানিটাইজার|sanitizer|হ্যান্ড স্যানিটাইজার', 'ফার্স্ট এইড', 'বোতল'],
  ['Condom', 'কনডম|condom|কোহিনূর|kamasutra|manforce|ম্যানফোর্স', 'পারিবারিক', 'প্যাকেট'],
  ['Pregnancy Test Kit', 'প্রেগনেন্সি কিট|প্রেগা নিউজ|prega news|pregakit|গর্ভাবস্থা পরীক্ষা', 'ডিভাইস', 'পিস'],
  ['Contraceptive Pill', 'খাবার বড়ি|গর্ভনিরোধক|মালা ডি|mala-d|মালা-ডি|saheli|unwanted 72|আনওয়ান্টেড', 'পারিবারিক', 'পাতা'],
  ['Sildenafil', 'সিল্ডেনাফিল|viagra|ভায়াগ্রা|manforce tab', 'পুরুষ', 'পাতা'],
  ['Tamsulosin', 'ট্যামসুলোসিন|urimax|ইউরিম্যাক্স|flomax|veltam', 'ইউরোলজি', 'পাতা'],
  ['Levothyroxine', 'লেভোথাইরক্সিন|thyronorm|থাইরোনর্ম|eltroxin|ইলট্রক্সিন|thyroxine|থাইরক্সিন', 'থাইরয়েড', 'পাতা'],
  ['Hyoscine', 'হায়োসিন|buscopan|বুসকোপান|spasmonil', 'পেটের', 'পাতা'],
  ['Lactulose', 'ল্যাকটুলোজ|duphalac|ডুফালাক|cremaffin|ক্রিমাফিন|কোষ্ঠকাঠিন্যের ওষুধ', 'পেটের', 'বোতল'],
  ['Isabgol', 'ইসবগুল|ispaghula|ইসপগুল|সাইলিয়াম', 'পেটের', 'প্যাকেট'],
  ['Glucose D', 'গ্লুকোজ|glucon-d|গ্লুকন ডি|glucose powder|গ্লুকোজ পাউডার', 'এনার্জি', 'প্যাকেট'],
  ['Gastro', 'গ্যাস্ট্রো|gastro|gastrone|গ্যাসের ওষুধ|গ্যাসের ট্যাবলেট', 'গ্যাস/অম্বল', 'পাতা'],
]

const GROCERY: Row[] = [
  ['Chal', 'চাল|চাউল|rice|চাল মোটা|মোটা চাল|সরু চাল|মিনিকেট|minikit|বাসমতী|basmati|গোবিন্দভোগ|govindobhog|সিদ্ধ চাল', 'চাল-ডাল', 'কেজি'],
  ['Atta', 'আটা|atta|aata|গমের আটা|wheat flour|আশীর্বাদ আটা', 'চাল-ডাল', 'কেজি'],
  ['Maida', 'ময়দা|maida|moyda|ময়দা আটা', 'চাল-ডাল', 'কেজি'],
  ['Suji', 'সুজি|suji|shuji|semolina|রাওয়া|rava', 'চাল-ডাল', 'কেজি'],
  ['Chini', 'চিনি|chini|sugar|সুগার|চিনি দানা', 'মশলা-চিনি', 'কেজি'],
  ['Nun', 'নুন|লবণ|নুন লবণ|salt|nun|labon|টাটা নুন|আয়োডিন নুন', 'মশলা-চিনি', 'কেজি'],
  ['Sorser Tel', 'সরিষার তেল|সর্ষের তেল|mustard oil|sorsher tel|sorser tel|কাচ্চি ঘানি|ঘানির তেল', 'তেল', 'লিটার'],
  ['Soyabin Tel', 'সয়াবিন তেল|সয়াবিন|soybean oil|soyabean|সোয়াবিন', 'তেল', 'লিটার'],
  ['Refined Tel', 'রিফাইন্ড তেল|রিফাইন তেল|refined oil|সানফ্লাওয়ার তেল|sunflower oil|ফরচুন|fortune', 'তেল', 'লিটার'],
  ['Ghee', 'ঘি|ghee|গাওয়া ঘি|দেশি ঘি|অমুল ঘি|amul ghee', 'তেল', 'কেজি'],
  ['Musur Dal', 'মুসুর ডাল|মসুর ডাল|masoor dal|musur|মুসুর', 'চাল-ডাল', 'কেজি'],
  ['Moong Dal', 'মুগ ডাল|মুগের ডাল|moong dal|mug dal|মুগ', 'চাল-ডাল', 'কেজি'],
  ['Chola Dal', 'ছোলার ডাল|ছোলা ডাল|chola dal|chana dal|ছোলা|চানা', 'চাল-ডাল', 'কেজি'],
  ['Arhar Dal', 'অড়হর ডাল|অরহর ডাল|arhar dal|toor dal|তুর ডাল|অড়হর', 'চাল-ডাল', 'কেজি'],
  ['Khesari Dal', 'খেসারি ডাল|খেসারির ডাল|khesari', 'চাল-ডাল', 'কেজি'],
  ['Matar Dal', 'মটর ডাল|মটরের ডাল|matar dal|মটর|কলাই ডাল|বিউলির ডাল|biuli dal|অড়হর', 'চাল-ডাল', 'কেজি'],
  ['Alu', 'আলু|আলূ|aloo|alu|potato|পটেটো|চন্দ্রমুখী আলু|জ্যোতি আলু', 'সবজি', 'কেজি'],
  ['Peyaj', 'পেঁয়াজ|পিঁয়াজ|পেয়াজ|পিয়াজ|peyaj|piyaj|onion|অনিয়ন', 'সবজি', 'কেজি'],
  ['Roshun', 'রসুন|রশুন|roshun|garlic|গার্লিক', 'সবজি', 'কেজি'],
  ['Ada', 'আদা|ada|ginger|জিঞ্জার', 'সবজি', 'কেজি'],
  ['Kacha Lanka', 'কাঁচা লংকা|কাঁচা লঙ্কা|কাঁচা মরিচ|কাচা লংকা|kacha lanka|green chilli|কাঁচালংকা', 'সবজি', 'কেজি'],
  ['Tomato', 'টমেটো|টমাটো|tomato|tometo', 'সবজি', 'কেজি'],
  ['Begun', 'বেগুন|begun|brinjal|eggplant', 'সবজি', 'কেজি'],
  ['Lau', 'লাউ|lau|bottle gourd', 'সবজি', 'পিস'],
  ['Potol', 'পটল|potol|parwal', 'সবজি', 'কেজি'],
  ['Fulkopi', 'ফুলকপি|ফুল কপি|ফুল গোভি|ফুল গোবি|ফুলগোভি|ফুলকো ভি|phulkopi|phool gobhi|gobhi|cauliflower|কপি', 'সবজি', 'পিস'],
  ['Badhakopi', 'বাঁধাকপি|বাঁধা কপি|বাধাকপি|badhakopi|cabbage|পাতাকপি', 'সবজি', 'পিস'],
  ['Holud Guro', 'হলুদ গুঁড়ো|হলুদ গুড়ো|হলুদ|holud|holud guro|turmeric|হলদি', 'মশলা-চিনি', 'কেজি'],
  ['Lanka Guro', 'লংকা গুঁড়ো|লঙ্কা গুঁড়ো|লংকা গুড়ো|লাল লংকা|শুকনো লংকা|mirchi powder|chilli powder|lanka guro', 'মশলা-চিনি', 'কেজি'],
  ['Jire', 'জিরে|জিরা|জিরে গুঁড়ো|jire|jeera|cumin', 'মশলা-চিনি', 'কেজি'],
  ['Dhone', 'ধনে|ধনিয়া|ধনে গুঁড়ো|dhone|dhaniya|coriander', 'মশলা-চিনি', 'কেজি'],
  ['Garam Moshla', 'গরম মশলা|গরম মসলা|garam masala|garam moshla', 'মশলা-চিনি', 'কেজি'],
  ['Elach', 'এলাচ|এলাচি|elach|cardamom|ইলাইচ', 'মশলা-চিনি', 'কেজি'],
  ['Dalchini', 'দারুচিনি|দারচিনি|dalchini|cinnamon', 'মশলা-চিনি', 'কেজি'],
  ['Lobongo', 'লবঙ্গ|লবংগ|লং|lobongo|clove|laung', 'মশলা-চিনি', 'কেজি'],
  ['Tej Pata', 'তেজপাতা|তেজ পাতা|tej pata|bay leaf', 'মশলা-চিনি', 'কেজি'],
  ['Panch Phoron', 'পাঁচফোড়ন|পাঁচ ফোড়ন|panch phoron|পাচফোড়ন', 'মশলা-চিনি', 'কেজি'],
  ['Sorshe', 'সরিষা|সর্ষে|sorshe|mustard seed|rai', 'মশলা-চিনি', 'কেজি'],
  ['Chai Pata', 'চা পাতা|চায়ের পাতা|চা|chai|tea|চা পাতি|টাটা চা|tata tea|ওয়াঘ বকরি', 'চা-কফি', 'কেজি'],
  ['Coffee', 'কফি|coffee|nescafe|নেসক্যাফে|ব্রু|bru', 'চা-কফি', 'প্যাকেট'],
  ['Dim', 'ডিম|dim|egg|eggs|মুরগির ডিম|হাঁসের ডিম', 'ডিম-দুধ', 'ডজন'],
  ['Dudh', 'দুধ|দুধ প্যাকেট|dudh|milk|মিল্ক|amul milk|মাদার ডেয়ারি', 'ডিম-দুধ', 'লিটার'],
  ['Doi', 'দই|doi|curd|yogurt|মিষ্টি দই', 'ডিম-দুধ', 'কেজি'],
  ['Biscuit', 'বিস্কুট|biscuit|biskut|পার্লে জি|parle-g|marie|মারি|good day|গুড ডে|britannia', 'প্যাকেট খাবার', 'প্যাকেট'],
  ['Noodles', 'নুডলস|noodles|মযাগি|ম্যাগি|maggi|ইয়িপি|yippee', 'প্যাকেট খাবার', 'প্যাকেট'],
  ['Chanachur', 'চানাচুর|chanachur|bhujia|ভুজিয়া|মুড়ি|muri|চিড়ে|চিঁড়ে|chire|খই', 'প্যাকেট খাবার', 'প্যাকেট'],
  ['Sabun', 'সাবান|sabun|soap|লাক্স|lux|লাইফবয়|lifebuoy|dettol soap|ডেটল সাবান|cinthol|সিন্থল|dove|ডাভ', 'সাবান-সার্ফ', 'পিস'],
  ['Surf', 'সার্ফ|surf|ডিটারজেন্ট|detergent|সার্ফ এক্সেল|rin|রিন|wheel|হুইল|ariel|এরিয়েল|ghadi|ঘড়ি', 'সাবান-সার্ফ', 'প্যাকেট'],
  ['Shampoo', 'শ্যাম্পু|shampoo|sunsilk|সানসিল্ক|clinic plus|ক্লিনিক প্লাস|head & shoulders', 'প্রসাধনী', 'পিস'],
  ['Toothpaste', 'টুথপেস্ট|পেস্ট|toothpaste|colgate|কোলগেট|closeup|ক্লোজআপ|pepsodent|পেপসোডেন্ট|dabur red|ডাবর', 'প্রসাধনী', 'পিস'],
  ['Matchbox', 'দেশলাই|ম্যাচ|matchbox|দেশলাই বাক্স', 'বিবিধ', 'পিস'],
  ['Mombati', 'মোমবাতি|mombati|candle', 'বিবিধ', 'প্যাকেট'],
  ['Agarbati', 'ধূপ|ধুপকাঠি|আগরবাতি|agarbati|dhoop|incense', 'পূজা', 'প্যাকেট'],
  ['Pran Water', 'জল|পানি|জলের বোতল|water bottle|bisleri|বিসলেরি|mineral water|মিনারেল ওয়াটার', 'পানীয়', 'বোতল'],
  ['Cold Drink', 'কোল্ড ড্রিংক|কোল্ডড্রিংকস|coca cola|কোকা কোলা|কোক|pepsi|পেপসি|sprite|স্প্রাইট|limca|thums up|থামস আপ|মাজা|maaza|fanta|ফান্টা', 'পানীয়', 'বোতল'],
  ['Katla Fish', 'কাতলা মাছ|কাতলা|katla|katla fish', 'মাছ-মাংস', 'কেজি'],
  ['Rui Fish', 'রুই মাছ|রুই|rui|rohu', 'মাছ-মাংস', 'কেজি'],
  ['Ilish', 'ইলিশ|ইলিশ মাছ|ilish|hilsa', 'মাছ-মাংস', 'কেজি'],
  ['Chicken', 'মুরগি|মুরগির মাংস|চিকেন|chicken|murgi|broiler|ব্রয়লার', 'মাছ-মাংস', 'কেজি'],
  ['Mutton', 'খাসির মাংস|মাটন|পাঁঠার মাংস|mutton|khasi|খাসি', 'মাছ-মাংস', 'কেজি'],
  ['Gur', 'গুড়|গুড|gur|jaggery|খেজুর গুড়|নলেন গুড়|nolen gur|পাটালি|patali', 'মশলা-চিনি', 'কেজি'],
  ['Besan', 'বেসন|besan|gram flour|ছাতু|chhatu|sattu', 'চাল-ডাল', 'কেজি'],
  ['Sabudana', 'সাবুদানা|সাবু|sabudana|sago', 'চাল-ডাল', 'কেজি'],
  ['Kismis', 'কিশমিশ|kismis|raisin|কাজু|kaju|cashew|কাজুবাদাম|বাদাম|badam|almond|চিনাবাদাম|peanut|কাঠবাদাম', 'শুকনো ফল', 'কেজি'],
]


const CLOTH: Row[] = [
  ['Shirt', 'শার্ট|শার্টস|shirt|ফুল শার্ট|হাফ শার্ট|half shirt|full shirt|ফর্মাল শার্ট|formal shirt|কটন শার্ট', 'শার্ট', 'পিস'],
  ['T-Shirt', 'টি-শার্ট|টি শার্ট|টিশার্ট|t-shirt|tshirt|t shirt|পোলো|polo|গেঞ্জি|গেঞ্জী|genji|গেনজি|বনিয়ান|banian', 'শার্ট', 'পিস'],
  ['Pant', 'প্যান্ট|পেন্ট|pant|pants|trouser|ট্রাউজার|ট্রাউজারস|ফর্মাল প্যান্ট|চিনোস|chinos|কার্গো|cargo', 'প্যান্ট', 'পিস'],
  ['Jeans', 'জিন্স|জিনস|jeans|জিন্সের প্যান্ট|ডেনিম|denim', 'প্যান্ট', 'পিস'],
  ['Lungi', 'লুঙ্গি|লুংগি|লুঙি|lungi|lugi', 'লুঙ্গি', 'পিস'],
  ['Dhuti', 'ধুতি|ধুতী|dhuti|dhoti', 'ধুতি', 'পিস'],
  ['Panjabi', 'পাঞ্জাবি|পাঞ্জাবী|পাঞ্জাবি|panjabi|punjabi|kurta|কুর্তা|কুর্তি|kurti', 'পাঞ্জাবি', 'পিস'],
  ['Pajama', 'পাজামা|পায়জামা|পাইজামা|pajama|pyjama|payjama|লেগিংস|leggings|লেগিন্স|প্যালাজো|palazzo', 'পাজামা', 'পিস'],
  ['Shorts', 'হাফ প্যান্ট|শর্টস|shorts|bermuda|বারমুডা|থ্রি কোয়ার্টার|three quarter', 'প্যান্ট', 'পিস'],
  ['Saree', 'শাড়ি|শাড়ী|সাড়ি|saree|sari|sharee|তাঁতের শাড়ি|জামদানি|jamdani|বালুচরি|baluchari|কাঁথা স্টিচ|kantha|সিল্ক শাড়ি|silk saree|কটন শাড়ি|cotton saree|ঢাকাই|dhakai|তসর|tussar|গরদ|garad|ধনিয়াখালি|dhaniakhali|শান্তিপুরী|santipuri', 'শাড়ি', 'পিস'],
  ['Salwar Suit', 'সালোয়ার|সালোয়ার কামিজ|শালোয়ার|salwar|salwar kameez|kameez|কামিজ|সুট|suit|চুড়িদার|churidar|অনারকলি|anarkali|থ্রি পিস|three piece|3 piece', 'সালোয়ার', 'সেট'],
  ['Blouse', 'ব্লাউজ|ব্লাউস|blouse|ব্লাউজ পিস|blouse piece', 'ব্লাউজ', 'পিস'],
  ['Petticoat', 'সায়া|saya|petticoat|পেটিকোট|শায়া', 'অন্তর্বাস', 'পিস'],
  ['Nighty', 'নাইটি|নাইটী|nighty|night gown|নাইট ড্রেস|night dress|ম্যাক্সি|maxi', 'নাইটি', 'পিস'],
  ['Frock', 'ফ্রক|frock|ড্রেস|dress|স্কার্ট|skirt|গাউন|gown|ফ্রকের|বেবি ফ্রক|baby frock', 'বাচ্চার', 'পিস'],
  ['Kids Wear', 'বাচ্চাদের জামা|শিশুদের জামা|kids wear|kids|বেবি ড্রেস|baby dress|বাচ্চার প্যান্ট|বাচ্চার শার্ট|কিডস', 'বাচ্চার', 'পিস'],
  ['Jacket', 'জ্যাকেট|জ্যাকেট|jacket|কোট|coat|ব্লেজার|blazer|হুডি|hoodie|সোয়েটশার্ট|sweatshirt', 'শীতের', 'পিস'],
  ['Sweater', 'সোয়েটার|সুয়েটার|sweater|pullover|পুলওভার|কার্ডিগান|cardigan|উলের জামা|ওভারকোট|overcoat|monkey cap|মাঙ্কি ক্যাপ|মাফলার|muffler|শাল|shawl|চাদর|chadar|কম্বল|kombol|blanket', 'শীতের', 'পিস'],
  ['Underwear', 'জাঙ্গিয়া|জাংগিয়া|জাঙিয়া|জাঙ্গিয়া|jangia|underwear|brief|ব্রিফ|ইনার|inner|অন্তর্বাস|বক্সার|boxer|ব্রা|bra|ব্রেসিয়ার|brassiere', 'অন্তর্বাস', 'পিস'],
  ['Socks', 'মোজা|মোজাই|socks|sock|সক্স', 'অন্যান্য', 'জোড়া'],
  ['Gamchha', 'গামছা|gamchha|gamcha|towel|তোয়ালে|তোয়ালা|টাওয়েল|রুমাল|rumal|handkerchief|হ্যান্ডকারচিফ', 'অন্যান্য', 'পিস'],
  ['Dupatta', 'ওড়না|ওরনা|দোপাট্টা|dupatta|odna|scarf|স্কার্ফ|stole|স্টোল', 'অন্যান্য', 'পিস'],
  ['Bedsheet', 'চাদর|বিছানার চাদর|bedsheet|bed sheet|বেডশিট|বেড কভার|bed cover|পর্দা|porda|curtain|কার্টেন|বালিশের কভার|pillow cover|বালিশ কভার', 'ঘরের', 'পিস'],
  ['School Uniform', 'স্কুল ড্রেস|স্কুল ইউনিফর্ম|school uniform|uniform|ইউনিফর্ম|টাই|tie|বেল্ট|belt', 'ইউনিফর্ম', 'পিস'],
  ['Cloth Meter', 'কাপড়|কাপড|cloth|fabric|থান কাপড়|কাপড়ের থান|সুতির কাপড়|suti|cotton cloth|সিল্ক কাপড়|রেশমি|মিটার কাপড়', 'কাপড়', 'মিটার'],
]

const SWEET: Row[] = [
  ['Rasgulla', 'রসগোল্লা|রসগোল্লা|রসোগোল্লা|rasgulla|rosogolla|rasogolla|rosogola', 'ছানার মিষ্টি', 'কেজি'],
  ['Sandesh', 'সন্দেশ|সন্দেস|sandesh|sondesh|সন্দেশ নরম পাক|কড়া পাক সন্দেশ|নলেন গুড়ের সন্দেশ|ক্ষীর সন্দেশ|jolbhora|জলভরা', 'ছানার মিষ্টি', 'কেজি'],
  ['Mishti Doi', 'মিষ্টি দই|মিষ্টিদই|mishti doi|mishtidoi|ভাঁড়ের দই|bhar doi|লাল দই|lal doi', 'দই', 'ভাঁড়'],
  ['Doi', 'দই|টক দই|doi|curd|দই ১ কেজি|সাদা দই', 'দই', 'কেজি'],
  ['Pantua', 'পান্তুয়া|পানতুয়া|pantua|panthua|লেডিকেনি|ledikeni|lady canny|ladikeni', 'ছানার মিষ্টি', 'কেজি'],
  ['Gulab Jamun', 'গোলাপজাম|গুলাবজামুন|গুলাব জামুন|gulab jamun|gulabjamun|কালোজাম|kalojam|kalo jam|কালো জাম', 'ছানার মিষ্টি', 'কেজি'],
  ['Jilapi', 'জিলাপি|জিলিপি|জিলাপী|jilapi|jalebi|jilebi|ইমরতি|imarti', 'ভাজা মিষ্টি', 'কেজি'],
  ['Cham Cham', 'চমচম|চমচম|cham cham|chamcham|ছানার চমচম|মালাই চমচম', 'ছানার মিষ্টি', 'কেজি'],
  ['Rasmalai', 'রসমালাই|রসমলাই|rasmalai|rasmalai|রসমালাই', 'ছানার মিষ্টি', 'কেজি'],
  ['Langcha', 'ল্যাংচা|ল্যাংচা|langcha|lyangcha|শক্তিগড়ের ল্যাংচা|ল্যাংচা মিষ্টি', 'ছানার মিষ্টি', 'কেজি'],
  ['Kachagolla', 'কাঁচাগোল্লা|কাঁচা গোল্লা|কাচাগোল্লা|kachagolla|kacha golla|kachagola', 'ছানার মিষ্টি', 'কেজি'],
  ['Rajbhog', 'রাজভোগ|রাজ ভোগ|rajbhog|raj bhog|মিহিদানা|mihidana|সীতাভোগ|sitabhog|sita bhog', 'ছানার মিষ্টি', 'কেজি'],
  ['Barfi', 'বরফি|বর্ফি|barfi|burfi|kaju barfi|কাজু বরফি|কাজুকতলি|kaju katli|পেস্তা বরফি|নারকেল বরফি', 'শুকনো মিষ্টি', 'কেজি'],
  ['Peda', 'পেড়া|পেঁড়া|peda|pera|মথুরার পেড়া|দুধের পেড়া|ছানার পেড়া', 'শুকনো মিষ্টি', 'কেজি'],
  ['Laddu', 'লাড্ডু|লাড্ডু|লাডডু|laddu|ladoo|ladu|মোতিচুর|motichur|বুন্দি|boondi|নাড়ু|naru|নারু|তিলের নাড়ু|নারকেল নাড়ু', 'শুকনো মিষ্টি', 'কেজি'],
  ['Kheer Kadam', 'ক্ষীরকদম|ক্ষীর কদম|khirkodom|kheer kadam|ক্ষীরের মিষ্টি|ক্ষীরমোহন|khirmohan|kheermohan|ক্ষীর', 'ছানার মিষ্টি', 'কেজি'],
  ['Mihidana', 'মিহিদানা|mihidana|সীতাভোগ', 'ভাজা মিষ্টি', 'কেজি'],
  ['Patishapta', 'পাটিসাপটা|পাটি সাপটা|patishapta|pati shapta|পুলি|puli|পিঠে|pithe|পিঠা|pitha|নলেন গুড়ের পিঠে', 'পিঠে', 'পিস'],
  ['Sorbhaja', 'সরভাজা|সর ভাজা|sorbhaja|sarbhaja|সরপুরিয়া|sarpuria|sorpuria', 'ভাজা মিষ্টি', 'কেজি'],
  ['Chhana', 'ছানা|ছেনা|chhana|chana|ছানার জিলিপি|paneer|পনির|পনীর', 'কাঁচামাল', 'কেজি'],
  ['Khoya', 'খোয়া|খোয়াক্ষীর|khoya|khoa|mawa|মাওয়া|ক্ষীর খোয়া', 'কাঁচামাল', 'কেজি'],
  ['Cake', 'কেক|cake|কেকের|পেস্ট্রি|pastry|প্যাটিস|patties|patty|ব্রাউনি|brownie|ডোনাট|donut|কুকিজ|cookies|বিস্কুট', 'কেক-বেকারি', 'পিস'],
  ['Samosa', 'সিঙ্গাড়া|সিঙাড়া|সমোসা|সামোসা|samosa|singara|shingara|কচুরি|kachuri|kochuri|নিমকি|nimki|নিমকী|চপ|chop|ডিমের চপ|বেগুনি|beguni|পেঁয়াজি|piyaji|পিঁয়াজি', 'নোনতা', 'পিস'],
  ['Rasbora', 'রসবড়া|রসবরা|rosbora|rasbara|দহিবড়া|dahi bara|dahibara|দই বড়া', 'নোনতা', 'পিস'],
  ['Nolen Gur', 'নলেন গুড়|নলেন গুড|nolen gur|খেজুর গুড়|পাটালি গুড়|patali', 'কাঁচামাল', 'কেজি'],
  ['Sugar Syrup', 'চিনি|সুগার|sugar|chini|চিনির রস|রস', 'কাঁচামাল', 'কেজি'],
  ['Ghee', 'ঘি|ghee|গাওয়া ঘি|ডালডা|dalda|vanaspati|বনস্পতি|রিফাইন্ড তেল|refined oil', 'কাঁচামাল', 'কেজি'],
  ['Milk', 'দুধ|dudh|milk|ফুল ক্রিম দুধ|গরুর দুধ|মহিষের দুধ|দুধের ক্ষীর', 'কাঁচামাল', 'লিটার'],
  ['Dry Fruit', 'কাজু|কিশমিশ|পেস্তা|বাদাম|এলাচ|এলাচি|কেওড়া|keora|কেওড়া জল|রোজ ওয়াটার|rose water|জাফরান|saffron|কেশর|ডুমুর|কাজুবাদাম|pista|kaju|badam|kismis', 'কাঁচামাল', 'কেজি'],
]

const FOOD: Row[] = [
  ['Bhat', 'ভাত|bhat|rice plate|প্লেট ভাত|ভাত প্লেট|plain rice|steam rice', 'ভাত', 'প্লেট'],
  ['Biryani', 'বিরিয়ানি|বিরিয়ানী|বিরানি|biryani|biriyani|chicken biryani|চিকেন বিরিয়ানি|মটন বিরিয়ানি|mutton biryani|egg biryani|ডিম বিরিয়ানি', 'বিরিয়ানি', 'প্লেট'],
  ['Parota', 'পরোটা|পরটা|পরাঠা|porota|parota|paratha|লুচি|luchi|রুটি|ruti|roti|chapati|চাপাটি|তন্দুরি রুটি|tandoori roti|নান|naan|কুলচা|kulcha', 'রুটি', 'পিস'],
  ['Dal', 'ডাল|dal|ডাল ফ্রাই|dal fry|ডাল তড়কা|dal tadka', 'ডাল', 'বাটি'],
  ['Chicken Curry', 'চিকেন কারি|মুরগির ঝোল|chicken curry|chicken masala|চিকেন মসলা|বাটার চিকেন|butter chicken|চিকেন কষা|chicken kosha|কষা মাংস|kosha mangsho', 'চিকেন', 'প্লেট'],
  ['Mutton Curry', 'মটন কারি|মাংসের ঝোল|mutton curry|খাসির মাংস|মাটন কষা|mutton kosha|mutton', 'মাটন', 'প্লেট'],
  ['Fish Curry', 'মাছের ঝোল|fish curry|মাছ ভাজা|fish fry|ইলিশ ভাপা|ilish bhapa|সর্ষে ইলিশ|কাতলা কালিয়া|রুই কালিয়া|পাবদা|pabda|চিংড়ি|chingri|prawn|malaikari|মালাইকারি', 'মাছ', 'প্লেট'],
  ['Egg Roll', 'এগ রোল|ডিম রোল|egg roll|chicken roll|চিকেন রোল|কাটি রোল|kathi roll|রোল|roll|মোমো|momo|momos|চাউমিন|chowmein|chow mein|নুডলস|noodles|ফ্রাইড রাইস|fried rice', 'ফাস্ট ফুড', 'পিস'],
  ['Chai', 'চা|chai|tea|লেবু চা|lemon tea|দুধ চা|milk tea|কফি|coffee|ভাঁড়ের চা|bhar chai|আদা চা|ginger tea', 'পানীয়', 'কাপ'],
  ['Cold Drink', 'কোল্ড ড্রিংক|cold drink|coke|কোক|pepsi|পেপসি|sprite|স্প্রাইট|লাচ্ছি|lassi|ঘোল|ghol|ঝাল মুড়ি|jhalmuri|শরবত|sharbat|লেবুর শরবত|ডাবের জল|daber jol|jal jeera|জলজিরা', 'পানীয়', 'গ্লাস'],
  ['Thali', 'থালি|thali|মিল|meal|full meal|লাঞ্চ|lunch|ডিনার|dinner|ফিশ থালি|fish thali|ভেজ থালি|veg thali', 'থালি', 'প্লেট'],
  ['Paneer', 'পনির|paneer|পনির বাটার মসলা|paneer butter masala|পালক পনির|palak paneer|শাহী পনির|shahi paneer|কড়াই পনির|kadai paneer', 'ভেজ', 'প্লেট'],
  ['Butter', 'মাখন|butter|বাটার|ক্রিম|cream|সস|sauce|টমেটো সস|tomato sauce|কেচাপ|ketchup|মেয়োনিজ|mayonnaise|মেয়ো|mayo|অলিভ অয়েল|olive oil', 'কাঁচামাল', 'প্যাকেট'],
  ['Gas Cylinder', 'গ্যাস সিলিন্ডার|গ্যাস|gas cylinder|সিলিন্ডার|cylinder|কয়লা|coal|কাঠ|কাঠ কয়লা|charcoal|লাকড়ি', 'জ্বালানি', 'পিস'],
]

export const DICTIONARY: DictEntry[] = [
  ...MEDICINES.map(([name, al, category, unit]): DictEntry => ({ name, aliases: al.split('|').filter(Boolean), category, unit, kind: 'medicine' })),
  ...GROCERY.map(([name, al, category, unit]): DictEntry => ({ name, aliases: al.split('|').filter(Boolean), category, unit, kind: 'grocery' })),
  ...CLOTH.map(([name, al, category, unit]): DictEntry => ({ name, aliases: al.split('|').filter(Boolean), category, unit, kind: 'cloth' })),
  ...SWEET.map(([name, al, category, unit]): DictEntry => ({ name, aliases: al.split('|').filter(Boolean), category, unit, kind: 'sweet' })),
  ...FOOD.map(([name, al, category, unit]): DictEntry => ({ name, aliases: al.split('|').filter(Boolean), category, unit, kind: 'food' })),
]

// ── normalisation / sound-alike ──────────────────────────────────
const BN_DIGITS = '০১২৩৪৫৬৭৮৯'
const flat = (s: string) =>
  (s || '').normalize('NFC').toLowerCase()
    .replace(/[০-৯]/g, d => String(BN_DIGITS.indexOf(d)))
    .replace(/[\u200c\u200d]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '')   // keep \p{M}: Bengali vowel signs (ি ো ে) are marks, not letters

/**
 * Consonant skeleton of how a word SOUNDS. Bengali and English both go
 * through the same Latin spelling, then vowels / silent letters are dropped
 * and look-alike consonants merged — so "প্রারাসিটামন", "তেরাসিটমাল" and
 * "Paracetamol" all collapse to nearly the same short string.
 */
export function skeleton(s: string): string {
  let t = (s || '').normalize('NFC').toLowerCase().replace(/[\u200c\u200d]/g, '')
  t = t.replace(/্য/g, '')                 // য-ফলা (প্যা → পা)
  t = toLatin(t)
  t = t
    .replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/ce|ci|cy/g, m => 's' + m[1])
    .replace(/sh|ch/g, m => (m === 'sh' ? 's' : 'c'))
    .replace(/c/g, 'k').replace(/q/g, 'k').replace(/x/g, 'ks')
    .replace(/(t|d|b|k|g|j|p)h/g, '$1')     // aspirates: th dh bh kh gh jh ph
    .replace(/w|v/g, 'b').replace(/z/g, 'j').replace(/y/g, '')
    .replace(/ng/g, 'n')
    .replace(/[aeiouh]/g, '')
    .replace(/d/g, 't')                      // ট/ড/ত/দ blur in speech
    .replace(/(.)\1+/g, '$1')
  return t
}

function lev(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}
const ratio = (a: string, b: string) => (!a || !b ? 0 : 1 - lev(a, b) / Math.max(a.length, b.length))

/** 0..1 — how likely `heard` is the same product as `known`. */
export function nameSimilarity(heard: string, known: string): number {
  const a = flat(heard), b = flat(known)
  if (!a || !b) return 0
  if (a === b) return 1
  const la = toLatin(heard), lb = toLatin(known)
  let best = ratio(a, b)
  if (la.length >= 3 && lb.length >= 3) best = Math.max(best, ratio(la, lb))
  const sa = skeleton(heard), sb = skeleton(known)
  // skeletons are only trustworthy when both are long enough to be distinctive (short ones match everything)
  if (sa.length >= 5 && sb.length >= 5) best = Math.max(best, ratio(sa, sb) * (sa[0] === sb[0] ? 0.97 : 0.88))
  if (Math.min(a.length, b.length) >= 3 && (a.includes(b) || b.includes(a))) best = Math.max(best, 0.88)
  return best
}

export interface Candidate { name: string; score: number; source: 'shop' | 'dictionary'; entry?: DictEntry; shopUnit?: string }
export interface Resolution {
  /** best candidate, or null when nothing is close enough (UNKNOWN — never guess) */
  best: Candidate | null
  /** other close candidates, best first (for "did you mean…") */
  alternatives: Candidate[]
  /** true = safe to auto-fill; false = fill but ask the owner to confirm */
  confident: boolean
}

export const MATCH_MIN = 0.7      // below this → unknown
export const MATCH_SURE = 0.86    // at/above this (and clear of the runner-up) → confident

export interface ShopProductLite { name: string; unit?: string | null }

/**
 * Resolves what was heard to (1) the shop's OWN products first, then
 * (2) the built-in dictionary. The shop's own list wins ties because the
 * owner's spelling is the one they want on their dashboard.
 */
export function resolveProduct(heard: string, shop: ShopProductLite[] = [], kinds: DictEntry['kind'][] = ['medicine', 'grocery', 'cloth', 'sweet', 'food', 'other']): Resolution {
  const h = (heard || '').trim()
  if (!h) return { best: null, alternatives: [], confident: false }

  const cands: Candidate[] = []
  for (const p of shop) {
    if (!p?.name) continue
    const s = nameSimilarity(h, p.name)
    if (s >= 0.5) cands.push({ name: p.name, score: Math.min(1, s + 0.02), source: 'shop', shopUnit: p.unit || undefined })
  }
  for (const e of DICTIONARY) {
    if (!kinds.includes(e.kind)) continue
    let s = nameSimilarity(h, e.name)
    for (const al of e.aliases) {
      const v = nameSimilarity(h, al)
      if (v > s) s = v
      if (s === 1) break
    }
    if (s >= 0.5) {
      // The shop may already stock this very product under its own spelling ("Rice" for চাল / "Holud guro" for হলুদ).
      // Prefer that row so we never create a duplicate under the dictionary's name.
      const same = shop.find(p => p?.name && [e.name, ...e.aliases].some(x => nameSimilarity(p.name, x) >= 0.93))
      if (same) cands.push({ name: same.name, score: s, source: 'shop', shopUnit: same.unit || undefined, entry: e })
      else cands.push({ name: e.name, score: s, source: 'dictionary', entry: e })
    }
  }
  // one row per product name, keep its best score
  const byName = new Map<string, Candidate>()
  for (const c of cands.sort((x, y) => y.score - x.score)) {
    const k = flat(c.name)
    if (!byName.has(k)) byName.set(k, c)
  }
  // the owner's own spelling wins a near-tie against the built-in dictionary
  const rank = (c: Candidate) => c.score + (c.source === 'shop' ? 0.08 : 0)
  const list = Array.from(byName.values()).sort((x, y) => rank(y) - rank(x))
  const top = list[0]
  if (!top || top.score < MATCH_MIN) return { best: null, alternatives: list.filter(c => c.score >= 0.55).slice(0, 3), confident: false }
  const second = list[1]
  const confident = top.score >= MATCH_SURE && (!second || top.score - second.score >= 0.05 || top.score === 1)
  return { best: top, alternatives: list.slice(1, 4).filter(c => c.score >= 0.6), confident }
}

export type DictVertical = 'pharmacy' | 'dokan' | 'kapor' | 'mishti' | 'hotel' | 'general'
/** Which dictionary groups belong to which kind of shop. */
export function kindsForVertical(v: DictVertical): DictEntry['kind'][] {
  switch (v) {
    case 'pharmacy': return ['medicine']
    case 'kapor': return ['cloth']
    case 'mishti': return ['sweet']
    case 'hotel': return ['grocery', 'food']
    case 'dokan': return ['grocery', 'other']
    default: return ['grocery', 'cloth', 'sweet', 'food', 'other']   // custom agents: any kind of shop
  }
}

/** Dictionary names (Bengali first) to feed the speech recogniser as hints for this kind of shop. */
export function hintWords(v: DictVertical, max = 200): string[] {
  const kinds = kindsForVertical(v)
  return DICTIONARY.filter(e => kinds.includes(e.kind)).slice(0, max).map(e => e.aliases.find(a => /[ঀ-৿]/.test(a)) || e.name)
}
