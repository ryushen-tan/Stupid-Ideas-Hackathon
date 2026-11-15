"""Stupid Barcode Authenticator -- laptop side.

- Talks to the Pico over USB serial: sets its clock, gets told what it's showing,
  and tells it ACCESS GRANTED / DENIED after each scan.
- Serves the scan page at http://localhost:8787 (scanner = USB keyboard, so it types into the page).
- POST /api/verify {"code": "..."} -> {"ok": bool, "reason": str}  (CORS for $ALLOWED_ORIGIN only)

Run:  pip install pyserial   then   python3 server.py
"""
import glob
import http.server
import json
import os
import sys
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "pico"))
import config  # noqa: E402  (same file the Pico runs)
import totp  # noqa: E402

try:
    import serial
except ImportError:
    serial = None

PORT = int(os.environ.get("PORT", 8787))
# Origin of the main app allowed to call /api/verify from the browser
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "http://localhost:3000")
state = {"pico": None, "showing": None, "used": set(), "history": [], "dist_mm": None, "dist_at": 0}
lock = threading.Lock()


# ---------- Pico serial bridge ----------
def find_pico():
    if os.environ.get("PICO_PORT"):
        return os.environ["PICO_PORT"]
    ports = glob.glob("/dev/cu.usbmodem*") + glob.glob("/dev/ttyACM*") + glob.glob("COM[0-9]*")
    return ports[0] if ports else None


def pico_send(line):
    p = state["pico"]
    if p:
        try:
            p.write((line + "\n").encode())
        except Exception as e:
            print("pico write failed:", e)


def pico_loop():
    if serial is None:
        print("! pyserial not installed -> no Pico link (pip install pyserial). Web page still works.")
        return
    while True:
        path = find_pico()
        if not path:
            print("... waiting for Pico on USB (plug it in)")
            time.sleep(3)
            continue
        try:
            with serial.Serial(path, 115200, timeout=1) as p:
                state["pico"] = p
                print("Pico connected on", path)
                last_sync = 0
                while True:
                    if time.time() - last_sync > 300:
                        pico_send("T %d" % int(time.time()))
                        last_sync = time.time()
                    raw = p.readline()
                    if not raw:
                        continue
                    msg = raw.decode(errors="replace").strip()
                    if msg.startswith("SHOW "):
                        state["showing"] = msg[5:]
                    if msg.startswith("DIST "):
                        try:
                            state["dist_mm"], state["dist_at"] = int(msg[5:]), time.time()
                        except ValueError:
                            pass
                        continue  # once a second: too chatty to print
                    if msg:
                        print("[pico]", msg)
                    if msg == "READY":  # Pico rebooted -> resync now
                        last_sync = 0
        except Exception as e:
            state["pico"] = None
            print("Pico link lost:", e)
            time.sleep(2)


# ---------- verification ----------
def verify(code):
    code = (code or "").strip()
    now = totp.counter_for(time.time(), config.PERIOD)
    # accept the previous code too: the e-ink refresh is slow, people are slower
    for counter in (now, now - 1, now + 1):
        if totp.code_at(config.SECRET, counter, config.DIGITS) == code:
            if counter in state["used"]:
                return False, "already used (wait for the next code)"
            state["used"].add(counter)
            return True, "valid"
    return False, "wrong code"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def _json(self, status, obj, cors=False):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        if cors:  # only /api/verify is callable from other origins (the main app)
            self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/status":  # never expose the live code here
            fresh = time.time() - state["dist_at"] < 5
            return self._json(200, {"picoConnected": state["pico"] is not None,
                                    "distanceMm": state["dist_mm"] if fresh else None})
        if path in ("/", "/index.html"):  # allowlist: never serve pico/config.py (the secret)
            self.path = "/index.html"
            return super().do_GET()
        return self.send_error(404)

    def do_POST(self):
        if self.path not in ("/api/verify", "/scan"):
            return self.send_error(404)
        n = int(self.headers.get("Content-Length", 0))
        try:
            data = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return self._json(400, {"ok": False, "reason": "bad json"})
        code = str(data.get("code", ""))
        with lock:
            ok, reason = verify(code)
            entry = {"code": code, "ok": ok, "reason": reason, "at": time.strftime("%H:%M:%S")}
            state["history"].append(entry)
        print("SCAN", entry, flush=True)
        pico_send("OK" if ok else "NO")
        self._json(200, entry, cors=True)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    threading.Thread(target=pico_loop, daemon=True).start()
    print(f"Scan page: http://localhost:{PORT}", flush=True)
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
