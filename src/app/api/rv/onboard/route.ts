import { NextResponse } from 'next/server'
import { createRouteClient, createAdminClient } from '@/lib/supabaseServer'
import { createOrg } from '@/lib/rv/orgs'
import { fail } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'

/**
 * Creates a company (14-day trial) for a signed-in person who has no company yet.
 * Used after "Continue with Google", where there is no sign-up form to carry the company name.
 * Safe: it only ever acts on the CURRENT signed-in user, never on someone else.
 */
export async function POST(req: Request) {
  const { data: { user } } = await createRouteClient().auth.getUser()
  if (!user) return fail('Please sign in.', 401)

  const body = await req.json().catch(() => ({}))
  const name = String(body?.company_name || '').trim()
  if (name.length < 2) return fail('Enter your company name.')

  const raw = createAdminClient()

  // already belongs to a company: nothing to do
  const { data: existing } = await raw.from('rv_staff').select('id').eq('user_id', user.id).maybeSingle()
  if (existing) return NextResponse.json({ ok: true, already: true })

  // an invited colleague must join the inviting company, not start a second one
  const { data: invited } = await raw.from('rv_staff').select('id').ilike('email', user.email || '__none__').is('user_id', null).limit(1)
  if (invited && invited[0]) return fail('You have been invited to a company. Please refresh the page.', 409)

  if (process.env.RV_SIGNUP_OPEN === 'false') return fail('New sign-ups are closed. Please contact Evynta.', 403)

  const made = await createOrg(raw, {
    name, ownerEmail: user.email || '', ownerUserId: user.id,
    ownerName: (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || (user.email || '').split('@')[0],
    status: 'trial', trialDays: 14,
  })
  if (!made.ok) return fail(made.error, 500)
  return NextResponse.json({ ok: true })
}
