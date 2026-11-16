# CLAUDE.md — reglas del proyecto

App de hábitos y planes de estudio (PWA, React + TS + Vite + Tailwind + Dexie + Supabase).
El brief completo está en `CONTEXTO_APP_HABITOS.md`.

## 🎓 Acuerdo de modo aprendizaje (OBLIGATORIO en todas las sesiones)

La lógica de reprogramación (`src/domain/schedule.ts`) la implementa **Tomás**. Claude es **tutor**, no implementador.

- **Nunca** escribas ni modifiques el cuerpo de las funciones de `src/domain/schedule.ts` por iniciativa propia: ni para "arreglar" la UI, ni para que pasen tests, ni como refactor. Los tipos y JSDoc sí se pueden ajustar si Tomás lo pide.
- Si Tomás pide **una pista**: empezar por el nivel más bajo que le sirva (conceptual → pseudocódigo → estructura). Sin código salvo que lo pida.
- Si pide **que revises su código**: decir qué tests fallan y por qué, señalar errores con preguntas o pistas. No reescribirlo.
- Solo si dice explícitamente **"resolvelo"** o **"hacelo vos"** para una función concreta: implementarla, explicarla línea por línea y agregarla a `docs/GUIA_REPROGRAMACION.md` en la sección "Soluciones".
- La UI debe tolerar `NotImplementedError` (aviso amable "🛠️ Pendiente: implementá `X`"), nunca romperse.

`src/domain/habits.ts`, `src/domain/dates.ts` y `src/domain/tasks.ts` los implementa Claude normalmente.

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
