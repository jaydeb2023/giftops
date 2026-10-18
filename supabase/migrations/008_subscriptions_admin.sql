-- Kaaj AI — Subscriptions + Admin
-- Run this in Supabase SQL Editor after 001-007

-- 1. Admin flag on profiles
alter table public.profiles add column if not exists is_admin boolean default false;

-- 2. Subscriptions table (one row per user)
create table if not exists public.subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  status text not null default 'trialing', -- trialing | active | locked | canceled
  trial_ends_at timestamp with time zone not null,
  current_period_end timestamp with time zone,
  plan text not null default 'monthly',
  amount integer not null default 19900, -- paise (₹199.00)
  razorpay_payment_id text,
  razorpay_payment_link_id text,
  last_payment_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

alter table public.subscriptions enable row level security;

-- Users can see their own subscription row
create policy "Users can view own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Only the server (service role) writes subscriptions — no client insert/update
-- policy needed, since the trigger + webhook use the service role, which bypasses RLS.

-- Admins can view every subscription
create policy "Admins can view all subscriptions" on public.subscriptions
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- Admins can view every profile (in addition to the existing "own profile" policy)
create policy "Admins can view all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true)
  );

-- 3. Extend handle_new_user() to also create a trial subscription row
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');

  insert into public.subscriptions (user_id, status, trial_ends_at)
  values (new.id, 'trialing', now() + interval '7 days');

  return new;
end;
$$ language plpgsql security definer;

-- 4. Helper: does this user currently have access (trial or paid)?
create or replace function public.has_active_access(uid uuid)
returns boolean as $$
declare
  sub record;
begin
  select * into sub from public.subscriptions where user_id = uid;
  if sub is null then
    return false;
  end if;

  if sub.status = 'trialing' and sub.trial_ends_at > now() then
    return true;
  end if;

  if sub.status = 'active' and sub.current_period_end is not null and sub.current_period_end > now() then
    return true;
  end if;

  return false;
end;
$$ language plpgsql security definer;

create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);

-- 5. One-time: backfill subscription rows for any existing users who signed up
--    before this migration ran (7-day trial starting now)
insert into public.subscriptions (user_id, status, trial_ends_at)
select id, 'trialing', now() + interval '7 days'
from auth.users u
where not exists (select 1 from public.subscriptions s where s.user_id = u.id);

-- 6. Make yourself super admin — run this manually after finding your user id:
-- update public.profiles set is_admin = true where email = 'YOUR_ADMIN_EMAIL';
