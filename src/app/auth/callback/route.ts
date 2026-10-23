import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

/** Google (OAuth) sends the person back here with ?code=... We turn it into a login session, then go to the app. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const rawNext = url.searchParams.get('next') || '/app'
  // only allow in-site paths (stops "open redirect" tricks)
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/app'

  if (url.searchParams.get('error')) {
    return NextResponse.redirect(new URL(`/app/login?error=${encodeURIComponent(url.searchParams.get('error_description') || 'Google sign-in was cancelled')}`, url.origin))
  }
  if (code) {
    const { error } = await createRouteClient().auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(new URL(`/app/login?error=${encodeURIComponent(error.message)}`, url.origin))
  }
  return NextResponse.redirect(new URL(next, url.origin))
}
