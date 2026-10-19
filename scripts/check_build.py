#!/usr/bin/env python3
"""Security check of a production build (roadmap M3.8). Fails if the build could break the
portal's CSP or do something it shouldn't.

Usage: check_build.py [dist]

- No e2e test hook (`__contro`) anywhere.
- Only expected file types (no source maps, env files, scripts for other runtimes).
- HTML: scripts and stylesheets only from our own origin, no inline scripts, styles or event
  handlers, and no frames, embeds, <base> or meta refresh.
- CSS: no url() or @import pointing at another host.
- JavaScript: no eval, Function(), innerHTML, document.write and the like, and no URL to
  another host, beyond the occurrences listed in ALLOWED (all in Phaser, reviewed). ESLint
  already bans these in Contro's own code; this catches them arriving in a dependency. A
  dependency upgrade that adds any fails the check until someone reviews the new code.
"""
from __future__ import annotations

import pathlib
import re
import sys
from html.parser import HTMLParser

ALLOWED_SUFFIXES = {".html", ".js", ".css", ".png", ".tmj", ".json", ".ttf", ".woff2", ".txt", ".ogg", ".m4a"}

# Audio (M3.6, ADR-C06): accepted only if the file really is that format, so nothing can be
# shipped disguised as a sound. OGG files start with "OggS"; M4A (MP4) files have "ftyp" at 4.
AUDIO_MAGIC = {".ogg": (0, b"OggS"), ".m4a": (4, b"ftyp")}

# Risky code patterns, and how many times each may appear in the bundle (all inside Phaser).
RISKY = {
    "eval": re.compile(r"(?<![\w$.])eval\s*\("),
    "Function()": re.compile(r"(?<![\w$.])Function\s*\("),
    "innerHTML/outerHTML": re.compile(r"\.(?:inner|outer)HTML\b"),
    "insertAdjacentHTML": re.compile(r"insertAdjacentHTML"),
    "document.write": re.compile(r"document\.write"),
    "string timer": re.compile(r"set(?:Timeout|Interval)\s*\(\s*[`'\"]"),
    "javascript: URL": re.compile(r"javascript:", re.I),
}
ALLOWED = {
    # globalThis fallback `Function('return this')()`, inside try/catch; never reached in
    # browsers with globalThis, and blocked by the CSP (no 'unsafe-eval') if it were.
    "Function()": 1,
    # Phaser's DOMElement game object (createElement and setHTML) and its CSS file loader.
    # Contro uses neither (no DOM elements, no CSS loading); the CSP blocks inline styles.
    "innerHTML/outerHTML": 3,
}

URL = re.compile(r"""(?:https?:)?//([a-z0-9-]+(?:\.[a-z0-9-]+)+)""", re.I)
# Hosts that appear in the bundle as plain text, never fetched.
ALLOWED_HOSTS = {
    "www.w3.org": "XML namespace names for SVG and XHTML",
    "phaser.io": "Phaser's console banner and its default game URL text",
}

HTML_BANNED_TAGS = {"iframe", "frame", "object", "embed", "base", "style"}


class HtmlChecker(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.problems: list[str] = []
        self.in_script = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag in HTML_BANNED_TAGS:
            self.problems.append(f"<{tag}> is not allowed")
        for name in a:
            if name.startswith("on"):
                self.problems.append(f"inline event handler {name}= on <{tag}>")
            if name == "style":
                self.problems.append(f"inline style= on <{tag}>")
        if tag == "script":
            self.in_script = True
            if not a.get("src"):
                self.problems.append("inline <script> (no src)")
            elif not is_local(a["src"]):
                self.problems.append(f"script from another origin: {a['src']}")
        if tag == "link" and a.get("href") and not is_local(a["href"]):
            self.problems.append(f"link to another origin: {a['href']}")
        if tag == "meta" and a.get("http-equiv", "").lower() == "refresh":
            self.problems.append("meta refresh is not allowed")
        if tag in {"img", "audio", "video", "source"} and a.get("src") and not is_local(a["src"]):
            self.problems.append(f"<{tag}> from another origin: {a['src']}")

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            self.in_script = False

    def handle_data(self, data: str) -> None:
        if self.in_script and data.strip():
            self.problems.append("inline script content")


def is_local(url: str) -> bool:
    """A relative URL on our own origin (no scheme, no host, not a data: or javascript: URL)."""
    return not re.match(r"^\s*([a-z][a-z0-9+.-]*:|//)", url, re.I)


def check_html(text: str) -> list[str]:
    parser = HtmlChecker()
    parser.feed(text)
    parser.close()
    return parser.problems


def check_css(text: str) -> list[str]:
    problems = []
    for m in re.finditer(r"""(?:url\(\s*|@import\s+)['"]?([^'")\s;]+)""", text, re.I):
        target = m.group(1)
        if not target.startswith("data:") and not is_local(target):
            problems.append(f"CSS loads from another origin: {target}")
    return problems


def risky_counts(text: str) -> dict[str, int]:
    return {name: len(rx.findall(text)) for name, rx in RISKY.items()}


def foreign_hosts(text: str) -> set[str]:
    return {m.group(1).lower() for m in URL.finditer(text)} - set(ALLOWED_HOSTS)


def check_build(dist: pathlib.Path) -> list[str]:
    if not (dist / "index.html").is_file():
        return [f"{dist}/index.html not found: build first"]
    problems: list[str] = []
    totals = {name: 0 for name in RISKY}
    for path in sorted(p for p in dist.rglob("*") if p.is_file()):
        rel = path.relative_to(dist)
        if path.suffix.lower() not in ALLOWED_SUFFIXES:
            problems.append(f"{rel}: unexpected file type")
            continue
        if path.suffix.lower() == ".png":
            continue
        if path.suffix.lower() in AUDIO_MAGIC:
            at, magic = AUDIO_MAGIC[path.suffix.lower()]
            if path.read_bytes()[at : at + len(magic)] != magic:
                problems.append(f"{rel}: not a real {path.suffix.lower()[1:].upper()} file")
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if "__contro" in text:
            problems.append(f"{rel}: contains the e2e test hook (__contro)")
        if path.suffix == ".html":
            problems += [f"{rel}: {p}" for p in check_html(text)]
        if path.suffix == ".css":
            problems += [f"{rel}: {p}" for p in check_css(text)]
        if path.suffix in {".js", ".html"}:
            for name, n in risky_counts(text).items():
                totals[name] += n
        if path.suffix in {".js", ".css", ".html"}:
            for host in sorted(foreign_hosts(text)):
                problems.append(f"{rel}: URL to another host: {host}")
    for name, n in totals.items():
        allowed = ALLOWED.get(name, 0)
        if n > allowed:
            problems.append(
                f"{name}: found {n}, reviewed {allowed}; review the new code before changing ALLOWED"
            )
        elif n < allowed:
            print(f"build check: note: {name} found {n}, fewer than the {allowed} reviewed")
    return problems


def main(argv: list[str]) -> int:
    dist = pathlib.Path(argv[1] if len(argv) > 1 else "dist")
    problems = check_build(dist)
    for p in problems:
        print(f"build check: {p}", file=sys.stderr)
    if problems:
        return 1
    print(f"build check: {dist} passed")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
