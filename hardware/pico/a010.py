# Sipeed MaixSense A010 (ToF depth camera) over UART.
# Wiring (screen facing you, connector on top, wires counted from the LEFT = farthest from USB-C):
#   1st TX -> Pico GP5 (pin 7)   2nd RX -> Pico GP4 (pin 6)   3rd GND -> pin 8   4th 5V -> pin 39 (VSYS)
#
# Frame format (checked on hardware): 00 FF | len (2 bytes, little endian) | 16 info bytes
# (rows at [14], cols at [15]) | rows*cols pixel bytes | checksum | DD
# With AT+UNIT=0 a pixel value p means (p / 5.1)^2 millimetres.
import time
from machine import UART, Pin


class A010:
    def __init__(self, uart_id=1, tx=4, rx=5):
        self.u = UART(uart_id, baudrate=115200, tx=Pin(tx), rx=Pin(rx), rxbuf=4096, timeout=0)
        self.buf = b""
        self.mm = None        # distance straight ahead (centre of the image), millimetres
        self.frames = 0
        for c in (b"AT+BINN=4", b"AT+UNIT=0", b"AT+FPS=5", b"AT+DISP=5"):  # 25x25, 5 fps, LCD+UART
            self.u.write(c + b"\r")
            time.sleep_ms(200)
        self._drain()

    def _drain(self):
        while self.u.any():
            self.u.read(min(self.u.any(), 512))

    def poll(self):
        """Call often. Parses any complete frames; updates self.mm."""
        n = self.u.any()
        if n:
            self.buf += self.u.read(min(n, 2048))
        while True:
            i = self.buf.find(b"\x00\xff")
            if i < 0:
                self.buf = self.buf[-1:]
                return
            if i:
                self.buf = self.buf[i:]
            if len(self.buf) < 4:
                return
            ln = self.buf[2] | (self.buf[3] << 8)
            if ln < 16 or ln > 10100:          # not a real header, skip it
                self.buf = self.buf[2:]
                continue
            total = 4 + ln + 2
            if len(self.buf) < total:
                if len(self.buf) > 8192:       # fell behind (e.g. during an e-ink refresh)
                    self.buf = b""
                return
            frame, self.buf = self.buf[:total], self.buf[total:]
            if frame[-1] != 0xDD:
                continue
            rows, cols = frame[14], frame[15]
            if rows * cols != ln - 16:
                continue
            self._use(frame[20:20 + rows * cols], rows, cols)

    def _use(self, pix, rows, cols):
        # median of the centre 5x5 pixels, ignoring 0/255 (no return / saturated)
        vals = []
        zeros = 0
        r0, c0 = rows // 2 - 2, cols // 2 - 2
        for r in range(r0, r0 + 5):
            for c in range(c0, c0 + 5):
                p = pix[r * cols + c]
                if 0 < p < 255:
                    vals.append(p)
                elif p == 0:
                    zeros += 1
        if not vals:
            if zeros > 12:  # mostly "too close to measure" (e.g. lying near the floor)
                self.mm = 0
                self.frames += 1
            return
        vals.sort()
        p = vals[len(vals) // 2]
        self.mm = int((p / 5.1) ** 2)
        self.frames += 1
