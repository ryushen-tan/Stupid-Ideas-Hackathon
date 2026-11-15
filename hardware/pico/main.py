# Drip clothing tag -- Pico firmware. Runs entirely on the Pico: no laptop, no wireless.
# Each Pico is one garment's "tag". It measures its own height with the A010 depth sensor
# (pointing down at the floor) and builds its own barcode: the LAST 3 DIGITS ARE THE HEIGHT IN CM.
# Scanning the tag in Drip carries the height into the app, which checks it against where the
# arrangement wants that garment (threadcheck/shared/height-tags.ts).
#
#   role.py (one per device)  GARMENT, PREFIX (5 digits: hoodie 10000, pants 20000, hat 30000)
#   config.py                 smoothing + e-ink refresh limit
#   barcode = PREFIX + height cm (000-998), or PREFIX + 999 when there's no working sensor
#
# USB serial (optional, for watch_heights.py):  "ROLE ..", "DIST <mm>", "STATE <barcode>"
import select
import sys
import time

from machine import Pin

import code128
import config
import eink_seeed as E
import role

NO_SENSOR = 999
epd = E.EInk(config.UART_ID, config.PIN_TX, config.PIN_RX)
try:
    import a010
    sensor = None if getattr(role, "ALWAYS_SHOW", False) else a010.A010()
except Exception as e:  # sensor not wired -> carry on without it
    print("A010: not available:", e)
    sensor = None

led = Pin(25, Pin.OUT)  # blinks while the loop runs (handy on battery, no laptop)
bbuf, black = E.new_canvas()
rbuf, red = E.new_canvas()
LABEL = role.GARMENT.upper()


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


def screen(height_cm):
    code = "%s%03d" % (role.PREFIX, height_cm)
    black.fill(0)
    red.fill(0)
    red.fill_rect(0, 0, E.W, 11, 1)
    centered(red, "DRIP TAG: " + LABEL, 2, 1, 0)  # white text cut out of red
    w = code128.width_modules(code128.encode(code)) * 2
    code128.draw(black, code, (E.W - w) // 2, 15, 52, module=2)
    centered(black, code, 70, 2)
    centered(red, "no height sensor" if height_cm == NO_SENSOR else "height %d cm" % height_cm, 93)
    return code, epd.show(bbuf, rbuf)


poll = select.poll()
poll.register(sys.stdin, select.POLLIN)


def drain_stdin():  # the laptop may send old bridge commands; not needed any more
    while poll.poll(0):
        sys.stdin.readline()


def elapsed(t):
    return time.ticks_diff(time.ticks_ms(), t)


def zone_of(cm, margin=0):
    """Which spot a height is in (head/body/feet/out). margin = must be this far inside it."""
    if cm == NO_SENSOR:
        return "none"
    for name, (lo, hi) in config.ZONES_MM.items():
        if lo // 10 + margin <= cm <= hi // 10 - margin:
            return name
    if cm > max(hi for lo, hi in config.ZONES_MM.values()) // 10 + margin:
        return "out"
    return None  # sitting right on a boundary: don't decide yet


print("ROLE", role.GARMENT, role.PREFIX)
boot = time.ticks_ms()
last_blink = last_dist = last_sample = time.ticks_ms()
recent = []           # last few height readings (mm) for a steady median
shown_cm = None       # height currently printed in the barcode
candidate, candidate_since = None, time.ticks_ms()
last_refresh = None
while True:
    drain_stdin()
    if elapsed(last_blink) > 500:
        last_blink = time.ticks_ms()
        led.toggle()

    if sensor:
        sensor.poll()
        if sensor.mm is not None and elapsed(last_sample) >= 200:
            last_sample = time.ticks_ms()
            recent = (recent + [sensor.mm])[-config.SMOOTH_SAMPLES:]
        if elapsed(last_dist) > 1000:
            last_dist = time.ticks_ms()
            if sensor.mm is not None:
                print("DIST", sensor.mm)

    no_sensor = sensor is None or (sensor.frames == 0 and elapsed(boot) > config.SENSOR_GRACE_MS)
    if no_sensor:
        target = NO_SENSOR
    elif recent:
        target = min(sorted(recent)[len(recent) // 2] // 10, 998)  # median, mm -> cm
    else:
        target = None  # sensor starting up

    if target is not None:
        if candidate is None or abs(target - candidate) >= config.CHANGE_CM:
            candidate, candidate_since = target, time.ticks_ms()  # new value: let it settle first
        settled = elapsed(candidate_since) >= config.HOLD_MS
        # Only redraw when the garment moved to a DIFFERENT spot (head/body/feet). Jitter inside
        # a spot never touches the e-ink, so the barcode stays still while you hold it in place.
        new_zone = zone_of(candidate, config.HYSTERESIS_CM)
        changed = shown_cm is None or (new_zone is not None and new_zone != zone_of(shown_cm))
        if settled and changed and (last_refresh is None or elapsed(last_refresh) >= config.MIN_REFRESH_MS):
            last_refresh = time.ticks_ms()
            code, ok = screen(candidate)
            print("STATE", code, "sent" if ok else "display busy, retrying")
            if ok:
                shown_cm = candidate
    time.sleep_ms(50)
