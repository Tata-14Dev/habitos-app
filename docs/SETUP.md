# Guía de instalación y deploy

PWA para el teléfono y la computadora con:
- hábitos (vigencia, porcentajes, rachas, ánimo y motivación);
- tareas del día dictadas por voz;
- planes de estudio que se reprograman en tiempo real.

Funciona offline, sincroniza con Supabase y manda un recordatorio a la mañana.

## Planes y reprogramación

Hay dos tipos de plan. Lo elegís al crearlo, en **Planes → + Nuevo**:
- **📋 Por ítems:** una lista (rooms, lecciones, capítulos). Marcás cada ítem cuando lo terminás.
- **⏱️ Por cantidad:** un total (horas, páginas, ejercicios). Registrás cuánto hiciste cada día con los botones rápidos (+2 horas, +1 hora…) o con una cantidad a mano.

En los dos casos, la fecha de fin, el margen y el ritmo necesario se recalculan con cada avance. Hacer de más adelanta el fin y nunca corre hacia adelante lo que te toca mañana.

- La lógica está en [`src/domain/schedule.ts`](../src/domain/schedule.ts) (planes por ítems) y [`src/domain/progress.ts`](../src/domain/progress.ts) (planes por cantidad).
- La guía [`GUIA_REPROGRAMACION.md`](GUIA_REPROGRAMACION.md) tiene los casos borde y, en "Soluciones", cada función explicada línea por línea.
- Tests: `npm test -- schedule` (57) y `npm test -- progress`.

## Correrla en la compu

```bash
npm install
cp .env.example .env.local   # completá las claves (ver "Sincronización"); sin claves funciona solo en local
npm run dev                  # http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm test` | Tests de dominio y datos (Vitest) |
| `npm run e2e` | Prueba end-to-end (Playwright, simula un iPhone) |
| `npm run build` / `npm run preview` | Build de producción con service worker |
| `npm run vapid` | Genera las claves para las notificaciones push |

**Cargar el ejemplo:** en Planes → "Cargar ejemplo", o en Ajustes → "🧪 Cargar ejemplo". Crea el plan SOC Level 1 con 34 rooms, días libres, las 8 etapas y el hábito "Estudiar SOC" vinculado.

## Sincronización (Supabase): una sola vez

1. Creá un proyecto en [supabase.com](https://supabase.com) (región São Paulo).
2. **Authentication → Providers → Email:** desactivá **Confirm email**. Así no se manda ningún mail al crear la cuenta.
3. **Project Settings → API:** copiá la URL y la `anon` key en `.env.local` (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).
4. Aplicá las migraciones. Pegá el contenido de `supabase/migrations/*.sql`, en orden, en el **SQL Editor**, o usá el CLI:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
5. En la app: Ajustes → **Crear cuenta** (mail y contraseña). En el otro dispositivo, **Iniciar sesión** con la misma cuenta.

Cómo funciona: todo se guarda primero en el dispositivo (IndexedDB) y se sube cuando hay internet. Si el mismo registro se cambió en dos dispositivos, gana el último cambio.

## Recordatorio de la mañana (push): una sola vez

1. `npm run vapid`. Copiá `VITE_VAPID_PUBLIC_KEY` a `.env.local` (y a Vercel).
2. Cargá los secretos en Supabase. Inventá un `CRON_SECRET` largo cualquiera y usá tu mail en `VAPID_SUBJECT`:
   ```bash
   npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:tu@mail.com CRON_SECRET=...
   npx supabase functions deploy send-reminders --no-verify-jwt
   ```
3. Abrí `supabase/cron.example.sql`, reemplazá `<TU-PROYECTO>` y `<TU-CRON-SECRET>`, y corrélo en el SQL Editor.
4. En el iPhone, con la app **instalada**: Ajustes → "🔔 Activar en este dispositivo".

Para probar sin esperar a la mañana:
```bash
curl -X POST "https://<proyecto>.supabase.co/functions/v1/send-reminders?force=1" -H "x-cron-secret: <TU-CRON-SECRET>"
```

## Publicarla (Vercel) e instalarla en el iPhone

1. Subí el repo a GitHub y en [vercel.com](https://vercel.com) → **Add New Project** → importalo. Vercel detecta Vite solo.
2. En **Settings → Environment Variables**, cargá `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_VAPID_PUBLIC_KEY`, y hacé un redeploy.
3. En el iPhone: abrí la URL en **Safari** → botón **Compartir** → **Agregar a pantalla de inicio**. Abrila siempre desde ese ícono.
4. Iniciá sesión y activá el recordatorio.

> El iPhone necesita HTTPS para instalar la app, para el modo offline y para las notificaciones. Por eso, para usarla en el teléfono, usá la URL de Vercel y no `http://192.168.x.x`. La red local sirve para ver la interfaz (`npm run dev` y abrir la IP que muestra), pero ahí no funcionan ni la instalación ni el push.

## Dictado de tareas

En **Hoy** → "🎤 Dictá tu día", tocá el micrófono del teclado del iPhone y hablá:

> "dentista a las 15 horas, comprar yerba, después llamar a Juan"

La app lo separa en tareas: **15:00 Dentista**, **Comprar yerba** y **Llamar a Juan**. Separa por comas, puntos, "después", "luego" y "también". Entiende horas como "a las 9 y media", "3 de la tarde", "18.30 hs" y "al mediodía". Antes de agregar las tareas te muestra cómo las entendió.

## Estructura

```
src/domain   lógica pura y testeada: fechas, hábitos, tareas, planes y TU schedule.ts
src/data     Dexie, store con outbox, sincronización, repositorio, respaldo, ejemplo y push
src/ui       pantallas y componentes (React + Tailwind)
src/charts   gráficos (Recharts)
src/sw.ts    service worker: modo offline y notificaciones
supabase/    migraciones SQL, la Edge Function send-reminders y el cron
docs/        guía del ejercicio
e2e/         prueba end-to-end
```
