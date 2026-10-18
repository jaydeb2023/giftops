-- Kaaj AI Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  language text default 'bn',
  created_at timestamp with time zone default timezone('utc', now())
);

-- Agents table
create table if not exists public.agents (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  name_bn text,
  description text not null,
  description_bn text,
  category text not null default 'business',
  tools text[] default array['memory', 'calculations'],
  system_prompt text not null,
  icon text default '⚡',
  color text default '#EEF2FF',
  is_public boolean default false,
  is_featured boolean default false,
  use_count integer default 0,
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

-- Conversations table
create table if not exists public.conversations (
  id uuid default uuid_generate_v4() primary key,
  agent_id uuid references public.agents on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  messages jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.conversations enable row level security;

-- Profiles policies
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Agents policies
create policy "Anyone can view public agents" on public.agents for select using (is_public = true or auth.uid() = user_id);
create policy "Users can create agents" on public.agents for insert with check (auth.uid() = user_id);
create policy "Users can update own agents" on public.agents for update using (auth.uid() = user_id);
create policy "Users can delete own agents" on public.agents for delete using (auth.uid() = user_id);

-- Conversations policies
create policy "Users can view own conversations" on public.conversations for select using (auth.uid() = user_id);
create policy "Users can create conversations" on public.conversations for insert with check (auth.uid() = user_id);
create policy "Users can update own conversations" on public.conversations for update using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Increment use_count function
create or replace function public.increment_agent_use_count(agent_id uuid)
returns void as $$
begin
  update public.agents set use_count = use_count + 1 where id = agent_id;
end;
$$ language plpgsql security definer;

-- Seed prebuilt agents (run after creating a user)
-- INSERT INTO public.agents (user_id, name, name_bn, description, description_bn, category, tools, system_prompt, icon, color, is_public, is_featured, use_count)
-- VALUES (...);

-- Indexes
create index if not exists idx_agents_user_id on public.agents(user_id);
create index if not exists idx_agents_category on public.agents(category);
create index if not exists idx_agents_is_public on public.agents(is_public);
create index if not exists idx_conversations_agent_id on public.conversations(agent_id);
create index if not exists idx_conversations_user_id on public.conversations(user_id);
