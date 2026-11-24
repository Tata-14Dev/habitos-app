-- Weekly summary bookkeeping: last Sunday (local date) the summary was sent.
-- last_sent_date becomes nullable: a user may get the weekly summary before any morning reminder.
alter table public.reminder_log add column if not exists last_weekly_date date;
alter table public.reminder_log alter column last_sent_date drop not null;
