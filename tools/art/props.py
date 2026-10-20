"""Builds the corridor props tileset for Level 2 (owner approved the corridor mockup with props,
2026-10-19).

Source: the Warped "cyberpunk-detective-props" PNGs, pixels unchanged. Each prop sits in its own
cell of whole 16 px tiles, bottom-aligned (so it stands on the floor) and centred sideways:
  cryo pod (59×87)        cell 4×6 tiles at column 0
  server cabinets (65×55) cell 5×4 tiles at column 4 (bottom rows 2–5)
  small terminal (33×37)  cell 3×3 tiles at column 9 (bottom rows 3–5)
The image is 192×96 (12×6 tiles). tools/levels/corridor_section.py places them (PROPS).
Used by build_assets.py ("props").
"""
import png

TILE = 16
COLUMNS, ROWS = 12, 6
CLEAR = (0, 0, 0, 0)
# name: (file, first column, cell width in tiles, cell height in tiles)
PROPS = {
    "cryo": ("cryo-pod.png", 0, 4, 6),
    "servers": ("server-gabinetes.png", 4, 5, 4),
    "terminal": ("small-terminal.png", 9, 3, 3),
}


def build(props_dir: str) -> png.Image:
    out = [[CLEAR] * (COLUMNS * TILE) for _ in range(ROWS * TILE)]
    for file, col, w, h in PROPS.values():
        img = png.read(f"{props_dir}/{file}")
        iw, ih = len(img[0]), len(img)
        x0 = col * TILE + (w * TILE - iw) // 2
        y0 = ROWS * TILE - ih  # bottom-aligned
        if iw > w * TILE or ih > h * TILE:
            raise ValueError(f"{file} doesn't fit its cell")
        for y, row in enumerate(img):
            for x, px in enumerate(row):
                out[y0 + y][x0 + x] = px
    return out
