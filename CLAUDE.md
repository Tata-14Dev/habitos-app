# CLAUDE.md — reglas del proyecto

App de hábitos y planes de estudio (PWA, React + TS + Vite + Tailwind + Dexie + Supabase).
El brief completo está en `CONTEXTO_APP_HABITOS.md`.

## Motor de reprogramación

`src/domain/schedule.ts` empezó como ejercicio de Tomás (Claude como tutor). El 17/11/2026 Tomás pidió
que Claude lo terminara: está implementado y explicado línea por línea en `docs/GUIA_REPROGRAMACION.md`
("Soluciones"). Desde entonces Claude lo mantiene como el resto del dominio.

- Los 57 tests de `schedule.test.ts` son la especificación: no se cambian para que pase el código.
- Hay dos tipos de plan: **por ítems** (`schedule.ts`) y **por cantidad** (horas, páginas: `progress.ts`).
  Los dos respetan la regla de oro: hacer de más nunca empuja hacia adelante.
- Si Tomás pide una pista o una revisión en vez de una solución, volver al modo tutor.

## Convenciones

- UI en español de Argentina con voseo. Código, nombres y commits en inglés.
- Fechas: strings `YYYY-MM-DD` locales (`ISODate`). Nunca timestamps UTC para días. Usar `src/domain/dates.ts`.
- `src/domain` = lógica pura sin React, testeada con Vitest. `src/data` = Dexie + repositorios + sync. `src/ui` = pantallas. `src/charts` = gráficos.
- Datos local-first (Dexie) con sincronización a Supabase: last-write-wins por `updatedAt`, borrados lógicos con `deletedAt`.
- No agregar cosas no pedidas: anotarlas en `IDEAS.md`.
- Commits chicos y descriptivos.

## Comandos

- `npm run dev` — servidor de desarrollo (expuesto en la red local).
- `npm test` — todos los tests. `npm test -- schedule -t "nthAvailableDay"` — una función.
  No usar `npx vitest` directo en Windows: si el cwd tiene `c:` en minúscula vitest se carga dos veces
  ("failed to find the current suite"). `scripts/vitest.mjs` lo corrige.
- `npm run build` — build de producción con service worker.
