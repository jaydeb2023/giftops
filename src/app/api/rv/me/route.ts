import { NextResponse } from 'next/server'
import { guard } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guard()
  if (!g.ok) return g.res
  const { staff } = g
  return NextResponse.json({ staff: { id: staff.id, email: staff.email, full_name: staff.full_name, role: staff.role } })
}
