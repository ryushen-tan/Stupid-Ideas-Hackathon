# Drip clothing tag -- Pico firmware.
# Each Pico is one garment's "tag": it shows that garment's barcode on the e-ink, but ONLY while
# the garment is at the height Drip's current arrangement asks for. The A010 depth sensor rides
# on the garment pointing at the floor, so its reading is the garment's height.
#
#   role.py (one per device)  GARMENT = "pants" (Pico 1) / "hoodie" (Pico 2); ALWAYS_SHOW option
#   config.py                 height zones + e-ink refresh limit
#
# USB serial lines:
#   laptop -> pico   "ZONES hoodie=head pants=body hat=feet"   from drip_bridge.py; "ZONES none"
#   pico -> laptop   "ROLE <garment> <barcode>"   at boot
#   pico -> laptop   "DIST <mm>"                  garment height, once a second
#   pico -> laptop   "STATE barcode|hidden ..."   whenever the screen changes
import select
import sys
import time

from machine import Pin

import code128
import config
import eink_seeed as E
import role

epd = E.EInk(config.UART_ID, config.PIN_TX, config.PIN_RX)
try:
    import a010
    sensor = a010.A010()
except Exception as e:  # sensor not wired -> carry on without it
    print("A010: not available:", e)
    sensor = None

led = Pin(25, Pin.OUT)  # blinks while the loop runs (handy on battery, no laptop)
bbuf, black = E.new_canvas()
rbuf, red = E.new_canvas()
LABEL = role.GARMENT.upper()
ALWAYS_SHOW = getattr(role, "ALWAYS_SHOW", False)  # True = ignore the sensor, barcode stays up


def big_text(fb, s, x, y, scale=2, c=1):
    tmp = bytearray(8)
    ch = E.framebuf.FrameBuffer(tmp, 8, 8, E.framebuf.MONO_VLSB)
    for i, char in enumerate(s):
        ch.fill(0)
        ch.text(char, 0, 0, 1)
        for py in range(8):
            for px in range(8):
                if ch.pixel(px, py):
                    fb.fill_rect(x + (i * 8 + px) * scale, y + py * scale, scale, scale, c)


def centered(fb, s, y, scale=1, c=1):
    x = (E.W - len(s) * 8 * scale) // 2
    if scale == 1:
        fb.text(s, x, y, c)
    else:
        big_text(fb, s, x, y, scale, c)


def clear():
    black.fill(0)
    red.fill(0)


def screen_barcode():
    clear()
    red.fill_rect(0, 0, E.W, 11, 1)
    centered(red, "DRIP TAG: " + LABEL, 2, 1, 0)  # white text cut out of red
    w = code128.width_modules(code128.encode(role.BARCODE)) * 2
    code128.draw(black, role.BARCODE, (E.W - w) // 2, 15, 52, module=2)
    centered(black, role.BARCODE, 70, 2)
    centered(red, "scan me now", 93)
    epd.show(bbuf, rbuf)


def screen_hidden():
    clear()
    red.fill_rect(0, 0, E.W, 11, 1)
    centered(red, "DRIP TAG: " + LABEL, 2, 1, 0)
    centered(black, LABEL, 30, 3)
    centered(black, "not in place", 64, 2)
    centered(red, "wear me where Drip says", 93)
    epd.show(bbuf, rbuf)


poll = select.poll()
poll.register(sys.stdin, select.POLLIN)


zone = None  # where Drip wants this garment right now: "head" / "body" / "feet" / None


def read_stdin():
    global zone
    while poll.poll(0):
        line = sys.stdin.readline().strip()
        if line.startswith("ZONES"):
            want = None
            for part in line.split()[1:]:
                k, _, v = part.partition("=")
                if k == role.GARMENT and v in config.ZONES_MM:
                    want = v
            if want != zone:
                zone = want
                print("ZONE", zone)


def elapsed(t):
    return time.ticks_diff(time.ticks_ms(), t)


print("ROLE", role.GARMENT, role.BARCODE)
boot = time.ticks_ms()
last_blink = last_dist = time.ticks_ms()
candidate, candidate_since = False, time.ticks_ms()
present = False
shown = None          # "barcode" / "hidden" currently on the e-ink
last_refresh = None
while True:
    read_stdin()
    if elapsed(last_blink) > 500:
        last_blink = time.ticks_ms()
        led.toggle()

    mm = None
    if sensor:
        sensor.poll()
        mm = sensor.mm
        if elapsed(last_dist) > 1000:
            last_dist = time.ticks_ms()
            if mm is not None:
                print("DIST", mm)

    # No sensor frames at all after a few seconds -> sensor missing/broken: keep the barcode up
    no_sensor = ALWAYS_SHOW or sensor is None or (sensor.frames == 0 and elapsed(boot) > config.SENSOR_GRACE_MS)
    if no_sensor:
        present = True
    else:
        lo, hi = config.ZONES_MM.get(zone, (1, 0))  # no zone (no Drip request) -> never inside
        inside = mm is not None and lo <= mm <= hi
        if inside != candidate:  # debounce: must hold steady before we believe it
            candidate, candidate_since = inside, time.ticks_ms()
        if elapsed(candidate_since) >= config.HOLD_MS:
            present = candidate

    want = "barcode" if present else "hidden"
    if (sensor is None or sensor.frames or no_sensor) and want != shown:
        if last_refresh is None or elapsed(last_refresh) >= config.MIN_REFRESH_MS:
            print("STATE", want, "zone=%s height=%s" % (zone, mm))
            last_refresh = time.ticks_ms()
            (screen_barcode if want == "barcode" else screen_hidden)()
            shown = want
    time.sleep_ms(50)
