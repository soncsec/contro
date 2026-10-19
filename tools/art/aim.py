"""Derives diagonal aiming frames (45° up, and 45° down for M3.13) for the marine by rotating
his front arms and gun.

The region in front of the torso (arms and rifle) is cut out, rotated about the shoulder
with a RotSprite-style method (Scale2x three times, rotate, sample), and pasted back.
Used by build_assets.py ("aim:" entries). Derived art (ARCHITECTURE.md ADR-C04).
"""
import math

import png

CLEAR = (0, 0, 0, 0)
FLASH = {(255, 156, 42), (255, 235, 162), (255, 85, 0)}


def scale2x(img: png.Image) -> png.Image:
    h, w = len(img), len(img[0])
    out = [[CLEAR] * (w * 2) for _ in range(h * 2)]

    def at(x: int, y: int) -> png.Pixel:
        return img[min(max(y, 0), h - 1)][min(max(x, 0), w - 1)]

    for y in range(h):
        for x in range(w):
            e, b, d, f, hh = at(x, y), at(x, y - 1), at(x - 1, y), at(x + 1, y), at(x, y + 1)
            e0 = e1 = e2 = e3 = e
            if b != hh and d != f:
                e0 = d if d == b else e
                e1 = f if b == f else e
                e2 = d if d == hh else e
                e3 = f if hh == f else e
            out[2 * y][2 * x], out[2 * y][2 * x + 1] = e0, e1
            out[2 * y + 1][2 * x], out[2 * y + 1][2 * x + 1] = e2, e3
    return out


def rotate(layer: png.Image, degrees: float, pivot: tuple[float, float]) -> png.Image:
    """Rotates a layer about pivot (pixel coordinates). Negative degrees turn it upward."""
    big = scale2x(scale2x(scale2x(layer)))
    k = 8
    h, w = len(layer), len(layer[0])
    a = math.radians(degrees)
    ca, sa = math.cos(a), math.sin(a)
    cx, cy = pivot
    out = [[CLEAR] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            sx, sy = ca * dx + sa * dy + cx, -sa * dx + ca * dy + cy
            bx, by = int(sx * k), int(sy * k)
            if 0 <= bx < w * k and 0 <= by < h * k:
                out[y][x] = big[by][bx]
    return out


def aim_diagonal(
    frame: png.Image,
    region: tuple[int, int, int, int],
    pivot: tuple[float, float],
    degrees: float = -45,
    keep_flash: bool = True,
) -> png.Image:
    """Cuts region (x0, y0, x1, y1 inclusive) out of the frame, rotates it about pivot,
    and pastes it back over the rest of the frame."""
    x0, y0, x1, y1 = region
    h, w = len(frame), len(frame[0])
    arm = [[CLEAR] * w for _ in range(h)]
    body = [row[:] for row in frame]
    for y in range(h):
        for x in range(w):
            c = frame[y][x]
            if not c[3]:
                continue
            in_region = x0 <= x <= x1 and y0 <= y <= y1
            if c[:3] in FLASH:
                body[y][x] = CLEAR
                if keep_flash:
                    arm[y][x] = c
            elif in_region:
                arm[y][x] = c
                body[y][x] = CLEAR
    turned = rotate(arm, degrees, pivot)
    return [[turned[y][x] if turned[y][x][3] else body[y][x] for x in range(w)] for y in range(h)]


def barrel_tip(frame: png.Image) -> tuple[int, int]:
    """The rifle's tip in a frame facing right: the rightmost non-flash pixel (middle row)."""
    pts = [(x, y) for y, row in enumerate(frame) for x, c in enumerate(row) if c[3] and c[:3] not in FLASH]
    tip_x = max(x for x, _ in pts)
    rows = sorted(y for x, y in pts if x == tip_x)
    return tip_x, rows[len(rows) // 2]


# Measured on the standing shoot frame and applied relative to each frame's barrel tip:
# everything in front of the torso from 5 rows above to 4 rows below the barrel is arms and
# rifle (more rows below would catch the front leg in running frames), and rotating about a
# point just in front of the chest keeps the rifle off the visor.
REGION_X0 = 37
REGION_ABOVE, REGION_BELOW = 5, 4
PIVOT_X, PIVOT_BELOW = 39.5, 4.5
DIAGONAL = -45.0
# Aiming down while running (M3.13): the same cut, turned the other way.
DIAGONAL_DOWN = 45.0


def aim_frame(
    frame: png.Image, keep_flash: bool = True, degrees: float = DIAGONAL
) -> tuple[png.Image, tuple[int, int]]:
    """Diagonal version of a frame (up by default), and its new barrel tip (for bullets and the
    flash)."""
    tip_x, tip_y = barrel_tip(frame)
    region = (REGION_X0, tip_y - REGION_ABOVE, len(frame[0]) - 1, tip_y + REGION_BELOW)
    pivot = (PIVOT_X, tip_y + PIVOT_BELOW)
    out = aim_diagonal(frame, region, pivot, degrees, keep_flash)
    a = math.radians(degrees)
    dx, dy = tip_x + 0.5 - pivot[0], tip_y + 0.5 - pivot[1]
    nx = pivot[0] + math.cos(a) * dx - math.sin(a) * dy
    ny = pivot[1] + math.sin(a) * dx + math.cos(a) * dy
    return out, (int(nx), int(ny))


def rotate_whole(img: png.Image, degrees: float, size: tuple[int, int]) -> png.Image:
    """Rotates a small sprite about its centre onto a canvas of `size` (for bullets, flashes)."""
    w, h = size
    canvas = [[CLEAR] * w for _ in range(h)]
    ox, oy = (w - len(img[0])) // 2, (h - len(img)) // 2
    for y, row in enumerate(img):
        for x, c in enumerate(row):
            canvas[oy + y][ox + x] = c
    return rotate(canvas, degrees, (w / 2, h / 2))
