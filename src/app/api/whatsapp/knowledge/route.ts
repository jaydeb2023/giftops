import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

/** GET — all knowledge entries for this shop. */
export async function GET() {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await db.from('whatsapp_knowledge')
    .select('*').eq('user_id', user.id).order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data || [] })
}

/** POST — add one entry, or bulk-seed an array. */
export async function POST(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const rows = (Array.isArray(body) ? body : [body])
    .filter(r => r?.title?.trim() && r?.content?.trim())
    .map(r => ({
      user_id: user.id,
      title: String(r.title).trim(),
      content: String(r.content).trim(),
      category: r.category || 'general',
      keywords: Array.isArray(r.keywords)
        ? r.keywords
        : String(r.keywords || '').split(',').map((s: string) => s.trim()).filter(Boolean),
      is_active: r.is_active !== false,
    }))

  if (!rows.length) return NextResponse.json({ error: 'শিরোনাম ও বিবরণ দুটোই দিন।' }, { status: 400 })

  const { data, error } = await db.from('whatsapp_knowledge').insert(rows).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data })
}

/** PATCH — edit / toggle active. */
export async function PATCH(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...rest } = await req.json()
  if (!id) return NextResponse.json({ error: 'id দরকার।' }, { status: 400 })

  const patch: Record<string, any> = {}
  for (const k of ['title', 'content', 'category', 'is_active']) if (k in rest) patch[k] = rest[k]
  if ('keywords' in rest) {
    patch.keywords = Array.isArray(rest.keywords)
      ? rest.keywords
      : String(rest.keywords || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  }

  const { data, error } = await db.from('whatsapp_knowledge')
    .update(patch).eq('id', id).eq('user_id', user.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entry: data })
}

/** DELETE ?id=… */
export async function DELETE(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id দরকার।' }, { status: 400 })

  const { error } = await db.from('whatsapp_knowledge').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
