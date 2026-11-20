# Ideas (no implementadas: anotadas para decidir después)

- **Panel anual** (fase 2): tarjetas por mes y gráfico de área. `yearStats` ya está hecho y testeado en `src/domain/habits.ts`; falta la pantalla.
- **Burn-up del plan** (fase 2): plan original acumulado (gris punteado), real (verde) y proyección (verde claro). `projectSchedule` y `computeAmountMetrics` ya están, falta el gráfico.
- **Exportar a CSV** la grilla de hábitos y los ítems de un plan (fase 2 del brief).
- **Dictado con IA** (opcional): hoy el separador es por reglas. Con un modelo se podrían detectar fechas ("mañana", "el jueves") y agrupar mejor.
- **Login con Google** para la compu (en el iPhone instalado conviene seguir con mail y contraseña).
- **Tareas de otros días:** hoy el dictado carga en el día de hoy. Se podría elegir la fecha o pasar las no hechas al día siguiente.
- **Segundo recordatorio a la noche:** "Te faltan 2 hábitos".
- **Separar Recharts en otro chunk** (`import()` dinámico) para que la primera carga sea más liviana: el bundle principal pesa unos 800 kB.
- **Sincronización en tiempo real** con Supabase Realtime en lugar de consultar cada minuto y al volver a la app.
- **Metas semanales en la vista del mes:** hoy el "% por hábito" del mes muestra "—" para las metas semanales. Se podría mostrar "3 de 4 semanas cumplidas".
- **Salud, más adelante:** macros (proteínas, carbohidratos y grasas) en el diccionario, lector de código de barras, IMC con la altura, recordatorio para pesarse.
- **Comidas escritas, mejoras posibles:** separar por «con» de forma inteligente («milanesa con puré» sin romper «café con leche»); ignorar verbos del dictado («comí», «almorcé»); números en palabras más allá de diez y «un cuarto (kilo)», «docena», «puñado», «lata», «copa» como unidades; dictado con IA para frases libres; mostrar «ml» en el detalle guardado de las bebidas (hoy el detalle dice «g», con 1 ml ≈ 1 g); sugerir el alimento más usado o repetir una comida de otro día; editar una comida ya cargada.
- **Recordatorio de hábitos por momento del día:** un aviso a la mañana, otro a la tarde y otro a la noche, cada uno con los hábitos de ese momento.
