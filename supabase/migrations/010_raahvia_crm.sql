-- =====================================================================
-- 010_raahvia_crm.sql
-- Raahvia Gift Fulfilment CRM: leads, customers, orders with many
-- recipients, operations, delivery runs + POD, invoices, payments,
-- bills, expenses, communications, tasks, audit log.
--
-- Access model: every table has RLS ENABLED with NO policies, so the
-- browser (anon / authenticated keys) can never read or write them.
-- All access goes through /api/rv/* routes which use the service-role
-- key AFTER checking the caller's role in rv_staff.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- helpers ---------------------------------------------------
create or replace function public.rv_touch() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.rv_counters (
  name  text primary key,
  value bigint not null default 0
);

-- Atomic, gap-tolerant sequential numbers (order_no, invoice_no, ...)
create or replace function public.rv_next_number(p_name text) returns bigint as $$
declare v bigint;
begin
  insert into public.rv_counters(name, value) values (p_name, 1)
  on conflict (name) do update set value = public.rv_counters.value + 1
  returning value into v;
  return v;
end;
$$ language plpgsql;

-- ---------- staff & settings -----------------------------------------
create table if not exists public.rv_staff (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  mobile     text,
  role       text not null default 'sales'
             check (role in ('admin','sales','ops','finance','rider')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists rv_staff_role_idx on public.rv_staff(role) where active;

create table if not exists public.rv_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------- leads & customers ----------------------------------------
create table if not exists public.rv_customers (
  id              uuid primary key default gen_random_uuid(),
  customer_no     text unique,
  type            text not null default 'corporate' check (type in ('corporate','personal')),
  name            text not null,
  company         text,
  gstin           text,
  mobile          text,
  mobile_norm     text,
  email           text,
  billing_address text,
  state_code      text default '19',
  credit_days     integer not null default 0,
  consent_whatsapp boolean not null default true,
  opt_out         boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists rv_customers_mobile_idx on public.rv_customers(mobile_norm);
create trigger rv_customers_touch before update on public.rv_customers
  for each row execute function public.rv_touch();

create table if not exists public.rv_contacts (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.rv_customers(id) on delete cascade,
  name        text not null,
  designation text,
  mobile      text,
  email       text,
  created_at  timestamptz not null default now()
);
create index if not exists rv_contacts_customer_idx on public.rv_contacts(customer_id);

create table if not exists public.rv_leads (
  id               uuid primary key default gen_random_uuid(),
  lead_no          text unique,
  name             text not null,
  company          text,
  mobile           text,
  mobile_norm      text,
  email            text,
  source           text not null default 'manual'
                   check (source in ('phone','website','whatsapp','chatbot','referral','social','manual')),
  stage            text not null default 'new'
                   check (stage in ('new','contacted','qualified','quotation_sent','negotiation','converted','lost','on_hold')),
  owner_id         uuid references public.rv_staff(id) on delete set null,
  expected_value   numeric(12,2),
  occasion         text,
  lost_reason      text,
  notes            text,
  next_followup_at timestamptz,
  customer_id      uuid references public.rv_customers(id) on delete set null,
  consent_whatsapp boolean not null default true,
  opt_out          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists rv_leads_mobile_idx on public.rv_leads(mobile_norm);
create index if not exists rv_leads_stage_idx on public.rv_leads(stage);
create index if not exists rv_leads_followup_idx on public.rv_leads(next_followup_at);
create trigger rv_leads_touch before update on public.rv_leads
  for each row execute function public.rv_touch();

-- ---------- vendors ---------------------------------------------------
create table if not exists public.rv_vendors (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text,
  contact_name  text,
  mobile        text,
  email         text,
  gstin         text,
  service_area  text,
  lead_time_days integer,
  quality_score numeric(3,1),
  payment_terms text,
  notes         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------- orders ----------------------------------------------------
create table if not exists public.rv_orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       text unique,
  customer_id    uuid not null references public.rv_customers(id) on delete restrict,
  lead_id        uuid references public.rv_leads(id) on delete set null,
  occasion       text,
  delivery_date  date,
  window_start   text,
  window_end     text,
  status         text not null default 'enquiry'
                 check (status in ('enquiry','quotation','confirmed','procurement','packing',
                                   'ready_dispatch','part_delivered','delivered','exception',
                                   'cancelled','closed')),
  owner_id       uuid references public.rv_staff(id) on delete set null,
  packaging_notes text,
  message_card   text,
  discount       numeric(12,2) not null default 0,
  payment_terms  text,
  quote_version  integer not null default 1,
  quote_approved boolean not null default false,
  place_of_supply text default '19',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists rv_orders_customer_idx on public.rv_orders(customer_id);
create index if not exists rv_orders_status_idx on public.rv_orders(status);
create index if not exists rv_orders_date_idx on public.rv_orders(delivery_date);
create trigger rv_orders_touch before update on public.rv_orders
  for each row execute function public.rv_touch();

create table if not exists public.rv_order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.rv_orders(id) on delete cascade,
  name          text not null,
  qty           numeric(12,2) not null default 1,
  unit_price    numeric(12,2) not null default 0,
  cost_price    numeric(12,2) not null default 0,
  gst_rate      numeric(5,2) not null default 18,
  hsn           text,
  vendor_id     uuid references public.rv_vendors(id) on delete set null,
  packaging     text,
  customization text,
  created_at    timestamptz not null default now()
);
create index if not exists rv_order_items_order_idx on public.rv_order_items(order_id);

-- ---------- delivery runs (declared before recipients for the FK) ----
create table if not exists public.rv_delivery_runs (
  id             uuid primary key default gen_random_uuid(),
  run_no         text unique,
  run_date       date not null default current_date,
  zone           text,
  rider_staff_id uuid references public.rv_staff(id) on delete set null,
  rider_name     text,
  partner        text,
  vehicle        text,
  feeder_vehicle text,
  status         text not null default 'planned'
                 check (status in ('planned','out_for_delivery','completed','cancelled')),
  run_cost       numeric(12,2) not null default 0,
  distance_km    numeric(8,1),
  notes          text,
  started_at     timestamptz,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists rv_runs_date_idx on public.rv_delivery_runs(run_date);
create trigger rv_runs_touch before update on public.rv_delivery_runs
  for each row execute function public.rv_touch();

-- ---------- recipients (= one delivery / one stop) --------------------
create table if not exists public.rv_recipients (
  id               uuid primary key default gen_random_uuid(),
  delivery_no      text unique,
  order_id         uuid not null references public.rv_orders(id) on delete cascade,
  name             text not null,
  mobile           text,
  mobile_norm      text,
  address_line     text,
  landmark         text,
  pincode          text,
  zone             text,
  instructions     text,
  items_note       text,
  card_message     text,
  -- address collection chain: WhatsApp -> AI call -> human call -> verified
  address_status   text not null default 'pending'
                   check (address_status in ('pending','reminder_sent','replied','ai_call','ai_captured',
                                             'human_call','verified','exception')),
  address_attempts integer not null default 0,
  last_attempt_at  timestamptz,
  suggested_address text,          -- AI/WhatsApp-captured text; never auto-overwrites a verified address
  verified_at      timestamptz,
  verified_by      uuid references public.rv_staff(id) on delete set null,
  -- packing
  packed           boolean not null default false,
  packed_by        uuid references public.rv_staff(id) on delete set null,
  packed_at        timestamptz,
  qc_ok            boolean,
  rework_reason    text,
  -- delivery
  delivery_status  text not null default 'pending'
                   check (delivery_status in ('pending','assigned','picked_up','in_transit',
                                              'delivered','failed','returned','cancelled')),
  run_id           uuid references public.rv_delivery_runs(id) on delete set null,
  stop_seq         integer,
  delivered_at     timestamptz,
  received_by      text,
  pod_type         text,           -- photo | signature | otp | reference
  pod_ref          text,           -- OTP/reference text
  pod_path         text,           -- storage path in bucket rv-pod
  failed_reason    text,
  attempt_count    integer not null default 0,
  reattempt_date   date,
  delivery_cost    numeric(12,2) not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists rv_recipients_order_idx on public.rv_recipients(order_id);
create index if not exists rv_recipients_run_idx on public.rv_recipients(run_id);
create index if not exists rv_recipients_addr_idx on public.rv_recipients(address_status);
create index if not exists rv_recipients_dstatus_idx on public.rv_recipients(delivery_status);
create index if not exists rv_recipients_mobile_idx on public.rv_recipients(mobile_norm);
create trigger rv_recipients_touch before update on public.rv_recipients
  for each row execute function public.rv_touch();

-- ---------- purchases (order -> vendor) -------------------------------
create table if not exists public.rv_purchases (
  id               uuid primary key default gen_random_uuid(),
  purchase_no      text unique,
  order_id         uuid not null references public.rv_orders(id) on delete cascade,
  vendor_id        uuid references public.rv_vendors(id) on delete set null,
  description      text not null,
  qty              numeric(12,2) not null default 1,
  unit_cost        numeric(12,2) not null default 0,
  total_cost       numeric(12,2) not null default 0,
  status           text not null default 'requested'
                   check (status in ('requested','confirmed','ready','received','issue','cancelled')),
  supplier_invoice_ref text,
  issue_note       text,
  expected_at      date,
  received_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists rv_purchases_order_idx on public.rv_purchases(order_id);
create index if not exists rv_purchases_vendor_idx on public.rv_purchases(vendor_id);
create trigger rv_purchases_touch before update on public.rv_purchases
  for each row execute function public.rv_touch();

-- ---------- invoices / payments --------------------------------------
create table if not exists public.rv_invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_no      text unique,
  doc_type        text not null default 'invoice' check (doc_type in ('invoice','credit_note')),
  ref_invoice_id  uuid references public.rv_invoices(id) on delete set null,
  order_id        uuid references public.rv_orders(id) on delete set null,
  customer_id     uuid not null references public.rv_customers(id) on delete restrict,
  invoice_date    date not null default current_date,
  due_date        date,
  status          text not null default 'issued'
                  check (status in ('draft','issued','part_paid','paid','cancelled')),
  place_of_supply text default '19',
  taxable_value   numeric(14,2) not null default 0,
  cgst            numeric(14,2) not null default 0,
  sgst            numeric(14,2) not null default 0,
  igst            numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  paid_amount     numeric(14,2) not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists rv_invoices_customer_idx on public.rv_invoices(customer_id);
create index if not exists rv_invoices_order_idx on public.rv_invoices(order_id);
create index if not exists rv_invoices_due_idx on public.rv_invoices(due_date);
create trigger rv_invoices_touch before update on public.rv_invoices
  for each row execute function public.rv_touch();

create table if not exists public.rv_invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.rv_invoices(id) on delete cascade,
  description text not null,
  hsn         text,
  qty         numeric(12,2) not null default 1,
  rate        numeric(12,2) not null default 0,
  gst_rate    numeric(5,2) not null default 18,
  amount      numeric(14,2) not null default 0   -- taxable amount of this line
);
create index if not exists rv_invoice_lines_inv_idx on public.rv_invoice_lines(invoice_id);

create table if not exists public.rv_payments (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.rv_customers(id) on delete set null,
  invoice_id  uuid references public.rv_invoices(id) on delete set null,
  order_id    uuid references public.rv_orders(id) on delete set null,
  received_on date not null default current_date,
  amount      numeric(14,2) not null,
  mode        text not null default 'upi' check (mode in ('upi','bank','cash','cheque','card','other')),
  reference   text,
  notes       text,
  created_by  uuid references public.rv_staff(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists rv_payments_invoice_idx on public.rv_payments(invoice_id);

-- ---------- payables: vendor / courier bills --------------------------
create table if not exists public.rv_bills (
  id          uuid primary key default gen_random_uuid(),
  bill_type   text not null default 'vendor' check (bill_type in ('vendor','courier','other')),
  vendor_id   uuid references public.rv_vendors(id) on delete set null,
  party_name  text,
  order_id    uuid references public.rv_orders(id) on delete set null,
  run_id      uuid references public.rv_delivery_runs(id) on delete set null,
  purchase_id uuid references public.rv_purchases(id) on delete set null,
  bill_no     text,
  bill_date   date not null default current_date,
  due_date    date,
  amount      numeric(14,2) not null,
  paid_amount numeric(14,2) not null default 0,
  status      text not null default 'unpaid' check (status in ('unpaid','part_paid','paid','cancelled')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists rv_bills_vendor_idx on public.rv_bills(vendor_id);
create index if not exists rv_bills_order_idx on public.rv_bills(order_id);
create trigger rv_bills_touch before update on public.rv_bills
  for each row execute function public.rv_touch();

create table if not exists public.rv_bill_payments (
  id        uuid primary key default gen_random_uuid(),
  bill_id   uuid not null references public.rv_bills(id) on delete cascade,
  paid_on   date not null default current_date,
  amount    numeric(14,2) not null,
  mode      text default 'bank',
  reference text,
  created_at timestamptz not null default now()
);

create table if not exists public.rv_expenses (
  id             uuid primary key default gen_random_uuid(),
  expense_date   date not null default current_date,
  head           text not null,
  classification text not null default 'variable' check (classification in ('fixed','variable','semi_variable')),
  amount         numeric(14,2) not null,
  order_id       uuid references public.rv_orders(id) on delete set null,
  approved       boolean not null default false,
  document_ref   text,
  notes          text,
  created_by     uuid references public.rv_staff(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists rv_expenses_order_idx on public.rv_expenses(order_id);

-- ---------- communications, tasks, audit ------------------------------
create table if not exists public.rv_communications (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid references public.rv_leads(id) on delete set null,
  customer_id  uuid references public.rv_customers(id) on delete set null,
  order_id     uuid references public.rv_orders(id) on delete set null,
  recipient_id uuid references public.rv_recipients(id) on delete set null,
  channel      text not null check (channel in ('whatsapp','call','ai_call','sms','email','note')),
  direction    text not null default 'out' check (direction in ('in','out')),
  mobile_norm  text,
  body         text,
  status       text,            -- queued | sent | delivered | read | failed | answered | no_answer ...
  outcome      text,            -- free-form result (e.g. address_complete, wrong_number)
  provider_ref text,
  owner_id     uuid references public.rv_staff(id) on delete set null,
  next_action  text,
  meta         jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists rv_comms_lead_idx on public.rv_communications(lead_id);
create index if not exists rv_comms_customer_idx on public.rv_communications(customer_id);
create index if not exists rv_comms_recipient_idx on public.rv_communications(recipient_id);
create index if not exists rv_comms_order_idx on public.rv_communications(order_id);
create index if not exists rv_comms_mobile_idx on public.rv_communications(mobile_norm);
create index if not exists rv_comms_provider_idx on public.rv_communications(provider_ref);
create index if not exists rv_comms_created_idx on public.rv_communications(created_at desc);

create table if not exists public.rv_tasks (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null default 'follow_up' check (kind in ('follow_up','address','exception','other')),
  title        text not null,
  due_at       timestamptz,
  assigned_to  uuid references public.rv_staff(id) on delete set null,
  lead_id      uuid references public.rv_leads(id) on delete cascade,
  order_id     uuid references public.rv_orders(id) on delete cascade,
  recipient_id uuid references public.rv_recipients(id) on delete cascade,
  status       text not null default 'open' check (status in ('open','done')),
  closure_note text,
  created_at   timestamptz not null default now(),
  closed_at    timestamptz
);
create index if not exists rv_tasks_open_idx on public.rv_tasks(status, due_at);

create table if not exists public.rv_audit (
  id          bigserial primary key,
  actor_id    uuid,
  actor_email text,
  table_name  text not null,
  record_id   text,
  action      text not null,
  changes     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists rv_audit_table_idx on public.rv_audit(table_name, record_id);
create index if not exists rv_audit_created_idx on public.rv_audit(created_at desc);

-- ---------- lock everything down (service role only) ------------------
alter table public.rv_counters       enable row level security;
alter table public.rv_staff          enable row level security;
alter table public.rv_settings       enable row level security;
alter table public.rv_customers      enable row level security;
alter table public.rv_contacts       enable row level security;
alter table public.rv_leads          enable row level security;
alter table public.rv_vendors        enable row level security;
alter table public.rv_orders         enable row level security;
alter table public.rv_order_items    enable row level security;
alter table public.rv_delivery_runs  enable row level security;
alter table public.rv_recipients     enable row level security;
alter table public.rv_purchases      enable row level security;
alter table public.rv_invoices       enable row level security;
alter table public.rv_invoice_lines  enable row level security;
alter table public.rv_payments       enable row level security;
alter table public.rv_bills          enable row level security;
alter table public.rv_bill_payments  enable row level security;
alter table public.rv_expenses       enable row level security;
alter table public.rv_communications enable row level security;
alter table public.rv_tasks          enable row level security;
alter table public.rv_audit          enable row level security;

-- ---------- private storage bucket for proof-of-delivery photos -------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('rv-pod', 'rv-pod', false)
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------- default settings ------------------------------------------
insert into public.rv_settings (key, value) values
('company', '{
  "name": "Raahvia",
  "tagline": "Gift Fulfilment Platform",
  "address": "Kolkata, West Bengal",
  "gstin": "",
  "state_code": "19",
  "phone": "",
  "email": "",
  "invoice_prefix": "RV",
  "bank_details": "",
  "upi_id": "",
  "default_gst_rate": 18,
  "invoice_terms": "Payment due as per agreed credit terms. Subject to Kolkata jurisdiction."
}'::jsonb),
('address_chase', '{
  "enabled": true,
  "whatsapp_template": "address_request",
  "whatsapp_language": "en",
  "reminder_after_hours": 6,
  "ai_call_after_hours": 12,
  "human_after_hours": 24,
  "max_attempts": 3
}'::jsonb)
on conflict (key) do nothing;
