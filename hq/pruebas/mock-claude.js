// Simulación de window.claude SOLO para pruebas locales (nunca se publica).
// Base de datos en localStorage: dos pestañas del mismo origen comparten datos y se notifican
// con el evento "storage", imitando la sincronización en vivo entre PC y celular.
(() => {
  const P = "mdb:", SEED = P + "__seed";
  const load = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(P) && k !== SEED) o[k.slice(P.length)] = JSON.parse(localStorage.getItem(k)); } return o; };
  let store = load();
  const write = path => path in store ? localStorage.setItem(P + path, JSON.stringify(store[path])) : localStorage.removeItem(P + path);
  const listeners = new Set();
  const notify = () => setTimeout(() => listeners.forEach(f => f()), 0);
  addEventListener("storage", e => { if (e.key && e.key.startsWith(P) && e.key !== SEED) { const path = e.key.slice(P.length); if (e.newValue == null) delete store[path]; else store[path] = JSON.parse(e.newValue); notify(); } });
  window.__mockDump = () => JSON.parse(JSON.stringify(store));
  window.__calls = [];
  const snapDoc = (path) => ({ id: path.split("/").pop(), exists: path in store, data: () => store[path] ? JSON.parse(JSON.stringify(store[path])) : undefined, metadata: { fromCache: false, hasPendingWrites: false } });
  const cleanUndef = o => JSON.parse(JSON.stringify(o));
  function docRef(path) {
    return {
      id: path.split("/").pop(), path,
      get: async () => snapDoc(path),
      set: async d => { store[path] = cleanUndef(d); write(path); notify(); },
      update: async d => { if (!(path in store)) throw { code: "not-found" }; store[path] = cleanUndef({ ...store[path], ...d }); write(path); notify(); },
      delete: async () => { delete store[path]; write(path); notify(); },
      onSnapshot: (next) => { const f = () => next(snapDoc(path)); listeners.add(f); setTimeout(f, 5); return () => listeners.delete(f); },
      collection: p => coll(path + "/" + p),
    };
  }
  function coll(path, q = {}) {
    const docs = () => {
      let ks = Object.keys(store).filter(k => k.startsWith(path + "/") && k.split("/").length === path.split("/").length + 1);
      let arr = ks.map(snapDoc);
      if (q.order) { const [f, dir] = q.order; arr = arr.filter(d => d.data()[f] !== undefined).sort((a, b) => String(a.data()[f]).localeCompare(String(b.data()[f])) * (dir === "desc" ? -1 : 1)); }
      if (q.lim) arr = arr.slice(0, q.lim);
      return arr;
    };
    const snap = () => { const d = docs(); return { docs: d, size: d.length, empty: !d.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => [] }; };
    return {
      path,
      where: () => coll(path, q),
      orderBy: (f, dir) => coll(path, { ...q, order: [f, dir] }),
      limit: n => coll(path, { ...q, lim: n }),
      get: async () => snap(),
      onSnapshot: next => { const f = () => next(snap()); listeners.add(f); setTimeout(f, 5); return () => listeners.delete(f); },
      doc: id => docRef(path + "/" + (id || Math.random().toString(36).slice(2))),
      add: async d => { const r = docRef(path + "/" + Math.random().toString(36).slice(2)); await r.set(d); return r; },
    };
  }
  const db = { collection: p => coll(p), doc: p => docRef(p) };
  window.__mockSet = (path, data) => { store[path] = data; write(path); notify(); };
  const sample = async (prompt, opts = {}) => {
    window.__calls.push(["sample", prompt.slice(-200)]);
    await new Promise(r => setTimeout(r, 300));
    if (opts.tools) {
      const t = opts.tools.find(x => x.name === "crear_tarea");
      await t.execute({ titulo: "Tarea creada por comando de prueba", prioridad: "alta" }, { signal: new AbortController().signal });
      if (/PC/i.test(prompt.slice(-120))) { const p = opts.tools.find(x => x.name === "enviar_al_pc"); await p.execute({ accion: "estado", instruccion: "Optimizar el PC" }, {}); }
    }
    const text = "Respuesta de prueba.\nAcciones: tarea creada.";
    opts.onText && opts.onText({ text, delta: text });
    return { text, truncated: false, modelTierApplied: "default" };
  };
  sample.limits = async () => ({ maxPromptBytes: 262144, tools: { maxCount: 16 } });
  const mcp = {
    callTool: async (server, tool, input) => {
      window.__calls.push([server, tool, input]);
      const P = payload => ({ content: [], payload });
      if (tool === "vidiq_user_channels") return P({ channels: [{ channelId: "UCtest", title: "Canal de prueba", handle: "@prueba", subscriberCount: 10, viewCount: 100, videoCount: 3 }] });
      if (tool === "list_events") return P({ events: [{ summary: "Evento Google de prueba", start: { dateTime: new Date(Date.now() + 2 * 864e5).toISOString() } }] });
      if (tool === "create_event") return P({ id: "gcal123" });
      if (tool === "list_triggers") return P({ data: [{ id: "trig_test", name: "Automatización de prueba", cron_expression: "CRON_TZ=America/Santiago 0 9 * * *", enabled: true, next_run_at: new Date(Date.now() + 864e5).toISOString(), last_run: { status: "FAILED", fired_at: new Date().toISOString() } }] });
      if (tool === "list_sessions") return P({ data: [{ id: "session_pc", title: "PC principal BWISIOM", environment_kind: "bridge", session_status: "SESSION_STATUS_IDLE", updated_at: new Date().toISOString() }] });
      if (tool === "list_environments") return P({ data: [{ environment_id: "env_test", name: "Entorno prueba" }] });
      return P({ ok: true });
    },
    listTools: async () => ({ servers: [] }),
  };
  const user = { isOwner: async () => true, canEdit: async () => true, can: async () => true };
  const downloads = { save: async r => { window.__calls.push(["download", r.filename, r.data.length]); return { status: "saved" }; } };
  const caps = { db, user, sample, mcp, downloads };
  window.claude = { use: name => new Promise(r => setTimeout(() => r(window.__noData && name === "db" ? null : caps[name] || null), 30)) };
})();
