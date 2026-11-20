# Conectar el PC principal a BWISIOM HQ

El celular **nunca** se conecta directamente al PC y **no se abre ningún puerto**. El puente funciona así:

```
Celular (BWISIOM HQ)  ──send_message──▶  Sesión de Claude Code en tu PC (Remote Control, conexión SALIENTE cifrada)
                                                │
                                                ├─ python bwisiom_pc_agent.py <acción>   (solo lista autorizada)
                                                ▼
                                   Base de datos BWISIOM HQ (ArtifactData): pc/estado y comandos/<id>
                                                │
Celular y PC ven el resultado en vivo  ◀────────┘
```

## Instalación (una sola vez, en el PC principal)

1. Instala Python 3.9 o superior y luego:
   ```
   pip install psutil
   pip install obsws-python      (opcional: saber si OBS está grabando o transmitiendo)
   ```
2. Copia esta carpeta (`bwisiom_pc_agent.py` y `acciones_autorizadas.json`) a tu carpeta de BWISIOM HQ en el PC, por ejemplo `00_CENTRAL/AGENTE_PC/`.
3. Prueba el agente:
   ```
   python bwisiom_pc_agent.py estado
   ```
   Debe mostrar CPU, RAM, discos, GPU (si tienes NVIDIA y `nvidia-smi`) y OBS.
4. Revisa `acciones_autorizadas.json`. Todas las acciones vienen con `"habilitada": false`. Habilita solo las que quieras poder iniciar desde el celular. Agrega procesos a `procesos_vigilados` si quieres verlos.
5. Si usas obs-websocket con contraseña, guárdala como variable de entorno `OBS_WS_PASSWORD`. No la escribas en archivos.
6. Abre **Claude Code** en la carpeta de BWISIOM HQ del PC y activa **Remote Control** (en Claude Code: `/remote-control`, o desde la app de escritorio de Claude en Ajustes → Claude Code → Remote Control). Deja esa sesión abierta mientras quieras controlar el PC.
7. Agrega esto al `CLAUDE.md` de esa carpeta para que la sesión del PC sepa responder:

   ```markdown
   ## Órdenes de BWISIOM HQ (celular)
   Cuando llegue un mensaje que empiece con "[BWISIOM HQ · orden c-...]":
   - Ejecuta solo `python 00_CENTRAL/AGENTE_PC/bwisiom_pc_agent.py <acción>` con la acción indicada
     (estado | procesos | obs | grabaciones | registros | run <id>). Nada más.
   - Con ArtifactData sobre https://claude.ai/artifact/VdJfCcvH4SEFDKABrrFVru:
     - `set` del documento `pc/estado` con el JSON de `bwisiom_pc_agent.py estado`.
     - `update` de `comandos/<id>` con {estado: "completado" o "fallido", respuesta: resumen breve, actualizado: ISO}.
   - Si la orden pide algo que no está en la lista autorizada, no lo hagas: marca la orden "fallido" y explica por qué.
   ```
8. En el celular: **PC Control → Elegir sesión del PC** y selecciona la sesión de tu PC.
9. Pulsa **Consultar estado del PC**. La orden queda en «Enviado al PC · esperando» hasta que la sesión del PC responde, y luego pasa a «Completado» con las métricas reales.

## Estado periódico (opcional)

Para que el celular vea el PC actualizado sin pedirlo, crea en la app de escritorio de Claude una tarea programada local
(cada 15 o 30 minutos) con la instrucción: *«Ejecuta bwisiom_pc_agent.py estado y guarda el resultado en pc/estado de BWISIOM HQ»*.
Si el PC deja de reportar más de 15 minutos, BWISIOM HQ lo muestra como «Sin datos recientes» y avisa en Notificaciones. Nunca muestra cifras viejas como si fueran en vivo.

## Seguridad

- Sin puertos abiertos ni servidores: Remote Control es una conexión saliente y cifrada de Claude Code.
- El agente rechaza cualquier acción que no esté en `acciones_autorizadas.json` con `habilitada: true`, y lo deja en `bwisiom_agent.log`.
- Los comandos se ejecutan sin shell (`shell=False`), así no hay inyección de comandos.
- El agente no lee archivos personales, contraseñas ni otras apps, y no se conecta a Internet.
