import type { FieldDef } from '../ResourcePage'

export const orderFields: FieldDef[] = [
  { key: 'customer_id', label: 'Customer', type: 'select', required: true, options: { remote: 'customers', label: r => `${r.company || r.name}${r.mobile ? ' (' + r.mobile + ')' : ''}` } },
  { key: 'occasion', label: 'Occasion', placeholder: 'Diwali, wedding, corporate gifting...' },
  { key: 'delivery_date', label: 'Delivery date', type: 'date' },
  { key: 'window_start', label: 'Window from', placeholder: '10:00' },
  { key: 'window_end', label: 'Window to', placeholder: '18:00' },
  { key: 'owner_id', label: 'Order owner', type: 'select', options: { remote: 'staff', label: r => r.full_name, filter: r => ['sales', 'ops', 'admin'].includes(r.role) } },
  { key: 'payment_terms', label: 'Payment terms', placeholder: '50% advance, balance on delivery' },
  { key: 'place_of_supply', label: 'Place of supply (state code)', default: '19', help: '19 = West Bengal' },
  { key: 'discount', label: 'Discount (Rs)', type: 'number', default: 0 },
  { key: 'packaging_notes', label: 'Packaging / customisation', type: 'textarea' },
  { key: 'message_card', label: 'Message card text', type: 'textarea' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
]

