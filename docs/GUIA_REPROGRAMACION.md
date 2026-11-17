# 🎓 Guía del ejercicio: reprogramación de planes

Vas a implementar las 7 funciones de [`src/domain/schedule.ts`](../src/domain/schedule.ts). Son el corazón de la app: con ellas el plan se reajusta solo cuando hacés de más o de menos.

- **Enunciado:** el JSDoc de cada función, en `schedule.ts`, y la sección 5 del brief.
- **Tests:** [`src/domain/schedule.test.ts`](../src/domain/schedule.test.ts). Hay 57 y hoy fallan todos con `NotImplementedError`. Esa es la idea.
- **Herramientas que ya tenés** en [`src/domain/dates.ts`](../src/domain/dates.ts): `addDays`, `weekday`, `diffDays`, `compareISO`, `maxISO`, `minISO` y `eachDay`.

## Cómo correr los tests

```bash
npm test -- schedule                       # todos los de schedule
npm test -- schedule -t "isAvailableDay"   # solo una función (el nombre del describe)
npm test -- schedule -t "Caso C"           # un caso del brief
npm run test:watch -- schedule             # modo watch: re-corre al guardar
```

> ⚠️ En Windows usá `npm test --` y no `npx vitest`. Si la terminal abre la carpeta como `c:\` en minúscula, Vitest se carga dos veces y falla con "failed to find the current suite".

Mientras alguna función no esté implementada, la app muestra "🛠️ Pendiente: implementá `X`" en el lugar donde la necesita. A medida que avances, el panel del plan se va completando solo.

## Orden sugerido

| # | Función | Dificultad | Depende de |
|---|---|---|---|
| 1 | `isAvailableDay` | ⭐ | — |
| 2 | `nextAvailableDay` | ⭐ | 1 |
| 3 | `nthAvailableDay` | ⭐⭐ | 1, 2 |
| 4 | `countAvailableDays` | ⭐ | 1 |
| 5 | `buildBaseline` | ⭐⭐ | 3 |
| 6 | `projectSchedule` | ⭐⭐⭐⭐ | 2, 3 |
| 7 | `computePlanMetrics` | ⭐⭐⭐ | 4 (y usa los resultados de 5 y 6) |

**Consejo general:** antes de escribir código, hacé cada ejemplo del JSDoc a mano con un calendario de noviembre y diciembre de 2026 al lado. Si te sale a mano, te sale en código.

```
       Noviembre 2026              Diciembre 2026
 Do Lu Ma Mi Ju Vi Sá        Do Lu Ma Mi Ju Vi Sá
  1  2  3  4  5  6  7               1  2  3  4  5
  8  9 10 11 12 13 14         6  7  8  9 10 11 12
 15 16 17 18 19 20 21        13 14 15 16 17 18 19
 22 23 24 25 26 27 28        20 21 22 23 24 25 26
 29 30                       27 28 29 30 31
```

---

## 1. `isAvailableDay(date, config)`

**Qué resuelve:** decide si un día cuenta para estudiar. Las demás funciones dependen de esta.

**En qué pensar:**
- Hay dos razones para que un día *no* esté disponible: el día de la semana (`restWeekdays`) o la fecha puntual (`blockedDates`).
- `weekday` devuelve 0 para el domingo y 6 para el sábado, igual que `restWeekdays`.

**Casos borde:** sin descanso ni días libres, todo está disponible. Un día puede estar bloqueado por las dos razones a la vez, y eso no cambia nada.

**Tests:** `npm test -- schedule -t "isAvailableDay"`

<details><summary>💡 Pista 1: conceptual</summary>

Es una sola expresión booleana. "Disponible" significa "no es día de descanso **y** no es día libre".

</details>

<details><summary>💡 Pista 2: pseudocódigo</summary>

```
diaSemana ← weekday(date)
esDescanso ← diaSemana está en restWeekdays
esLibre ← date está en blockedDates
devolver no esDescanso y no esLibre
```

</details>

<details><summary>💡 Pista 3: estructura</summary>

Los arrays tienen un método que responde "¿este elemento está acá?" y devuelve un booleano. Lo vas a usar dos veces.

```ts
return !config.restWeekdays./* ¿? */(/* ¿? */) && !config.blockedDates./* ¿? */(/* ¿? */)
```

</details>

---

## 2. `nextAvailableDay(date, config)`

**Qué resuelve:** "¿cuál es el próximo día en que puedo estudiar?". Ojo: es **estrictamente después** de `date`, así que nunca devuelve `date` aunque esté disponible.

**En qué pensar:**
- Avanzás de a un día hasta encontrar uno disponible.
- **El loop infinito:** si los 7 días de la semana son de descanso, nunca vas a encontrar uno. Tenés que detectarlo antes y tirar un `Error`.

**Casos borde:** sábado y domingo seguidos de descanso, días libres consecutivos (24 y 25/12) y el cruce de año (31/12 → 01/01).

**Tests:** `npm test -- schedule -t "nextAvailableDay"`

<details><summary>💡 Pista 1: conceptual</summary>

Es un loop "mientras no encuentre, avanzo". Primero das un paso (porque es *después*) y después seguís mientras el día no esté disponible. Para evitar el loop infinito, preguntate: ¿cuántos días de la semana *distintos* tiene `restWeekdays`?

</details>

<details><summary>💡 Pista 2: pseudocódigo</summary>

```
si restWeekdays cubre los 7 días → tirar Error
d ← date + 1 día
mientras d no esté disponible:
    d ← d + 1 día
devolver d
```

</details>

<details><summary>💡 Pista 3: estructura</summary>

`new Set(array).size` te dice cuántos valores distintos tiene un array. Eso cubre el caso de que alguien cargue `[0, 0, 1]`.

```ts
if (/* ¿cuántos distintos? */ >= 7) throw new Error('…')
let d = addDays(date, /* ¿? */)
while (/* ¿? */) {
  d = /* ¿? */
}
return d
```

</details>

---

## 3. `nthAvailableDay(from, n, config)`

**Qué resuelve:** "¿qué fecha es el n-ésimo día de estudio contando desde `from`?". Las fechas del plan salen de acá.

**En qué pensar:**
- **`from` es inclusive.** Si `from` está disponible, es el día número 1. Si no lo está, el número 1 es el próximo disponible.
- Primero encontrás el día número 1 y después das `n − 1` saltos con `nextAvailableDay`.
- Validá que `n` sea un entero mayor o igual a 1 y tirá `RangeError` si no lo es. Mirá `Number.isInteger`.

**Casos borde:** `from` cae en un día de descanso, `n = 1`, y valores de `n` inválidos (0, −1, 1,5).

**Tests:** `npm test -- schedule -t "nthAvailableDay"`

<details><summary>💡 Pista 1: conceptual</summary>

La diferencia con `nextAvailableDay` es solo el "inclusive". Una forma de verlo: el primer día disponible desde `from` inclusive es "el próximo disponible después de *ayer*". La otra forma: si `from` está disponible lo usás, y si no, buscás el próximo.

</details>

<details><summary>💡 Pista 2: pseudocódigo</summary>

```
si n no es entero o n < 1 → tirar RangeError
d ← primer día disponible desde `from` inclusive
repetir (n − 1) veces:
    d ← nextAvailableDay(d)
devolver d
```

</details>

<details><summary>💡 Pista 3: estructura</summary>

```ts
if (/* validación de n */) throw new RangeError('…')
let d = isAvailableDay(from, config) ? /* ¿? */ : /* ¿? */
for (let i = /* ¿desde? */; i < /* ¿hasta? */; i++) {
  d = /* ¿? */
}
return d
```

Revisá con el test: `nthAvailableDay('2026-11-16', 34, cfg)` tiene que dar `'2026-12-19'`. Si te da `'2026-12-20'`, el loop da un salto de más.

</details>

---

## 4. `countAvailableDays(from, to, config)`

**Qué resuelve:** "¿cuántos días de estudio quedan entre dos fechas?". La usa el **ritmo necesario** del panel.

**En qué pensar:**
- Los dos extremos son inclusive: del 16/11 al 16/11 hay 1 día.
- Si `from > to`, devuelve 0.

**Casos borde:** un rango de un solo día, el rango invertido, y días libres que caen fuera del rango (no tienen que restar nada).

**Tests:** `npm test -- schedule -t "countAvailableDays"`

<details><summary>💡 Pista 1: conceptual</summary>

Recorrés todos los días del rango y contás los disponibles. Hay una función en `dates.ts` que te da todos los días de un rango.

</details>

<details><summary>💡 Pista 2: pseudocódigo</summary>

```
contador ← 0
para cada día d desde `from` hasta `to` (inclusive):
    si d está disponible: contador ← contador + 1
devolver contador
```

</details>

<details><summary>💡 Pista 3: estructura</summary>

`eachDay(from, to)` ya devuelve `[]` si `from > to`, así que ese caso te sale gratis. Con `filter` y `length` lo resolvés en una línea, o con un `for…of` y un contador.

</details>

---

## 5. `buildBaseline(items, config)`

**Qué resuelve:** el **plan original**, la "foto" que sacás al crear el plan, para comparar después cómo vas. Le asigna una fecha a cada ítem según su posición, sin importar si está hecho.

**En qué pensar:**
- La fórmula está en el JSDoc: el ítem en la posición `i` (base 1) va en el día disponible número `floor((i − 1) / pace) + 1`, contando desde `startDate`.
- Probá la fórmula a mano con ritmo 1, 2 y 0,5, y con `i` = 1, 2, 3, 4. ¿Qué número de día te da en cada caso?
- Ojo con el índice: `forEach` y `map` te dan `i` base 0.
- La función tiene que ser pura: no modifiques `items`. Creá un objeto nuevo.
- Validá que `pace > 0` y tirá `RangeError` si no.

**Casos borde:** ritmo fraccionario, `startDate` en un día de descanso, ítems ya hechos (se ignora `done`) y la lista vacía.

**Tests:** `npm test -- schedule -t "buildBaseline"`

<details><summary>💡 Pista 1: conceptual</summary>

Para cada ítem calculás *qué número de día de estudio* le toca (1.º, 2.º, 3.º…) y después usás `nthAvailableDay` para pasar ese número a una fecha.

</details>

<details><summary>💡 Pista 2: pseudocódigo</summary>

```
validar pace
resultado ← {}
para cada ítem en la posición i (base 0):
    numeroDeDia ← floor(i / pace) + 1        ← ¿por qué i y no i − 1?
    resultado[ítem.id] ← nthAvailableDay(startDate, numeroDeDia)
devolver resultado
```

</details>

<details><summary>💡 Pista 3: estructura</summary>

```ts
if (/* ¿? */) throw new RangeError('…')
const result: DateMap = {}
items.forEach((item, idx) => {
  const dayNumber = Math.floor(/* ¿? */) + 1
  result[item.id] = /* ¿? */
})
return result
```

**Optimización opcional:** llamar a `nthAvailableDay` desde `startDate` para cada ítem es O(n²). Con 34 ítems no importa. Si querés, podés avanzar un "cursor" en vez de contar desde cero cada vez.

</details>

---

## 6. `projectSchedule(items, config, today)` ⭐ la importante

**Qué resuelve:** la **proyección**: dónde cae cada pendiente si a partir de hoy seguís el ritmo. Se recalcula en cada cambio. Con esto la fecha de fin se adelanta cuando hacés de más.

**En qué pensar:**
- **Hay tres situaciones.** Identificalas antes de escribir nada (están en el JSDoc, pasos 3 a 5):
  1. El plan todavía no empezó (`base > today`).
  2. Hoy es día de estudio.
  3. Hoy no se estudia (descanso o día libre).
- **`k` cuenta solo los pendientes**, no todos los ítems. Los hechos no ocupan lugar en el futuro: usan su `doneDate`.
- **La cuota de hoy:** `capacidadDeHoy = ceil(pace)`. Lo que ya hiciste hoy la consume. Lo que hiciste ayer **no**.
- **La regla de oro:** hacer de más nunca empuja hacia adelante. Mirá el caso C: con 3 hechos hoy y ritmo 1, `remainingToday` sale `max(0, 1 − 3) = 0`, no −2. Si te sale −2, el pendiente se va 2 días más lejos: ese era justamente el error de tus planillas.
- **¿Por qué `ceil((k − remainingToday) / pace)` en el caso de hoy y `floor((k − 1) / pace) + 1` en los otros?** Con ritmo entero dan lo mismo. Con ritmo 0,5 cambian. Si hoy hay "turno", el siguiente ítem va 2 días disponibles después de hoy. Si hoy no hay turno, el primer ítem va el primer día disponible. Hacé el caso G a mano.

**Casos borde:** hacer de más hoy (C), ritmo 2 con la cuota a medias (F), ritmo 0,5 (G), hoy en un día de descanso o libre, el orden del array (H) y un ítem hecho sin `doneDate`.

**Tests:** `npm test -- schedule -t "projectSchedule"`, y después `-t "Caso"` para los del brief.

<details><summary>💡 Pista 1: conceptual</summary>

Recorrés los ítems **en orden** con un contador `k` que solo avanza con los pendientes. Antes del loop calculás lo que no cambia de un ítem a otro: `base`, en cuál de las tres situaciones estás, `doneToday` y `remainingToday`. Dentro del loop, cada pendiente se resuelve con una fórmula según la situación.

</details>

<details><summary>💡 Pista 2: pseudocódigo</summary>

```
validar pace
base ← max(today, startDate)
hoyEsDeEstudio ← (base == today) y isAvailableDay(today)
si hoyEsDeEstudio:
    doneToday ← cantidad de ítems hechos con doneDate == today
    remainingToday ← max(0, ceil(pace) − doneToday)

resultado ← {}
k ← 0
para cada ítem, en orden:
    si está hecho:
        resultado[id] ← doneDate (o today si falta)
        seguir con el próximo
    k ← k + 1
    si base > today:          resultado[id] ← nthAvailableDay(base, …)
    si no, si hoyEsDeEstudio:
        si k ≤ remainingToday: resultado[id] ← today
        si no:                 resultado[id] ← nthAvailableDay(nextAvailableDay(today), …)
    si no:                    resultado[id] ← nthAvailableDay(nextAvailableDay(today), …)
devolver resultado
```

Los `…` son las fórmulas del JSDoc. Elegí bien cuál va en cada caso.

</details>

<details><summary>💡 Pista 3: estructura</summary>

```ts
if (/* ¿? */) throw new RangeError('…')
const base = maxISO(/* ¿? */, /* ¿? */)
const studyToday = /* ¿? */
const doneToday = items.filter((it) => /* ¿hecho y hoy? */).length
const remainingToday = studyToday ? Math.max(0, /* ¿? */) : 0

const result: DateMap = {}
let k = 0
for (const item of items) {
  if (item.done) {
    result[item.id] = /* ¿? */
    continue
  }
  k++
  if (/* plan no empezó */) {
    result[item.id] = /* ¿? */
  } else if (studyToday) {
    result[item.id] = k <= remainingToday ? today : /* ¿? */
  } else {
    result[item.id] = /* ¿? */
  }
}
return result
```

Pensá cuánto vale `nextAvailableDay(today, config)`: no cambia dentro del loop. ¿Lo calculás una sola vez?

</details>

---

## 7. `computePlanMetrics(items, baseline, projection, config, today)`

**Qué resuelve:** los números del panel: "⚠️ Atrasado 3", "✅ Te sobran 4 días", el ritmo necesario y lo que toca hoy.

**En qué pensar:**
- No recalcula fechas: **usa** `baseline` y `projection`, que recibe ya hechos.
- Cada campo es independiente de los demás. Implementalos de a uno y corré el test seguido.
- Para el "máximo" de fechas alcanza con `sort(compareISO)` y quedarte con el último. Recordá que `sort` modifica el array, así que copialo antes.
- `requiredPace` tiene tres ramas: no quedan pendientes (0), no quedan días disponibles (`null`) o la división redondeada a 1 decimal. Redondear: `Math.round(x * 10) / 10`.
- `shouldHaveDone`: un ítem que no está en `baseline` (agregado después) no cuenta.

**Casos borde:** el plan sin ítems, todo hecho, la fecha límite ya pasada y un margen negativo.

**Tests:** `npm test -- schedule -t "computePlanMetrics"`

<details><summary>💡 Pista 1: conceptual</summary>

Separá los ítems en hechos y pendientes al principio. Casi todos los campos salen de esas dos listas, más `baseline`, `projection` y las funciones de fechas.

</details>

<details><summary>💡 Pista 2: pseudocódigo</summary>

```
hechos ← ítems con done
pendientes ← ítems sin done
deberia ← cantidad de ítems con baseline[id] definido y ≤ today
fechasFin ← si hay pendientes: projection de los pendientes
            si no: doneDate de los hechos
fin ← la más tardía de fechasFin (o null si está vacía)
margen ← fin ? diffDays(deadline, fin) : null
disponibles ← countAvailableDays(max(today, startDate), deadline)
ritmo ← 0 si no hay pendientes; null si disponibles == 0; si no, redondear(pendientes / disponibles)
hoy ← ids de los pendientes con projection == today
```

</details>

<details><summary>💡 Pista 3: estructura</summary>

```ts
const done = items.filter(/* ¿? */)
const pending = items.filter(/* ¿? */)
const shouldHaveDone = items.filter((it) => baseline[it.id] !== undefined && /* ¿? */).length
const endCandidates = pending.length > 0 ? pending.map(/* ¿? */) : done.map(/* ¿? */)
const estimatedEnd = endCandidates.length ? [...endCandidates].sort(compareISO).at(-1)! : null
// …marginDays, requiredPace, todayItemIds
return { total: items.length, done: done.length, /* … */ }
```

</details>

---

## ¿Y ahora qué?

Cuando pasen los 57 tests:
1. Abrí la app, entrá al plan SOC y marcá 3 rooms hoy. La **fecha de fin estimada se tiene que adelantar** y el panel tiene que decir "Al día (+2)".
2. Desmarcá una y fijate que se recalcula al instante.
3. ¿Querés más? Hacé las optimizaciones opcionales (la de `buildBaseline`, por ejemplo) y comprobá que los tests siguen en verde.

Si te trabás, pedile a Claude "una pista de `X`" o "revisá mi `X`". Solo si le decís "resolvelo" te escribe la solución, y en ese caso queda acá abajo.

## Soluciones

> El 17/11/2026 Tomás pidió que Claude terminara las 7 funciones. El código completo está en
> [`src/domain/schedule.ts`](../src/domain/schedule.ts). Acá va cada una explicada línea por línea.
> Si querés practicar igual, borrá el cuerpo de una función y volvé a escribirla con los tests.

### Auxiliares

```ts
function assertSomeDayAvailable(config: ScheduleConfig): void {
  if (new Set(config.restWeekdays).size >= 7) throw new Error('No hay ningún día disponible…')
}
function assertPace(pace: number): void {
  if (!(pace > 0)) throw new RangeError(`El ritmo tiene que ser mayor que 0 (recibí ${pace})`)
}
```

- `new Set(...)` saca los repetidos: `[0, 0, 1]` son 2 días distintos, no 3. Si hay 7 días distintos de descanso, ningún día puede estar disponible. Hay que cortar **antes** de entrar al `while`, porque si no queda un loop infinito.
- `!(pace > 0)` en lugar de `pace <= 0`: así también rechaza `NaN`, porque cualquier comparación con `NaN` da `false`.

### 1. `isAvailableDay`

```ts
return !config.restWeekdays.includes(weekday(date)) && !config.blockedDates.includes(date)
```

- `weekday(date)` devuelve 0–6 (domingo = 0) a partir del string local, sin pasar por UTC.
- El día está disponible si **no** es de descanso **y** **no** es un día libre puntual. Las fechas se comparan como strings, que funciona porque el formato `YYYY-MM-DD` es fijo.

### 2. `nextAvailableDay`

```ts
assertSomeDayAvailable(config)
let d = addDays(date, 1)
while (!isAvailableDay(d, config)) d = addDays(d, 1)
return d
```

1. Primero el control del loop infinito.
2. Arranca en `date + 1`, porque la función dice "estrictamente después".
3. Avanza de a un día hasta encontrar uno disponible. Termina siempre: hay al menos un día de la semana disponible, y la lista de días libres es finita.

### 3. `nthAvailableDay`

```ts
if (!Number.isInteger(n) || n < 1) throw new RangeError(…)
assertSomeDayAvailable(config)
let d = isAvailableDay(from, config) ? from : nextAvailableDay(from, config)
for (let i = 1; i < n; i++) d = nextAvailableDay(d, config)
return d
```

1. Valida `n`: `Number.isInteger` rechaza `1.5`, `NaN` e `Infinity`.
2. El primer disponible **contando `from`**: si `from` sirve es ese; si no, el siguiente.
3. Ya tenemos el 1.º. Se salta `n − 1` veces más al siguiente disponible.

### 4. `countAvailableDays`

```ts
let count = 0
for (let d = from; d <= to; d = addDays(d, 1)) if (isAvailableDay(d, config)) count++
return count
```

- Recorre de `from` a `to` inclusive y cuenta. Si `from > to`, el `for` no entra nunca y devuelve 0 sin ningún `if` especial.
- `d <= to` compara strings, igual que en `isAvailableDay`.

### 5. `buildBaseline`

```ts
assertPace(config.pace)
const out: DateMap = {}
items.forEach((item, idx) => {
  out[item.id] = nthAvailableDay(config.startDate, Math.floor(idx / config.pace) + 1, config)
})
return out
```

- `idx` es 0-based, así que `idx` ya es `i − 1` de la fórmula del enunciado: `floor((i − 1) / pace) + 1`.
- Con ritmo 2: los idx 0 y 1 dan el día 1, los idx 2 y 3 el día 2. Con ritmo 0,5: idx 0 → día 1, idx 1 → día 3.
- No lee `done` ni `doneDate`, y no modifica `items`: solo los recorre.
- *Optimización posible*: llamar a `nthAvailableDay` desde el inicio por cada ítem es O(n²) días. Se puede guardar el último día calculado y avanzar desde ahí. Para 34 ítems no hace falta.

### 6. `projectSchedule` ⭐

```ts
assertPace(config.pace)
const { pace } = config
const base = maxISO(today, config.startDate)
const out: DateMap = {}

for (const item of items) if (item.done) out[item.id] = item.doneDate ?? today
const pending = items.filter((i) => !i.done)
```

- `base` es desde cuándo se reparte: hoy, o el inicio si el plan todavía no empezó.
- Los hechos quedan en su fecha real. Si falta `doneDate` (un dato viejo), se usa hoy.
- `pending` conserva el orden del array, porque `filter` no reordena. Eso es lo que hace que "el orden del array manda".

```ts
if (base > today) {
  pending.forEach((item, idx) => {
    out[item.id] = nthAvailableDay(base, Math.floor(idx / pace) + 1, config)
  })
}
```

**Caso "no empezó"**: es el baseline, pero contando solo los pendientes.

```ts
else if (isAvailableDay(today, config)) {
  const doneToday = items.filter((i) => i.done && (i.doneDate ?? today) === today).length
  const remainingToday = Math.max(0, Math.ceil(pace) - doneToday)
  const tomorrow = nextAvailableDay(today, config)
  pending.forEach((item, idx) => {
    const k = idx + 1
    out[item.id] = k <= remainingToday ? today : nthAvailableDay(tomorrow, Math.ceil((k - remainingToday) / pace), config)
  })
}
```

**Caso "hoy se estudia"**:
- `doneToday` cuenta los hechos hoy. Un hecho sin `doneDate` cuenta como hoy, igual que arriba.
- `remainingToday` es lo que queda de la cuota de hoy. El `Math.max(0, …)` es **la regla de oro**: si hiciste de más, la cuota queda en 0, no en negativo. Si fuera negativa, los pendientes se correrían para *después* de mañana.
- Los primeros `remainingToday` pendientes van hoy. El resto se cuenta desde el próximo disponible: el pendiente `k` es el número `k − remainingToday` de "mañana en adelante", y con ritmo `pace` cae en el día `ceil((k − remainingToday) / pace)`.
- `tomorrow` se calcula una sola vez fuera del loop.

```ts
else {
  const next = nextAvailableDay(today, config)
  pending.forEach((item, idx) => {
    out[item.id] = nthAvailableDay(next, Math.floor(idx / pace) + 1, config)
  })
}
return out
```

**Caso "hoy no se estudia"**: es el mismo reparto que el baseline, pero arrancando el próximo día disponible.

### 7. `computePlanMetrics`

```ts
const total = items.length
const doneItems = items.filter((i) => i.done)
const pendingItems = items.filter((i) => !i.done)
const done = doneItems.length
const pending = pendingItems.length
const shouldHaveDone = items.filter((i) => baseline[i.id] !== undefined && baseline[i.id] <= today).length
```

- `shouldHaveDone` cuenta los ítems cuya fecha del plan original ya llegó. El `!== undefined` deja afuera los ítems agregados después, que todavía no están en el baseline.

```ts
const latest = (dates: (ISODate | undefined)[]): ISODate | null =>
  dates.reduce<ISODate | null>((max, d) => (d && (!max || d > max) ? d : max), null)
const estimatedEnd =
  total === 0 ? null
  : pending > 0 ? latest(pendingItems.map((i) => projection[i.id]))
  : latest(doneItems.map((i) => i.doneDate ?? projection[i.id]))
```

- `latest` devuelve la fecha más tardía de una lista e ignora las `undefined`.
- Sin ítems, `null`. Con pendientes, la fecha más tardía de la proyección. Con todo hecho, la `doneDate` más tardía (o la de la proyección, si falta).

```ts
const base = maxISO(today, config.startDate)
const daysLeft = countAvailableDays(base, config.deadline, config)
const requiredPace = pending === 0 ? 0 : daysLeft === 0 ? null : Math.round((pending / daysLeft) * 10) / 10
```

- `requiredPace` es lo que tendrías que hacer por día para llegar justo. `Math.round(x * 10) / 10` redondea a 1 decimal. Si ya no quedan días disponibles, devuelve `null` ("Sin días").

```ts
return {
  total, done, pending, shouldHaveDone,
  diff: done - shouldHaveDone,
  estimatedEnd,
  marginDays: estimatedEnd === null ? null : diffDays(config.deadline, estimatedEnd),
  requiredPace,
  todayItemIds: pendingItems.filter((i) => projection[i.id] === today).map((i) => i.id),
}
```

- `diffDays(deadline, estimatedEnd)` es positivo si terminás antes del límite.
- `todayItemIds` sale de `pendingItems`, así que conserva el orden del plan.

### Extra: planes por cantidad (`src/domain/progress.ts`)

No era parte del ejercicio. Son los planes medidos en horas, páginas, etc., en lugar de una lista. Usan las mismas funciones de días y la misma regla de oro: la cuota de hoy es `max(0, ritmo − hechoHoy)`, y lo que sobra del total se reparte desde el próximo día disponible con `ceil(resto / ritmo)` días.
