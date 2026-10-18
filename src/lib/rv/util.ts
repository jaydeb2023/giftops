// Shared helpers (client + server).

/** Digits only, last 10 digits (Indian mobiles). Returns '' if too short. */
export function normMobile(raw: string | null | undefined): string {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length < 10) return ''
  return d.slice(-10)
}

export function isValidMobile(raw: string | null | undefined): boolean {
  return /^[6-9]\d{9}$/.test(normMobile(raw))
}

export function isValidPincode(p: string | null | undefined): boolean {
  return /^[1-9]\d{5}$/.test((p || '').trim())
}

/** Kolkata pincodes start 700. Used only for a soft warning, never a hard block. */
export function isKolkataPin(p: string | null | undefined): boolean {
  return /^700\d{3}$/.test((p || '').trim())
}

export function inr(n: number | string | null | undefined): string {
  const v = Number(n || 0)
  return 'Rs ' + v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export interface AddressCheck { ok: boolean; problems: string[] }

/** An address is "complete enough to verify" when it has a real line + valid pincode. */
export function checkAddress(a: { address_line?: string | null; pincode?: string | null; mobile?: string | null; name?: string | null }): AddressCheck {
  const problems: string[] = []
  if (!a.name || a.name.trim().length < 2) problems.push('Recipient name missing')
  if (!a.address_line || a.address_line.trim().length < 10) problems.push('Address line too short')
  if (!isValidPincode(a.pincode)) problems.push('Invalid PIN code')
  if (a.mobile && !isValidMobile(a.mobile)) problems.push('Invalid mobile number')
  return { ok: problems.length === 0, problems }
}

export interface GstSplit { cgst: number; sgst: number; igst: number }

export function splitGst(taxable: number, rate: number, sameState: boolean): GstSplit {
  const tax = round2((taxable * rate) / 100)
  if (sameState) {
    const half = round2(tax / 2)
    return { cgst: half, sgst: round2(tax - half), igst: 0 }
  }
  return { cgst: 0, sgst: 0, igst: tax }
}

/** Indian financial year label for a date, e.g. 2026-10-17 -> "2026-27". */
export function financialYear(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const start = m >= 4 ? y : y - 1
  return `${start}-${String(start + 1).slice(-2)}`
}

export function toCsv(rows: Record<string, any>[], columns?: string[]): string {
  const cols = columns || (rows[0] ? Object.keys(rows[0]) : [])
  const esc = (v: any) => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\r\n')
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100)
  const r = n % 100
  return (h ? ONES[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? twoDigits(r) : '')
}

/** Amount in words, Indian numbering (lakh/crore). */
export function amountInWords(amount: number): string {
  const total = Math.round(amount * 100)
  let rupees = Math.floor(total / 100)
  const paise = total % 100
  if (rupees === 0 && paise === 0) return 'Zero Rupees Only'
  const parts: string[] = []
  const crore = Math.floor(rupees / 10000000); rupees %= 10000000
  const lakh = Math.floor(rupees / 100000); rupees %= 100000
  const thousand = Math.floor(rupees / 1000); rupees %= 1000
  if (crore) parts.push(twoDigits(crore) + ' Crore')
  if (lakh) parts.push(twoDigits(lakh) + ' Lakh')
  if (thousand) parts.push(twoDigits(thousand) + ' Thousand')
  if (rupees) parts.push(threeDigits(rupees))
  let out = parts.join(' ')
  if (out) out += ' Rupees'
  if (paise) out += (out ? ' and ' : '') + twoDigits(paise) + ' Paise'
  return out + ' Only'
}
