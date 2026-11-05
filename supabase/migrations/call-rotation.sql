-- ─────────────────────────────────────────────────────────────
-- Call rotation (Twilio dialer) for the Prospecting "Call" step.
-- Ported from RidgeTheoryllc/Call_Number_Rotation. Run in the Supabase SQL editor.
-- All reads/writes go through server API routes using the service role key.
-- ─────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- Caller ID numbers (DIDs) each rep rotates through.
create table if not exists did_pool (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  did text not null,
  area_code text not null,
  status text not null default 'active' check (status in ('active', 'cooldown', 'retired')),
  calls_today integer not null default 0,
  total_calls integer not null default 0,
  answer_rate numeric(5,2) not null default 0,
  spam_score numeric(5,2) not null default 0,
  last_used timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, did)
);

create index if not exists did_pool_user_id_idx on did_pool (user_id);

-- One row per completed outbound call.
create table if not exists call_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  sequence_task_id uuid references sequence_tasks(id) on delete set null,
  phone text not null,
  did text not null,
  direction text not null default 'outbound' check (direction in ('inbound', 'outbound')),
  result text not null check (result in ('answered', 'no_answer', 'busy', 'failed', 'spam_flagged')),
  duration integer,
  call_notes text,
  conference_name text,
  twilio_recording_sid text,
  recording_url text,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists call_logs_user_timestamp_idx on call_logs (user_id, timestamp desc);
create index if not exists call_logs_lead_id_idx on call_logs (lead_id);
create index if not exists call_logs_sequence_task_id_idx on call_logs (sequence_task_id);
create index if not exists call_logs_conference_name_idx on call_logs (conference_name) where conference_name is not null;

-- Maps a live Twilio conference to the rep (needed for the IVR keypad).
create table if not exists call_conference_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conference_name text not null unique,
  direction text not null check (direction in ('inbound', 'outbound')),
  lead_phone text not null,
  caller_id text not null,
  agent_identity text,
  lead_id uuid references leads(id) on delete set null,
  agent_call_sid text,
  lead_call_sid text,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists call_conference_sessions_user_active_idx
  on call_conference_sessions (user_id, status, created_at desc);

-- Recording metadata can arrive before the call_logs row exists.
create table if not exists pending_call_recordings (
  conference_name text primary key,
  twilio_recording_sid text not null,
  recording_url text not null,
  recording_duration integer,
  created_at timestamptz not null default now()
);

-- Service role bypasses RLS; reps may read their own rows directly.
alter table did_pool enable row level security;
alter table call_logs enable row level security;
alter table call_conference_sessions enable row level security;
alter table pending_call_recordings enable row level security;

drop policy if exists "Own DIDs" on did_pool;
create policy "Own DIDs" on did_pool for select to authenticated using (user_id = auth.uid());

drop policy if exists "Own call logs" on call_logs;
create policy "Own call logs" on call_logs for select to authenticated using (user_id = auth.uid());
