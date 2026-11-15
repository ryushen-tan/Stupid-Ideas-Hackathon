# TOTP-style one-time codes (RFC 6238 shape, HMAC-SHA256).
# Runs unchanged on MicroPython (Pico) and CPython (laptop server).
import hashlib


def _hmac_sha256(key, msg):
    if len(key) > 64:
        key = hashlib.sha256(key).digest()
    key = key + b"\x00" * (64 - len(key))
    inner = hashlib.sha256(bytes(b ^ 0x36 for b in key) + msg).digest()
    return hashlib.sha256(bytes(b ^ 0x5C for b in key) + inner).digest()


def code_at(secret, counter, digits):
    h = _hmac_sha256(secret, counter.to_bytes(8, "big"))
    off = h[-1] & 0x0F
    n = ((h[off] & 0x7F) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]
    s = str(n % (10 ** digits))
    return "0" * (digits - len(s)) + s


def counter_for(unix_time, period):
    return int(unix_time) // period
