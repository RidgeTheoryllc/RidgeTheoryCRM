-- Email engagement tracking (run manually in Supabase SQL editor)

alter table public.sequence_tasks
  add column if not exists delivered_at   timestamptz,
  add column if not exists opened_at      timestamptz,
  add column if not exists open_count     integer default 0,
  add column if not exists clicked_at     timestamptz,
  add column if not exists click_count    integer default 0,
  add column if not exists bounced_at     timestamptz,
  add column if not exists bounce_reason  text;

alter table public.leads
  add column if not exists last_email_opened_at  timestamptz,
  add column if not exists total_email_opens     integer default 0,
  add column if not exists last_email_clicked_at timestamptz,
  add column if not exists total_email_clicks    integer default 0,
  add column if not exists email_engagement      text default 'none'
    check (email_engagement in ('none', 'sent', 'delivered', 'opened', 'clicked', 'bounced'));

create index if not exists leads_email_engagement_idx on public.leads(email_engagement);
create index if not exists leads_last_opened_idx on public.leads(last_email_opened_at desc nulls last);
create index if not exists sequence_tasks_resend_email_id_idx on public.sequence_tasks(resend_email_id);

create table if not exists public.email_events (
  id                 uuid primary key default uuid_generate_v4(),
  resend_message_id  text not null,
  event_type         text not null,
  sequence_task_id   uuid references public.sequence_tasks(id) on delete set null,
  lead_id            uuid references public.leads(id) on delete set null,
  raw_payload        jsonb,
  created_at         timestamptz default now()
);

create index if not exists email_events_resend_message_id_idx on public.email_events(resend_message_id);
create index if not exists email_events_lead_id_idx on public.email_events(lead_id);

alter publication supabase_realtime add table public.leads;
alter publication supabase_realtime add table public.sequence_tasks;
