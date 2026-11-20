#!/usr/bin/env python3
"""Agente local BWISIOM HQ para el PC principal.

Qué hace:
  estado     -> imprime en JSON el estado REAL del PC (CPU, GPU, RAM, discos, temperaturas
                disponibles, OBS, procesos vigilados y acciones autorizadas). Formato = documento pc/estado.
  procesos   -> solo la lista de procesos vigilados.
  obs        -> estado de OBS (abierto / grabando / transmitiendo).
  registros  -> últimas líneas del registro del agente.
  run <id>   -> ejecuta UNA acción de acciones_autorizadas.json que tenga "habilitada": true.

Qué NO hace:
  - No abre puertos ni escucha conexiones. No se conecta a Internet.
  - No ejecuta comandos arbitrarios: solo los de acciones_autorizadas.json habilitados por ti.
  - No lee archivos personales, contraseñas, mensajes ni otras aplicaciones.
  - No inventa métricas: si un dato no se puede medir, se informa como null.

La sesión de Claude Code del PC (Remote Control) corre este script cuando BWISIOM HQ lo pide
y escribe el resultado en la base de datos de BWISIOM HQ (ver README.md).
Requisitos: Python 3.9+, `pip install psutil`. Opcional: `pip install obsws-python` (estado detallado de OBS).
"""
import datetime, json, os, platform, shutil, socket, subprocess, sys

DIR = os.path.dirname(os.path.abspath(__file__))
CFG_PATH = os.path.join(DIR, "acciones_autorizadas.json")
LOG_PATH = os.path.join(DIR, "bwisiom_agent.log")


def log(msg):
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(f"{datetime.datetime.now().isoformat(timespec='seconds')} {msg}\n")


def cfg():
    try:
        with open(CFG_PATH, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"procesos_vigilados": [], "acciones": []}


def gpu():
    exe = shutil.which("nvidia-smi")
    if not exe:
        return None
    try:
        out = subprocess.run([exe, "--query-gpu=name,utilization.gpu,temperature.gpu,memory.used,memory.total",
                              "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=8).stdout.strip().splitlines()
        if not out:
            return None
        n, u, t, mu, mt = [x.strip() for x in out[0].split(",")]
        num = lambda x: float(x) if x.replace(".", "", 1).isdigit() else None
        return {"nombre": n, "uso": num(u), "temp": num(t), "vram_usada_mb": num(mu), "vram_total_mb": num(mt)}
    except Exception as e:
        log(f"gpu error {e}")
        return None


def obs(ps, c):
    info = {"conectado": False, "grabando": False, "transmitiendo": False, "detalle": ""}
    if not ps:
        return {"conectado": None, "grabando": None, "transmitiendo": None, "detalle": "Desconocido: falta psutil"}
    running = any((p.info.get("name") or "").lower().startswith("obs") for p in ps.process_iter(["name"]))
    info["conectado"] = running
    if not running:
        info["detalle"] = "OBS cerrado"
        return info
    o = c.get("obs") or {}
    try:
        import obsws_python as obsws  # opcional
        cl = obsws.ReqClient(host=o.get("host", "localhost"), port=o.get("port", 4455), password=os.environ.get("OBS_WS_PASSWORD", ""), timeout=3)
        rec = cl.get_record_status(); st = cl.get_stream_status()
        info.update(grabando=bool(rec.output_active), transmitiendo=bool(st.output_active), tiempo_grabacion=getattr(rec, "output_timecode", None), detalle="Datos de obs-websocket")
    except ImportError:
        info["detalle"] = "OBS abierto (instala obsws-python para saber si está grabando)"
    except Exception as e:
        info["detalle"] = "OBS abierto; obs-websocket no respondió"
        log(f"obs error {e}")
    return info


def estado():
    c = cfg()
    try:
        import psutil as ps
    except ImportError:
        ps = None
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    e = {"host": socket.gethostname(), "online": True, "actualizado": now, "sistema": f"{platform.system()} {platform.release()}",
         "cpu": None, "gpu": gpu(), "ram": None, "discos": [], "obs": None, "procesos": [], "acciones_autorizadas": [],
         "agente": "bwisiom_pc_agent 1.0"}
    if ps:
        temp = None
        try:
            t = ps.sensors_temperatures() if hasattr(ps, "sensors_temperatures") else {}
            vals = [x.current for k, arr in (t or {}).items() if k.lower() in ("coretemp", "k10temp", "cpu_thermal", "acpitz") for x in arr]
            temp = max(vals) if vals else None
        except Exception:
            pass
        e["cpu"] = {"uso": ps.cpu_percent(interval=1), "nucleos": ps.cpu_count(), "temp": temp, "nombre": platform.processor() or None}
        vm = ps.virtual_memory()
        e["ram"] = {"uso": vm.percent, "usada_gb": round(vm.used / 1e9, 1), "total_gb": round(vm.total / 1e9, 1)}
        for part in ps.disk_partitions(all=False):
            if "cdrom" in part.opts or not part.fstype:
                continue
            try:
                u = ps.disk_usage(part.mountpoint)
            except Exception:
                continue
            e["discos"].append({"nombre": part.device, "montaje": part.mountpoint, "uso": u.percent, "libre_gb": round(u.free / 1e9), "total_gb": round(u.total / 1e9)})
        names = {}
        for p in ps.process_iter(["name"]):
            n = (p.info.get("name") or "").lower()
            names[n] = names.get(n, 0) + 1
        e["procesos"] = [{"nombre": v, "activo": v.lower() in names, "detalle": f"{names.get(v.lower(), 0)} instancia(s)"} for v in c.get("procesos_vigilados", [])]
    else:
        e["error"] = "psutil no instalado: ejecuta  pip install psutil"
    e["obs"] = obs(ps, c)
    e["acciones_autorizadas"] = [{"id": a["id"], "nombre": a.get("nombre", a["id"]), "descripcion": a.get("descripcion", "")}
                                 for a in c.get("acciones", []) if a.get("habilitada")]
    return e


def run(action_id):
    a = next((x for x in cfg().get("acciones", []) if x.get("id") == action_id), None)
    if not a:
        log(f"RECHAZADA acción desconocida: {action_id}")
        return {"ok": False, "error": f"La acción '{action_id}' no existe en acciones_autorizadas.json"}
    if not a.get("habilitada"):
        log(f"RECHAZADA acción deshabilitada: {action_id}")
        return {"ok": False, "error": f"La acción '{action_id}' está deshabilitada. Actívala tú mismo en acciones_autorizadas.json"}
    cmd = a.get("comando")
    if not isinstance(cmd, list) or not cmd:
        return {"ok": False, "error": "La acción no tiene un comando válido (debe ser una lista)"}
    log(f"EJECUTA {action_id}: {cmd}")
    try:
        if a.get("en_segundo_plano"):
            subprocess.Popen(cmd, shell=False)  # shell=False: sin inyección de comandos
            return {"ok": True, "salida": "Iniciado en segundo plano"}
        r = subprocess.run(cmd, shell=False, capture_output=True, text=True, timeout=int(a.get("timeout", 60)))
        log(f"FIN {action_id} código {r.returncode}")
        return {"ok": r.returncode == 0, "codigo": r.returncode, "salida": (r.stdout or "")[-2000:], "error": (r.stderr or "")[-1000:]}
    except Exception as ex:
        log(f"ERROR {action_id}: {ex}")
        return {"ok": False, "error": str(ex)}


def main(argv):
    cmd = argv[1] if len(argv) > 1 else "estado"
    if cmd in ("estado", "otra"):
        out = estado()
    elif cmd == "procesos":
        out = {"procesos": estado()["procesos"]}
    elif cmd == "obs":
        out = {"obs": estado()["obs"]}
    elif cmd in ("registros", "grabaciones"):
        try:
            with open(LOG_PATH, encoding="utf-8") as f:
                lines = f.readlines()[-40:]
        except FileNotFoundError:
            lines = []
        out = {"registros": [l.rstrip() for l in lines]}
        if cmd == "grabaciones":
            out = {"obs": estado()["obs"], **out}
    elif cmd == "run" and len(argv) > 2:
        out = run(argv[2])
    else:
        out = {"ok": False, "error": "Uso: estado | procesos | obs | grabaciones | registros | run <id>"}
    log(f"consulta {cmd}")
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main(sys.argv)
