  -- Run on existing Supabase projects to add email cleansing columns.
  alter table public.leads
    add column if not exists email_status text,
    add column if not exists email_valid boolean,
    add column if not exists email_validated_at timestamptz;
