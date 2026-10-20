"""Builds the into-the-screen base room (ADR-C11, M5.6; owner approved the mockup 2026-10-20).

Sources: the Warped "alien-environment" background and back structures. The room is the same
art drawn in perspective (derived): side walls and far wall sample the base's back wall, the
floor and ceiling are shaded in its colours. The core, the electric barrier and the marine
seen from behind are drawn by Claude (there is no back view of the marine in the pack).

The projection matches BASE.projection in src/config/tuning.ts: centre x 160, floor y 176 at
the near edge and 104 at the far wall, far wall at 0.3 of near size, room 240 px tall.
Outputs (all used by build_assets.py):
  room(...)          320×176 room without the core and barrier
  core()             2 frames 28×28: the far wall's glowing core, pulsing
  barrier()          2 frames 96×72: the electric barrier in front of the far wall
  turret()           2 frames 16×14: a wall turret, its eye dark and then lit as it fires
  marine_back()      4 frames 24×40: standing, two running steps, crouching
"""
import math

import png

W, H = 320, 176
CX, NEAR_Y, FAR_Y, FAR_SCALE, ROOM_H = 160, 176, 104, 0.3, 240
CLEAR = (0, 0, 0, 0)


def scale(z: float) -> float:
    return 1 / (1 + z * (1 / FAR_SCALE - 1))


VANISH_Y = (FAR_Y - NEAR_Y * FAR_SCALE) / (1 - FAR_SCALE)


def floor_y(z: float) -> float:
    return VANISH_Y + (NEAR_Y - VANISH_Y) * scale(z)


# The far wall's rectangle on screen.
FX0, FX1 = CX - CX * FAR_SCALE, CX + CX * FAR_SCALE
FY0, FY1 = FAR_Y - ROOM_H * FAR_SCALE, FAR_Y


def shade(c: tuple, k: float) -> tuple:
    return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)


def over(base: png.Image, top: png.Image) -> png.Image:
    return [[t if t[3] else b for b, t in zip(br, tr)] for br, tr in zip(base, top)]


def room(background_path: str, structures_path: str) -> png.Image:
    back = png.read(background_path)
    structures = png.read(structures_path)
    bw, bh = len(back[0]), len(back)
    tex = over([[back[y][x % bw] for x in range(len(structures[0]))] for y in range(bh)], structures)
    tw, th = len(tex[0]), len(tex)
    img = [[(6, 14, 22, 255)] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if FX0 <= x < FX1 and FY0 <= y < FY1:
                # The far wall: the back structures, a little darker.
                p = tex[int((y - FY0) / (FY1 - FY0) * (th - 1))][int((x - FX0) / (FX1 - FX0) * 200) % tw]
                img[y][x] = shade(p, 0.7)
                continue
            # Which wall is this pixel on? Find the depth where the room's outline passes it.
            side = x < FX0 or x >= FX1
            if side:
                # On a side wall, screen x fixes the depth: x = CX ± CX × scale.
                s = (CX - x) / CX if x < FX0 else (x - CX) / CX
                z = (1 / s - 1) / (1 / FAR_SCALE - 1)
                top = floor_y(z) - ROOM_H * s
                bot = floor_y(z)
                if top <= y < bot:
                    v = (y - top) / (bot - top)
                    col = int(z * 260) % tw
                    if x >= FX1:
                        col = tw - 1 - col
                    img[y][x] = shade(tex[int(v * (th - 1))][col], 0.45 + 0.55 * s)
                    continue
            if y >= FY1:
                # Floor: plank bands that shrink into the distance, lit nearer the front.
                s = (y - VANISH_Y) / (NEAR_Y - VANISH_Y)
                z = (1 / s - 1) / (1 / FAR_SCALE - 1)
                band = int(z * 14) % 2
                c = (44, 56, 50) if band else (32, 42, 38)
                img[y][x] = shade(c, 0.6 + 0.5 * s)
            elif y < FY0:
                img[y][x] = shade((14, 30, 40), 0.5 + 0.5 * (y / FY0))
    # Floor seams running into the room.
    for k in range(-4, 5):
        for y in range(int(FY1), H):
            s = (y - VANISH_Y) / (NEAR_Y - VANISH_Y)
            x = int(CX + k * 40 * s)
            if 0 <= x < W:
                img[y][x] = (66, 86, 72, 255)
    return img


def core() -> png.Image:
    frames = []
    for glow in (1.0, 0.75):
        f = [[CLEAR] * 28 for _ in range(28)]
        for y in range(28):
            for x in range(28):
                d = math.hypot(x - 13.5, y - 13.5)
                if d <= 10.5:
                    g = max(0.0, 1 - d / 10.5) * glow
                    f[y][x] = (int(40 + 130 * g), int(140 + 110 * g), int(40 + 70 * g), 255)
                elif d <= 13:
                    f[y][x] = (64, 72, 70, 255) if (x + y) % 4 else (40, 46, 44, 255)
        frames.append(f)
    return png.strip(frames)


def barrier() -> png.Image:
    frames = []
    for phase in (0, 1):
        f = [[CLEAR] * 96 for _ in range(72)]
        for y in range(72):
            for x in range(96):
                wave = abs(math.sin(y * 0.45 + x * 0.06 + phase * 1.7)) < 0.07
                dots = (y * 7 + x * 3 + phase * 5) % 23 == 0
                if wave or dots:
                    f[y][x] = (120, 230, 255, 200)
        frames.append(f)
    return png.strip(frames)


def turret() -> png.Image:
    """A wall turret drawn by Claude in the room's steel colours: housing, barrel and red eye."""
    frames = []
    for lit in (False, True):
        f = [[CLEAR] * 16 for _ in range(14)]
        for y in range(14):
            for x in range(16):
                inside = 1 <= x <= 14 and 1 <= y <= 10
                edge = inside and (x in (1, 14) or y in (1, 10))
                if edge:
                    f[y][x] = (22, 26, 30, 255)
                elif inside:
                    f[y][x] = (92, 102, 108, 255) if y < 5 else (66, 74, 80, 255)
        for y in range(10, 14):  # the barrel, pointing out of the wall at him
            for x in range(6, 10):
                f[y][x] = (40, 44, 48, 255) if x in (6, 9) else (120, 128, 132, 255)
        eye = (255, 236, 120, 255) if lit else (200, 50, 40, 255)
        for y in range(4, 7):
            for x in range(6, 10):
                f[y][x] = eye
        frames.append(f)
    return png.strip(frames)


# The marine seen from behind (owner chose this refined version, 2026-10-20): drawn by Claude
# as a pixel map in the side-view marine's own palette (space-marine-lite's colours), so he
# reads as the same character. 24×40 frames; one character per pixel.
PAL = {
 '.': (0,0,0,0), 'o': (22,10,31,255),
 'H': (222,196,179,255), 'h': (202,164,146,255), 's': (147,103,91,255), 'd': (97,62,57,255),
 'O': (224,128,47,255), 'M': (196,91,30,255), 'N': (155,56,19,255), 'r': (125,35,14,255), 'R': (70,12,31,255),
 'G': (79,68,45,255), 'g': (127,116,88,255), 'l': (177,159,119,255),
 'K': (41,27,52,255), 'k': (115,94,130,255),
}
HEAD = [
 ".........oooooo.........",
 "........oHHHHhho........",
 ".......oHHHHHHhso.......",
 "......oHHHHHHhhhso......",
 "......oHHHHHhhhhso......",
 "......oHHHHhhhhsso...o..",
 "......ohHHhhhhhssdo.olo.",
 "......ohhhhhhhsssdo.ogo.",
 ".......ohhhhssssdo.ogGo.",
 "........osssssddo..oGo..",
]
BODY = [
 "....ooooRRRRRRRRoooogGo.",
 "...oMOOoHHHHHHhhoOOoGo..",
 "..oNMOOoHHhhhhhsoOOogGo.",
 "..oNMOMohhhhhhhsoMOoGo..",
 "..oNMMMohhhhhhssoMhhGo..",
 "..oNMMMohsssssssoMhho...",
 "..orNMMohhhhhhssoMNNo...",
 "..orNNMohsssssssoNNro...",
 "...orNMooddddddoorNro...",
 "...ohhoMMNNrrNNMMohho...",
 "...ossoMMNNRRNNMMosso...",
 "....oooRRRRooRRRRooo....",
 "....okkkoooooooookko....",
]
LEGS = {
 'stand': [
 ".....oMMMNo..oNMMMo.....",
 ".....oMOMNo..oNMOMo.....",
 ".....oMOMNo..oNMOMo.....",
 ".....oMMNro..orNMMo.....",
 ".....ohhsso..ohhsso.....",
 ".....oMMNro..orNMMo.....",
 ".....oMMNro..orNMMo.....",
 ".....orNNRo..oRNNro.....",
 "....oKKKKKo..oKKKKKo....",
 "....okKKKKo..okKKKKo....",
 "....oooooo....oooooo....",
 ],
 'left': [
 ".....oMMMNo..oNMMMo.....",
 ".....oMOMNo..oNMOMo.....",
 ".....oMMNro..oNMOMo.....",
 ".....ohhsso..orNMMo.....",
 ".....oMMNro..ohhsso.....",
 ".....orNNRo..orNMMo.....",
 "....oKKKKKo..orNMMo.....",
 "....okKKKKo..oRNNro.....",
 "....oooooo..oKKKKKo.....",
 "............okKKKKo.....",
 "............oooooo......",
 ],
}
LEGS['right'] = [row[::-1] for row in LEGS['left']]
CROUCH_LEGS = [
 "....oMMMNro..orNMMMo....",
 "...oMOMNNRo..oRNNMOMo...",
 "...ohhssooo..ooosshho...",
 "...oKKKKKKo..oKKKKKKo...",
 "...okKKKKKo..okKKKKKo...",
 "...ooooooo....ooooooo...",
]


def _frame(rows: list[str]) -> png.Image:
    padded = ["." * 24] * (40 - len(rows)) + rows
    return [[PAL[c] for c in r.ljust(24, ".")[:24]] for r in padded]


def marine_back() -> png.Image:
    """Standing, two running steps, crouching."""
    return png.strip(
        [
            _frame(HEAD + BODY + LEGS["stand"]),
            _frame(HEAD + BODY + LEGS["left"]),
            _frame(HEAD + BODY + LEGS["right"]),
            _frame(HEAD + BODY + CROUCH_LEGS),
        ]
    )
