'use client'
import { createContext, useContext } from 'react'
import type { RvRole } from '@/lib/rv/constants'

export interface StaffMe { id: string; email: string; full_name: string | null; role: RvRole }
export const StaffContext = createContext<StaffMe | null>(null)
export function useStaff(): StaffMe {
  const s = useContext(StaffContext)
  if (!s) throw new Error('useStaff outside RvShell')
  return s
}
