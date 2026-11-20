# Cargar comidas escritas

En **Salud → Calorías de hoy** escribís lo que comiste y la app busca cada alimento en un diccionario
y calcula las kcal. También funciona en la tarjeta de Salud de **Hoy** (una línea) y con el dictado
del teclado del iPhone.

> **Valores aproximados.** Las kcal salen de tablas estándar (USDA FoodData Central, tablas argentinas
> y etiquetas típicas) y de pesos caseros promedio (un huevo ≈ 50 g, una feta de jamón ≈ 15 g). Sirven
> para llevar la cuenta, no son exactas.

## Formato

Un alimento por línea, o varios separados por **coma**, **«y»**, `;` o `+`. Cada alimento es:

```
<cantidad> <unidad> <alimento>
```

```
200 g arroz, 2 huevos
1 taza de leche y 1/2 palta
3 fetas de jamón
1 milanesa, 150 ml jugo de naranja, 1 cda de aceite
```

- **Cantidad:** enteros (`2`), decimales con coma o punto (`1,5` · `1.5`), fracciones (`1/2`, `1 1/2`, `½`)
  y palabras: `un`, `una`, `medio`, `media`, `dos` … `diez`, `1 y medio`. Sin cantidad cuenta 1.
- **Unidad:**
  | Escribís | Significa |
  | --- | --- |
  | `g`, `gr`, `gramos`, `kg`, `kilo` | peso |
  | `ml`, `cc`, `l`, `litro` | volumen |
  | `unidad` / sin unidad (`2 huevos`) | unidades del alimento (si no se cuenta en unidades: una porción) |
  | `taza` (240 ml), `vaso` (200 ml) | |
  | `cda` / `cucharada` (15 ml), `cdta` / `cucharadita` (5 ml) | |
  | `feta`, `rebanada` / `rodaja`, `porción`, `plato` | según el alimento |

  Las tazas y cucharadas usan el peso propio del alimento cuando lo tiene (1 taza de arroz cocido ≈ 160 g,
  1 cda de aceite ≈ 13,5 g); si no, densidad 1 (1 ml ≈ 1 g).
- **«de» es opcional:** `1 taza de leche` = `1 taza leche`.
- **Mayúsculas, tildes y plurales dan igual:** `JAMON`, `jamón`, `huevos`, `panes`, `empanadas`.
- **Sinónimos:** palta/aguacate, frutilla/fresa, choclo/maíz, poroto/frijol, banana/plátano…
- **Errores de tipeo chicos** se corrigen («milaneza» → milanesa). En la vista previa se marcan con ≈ y
  «Parecido a:», para que veas qué entendió.
- **Cocido o crudo:** arroz, fideos, legumbres y carnes cuentan **cocidos** (como se suelen servir).
  Para crudo escribilo: `80 g fideos crudos`, `70 g arroz crudo`.

No se separa por «con» porque hay comidas que lo llevan (café con leche). Para «milanesa con puré»
escribí `1 milanesa, 1 porción de puré`.

## Cuando no reconoce algo

La línea aparece con ⚠️ y el motivo:

- **No conozco «…»:** el alimento no está en el diccionario.
- **No sé cuánto es 1 feta de arroz…:** el alimento existe pero esa unidad no tiene sentido; probá con gramos.
- **Falta el alimento / no entiendo la cantidad.**

Para resolverla podés:

1. **Poner sus kcal** a mano en el campito de esa línea (solo para esta vez), o
2. **Guardar en Mis alimentos:** nombre, kcal por unidad/porción o cada 100 g, y opcional el peso de una
   unidad. Desde ahí la reconoce siempre y en todos tus dispositivos (se sincroniza). **Tus alimentos
   tienen prioridad sobre el diccionario**, así que también sirven para corregir un valor que no te cierra
   (por ejemplo, guardando «Milanesa» con las kcal de las que hacés vos).

La lista de **Mis alimentos** está en Salud, para editarlos o borrarlos.

## Qué se guarda

Cada carga es una comida (`FoodEntry`) con el total de kcal, el texto como etiqueta y el detalle por línea
(`items`: texto, alimento, gramos y kcal). En la lista de hoy tocás la comida para ver el detalle.
El modo **Solo kcal** sigue estando para cargar un número directo.

## Para desarrollar

- Diccionario: `src/domain/foods.ts` (dato puro: kcal cada 100 g o 100 ml, alias y pesos por unidad casera).
  `foods.test.ts` verifica que ningún nombre o alias choque con otro.
- Parser, búsqueda y cálculo: `src/domain/foodLog.ts` (+ `foodLog.test.ts`). Nunca tira error con lo
  que escriba el usuario: devuelve líneas sin resolver con un motivo.
- UI: `src/ui/screens/FoodLog.tsx`.
