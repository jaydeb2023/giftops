'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import Logo from './Logo'
import { api } from '@/lib/rv/client'
import { Button, Field, Input } from './ui'

/**
 * Shown when someone signed in (usually with Google for the first time) and has no company yet.
 * (If a colleague already invited this email, they never see this: they are linked automatically.)
 */
export default function CompanySetup({ onSignOut }: { onSignOut: () => void }) {
  const [company, setCompany] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (company.trim().length < 2) return toast.error('Enter your company name')
    setBusy(true)
    try {
      await api('/api/rv/onboard', { body: { company_name: company.trim() } })
      toast.success('Your workspace is ready')
      window.location.href = '/app'
    } catch (err: any) {
      toast.error(err.message || 'Could not create your workspace')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rv-900 via-rv-800 to-rv-700 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-7 shadow-2xl">
        <div className="flex justify-center"><Logo size={44} /></div>
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-900">One last step</h1>
          <p className="mt-1 text-sm text-gray-600">Tell us your business name to set up your private GiftOps workspace with a 14-day free trial.</p>
        </div>
        <Field label="Company name"><Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Your gift business name" autoFocus /></Field>
        <Button type="submit" variant="primary" className="w-full" loading={busy}>Create my workspace</Button>
        <p className="text-center text-xs text-gray-500">
          Were you invited by a colleague? Sign out and use the email address they invited.{' '}
          <button type="button" onClick={onSignOut} className="font-medium text-rv-700 hover:underline">Sign out</button>
        </p>
      </form>
    </div>
  )
}
