// Prueba de la PWA (requiere servir el repositorio: python3 -m http.server 8765 --bind 127.0.0.1)
// Uso: node hq/pruebas/probar-pwa.js [captura.png]
const { chromium, devices } = require("playwright");
const BASE = "http://127.0.0.1:8765/hq/";
(async () => {
  const b = await chromium.launch(); const out = [];
  const ok = (n, c, x = "") => out.push([c ? "OK " : "FALLA", n, x]);
  const c = await b.newContext({ ...devices["Pixel 7"] }); const p = await c.newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const m = await (await fetch("manifest.webmanifest")).json();
    const icons = await Promise.all(m.icons.map(i => fetch(i.src).then(x => x.status)));
    return { sw: !!(reg && (reg.active || reg.installing || reg.waiting)), m, icons, how: !document.querySelector("#howto").hidden };
  });
  ok("Service Worker registrado", r.sw);
  ok("Manifest válido (nombre, standalone, scope)", r.m.name === "BWISIOM HQ MOBILE" && r.m.display === "standalone" && r.m.scope === "/hq/");
  ok("Iconos 192/512 y maskable accesibles", r.icons.every(s => s === 200), r.icons.join(","));
  ok("En navegador muestra instrucciones de instalación", r.how);
  if (process.argv[2]) await p.screenshot({ path: process.argv[2] });
  await c.setOffline(true); await p.reload(); await p.waitForTimeout(800);
  ok("Sin conexión: abre desde caché y avisa", await p.locator("#offline").isVisible());
  await c.setOffline(false);
  // Simula app instalada: debe dirigir al centro de control (se detecta la navegación sin cargar claude.ai).
  const c2 = await b.newContext({ ...devices["Pixel 7"] }); const p2 = await c2.newPage();
  await p2.addInitScript(() => { const o = window.matchMedia.bind(window); window.matchMedia = q => q.includes("standalone") ? { matches: true, addEventListener() {} } : o(q); });
  const nav = p2.waitForRequest(/claude\.ai\/artifact\//, { timeout: 5000 }).then(() => true, () => false);
  await p2.goto(BASE + "?app=1");
  ok("Instalada: abre BWISIOM HQ automáticamente", await nav);
  ok("Sin errores JS", !errs.length, errs.join(" | "));
  await b.close();
  out.forEach(x => console.log(x.join("  ")));
  process.exit(out.some(x => x[0] !== "OK ") ? 1 : 0);
})();
