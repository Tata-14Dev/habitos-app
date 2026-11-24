-- Row Level Security checks against a real database. Everything runs inside one transaction
-- that ends in ROLLBACK: the two throwaway users and their rows never persist.
-- Run: npm run test:rls   (needs `npx supabase login` + `npx supabase link`)
-- Any failed check raises an exception; success prints "RLS OK".
begin;

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-4000-8000-00000000000a', 'rls-a@test.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'rls-b@test.invalid', 'authenticated', 'authenticated');

-- ── As user A: write a row through the same RPC the app uses ──
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select public.push_records('[{"collection":"habits","id":"rls-h1","data":{"id":"rls-h1","name":"A"},"updated_at":"2026-01-01T00:00:00Z"}]');
do $$ begin
  if (select count(*) from public.records where id = 'rls-h1') <> 1 then raise exception 'FAIL: A cannot see its own row'; end if;
end $$;

-- ── As user B ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.records where id = 'rls-h1') <> 0 then raise exception 'FAIL: B can read A''s rows'; end if;
end $$;

-- B tries to update and delete A's row directly: RLS filters it out (0 rows affected).
update public.records set data = '{"hacked":true}' where id = 'rls-h1';
delete from public.records where id = 'rls-h1';

-- B tries to insert a row owned by A: rejected by the policy's WITH CHECK.
do $$ begin
  begin
    insert into public.records (user_id, collection, id, data, updated_at)
    values ('00000000-0000-4000-8000-00000000000a', 'habits', 'rls-h2', '{}', now());
    raise exception 'FAIL: B inserted a row as A';
  exception when insufficient_privilege or check_violation then null;
  end;
end $$;

-- B pushes a newer version of the same id: it lands in B's own space, A's row is untouched.
select public.push_records('[{"collection":"habits","id":"rls-h1","data":{"hacked":true},"updated_at":"2030-01-01T00:00:00Z"}]');

-- ── Back as A: the row is intact ──
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.records where id = 'rls-h1') <> 1 then raise exception 'FAIL: A''s row was deleted by B'; end if;
  if (select data ->> 'hacked' from public.records where id = 'rls-h1') is not null then raise exception 'FAIL: A''s row was modified by B'; end if;
end $$;

-- Server-only bookkeeping is invisible to clients.
do $$ begin
  begin
    if (select count(*) from public.reminder_log) <> 0 then raise exception 'FAIL: clients can read reminder_log'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;

-- ── Anonymous visitor (publishable key, no session) ──
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  begin
    if (select count(*) from public.records) <> 0 then raise exception 'FAIL: anon can read records'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.push_records('[]');
    raise exception 'FAIL: anon can call push_records';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm not like '%not authenticated%' then raise; end if;
  end;
end $$;

reset role;
select 'RLS OK' as result;
rollback;
