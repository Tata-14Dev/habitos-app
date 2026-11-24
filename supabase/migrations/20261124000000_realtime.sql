-- Realtime: stream changes of `records` so other devices pull right away (instead of waiting
-- for the next poll). RLS still applies: each user only receives their own rows.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'records'
  ) then
    alter publication supabase_realtime add table public.records;
  end if;
end $$;
