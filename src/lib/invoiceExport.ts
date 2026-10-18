// Turns the on-screen <InvoicePrintable> node into a PDF or PNG, and tries
// the device's native share sheet (so WhatsApp gets the actual file
// attached) — falling back to download + opening the WhatsApp chat when
// the browser can't do native file share (e.g. most desktop browsers).
//
// Needs: npm install html2canvas jspdf

import toast from 'react-hot-toast'

async function captureNode(node: HTMLElement): Promise<HTMLCanvasElement> {
  const html2canvas = (await import('html2canvas')).default
  return html2canvas(node, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function downloadInvoicePng(node: HTMLElement, filename: string) {
  const canvas = await captureNode(node)
  const url = canvas.toDataURL('image/png')
  triggerDownload(url, `${filename}.png`)
}

export async function downloadInvoicePdf(node: HTMLElement, filename: string) {
  const canvas = await captureNode(node)
  const { jsPDF } = await import('jspdf')
  const imgData = canvas.toDataURL('image/png')

  // Convert the captured canvas (px) into a PDF sized to match its aspect ratio.
  const pxToMm = 0.264583
  const widthMm = canvas.width * pxToMm / 2 // /2 because we captured at scale:2
  const heightMm = canvas.height * pxToMm / 2

  const pdf = new jsPDF({ unit: 'mm', format: [widthMm, heightMm] })
  pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm)
  pdf.save(`${filename}.pdf`)
}

async function nodeToFile(node: HTMLElement, filename: string, format: 'pdf' | 'png'): Promise<File> {
  const canvas = await captureNode(node)
  if (format === 'png') {
    const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b as Blob), 'image/png'))
    return new File([blob], `${filename}.png`, { type: 'image/png' })
  }
  const { jsPDF } = await import('jspdf')
  const imgData = canvas.toDataURL('image/png')
  const pxToMm = 0.264583
  const widthMm = canvas.width * pxToMm / 2
  const heightMm = canvas.height * pxToMm / 2
  const pdf = new jsPDF({ unit: 'mm', format: [widthMm, heightMm] })
  pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm)
  const blob = pdf.output('blob')
  return new File([blob], `${filename}.pdf`, { type: 'application/pdf' })
}

/**
 * Tries navigator.share with the actual file attached (native share sheet —
 * WhatsApp shows up as a target with the file already in it). If the
 * browser can't share files (most desktop browsers), downloads the file
 * instead and opens the WhatsApp chat for the customer's number so they
 * can attach it manually.
 */
export async function shareInvoiceNative(
  node: HTMLElement,
  opts: { filename: string; format: 'pdf' | 'png'; customerPhone?: string | null; message: string }
) {
  try {
    const file = await nodeToFile(node, opts.filename, opts.format)

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: opts.filename, text: opts.message })
      return
    }

    // Fallback: download the file, then open WhatsApp chat with a text message.
    const url = URL.createObjectURL(file)
    triggerDownload(url, file.name)
    URL.revokeObjectURL(url)
    toast(`ফাইল ডাউনলোড হয়েছে — WhatsApp চ্যাটে গিয়ে এটি অ্যাটাচ করুন`, { icon: '📎' })

    const phone = opts.customerPhone?.replace(/[^0-9]/g, '')
    if (phone) {
      window.open(`https://wa.me/91${phone.slice(-10)}?text=${encodeURIComponent(opts.message)}`, '_blank')
    }
  } catch (e) {
    console.error('shareInvoiceNative failed:', e)
    toast.error('শেয়ার করতে সমস্যা হয়েছে')
  }
}

/** Opens the browser print dialog with just the invoice node's content. */
export function printInvoiceNode(node: HTMLElement, title: string) {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><meta charset="utf-8">
<style>@import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
body{font-family:'Hind Siliguri',sans-serif;margin:0;padding:16px;display:flex;justify-content:center}
@media print{body{padding:0}}
</style></head><body>${node.outerHTML}</body></html>`)
  w.document.close()
  setTimeout(() => w.print(), 300)
}
