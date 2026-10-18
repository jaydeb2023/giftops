export interface OrderDetail {
  order: any
  items: any[]
  recipients: any[]
  purchases: any[]
  invoices: any[]
  payments: any[]
  tasks: any[]
  totals: { gross: number; discount: number; taxable: number; gst: number; total: number; est_cost: number }
  counts: { recipients: number; address_verified: number; address_open: number; packed: number; delivered: number; failed: number; in_transit: number }
}
