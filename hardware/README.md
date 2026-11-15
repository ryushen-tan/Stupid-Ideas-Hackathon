# Stupid Barcode Authenticator (hardware)

Google Authenticator, but worse: a Raspberry Pi Pico shows a one-time code **as a barcode**
on a tri-color e-ink screen. You "type" it by scanning it with a USB barcode scanner.

```
 ┌──────────── laptop ────────────┐
 │  server.py  ◄── USB ──  Pico ──jumpers──► 2.13" e-ink (shows barcode)
 │  scan page  ◄── USB ──  barcode scanner (acts like a keyboard)
 └────────────────────────────────┘
```

## 1. Wiring (4 wires)

The screen is a **Seeed Grove Triple Color E-Ink 2.13"** (104×212). It has its own chip and talks
**UART**, so it only needs 4 wires. With the Pico's USB port pointing **left**, physical pins 1–20 run
left to right along the bottom, and pins 40–21 run left to right along the top.

| E-ink label | Pico pin | Where |
|---|---|---|
| VCC | **36** (3V3(OUT)) | top row, 5th from the left. **Not** 40 (5V) or 37 (3V3_EN) |
| GND | **3** (GND) | bottom row, 3rd from the left |
| TX  | **2** (GP1 = UART0 RX) | bottom row, 2nd from the left |
| RX  | **1** (GP0 = UART0 TX) | bottom row, 1st from the left |

TX and RX cross over. If the screen never changes, swap those two wires; that can't damage anything.
Keep VCC on 3.3V: the board's TX/RX lines are pulled up to its VCC, so on 5V it would push 5V into the Pico.

**How the screen talks** (worked out on the hardware; Seeed doesn't document it): it sends `c` nonstop
when ready. We send one `a`, and it switches to printing `UART_recv_func` / `LOOPING` while it waits for
5,512 image bytes. Then it goes quiet, redraws (~15 s), and goes back to `c`. It sends characters with
**no gap between them**, so the Pico's hardware UART reads garbage. The driver records the raw RX line
with PIO instead (`eink_seeed.py`). **Refresh at most once every 180 s** (Seeed's warning), which is why
codes last 3 minutes and scan results only show on the web page.
The scanner plugs into the **laptop**, not the Pico. It acts as a USB keyboard: it types the code,
then presses Enter.

## 2. Put MicroPython on the Pico (one time)

1. Download the MicroPython `.uf2` for your board: https://micropython.org/download/RPI_PI_PICO/
   (use the `RPI_PI_PICO_W` or `RPI_PI_PICO2` page if that's what you have).
2. Hold **BOOTSEL**, plug the Pico in, and let go. A drive called `RPI-RP2` appears.
3. Drag the `.uf2` onto it. The Pico reboots.

## 3. Copy the firmware

```bash
pip install mpremote pyserial
cd hardware/pico
mpremote cp config.py totp.py code128.py eink_seeed.py main.py :
mpremote reset
```

The screen flashes for about 15 seconds (normal for tri-color e-ink) and then shows **WAITING FOR LAPTOP SYNC**.

## 4. Run it

```bash
cd hardware
python3 server.py          # finds the Pico on USB and sets its clock
open http://localhost:8787
```

- After the clock sync, the screen shows a barcode with the code under it. A new code appears every 3 minutes.
- Click the web page once, then scan the barcode with the scanner.
- The page shows **ACCESS GRANTED** or **DENIED**, along with the exact code that was scanned.
- Each code works only once. Codes from the previous 3-minute window are still accepted, because the
  e-ink refresh is slow.

Only one program can use the Pico's USB port at a time. **Quit `server.py` before running
`mpremote`**, and close Thonny before starting the server.

## Using it from the main app (e.g. after Google sign-in)

```js
const r = await fetch("http://localhost:8787/api/verify", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code: scannedText }),
}).then((r) => r.json());   // { ok: true|false, reason: "valid" | "wrong code" | "already used ..." }
```

CORS only allows `http://localhost:3000` by default. Set `ALLOWED_ORIGIN=http://localhost:5173 python3 server.py`
(or whatever URL the app runs on) to change it. Your input field gets the scanned text automatically, because the scanner types it and presses Enter.

## No hardware? Simulate it

`python3 simulate.py` runs the real `pico/main.py` with fake hardware. It saves exactly what the screen
would show as `preview_*.ppm` and, if `zbarimg` is installed (`brew install zbar`), decodes the barcode.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `E-INK: no 'c'` / `no 'b'` in the Pico log | Swap the TX/RX wires. Check that VCC is on pin 36. Unplug and replug the e-ink VCC wire to reset it |
| Text looks mirrored or upside down | The barcode still scans either way. Rotate the screen. |
| Every scan says "wrong code" | Is `server.py` running and connected to the Pico? The clock is set over USB. `SECRET` must be the same file on both. |
| Scanner types into the wrong window | Click the scan page first. The scanner is just a keyboard. |
