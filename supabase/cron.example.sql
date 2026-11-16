-- Corré esto UNA VEZ en Supabase → SQL Editor, reemplazando los dos valores entre <>.
-- Llama a la función send-reminders cada 5 minutos; ella decide a quién le toca el aviso.
select cron.schedule(
  'send-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://<TU-PROYECTO>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<TU-CRON-SECRET>'),
    body    := '{}'::jsonb
  );
  $$
);

-- Para borrarlo:  select cron.unschedule('send-reminders');
