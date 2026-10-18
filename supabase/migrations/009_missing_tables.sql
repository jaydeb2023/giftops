-- ════════════════════════════════════════════════════════════════
-- Kaaj AI / Sahayak AI — Missing Tables Migration
-- Run this in Supabase SQL Editor AFTER 001–008.
--
-- WHY THIS EXISTS: the application code (API routes + dashboard
-- components) reads and writes ~35 tables that were never created by
-- any migration. This is why chat replies say "এই তথ্য আমার কাছে নেই"
-- (the DB query silently returns empty because the table doesn't
-- exist) and why the left-side dashboard panels stay stuck at ₹0.
-- This migration creates every one of those tables, matching the
-- exact column names the code already inserts/selects, with RLS
-- locked to auth.uid() = user_id the same way 001–008 do it.
-- ════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ── Shared trigger function (reused by every *_profiles / updated_at table) ──
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

-- ────────────────────────────────────────────────────────────────
-- 0. profiles — add the business-card columns InvoiceBuilder,
--    SalesOverview, CustomerBillingTable, InvoiceCreator and the
--    Dashboard "shop settings" form already read/write on `profiles`
--    directly (not on a per-vertical *_profiles table).
-- ────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists shop_name     text default '';
alter table public.profiles add column if not exists owner_name    text default '';
alter table public.profiles add column if not exists phone         text default '';
alter table public.profiles add column if not exists address       text default '';
alter table public.profiles add column if not exists upi_id        text default '';
alter table public.profiles add column if not exists gstin         text default '';
alter table public.profiles add column if not exists print_footer  text default 'ধন্যবাদ! আবার আসবেন 🙏';
alter table public.profiles add column if not exists signature_url text default '';

-- ════════════════════════════════════════════════════════════════
-- 1. DOKAN MANAGER  (business-chat/route.ts, DokanManagerUI.tsx)
-- ════════════════════════════════════════════════════════════════

create table if not exists public.dokan_customers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  agent_id uuid references public.agents on delete set null,
  name text not null,
  father_name text default '',
  phone text default '',
  address text default '',
  notes text default '',
  total_due numeric(10,2) default 0,
  total_spent numeric(10,2) default 0,
  last_visit date,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.dokan_sales (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  agent_id uuid references public.agents on delete set null,
  item_name text not null,
  customer_name text default 'নগদ',
  customer_phone text default '',
  quantity numeric(10,2) default 1,
  unit text default 'কেজি',
  unit_price numeric(10,2) default 0,
  total_amount numeric(10,2) default 0,
  paid_amount numeric(10,2) default 0,
  due_amount numeric(10,2) default 0,
  sale_date date not null default current_date,
  payment_status text default 'paid', -- 'paid' | 'partial' | 'pending'
  notes text default '',
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.dokan_suppliers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  agent_id uuid references public.agents on delete set null,
  supplier_name text not null,
  phone text default '',
  item_ordered text default '',
  qty_ordered numeric(10,2) default 0,
  unit text default 'কেজি',
  cost_total numeric(10,2) default 0,
  paid_amount numeric(10,2) default 0,
  due_amount numeric(10,2) default 0,
  order_date date default current_date,
  expected_date date,
  status text default 'ordered', -- 'ordered' | 'received' | 'cancelled'
  notes text default '',
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.dokan_profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  shop_name text default 'আমার দোকান',
  owner_name text default '',
  phone text default '',
  address text default '',
  upi_id text default '',
  gstin text default '',
  print_footer text default 'ধন্যবাদ! আবার আসবেন 🙏',
  logo_url text default '',
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

-- ════════════════════════════════════════════════════════════════
-- 2. HOTEL & DHABA MANAGER
-- ════════════════════════════════════════════════════════════════

create table if not exists public.hotel_customers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  phone text default '',
  address text default '',
  notes text default '',
  total_due numeric(10,2) default 0,
  total_spent numeric(10,2) default 0,
  last_visit date,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.hotel_menu (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  name_bn text default '',
  category text default '',
  price numeric(10,2) default 0,
  cost numeric(10,2) default 0,
  is_veg boolean default true,
  is_available boolean default true,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.hotel_orders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  table_no text default '',
  customer_name text default 'অজানা',
  customer_phone text default '',
  items jsonb default '[]'::jsonb, -- [{name, qty, price}]
  total_amount numeric(10,2) default 0,
  paid_amount numeric(10,2) default 0,
  due_amount numeric(10,2) default 0,
  status text default 'open', -- 'open' | 'paid' | 'cancelled'
  notes text default '',
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.hotel_stock (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  category text default '',
  quantity numeric(10,2) default 0,
  unit text default 'কেজি',
  min_quantity numeric(10,2) default 5,
  cost_per_unit numeric(10,2) default 0,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.hotel_profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  hotel_name text default 'আমার হোটেল',
  owner_name text default '',
  phone text default '',
  address text default '',
  gstin text default '',
  upi_id text default '',
  print_footer text default 'ধন্যবাদ! আবার আসবেন 🙏',
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

-- ════════════════════════════════════════════════════════════════
-- 3. MISHTI DOKAN MANAGER
-- ════════════════════════════════════════════════════════════════

create table if not exists public.mishti_customers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  phone text default '',
  address text default '',
  notes text default '',
  total_due numeric(10,2) default 0,
  total_spent numeric(10,2) default 0,
  is_regular boolean default false,
  last_purchase date,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.mishti_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  name_bn text default '',
  category text default '',
  price_per_kg numeric(10,2) default 0,
  cost_per_kg numeric(10,2) default 0,
  stock_kg numeric(10,2) default 0,
  min_stock_kg numeric(10,2) default 1,
  shelf_life_days numeric(6,2) default 3,
  is_available boolean default true,
  made_today_kg numeric(10,2) default 0,
  production_date date default current_date,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.mishti_sales (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  item_name text not null,
  quantity_kg numeric(10,2) default 1,
  price_per_kg numeric(10,2) default 0,
  total_amount numeric(10,2) default 0,
  paid_amount numeric(10,2) default 0,
  due_amount numeric(10,2) default 0,
  customer_name text default 'নগদ',
  customer_phone text default '',
  sale_date date not null default current_date,
  payment_status text default 'paid',
  occasion text default '',
  notes text default '',
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.mishti_production (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  item_name text not null,
  quantity_kg numeric(10,2) default 0,
  batch_no text default '',
  cost_total numeric(10,2) default 0,
  expiry_date date,
  production_date date not null default current_date,
  notes text default '',
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.mishti_profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  shop_name text default 'আমার মিষ্টির দোকান',
  owner_name text default '',
  phone text default '',
  address text default '',
  upi_id text default '',
  print_footer text default 'ধন্যবাদ! আবার আসবেন 🙏',
  festival_mode boolean default false,
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

-- ════════════════════════════════════════════════════════════════
-- 4. KAPORER DOKAN TRACKER
-- ════════════════════════════════════════════════════════════════

create table if not exists public.kapor_products (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  category text default '',
  size text default '',
  color text default '',
  stock_qty numeric(10,2) default 0,
  min_stock numeric(10,2) default 5,
  sell_price numeric(10,2) default 0,
  purchase_price numeric(10,2) default 0,
  supplier text default '',
  is_available boolean default true,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.kapor_customers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  phone text default '',
  address text default '',
  notes text default '',
  total_due numeric(10,2) default 0,
  total_spent numeric(10,2) default 0,
  last_visit date,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.kapor_sales (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  item_name text not null,
  qty numeric(10,2) default 1,
  sell_price numeric(10,2) default 0,
  discount numeric(10,2) default 0,
  total_amount numeric(10,2) default 0,
  paid_amount numeric(10,2) default 0,
  due_amount numeric(10,2) default 0,
  customer_name text default 'নগদ',
  customer_phone text default '',
  sale_date date not null default current_date,
  payment_status text default 'paid',
  notes text default '',
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.kapor_suppliers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  supplier_name text not null,
  phone text default '',
  item_ordered text default '',
  qty_ordered numeric(10,2) default 0,
  cost_total numeric(10,2) default 0,
  paid_amount numeric(10,2) default 0,
  due_amount numeric(10,2) default 0,
  order_date date default current_date,
  expected_date date,
  status text default 'ordered',
  notes text default '',
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.kapor_profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  shop_name text default 'আমার কাপড়ের দোকান',
  owner_name text default '',
  phone text default '',
  address text default '',
  upi_id text default '',
  print_footer text default 'ধন্যবাদ! আবার আসবেন 🙏',
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

-- ════════════════════════════════════════════════════════════════
-- 5. PHARMACY — pharmacy_profiles already exists (006/007 dup).
--    Nothing else missing here.
-- ════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- 6. CUSTOM / USER-BUILT AGENTS  (agent-chat/route.ts, dashboard)
-- ════════════════════════════════════════════════════════════════

create table if not exists public.agent_records (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  agent_id uuid references public.agents on delete cascade not null,
  record_type text default 'note', -- 'sale' | 'expense' | 'stock' | 'note' | ...
  label text default '',
  amount numeric(10,2),
  data jsonb default '{}'::jsonb,
  source text default 'chat',
  recorded_at date default current_date,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.agent_settings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  agent_id uuid references public.agents on delete cascade not null,
  settings jsonb default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc', now()),
  unique (agent_id, user_id)
);

create table if not exists public.user_agent_activations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  kind text not null, -- 'library' | 'custom'
  ref text not null,  -- library slug or custom agent id
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.agent_notes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  content text not null,
  source text default 'manual',
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.custom_categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  business_type text not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc', now())
);

-- ════════════════════════════════════════════════════════════════
-- 7. LIBRARY CHAT HISTORY  (24h chat session history in library/[slug])
-- ════════════════════════════════════════════════════════════════

create table if not exists public.library_chat_messages (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  agent_slug text not null,
  session_id uuid not null,
  role text not null, -- 'user' | 'assistant'
  content text not null,
  created_at timestamp with time zone default timezone('utc', now())
);

-- ════════════════════════════════════════════════════════════════
-- 8. PRODUCT CATALOG (public storefront)
-- ════════════════════════════════════════════════════════════════

create table if not exists public.catalog_products (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  description text default '',
  price numeric(10,2) default 0,
  image_url text,
  category text default '',
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.catalog_settings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  store_name text default 'আমার দোকান',
  tagline text default '',
  whatsapp_number text default '',
  theme_color text default '#7c3aed',
  logo_url text,
  is_published boolean default true,
  created_at timestamp with time zone default timezone('utc', now())
);

-- ════════════════════════════════════════════════════════════════
-- 9. INVOICES / QUOTATIONS  (referenced by src/lib/invoices.ts as
--    "see 009_invoices_schema.sql" — that file was never committed)
-- ════════════════════════════════════════════════════════════════

create table if not exists public.invoices (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  invoice_number text not null,
  doc_type text not null default 'invoice', -- 'invoice' | 'quotation'
  category text default 'general',
  customer_id uuid,
  customer_name text default 'নগদ কাস্টমার',
  customer_phone text,
  customer_address text,
  gst_enabled boolean default false,
  gst_rate numeric(5,2) default 0,
  discount_type text default 'none', -- 'none' | 'flat' | 'percent'
  discount_value numeric(10,2) default 0,
  subtotal numeric(10,2) default 0,
  discount_amount numeric(10,2) default 0,
  gst_amount numeric(10,2) default 0,
  total_amount numeric(10,2) default 0,
  paid_amount numeric(10,2) default 0,
  due_amount numeric(10,2) generated always as (total_amount - paid_amount) stored,
  status text default 'due', -- 'paid' | 'partial' | 'due'
  notes text,
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now()),
  unique (user_id, invoice_number)
);

create table if not exists public.invoice_items (
  id uuid default uuid_generate_v4() primary key,
  invoice_id uuid references public.invoices on delete cascade not null,
  item_name text not null,
  hsn_code text,
  quantity numeric(10,2) default 1,
  unit text default 'pcs',
  unit_price numeric(10,2) default 0,
  line_discount numeric(10,2) default 0,
  sort_order integer default 0
);

-- Per-user sequential invoice/quotation numbering (race-safe via a
-- dedicated sequence table + row lock, since "select max()+1" races
-- under concurrent requests).
create table if not exists public.invoice_counters (
  user_id uuid references auth.users on delete cascade not null,
  prefix text not null,
  next_number integer not null default 1,
  primary key (user_id, prefix)
);

create or replace function public.next_invoice_number(p_user_id uuid, p_prefix text)
returns text as $$
declare
  n integer;
begin
  insert into public.invoice_counters (user_id, prefix, next_number)
  values (p_user_id, p_prefix, 2)
  on conflict (user_id, prefix)
  do update set next_number = public.invoice_counters.next_number + 1
  returning next_number - 1 into n;

  return p_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
end;
$$ language plpgsql security definer;

-- ════════════════════════════════════════════════════════════════
-- 10. VENDORS / SUPPLY DASHBOARD  (generic business manager)
-- ════════════════════════════════════════════════════════════════

create table if not exists public.vendors (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  phone text,
  due_amount numeric(10,2) default 0,
  notes text,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.vendor_payments (
  id uuid default uuid_generate_v4() primary key,
  vendor_id uuid references public.vendors on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  amount numeric(10,2) not null,
  type text default 'payment',
  created_at timestamp with time zone default timezone('utc', now())
);

-- ════════════════════════════════════════════════════════════════
-- 11. WHATSAPP AUTOMATION SUITE
-- ════════════════════════════════════════════════════════════════

create table if not exists public.whatsapp_accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  phone_number_id text,
  waba_id text,
  display_phone text,
  verified_name text,
  status text default 'disconnected', -- 'connected' | 'error' | 'disconnected'
  auto_reply boolean default true,
  ai_tone text default 'friendly', -- 'friendly' | 'formal' | 'short'
  language text default 'bn', -- 'bn' | 'en' | 'auto'
  business_hours_start integer default 9,
  business_hours_end integer default 21,
  away_message text,
  greeting_message text,
  handoff_keywords text[] default array[]::text[],
  last_error text,
  connected_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.whatsapp_contacts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  account_id uuid references public.whatsapp_accounts on delete cascade,
  wa_id text not null,
  name text,
  last_message_at timestamp with time zone,
  last_inbound_at timestamp with time zone,
  unread_count integer default 0,
  is_bot_paused boolean default false,
  tags text[] default array[]::text[],
  notes text,
  created_at timestamp with time zone default timezone('utc', now()),
  unique (user_id, wa_id)
);

create table if not exists public.whatsapp_messages (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  account_id uuid references public.whatsapp_accounts on delete cascade,
  contact_id uuid references public.whatsapp_contacts on delete cascade,
  automation_id uuid,
  wa_message_id text,
  direction text not null, -- 'inbound' | 'outbound'
  msg_type text default 'text',
  body text,
  media_url text,
  status text default 'sent', -- 'sent' | 'delivered' | 'read' | 'failed' | 'received'
  error_message text,
  ai_generated boolean default false,
  response_ms integer,
  kb_used uuid[],
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.whatsapp_knowledge (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  content text not null,
  category text default '',
  keywords text[] default array[]::text[],
  is_active boolean default true,
  hit_count integer default 0,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.whatsapp_automations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  trigger_type text not null, -- keyword | first_message | no_reply | due_payment | low_stock | schedule
  trigger_value text,
  delay_minutes integer default 0,
  action_type text default 'send_message', -- send_message | ai_reply | create_followup
  message_body text,
  is_active boolean default true,
  run_count integer default 0,
  last_run_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.whatsapp_followups (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  automation_id uuid references public.whatsapp_automations on delete set null,
  contact_id uuid references public.whatsapp_contacts on delete cascade,
  reason text,
  message_body text not null,
  due_at timestamp with time zone not null,
  status text default 'pending', -- pending | sent | failed | canceled
  sent_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc', now())
);

create table if not exists public.whatsapp_broadcasts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  message_body text not null,
  template text,
  recipients jsonb default '[]'::jsonb,
  status text default 'draft', -- draft | sending | sent | failed
  created_at timestamp with time zone default timezone('utc', now())
);

-- ════════════════════════════════════════════════════════════════
-- RLS — every table above follows the same rule used throughout
-- 001–008: a user can only touch rows where user_id = auth.uid().
-- Child tables without their own user_id (invoice_items) are scoped
-- through their parent.
-- ════════════════════════════════════════════════════════════════

do $$
declare
  t text;
  owned_tables text[] := array[
    'dokan_customers','dokan_sales','dokan_suppliers','dokan_profiles',
    'hotel_customers','hotel_menu','hotel_orders','hotel_stock','hotel_profiles',
    'mishti_customers','mishti_items','mishti_sales','mishti_production','mishti_profiles',
    'kapor_products','kapor_customers','kapor_sales','kapor_suppliers','kapor_profiles',
    'agent_records','agent_settings','user_agent_activations','agent_notes','custom_categories',
    'library_chat_messages',
    'catalog_products','catalog_settings',
    'invoices',
    'vendors','vendor_payments',
    'whatsapp_accounts','whatsapp_contacts','whatsapp_messages','whatsapp_knowledge',
    'whatsapp_automations','whatsapp_followups','whatsapp_broadcasts',
    'invoice_counters'
  ];
begin
  foreach t in array owned_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'drop policy if exists "Users manage own %s" on public.%I', t, t
    );
    execute format(
      'create policy "Users manage own %s" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t, t
    );
  end loop;
end $$;

-- invoice_items has no user_id of its own — scope through the parent invoice.
alter table public.invoice_items enable row level security;
drop policy if exists "Users manage own invoice_items" on public.invoice_items;
create policy "Users manage own invoice_items" on public.invoice_items
  for all
  using (exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid()))
  with check (exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid()));

-- catalog_products has a public storefront read path (src/app/catalog/[userId])
-- that must work for anonymous visitors — add a public-read policy alongside
-- the owner-write policy already created in the loop above.
drop policy if exists "Public can view active catalog products" on public.catalog_products;
create policy "Public can view active catalog products" on public.catalog_products
  for select using (is_active = true);

drop policy if exists "Public can view published catalog settings" on public.catalog_settings;
create policy "Public can view published catalog settings" on public.catalog_settings
  for select using (is_published = true);

-- ════════════════════════════════════════════════════════════════
-- Updated_at triggers for the *_profiles tables + invoices
-- ════════════════════════════════════════════════════════════════

drop trigger if exists trg_dokan_profiles_updated_at on public.dokan_profiles;
create trigger trg_dokan_profiles_updated_at before update on public.dokan_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_hotel_profiles_updated_at on public.hotel_profiles;
create trigger trg_hotel_profiles_updated_at before update on public.hotel_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_mishti_profiles_updated_at on public.mishti_profiles;
create trigger trg_mishti_profiles_updated_at before update on public.mishti_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_kapor_profiles_updated_at on public.kapor_profiles;
create trigger trg_kapor_profiles_updated_at before update on public.kapor_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════════
-- Indexes
-- ════════════════════════════════════════════════════════════════

create index if not exists idx_dokan_sales_user_date      on public.dokan_sales(user_id, sale_date);
create index if not exists idx_dokan_customers_user        on public.dokan_customers(user_id);
create index if not exists idx_dokan_suppliers_user         on public.dokan_suppliers(user_id);

create index if not exists idx_hotel_orders_user_status     on public.hotel_orders(user_id, status);
create index if not exists idx_hotel_stock_user             on public.hotel_stock(user_id);
create index if not exists idx_hotel_customers_user         on public.hotel_customers(user_id);

create index if not exists idx_mishti_sales_user_date       on public.mishti_sales(user_id, sale_date);
create index if not exists idx_mishti_items_user            on public.mishti_items(user_id);
create index if not exists idx_mishti_customers_user        on public.mishti_customers(user_id);

create index if not exists idx_kapor_sales_user_date        on public.kapor_sales(user_id, sale_date);
create index if not exists idx_kapor_products_user          on public.kapor_products(user_id);
create index if not exists idx_kapor_customers_user         on public.kapor_customers(user_id);

create index if not exists idx_agent_records_agent_user     on public.agent_records(agent_id, user_id);
create index if not exists idx_agent_records_type_date      on public.agent_records(user_id, record_type, recorded_at);

create index if not exists idx_library_chat_user_agent_sess on public.library_chat_messages(user_id, agent_slug, session_id, created_at);

create index if not exists idx_invoices_user_date           on public.invoices(user_id, created_at);
create index if not exists idx_invoice_items_invoice         on public.invoice_items(invoice_id);

create index if not exists idx_whatsapp_contacts_user       on public.whatsapp_contacts(user_id);
create index if not exists idx_whatsapp_messages_contact    on public.whatsapp_messages(contact_id, created_at);
create index if not exists idx_whatsapp_followups_user_due  on public.whatsapp_followups(user_id, status, due_at);

create index if not exists idx_vendors_user                 on public.vendors(user_id);
create index if not exists idx_vendor_payments_vendor       on public.vendor_payments(vendor_id);

-- ════════════════════════════════════════════════════════════════
-- Verify: run after this migration to confirm nothing is still missing.
-- ════════════════════════════════════════════════════════════════
-- select table_name from information_schema.tables
-- where table_schema = 'public'
-- order by table_name;
