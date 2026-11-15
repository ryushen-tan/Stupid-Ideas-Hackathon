# Shared by the Pico (MicroPython) AND the laptop server (server.py imports this file).
# If you change SECRET, re-copy this file to the Pico.

# --- Clothing-tag mode (main.py) ---
# The sensor rides on the garment pointing DOWN at the floor, so its reading = garment height.
# Drip's arrangement says where each garment goes (head / body / feet); the laptop bridge
# (drip_bridge.py) tells each Pico. The barcode shows only while the garment is at that height.
# Ranges assume a ~170 cm person and are deliberately wide for the demo.
ZONES_MM = {
    "head": (1300, 2600),   # hat height: ~150-175 cm
    "body": (650, 1450),    # torso / waist
    "feet": (0, 650),       # legs / shoes (near the floor the sensor reads "too close" = 0)
}
HOLD_MS = 1500           # height must stay in/out of the zone this long before the screen changes
SENSOR_GRACE_MS = 8000   # no sensor frames by then = sensor missing -> barcode always shown
# Seeed recommends >= 180 s between refreshes of this tri-color panel; frequent refreshes wear it out.
# 30 s keeps the demo usable. Raise it if the panel will run for long periods.
MIN_REFRESH_MS = 30_000

# --- Old one-time-code mode (only server.py/totp.py still use these) ---
SECRET = b"stupid-hackathon-change-me"
PERIOD = 180
DIGITS = 8

# Seeed Grove Triple Color E-Ink 2.13" talks UART. Pico GPIO numbers (GP#, not pin numbers):
UART_ID = 0
PIN_TX = 0   # Pico GP0 (physical pin 1)  -> e-ink RX
PIN_RX = 1   # Pico GP1 (physical pin 2)  <- e-ink TX
