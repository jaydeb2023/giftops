'use client'
import { useState } from 'react'
import { Pencil, Plus, Trash2, ShoppingCart } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/rv/client'
import { GST_RATES } from '@/lib/rv/constants'
import { inr } from '@/lib/rv/util'
import { Button, Card, Empty, Table, Td } from '../ui'
import FormModal from '../FormModal'
import type { FieldDef } from '../ResourcePage'
import type { OrderDetail } from './types'

const fields: FieldDef[] = [
  { key: 'name', label: 'Item', required: true, full: true, placeholder: 'e.g. Premium sweet box (500g)' },
  { key: 'qty', label: 'Total quantity for the order', type: 'number', required: true, default: 1 },
  { key: 'unit_price', label: 'Selling price per unit (Rs, ex-GST)', type: 'number', required: true, default: 0 },
  { key: 'cost_price', label: 'Cost per unit (Rs)', type: 'number', default: 0 },
  { key: 'gst_rate', label: 'GST %', type: 'select', options: GST_RATES.map(g => ({ value: String(g), label: `${g}%` })), default: '18' },
  { key: 'hsn', label: 'HSN / SAC' },
  { key: 'vendor_id', label: 'Vendor', type: 'select', options: { remote: 'vendors', label: r => r.name, params: { active: 'true' } } },
  { key: 'packaging', label: 'Packaging' },
  { key: 'customization', label: 'Customisation', full: true },
]

export default function ItemsTab({ d, reload, canEdit }: { d: OrderDetail; reload: () => void; canEdit: boolean }) {
  const [edit, setEdit] = useState<{ row: any | null } | null>(null)
  const items = d.items

  const submit = async (v: Record<string, any>) => {
    const body = { ...v, order_id: d.order.id, gst_rate: Number(v.gst_rate ?? 18) }
    if (edit?.row) await api(`/api/rv/r/order_items/${edit.row.id}`, { method: 'PATCH', body })
    else await api('/api/rv/r/order_items', { body })
    toast.success('Saved'); reload()
  }
  const del = async (id: string) => { if (!confirm('Remove this item?')) return; try { await api(`/api/rv/r/order_items/${id}`, { method: 'DELETE' }); reload() } catch (e: any) { toast.error(e.message) } }

  // one purchase line per item, so ops can allocate/track vendors (skips items already purchased)
  const makePurchases = async () => {
    const have = new Set(d.purchases.map(p => p.description.toLowerCase()))
    const todo = items.filter(i => !have.has(i.name.toLowerCase()))
    if (!todo.length) return toast('All items already have purchase lines.')
    try {
      for (const i of todo) {
        await api('/api/rv/r/purchases', { body: { order_id: d.order.id, vendor_id: i.vendor_id, description: i.name, qty: Number(i.qty), unit_cost: Number(i.cost_price), status: 'requested' } })
      }
      toast.success(`${todo.length} purchase line(s) created`); reload()
    } catch (e: any) { toast.error(e.message) }
  }

  return (
    <Card title="Order items" pad={false} actions={canEdit && <>
      <Button size="sm" onClick={makePurchases}><ShoppingCart className="h-3.5 w-3.5" />Create purchase lines</Button>
      <Button size="sm" variant="primary" onClick={() => setEdit({ row: null })}><Plus className="h-3.5 w-3.5" />Add item</Button>
    </>}>
      <div className="p-4">
        {items.length === 0 ? <Empty>No items yet. Add each gift, sweet box or hamper with its total quantity for the whole order.</Empty> : (
          <Table head={['Item', 'Qty', 'Price', 'Cost', 'GST', 'Vendor', 'Line total', canEdit ? '' : '']}>
            {items.map(i => (
              <tr key={i.id}>
                <Td><div className="font-medium">{i.name}</div><div className="text-xs text-gray-500">{[i.packaging, i.customization].filter(Boolean).join(' | ')}</div></Td>
                <Td>{i.qty}</Td><Td>{inr(i.unit_price)}</Td><Td>{inr(i.cost_price)}</Td><Td>{i.gst_rate}%</Td>
                <Td>{i.vendor?.name || <span className="text-amber-600">-</span>}</Td>
                <Td>{inr(Number(i.qty) * Number(i.unit_price))}</Td>
                <Td className="text-right whitespace-nowrap">{canEdit && <>
                  <Button size="sm" variant="ghost" onClick={() => setEdit({ row: i })} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => del(i.id)} aria-label="Remove"><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button></>}</Td>
              </tr>
            ))}
          </Table>
        )}
        <div className="mt-3 grid max-w-sm grid-cols-2 gap-y-1 text-sm">
          <span className="text-gray-500">Items subtotal</span><span className="text-right">{inr(d.totals.gross)}</span>
          <span className="text-gray-500">Discount</span><span className="text-right">- {inr(d.totals.discount)}</span>
          <span className="text-gray-500">GST</span><span className="text-right">{inr(d.totals.gst)}</span>
          <span className="font-semibold">Quote total</span><span className="text-right font-semibold">{inr(d.totals.total)}</span>
        </div>
        <p className="mt-2 text-xs text-gray-400">Quantities are totals for the whole order (for example 50 boxes for 50 recipients). Edit the discount from the order details. Per-recipient gift notes go on each recipient.</p>
      </div>
      <FormModal open={!!edit} onClose={() => setEdit(null)} title={edit?.row ? 'Edit item' : 'Add item'} fields={fields}
        initial={edit?.row ? { ...edit.row, gst_rate: String(edit.row.gst_rate) } : undefined} onSubmit={submit} />
    </Card>
  )
}
