# Pruebas realizadas y estado (20/11/2026)

## Automáticas (Playwright, datos sintéticos)
`node hq/pruebas/probar.js` → **78/78 OK, sin errores JS** en tres ejecuciones seguidas.
`node hq/pruebas/probar-pwa.js` (con el repo servido en 127.0.0.1:8765) → **7/7 OK**.

Cubren, en Pixel 7 (Android) e iPhone 13 emulados, en 320 px y en escritorio de 1366 px:
- Navegación inferior y lateral, sin scroll horizontal en ningún módulo.
- Tareas: lenguaje natural (fecha, hora en hora de Chile, prioridad), crear, completar, comentar.
- Proyectos: crear, tareas asociadas, notas, archivos, historial, eliminar con confirmación conservando las tareas.
- AI Command Center: estado «completado» con la acción real listada. Un comando que necesita el PC sin puente configurado queda en «Pendiente de configuración» (no se simula).
- Content Factory: tablero, copiar hashtags, estadísticas por conector, editor heredado.
- Calendario: agenda combinada (IACC, tareas, Google), turnos 7x7, vista mensual, crear evento, cuenta regresiva IACC.
- PC: sin agente no muestra métricas; orden enviada queda «esperando» y no se marca completada; con estado del agente muestra métricas.
- Automatizaciones: activar o desactivar con confirmación; reglas internas guardadas.
- Notificaciones: tarea vencida y automatización con error generadas; marcar todo como leído.
- Respaldo JSON, registro de acciones con dispositivo.
- **Sincronización:** tarea creada en el celular aparece en el PC; proyecto creado en el PC aparece en el celular; estado de video cambiado en el PC se ve en el celular.
- Sin acceso a datos: aviso claro, sin datos inventados.
- PWA: Service Worker, manifest, iconos, aviso sin conexión, apertura automática al estar instalada.

Límite de estas pruebas: usan una simulación de `window.claude`. Validan la lógica de la app, no los servidores de claude.ai.

## Sobre los datos reales (publicación v3)
- Antes de publicar: respaldo completo de `videos` (10), `estudios` (13), `clips` (0) y `meta` (2).
- Después de publicar: `videos` y `estudios` **idénticos byte a byte** al respaldo.
- Reglas de acceso: una escritura como usuario no dueño fue **rechazada**.
- Agente del PC: probado en Linux (estado, rechazo de acciones deshabilitadas o desconocidas, registro). **No probado en Windows.**

## Lo que no pude probar yo
- Abrir la app publicada con tu sesión en un teléfono físico (Android o iPhone) e instalarla desde la pantalla de inicio.
- Los permisos reales de Claude y conectores dentro de claude.ai, y las respuestas reales de Claude a comandos.
- El puente real con tu PC (requiere Remote Control activo en tu PC).

## Integraciones pendientes
| Integración | Qué falta | Quién |
|---|---|---|
| Puente PC | Instalar agente, activar Remote Control y elegir la sesión en PC Control | Tú, en el PC (≈10 min) |
| Turnos 7x7 | Indicar el primer día de un bloque de trabajo en Calendario → Turnos | Tú |
| Notificaciones push con la app cerrada | Servicio Web Push (claves VAPID + servidor/función). El Service Worker ya maneja `push` y abre la app al tocar | Pendiente de decidir hosting |
| Métricas de TikTok e Instagram | Conectar esas cuentas a vidIQ o Metricool | Tú |
| Publicar desde la app | No se implementó a propósito: requiere tu aprobación manual | — |
| Estado periódico del PC | Tarea programada local en Claude de escritorio (ver README del agente) | Opcional |
