#!/usr/bin/env python3
"""Рисует иконки приложения без внешних зависимостей (только stdlib).

Запуск: python3 tools/make_icon.py
Результат: mobile/assets/{icon,splash,adaptive-icon,favicon}.png
"""
from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "mobile" / "assets"

GREEN = (15, 61, 46, 255)
GREEN_DARK = (11, 46, 35, 255)
LIME = (201, 240, 107, 255)
WHITE = (255, 255, 255, 255)
DIMPLES = (214, 228, 210, 255)


def _blend(data: bytearray, width: int, x: int, y: int, color, alpha: float) -> None:
    if alpha <= 0 or x < 0 or y < 0 or x >= width:
        return
    index = (y * width + x) * 4
    if index + 3 >= len(data):
        return
    dst_a = data[index + 3] / 255.0
    out_a = alpha + dst_a * (1 - alpha)
    if out_a <= 0:
        return
    for channel in range(3):
        src = color[channel] / 255.0
        dst = data[index + channel] / 255.0
        data[index + channel] = int(round(((src * alpha + dst * dst_a * (1 - alpha)) / out_a) * 255))
    data[index + 3] = int(round(out_a * 255))


class Canvas:
    def __init__(self, size: int, background=None):
        self.size = size
        self.data = bytearray(bytes(background) * (size * size) if background else bytes(size * size * 4))

    def rect(self, x0: float, y0: float, x1: float, y1: float, color) -> None:
        for y in range(max(0, int(y0)), min(self.size, int(math.ceil(y1)))):
            for x in range(max(0, int(x0)), min(self.size, int(math.ceil(x1)))):
                self._set(x, y, color, 1.0)

    def circle(self, cx: float, cy: float, radius: float, color) -> None:
        for y in range(max(0, int(cy - radius - 2)), min(self.size, int(cy + radius + 2))):
            for x in range(max(0, int(cx - radius - 2)), min(self.size, int(cx + radius + 2))):
                distance = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
                self._set(x, y, color, min(1.0, max(0.0, radius - distance + 0.5)))

    def triangle(self, p1, p2, p3, color) -> None:
        xs = [p1[0], p2[0], p3[0]]
        ys = [p1[1], p2[1], p3[1]]
        for y in range(max(0, int(min(ys))), min(self.size, int(max(ys)) + 1)):
            for x in range(max(0, int(min(xs))), min(self.size, int(max(xs)) + 1)):
                hits = 0
                for sx, sy in ((0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)):
                    if _inside(x + sx, y + sy, p1, p2, p3):
                        hits += 1
                if hits:
                    self._set(x, y, color, hits / 4.0)

    def _set(self, x: int, y: int, color, alpha: float) -> None:
        if 0 <= x < self.size and 0 <= y < self.size:
            _blend(self.data, self.size, x, y, color, alpha)

    def save(self, path: Path) -> None:
        raw = bytearray()
        for y in range(self.size):
            raw.append(0)
            raw += self.data[y * self.size * 4:(y + 1) * self.size * 4]

        def chunk(tag: bytes, payload: bytes) -> bytes:
            body = tag + payload
            return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

        png = b"\x89PNG\r\n\x1a\n"
        png += chunk(b"IHDR", struct.pack(">IIBBBBB", self.size, self.size, 8, 6, 0, 0, 0))
        png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        png += chunk(b"IEND", b"")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(png)


def _inside(px: float, py: float, a, b, c) -> bool:
    def sign(p, q, r):
        return (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])
    d1, d2, d3 = sign((px, py), a, b), sign((px, py), b, c), sign((px, py), c, a)
    has_neg = d1 < 0 or d2 < 0 or d3 < 0
    has_pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (has_neg and has_pos)


def draw_mark(canvas: Canvas, scale: float = 1.0, offset: float = 0.0) -> None:
    """Мяч и флаг в системе координат 0..1, с масштабом вокруг центра."""
    size = canvas.size

    def point(x: float, y: float):
        return ((x - 0.5) * scale + 0.5 + offset) * size, ((y - 0.5) * scale + 0.5 + offset) * size

    # флагшток
    pole_x0, pole_y0 = point(0.626, 0.28)
    pole_x1, pole_y1 = point(0.662, 0.745)
    canvas.rect(pole_x0, pole_y0, pole_x1, pole_y1, LIME)

    # полотнище
    canvas.triangle(point(0.662, 0.285), point(0.662, 0.445), point(0.505, 0.365), LIME)

    # лунка-тень под мячом
    cx, cy = point(0.385, 0.735)
    canvas.circle(cx, cy, 0.155 * size * scale, GREEN_DARK)

    # мяч
    cx, cy = point(0.375, 0.69)
    canvas.circle(cx, cy, 0.142 * size * scale, WHITE)

    # димплы
    for dx, dy, r in (
        (-0.055, -0.035, 0.014), (0.02, -0.062, 0.012), (-0.012, 0.05, 0.013),
        (0.062, 0.012, 0.011), (-0.07, 0.03, 0.009), (0.035, 0.062, 0.010),
        (0.005, -0.005, 0.008),
    ):
        px, py = point(0.375 + dx, 0.69 + dy)
        canvas.circle(px, py, r * size * scale, (233, 240, 230, 255))


def main() -> int:
    # иконка приложения
    icon = Canvas(1024, GREEN)
    draw_mark(icon, 1.0)
    icon.save(OUT / "icon.png")

    # adaptive icon: прозрачный фон, знак в безопасной зоне
    adaptive = Canvas(1024, None)
    draw_mark(adaptive, 0.72)
    adaptive.save(OUT / "adaptive-icon.png")

    # splash: фон + знак меньшего размера
    splash = Canvas(1024, GREEN)
    draw_mark(splash, 0.55)
    splash.save(OUT / "splash.png")

    # favicon
    favicon = Canvas(64, GREEN)
    draw_mark(favicon, 0.94)
    favicon.save(OUT / "favicon.png")

    print(f"иконки записаны в {OUT}")
    for name in ("icon.png", "adaptive-icon.png", "splash.png", "favicon.png"):
        print(f"  {name}: {(OUT / name).stat().st_size} байт")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
