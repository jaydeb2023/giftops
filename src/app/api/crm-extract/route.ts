import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, businessType = 'pharmacy', mimeType = 'image/jpeg' } = await req.json()

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const systemPrompt = `You are an expert at reading handwritten Bengali business records (খাতা/ledger books).
Extract all customer and transaction data from the image and return ONLY valid JSON.
No explanation, no markdown, no backticks — just raw JSON.

For ${businessType}, extract this structure:
{
  "customers": [
    {
      "name": "customer name in Bengali or English",
      "phone": "phone number if visible",
      "address": "address if visible",
      "age": null,
      "transactions": [
        {
          "date": "DD/MM/YYYY or as written",
          "item_name": "product/medicine name",
          "quantity": 1,
          "unit_price": 0,
          "total_amount": 0,
          "paid_amount": 0,
          "notes": "any extra notes"
        }
      ]
    }
  ],
  "raw_text": "full text you could read from the image",
  "confidence": "high/medium/low"
}`

    // Use llama vision model via Groq
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 2000,
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                },
              },
              {
                type: 'text',
                text: 'এই খাতার ছবি থেকে সব customer ও transaction data extract করুন। শুধু JSON দিন।',
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Groq vision error:', err)
      return NextResponse.json({ error: 'AI extraction failed', details: err }, { status: 500 })
    }

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content || ''

    // Clean and parse JSON
    let parsed = null
    try {
      const cleaned = rawContent
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim()
      parsed = JSON.parse(cleaned)
    } catch {
      // If JSON parsing fails, return raw text for manual review
      parsed = {
        customers: [],
        raw_text: rawContent,
        confidence: 'low',
        parse_error: true,
      }
    }

    return NextResponse.json({ success: true, data: parsed })

  } catch (error: any) {
    console.error('CRM extract error:', error)
    return NextResponse.json({ error: 'Extraction failed', details: error.message }, { status: 500 })
  }
}
