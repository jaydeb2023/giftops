// POST /api/vision-extract — "read this photo like a person would".
// Any photo a shop owner sends (handwritten list, printed bill, supplier invoice,
// prescription, medicine strip, product label, price list, a screenshot of a WhatsApp
// order…) is read in full: all the text (Bengali / English / Hindi, handwriting too),
// a clean list of items (name, qty, unit, rate, amount, SKU, batch, expiry…), the
// customer / supplier and totals. Every item is then matched to the shop's OWN products
// and SKUs, so "চাল", "Chal" and "chaal 5kg" all land on the same product.
import { NextRequest, NextResponse } from 'next/server'
import { getCallerId, serviceClient } from '@/lib/chatAuth'
import { resolveEffectiveAccess } from '@/lib/teamAccess'
import { loadVocab, matchProduct, matchCustomer, type VisionResult, type VisionItem } from '@/lib/chatVocab'

export const runtime = 'nodejs'
export const maxDuration = 45

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const VISION_MODEL = process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'
const MAX_BASE64 = 5_500_000   // ~4 MB image; the browser shrinks photos first

const hits = new Map<string, number[]>()
function rateLimited(id: string) {
  const now = Date.now(), recent = (hits.get(id) || []).filter(t => now - t < 60_000)
  if (recent.length >= 12) { hits.set(id, recent); return true }
  recent.push(now); hits.set(id, recent); return false
}

const AGENT_FOCUS: Record<string, string> = {
  'pharmacy-assistant': 'This is a PHARMACY. Medicine strips/boxes/prescriptions/purchase bills: read brand + strength exactly (e.g. "Napa 500mg", "Azithral 250"), batch, expiry (MM/YY), MRP, pack size, manufacturer.',
  'kaporer-dokan-tracker': 'This is a CLOTHING shop. Read design/item (saree, kurta, shirt…), fabric, size, colour, quantity (pcs), rate, design/SKU codes.',
  'hotel-and-dhaba-manager': 'This is a HOTEL / DHABA. Read dish or ingredient names, table numbers, quantities, rates, order totals.',
  'mishti-dokan-manager': 'This is a SWEETS shop. Read sweet names, quantities in kg/pcs/box, rates, order details.',
}

function buildPrompt(agentSlug: string | undefined, instruction: string) {
  return `You read photos for a small-business assistant used by shopkeepers in West Bengal and Bangladesh.
${(agentSlug && AGENT_FOCUS[agentSlug]) || 'This is a general shop (grocery / kirana / wholesale / any business).'}

Read EVERYTHING in the image: printed text, handwriting, barcodes / SKU numbers, rubber stamps. Text may be Bengali, English, Hindi or a mix. Bengali digits (০১২৩৪৫৬৭৮৯) → normal digits.
Common Bengali shop words: কেজি/কিলো=kg, গ্রাম, লিটার, পিস/টা/গোটা=piece, ডজন=dozen, প্যাকেট, বস্তা=sack, সের, পোয়া, আড়াই=2.5, দেড়=1.5, সোয়া=1.25, টাকা/৳/₹, জমা=paid, বাকি/ধার=due, মোট=total.
${instruction ? `The owner's note about this photo: "${instruction}"\n` : ''}
Return ONLY one JSON object, no markdown, in this shape:
{"kind":"handwritten_list|printed_bill|purchase_bill|prescription|product_label|price_list|order_note|screenshot|other",
 "summary":"one short Bengali sentence: what this photo is",
 "text":"all readable text, line by line, exactly as written",
 "party":{"name":"customer or supplier name if written","phone":"","address":""},
 "date":"",
 "items":[{"name":"","qty":0,"unit":"","price":0,"amount":0,"sku":"","mrp":0,"batch":"","expiry":"","size":"","color":"","note":""}],
 "totals":{"subtotal":0,"discount":0,"total":0,"paid":0,"due":0},
 "confidence":"high|medium|low"}

Rules:
- Keep each item "name" in the language/script it was written in (do not translate); fix obvious spelling only.
- "price" = rate per unit, "amount" = line total. Use 0 when the image does not show a value. NEVER invent numbers, names or items.
- If a line is unreadable, skip it. If the image has no business content, return items:[] and say so in summary.
- One entry per product line. Do not merge different products.`
}

function parseJson(raw: string): any | null {
  const t = raw.replace(/```json|```/g, '').trim()
  try { return JSON.parse(t) } catch { /* fall through */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}')
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)) } catch { return null } }
  return null
}
const num = (v: any) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 ? n : undefined }

export async function POST(req: NextRequest) {
  try {
    const callerId = await getCallerId(req)
    if (!callerId) return NextResponse.json({ error: 'unauthorized', message: 'আবার লগইন করুন।' }, { status: 401 })
    if (rateLimited(callerId)) return NextResponse.json({ error: 'rate_limited', message: 'একটু পরে আবার চেষ্টা করুন।' }, { status: 429 })
    if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: 'not_configured', message: 'ছবি পড়ার সার্ভিস চালু নেই।' }, { status: 500 })

    const { imageBase64, mimeType, agentSlug, instruction } = await req.json()
    if (!imageBase64 || typeof imageBase64 !== 'string') return NextResponse.json({ error: 'no_image', message: 'ছবি পাওয়া যায়নি।' }, { status: 400 })
    if (imageBase64.length > MAX_BASE64) return NextResponse.json({ error: 'too_large', message: 'ছবিটি অনেক বড় — ছোট করে আবার দিন।' }, { status: 413 })

    const sb = serviceClient()
    const access = await resolveEffectiveAccess(sb, callerId)
    const vocabPromise = loadVocab(sb, access.ownerId, agentSlug, access.role !== 'stock')

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VISION_MODEL,
        temperature: 0,
        max_tokens: 3500,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: buildPrompt(agentSlug, String(instruction || '').slice(0, 300)) },
            { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } },
          ],
        }],
      }),
    })
    if (!res.ok) {
      console.error('vision-extract: Groq error', res.status, (await res.text().catch(() => '')).slice(0, 300))
      return NextResponse.json({ error: 'vision_failed', message: 'ছবি পড়া যায়নি — আরেকটু স্পষ্ট ছবি দিয়ে আবার চেষ্টা করুন।' }, { status: 502 })
    }
    const data = await res.json()
    const parsed = parseJson(data?.choices?.[0]?.message?.content || '')
    const vocab = await vocabPromise

    const items: VisionItem[] = (Array.isArray(parsed?.items) ? parsed.items : [])
      .map((it: any): VisionItem => {
        const name = String(it?.name || '').trim()
        const m = name ? matchProduct(name, vocab.products) : null
        return {
          name, qty: num(it?.qty), unit: String(it?.unit || '').trim() || undefined,
          price: num(it?.price), amount: num(it?.amount), sku: String(it?.sku || '').trim() || undefined,
          mrp: num(it?.mrp), batch: String(it?.batch || '').trim() || undefined, expiry: String(it?.expiry || '').trim() || undefined,
          size: String(it?.size || '').trim() || undefined, color: String(it?.color || '').trim() || undefined, note: String(it?.note || '').trim() || undefined,
          matched: m ? { name: m.name, sku: m.sku, unit: m.unit, price: m.price } : null,
        }
      })
      .filter((it: VisionItem) => it.name)

    const partyName = String(parsed?.party?.name || '').trim()
    const result: VisionResult = {
      kind: String(parsed?.kind || 'other'),
      summary: String(parsed?.summary || '').trim(),
      text: String(parsed?.text || '').trim(),
      party: partyName || parsed?.party?.phone ? { name: partyName || undefined, phone: String(parsed?.party?.phone || '') || undefined, address: String(parsed?.party?.address || '') || undefined } : null,
      partyMatched: partyName ? matchCustomer(partyName, vocab.customers) : null,
      date: String(parsed?.date || '') || undefined,
      items,
      totals: parsed?.totals ? { subtotal: num(parsed.totals.subtotal), discount: num(parsed.totals.discount), total: num(parsed.totals.total), paid: num(parsed.totals.paid), due: num(parsed.totals.due) } : null,
      confidence: ['high', 'medium', 'low'].includes(parsed?.confidence) ? parsed.confidence : 'medium',
    }
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('vision-extract: unexpected error', e?.message)
    return NextResponse.json({ error: 'server_error', message: 'ছবি পড়া যায়নি — আবার চেষ্টা করুন।' }, { status: 500 })
  }
}
