alter table public.leads
  add column if not exists segment text default 'raw',
  add column if not exists responded_at timestamptz;
