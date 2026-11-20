// Pruebas funcionales de BWISIOM HQ con datos SINTÉTICOS (no son tus datos reales).
// Uso: node hq/pruebas/probar.js [carpeta_capturas]
const { chromium, devices } = require("playwright");
const path = require("path"), fs = require("fs");
const ROOT = path.resolve(__dirname, "..", "..");
// claude.ai envuelve la página con este esqueleto al publicarla; lo replicamos para probar igual.
const WRAP = path.join(__dirname, ".vista-previa.html");
fs.writeFileSync(WRAP, '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync(path.join(ROOT, "hq/fuente/bwisiom-hq.html"), "utf8") + "</body></html>");
const PAGE = "file://" + WRAP;
const MOCK = fs.readFileSync(path.join(__dirname, "mock-claude.js"), "utf8");
const OUT = process.argv[2] || path.join(__dirname, "capturas");
process.on("unhandledRejection", () => {});
fs.mkdirSync(OUT, { recursive: true });
const iso = d => new Date(Date.now() + d * 864e5).toISOString();
const dk = d => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date(Date.now() + d * 864e5));
const SEED = {
  "videos/C-9001": { codigo: "C-9001", titulo: "Video de prueba publicado", etapa: "publicado", categoria: "gaming", gancho: "PRUEBA", orden: 0,
    plataformas: { youtube: { estado: "subido", fecha: iso(-1), titulo: "Video de prueba", hashtags: "#prueba #test", url: "https://example.com" }, x: { estado: "listo", descripcion: "Texto X" }, tiktok: { estado: "programado", fecha: iso(2) } } },
  "videos/C-9002": { codigo: "C-9002", titulo: "Idea de prueba", etapa: "idea", redes: ["youtube"], orden: 1 },
  "estudios/ev-1": { asignatura: "Asignatura de prueba", codigo: "TST101", titulo: "Tarea 1", cierre: iso(1.5), estado: "pendiente", accion: "Subir PDF", peso: "10 %" },
  "estudios/ev-2": { asignatura: "Asignatura de prueba", codigo: "TST101", titulo: "Tarea 0", cierre: iso(-5), estado: "entregado" },
  "tareas/t-venc": { titulo: "Tarea vencida de prueba", prioridad: "alta", estado: "pendiente", fecha_limite: iso(-1), creado: iso(-3) },
  "meta/info": { actualizado: "hoy (prueba)", nota_videos: "Nota de prueba de videos." },
  "meta/config": { redes: ["youtube", "tiktok", "instagram", "x"] },
  "meta/feriados": { fuente: "prueba", lista: [{ fecha: dk(1), nombre: "Feriado prueba día" }, { fecha: dk(13), nombre: "Feriado prueba noche" }, { fecha: dk(5), nombre: "Feriado en descanso" }] },
};
const results = []; const ok = (name, cond, extra = "") => { results.push([cond ? "OK " : "FALLA", name, extra]); };
const errors = [];

async function newPage(ctx, label) {
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(label + ": " + e.message));
  p.on("console", m => { if (m.type() === "error" && !/fonts.googleapis|ERR_|net::/.test(m.text())) errors.push(label + " console: " + m.text()); });
  await p.addInitScript(s => { if (!localStorage.getItem("mdb:__seed")) { for (const k in s) localStorage.setItem("mdb:" + k, JSON.stringify(s[k])); localStorage.setItem("mdb:__seed", "1"); } }, SEED);
  await p.addInitScript(MOCK);
  return p;
}
const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + ".png"), fullPage: false });

(async () => {
  const browser = await chromium.launch(); global.__b = browser;
  for (const [devName, dev] of [["android", devices["Pixel 7"]], ["iphone", devices["iPhone 13"]]]) {
    const ctx = await browser.newContext({ ...dev, timezoneId: "America/Santiago", locale: "es-CL" });
    const p = await newPage(ctx, devName);
    await p.goto(PAGE);
    await p.waitForSelector("#splash", { state: "detached", timeout: 8000 });
    await p.waitForFunction(() => document.querySelector("#syncTxt").textContent === "En vivo");
    const T = devName + " · ";
    ok(T + "Inicio carga con datos", await p.waitForSelector("text=Próximas actividades", { timeout: 4000 }).then(() => true, () => false));
    ok(T + "Navegación inferior visible", await p.locator("nav.bottom").isVisible());
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    ok(T + "Sin scroll horizontal en Inicio", !overflow);
    await shot(p, devName + "-01-inicio");

    // Tareas: lenguaje natural
    await p.click("nav.bottom [data-go=tareas]");
    await p.fill("#tIn", "Grabar Short de prueba mañana a las 18:00 urgente");
    const prev = await p.textContent("#tPrev");
    ok(T + "Vista previa interpreta fecha y prioridad", /18:00/.test(prev) && /alta/i.test(prev), prev);
    await p.click("#tAdd");
    await p.waitForSelector("text=Grabar Short de prueba");
    ok(T + "Tarea creada desde el celular", true);
    await shot(p, devName + "-02-tareas");
    await p.locator(".item", { hasText: "Grabar Short de prueba" }).locator("[data-tchk]").click();
    await p.waitForTimeout(300);
    await p.click("[data-tf=completadas]");
    ok(T + "Tarea marcada como completada", await p.locator(".item.done", { hasText: "Grabar Short de prueba" }).isVisible());
    // Detalle + comentario
    await p.click("[data-tf=todas]");
    await p.locator(".item", { hasText: "Tarea vencida de prueba" }).locator(".b").click();
    await p.fill("#cIn", "Comentario de prueba"); await p.click("#cAdd");
    await p.waitForSelector("text=Comentario de prueba");
    ok(T + "Comentario agregado a tarea", true);
    await p.click("[data-close]");

    // Proyectos
    await p.click("nav.bottom [data-go=mas]"); await p.click(".menu-grid [data-go=proyectos]");
    await p.click("#pNew"); await p.fill("#f_nombre", "Proyecto de prueba"); await p.fill("#f_descripcion", "Descripción"); await p.click("#pSave");
    await p.waitForSelector("text=Proyecto de prueba");
    await p.click("[data-popen]");
    await p.fill("#ptIn", "Subtarea de prueba"); await p.click("#ptAdd");
    await p.waitForSelector("#edBody >> text=Subtarea de prueba");
    await p.fill("#pnIn", "Nota de prueba"); await p.click("#pnAdd");
    await p.waitForSelector("#edBody >> text=Nota de prueba");
    await p.fill("#paIn", "01_STUDIO/prueba.mp4"); await p.click("#paAdd");
    await p.waitForSelector("#edBody >> text=01_STUDIO/prueba.mp4");
    ok(T + "Proyecto: tareas, notas y archivos", true);
    ok(T + "Proyecto: historial registra cambios", await p.locator("#edBody >> text=Archivo agregado").isVisible());
    await shot(p, devName + "-03-proyecto");
    await p.click("#pDel");
    ok(T + "Eliminar pide confirmación", /tareas se conservan|otra vez/.test(await p.textContent("#pDel")));
    await p.click("#pDel");
    await p.waitForSelector("text=Aún no tienes proyectos propios");
    const sub = await p.evaluate(() => Object.values(window.__mockDump()).find(d => d.titulo === "Subtarea de prueba"));
    ok(T + "Al eliminar proyecto, sus tareas se conservan sin proyecto", sub && !sub.proyecto);

    // Comando IA
    await p.click("nav.bottom [data-go=comando]");
    await p.fill("#cmdIn", "Organiza mis tareas pendientes"); await p.click("#cmdGo");
    await p.waitForSelector(".cmd .pill.st-completado", { timeout: 5000 });
    ok(T + "Comando: estado completado", true);
    ok(T + "Comando: muestra acción real ejecutada", await p.locator(".cmd >> text=Tarea creada").first().isVisible());
    await shot(p, devName + "-04-comando");
    await p.fill("#cmdIn", "Optimiza mi PC para Valorant"); await p.click("#cmdGo");
    await p.waitForSelector(".cmd .pill.st-pendiente_config", { timeout: 5000 });
    ok(T + "Comando que requiere PC sin puente: «pendiente de configuración», no simulado", true);

    // Contenido
    await p.click("nav.bottom [data-go=contenido]");
    ok(T + "Tablero de producción", await p.waitForSelector(".col[data-k=listo] >> text=Video de prueba publicado", { timeout: 4000 }).then(() => true, () => false));
    await shot(p, devName + "-05-contenido");
    await p.click("[data-sub='contenido:redes']");
    ok(T + "Redes: botón copiar hashtags", await p.locator("text=Copiar hashtags").first().isVisible());
    await p.click("[data-sub='contenido:stats']");
    await p.waitForSelector("text=Canal de prueba");
    ok(T + "Estadísticas vía conector (vidIQ)", true);
    await p.click("[data-sub='contenido:videos']");
    await p.locator("[data-ed=videos]").first().click();
    await p.fill("#f_titulo", "Video de prueba publicado (editado)"); await p.click("#edSave");
    await p.waitForSelector("text=Video de prueba publicado (editado)");
    ok(T + "Editor heredado de videos guarda", true);

    // Calendario
    await p.click("nav.bottom [data-go=mas]"); await p.click(".menu-grid [data-go=calendario]");
    await p.waitForSelector("text=Evento Google de prueba");
    ok(T + "Agenda combina IACC, tareas y Google Calendar", await p.locator(".ag >> text=Tarea 1").isVisible());
    await p.click("[data-sub='calendario:turnos']");
    ok(T + "Turnos sin configurar: aviso pendiente", await p.locator("text=Pendiente de configuración").first().isVisible());
    const d0 = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
    await p.fill("#f_tu_inicio", d0); await p.click("#tuSave");
    await p.waitForSelector("text=Turno día · día 3 de 7 · 08:00–20:00");
    ok(T + "Turnos 7x7 calculados (día, horario)", true);
    // inicio = hace 2 días (día). dk(1) = turno día (12 h). dk(13) = noche: turnos que empiezan dk(12) [00–08] y dk(13) [20–24] = 12 h. dk(5) = descanso.
    ok(T + "Feriado en turno día: 12 h", await p.locator(".item", { hasText: "Feriado prueba día" }).locator("text=12 h").first().isVisible());
    ok(T + "Feriado en turno noche: suma 00–08 y 20–24 (12 h)", await p.locator(".item", { hasText: "Feriado prueba noche" }).locator("text=12 h").first().isVisible());
    ok(T + "Feriado en descanso no se cuenta", !(await p.locator(".list .item", { hasText: "Feriado en descanso" }).locator(".pill").count()));
    ok(T + "Turnos alternan: próximo bloque es noche 20:00–08:00", await p.locator(".item", { hasText: "Entra turno noche" }).first().locator("text=20:00–08:00").isVisible());
    await p.click("[data-sub='calendario:mes']");
    ok(T + "Vista mensual con días de turno", (await p.locator(".month button.work").count()) >= 7);
    await p.click("[data-mm='1']");
    ok(T + "Mes siguiente marca turnos de noche", (await p.locator(".month button.work.night").count()) >= 5);
    await p.click("[data-mm='-1']");
    await shot(p, devName + "-06-calendario");
    await p.click("#fab"); await p.fill("#f_titulo", "Evento de prueba"); await p.fill("#f_inicio", new Date(Date.now() + 864e5).toISOString().slice(0, 16)); await p.click("#eSave");
    await p.waitForTimeout(300);
    ok(T + "Evento creado", await p.evaluate(() => Object.values(window.__mockDump()).some(d => d.titulo === "Evento de prueba")));
    await p.click("[data-sub='calendario:estudios']");
    ok(T + "IACC: cuenta regresiva", await p.locator("#count b").first().isVisible());

    // PC
    await p.click("nav.bottom [data-go=mas]"); await p.click(".menu-grid [data-go=pc]");
    await p.waitForSelector("text=PC Control Center");
    ok(T + "PC sin agente: no muestra métricas inventadas", (await p.locator(".meter").count()) === 0 && await p.locator(".cfg >> text=Falta conectar el PC").isVisible());
    await p.click("#pcPick"); await p.click("[data-ses=session_pc]");
    await p.waitForSelector("text=PC principal BWISIOM");
    await p.click("[data-pcact=estado]");
    await p.waitForSelector(".cmd .pill.st-esperando_pc");
    ok(T + "Orden al PC enviada y en espera (no se marca completada)", true);
    const sent = await p.evaluate(() => window.__calls.find(c => c[1] === "send_message"));
    ok(T + "Orden contiene id y regla de lista autorizada", sent && /acciones_autorizadas/.test(sent[2].message));
    await p.evaluate(() => { window.__mockSet("pc/estado", { host: "PC-PRUEBA", online: true, actualizado: new Date().toISOString(), cpu: { uso: 37, temp: 55 }, gpu: { uso: 12, temp: 48, nombre: "GPU prueba" }, ram: { uso: 61, usada_gb: 9.8, total_gb: 16 }, discos: [{ nombre: "C:", uso: 70, libre_gb: 120, total_gb: 476 }], obs: { conectado: true, grabando: false }, procesos: [{ nombre: "obs64.exe", activo: true }] }); });
    await p.waitForSelector("text=PC-PRUEBA · En línea", { timeout: 6000 });
    ok(T + "PC con datos reales del agente: métricas visibles", await p.locator(".meter >> text=37").isVisible());
    await shot(p, devName + "-07-pc");

    // Automatizaciones
    await p.click("nav.bottom [data-go=mas]"); await p.click(".menu-grid [data-go=automatizaciones]");
    await p.waitForSelector("text=Automatización de prueba");
    await p.click("[data-trtog=trig_test]"); await p.click("#acOk");
    await p.waitForTimeout(200);
    ok(T + "Activar/desactivar automatización con confirmación", await p.evaluate(() => window.__calls.some(c => c[1] === "update_trigger" && c[2].enabled === false)));
    await p.click("[data-rg=iacc]"); await p.waitForTimeout(200);
    ok(T + "Regla interna se guarda", await p.evaluate(() => window.__mockDump()["meta/reglas"]?.iacc === false));
    await shot(p, devName + "-08-automatizaciones");

    // Notificaciones (reglas internas a los 8 s)
    await p.waitForTimeout(8500);
    await p.click("#bellBtn"); await p.waitForSelector("text=Notifications Center");
    ok(T + "Notificación de tarea vencida generada", await p.locator(".item >> text=Tarea vencida").first().isVisible());
    ok(T + "Notificación de automatización con error", await p.locator(".item >> text=Automatización con error").first().isVisible());
    await shot(p, devName + "-09-notificaciones");
    await p.click("#nAll"); await p.waitForTimeout(300);
    ok(T + "Marcar todo como leído", await p.locator("#bellBadge").isHidden());

    // Ajustes / respaldo / registro
    await p.click("nav.bottom [data-go=mas]"); await p.click(".menu-grid [data-go=ajustes]");
    await p.click("#bkp"); await p.waitForTimeout(400);
    ok(T + "Respaldo JSON descargable", await p.evaluate(() => window.__calls.some(c => c[0] === "download")));
    await p.click("[data-sub='ajustes:registro']");
    ok(T + "Registro de acciones con dispositivo", (await p.locator(".item >> text=móvil").count()) > 3);
    for (const v of ["inicio", "tareas", "comando", "contenido", "calendario", "pc", "automatizaciones", "notificaciones", "ajustes"]) {
      await p.evaluate(v => location.hash = "#/" + v, v); await p.waitForTimeout(150);
      const of = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (of) ok(T + "Sin scroll horizontal en " + v, false);
    }
    ok(T + "Sin scroll horizontal en ningún módulo", !results.some(r => r[0] !== "OK " && r[1].startsWith(T + "Sin scroll horizontal en ")));
    await ctx.close();
  }

  // Pantalla pequeña 320px
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const p = await newPage(ctx, "320px");
    await p.goto(PAGE);
    await p.waitForSelector("#splash", { state: "detached" });
    let bad = [];
    for (const v of ["inicio", "tareas", "comando", "contenido", "calendario/mes", "pc", "automatizaciones", "notificaciones", "ajustes"]) {
      await p.evaluate(v => location.hash = "#/" + v, v); await p.waitForTimeout(200);
      if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) bad.push(v);
    }
    ok("320px · sin scroll horizontal", !bad.length, bad.join(","));
    await p.evaluate(() => location.hash = "#/inicio"); await p.waitForTimeout(200); await shot(p, "320-inicio");
    await ctx.close();
  }

  // Sincronización PC <-> celular (dos dispositivos, mismos datos)
  {
    const ctx = await browser.newContext();
    const pc = await newPage(ctx, "escritorio");
    await pc.setViewportSize({ width: 1366, height: 860 });
    await pc.goto(PAGE);
    const phone = await newPage(ctx, "celular");
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.goto(PAGE + "#/tareas");
    await pc.waitForSelector("#splash", { state: "detached" }); await phone.waitForSelector("#splash", { state: "detached" });
    ok("Escritorio · barra lateral visible", await pc.locator("aside.side").isVisible());
    await pc.evaluate(() => location.hash = "#/tareas");
    await phone.waitForFunction(() => document.querySelector("#syncTxt").textContent === "En vivo");
    await pc.waitForFunction(() => document.querySelector("#syncTxt").textContent === "En vivo");
    await phone.fill("#tIn", "Tarea desde el celular"); await phone.click("#tAdd");
    await pc.waitForSelector("text=Tarea desde el celular", { timeout: 4000 });
    ok("Sync · tarea creada en celular aparece en PC", true);
    await pc.evaluate(() => location.hash = "#/proyectos");
    await pc.click("#pNew"); await pc.fill("#f_nombre", "Proyecto desde el PC"); await pc.click("#pSave");
    await phone.evaluate(() => location.hash = "#/proyectos");
    await phone.waitForSelector("text=Proyecto desde el PC", { timeout: 4000 });
    ok("Sync · proyecto creado en PC aparece en celular", true);
    await pc.evaluate(() => location.hash = "#/contenido");
    await pc.locator(".vcard", { hasText: "C-9001" }).first().locator("[data-ed=videos]").click();
    await pc.selectOption("#f_st_x", "subido"); await pc.click("#edSave");
    await phone.evaluate(() => location.hash = "#/contenido");
    await phone.waitForFunction(() => [...document.querySelectorAll(".col[data-k=subido] .vcard")].some(c => /X/.test(c.textContent)), null, { timeout: 4000 });
    ok("Sync · estado de video actualizado en PC se ve en celular", true);
    await shot(pc, "escritorio-contenido");
    await pc.evaluate(() => location.hash = "#/inicio"); await pc.waitForTimeout(300); await shot(pc, "escritorio-inicio");
    await ctx.close();
  }

  // Recuperación ante errores: sin datos
  {
    const ctx = await browser.newContext({ ...devices["Pixel 7"] });
    const p = await ctx.newPage(); p.on("pageerror", e => errors.push("sin-datos: " + e.message));
    await p.addInitScript("window.__noData=true;" + MOCK);
    await p.goto(PAGE); await p.waitForTimeout(1200);
    ok("Sin acceso a datos: aviso claro, sin datos inventados", await p.locator("text=Abre BWISIOM HQ con tu cuenta de Claude").isVisible());
    await ctx.close();
  }
  await browser.close();
  for (const r of results) console.log(r.join("  "));
  console.log("\nErrores JS:", errors.length ? "\n" + errors.join("\n") : "ninguno");
  const fails = results.filter(r => r[0] !== "OK ").length;
  console.log(`\n${results.length - fails}/${results.length} pruebas OK`);
  process.exit(fails || errors.length ? 1 : 0);
})().catch(async e => { console.error(String(e).slice(0,400)); try { for (const ctx of (global.__b?.contexts?.() || [])) for (const pg of ctx.pages()) await pg.screenshot({ path: path.join(OUT, "fallo.png") }); } catch (x) {} for (const r of results) console.log(r.join("  ")); console.log(errors.join("\n")); process.exit(2); });
