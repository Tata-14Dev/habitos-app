-- Morning reminder bookkeeping: one row per user with the last local date a reminder was sent.
-- Only the Edge Function (service role) touches it; RLS on with no policies = no client access.
create table if not exists public.reminder_log (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  last_sent_date date not null
);
alter table public.reminder_log enable row level security;

-- Needed by the cron job that calls the Edge Function.
create extension if not exists pg_cron;
create extension if not exists pg_net;
