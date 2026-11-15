# Shared by the Pico (MicroPython) AND the laptop server (server.py imports this file).
# If you change SECRET, re-copy this file to the Pico.

# --- Clothing-tag mode (main.py) ---
# The sensor rides on the garment pointing DOWN at the floor, so its reading = garment height.
# Drip's arrangement says where each garment goes (head / body / feet); the laptop bridge
# (drip_bridge.py) tells each Pico. The barcode shows only while the garment is at that height.
# Calibrated on the demo stand (hat ~46 cm, shirt ~20 cm); boundaries sit halfway between.
ZONES_MM = {
    "head": (330, 1000),    # hat: measured ~46 cm on the demo stand
    "body": (120, 330),     # shirt / hoodie: measured ~20 cm
    "feet": (0, 120),       # lowest spot (near the floor the sensor reads "too close" = 0)
}
SMOOTH_SAMPLES = 5       # median of the last 5 readings (~1 s) so the height doesn't jitter
CHANGE_CM = 3            # a new reading must differ by this much to restart the settle timer
HYSTERESIS_CM = 2        # must be 2 cm inside a new spot before the barcode is redrawn
HOLD_MS = 500            # height must stay in/out of the zone this long before the screen changes
SENSOR_GRACE_MS = 8000   # no sensor frames by then = sensor missing -> barcode always shown
# Seeed recommends >= 180 s between refreshes of this tri-color panel; frequent refreshes wear it out.
# Redraws happen only when the garment changes spot; at most one every 3 s (+ ~15 s panel redraw).
MIN_REFRESH_MS = 3_000

# --- Old one-time-code mode (only server.py/totp.py still use these) ---
SECRET = b"stupid-hackathon-change-me"
PERIOD = 180
DIGITS = 8

# Seeed Grove Triple Color E-Ink 2.13" talks UART. Pico GPIO numbers (GP#, not pin numbers):
UART_ID = 0
PIN_TX = 0   # Pico GP0 (physical pin 1)  -> e-ink RX
PIN_RX = 1   # Pico GP1 (physical pin 2)  <- e-ink TX
