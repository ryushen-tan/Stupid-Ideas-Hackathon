"""Live heights from every Pico tag on USB (read-only: doesn't send Drip zones).
Use it to check where each sensor is pointing:  python3 watch_heights.py
"""
import time

import serial
from serial.tools import list_ports

NAMES = {}
ports = [p.device for p in list_ports.comports() if p.vid == 0x2E8A]
if not ports:
    raise SystemExit("No Picos on USB.")
conns = {p: serial.Serial(p, 115200, timeout=0) for p in ports}
heights = {p: None for p in ports}
buf = {p: b"" for p in ports}
ZONES = {"head": (330, 1000), "body": (120, 330), "feet": (0, 120)}  # same as pico/config.py
while True:
    for p, s in conns.items():
        try:
            buf[p] += s.read(4096)
        except Exception:
            continue
        *lines, buf[p] = buf[p].split(b"\n")
        for raw in lines:
            line = raw.decode(errors="replace").strip()
            if line.startswith("DIST "):
                heights[p] = int(line[5:])
            elif line.startswith("ROLE "):
                NAMES[p] = line.split()[1]
            elif line.startswith(("STATE", "ZONE")):
                print(f"   [{NAMES.get(p, p[-4:])}] {line}")
    parts = []
    for p in ports:
        h = heights[p]
        where = "-" if h is None else ", ".join(z for z, (lo, hi) in ZONES.items() if lo <= h <= hi) or "out of range"
        parts.append(f"{NAMES.get(p, p[-4:]):>6}: {'--' if h is None else f'{h / 10:5.0f} cm'} ({where})")
    print(time.strftime("%H:%M:%S"), " | ".join(parts), flush=True)
    time.sleep(1)
