"""Draws the weapon pickup letters (M4.1): M for the machine gun, S for the spread.

Drawn by Claude for Contro (owner approved 2026-10-19): an 8×8 glyph in the style of the game's
Press Start 2P font, doubled to 16×16, filled with the weapon's colour in three shades from the
top, with a little texture and a very dark outline. Used by build_assets.py ("draw:letter-M").
"""
import png

CLEAR = (0, 0, 0, 0)
SIZE, PAD = 16, 2
N = SIZE + 2 * PAD


def hx(s: str) -> png.Pixel:
    return (int(s[1:3], 16), int(s[3:5], 16), int(s[5:7], 16), 255)


OUTL = hx("#07080b")
GLYPHS = {
    "M": ["XX...XX.", "XXX.XXX.", "XXXXXXX.", "XX.X.XX.", "XX...XX.", "XX...XX.", "XX...XX.", "........"],
    "S": [".XXXXX..", "XX...XX.", "XX......", ".XXXXX..", ".....XX.", "XX...XX.", ".XXXXX..", "........"],
}
# light, mid, dark
COLOURS = {
    "M": (hx("#7dfcb8"), hx("#22c77f"), hx("#108a55")),
    "S": (hx("#ff8f7a"), hx("#e0452f"), hx("#99231a")),
}


def noise(x: int, y: int) -> float:
    n = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return (n & 0xFFFF) / 0xFFFF


def build(letter: str) -> png.Image:
    shades = COLOURS[letter]
    img = [[CLEAR] * N for _ in range(N)]
    for gy, row in enumerate(GLYPHS[letter]):
        for gx, c in enumerate(row):
            if c != "X":
                continue
            for dy in range(2):
                for dx in range(2):
                    x, y = PAD + gx * 2 + dx, PAD + gy * 2 + dy
                    t = y / (SIZE + PAD)
                    shade = 0 if t < 0.35 else 1 if t < 0.7 else 2
                    if noise(x, y + 7) < 0.18:
                        shade = min(2, shade + 1)  # a little texture
                    img[y][x] = shades[shade]
    out = [r[:] for r in img]
    for y in range(N):
        for x in range(N):
            if img[y][x] == CLEAR and any(
                0 <= x + dx < N and 0 <= y + dy < N and img[y + dy][x + dx] != CLEAR
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
            ):
                out[y][x] = OUTL
    return out
