'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Phone, MessageCircle } from 'lucide-react'
import { api } from '@/lib/rv/client'
import { Button, ErrorNote, Field, Input, Modal, Select, Textarea } from './ui'

export interface CommTarget {
  name: string
  mobile?: string | null
  lead_id?: string | null
  customer_id?: string | null
  order_id?: string | null
  recipient_id?: string | null
}

export function WhatsAppModal({ open, onClose, target, onDone, initialText }: { open: boolean; onClose: () => void; target: CommTarget | null; onDone?: () => void; initialText?: string }) {
  const [mode, setMode] = useState<'text' | 'template'>('text')
  const [text, setText] = useState('')
  const [template, setTemplate] = useState('address_request')
  const [params, setParams] = useState('')
  const [lang, setLang] = useState('en')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (open) { setErr(''); setText(initialText || ''); setParams(target?.name || '') } }, [open, target, initialText])
  if (!target) return null

  const send = async () => {
    setBusy(true); setErr('')
    try {
      await api('/api/rv/comms/send', {
        body: {
          lead_id: target.lead_id, customer_id: target.customer_id, recipient_id: target.recipient_id, order_id: target.order_id,
          to: target.mobile,
          ...(mode === 'text' ? { text } : { template, language: lang, params: params.split('|').map(s => s.trim()).filter(Boolean) }),
        },
      })
      toast.success('WhatsApp message sent'); onClose(); onDone?.()
    } catch (e: any) {
      setErr(e.message)
      if (e.code === 'WINDOW_CLOSED') setMode('template')
    } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={`WhatsApp: ${target.name}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={send}><MessageCircle className="h-4 w-4" />Send</Button></>}>
      <div className="space-y-3">
        {err && <ErrorNote>{err}</ErrorNote>}
        <div className="text-sm text-gray-600">To: <b>{target.mobile || 'no mobile on file'}</b></div>
        <div className="flex gap-2">
          <Button size="sm" variant={mode === 'text' ? 'primary' : 'secondary'} onClick={() => setMode('text')}>Free text (24h window)</Button>
          <Button size="sm" variant={mode === 'template' ? 'primary' : 'secondary'} onClick={() => setMode('template')}>Approved template</Button>
        </div>
        {mode === 'text' ? (
          <Field label="Message"><Textarea rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="Type your message" /></Field>
        ) : (
          <>
            <Field label="Template name" help="Must match a template approved in your WhatsApp Business account."><Input value={template} onChange={e => setTemplate(e.target.value)} /></Field>
            <Field label="Language code"><Input value={lang} onChange={e => setLang(e.target.value)} /></Field>
            <Field label="Template variables" help="Separate with | in order, e.g. Rina | Acme Ltd | 24 Oct"><Input value={params} onChange={e => setParams(e.target.value)} /></Field>
          </>
        )}
      </div>
    </Modal>
  )
}

export const CALL_OUTCOMES = [
  { value: 'answered', label: 'Answered / spoke' },
  { value: 'address_confirmed', label: 'Address confirmed' },
  { value: 'callback', label: 'Asked to call back' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'busy', label: 'Busy / switched off' },
  { value: 'voicemail', label: 'Left voicemail' },
  { value: 'wrong_number', label: 'Wrong number' },
  { value: 'refused', label: 'Refused / not interested' },
]

export function CallLogModal({ open, onClose, target, address, onDone }: { open: boolean; onClose: () => void; target: CommTarget | null; address?: boolean; onDone?: () => void }) {
  const [outcome, setOutcome] = useState('answered')
  const [note, setNote] = useState('')
  const [followup, setFollowup] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (open) { setOutcome('answered'); setNote(''); setFollowup(''); setErr('') } }, [open])
  if (!target) return null

  const save = async () => {
    setBusy(true); setErr('')
    try {
      if (address && target.recipient_id) {
        await api(`/api/rv/recipients/${target.recipient_id}/address`, { body: { action: 'log_attempt', channel: 'call', outcome, note } })
      } else {
        await api('/api/rv/r/communications', {
          body: { channel: 'call', direction: 'out', lead_id: target.lead_id, customer_id: target.customer_id, order_id: target.order_id, recipient_id: target.recipient_id, body: note, status: 'completed', outcome, next_action: followup ? `Follow up ${followup}` : null },
        })
        if (target.lead_id && followup) await api(`/api/rv/r/leads/${target.lead_id}`, { method: 'PATCH', body: { next_followup_at: new Date(followup).toISOString() } })
      }
      toast.success('Call logged'); onClose(); onDone?.()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Log call: ${target.name}`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save call</Button></>}>
      <div className="space-y-3">
        {err && <ErrorNote>{err}</ErrorNote>}
        {target.mobile && (
          <a href={`tel:${target.mobile}`} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            <Phone className="h-4 w-4" />Call {target.mobile}
          </a>
        )}
        <Field label="Outcome">
          <Select value={outcome} onChange={e => setOutcome(e.target.value)}>
            {CALL_OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Notes"><Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="What was discussed?" /></Field>
        {!address && <Field label="Next follow-up (optional)"><Input type="datetime-local" value={followup} onChange={e => setFollowup(e.target.value)} /></Field>}
      </div>
    </Modal>
  )
}
