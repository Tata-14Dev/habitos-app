-- Habitos: generic synced record store.
-- Each local Dexie record is stored as one row: (user, collection, id) → data jsonb.
-- Conflict rule: last write wins by the client's updated_at (enforced in push_records).

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  -- Server-side change clock used as the pull cursor (never trust device clocks for that).
  server_ts  timestamptz not null default clock_timestamp(),
  primary key (user_id, collection, id)
);

create index if not exists records_user_server_ts on public.records (user_id, server_ts);

alter table public.records enable row level security;

drop policy if exists "records: own rows" on public.records;
create policy "records: own rows" on public.records
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Upsert a batch; a row only overwrites the stored one if it is newer (LWW).
create or replace function public.push_records(rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.records as r (user_id, collection, id, data, updated_at, deleted_at, server_ts)
  select auth.uid(),
         e->>'collection',
         e->>'id',
         e->'data',
         (e->>'updated_at')::timestamptz,
         nullif(e->>'deleted_at', '')::timestamptz,
         clock_timestamp()
  from jsonb_array_elements(rows) as e
  on conflict (user_id, collection, id) do update
    set data       = excluded.data,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        server_ts  = clock_timestamp()
    where excluded.updated_at > r.updated_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.push_records(jsonb) to authenticated;
