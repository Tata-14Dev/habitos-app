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
