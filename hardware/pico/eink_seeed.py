# Driver for the Seeed "Grove - Triple Color E-Ink Display 2.13"" (104x212, red/black/white).
# The board has its own STM32, so we only talk UART (4 wires: TX, RX, VCC, GND) at 230400 baud.
#
# Protocol (worked out on real hardware):
#   1. board sends 'c' over and over, back to back                       = ready
#   2. we send one 'a'
#   3. board replies, then prints "UART_recv_func\r\nLOOPING..\r\n" nonstop = send me the image
#   4. we send 2756 bytes black + 2756 bytes red (212-byte chunks, 80 ms apart)
#   5. board goes quiet, refreshes the panel (~15 s), then goes back to step 1
#
# The board transmits with NO gap between characters, so the Pico's hardware UART receiver
# locks onto the wrong start bit and returns garbage. Instead we record the RX line with PIO
# and match the raw bit pattern.
#
# Image: 212 rows x 13 bytes (104 px), MSB = left pixel, bit 0 = ink, 1 = white.
# You draw on two LANDSCAPE canvases (black + red), 212 x 104, with 1 = ink and 0 = paper.
import array
import framebuf
import gc
import time

import rp2
from machine import UART, Pin

W = 212          # landscape width
H = 104          # landscape height
ROW_BYTES = 13   # 104 px per portrait row
IMG_BYTES = ROW_BYTES * W  # 2756


def _rev8(b):
    r = 0
    for _ in range(8):
        r = (r << 1) | (b & 1)
        b >>= 1
    return r


_REV = bytes(_rev8(i) for i in range(256))


def new_canvas():
    buf = bytearray(W * H // 8)
    return buf, framebuf.FrameBuffer(buf, W, H, framebuf.MONO_VLSB)


def to_panel(canvas_buf):
    """Landscape MONO_VLSB canvas -> the board's portrait format (inverted: 0 = ink).
    Portrait (x, y) = landscape (lx = 211 - y, ly = x). Each VLSB byte is 8 portrait
    pixels in a row, just in reverse bit order, so this is a byte shuffle plus a lookup.
    """
    out = bytearray(IMG_BYTES)
    for y in range(W):
        lx = W - 1 - y
        o = y * ROW_BYTES
        for xb in range(ROW_BYTES):
            out[o + xb] = _REV[canvas_buf[xb * W + lx]] ^ 0xFF
    return out


# ---- raw line sampler: PIO samples the RX pin at 2 MHz, DMA copies it to RAM ----
@rp2.asm_pio(in_shiftdir=rp2.PIO.SHIFT_LEFT, autopush=True, push_thresh=32, fifo_join=rp2.PIO.JOIN_RX)
def _sampler():
    in_(pins, 1)  # noqa: F821  (PIO assembler name)


_FREQ = 2_000_000
_SPB = _FREQ / 230400           # samples per bit (~8.68)
_PIO0_RXF0 = 0x50200020         # PIO0 SM0 RX FIFO address
_DREQ_PIO0_RX0 = 4


def _frame(ch):
    return '0' + ''.join(str((ch >> i) & 1) for i in range(8)) + '1'


_READY = (_frame(ord('c')) * 12).encode()   # endless 'c' as raw line bits

_UART0_TX_PINS = (0, 12, 16, 28)


# PIO UART transmitter (8N1), used when the TX wire is on a pin the hardware UART can't drive
@rp2.asm_pio(sideset_init=rp2.PIO.OUT_HIGH, out_init=rp2.PIO.OUT_HIGH, out_shiftdir=rp2.PIO.SHIFT_RIGHT)
def _uart_tx():
    pull()                      # noqa: F821
    set(x, 7).side(0)[7]        # noqa: F821  start bit
    label("bitloop")            # noqa: F821
    out(pins, 1)[6]             # noqa: F821
    jmp(x_dec, "bitloop")       # noqa: F821
    nop().side(1)[6]            # noqa: F821  stop bit


def _edges(pin, n=3000):
    p = Pin(pin, Pin.IN)
    last = p.value()
    e = 0
    for _ in range(n):
        v = p.value()
        if v != last:
            e += 1
            last = v
    return e


def detect_pins(tx, rx, timeout_ms=20_000):
    """The display talks nonstop when ready/receiving, so the pin that toggles is its TX
    (our RX). Returns (tx, rx), swapped if the two signal wires are the other way round."""
    t0 = time.ticks_ms()
    while time.ticks_diff(time.ticks_ms(), t0) < timeout_ms:
        on_rx, on_tx = _edges(rx), _edges(tx)
        if on_rx > 20 and on_tx == 0:
            return tx, rx
        if on_tx > 20 and on_rx == 0:
            print("E-INK: TX/RX wires are swapped -- handling it in software")
            return rx, tx
        time.sleep_ms(200)
    print("E-INK: couldn't tell which wire is which (display quiet?), using config pins")
    return tx, rx


class EInk:
    def __init__(self, uart_id=0, tx=0, rx=1):
        tx, rx = detect_pins(tx, rx)
        self.uart = None
        if uart_id == 0 and tx in _UART0_TX_PINS and rx == tx + 1:
            self.uart = UART(uart_id, baudrate=230400, bits=8, parity=None, stop=1, invert=0,
                             tx=Pin(tx), rx=Pin(rx))
        else:
            self.txsm = rp2.StateMachine(1, _uart_tx, freq=8 * 230400,
                                         sideset_base=Pin(tx), out_base=Pin(tx))
            self.txsm.active(1)
        self.rxpin = Pin(rx, Pin.IN)  # PIO reads the line, not the UART
        self.sm = rp2.StateMachine(0, _sampler, freq=_FREQ, in_base=self.rxpin)
        self.dma = rp2.DMA()
        self._ctrl = self.dma.pack_ctrl(size=2, inc_read=False, inc_write=True, treq_sel=_DREQ_PIO0_RX0)
        self._buf = array.array('I', [0] * 250)  # 8000 samples = 4 ms
        self._bits = bytearray(80)

    def state(self):
        """'ready' (endless c), 'quiet' (idle line), 'busy' (anything else: receiving / debug text)."""
        gc.collect()
        buf = self._buf
        self.sm.restart()
        self.dma.config(read=_PIO0_RXF0, write=buf, count=len(buf), ctrl=self._ctrl)
        self.dma.active(1)
        self.sm.active(1)
        while self.dma.active():
            pass
        self.sm.active(0)
        while self.sm.rx_fifo():
            self.sm.get()
        bits = self._bits
        cur = (buf[0] >> 31) & 1
        n = nb = edges = 0
        for w in buf:
            for k in range(31, -1, -1):
                s = (w >> k) & 1
                if s == cur:
                    n += 1
                else:
                    if edges:  # first run is partial
                        m = int(n / _SPB + 0.5)
                        if m > 25:
                            return 'busy'  # has gaps -> not the endless-'c' stream
                        for _ in range(m):
                            if nb < 80:
                                bits[nb] = 48 + cur
                                nb += 1
                    edges += 1
                    cur, n = s, 1
            if nb >= 80:
                break
        if edges < 3:
            return 'quiet'
        if nb >= 40 and bytes(bits[:40]) in _READY:
            return 'ready'
        return 'busy'

    def _wait(self, want, timeout_ms):
        t0 = time.ticks_ms()
        st = None
        while time.ticks_diff(time.ticks_ms(), t0) < timeout_ms:
            st = self.state()
            if st in want:
                return st, st
            time.sleep_ms(20)
        return None, st

    def _write(self, data):
        if self.uart:
            self.uart.write(data)
        else:
            for c in data:
                self.txsm.put(c)

    def _send(self, black, red):
        for img in (black, red):
            for i in range(0, IMG_BYTES, 212):
                self._write(img[i:i + 212])
                time.sleep_ms(80)
            time.sleep_ms(90)

    def _flush(self):
        """Display is stuck mid-transfer (waiting for N more image bytes): feed it white
        until it goes quiet, i.e. has its 5512 bytes and starts refreshing."""
        white = b"\xff" * 212
        for _ in range(30):
            self._write(white)
            time.sleep_ms(80)
            if self.state() == 'quiet':
                return True
        return False

    def show(self, black_canvas, red_canvas):
        black = to_panel(black_canvas)
        red = to_panel(red_canvas)
        ok, last = self._wait(('ready',), 30_000)  # may still be refreshing the previous image
        if not ok and last == 'busy':
            print("E-INK: display stuck mid-transfer, flushing it")
            self._flush()
            ok, last = self._wait(('ready',), 40_000)
        if not ok:
            print("E-INK: display never said ready (%s) -- check wires, or unplug+replug its VCC" % last)
            return False
        self._write(b"a")
        ok, _ = self._wait(('busy',), 3000)
        if not ok:
            print("E-INK: display ignored the handshake")
            return False
        time.sleep_ms(500)
        self._send(black, red)
        st = self.state()
        if st == 'busy':  # it wanted more bytes than we sent -- top it up so it doesn't hang
            print("E-INK: display still wants bytes, flushing")
            self._flush()
        print("E-INK: image sent")
        return True
