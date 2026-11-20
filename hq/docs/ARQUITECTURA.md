# BWISIOM HQ MOBILE: documentación técnica

## 1. Auditoría de lo que existía (20/11/2026)

| Elemento | Estado encontrado |
|---|---|
| App | **BWISIOM HQ Control**: una página en Claude Artifacts (`claude.ai/artifact/VdJfCcvH4SEFDKABrrFVru`) |
| Módulos | Videos (tablero por estado), Redes (vista por red con «copiar texto»), Clips del PC, Estudios IACC (cuenta regresiva + calendario), editor lateral, búsqueda |
| Datos | Base de datos del artifact (capacidad `db`), en vivo con `onSnapshot`. Colecciones: `videos` (10), `estudios` (13), `clips` (0), `meta/info`, `meta/config` |
| Permisos | Regla `{path:"", read:"view", write:"admin"}`: solo el dueño escribe |
| Faltaba | Proyectos, tareas, calendario general, turnos 7x7, comandos IA, PC, automatizaciones, notificaciones, registro de acciones, instalación como app |
| Límites | claude.ai no deja incrustar el artifact en otro sitio (`frame-ancestors 'self'`) y su base de datos solo la lee su propia página |

Antes de cambiar nada se hizo un respaldo completo de todas las colecciones.

## 2. Decisión de arquitectura: una sola app y una sola base de datos

Como los datos solo son accesibles desde la página del artifact, la forma de tener **la misma información en PC y celular, sin duplicar** es
ampliar **el mismo artifact** (misma URL, misma base de datos) para que sea adaptable:

- **≥ 900 px (PC):** barra lateral con todos los módulos (etiqueta DESKTOP).
- **< 900 px (celular):** barra superior, navegación inferior para una mano (Inicio · Tareas · **Comando** · Contenido · Más), hojas que suben desde abajo y botón flotante (etiqueta MOBILE).

Se conservaron todos los módulos y datos anteriores. Videos, Redes, Clips, Estudios y el editor siguen con la misma lógica y los mismos campos; las URL antiguas (`#videos`, `#redes`, `#clips`, `#estudios`) redirigen a su nuevo lugar.

```
           ┌────────────── claude.ai (autenticación, HTTPS) ──────────────┐
 Celular ──┤  BWISIOM HQ (artifact)  ◀── onSnapshot en vivo ──▶  Base db    ├── PC (navegador)
 (PWA)     │   ├ sample  → Claude (AI Command Center, con herramientas)    │
           │   ├ mcp     → Claude Code Remote · Google Calendar · vidIQ    │
           │   └ downloads → respaldo JSON                                 │
           └───────────────────────────────────────────────────────────────┘
 bwisiom.github.io/hq/  = PWA instalable (icono, carga, Service Worker) que abre la app
 PC principal: Claude Code + Remote Control (saliente) + bwisiom_pc_agent.py (lista blanca)
```

### Por qué no un backend propio (Supabase/Firebase) ahora
Obligaría a migrar los datos fuera de claude.ai y a reescribir el escritorio para leerlos desde allí, crear cuentas y guardar claves. La base actual ya da autenticación, permisos, tiempo real y respaldo sin claves en el código. Si más adelante necesitas push nativo o acceso sin claude.ai, el respaldo JSON permite migrar.

## 3. Modelo de datos

Existentes (sin cambios de formato): `videos/{C-XXXX}`, `estudios/{id}`, `clips/{K-XXXX}`, `meta/info`, `meta/config`.

Nuevos:
| Ruta | Contenido |
|---|---|
| `proyectos/{p-…}` | nombre, descripcion, estado (activo/pausado/completado), fecha_objetivo, progreso manual, notas[], archivos[], historial[] |
| `tareas/{t-…}` | titulo, prioridad, fecha_limite, recordatorio, proyecto, estado, completada_en, comentarios[], notas, origen |
| `eventos/{e-…}` | titulo, tipo, inicio, fin, todo_el_dia, lugar, notas, gcal_id |
| `comandos/{c-…}` | texto, tipo (ia/pc), estado (pendiente/ejecutando/completado/fallido/esperando_pc/pendiente_config), respuesta, acciones[], error |
| `notificaciones/{clave}` | titulo, cuerpo, tipo, leida, archivada, creado. La clave es determinística para no duplicar avisos |
| `registro/{auto}` | accion, detalle, tipo, fecha, dispositivo |
| `meta/turnos` | inicio, dias_trabajo, dias_descanso, horario, lugar |
| `meta/reglas` | reglas internas activas |
| `meta/pc` | sesion_id y título de la sesión de Claude Code del PC |
| `pc/estado` | lo escribe el PC: host, cpu, gpu, ram, discos, obs, procesos, acciones_autorizadas, actualizado |

Todas las escrituras guardan `actualizado` y `dispositivo` («móvil», «escritorio», «(app)»).

## 4. Módulos

- **Inicio:** estado de sincronización, PC, automatizaciones, KPI, próximas actividades (7 días), notificaciones y últimas modificaciones.
- **AI Command Center:** usa `sample` (Claude en tu cuenta) con herramientas reales de la página: crear o actualizar tareas, crear proyectos y notas, crear eventos, leer estadísticas (vidIQ) y enviar órdenes al PC. Cada comando se guarda con su estado real y la lista de acciones ejecutadas. La IA no tiene herramientas para borrar ni para publicar.
- **Tareas:** entrada en lenguaje natural (hoy, mañana, pasado mañana, días de la semana, dd/mm, «en N días», «a las 18:00», urgente/baja, #proyecto), con vista previa. Filtros Pendientes/Hoy/Vencidas/Completadas, agrupar por proyecto, comentarios, recordatorios.
- **Proyectos:** CRUD con tareas asociadas, notas, archivos (rutas o enlaces), historial y eliminación confirmada (las tareas se conservan). Content Factory e IACC aparecen como proyectos del sistema, calculados con datos reales.
- **Content Factory:** Producción (tablero), Redes (copiar texto y hashtags), Clips, Ideas y Estadísticas (vidIQ). No publica ni borra nada sin tu acción.
- **Calendario:** Agenda de 31 días, Mes, IACC y Turnos 7x7. Une eventos, IACC, tareas, publicaciones programadas, turnos y Google Calendar (lectura y creación opcional).
- **PC Control:** métricas solo si el agente reportó; indica antigüedad; acciones remotas por el puente.
- **Automatizaciones:** tareas programadas reales de Claude (listar, activar o desactivar con confirmación, ejecutar ahora, crear) y reglas internas.
- **Notificaciones:** centro sincronizado; marcar leídas y archivar. Push nativo pendiente.
- **Conexiones y seguridad:** estado de cada integración, instalación, seguridad, registro y respaldo JSON.

Las horas siempre se interpretan y muestran en hora de Chile (America/Santiago), aunque el dispositivo esté en otra zona.

## 5. Seguridad

Autenticación y cifrado: los da claude.ai (cuenta y HTTPS). Permisos: escribe solo el dueño (`write: admin`). No hay credenciales en el código: los conectores usan los tokens guardados en claude.ai y la página nunca los ve. Las acciones destructivas piden un segundo toque o una hoja de confirmación. Todo queda en `registro`. PC: sin puertos abiertos y con lista blanca. Teléfono: no se accede a nada fuera de BWISIOM HQ.

## 6. Archivos de este repositorio

| Ruta | Qué es |
|---|---|
| `hq/index.html`, `hq/manifest.webmanifest`, `hq/sw.js`, `hq/icons/` | PWA instalable |
| `hq/fuente/bwisiom-hq.src.html` | Código fuente de la app (artifact) |
| `hq/fuente/build.py` → `hq/fuente/bwisiom-hq.html` | Inserta el logo y genera la página que se publica |
| `hq/agente-pc/` | Agente local del PC y su lista blanca |
| `hq/pruebas/` | Pruebas automáticas (Playwright con datos sintéticos) |
| `hq/docs/` | Esta documentación |

Para publicar cambios: edita la fuente, ejecuta `python3 hq/fuente/build.py`, ejecuta las pruebas (`node hq/pruebas/probar.js`) y pide a Claude que republique `hq/fuente/bwisiom-hq.html` en la misma URL del artifact.
