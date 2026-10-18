'use client'

import { useState } from 'react'
import { Plus, Trash2, Phone, User, Calendar, Clock, Check, X, Printer, DollarSign, Search } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ───────────────────────────────────────────────────────
interface Appointment {
  id: string
  patientName: string
  phone: string
  age: string
  date: string
  time: string
  type: 'new' | 'followup' | 'emergency'
  status: 'scheduled' | 'done' | 'cancelled' | 'waiting'
  fee: number
  paid: number
  notes: string
  diagnosis?: string
}

interface PatientHistory {
  id: string
  name: string
  phone: string
  age: string
  bloodGroup: string
  address: string
  visits: { date: string; diagnosis: string; fee: number }[]
  totalDue: number
}

// ─── Helpers ─────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9) }
function today() { return new Date().toISOString().slice(0, 10) }
function timeNow() { const d = new Date(); return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}` }

// ─── Initial data ─────────────────────────────────────────────────
const INIT_APPOINTMENTS: Appointment[] = [
  { id: uid(), patientName: 'রামবাবু দাস', phone: '9876543210', age: '45', date: today(), time: '10:00', type: 'followup', status: 'done', fee: 300, paid: 300, notes: 'Hypertension follow-up', diagnosis: 'BP controlled' },
  { id: uid(), patientName: 'সুমিত্রা দেবী', phone: '9123456780', age: '38', date: today(), time: '11:30', type: 'new', status: 'waiting', fee: 400, paid: 0, notes: 'Chest pain', diagnosis: '' },
  { id: uid(), patientName: 'মোহন লাল', phone: '8765432190', age: '62', date: today(), time: '12:00', type: 'followup', status: 'scheduled', fee: 300, paid: 300, notes: 'Diabetes check', diagnosis: '' },
  { id: uid(), patientName: 'প্রিয়া শর্মা', phone: '7654321890', age: '29', date: today(), time: '14:30', type: 'new', status: 'scheduled', fee: 400, paid: 200, notes: 'Skin rash', diagnosis: '' },
  { id: uid(), patientName: 'করিম সাহেব', phone: '6543210987', age: '55', date: today(), time: '16:00', type: 'emergency', status: 'scheduled', fee: 500, paid: 0, notes: 'Acute abdominal pain', diagnosis: '' },
]

const INIT_PATIENTS: PatientHistory[] = [
  { id: uid(), name: 'রামবাবু দাস', phone: '9876543210', age: '45', bloodGroup: 'B+', address: 'সল্টলেক, কলকাতা', visits: [{ date: '2025-03-15', diagnosis: 'Hypertension', fee: 300 }, { date: '2025-04-10', diagnosis: 'BP controlled', fee: 300 }], totalDue: 0 },
  { id: uid(), name: 'সুমিত্রা দেবী', phone: '9123456780', age: '38', bloodGroup: 'A+', address: 'বাগবাজার, কলকাতা', visits: [{ date: '2025-04-10', diagnosis: 'Chest pain - ECG normal', fee: 400 }], totalDue: 400 },
]

const TABS = [
  { id: 'today',   label: 'আজকের রোগী', icon: '📋' },
  { id: 'book',    label: 'বুকিং',       icon: '📅' },
  { id: 'patients',label: 'রোগীর ইতিহাস', icon: '👤' },
  { id: 'fees',    label: 'ফি ও বকেয়া', icon: '💰' },
]

const TIME_SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00']

// ══════════════════════════════════════════════════════════════════
export default function DoctorChamberUI() {
  const [tab, setTab] = useState('today')
  const [appointments, setAppointments] = useState<Appointment[]>(INIT_APPOINTMENTS)
  const [patients, setPatients] = useState<PatientHistory[]>(INIT_PATIENTS)
  const [searchQ, setSearchQ] = useState('')

  // Booking form
  const [bookForm, setBookForm] = useState({ patientName: '', phone: '', age: '', date: today(), time: '10:00', type: 'new' as const, fee: '', notes: '' })

  // Derived stats
  const todayAppts = appointments.filter(a => a.date === today())
  const todayDone = todayAppts.filter(a => a.status === 'done').length
  const todayRevenue = todayAppts.filter(a => a.status === 'done').reduce((s, a) => s + a.paid, 0)
  const todayDue = appointments.reduce((s, a) => s + (a.fee - a.paid), 0)
  const totalDue = appointments.reduce((s, a) => s + (a.fee - a.paid), 0)

  const statusConfig = {
    scheduled: { label: 'নির্ধারিত', bg: 'bg-blue-100 text-blue-700' },
    waiting: { label: 'অপেক্ষায়', bg: 'bg-yellow-100 text-yellow-700' },
    done: { label: 'সম্পন্ন', bg: 'bg-green-100 text-green-700' },
    cancelled: { label: 'বাতিল', bg: 'bg-red-100 text-red-600' },
  }

  const typeConfig = {
    new: { label: 'নতুন', color: 'text-indigo-600' },
    followup: { label: 'Follow-up', color: 'text-green-600' },
    emergency: { label: '🚨 জরুরি', color: 'text-red-600' },
  }

  const updateStatus = (id: string, status: Appointment['status']) => {
    setAppointments(appointments.map(a => a.id === id ? { ...a, status } : a))
    if (status === 'done') toast.success('রোগী দেখা সম্পন্ন!')
  }

  const collectFee = (id: string) => {
    const appt = appointments.find(a => a.id === id)
    if (!appt) return
    const due = appt.fee - appt.paid
    if (due <= 0) { toast('সম্পূর্ণ পেমেন্ট হয়ে গেছে!'); return }
    const paid = prompt(`বকেয়া: ₹${due}\nকত টাকা নিলেন?`)
    if (!paid) return
    setAppointments(appointments.map(a => a.id === id ? { ...a, paid: Math.min(a.fee, a.paid + +paid) } : a))
    toast.success('ফি রেকর্ড হয়েছে!')
  }

  const bookAppointment = () => {
    if (!bookForm.patientName || !bookForm.date || !bookForm.time) { toast.error('নাম, তারিখ ও সময় দিন'); return }
    const appt: Appointment = { id: uid(), ...bookForm, fee: +bookForm.fee || 400, paid: 0, status: 'scheduled', diagnosis: '' }
    setAppointments([...appointments, appt])
    setBookForm({ patientName: '', phone: '', age: '', date: today(), time: '10:00', type: 'new', fee: '', notes: '' })
    toast.success('Appointment বুক হয়েছে!')
    setTab('today')
  }

  const printReceipt = (a: Appointment) => {
    const w = window.open('', '_blank')!
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><meta charset="utf-8">
<style>body{font-family:'Segoe UI',sans-serif;padding:24px;max-width:360px;margin:auto}h2{text-align:center;color:#4f46e5;font-size:16px}table{width:100%;font-size:13px}td{padding:5px 0}hr{border:1px solid #eee}.total{font-weight:700;font-size:15px;color:#4f46e5}.footer{text-align:center;font-size:11px;color:#999;margin-top:16px}</style>
</head><body>
<h2>🩺 ডাক্তারের রসিদ</h2>
<hr/>
<table>
  <tr><td><b>রোগী</b></td><td>${a.patientName}</td></tr>
  ${a.phone ? `<tr><td>ফোন</td><td>${a.phone}</td></tr>` : ''}
  <tr><td>তারিখ</td><td>${a.date}</td></tr>
  <tr><td>সময়</td><td>${a.time}</td></tr>
  <tr><td>ধরন</td><td>${typeConfig[a.type].label}</td></tr>
  ${a.diagnosis ? `<tr><td>রোগ/নোট</td><td>${a.diagnosis}</td></tr>` : ''}
</table>
<hr/>
<table>
  <tr class="total"><td>Consultation ফি</td><td>₹${a.fee}</td></tr>
  <tr><td>পরিশোধিত</td><td style="color:#16a34a">₹${a.paid}</td></tr>
  ${a.fee - a.paid > 0 ? `<tr><td>বকেয়া</td><td style="color:#dc2626">₹${a.fee - a.paid}</td></tr>` : ''}
</table>
<div class="footer">সুস্থ থাকুন 🙏</div>
</body></html>`)
    w.print()
  }

  const filteredPatients = patients.filter(p =>
    !searchQ || p.name.toLowerCase().includes(searchQ.toLowerCase()) || p.phone.includes(searchQ)
  )

  return (
    <div className="space-y-4">

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'আজকের রোগী', value: `${todayAppts.length}জন`, icon: '👤', color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'দেখা সম্পন্ন', value: `${todayDone}জন`, icon: '✅', color: 'bg-green-50 border-green-200 text-green-700' },
          { label: 'আজকের আয়', value: `₹${todayRevenue}`, icon: '💰', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
          { label: 'মোট বকেয়া', value: `₹${totalDue}`, icon: '⏳', color: 'bg-red-50 border-red-200 text-red-700' },
        ].map(c => (
          <div key={c.label} className={`${c.color} border rounded-xl p-3`}>
            <div className="text-lg mb-0.5">{c.icon}</div>
            <div className="font-extrabold text-lg">{c.value}</div>
            <div className="text-xs opacity-70 bengali">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="flex overflow-x-auto border-b bg-gray-50">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-all bengali whitespace-nowrap ${tab === t.id ? 'bg-white text-indigo-700 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        <div className="p-4">

          {/* ══ TODAY'S PATIENTS ══ */}
          {tab === 'today' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 bengali">{new Date().toLocaleDateString('bn-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <button onClick={() => setTab('book')} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold bengali hover:bg-indigo-700 flex items-center gap-1">
                  <Plus size={11} />নতুন বুকিং
                </button>
              </div>

              {todayAppts.length === 0 && <div className="text-center py-10 text-gray-400 bengali text-sm">আজকে কোনো appointment নেই</div>}

              {todayAppts.sort((a, b) => a.time.localeCompare(b.time)).map(appt => (
                <div key={appt.id} className={`bg-white border rounded-xl p-3 hover:shadow-sm transition-shadow ${appt.type === 'emergency' ? 'border-red-200 bg-red-50/30' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User size={14} className="text-indigo-600" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-800 bengali">{appt.patientName}</div>
                        <div className="text-xs text-gray-400 bengali flex items-center gap-2">
                          <span>🕐 {appt.time}</span>
                          {appt.phone && <span>📞 {appt.phone}</span>}
                          {appt.age && <span>🎂 {appt.age} বছর</span>}
                        </div>
                        {appt.notes && <div className="text-xs text-gray-500 bengali mt-0.5 italic">{appt.notes}</div>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusConfig[appt.status].bg}`}>{statusConfig[appt.status].label}</span>
                      <span className={`text-[10px] font-bold ${typeConfig[appt.type].color}`}>{typeConfig[appt.type].label}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-gray-700">₹{appt.fee}</span>
                      {appt.fee - appt.paid > 0
                        ? <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold bengali">বকেয়া ₹{appt.fee - appt.paid}</span>
                        : <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-bold bengali">✓ পরিশোধিত</span>
                      }
                    </div>
                    <div className="flex gap-1.5">
                      {appt.status !== 'done' && appt.status !== 'cancelled' && (
                        <button onClick={() => updateStatus(appt.id, 'done')} className="text-[10px] bg-green-600 text-white px-2 py-1 rounded font-bold bengali hover:bg-green-700">
                          ✓ সম্পন্ন
                        </button>
                      )}
                      {appt.fee - appt.paid > 0 && (
                        <button onClick={() => collectFee(appt.id)} className="text-[10px] bg-yellow-500 text-white px-2 py-1 rounded font-bold bengali hover:bg-yellow-600">
                          💳 ফি নিন
                        </button>
                      )}
                      <button onClick={() => printReceipt(appt)} className="text-[10px] text-indigo-600 border border-indigo-200 px-2 py-1 rounded font-bold bengali hover:bg-indigo-50">
                        🖨️ রসিদ
                      </button>
                      {appt.status !== 'cancelled' && (
                        <button onClick={() => updateStatus(appt.id, 'cancelled')} className="text-[10px] text-red-400 border border-red-200 px-2 py-1 rounded font-bold hover:bg-red-50">
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ BOOKING ══ */}
          {tab === 'book' && (
            <div className="space-y-3">
              <div className="font-bold text-gray-800 bengali text-sm">📅 নতুন Appointment বুক করুন</div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="রোগীর নাম *" className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 bengali col-span-2" value={bookForm.patientName} onChange={e => setBookForm({ ...bookForm, patientName: e.target.value })} />
                <input placeholder="ফোন নম্বর" className="border rounded-lg px-3 py-2 text-sm focus:outline-none" value={bookForm.phone} onChange={e => setBookForm({ ...bookForm, phone: e.target.value })} />
                <input placeholder="বয়স" className="border rounded-lg px-3 py-2 text-sm focus:outline-none bengali" value={bookForm.age} onChange={e => setBookForm({ ...bookForm, age: e.target.value })} />
                <input type="date" className="border rounded-lg px-3 py-2 text-sm focus:outline-none" value={bookForm.date} onChange={e => setBookForm({ ...bookForm, date: e.target.value })} />
                <select className="border rounded-lg px-3 py-2 text-sm focus:outline-none" value={bookForm.time} onChange={e => setBookForm({ ...bookForm, time: e.target.value })}>
                  {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
                </select>
                <select className="border rounded-lg px-3 py-2 text-sm focus:outline-none bengali" value={bookForm.type} onChange={e => setBookForm({ ...bookForm, type: e.target.value as any })}>
                  <option value="new">নতুন রোগী</option>
                  <option value="followup">Follow-up</option>
                  <option value="emergency">জরুরি</option>
                </select>
                <input type="number" placeholder="ফি (₹) — ডিফল্ট ₹400" className="border rounded-lg px-3 py-2 text-sm focus:outline-none" value={bookForm.fee} onChange={e => setBookForm({ ...bookForm, fee: e.target.value })} />
                <textarea placeholder="রোগীর সমস্যা / নোট" rows={3} className="border rounded-lg px-3 py-2 text-sm focus:outline-none col-span-2 bengali" value={bookForm.notes} onChange={e => setBookForm({ ...bookForm, notes: e.target.value })} />
              </div>
              <button onClick={bookAppointment} className="w-full bg-indigo-600 text-white rounded-lg py-2.5 font-bold bengali hover:bg-indigo-700">Appointment বুক করুন</button>

              {/* Today's schedule summary */}
              <div className="bg-gray-50 border rounded-xl p-3 mt-4">
                <div className="font-bold text-gray-700 bengali text-xs mb-2">📋 আজকের সময়সূচি</div>
                <div className="space-y-1">
                  {TIME_SLOTS.map(slot => {
                    const booked = appointments.filter(a => a.date === today() && a.time === slot)
                    return (
                      <div key={slot} className={`flex items-center gap-3 text-xs ${booked.length > 0 ? '' : 'opacity-40'}`}>
                        <span className="w-12 text-gray-500 font-mono">{slot}</span>
                        {booked.length > 0
                          ? booked.map(b => <span key={b.id} className={`text-xs font-semibold bengali ${b.type === 'emergency' ? 'text-red-600' : 'text-gray-800'}`}>{b.patientName} {b.type === 'emergency' ? '🚨' : ''}</span>)
                          : <span className="text-gray-300 bengali">খালি</span>
                        }
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══ PATIENT HISTORY ══ */}
          {tab === 'patients' && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="রোগীর নাম বা ফোন দিয়ে খুঁজুন..." className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-indigo-400 bengali" />
              </div>
              {filteredPatients.length === 0 && <div className="text-center py-8 text-gray-400 bengali text-sm">কোনো রোগী পাওয়া যায়নি</div>}
              {filteredPatients.map(p => (
                <div key={p.id} className="bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-bold text-gray-800 bengali">{p.name}</div>
                      <div className="text-xs text-gray-400 bengali flex gap-3 mt-0.5">
                        <span>📞 {p.phone}</span>
                        <span>🎂 {p.age} বছর</span>
                        {p.bloodGroup && <span>🩸 {p.bloodGroup}</span>}
                      </div>
                      {p.address && <div className="text-xs text-gray-400 bengali">📍 {p.address}</div>}
                    </div>
                    <div>
                      {p.totalDue > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-bold bengali">বকেয়া ₹{p.totalDue}</span>}
                    </div>
                  </div>
                  {p.visits.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-[10px] font-bold text-gray-400 bengali">পূর্ববর্তী ভিজিট</div>
                      {p.visits.slice(-3).map((v, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{v.date}</span>
                          <span className="text-gray-700 bengali">{v.diagnosis}</span>
                          <span className="font-bold text-indigo-700">₹{v.fee}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ══ FEES ══ */}
          {tab === 'fees' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'আজকের আয়', value: `₹${todayRevenue}`, bg: 'bg-green-50 border-green-200 text-green-700' },
                  { label: 'মোট বকেয়া', value: `₹${totalDue}`, bg: 'bg-red-50 border-red-200 text-red-700' },
                ].map(c => (
                  <div key={c.label} className={`${c.bg} border rounded-xl p-3 text-center`}>
                    <div className="font-extrabold text-xl">{c.value}</div>
                    <div className="text-xs bengali opacity-70">{c.label}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white border rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 text-xs font-bold text-gray-500 bengali">সব বকেয়া ফি</div>
                {appointments.filter(a => a.fee - a.paid > 0).length === 0
                  ? <div className="text-center py-6 text-gray-400 bengali text-sm">কোনো বকেয়া নেই ✓</div>
                  : appointments.filter(a => a.fee - a.paid > 0).map(a => (
                    <div key={a.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 hover:bg-gray-50">
                      <div>
                        <div className="font-semibold text-gray-800 bengali text-sm">{a.patientName}</div>
                        <div className="text-xs text-gray-400 bengali">{a.date} · {a.phone}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-red-600">₹{a.fee - a.paid}</span>
                        <button onClick={() => collectFee(a.id)} className="text-[10px] bg-green-600 text-white px-2 py-1 rounded font-bold bengali hover:bg-green-700">ফি নিন</button>
                      </div>
                    </div>
                  ))
                }
              </div>

              {/* Fee structure */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                <div className="font-bold text-indigo-800 bengali text-sm mb-2">💡 ফি কাঠামো</div>
                <div className="space-y-1.5 text-sm">
                  {[['নতুন রোগী', '₹400'], ['Follow-up', '₹300'], ['জরুরি', '₹500']].map(([t, f]) => (
                    <div key={t} className="flex justify-between">
                      <span className="text-gray-600 bengali">{t}</span>
                      <span className="font-bold text-indigo-700">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
