-- Sahayak AI — Reports Schema
-- Run this in your Supabase SQL editor AFTER 001_initial_schema.sql

-- ── Daily Sales ──────────────────────────────────────────────
create table if not exists public.daily_sales (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  agent_id uuid references public.agents on delete set null,
  sale_date date not null default current_date,
  item_name text not null,
  quantity numeric(10,2) default 1,
  unit_price numeric(10,2) not null,
  total_amount numeric(10,2) generated always as (quantity * unit_price) stored,
  notes text,
  source text default 'manual', -- 'manual' | 'chat'
  created_at timestamp with time zone default timezone('utc', now())
);

-- ── Expenses ─────────────────────────────────────────────────
create table if not exists public.expenses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  agent_id uuid references public.agents on delete set null,
  expense_date date not null default current_date,
  category text not null default 'general', -- 'stock','rent','salary','utility','misc'
  description text not null,
  amount numeric(10,2) not null,
  source text default 'manual',
  created_at timestamp with time zone default timezone('utc', now())
);

-- ── Credit / Baki ────────────────────────────────────────────
create table if not exists public.credit_entries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  agent_id uuid references public.agents on delete set null,
  customer_name text not null,
  amount numeric(10,2) not null,
  paid_amount numeric(10,2) default 0,
  due_date date,
  status text default 'pending', -- 'pending' | 'partial' | 'paid'
  notes text,
  source text default 'manual',
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

-- ── Stock ────────────────────────────────────────────────────
create table if not exists public.stock_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  agent_id uuid references public.agents on delete set null,
  item_name text not null,
  current_qty numeric(10,2) not null default 0,
  unit text default 'pcs', -- 'kg','pcs','litre','box'
  min_qty numeric(10,2) default 0,
  unit_cost numeric(10,2) default 0,
  last_updated timestamp with time zone default timezone('utc', now())
);

-- ── RLS policies ─────────────────────────────────────────────
alter table public.daily_sales enable row level security;
alter table public.expenses enable row level security;
alter table public.credit_entries enable row level security;
alter table public.stock_items enable row level security;

create policy "Users manage own sales"   on public.daily_sales    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own expenses" on public.expenses       for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own credit"  on public.credit_entries  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own stock"   on public.stock_items     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists idx_sales_user_date    on public.daily_sales(user_id, sale_date);
create index if not exists idx_expenses_user_date on public.expenses(user_id, expense_date);
create index if not exists idx_credit_user_status on public.credit_entries(user_id, status);
create index if not exists idx_stock_user         on public.stock_items(user_id);
