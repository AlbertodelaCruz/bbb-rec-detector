#!/usr/bin/env python3
"""Genera icon16/48/128.png: fondo oscuro con punto de grabación rojo. Sin dependencias."""
import struct, zlib, os

def png(path, size):
    cx = cy = (size - 1) / 2
    r = size * 0.34
    ring = size * 0.46
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filtro None por fila
        for x in range(size):
            dx, dy = x - cx, y - cy
            d = (dx * dx + dy * dy) ** 0.5
            if d <= r:
                px = (229, 57, 53, 255)        # punto rojo (REC)
            elif d <= ring:
                px = (255, 255, 255, 255)       # anillo blanco
            else:
                px = (13, 27, 42, 255)          # fondo azul oscuro
            raw += bytes(px)

    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", idat))
        f.write(chunk(b"IEND", b""))

here = os.path.join(os.path.dirname(__file__), "icons")
for s in (16, 48, 128):
    png(os.path.join(here, f"icon{s}.png"), s)
    print(f"icon{s}.png")
