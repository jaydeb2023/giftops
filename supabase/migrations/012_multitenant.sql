-- GiftOps multi-company (multi-tenant) upgrade. Run once, after 010 and 011.
-- Every existing row is moved into one company, "Evynta" (your own workspace). New client companies
-- are created from the Platform console or by self-signup.

create table if not exists public.rv_orgs (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  slug               text not null unique,
  status             text not null default 'trial' check (status in ('trial','active','suspended')),
  plan               text,
  trial_ends_at      timestamptz,
  owner_email        text,
  contact_mobile     text,
  notes              text,
  lead_api_key       text unique,
  wa_phone_number_id text,
  meta_page_id       text,
  meta_ig_id         text,
  integrations       jsonb not null default '{}'::jsonb,   -- secrets (tokens) - server only
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists rv_orgs_wa_uidx   on public.rv_orgs(wa_phone_number_id) where wa_phone_number_id is not null;
create unique index if not exists rv_orgs_page_uidx on public.rv_orgs(meta_page_id)       where meta_page_id is not null;
create unique index if not exists rv_orgs_ig_uidx   on public.rv_orgs(meta_ig_id)         where meta_ig_id is not null;
drop trigger if exists rv_orgs_touch on public.rv_orgs;
create trigger rv_orgs_touch before update on public.rv_orgs for each row execute function public.rv_touch();
alter table public.rv_orgs enable row level security;

-- your own workspace; everything that exists today moves here
insert into public.rv_orgs (name, slug, status, owner_email, lead_api_key)
select 'Evynta', 'evynta', 'active',
       (select email from public.rv_staff order by created_at limit 1),
       replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')
where not exists (select 1 from public.rv_orgs);

-- add org_id to every business table and backfill
do $$
declare t text; d uuid;
begin
  select id into d from public.rv_orgs order by created_at limit 1;
  foreach t in array array['rv_staff','rv_settings','rv_customers','rv_contacts','rv_leads','rv_vendors','rv_orders',
    'rv_order_items','rv_delivery_runs','rv_recipients','rv_purchases','rv_invoices','rv_invoice_lines','rv_payments',
    'rv_bills','rv_bill_payments','rv_expenses','rv_communications','rv_tasks','rv_audit','rv_counters']
  loop
    execute format('alter table public.%I add column if not exists org_id uuid references public.rv_orgs(id) on delete cascade', t);
    execute format('update public.%I set org_id = %L where org_id is null', t, d);
    if t <> 'rv_audit' then execute format('alter table public.%I alter column org_id set not null', t); end if;
    execute format('create index if not exists %I on public.%I(org_id)', t || '_org_idx', t);
  end loop;
end $$;

-- numbers are unique per company, not globally
do $$
declare r record;
begin
  for r in select * from (values
    ('rv_customers','customer_no'),('rv_leads','lead_no'),('rv_orders','order_no'),('rv_delivery_runs','run_no'),
    ('rv_recipients','delivery_no'),('rv_purchases','purchase_no'),('rv_invoices','invoice_no')) as x(tbl, col)
  loop
    execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.tbl || '_' || r.col || '_key');
    execute format('create unique index if not exists %I on public.%I(org_id, %I)', r.tbl || '_org_' || r.col || '_uidx', r.tbl, r.col);
  end loop;
end $$;

-- settings and counters are per company
alter table public.rv_settings drop constraint if exists rv_settings_pkey;
alter table public.rv_settings add primary key (org_id, key);
alter table public.rv_counters drop constraint if exists rv_counters_pkey;
alter table public.rv_counters add primary key (org_id, name);

drop function if exists public.rv_next_number(text);
create or replace function public.rv_next_number(p_org uuid, p_name text) returns bigint as $$
declare v bigint;
begin
  insert into public.rv_counters(org_id, name, value) values (p_org, p_name, 1)
  on conflict (org_id, name) do update set value = public.rv_counters.value + 1
  returning value into v;
  return v;
end;
$$ language plpgsql;

-- one login belongs to one company
create unique index if not exists rv_staff_email_uidx on public.rv_staff (lower(email));
