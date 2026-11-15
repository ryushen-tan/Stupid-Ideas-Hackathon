"""Drip -> clothing-tag bridge.

Watches the Drip authenticator's current website request (its frozen outfit arrangement) and tells
every connected Pico tag where its garment has to be, e.g. "ZONES hoodie=head pants=body hat=feet".
Each Pico then shows its barcode only while its garment is at that height.

Reads Drip's local Supabase database directly (local demo only). Run with Drip already running:
    python3 drip_bridge.py
"""
import glob
import os
import subprocess
import threading
import time

import serial
from serial.tools import list_ports

DB_URL = os.environ.get("DRIP_DB_URL", "postgresql://postgres:postgres@127.0.0.1:56322/postgres")
# Same order as threadcheck/shared/drip.ts `outfits`
OUTFITS = [
    {"head": "hoodie", "body": "pants", "feet": "hat"},
    {"head": "hat", "body": "hoodie", "feet": "pants"},
    {"head": "pants", "body": "hat", "feet": "hoodie"},
]
QUERY = (
    "SELECT status, setup->>'outfitIndex' FROM threadcheck.browser_requests "
    "WHERE status IN ('prepared','checking','verified') AND setup IS NOT NULL "
    "AND \"expiresAt\" > extract(epoch from now())*1000 ORDER BY \"expiresAt\" DESC LIMIT 1"
)
RASPBERRY_PI_VID = 0x2E8A


def current_zones():
    out = subprocess.run(["psql", DB_URL, "-At", "-c", QUERY], capture_output=True, text=True, timeout=5)
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip() or "psql failed")
    line = out.stdout.strip()
    if not line:
        return None
    status, idx = line.split("|")
    outfit = OUTFITS[int(idx)]
    return {garment: place for place, garment in outfit.items()}  # e.g. {"hoodie": "head", ...}


class Tag:
    """One Pico on USB: reads its log lines, accepts ZONES commands."""

    def __init__(self, port):
        self.port = port
        self.s = serial.Serial(port, 115200, timeout=0.5)
        self.name = port.split("usbmodem")[-1]
        self.role = None
        self.height = None
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        while True:
            try:
                line = self.s.readline().decode(errors="replace").strip()
            except Exception:
                return
            if not line:
                continue
            if line.startswith("DIST "):
                self.height = int(line[5:])
                continue
            if line.startswith("ROLE "):
                self.role = line.split()[1]
            print(f"[pico {self.label()}] {line}", flush=True)

    def label(self):
        return self.role or self.name

    def send(self, text):
        self.s.write((text + "\n").encode())


def pico_ports():
    return [p.device for p in list_ports.comports() if p.vid == RASPBERRY_PI_VID and "cu." in p.device] or \
        sorted(glob.glob("/dev/cu.usbmodem1*"))


def main():
    tags = [Tag(p) for p in pico_ports()]
    if not tags:
        raise SystemExit("No Picos found on USB.")
    print("Tags on:", ", ".join(t.port for t in tags), flush=True)
    last, last_print = None, 0
    while True:
        try:
            zones = current_zones()
        except Exception as e:
            print("DB read failed:", e, flush=True)
            zones = None
        cmd = "ZONES " + (" ".join(f"{g}={p}" for g, p in zones.items()) if zones else "none")
        for t in tags:
            t.send(cmd)  # resent every second so a rebooted Pico catches up
        if cmd != last:
            print(time.strftime("%H:%M:%S"), "Drip arrangement ->", cmd, flush=True)
            last = cmd
        if time.time() - last_print >= 1:
            last_print = time.time()
            print("   heights: " + ", ".join(
                f"{t.label()}={'-' if t.height is None else f'{t.height / 10:.0f}cm'}" for t in tags), flush=True)
        time.sleep(1)


if __name__ == "__main__":
    main()
