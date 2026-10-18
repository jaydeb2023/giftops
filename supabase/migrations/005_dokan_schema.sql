-- Sahayak AI — Dokan CRM Schema
-- Run in Supabase SQL Editor

create table if not exists public.dokan_products (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  category text default 'অন্যান্য',
  stock numeric(10,2) default 0,
  unit text default 'পিস',
  price numeric(10,2) default 0,
  cost_price numeric(10,2) default 0,
  min_stock numeric(10,2) default 10,
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

alter table public.dokan_products enable row level security;

create policy "Users manage own dokan products"
  on public.dokan_products for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_dokan_products_user on public.dokan_products(user_id);
create index if not exists idx_dokan_products_name on public.dokan_products(name);

-- Customers use crm_customers (business_type='dokan')
-- Sales use crm_purchases (already exists from 003_crm_schema.sql)
