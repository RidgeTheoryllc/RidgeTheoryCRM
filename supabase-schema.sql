-- ─────────────────────────────────────────────────────────────
-- CRM Database Schema for Supabase
-- Run this in your Supabase SQL editor to set up all tables
-- ─────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- Auth roles and user profiles
-- ─────────────────────────────────────────────────────────────

do $$ begin
  create type app_role as enum ('admin', 'manager', 'sales');
exception
  when duplicate_object then null;
end $$;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text default '',
  role app_role not null default 'sales',
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case
      when not exists (select 1 from public.profiles) then 'admin'::app_role
      else 'sales'::app_role
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_user_role()
returns app_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Companies
create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null,
  industry text default 'Other',
  website text default '',
  size text default '11-50',
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- Contacts
create table if not exists contacts (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null,
  title text default '',
  email text default '',
  phone text default '',
  linked_in text default '',
  lead_source text default 'Other',
  status text default 'Lead',
  tags text[] default '{}',
  company_id uuid references companies(id) on delete set null,
  created_at timestamptz default now()
);

-- Leads / Ingestion
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null,
  title text default '',
  email text default '',
  phone text default '',
  company_name text default '',
  website text default '',
  source text default 'Other',
  ingestion_source text default 'manual',
  status text default 'Generated',
  notes text default '',
  tags text[] default '{}',
  interest_score integer default 0,
  decision_maker_score integer default 0,
  fit_score integer default 0,
  overall_score integer default 0,
  rank_tier text default 'low',
  signal text default '',
  pain_theme text default '',
  company_id uuid references companies(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  created_at timestamptz default now()
);

-- Prospecting sequences
create table if not exists prospecting_sequences (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users(id) on delete set null default auth.uid(),
  lead_id uuid references leads(id) on delete cascade,
  tier text default 'low',
  status text default 'active',
  start_date date default current_date,
  created_at timestamptz default now()
);

create table if not exists sequence_tasks (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users(id) on delete set null default auth.uid(),
  sequence_id uuid references prospecting_sequences(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  day_number integer not null,
  channel text not null,
  title text not null,
  purpose text default '',
  due_date date not null,
  trigger_type text default 'manual',
  status text default 'pending',
  generated_subject text default '',
  generated_body text default '',
  generated_script text default '',
  resend_email_id text default '',
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- Deals
create table if not exists deals (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users(id) on delete set null default auth.uid(),
  title text not null,
  value numeric default 0,
  stage text default 'Lead',
  probability integer default 10,
  close_date date,
  notes text default '',
  company_id uuid references companies(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  created_at timestamptz default now()
);

-- Activities
create table if not exists activities (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users(id) on delete set null default auth.uid(),
  type text not null,
  body text default '',
  timestamp timestamptz default now(),
  deal_id uuid references deals(id) on delete cascade
);

-- Tasks
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users(id) on delete set null default auth.uid(),
  title text not null,
  due_date date,
  priority text default 'medium',
  status text default 'open',
  deal_id uuid references deals(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null
);

alter table companies add column if not exists owner_id uuid references auth.users(id) on delete set null default auth.uid();
alter table leads add column if not exists owner_id uuid references auth.users(id) on delete set null default auth.uid();
alter table leads add column if not exists interest_score integer default 0;
alter table leads add column if not exists decision_maker_score integer default 0;
alter table leads add column if not exists fit_score integer default 0;
alter table leads add column if not exists overall_score integer default 0;
alter table leads add column if not exists rank_tier text default 'low';
alter table leads add column if not exists signal text default '';
alter table leads add column if not exists pain_theme text default '';
alter table contacts add column if not exists owner_id uuid references auth.users(id) on delete set null default auth.uid();
alter table deals add column if not exists owner_id uuid references auth.users(id) on delete set null default auth.uid();
alter table activities add column if not exists owner_id uuid references auth.users(id) on delete set null default auth.uid();
alter table tasks add column if not exists owner_id uuid references auth.users(id) on delete set null default auth.uid();
alter table prospecting_sequences add column if not exists owner_id uuid references auth.users(id) on delete set null default auth.uid();
alter table sequence_tasks add column if not exists owner_id uuid references auth.users(id) on delete set null default auth.uid();

-- ─────────────────────────────────────────────────────────────
-- Row Level Security (RLS)
-- TODO: Customize policies for your auth setup
-- ─────────────────────────────────────────────────────────────

alter table companies enable row level security;
alter table leads enable row level security;
alter table contacts enable row level security;
alter table deals enable row level security;
alter table activities enable row level security;
alter table tasks enable row level security;
alter table profiles enable row level security;
alter table prospecting_sequences enable row level security;
alter table sequence_tasks enable row level security;

drop policy if exists "Allow all for authenticated" on companies;
drop policy if exists "Allow all for authenticated" on leads;
drop policy if exists "Allow all for authenticated" on contacts;
drop policy if exists "Allow all for authenticated" on deals;
drop policy if exists "Allow all for authenticated" on activities;
drop policy if exists "Allow all for authenticated" on tasks;

drop policy if exists "Allow public CRM access" on companies;
drop policy if exists "Allow public CRM access" on leads;
drop policy if exists "Allow public CRM access" on contacts;
drop policy if exists "Allow public CRM access" on deals;
drop policy if exists "Allow public CRM access" on activities;
drop policy if exists "Allow public CRM access" on tasks;
drop policy if exists "Allow public CRM access" on prospecting_sequences;
drop policy if exists "Allow public CRM access" on sequence_tasks;

drop policy if exists "Profiles are readable by owner or admins" on profiles;
drop policy if exists "Profiles are manageable by admins" on profiles;
drop policy if exists "CRM select by role" on companies;
drop policy if exists "CRM insert by role" on companies;
drop policy if exists "CRM update by role" on companies;
drop policy if exists "CRM delete by role" on companies;
drop policy if exists "CRM select by role" on leads;
drop policy if exists "CRM insert by role" on leads;
drop policy if exists "CRM update by role" on leads;
drop policy if exists "CRM delete by role" on leads;
drop policy if exists "CRM select by role" on contacts;
drop policy if exists "CRM insert by role" on contacts;
drop policy if exists "CRM update by role" on contacts;
drop policy if exists "CRM delete by role" on contacts;
drop policy if exists "CRM select by role" on deals;
drop policy if exists "CRM insert by role" on deals;
drop policy if exists "CRM update by role" on deals;
drop policy if exists "CRM delete by role" on deals;
drop policy if exists "CRM select by role" on activities;
drop policy if exists "CRM insert by role" on activities;
drop policy if exists "CRM update by role" on activities;
drop policy if exists "CRM delete by role" on activities;
drop policy if exists "CRM select by role" on tasks;
drop policy if exists "CRM insert by role" on tasks;
drop policy if exists "CRM update by role" on tasks;
drop policy if exists "CRM delete by role" on tasks;
drop policy if exists "CRM select by role" on prospecting_sequences;
drop policy if exists "CRM insert by role" on prospecting_sequences;
drop policy if exists "CRM update by role" on prospecting_sequences;
drop policy if exists "CRM delete by role" on prospecting_sequences;
drop policy if exists "CRM select by role" on sequence_tasks;
drop policy if exists "CRM insert by role" on sequence_tasks;
drop policy if exists "CRM update by role" on sequence_tasks;
drop policy if exists "CRM delete by role" on sequence_tasks;

create policy "Profiles are readable by owner or admins" on profiles
  for select using (id = auth.uid() or public.current_user_role() = 'admin');

create policy "Profiles are manageable by admins" on profiles
  for update using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "CRM select by role" on companies
  for select using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM insert by role" on companies
  for insert with check (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM update by role" on companies
  for update using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid())
  with check (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM delete by role" on companies
  for delete using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());

create policy "CRM select by role" on leads
  for select using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM insert by role" on leads
  for insert with check (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM update by role" on leads
  for update using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid())
  with check (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM delete by role" on leads
  for delete using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());

create policy "CRM select by role" on contacts
  for select using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM insert by role" on contacts
  for insert with check (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM update by role" on contacts
  for update using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid())
  with check (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM delete by role" on contacts
  for delete using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());

create policy "CRM select by role" on deals
  for select using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM insert by role" on deals
  for insert with check (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM update by role" on deals
  for update using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid())
  with check (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM delete by role" on deals
  for delete using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());

create policy "CRM select by role" on activities
  for select using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM insert by role" on activities
  for insert with check (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM update by role" on activities
  for update using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid())
  with check (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM delete by role" on activities
  for delete using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());

create policy "CRM select by role" on tasks
  for select using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM insert by role" on tasks
  for insert with check (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM update by role" on tasks
  for update using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid())
  with check (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM delete by role" on tasks
  for delete using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());

create policy "CRM select by role" on prospecting_sequences
  for select using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM insert by role" on prospecting_sequences
  for insert with check (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM update by role" on prospecting_sequences
  for update using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid())
  with check (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM delete by role" on prospecting_sequences
  for delete using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());

create policy "CRM select by role" on sequence_tasks
  for select using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM insert by role" on sequence_tasks
  for insert with check (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM update by role" on sequence_tasks
  for update using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid())
  with check (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());
create policy "CRM delete by role" on sequence_tasks
  for delete using (public.current_user_role() in ('admin', 'manager') or owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Indexes for common query patterns
-- ─────────────────────────────────────────────────────────────

create index if not exists contacts_company_id_idx on contacts(company_id);
create index if not exists companies_owner_id_idx on companies(owner_id);
create index if not exists leads_owner_id_idx on leads(owner_id);
create index if not exists leads_status_idx on leads(status);
create index if not exists leads_overall_score_idx on leads(overall_score);
create index if not exists leads_rank_tier_idx on leads(rank_tier);
create index if not exists leads_company_id_idx on leads(company_id);
create index if not exists leads_contact_id_idx on leads(contact_id);
create index if not exists contacts_owner_id_idx on contacts(owner_id);
create index if not exists deals_owner_id_idx on deals(owner_id);
create index if not exists activities_owner_id_idx on activities(owner_id);
create index if not exists tasks_owner_id_idx on tasks(owner_id);
create index if not exists deals_company_id_idx on deals(company_id);
create index if not exists deals_contact_id_idx on deals(contact_id);
create index if not exists deals_stage_idx on deals(stage);
create index if not exists activities_deal_id_idx on activities(deal_id);
create index if not exists tasks_deal_id_idx on tasks(deal_id);
create index if not exists tasks_contact_id_idx on tasks(contact_id);
create index if not exists tasks_status_idx on tasks(status);
create index if not exists prospecting_sequences_lead_id_idx on prospecting_sequences(lead_id);
create index if not exists prospecting_sequences_owner_id_idx on prospecting_sequences(owner_id);
create index if not exists sequence_tasks_sequence_id_idx on sequence_tasks(sequence_id);
create index if not exists sequence_tasks_lead_id_idx on sequence_tasks(lead_id);
create index if not exists sequence_tasks_due_date_idx on sequence_tasks(due_date);
create index if not exists sequence_tasks_status_idx on sequence_tasks(status);
