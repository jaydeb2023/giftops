import { NextRequest, NextResponse } from 'next/server'

// ══════════════════════════════════════════════════════════════════
// Powers the "Image" and "File" modes in the AI Assistant chat input.
// Mirrors the existing khata-photo → customer extraction in
// /api/crm-extract, but reads STOCK items instead (name/qty/unit/
// prices/category) — e.g. a photo of a handwritten খাতা page, or a
// plain-text/CSV product list. Nothing is written to the database here;
// the client shows the returned items as an editable "add all?" card
// (see PendingStockBulk in AgentRunner.tsx) and only saves what the
// shop owner confirms.
// ══════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are an expert at reading a small shop's stock records — either a
photo of a handwritten Bengali খাতা/notebook page listing products, or a
plain text / CSV list of products (one per line, possibly with quantity,
unit, purchase price, sale price).

Extract every product you can find and return ONLY valid JSON, no
explanation, no markdown, no backticks — just raw JSON in this exact shape:
{
  "items": [
    {
      "name": "product name, in Bengali if that's how it's written",
      "qty": 0,
      "unit": "কেজি | গ্রাম | লিটার | মিলি | পিস | প্যাকেট | বস্তা | ডজন | বোতল | কার্টন",
      "unit_cost": 0,
      "sell_price": 0,
      "category": "a short Bengali category guess, e.g. চাল-ডাল, তেল-মসলা, ইত্যাদি"
    }
  ],
  "raw_text": "full text you could read",
  "confidence": "high/medium/low"
}
If a quantity, price or unit isn't visible/known, use 0 for numbers and
"পিস" for unit — never invent a specific-looking number you didn't
actually read. If nothing readable is found, return an empty items array.`

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType = 'image/jpeg', textContent } = await req.json()
    if (!imageBase64 && !textContent) {
      return NextResponse.json({ error: 'No image or text provided' }, { status: 400 })
    }

    const userContent: any[] = imageBase64
      ? [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          { type: 'text', text: 'এই খাতার/স্টকের ছবি থেকে সব পণ্যের তথ্য extract করুন। শুধু JSON দিন।' },
        ]
      : [
          { type: 'text', text: `এই তালিকা থেকে সব পণ্যের তথ্য extract করুন। শুধু JSON দিন।\n\n${String(textContent).slice(0, 12000)}` },
        ]

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 3000,
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Groq stock-extract error:', err)
      return NextResponse.json({ error: 'AI extraction failed', details: err }, { status: 500 })
    }

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content || ''

    let parsed: any = null
    try {
      const cleaned = rawContent.replace(/```json/g, '').replace(/```/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = { items: [], raw_text: rawContent, confidence: 'low', parse_error: true }
    }

    // Defensive normalization so the client never has to guess at shapes.
    const items = Array.isArray(parsed.items) ? parsed.items.slice(0, 100).map((it: any) => ({
      name: String(it?.name || '').slice(0, 60),
      qty: Number(it?.qty) || 0,
      unit: String(it?.unit || 'পিস').slice(0, 20),
      unit_cost: Number(it?.unit_cost) || 0,
      sell_price: Number(it?.sell_price) || 0,
      category: String(it?.category || 'অন্যান্য').slice(0, 40),
    })).filter((it: any) => it.name) : []

    return NextResponse.json({ success: true, items, raw_text: parsed.raw_text || '', confidence: parsed.confidence || 'low' })
  } catch (error: any) {
    console.error('stock-extract error:', error)
    return NextResponse.json({ error: 'Extraction failed', details: error.message }, { status: 500 })
  }
}
