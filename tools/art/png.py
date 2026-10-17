"""Minimal PNG reader and writer (8-bit, non-interlaced), so the art tools need no packages.

Pixels are lists of rows of (r, g, b, a) tuples.
"""
import struct
import zlib

SIGNATURE = b"\x89PNG\r\n\x1a\n"
Pixel = tuple[int, int, int, int]
Image = list[list[Pixel]]


def read(path: str) -> Image:
    data = open(path, "rb").read()
    if data[:8] != SIGNATURE:
        raise ValueError(f"not a PNG: {path}")
    pos, idat, plte, trns = 8, b"", None, None
    width = height = depth = color = interlace = 0
    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos : pos + 4])
        kind, body = data[pos + 4 : pos + 8], data[pos + 8 : pos + 8 + length]
        pos += 12 + length
        if kind == b"IHDR":
            width, height, depth, color, _, _, interlace = struct.unpack(">IIBBBBB", body)
        elif kind == b"PLTE":
            plte = [tuple(body[i : i + 3]) for i in range(0, length, 3)]
        elif kind == b"tRNS":
            trns = body
        elif kind == b"IDAT":
            idat += body
    if depth != 8 or interlace != 0:
        raise ValueError(f"unsupported PNG (bit depth {depth}, interlace {interlace}): {path}")
    channels = {6: 4, 2: 3, 3: 1, 0: 1, 4: 2}[color]
    raw, stride = zlib.decompress(idat), width * channels
    rows, prev, k = [], bytearray(stride), 0
    for _ in range(height):
        filt, line = raw[k], bytearray(raw[k + 1 : k + 1 + stride])
        k += 1 + stride
        for x in range(stride):
            a = line[x - channels] if x >= channels else 0
            b = prev[x]
            c = prev[x - channels] if x >= channels else 0
            if filt == 1:
                line[x] = (line[x] + a) & 255
            elif filt == 2:
                line[x] = (line[x] + b) & 255
            elif filt == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif filt == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(line)
        prev = line
    out: Image = []
    for r in rows:
        row = []
        for x in range(width):
            if color == 6:
                row.append(tuple(r[x * 4 : x * 4 + 4]))
            elif color == 2:
                row.append(tuple(r[x * 3 : x * 3 + 3]) + (255,))
            elif color == 3:
                i = r[x]
                alpha = trns[i] if trns and i < len(trns) else 255
                row.append(plte[i] + (alpha,))
            elif color == 0:
                row.append((r[x], r[x], r[x], 255))
            else:
                row.append((r[x * 2], r[x * 2], r[x * 2], r[x * 2 + 1]))
        out.append(row)
    return out


def write(path: str, img: Image) -> None:
    height, width = len(img), len(img[0])
    raw = b"".join(b"\x00" + bytes(v for px in row for v in px) for row in img)

    def chunk(kind: bytes, body: bytes) -> bytes:
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(SIGNATURE + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def strip(frames: list[Image]) -> Image:
    """Joins equally sized frames left to right into one sprite sheet row."""
    h, w = len(frames[0]), len(frames[0][0])
    for f in frames:
        if len(f) != h or len(f[0]) != w:
            raise ValueError("frames differ in size")
    return [[px for f in frames for px in f[y]] for y in range(h)]
