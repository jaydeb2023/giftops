'use client'
import { useState } from 'react'
import { Camera, CheckCircle2, Truck, XCircle, RotateCcw, PackageCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/rv/client'
import { FAILED_REASONS, labelize } from '@/lib/rv/constants'
import { Button, ErrorNote, Field, Input, Modal, Select, Textarea } from './ui'

/** Pick up / start / deliver (with POD) / fail / reattempt for one delivery stop. */
export default function StopActions({ stop, onChange, big }: { stop: any; onChange: () => void; big?: boolean }) {
  const [deliver, setDeliver] = useState(false)
  const [fail, setFail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [rcv, setRcv] = useState(''); const [ref, setRef] = useState(''); const [file, setFile] = useState<File | null>(null)
  const [reason, setReason] = useState<string>(FAILED_REASONS[0]); const [note, setNote] = useState(''); const [again, setAgain] = useState('')
  const size = big ? 'md' : 'sm'
  const s = stop.delivery_status

  const simple = async (action: string) => {
    setBusy(true)
    try { await api(`/api/rv/stops/${stop.id}`, { body: { action } }); onChange() } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  const submitDeliver = async () => {
    setBusy(true); setErr('')
    try {
      const fd = new FormData()
      fd.set('action', 'deliver'); fd.set('received_by', rcv); fd.set('pod_ref', ref)
      if (file) fd.set('photo', file)
      await api(`/api/rv/stops/${stop.id}`, { form: fd })
      toast.success('Delivered'); setDeliver(false); setRcv(''); setRef(''); setFile(null); onChange()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  const submitFail = async () => {
    setBusy(true); setErr('')
    try {
      await api(`/api/rv/stops/${stop.id}`, { body: { action: 'fail', failed_reason: reason, note, reattempt_date: again || undefined } })
      toast.success('Marked as failed'); setFail(false); setNote(''); setAgain(''); onChange()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  if (s === 'delivered' || s === 'cancelled') return null
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {s === 'assigned' && <Button size={size} loading={busy} onClick={() => simple('pickup')}><PackageCheck className="h-4 w-4" />Picked up</Button>}
        {(s === 'assigned' || s === 'picked_up') && <Button size={size} loading={busy} onClick={() => simple('transit')}><Truck className="h-4 w-4" />Start</Button>}
        {['assigned', 'picked_up', 'in_transit', 'failed'].includes(s) && <Button size={size} variant="primary" onClick={() => { setErr(''); setDeliver(true) }}><CheckCircle2 className="h-4 w-4" />Delivered</Button>}
        {['assigned', 'picked_up', 'in_transit'].includes(s) && <Button size={size} onClick={() => { setErr(''); setFail(true) }}><XCircle className="h-4 w-4 text-red-600" />Failed</Button>}
        {s === 'failed' && <Button size={size} loading={busy} onClick={() => simple('reattempt')}><RotateCcw className="h-4 w-4" />Re-attempt</Button>}
      </div>

      <Modal open={deliver} onClose={() => setDeliver(false)} title={`Deliver to ${stop.name}`}
        footer={<><Button onClick={() => setDeliver(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={submitDeliver}>Confirm delivery</Button></>}>
        <div className="space-y-3">
          {err && <ErrorNote>{err}</ErrorNote>}
          <p className="text-sm text-gray-600">Add proof of delivery: a photo, the OTP/reference, or the name of who received it.</p>
          <Field label="Photo of delivered parcel">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-600 hover:bg-gray-50">
              <Camera className="h-5 w-5 text-rv-700" />{file ? file.name : 'Take or choose a photo'}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
          </Field>
          <Field label="Received by (name)"><Input value={rcv} onChange={e => setRcv(e.target.value)} placeholder="Recipient, security guard, family member..." /></Field>
          <Field label="OTP / reference (optional)"><Input value={ref} onChange={e => setRef(e.target.value)} /></Field>
        </div>
      </Modal>

      <Modal open={fail} onClose={() => setFail(false)} title={`Could not deliver to ${stop.name}`}
        footer={<><Button onClick={() => setFail(false)}>Cancel</Button><Button variant="danger" loading={busy} onClick={submitFail}>Mark failed</Button></>}>
        <div className="space-y-3">
          {err && <ErrorNote>{err}</ErrorNote>}
          <Field label="Reason" required><Select value={reason} onChange={e => setReason(e.target.value)}>{FAILED_REASONS.map(r => <option key={r} value={r}>{labelize(r)}</option>)}</Select></Field>
          <Field label="Note"><Textarea rows={2} value={note} onChange={e => setNote(e.target.value)} /></Field>
          <Field label="Re-attempt on (optional)"><Input type="date" value={again} onChange={e => setAgain(e.target.value)} /></Field>
          {(reason === 'incorrect_address' || reason === 'incomplete_address') && <p className="text-xs text-amber-700">This sends the address back to the human-call queue for correction.</p>}
        </div>
      </Modal>
    </>
  )
}
