'use client'
import ResourcePage, { FieldDef } from '@/components/rv/ResourcePage'
import { Badge } from '@/components/rv/ui'
import { fmtDate } from '@/lib/rv/client'
import { EXPENSE_CLASSES, labelize } from '@/lib/rv/constants'
import { inr } from '@/lib/rv/util'

const fields: FieldDef[] = [
  { key: 'expense_date', label: 'Date', type: 'date', default: new Date().toISOString().slice(0, 10) },
  { key: 'head', label: 'Cost head', required: true, placeholder: 'Packaging, fuel, rent, salaries...' },
  { key: 'amount', label: 'Amount (Rs)', type: 'number', required: true },
  { key: 'classification', label: 'Behaviour', type: 'select', options: EXPENSE_CLASSES.map(v => ({ value: v, label: labelize(v) })), default: 'variable' },
  { key: 'order_id', label: 'Link to order (direct cost)', type: 'select', options: { remote: 'orders', label: r => `${r.order_no} - ${r.customer?.company || r.customer?.name || ''}` } },
  { key: 'document_ref', label: 'Document / receipt ref' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
  { key: 'approved', label: 'Approved', type: 'checkbox' },
]

export default function ExpensesPage() {
  return (
    <ResourcePage
      title="Expenses"
      subtitle="Expense register by cost head. Link an expense to an order to include it in that order's contribution."
      resource="expenses"
      createLabel="New expense"
      modalTitle="expense"
      exportKind="expenses"
      searchPlaceholder="Search cost head, notes..."
      filters={[{ key: 'classification', label: 'Behaviour', options: EXPENSE_CLASSES.map(v => ({ value: v, label: labelize(v) })) }]}
      fields={fields}
      canDelete
      columns={[
        { key: 'expense_date', label: 'Date', render: r => fmtDate(r.expense_date) },
        { key: 'head', label: 'Cost head' },
        { key: 'classification', label: 'Behaviour', render: r => labelize(r.classification) },
        { key: 'amount', label: 'Amount', render: r => inr(r.amount) },
        { key: 'order', label: 'Order', render: r => r.order?.order_no || '-' },
        { key: 'approved', label: 'Approval', render: r => <Badge value={r.approved ? 'completed' : 'pending'} /> },
      ]}
    />
  )
}
