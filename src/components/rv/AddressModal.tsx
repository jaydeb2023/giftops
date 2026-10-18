'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ShieldCheck } from 'lucide-react'
import { api, fmtDateTime, useFetch } from '@/lib/rv/client'
import { Badge, Button, ErrorNote, Field, Input, Modal, Spinner, Textarea } from './ui'
import { checkAddress, isKolkataPin } from '@/lib/rv/util'

/**
 * Edit / verify one recipient's address. AI- or WhatsApp-captured text appears as a
 * suggestion; staff copy it across and press "Save & verify". Nothing verifies itself.
 */
export default function AddressModal({ recipientId, onClose, onSaved }: { recipientId: string | null; onClose: () => void; onSaved?: () => void }) {
  const { data, loading } = useFetch<{ data: any; comms: any[] }>(recipientId ? `/api/rv/recipients/${recipientId}` : null)
  const [f, setF] = useState<any>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<'' | 'save' | 'verify'>('')

  useEffect(() => {
    if (data?.data) {
      const r = data.data
      setF({ name: r.name || '', mobile: r.mobile || '', address_line: r.address_line || '', landmark: r.landmark || '', pincode: r.pincode || '', zone: r.zone || '', instructions: r.instructions || '', items_note: r.items_note || '', card_message: r.card_message || '' })
      setErr('')
    }
  }, [data])

  if (!recipientId) return null
  const r = data?.data
  const chk = checkAddress({ name: f.name, address_line: f.address_line, pincode: f.pincode, mobile: f.mobile })

  const save = async (verify: boolean) => {
    setBusy(verify ? 'verify' : 'save'); setErr('')
    try {
      await api(`/api/rv/recipients/${recipientId}`, { method: 'PATCH', body: f })
      if (verify) await api(`/api/rv/recipients/${recipientId}/address`, { body: { action: 'verify', ...f } })
      toast.success(verify ? 'Address verified' : 'Saved')
      onSaved?.(); onClose()
    } catch (e: any) { setErr(e.message) } finally { setBusy('') }
  }

  return (
    <Modal open onClose={onClose} title={r ? `Address: ${r.name} (${r.delivery_no})` : 'Address'} wide
      footer={<>
        <Button onClick={onClose}>Close</Button>
        <Button loading={busy === 'save'} onClick={() => save(false)}>Save</Button>
        <Button variant="primary" loading={busy === 'verify'} disabled={!chk.ok} onClick={() => save(true)}><ShieldCheck className="h-4 w-4" />Save & verify</Button>
      </>}>
      {loading || !r ? <div className="py-10 text-center"><Spinner className="mx-auto h-6 w-6" /></div> : (
        <div className="space-y-4">
          {err && <ErrorNote>{err}</ErrorNote>}
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            Status: <Badge value={r.address_status} />
            <span>Attempts: {r.address_attempts}</span>
            {r.verified_at && <span>Verified {fmtDateTime(r.verified_at)}</span>}
            {r.order && <span>Order {r.order.order_no}</span>}
          </div>
          {r.suggested_address && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm">
              <div className="font-medium text-purple-900">Captured from WhatsApp / AI call (not verified)</div>
              <div className="mt-1 whitespace-pre-wrap text-purple-900">{r.suggested_address}</div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => setF((s: any) => ({ ...s, address_line: r.suggested_address }))}>Use as address line</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await api(`/api/rv/recipients/${recipientId}/address`, { body: { action: 'clear_suggestion' } }); onSaved?.(); onClose() }}>Dismiss</Button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Recipient name" required><Input value={f.name || ''} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Mobile"><Input value={f.mobile || ''} onChange={e => setF({ ...f, mobile: e.target.value })} /></Field>
            <Field label="Full address" required className="sm:col-span-2"><Textarea rows={3} value={f.address_line || ''} onChange={e => setF({ ...f, address_line: e.target.value })} placeholder="Flat / house, building, street, locality, city" /></Field>
            <Field label="Landmark"><Input value={f.landmark || ''} onChange={e => setF({ ...f, landmark: e.target.value })} /></Field>
            <Field label="PIN code" required help={f.pincode && /^\d{6}$/.test(f.pincode) && !isKolkataPin(f.pincode) ? 'Outside Kolkata (700xxx). Check that the zone is right.' : undefined}><Input value={f.pincode || ''} onChange={e => setF({ ...f, pincode: e.target.value })} maxLength={6} /></Field>
            <Field label="Zone / cluster"><Input value={f.zone || ''} onChange={e => setF({ ...f, zone: e.target.value })} /></Field>
            <Field label="Delivery instructions"><Input value={f.instructions || ''} onChange={e => setF({ ...f, instructions: e.target.value })} /></Field>
            <Field label="Gift / items for this recipient"><Input value={f.items_note || ''} onChange={e => setF({ ...f, items_note: e.target.value })} /></Field>
            <Field label="Card message"><Input value={f.card_message || ''} onChange={e => setF({ ...f, card_message: e.target.value })} /></Field>
          </div>
          {!chk.ok && <div className="text-xs text-amber-700">To verify: {chk.problems.join('; ')}.</div>}
          {data!.comms.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Contact attempts</div>
              <ul className="space-y-1 text-sm">
                {data!.comms.map(c => (
                  <li key={c.id} className="flex gap-2 text-gray-700">
                    <span className="w-28 shrink-0 text-xs text-gray-400">{fmtDateTime(c.created_at)}</span>
                    <span className="w-16 shrink-0 text-xs font-medium uppercase text-gray-500">{c.channel.replace('_', ' ')}{c.direction === 'in' ? ' in' : ''}</span>
                    <span className="min-w-0 break-words">{c.body || c.outcome || c.status}{c.outcome && c.body ? ` (${c.outcome})` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
