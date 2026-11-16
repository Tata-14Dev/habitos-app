# App de hábitos y planes de estudio: brief para Claude Code

> Este archivo tiene todo el contexto para arrancar. Leelo completo y empezá a construir sin esperar más instrucciones.
> Las decisiones marcadas como **por defecto** ya están tomadas. Solo preguntame lo que figura en "Preguntas abiertas", y no te frenes por eso: seguí con los valores por defecto mientras tanto.

---

## 1. Cómo quiero que trabajes

- **Arrancá directo.** Armá el proyecto, implementá el MVP (sección 9) y dejalo andando localmente.
- **La interfaz va en español de Argentina, con voseo** ("Tildá", "Te sobran 3 días"). El código, los nombres de variables y los commits pueden ir en inglés.
- **🎓 La lógica de reprogramación la programo YO.** Quiero practicar. No implementes el cuerpo de esas funciones: dejame las plantillas, los tests y una guía. Las reglas exactas están en la sección 5b. Es la parte más importante de este brief.
- **Commits chicos y descriptivos.** Al terminar cada fase, contame en pocas líneas qué quedó hecho y cómo probarlo.
- **No agregues cosas que no pedí.** Si se te ocurre algo útil, anotalo en un `IDEAS.md` en vez de implementarlo.

---

## 2. Contexto: de dónde sale esto

Soy Tomás, de Argentina (zona horaria `America/Argentina/Buenos_Aires`). Hoy llevo dos cosas en Google Sheets:

1. **Una planilla de hábitos anual (2027).** Tiene una hoja por mes con una grilla de hábitos × días con casillas, el porcentaje de cumplimiento por día, por mes y por hábito, gráficos de área del progreso diario y del estado de ánimo, y un panel anual con el progreso de cada mes.
2. **Un plan de estudio: el path SOC Level 1 de TryHackMe.** Son 34 rooms que quiero terminar antes del 20/12/2026, a una por día. Después viene la preparación para la certificación SAL1 en enero de 2027.

Las planillas funcionan, pero quiero una **app propia** que use desde el **teléfono y la computadora**. La idea principal es que **se reajuste en tiempo real** según lo que voy haciendo. Si un día hago 3 rooms en vez de 1, la fecha de fin tiene que adelantarse. Si un día no hago nada, tiene que atrasarse y avisarme cuánto margen me queda.

### Lo que aprendí con las planillas (respetalo)

- **El porcentaje se calcula solo sobre hábitos definidos.** Si tengo 1 hábito y lo cumplí todos los días, es 100%. Las filas o lugares vacíos no cuentan nunca. La plantilla original dividía por todas las filas y daba 10%, y eso me molestó mucho.
- **Los hábitos tienen vigencia ("desde" y "hasta").** Si agrego un hábito en noviembre, no puede bajar el porcentaje de enero a octubre. Si dejo un hábito, no lo borro: le pongo fecha de fin y los meses anteriores conservan sus datos.
- **Las fechas son fechas locales sin hora.** Cuidado con los corrimientos por UTC: guardá los días como `YYYY-MM-DD` en hora local, nunca como timestamps UTC.
- **Hacer más de la cuota de un día no puede empujar las tareas siguientes hacia adelante.** Las planillas tuvieron este error: con ritmo 1, hacer 3 en un día mandaba la siguiente 3 días más tarde en vez de dejarla para mañana. Ver el caso C de la sección 6.

---

## 3. Qué tiene que hacer la app

### 3.1 Hábitos

- **Lista de hábitos:** cada uno con nombre, emoji o color opcional, fecha de inicio (desde) y fecha de fin opcional (hasta). Se puede reordenar.
- **Registro diario:** la vista de hoy muestra los hábitos vigentes con un check de un toque. También se pueden marcar días anteriores.
- **Estado de ánimo y motivación diarios:** dos valores de 0 a 10, opcionales. El "estado mental" es su promedio.
- **Vista de mes:** grilla de hábitos × días, como la planilla, con:
  - el porcentaje de cada día: hábitos hechos sobre hábitos vigentes ese día;
  - el porcentaje del mes;
  - el porcentaje de cada hábito, con una barra de progreso;
  - un gráfico de área del progreso diario y otro del estado mental.
- **Vista de año (Panel):** el porcentaje de cada mes, en tarjetas y en un gráfico de área.
- **Rachas:** la racha actual y la mejor racha por hábito. Es lo único extra que acepto en el MVP.

### 3.2 Planes de estudio con reprogramación en tiempo real

Un **plan** es una lista **ordenada** de ítems (rooms, capítulos, clases) que quiero completar a un ritmo dado.

- **Configuración del plan:**
  - nombre;
  - fecha de inicio;
  - fecha límite (deadline);
  - ritmo en ítems por día (puede ser 1, 2, 0,5…);
  - días de la semana de descanso (ninguno, domingo, sábado y domingo, o los que elija);
  - días libres puntuales (por ejemplo 24/12, 25/12 y 31/12).
- **Ítems:** nombre, módulo o sección opcional, notas y estado (pendiente o hecho), con la fecha real en que lo hice.
  - Se cargan de a uno o **pegando una lista** (un ítem por línea, y opcionalmente "Módulo: ítem").
  - Se pueden reordenar arrastrándolos, y la proyección se recalcula al instante.
- **Al marcar un ítem como hecho** se guarda la fecha de hoy, editable por si lo hice otro día. Puedo marcar varios en el mismo día.
- **Dos calendarios por ítem:**
  - **Plan original (baseline):** se calcula al crear el plan y queda fijo. Hay un botón "Replanificar desde hoy" que lo regenera si lo pido explícitamente.
  - **Proyección:** se recalcula en cada cambio y reparte los pendientes desde hoy (sección 5).
- **Panel del plan:**
  - progreso: hechos sobre total, con una barra;
  - cuántos ítems debería llevar hoy según el plan original contra cuántos llevo;
  - situación: "✅ Al día (+2)" o "⚠️ Atrasado 3";
  - **fecha de fin estimada** y **margen** contra la fecha límite: "✅ Te sobran 4 días" o "⚠️ Te pasás 2 días";
  - **ritmo necesario** para llegar a la fecha límite: los pendientes divididos por los días disponibles que quedan;
  - lo que toca hoy: los ítems que la proyección asigna a hoy;
  - un gráfico burn-up con el plan original acumulado (línea gris punteada), lo real acumulado hasta hoy (verde) y la proyección acumulada (verde claro).
- **Etapas o hitos del plan:** una lista simple con nombre, desde, hasta, descripción y check. Sirve para cosas como "Preparación SAL1" o "Examen".
- **Integración con hábitos:** un plan puede generar un hábito automático, como "Estudiar SOC". Ese día cuenta como cumplido si marqué al menos un ítem del plan. **Por defecto: sí, opcional por plan.**

---

## 4. Plataforma y stack (por defecto)

Quiero usarla en el teléfono y en la computadora con una sola base de código. **Hacé una PWA** (Progressive Web App): se instala en Android, en iOS y en el escritorio, funciona offline y no necesita tiendas.

- **Frontend:** React + TypeScript + Vite.
- **PWA:** `vite-plugin-pwa`, con manifest, service worker, ícono y funcionamiento offline completo.
- **Estilos:** Tailwind CSS, mobile-first. Tiene que poder usarse con una mano en el teléfono, con botones grandes.
- **Datos (MVP):** local-first con IndexedDB, usando Dexie.js. Todo funciona sin cuenta ni internet.
- **Exportar e importar:** respaldo en JSON. Además, exportar a CSV la grilla de hábitos y los ítems de un plan.
- **Fechas:** `date-fns`, con todos los días como strings `YYYY-MM-DD` locales. "Hoy" sale de la hora local del dispositivo.
- **Gráficos:** Recharts.
- **Tests:** Vitest para la lógica de dominio y Playwright para un flujo end-to-end básico (opcional en el MVP).
- **Deploy (fase 2):** Vercel o Netlify. Se puede usar en local con `npm run dev` y en el teléfono por la red local.
- **Sincronización entre dispositivos (fase 2):** Supabase (auth con email o Google, más Postgres). Diseñá la capa de datos detrás de una interfaz (repository) para poder enchufar la sincronización sin reescribir la interfaz. Para conflictos alcanza con "gana el último cambio" por registro, con `updatedAt`.

**Estructura sugerida:** `src/domain` (lógica pura, sin React, 100% testeada), `src/data` (Dexie y repositorios), `src/ui` (componentes y pantallas) y `src/charts`.

---

## 5. Lógica de reprogramación (especificación exacta)

Esta sección es el **enunciado del ejercicio** que voy a resolver yo (ver 5b). Va como funciones puras en `src/domain/schedule.ts`.

### Entradas
- `items`: lista ordenada. Cada ítem tiene `{ id, done: boolean, doneDate?: 'YYYY-MM-DD' }`.
- `startDate`, `deadline`: `'YYYY-MM-DD'`.
- `pace`: ítems por día, número mayor que 0. Puede ser fraccionario: 0,5 significa uno cada dos días disponibles.
- `restWeekdays`: conjunto de días de la semana sin estudio (0 = domingo … 6 = sábado).
- `blockedDates`: conjunto de fechas libres puntuales.
- `today`: `'YYYY-MM-DD'`.

### Día disponible
Un día está disponible si no está en `restWeekdays` ni en `blockedDates`. `nthAvailableDay(from, n)` devuelve el n-ésimo día disponible contando desde `from` inclusive, con n = 1 para el primero.

### Plan original (baseline)
El ítem en la posición `i` (1-based) entre todos los ítems tiene fecha `nthAvailableDay(startDate, ceil(i / pace))`. Se guarda al crear el plan y no se recalcula salvo con "Replanificar".

### Proyección (se recalcula siempre)
1. `base = max(today, startDate)`.
2. Si `base == today` y hoy es un día disponible:
   - `doneToday` = cantidad de ítems con `doneDate == today`;
   - `remainingToday = max(0, capacidadDeHoy − doneToday)`, donde `capacidadDeHoy = pace` si `pace ≥ 1`, o el valor que corresponda según el patrón si `pace < 1`.
3. Si no se cumple lo anterior, `remainingToday = 0`.
4. Recorré los pendientes en orden. Para el k-ésimo pendiente (1-based):
   - si `k ≤ remainingToday` → su fecha es `today`;
   - si no → `nthAvailableDay(siguienteDíaDisponibleDespuésDe(base), ceil((k − remainingToday) / pace))`.
   - Cuando `base > today` (el plan todavía no empezó), no hay ajuste: el k-ésimo pendiente va en `nthAvailableDay(base, ceil(k / pace))`.
5. **Hacer de más nunca empuja hacia adelante:** si `doneToday ≥ capacidadDeHoy`, el primer pendiente va el siguiente día disponible, no más tarde.
6. Los ítems hechos usan su `doneDate`.

### Métricas
- `deberiaLlevar` = ítems cuya fecha del plan original es ≤ hoy.
- `llevo` = ítems hechos.
- `diferencia = llevo − deberiaLlevar`.
- `finEstimado` = la fecha proyectada más tardía entre los pendientes. Si no queda ninguno, es la `doneDate` más tardía.
- `margen = deadline − finEstimado`, en días corridos.
- `ritmoNecesario = pendientes / díasDisponibles(base … deadline)`, redondeado a 1 decimal.

---

## 5b. 🎓 Modo aprendizaje: la reprogramación la implemento yo

Quiero practicar programación con esta parte. Tu rol es de **tutor**, no de implementador.

### Qué tenés que hacer
1. **Utilidades de fechas completas** en `src/domain/dates.ts`: `toISO`, `parseISO`, `addDays`, `weekday`, `diffDays` y `compareISO`, con sus tests. Esto lo hacés vos para que yo me concentre en el algoritmo.
2. **Plantillas en `src/domain/schedule.ts`.** Cada función tiene la firma con tipos, un JSDoc que explica qué recibe, qué devuelve y un ejemplo, y un cuerpo que solo hace `throw new NotImplementedError('nombreDeLaFunción')`. Son estas:
   - `isAvailableDay(date, config): boolean`
   - `nextAvailableDay(date, config): ISODate`, que devuelve el primer día disponible después de `date`
   - `nthAvailableDay(from, n, config): ISODate`
   - `countAvailableDays(from, to, config): number`
   - `buildBaseline(items, config): Record<itemId, ISODate>`
   - `projectSchedule(items, config, today): Record<itemId, ISODate>`
   - `computePlanMetrics(items, baseline, projection, config, today): PlanMetrics`

   Definí los tipos (`ScheduleConfig`, `PlanMetrics`…) completos.
3. **Tests completos en `src/domain/schedule.test.ts`.** Escribí todos los casos A a H de la sección 6, más tests unitarios de cada función de a una, ordenados de la más fácil a la más difícil. Van a fallar hasta que yo implemente las funciones, y esa es la idea.
4. **Guía en `docs/GUIA_REPROGRAMACION.md`.** Tiene que incluir:
   - el orden sugerido para implementar, de la más simple a la más compleja;
   - para cada función: qué problema resuelve, en qué pensar, casos borde (fines de semana, días libres, ritmo fraccionario, hacer de más) y cómo correr solo sus tests (`npx vitest schedule -t "nthAvailableDay"`);
   - **tres niveles de pistas por función**, cada una en un bloque `<details>` desplegable: nivel 1 conceptual, nivel 2 pseudocódigo y nivel 3 con la estructura del código pero no la solución completa;
   - **sin las soluciones.**
5. **Interfaz conectada a estas funciones desde el principio.** Mientras alguna tire `NotImplementedError`, la interfaz no se rompe: muestra un aviso amable como "🛠️ Pendiente: implementá `projectSchedule` (ver docs/GUIA_REPROGRAMACION.md)". En el panel del plan, mostrá las métricas que ya funcionen.

### Cómo ayudarme cuando te lo pida
- Si te pido **una pista**, dámela empezando por el nivel más bajo que me sirva. No me pases código salvo que te lo pida.
- Si te pido **que revises mi código**, decime qué tests fallan y por qué, y señalá los errores con preguntas o pistas en vez de reescribirlo.
- Solo si te digo explícitamente **"resolvelo"** o **"hacelo vos"** para una función concreta, la implementás vos. Explicame la solución línea por línea y agregala a la guía en una sección "Soluciones" aparte.
- **Nunca toques** el cuerpo de las funciones de `schedule.ts` por tu cuenta, ni para "arreglar" algo de la interfaz.
- Anotá este acuerdo en un `CLAUDE.md` en la raíz del proyecto, para que se respete en todas las sesiones.

> La lógica de hábitos (`src/domain/habits.ts`: porcentajes con vigencia y rachas) la implementás vos normalmente. Si después quiero practicarla también, te lo pido.

---

## 6. Casos de prueba obligatorios

En todos: ritmo 1, sin descanso y sin días libres, salvo que se diga otra cosa.

| # | Escenario | Resultado esperado |
|---|---|---|
| A | 34 ítems, inicio 16/11/2026, hoy 15/11, ninguno hecho | Primer pendiente 16/11, último 19/12. Fin estimado 19/12. Con límite 20/12: "Te sobran 1 día" |
| B | Inicio 10/11, hoy 15/11, hechos 3 (10/11, 11/11 y 15/11) | Debería llevar 6 y llevo 3: "Atrasado 3". Como hoy ya se hizo 1, el primer pendiente va el **16/11**. Fin estimado 16/12 |
| C | Inicio 16/11, hoy 16/11, **3 hechos hoy** | El primer pendiente va el **17/11**, no el 19/11. Fin estimado **17/12**, dos días antes que el plan. "Al día (+2)" |
| D | Igual que A, con domingos de descanso | Ningún ítem cae en domingo. El fin se corre en consecuencia |
| E | Igual que A, con días libres 24/12 y 25/12 y 40 ítems | Ningún ítem cae el 24 ni el 25 |
| F | Ritmo 2, hoy 16/11, 1 hecho hoy | El primer pendiente va hoy (queda 1 lugar). El segundo y el tercero, mañana |
| G | Ritmo 0,5 | Un ítem cada 2 días disponibles |
| H | Reordenar: mover el ítem 10 al primer lugar | La proyección se recalcula y el ítem 10 queda para el próximo lugar libre. El plan original no cambia |
| I | Hábitos: 1 hábito vigente, cumplido todo el mes | 100% en el día, el mes y el hábito, aunque existan otros hábitos fuera de vigencia |
| J | Hábito nuevo con "desde" en noviembre | No cambia el porcentaje de los meses anteriores |

---

## 7. Modelo de datos (por defecto)

```ts
type ISODate = string; // 'YYYY-MM-DD' local

interface Habit { id: string; name: string; emoji?: string; color?: string;
  startDate: ISODate; endDate?: ISODate; order: number; createdAt: string; updatedAt: string; }
interface HabitLog { id: string; habitId: string; date: ISODate; done: boolean; updatedAt: string; }
interface DayMood { date: ISODate; mood?: number; motivation?: number; updatedAt: string; } // 0..10

interface Plan { id: string; name: string; startDate: ISODate; deadline: ISODate; pace: number;
  restWeekdays: number[]; blockedDates: ISODate[]; linkedHabitId?: string;
  baseline: Record<string /*itemId*/, ISODate>; createdAt: string; updatedAt: string; }
interface PlanItem { id: string; planId: string; title: string; section?: string; notes?: string;
  order: number; done: boolean; doneDate?: ISODate; updatedAt: string; }
interface Milestone { id: string; planId: string; title: string; from: ISODate; to: ISODate;
  description?: string; done: boolean; updatedAt: string; }
```

---

## 8. Pantallas

1. **Hoy (inicio):** los hábitos de hoy con checks grandes, el ánimo y la motivación, y por cada plan activo los ítems que tocan hoy con su check y su estado ("Te sobran X días").
2. **Hábitos:** lista y edición (nombre, desde, hasta, orden), más la vista de mes con grilla y gráficos.
3. **Panel anual:** las tarjetas por mes y el gráfico del año.
4. **Planes:** lista de planes y detalle con panel, ítems (tabla con plan original, proyección, estado y fecha real), burn-up y etapas.
5. **Ajustes:** exportar e importar, tema claro u oscuro, y semana que empieza el lunes.

**Estilo visual:** minimalista, como mis planillas. Grises claros (`#EFEFEF`, `#D9D9D9`), texto `#434343`/`#666666`, verde de progreso `#93C47D`/`#90EE90`, rosa para el ánimo `#D5A6BD`. Barras de progreso finas. Modo oscuro incluido.

---

## 9. Fases

**Fase 1, MVP (empezá por acá):**
- proyecto Vite + React + TS + Tailwind + PWA + Dexie;
- `src/domain/dates.ts` y `src/domain/habits.ts` implementados, con sus tests en verde (casos I y J);
- `src/domain/schedule.ts` **solo con plantillas** y `schedule.test.ts` completo, con los casos A a H fallando a propósito; más `docs/GUIA_REPROGRAMACION.md` y `CLAUDE.md` (ver 5b);
- las pantallas Hoy, Hábitos (lista y mes), Planes (detalle con panel e ítems) y Ajustes (exportar e importar JSON);
- los datos semilla de la sección 10, cargables con un botón "Cargar ejemplo";
- instalable como PWA y funcionando offline.

**Fase 2:** deploy (Vercel), sincronización con Supabase y login, panel anual completo y gráficos burn-up.

**Fase 3 (opcional):** notificaciones locales ("Hoy te toca: Room 12"), rachas avanzadas, importar el .xlsx de mis planillas.

**Tu parte del MVP está terminada cuando:**
- pasan los tests de fechas y de hábitos, y los de `schedule` fallan solo por `NotImplementedError`;
- puedo crear un plan, pegar 34 ítems y marcar ítems hechos, y la interfaz muestra el aviso de "pendiente de implementar" donde corresponde;
- puedo registrar hábitos desde el teléfono con la app instalada;
- los datos siguen ahí después de cerrar y volver a abrir la app sin conexión.

**El MVP completo** queda cuando yo implemento `schedule.ts`, pasan todos los tests y veo que, al marcar 3 ítems en un día, la fecha de fin se adelanta.

---

## 10. Datos semilla (mi caso real)

**Plan "SOC Level 1 · TryHackMe"**
- Inicio 16/11/2026, límite 20/12/2026, 1 room por día, sin día de descanso.
- Días libres: 24/12/2026, 25/12/2026 y 31/12/2026.
- 34 ítems: "Room 1" … "Room 34". Después pego los nombres reales.

**Etapas del plan:**

| Etapa | Desde | Hasta | Descripción |
|---|---|---|---|
| Terminar el path | 16/11/2026 | 20/12/2026 | Una room por día. Descargar el certificado apenas termine |
| Control de avance | 06/12/2026 | 06/12/2026 | Si voy atrasado, recuperar ese fin de semana |
| Margen y fiestas | 21/12/2026 | 03/01/2027 | Descanso. Solo recuperar si hace falta |
| Revisar Premium | 28/12/2026 | 28/12/2026 | Confirmar que la suscripción siga activa en enero |
| Preparación SAL1 | 04/01/2027 | 15/01/2027 | ~2 h por día: SOC Simulator, plantilla de reportes, rehacer rooms difíciles, hoja de queries del SIEM |
| Comprar el voucher | 12/01/2027 | 12/01/2027 | Si me siento cómodo con el simulador |
| Examen SAL1 | 16/01/2027 | 17/01/2027 | Ventana de 24 h, con pausas |
| Fecha de reserva | 23/01/2027 | 24/01/2027 | Por si algo falla |

**Hábitos:** arrancan vacíos. Los cargo yo para 2027. Incluí uno de ejemplo, "Estudiar SOC", vinculado al plan.

---

## 11. Preguntas abiertas

Preguntámelas, pero no te frenes: usá el valor por defecto mientras tanto.

1. ¿Querés sincronización entre teléfono y computadora desde el principio o alcanza con la fase 2? **Por defecto: fase 2.**
2. ¿Querés login con Google o con email? **Por defecto: Google, en la fase 2.**
3. ¿Querés notificaciones diarias? **Por defecto: no en el MVP.**

---

## 12. Primeros pasos concretos

1. `npm create vite@latest habitos -- --template react-ts`, y después Tailwind, `vite-plugin-pwa`, `dexie`, `date-fns`, `recharts` y `vitest`.
2. Escribir `CLAUDE.md` con el acuerdo del modo aprendizaje (5b).
3. Escribir `src/domain/dates.ts` con sus tests, en verde.
4. Escribir las plantillas de `src/domain/schedule.ts`, `schedule.test.ts` completo (en rojo a propósito) y `docs/GUIA_REPROGRAMACION.md`.
5. Escribir `src/domain/habits.ts` (porcentajes con vigencia y rachas) con los casos I y J, en verde.
6. Armar la capa de datos con Dexie y los repositorios.
7. Construir las pantallas Hoy, Planes, Hábitos y Ajustes, con los avisos de "pendiente de implementar".
8. Configurar la PWA (manifest e íconos) y probar la instalación y el modo offline.
9. Escribir un `README.md` que explique cómo correrla, cómo instalarla en el teléfono, cómo cargar el ejemplo y **cómo empezar con mi ejercicio** (qué archivo abrir, cómo correr los tests y dónde está la guía).
