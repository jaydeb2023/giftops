-- Sahayak AI — Universal CRM Schema
-- Run in Supabase SQL Editor AFTER 002_reports_schema.sql

-- ── Customers ─────────────────────────────────────────────────
create table if not exists public.crm_customers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  agent_id uuid references public.agents on delete set null,
  business_type text default 'pharmacy', -- 'pharmacy','dokan','hotel','coaching'
  name text not null,
  name_bn text,
  age integer,
  gender text default 'unknown', -- 'male','female','other','unknown'
  phone text,
  address text,
  doctor_name text,        -- for pharmacy
  blood_group text,        -- for pharmacy
  notes text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

-- ── Purchase / Transaction history ────────────────────────────
create table if not exists public.crm_purchases (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  customer_id uuid references public.crm_customers on delete cascade not null,
  purchase_date date not null default current_date,
  item_name text not null,          -- medicine name / product / service
  item_category text,               -- 'medicine','otc','equipment','food','tuition'
  quantity numeric(10,2) default 1,
  unit text default 'pcs',          -- 'strip','tablet','kg','pcs','session'
  unit_price numeric(10,2) not null,
  total_amount numeric(10,2) generated always as (quantity * unit_price) stored,
  paid_amount numeric(10,2) default 0,
  due_amount numeric(10,2) generated always as (quantity * unit_price - paid_amount) stored,
  payment_status text default 'pending', -- 'paid','partial','pending'
  prescription_id uuid,             -- link to prescription if pharmacy
  notes text,
  source text default 'manual',     -- 'manual','voice','photo','chat'
  created_at timestamp with time zone default timezone('utc', now())
);

-- ── Prescriptions (pharmacy specific) ────────────────────────
create table if not exists public.crm_prescriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  customer_id uuid references public.crm_customers on delete cascade not null,
  prescription_date date not null default current_date,
  doctor_name text,
  doctor_qualification text,
  hospital_clinic text,
  diagnosis text,
  medicines jsonb default '[]'::jsonb, -- [{name, dosage, duration, qty}]
  image_url text,                    -- stored photo of prescription
  extracted_text text,               -- AI extracted raw text from photo
  notes text,
  source text default 'manual',      -- 'manual','photo'
  created_at timestamp with time zone default timezone('utc', now())
);

-- ── Khata / Photo extracted data ──────────────────────────────
create table if not exists public.crm_khata_imports (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  imported_at timestamp with time zone default timezone('utc', now()),
  image_url text,
  raw_extracted_text text,           -- what AI read from photo
  parsed_records jsonb default '[]'::jsonb, -- AI parsed into structured records
  status text default 'pending',     -- 'pending','confirmed','imported'
  records_imported integer default 0
);

-- ── RLS policies ──────────────────────────────────────────────
alter table public.crm_customers     enable row level security;
alter table public.crm_purchases     enable row level security;
alter table public.crm_prescriptions enable row level security;
alter table public.crm_khata_imports enable row level security;

create policy "Users manage own crm_customers"     on public.crm_customers     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own crm_purchases"     on public.crm_purchases     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own crm_prescriptions" on public.crm_prescriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own crm_khata_imports" on public.crm_khata_imports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────
create index if not exists idx_crm_customers_user     on public.crm_customers(user_id);
create index if not exists idx_crm_customers_phone    on public.crm_customers(phone);
create index if not exists idx_crm_purchases_customer on public.crm_purchases(customer_id);
create index if not exists idx_crm_purchases_date     on public.crm_purchases(purchase_date);
create index if not exists idx_crm_prescriptions_cust on public.crm_prescriptions(customer_id);

-- ── Update trigger for customers ──────────────────────────────
create or replace function update_crm_customer_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create trigger trg_crm_customers_updated_at
  before update on public.crm_customers
  for each row execute function update_crm_customer_updated_at();
