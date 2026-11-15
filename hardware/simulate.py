"""Run the real Pico firmware (pico/main.py) on your laptop with fake hardware.

Captures the exact bytes that would be sent to the e-ink panel and saves them as images
(preview_*.ppm), then (if zbarimg is installed) decodes the barcode to prove it scans.
    python3 simulate.py
"""
import io
import os
import subprocess
import sys
import time
import types

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "pico"))

# ---- fake framebuf (MONO_VLSB only, which is all the firmware uses) ----
fb_mod = types.ModuleType("framebuf")
fb_mod.MONO_VLSB = 0


class FrameBuffer:
    def __init__(self, buf, w, h, fmt):
        self.buf, self.w, self.h = buf, w, h

    def pixel(self, x, y, c=None):
        if not (0 <= x < self.w and 0 <= y < self.h):
            return 0
        i, bit = (y >> 3) * self.w + x, 1 << (y & 7)
        if c is None:
            return 1 if self.buf[i] & bit else 0
        self.buf[i] = (self.buf[i] | bit) if c else (self.buf[i] & ~bit)

    def fill_rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.pixel(xx, yy, c)

    def fill(self, c):
        self.buf[:] = bytes([0xFF if c else 0]) * len(self.buf)

    def text(self, s, x, y, c=1):  # crude 5x7 blocks so the layout is visible
        for i, ch in enumerate(s):
            if ch != " ":
                self.fill_rect(x + i * 8 + 1, y + 1, 5, 6, c)


fb_mod.FrameBuffer = FrameBuffer
sys.modules["framebuf"] = fb_mod

# ---- fake machine.Pin / UART (pretends to be the Seeed e-ink board) ----
frames = []


class Pin:
    OUT, IN, PULL_UP = 0, 1, 2

    def toggle(self):
        pass

    def __init__(self, *a, **k):
        self.v = 0

    def __call__(self, v=None):
        self.v = v if v is not None else self.v

    def value(self):
        return 0  # never busy


board = {"mode": "ready"}  # fake e-ink board state as the driver sees it


class UART:
    """Fake e-ink board: 'a' starts a transfer, 5512 image bytes finish it."""

    def __init__(self, *a, **k):
        pass

    def write(self, b):
        if bytes(b).startswith(b"AT"):  # A010 depth-sensor setup commands, not for the e-ink
            return
        if b == b"a":
            board["mode"] = "busy"
        else:
            frames.append(bytes(b))
            if sum(map(len, frames)) % (2 * 2756) == 0:
                board["mode"] = "ready"  # refreshed, ready for the next image


# fake rp2 (PIO/DMA): the driver's state() is replaced below, so these only need to exist
rp2 = types.ModuleType("rp2")
rp2.asm_pio = lambda **k: (lambda f: f)
rp2.PIO = types.SimpleNamespace(SHIFT_LEFT=0, SHIFT_RIGHT=1, JOIN_RX=0, OUT_HIGH=1)
rp2.StateMachine = lambda *a, **k: None


class _DMA:
    def pack_ctrl(self, **k):
        return 0


rp2.DMA = _DMA
sys.modules["rp2"] = rp2


machine = types.ModuleType("machine")
machine.Pin, machine.UART = Pin, UART
sys.modules["machine"] = machine
time.sleep_ms = lambda ms: None
time.ticks_ms = lambda: int(time.time() * 1000)
time.ticks_diff = lambda a, b: a - b

# ---- fake USB serial: laptop sends the clock, then we stop after a few screens ----
shown = []
sys.stdin = io.StringIO("T %d\n" % int(time.time()))
sel = types.ModuleType("select")
sel.POLLIN = 1


class Poll:
    sent = False

    def register(self, *a):
        pass

    def poll(self, t):
        return []  # laptop sends nothing; we stop after the first screen (see show below)


sel.poll = Poll
sys.modules["select"] = sel
role = types.ModuleType("role")  # each real Pico has its own role.py; simulate the pants unit
role.GARMENT, role.PREFIX = os.environ.get("ROLE", "pants"), os.environ.get("PREFIX", "20000")
sys.modules["role"] = role

import eink_seeed as E  # noqa: E402

E.EInk.state = lambda self: board["mode"]
E.detect_pins = lambda tx, rx: (tx, rx)  # no real wires to look at
real_show = E.EInk.show


def show(self, b, r):
    n = len(frames)
    ok = real_show(self, b, r)
    sent = b"".join(frames[n:])
    assert ok and len(sent) == 2 * E.IMG_BYTES, "handshake/transfer failed"
    shown.append((sent[:E.IMG_BYTES], sent[E.IMG_BYTES:]))  # exactly what went over the wire
    raise SystemExit  # one screen is enough


E.EInk.show = show

out = io.StringIO()
real_stdout, sys.stdout = sys.stdout, out
try:
    import main  # noqa: F401,E402
except SystemExit:
    pass
sys.stdout = real_stdout
print(out.getvalue().strip())


def save(i, black, red, scale=3):
    # landscape image as the user sees it: portrait x = ly, portrait y = 211 - lx
    W, H = E.W, E.H
    px = bytearray()
    for ly in range(H):
        row = bytearray()
        x = ly
        for lx in range(W):
            idx, bit = (W - 1 - lx) * E.ROW_BYTES + (x >> 3), 0x80 >> (x & 7)
            if not red[idx] & bit:  # 0 = ink
                c = b"\xd0\x20\x20"
            elif not black[idx] & bit:
                c = b"\x00\x00\x00"
            else:
                c = b"\xff\xff\xff"
            row += c * scale
        px += bytes(row) * scale
    path = os.path.join(HERE, "preview_%d.ppm" % i)
    with open(path, "wb") as f:
        f.write(b"P6 %d %d 255\n" % (W * scale, H * scale) + bytes(px))
    return path


for i, (b, r) in enumerate(shown):
    p = save(i, b, r)
    print("saved", p)
    try:
        res = subprocess.run(["zbarimg", "-q", p], capture_output=True, text=True)
        print("  zbarimg:", res.stdout.strip() or "(no barcode)")
    except FileNotFoundError:
        pass
