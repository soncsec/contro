"""Tests for scripts/check_build.py (roadmap M3.8).

Run: python3 -m unittest discover -s tests/release -p 'test_*.py'
"""
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "scripts"))
import check_build  # noqa: E402

PAGE = """<!doctype html><html><head><title>Contro</title>
<script type="module" crossorigin src="./assets/index-1.js"></script>
<link rel="stylesheet" crossorigin href="./assets/index-1.css">
</head><body><div id="game"></div></body></html>"""

# Stands in for Phaser: exactly the reviewed occurrences.
BUNDLE = (
    "try{return this||Function(`return this`)()}catch{};"
    "n.innerHTML=e;this.node.innerHTML=e;this.data.innerHTML=t;"
    "console.log(`https://phaser.io`);ns=`http://www.w3.org/2000/svg`;isFunction(x);"
)
CSS = "html{background:#07060d}canvas{image-rendering:pixelated}"


class CheckBuildTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.dist = pathlib.Path(self.tmp.name)
        (self.dist / "assets").mkdir()
        self.write("index.html", PAGE)
        self.write("assets/index-1.js", BUNDLE)
        self.write("assets/index-1.css", CSS)
        (self.dist / "assets" / "a.png").write_bytes(b"\x89PNG\r\n\x1a\n")

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def write(self, rel: str, text: str) -> None:
        (self.dist / rel).write_text(text, encoding="utf-8")

    def problems(self) -> list[str]:
        return check_build.check_build(self.dist)

    def assertProblem(self, fragment: str) -> None:
        problems = self.problems()
        self.assertTrue(any(fragment in p for p in problems), problems)

    def test_a_clean_build_passes(self) -> None:
        self.assertEqual(self.problems(), [])
        self.assertEqual(check_build.main(["check_build.py", str(self.dist)]), 0)

    def test_real_audio_files_pass(self) -> None:
        (self.dist / "assets" / "a.ogg").write_bytes(b"OggS\x00\x02rest")
        (self.dist / "assets" / "a.m4a").write_bytes(b"\x00\x00\x00\x20ftypM4A rest")
        self.assertEqual(self.problems(), [])

    def test_a_file_disguised_as_audio_fails(self) -> None:
        self.write("assets/b.ogg", "<script>alert(1)</script>")
        self.assertProblem("b.ogg: not a real OGG file")
        self.write("assets/c.m4a", "window.x=1")
        self.assertProblem("c.m4a: not a real M4A file")

    def test_other_audio_formats_fail(self) -> None:
        (self.dist / "assets" / "a.mp3").write_bytes(b"ID3")
        self.assertProblem("a.mp3: unexpected file type")

    def test_a_missing_build_fails(self) -> None:
        (self.dist / "index.html").unlink()
        self.assertProblem("index.html not found")

    def test_the_test_hook_fails(self) -> None:
        self.write("assets/hook.js", "window.__contro={}")
        self.assertProblem("e2e test hook")
        self.assertEqual(check_build.main(["check_build.py", str(self.dist)]), 1)

    def test_unexpected_files_fail(self) -> None:
        for name in ["assets/index-1.js.map", ".env", "deploy.sh"]:
            with self.subTest(name=name):
                self.write(name, "x")
                self.assertProblem(f"{name}: unexpected file type")
                (self.dist / name).unlink()

    def test_inline_and_foreign_html_fails(self) -> None:
        cases = {
            "<script>alert(1)</script>": "inline <script>",
            '<script src="https://cdn.example.com/x.js"></script>': "script from another origin",
            '<script src="//cdn.example.com/x.js"></script>': "script from another origin",
            '<link rel="stylesheet" href="https://fonts.example.com/a.css">': "link to another",
            "<style>body{}</style>": "<style> is not allowed",
            '<div style="color:red"></div>': "inline style=",
            '<body onload="go()"></body>': "inline event handler onload=",
            '<iframe src="./x.html"></iframe>': "<iframe> is not allowed",
            '<base href="https://example.com/">': "<base> is not allowed",
            '<meta http-equiv="refresh" content="0;url=https://x.test">': "meta refresh",
            '<img src="https://img.example.com/a.png">': "<img> from another origin",
            '<a href="javascript:void(0)">x</a>': "javascript: URL",
        }
        for html, expected in cases.items():
            with self.subTest(html=html):
                self.write("index.html", PAGE.replace("</body>", html + "</body>"))
                self.assertProblem(expected)

    def test_foreign_css_fails(self) -> None:
        for css in [
            "@import 'https://fonts.example.com/a.css';",
            "a{background:url(https://img.example.com/a.png)}",
            "a{background:url('//img.example.com/a.png')}",
        ]:
            with self.subTest(css=css):
                self.write("assets/index-1.css", CSS + css)
                self.assertProblem("another origin")
        self.write("assets/index-1.css", CSS + "a{background:url(./a.png)}b{c:url(data:x)}")
        self.assertEqual(self.problems(), [])

    def test_new_risky_code_fails(self) -> None:
        for code, name in [
            ("eval(s)", "eval"),
            ("new Function('a', s)", "Function()"),
            ("el.innerHTML=s", "innerHTML/outerHTML"),
            ("el.outerHTML=s", "innerHTML/outerHTML"),
            ("el.insertAdjacentHTML('x', s)", "insertAdjacentHTML"),
            ("document.write(s)", "document.write"),
            ("setTimeout('go()', 9)", "string timer"),
            ("a.href='javascript:go()'", "javascript: URL"),
        ]:
            with self.subTest(code=code):
                self.write("assets/index-1.js", BUNDLE + code)
                self.assertProblem(f"{name}: found")

    def test_one_more_than_reviewed_fails(self) -> None:
        self.write("assets/index-1.js", BUNDLE + "x.innerHTML=y;")
        self.assertProblem("innerHTML/outerHTML: found 4, reviewed 3")

    def test_fewer_than_reviewed_passes(self) -> None:
        # Fewer risky calls is never riskier (e.g. a Phaser upgrade removed one).
        self.write("assets/index-1.js", "// a tiny bundle")
        self.assertEqual(self.problems(), [])

    def test_urls_to_other_hosts_fail(self) -> None:
        for code in ["fetch('https://api.example.com/x')", "u=`//tracker.example.net/p`"]:
            with self.subTest(code=code):
                self.write("assets/index-1.js", BUNDLE + code)
                self.assertProblem("URL to another host")

    def test_is_local(self) -> None:
        self.assertTrue(check_build.is_local("./assets/a.js"))
        self.assertTrue(check_build.is_local("assets/a.js"))
        self.assertFalse(check_build.is_local("http://x.test/a.js"))
        self.assertFalse(check_build.is_local("//x.test/a.js"))
        self.assertFalse(check_build.is_local("data:text/javascript,alert(1)"))
        self.assertFalse(check_build.is_local(" JavaScript:alert(1)"))


if __name__ == "__main__":
    unittest.main()
