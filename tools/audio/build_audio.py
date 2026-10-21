#!/usr/bin/env python3
"""Builds public/assets/audio/ from the owner-approved CC0 audio packs and updates CREDITS.md.

Run from the repo root:  python3 tools/audio/build_audio.py <folder with the downloaded zips>

The packs are not committed (like legacy/ art). Download each zip from its page below into one
folder; this script checks every zip against its recorded SHA-256 before using it, reads only
the files named here (never running anything from the packs), and writes:
  - <key>.ogg for every sound (ARCHITECTURE.md ADR-C06), and
  - <key>.m4a as well when ffmpeg is installed, for iPhone Safari (owner approved 2026-10-19).
Music is re-encoded smaller when ffmpeg is installed. Owner approved every source 2026-10-19.
"""
import hashlib
import pathlib
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "public" / "assets" / "audio"
CREDITS = ROOT / "CREDITS.md"
START, END = "<!-- audio:start -->", "<!-- audio:end -->"

# zip name → (page, author, licence, SHA-256 of the zip as downloaded 2026-10-19)
PACKS = {
    "sci-fi_sounds.zip": ("https://opengameart.org/content/sci-fi-sounds", "Kenney", "CC0",
                          "119340f351a5098ad814f78719438c0da355a9ce8a4c8a3af6a8d48aa3d49e04"),
    "Digital_SFX_Set.zip": ("https://opengameart.org/content/63-digital-sound-effects-lasers-phasers-space-etc",
                            "Kenney", "CC0",
                            "022f0f4b73da55989567fe2b373c8af89d74f5d015257e293cab497ca606d063"),
    "cyber_runer_files.zip": ("https://opengameart.org/content/cyber-runner-music", "ansimuz (Luis Zuno)",
                              "CC0", "6e77afa36edc7d0d82788e2722588f9719f2b39f46768dda309b3c6c75ebb825"),
    "boss_fight_2_files.zip": ("https://opengameart.org/content/boss-fight-2", "ansimuz (Luis Zuno)", "CC0",
                               "c53911291539b7ccd209515c88ccbd008baa7d8f9e496bc2aa4dd827b45fb61b"),
    # Level 2's music (M4.5; owner approved 2026-10-19).
    "dark-happy-world.zip": ("https://opengameart.org/content/dark-happy-world", "ansimuz (Luis Zuno)", "CC0",
                             "c8f34eadc1f8beda5d1724f901ae7715daa158a67a33ae271cd5634bc50e151b"),
    # Level 3's music (M5.5; owner approved 2026-10-20). SHA-256 as downloaded 2026-10-20.
    "Ghost-Town-Files.zip": ("https://opengameart.org/content/gothicvania-ghost-town", "ansimuz (Luis Zuno)",
                             "CC0", "fdc9b04ecd7c76ea6c16f6e4a24b443cee002b1b722ffeafd33bb47b81e07b3c"),
    # The ending and credits (M5.4; owner approved 2026-10-20). Public domain per its licence file.
    "Heros_determination.zip": ("https://opengameart.org/content/heros-determination-theme",
                                "ansimuz (Luis Zuno)", "CC0",
                                "62546b1e7fefe4be37c54ea01d98235092fa79427f6dfa62d9d9b9a8cadd2998"),
}

# key → (zip, file inside it, kind). Keys match SOUNDS in src/assets/manifest.ts.
SOUNDS = {
    "sfx-shot": ("sci-fi_sounds.zip", "Audio/laserSmall_000.ogg", "sfx"),
    "sfx-enemy-hit": ("sci-fi_sounds.zip", "Audio/impactMetal_002.ogg", "sfx"),
    "sfx-enemy-die": ("sci-fi_sounds.zip", "Audio/explosionCrunch_000.ogg", "sfx"),
    "sfx-hurt": ("sci-fi_sounds.zip", "Audio/forceField_001.ogg", "sfx"),
    "sfx-player-die": ("sci-fi_sounds.zip", "Audio/lowFrequency_explosion_001.ogg", "sfx"),
    "sfx-enemy-shot": ("sci-fi_sounds.zip", "Audio/laserRetro_001.ogg", "sfx"),
    "sfx-cannon": ("sci-fi_sounds.zip", "Audio/laserLarge_002.ogg", "sfx"),
    "sfx-mortar": ("sci-fi_sounds.zip", "Audio/thrusterFire_001.ogg", "sfx"),
    "sfx-blast": ("sci-fi_sounds.zip", "Audio/explosionCrunch_003.ogg", "sfx"),
    "sfx-boss-blast": ("sci-fi_sounds.zip", "Audio/lowFrequency_explosion_000.ogg", "sfx"),
    "sfx-extra-life": ("Digital_SFX_Set.zip", "powerUp3.mp3", "sfx"),
    "sfx-blip": ("Digital_SFX_Set.zip", "threeTone2.mp3", "sfx"),
    "sfx-select": ("Digital_SFX_Set.zip", "phaserUp3.mp3", "sfx"),
    "music-level-1": ("cyber_runer_files.zip", "Cyber_runer_files/cyber_runner.ogg", "music"),
    "music-boss": ("boss_fight_2_files.zip", "Boss Fight 2 Files/Boss Fight 2.ogg", "music"),
    "music-level-2": ("dark-happy-world.zip", "dark-happy-world/dark-happy-world.ogg", "music"),
    "music-level-3": ("Ghost-Town-Files.zip", "ghost-town.ogg", "music"),
    "music-ending": ("Heros_determination.zip", "exports/determination.ogg", "music"),
}

MUSIC_OGG_QUALITY = "3"  # libvorbis -q:a (about 112 kbit/s): loops stay under 2 MB
M4A_BITRATE = {"sfx": "96k", "music": "112k"}


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *args], check=True)


def build(src: pathlib.Path) -> list[tuple[str, str, str]]:
    have_ffmpeg = shutil.which("ffmpeg") is not None
    for name, (_, _, _, digest) in PACKS.items():
        got = sha256(src / name)
        if got != digest:
            raise SystemExit(f"{name}: SHA-256 {got} is not the approved {digest}")
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        work = pathlib.Path(tmp)
        for key, (pack, inner, kind) in SOUNDS.items():
            raw = work / pathlib.PurePosixPath(inner).name
            with zipfile.ZipFile(src / pack) as z:
                raw.write_bytes(z.read(inner))
            ogg, m4a = OUT / f"{key}.ogg", OUT / f"{key}.m4a"
            if raw.suffix == ".ogg" and not (kind == "music" and have_ffmpeg):
                shutil.copyfile(raw, ogg)
                how = "unchanged"
            elif have_ffmpeg:
                quality = MUSIC_OGG_QUALITY if kind == "music" else "5"
                ffmpeg("-i", str(raw), "-vn", "-c:a", "libvorbis", "-q:a", quality, str(ogg))
                how = f"re-encoded to OGG Vorbis (quality {quality})"
            else:
                print(f"skipped {key}: {raw.suffix} needs ffmpeg to convert")
                continue
            page, author, licence, _ = PACKS[pack]
            source = f"[{pack}]({page}) `{inner}` by {author}, {licence}"
            rows.append((f"assets/audio/{ogg.name}", source, how))
            if have_ffmpeg:
                ffmpeg("-i", str(raw), "-vn", "-c:a", "aac", "-b:a", M4A_BITRATE[kind], str(m4a))
                rows.append((f"assets/audio/{m4a.name}", source, f"AAC (M4A) copy for iPhone Safari, {M4A_BITRATE[kind]}bit/s"))
            print(f"wrote {ogg.relative_to(ROOT)}")
    return rows


def update_credits(rows: list[tuple[str, str, str]]) -> None:
    table = "\n".join(
        ["| File | Source | Changes |", "|---|---|---|"] + [f"| `{a}` | {b} | {c} |" for a, b, c in rows]
    )
    text = CREDITS.read_text()
    if START not in text or END not in text:
        raise SystemExit(f"CREDITS.md needs the {START} and {END} markers")
    head, rest = text.split(START, 1)
    _, tail = rest.split(END, 1)
    CREDITS.write_text(f"{head}{START}\n{table}\n{END}{tail}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    update_credits(build(pathlib.Path(sys.argv[1])))
