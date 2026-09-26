import contextlib
import io
import os
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import mpub2txt  # noqa: E402

METADATA = """<?xml version="1.0" encoding="UTF-8"?>
<ebook>
  <head>
    <title>The Test Book</title>
    <isbn>9780000000000</isbn>
    <language>en</language>
    <author>A. N. Author</author>
    <publisher>Example Press</publisher>
    <pubdate>2010-01-01</pubdate>
    <cover>cover.png</cover>
    <sections>3</sections>
  </head>
  <content>
    <section id="0" depth="0">Cover Page</section>
    <section id="1" depth="0">Chapter One</section>
    <section id="2" depth="0">Chapter Two</section>
  </content>
</ebook>
"""

SECTIONS = {
    "sections/section_0000.html": "<html><head><title>x</title></head><body>"
                                  "<p>Cover</p></body></html>",
    "sections/section_0001.html": "<html><head><style>p{color:red}</style></head><body>"
                                  "<h1>Chapter One</h1>\n<p>It was a   dark\n and "
                                  "stormy night &amp; more.</p><p>Line one<br/>line two"
                                  "</p><script>ignored()</script></body></html>",
    "sections/section_0002.html": "<html><body><h1>Chapter Two</h1><p>The end.</p>"
                                  "</body></html>",
}


CONTAINER = """<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/book.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
"""

OPF = """<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"
            xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>\u0e2b\u0e19\u0e31\u0e07\u0e2a\u0e37\u0e2d</dc:title>
    <dc:language>th</dc:language>
    <dc:identifier id="BookId" opf:scheme="ISBN">-</dc:identifier>
    <dc:identifier opf:scheme="ISBN">9781234567897</dc:identifier>
    <dc:creator>First Author</dc:creator>
    <dc:creator>Second Author</dc:creator>
    <dc:date>2016-10-26</dc:date>
  </metadata>
  <manifest>
    <item id="cover" href="CoverPage.html" media-type="application/xhtml+xml"/>
    <item id="c1" href="Text/Chapter_1.html" media-type="application/xhtml+xml"/>
    <item id="c10" href="Text/Chapter_10.html#start" media-type="application/xhtml+xml"/>
    <item id="css" href="styles.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="cover" linear="no"/>
    <itemref idref="c10"/>
    <itemref idref="c1"/>
  </spine>
</package>
"""

EPUB_FILES = {
    "mimetype": "application/epub+zip",
    "META-INF/container.xml": CONTAINER,
    "OEBPS/book.opf": OPF,
    "OEBPS/styles.css": "p{}",
    "OEBPS/CoverPage.html": "<html><body><p>Cover</p></body></html>",
    "OEBPS/Text/Chapter_1.html":
        "<html><body><p>\u0e1a\u0e17\u0e17\u0e35\u0e48 1</p></body></html>",
    "OEBPS/Text/Chapter_10.html": "<html><body><p>Ten</p></body></html>",
}


def make_mpub(directory, files, name="book.mpub"):
    path = Path(directory) / name
    with zipfile.ZipFile(path, "w") as archive:
        for member, content in files.items():
            archive.writestr(member, content)
    return path


class HtmlToTextTests(unittest.TestCase):
    def test_paragraphs_whitespace_and_entities(self):
        text = mpub2txt.html_to_text("<p>a  b\n c&nbsp;&amp;</p><p>d</p>")
        self.assertEqual(text, "a b c &\n\nd")

    def test_line_breaks(self):
        self.assertEqual(mpub2txt.html_to_text("<p>one<br>two<br/><br/>three</p>"),
                         "one\ntwo\n\nthree")

    def test_skips_head_script_and_style(self):
        markup = ("<html><head><title>T</title><style>x</style></head>"
                  "<body><script>bad()</script><p>kept</p></body></html>")
        self.assertEqual(mpub2txt.html_to_text(markup), "kept")

    def test_lists_rules_and_inline_tags(self):
        markup = "<p>Some <i>italic</i> text</p><hr/><ul><li>one</li><li>two</li></ul>"
        self.assertEqual(mpub2txt.html_to_text(markup),
                         "Some italic text\n\n* * *\n\n- one\n- two")

    def test_preformatted_text_is_kept(self):
        self.assertEqual(mpub2txt.html_to_text("<pre>a  b\n  c</pre>"), "a  b\n  c")

    def test_table_cells(self):
        markup = "<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>"
        self.assertEqual(mpub2txt.html_to_text(markup), "A | B\n1 | 2")


class LooksEncryptedTests(unittest.TestCase):
    def test_random_bytes_are_flagged(self):
        self.assertTrue(mpub2txt.looks_encrypted(os.urandom(4096)))

    def test_text_in_any_script_is_not_flagged(self):
        for sample in ("<p>Hello, world.</p>\r\n\t" * 50,
                       "<p>\u0e40\u0e2b\u0e21\u0e37\u0e2d\u0e19\u0e04\u0e19</p>\n" * 50):
            self.assertFalse(mpub2txt.looks_encrypted(sample.encode("utf-8")))
        self.assertFalse(mpub2txt.looks_encrypted("caf\xe9 \u2019".encode("cp1252") * 50))
        self.assertFalse(mpub2txt.looks_encrypted("<p>hi</p>".encode("utf-16")))


class DecodeTests(unittest.TestCase):
    def test_declared_charset(self):
        data = '<meta charset="windows-1252"><p>caf\xe9 ’</p>'.encode("cp1252")
        self.assertIn("café ’", mpub2txt.decode_bytes(data))

    def test_undeclared_non_utf8_falls_back_to_cp1252(self):
        self.assertEqual(mpub2txt.decode_bytes("naïve".encode("cp1252")), "naïve")

    def test_utf8_bom(self):
        self.assertEqual(mpub2txt.decode_bytes(b"\xef\xbb\xbfhi"), "hi")


class ConvertTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)

    def convert(self, files, **kwargs):
        return mpub2txt.convert_file(make_mpub(self.dir, files), **kwargs)

    def test_full_book(self):
        files = {"metadata.xml": METADATA, "cover.png": b"\x89PNG",
                 "css/stylesheet.css": "p{}", **SECTIONS}
        text, warnings = self.convert(files)
        self.assertEqual(warnings, [])
        self.assertEqual(text, (
            "Title: The Test Book\n"
            "Author: A. N. Author\n"
            "Publisher: Example Press\n"
            "ISBN: 9780000000000\n"
            "Published: 2010-01-01\n"
            "Language: en\n"
            "\n" + "=" * 40 + "\n\n\n"
            "Cover\n\n\n"
            "Chapter One\n\n"
            "It was a dark and stormy night & more.\n\n"
            "Line one\nline two\n\n\n"
            "Chapter Two\n\nThe end.\n"
        ))

    def test_no_metadata_header(self):
        text, _ = self.convert({"metadata.xml": METADATA, **SECTIONS},
                               include_metadata=False)
        self.assertTrue(text.startswith("Cover\n"))

    def test_follows_metadata_order(self):
        metadata = METADATA.replace('id="1"', 'id="X"').replace(
            'id="2"', 'id="1"').replace('id="X"', 'id="2"')
        text, _ = self.convert({"metadata.xml": metadata, **SECTIONS},
                               include_metadata=False)
        self.assertLess(text.index("Chapter Two"), text.index("Chapter One"))

    def test_without_metadata_uses_natural_order(self):
        files = {f"sections/section_{n}.html": f"<p>part {n}</p>" for n in (10, 2, 1)}
        text, warnings = self.convert(files)
        self.assertEqual(text, "part 1\n\n\npart 2\n\n\npart 10\n")
        self.assertEqual(len(warnings), 1)

    def test_malformed_metadata_is_parsed_leniently(self):
        metadata = METADATA.replace("The Test Book", "The&nbsp;Test Book")
        text, warnings = self.convert({"metadata.xml": metadata, **SECTIONS})
        self.assertTrue(text.startswith("Title: The Test Book\n"))
        self.assertIn("Chapter Two", text)
        self.assertIn("leniently", warnings[0])

    def test_unlisted_and_missing_sections_are_reported(self):
        files = {"metadata.xml": METADATA, **SECTIONS,
                 "sections/section_0003.html": "<p>Bonus</p>"}
        del files["sections/section_0002.html"]
        text, warnings = self.convert(files, include_metadata=False)
        self.assertTrue(text.endswith("Bonus\n"))
        self.assertEqual(len(warnings), 2)
        self.assertIn("section 2", warnings[0])
        self.assertIn("section_0003.html", warnings[1])

    def test_wrapper_directory_and_case_insensitive_names(self):
        files = {"MyBook/Metadata.XML": METADATA}
        files.update({"MyBook/" + name.upper().replace(".HTML", ".html"): body
                      for name, body in SECTIONS.items()})
        text, warnings = self.convert(files, include_metadata=False)
        self.assertEqual(warnings, [])
        self.assertIn("The end.", text)

    def test_epub_layout_uses_opf_metadata_and_spine(self):
        text, warnings = self.convert(EPUB_FILES)
        self.assertEqual(warnings, [])
        self.assertEqual(text, (
            "Title: \u0e2b\u0e19\u0e31\u0e07\u0e2a\u0e37\u0e2d\n"
            "Author: First Author, Second Author\n"
            "ISBN: 9781234567897\n"
            "Published: 2016-10-26\n"
            "Language: th\n"
            "\n" + "=" * 40 + "\n\n\n"
            "Cover\n\n\nTen\n\n\n\u0e1a\u0e17\u0e17\u0e35\u0e48 1\n"
        ))

    def test_epub_layout_without_container_finds_opf(self):
        files = dict(EPUB_FILES)
        del files["META-INF/container.xml"]
        text, _ = self.convert(files, include_metadata=False)
        self.assertTrue(text.startswith("Cover\n\n\nTen\n"))

    def test_epub_spine_missing_file_is_reported(self):
        files = dict(EPUB_FILES)
        del files["OEBPS/Text/Chapter_10.html"]
        text, warnings = self.convert(files, include_metadata=False)
        self.assertNotIn("Ten", text)
        self.assertIn("OEBPS/Text/Chapter_10.html", warnings[0])

    def test_encrypted_sections_are_refused(self):
        files = dict(EPUB_FILES)
        files["OEBPS/Text/Chapter_1.html"] = os.urandom(4096)
        with self.assertRaisesRegex(ValueError, r"1 of 3 section files are encrypted"):
            self.convert(files)

    def test_not_a_zip(self):
        path = self.dir / "bad.mpub"
        path.write_bytes(b"not a zip")
        with self.assertRaisesRegex(ValueError, "not a ZIP"):
            mpub2txt.convert_file(path)

    def test_empty_archive(self):
        with self.assertRaisesRegex(ValueError, "no readable text"):
            self.convert({"css/stylesheet.css": "p{}"})


class CliTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)
        self.book = make_mpub(self.dir, {"metadata.xml": METADATA, **SECTIONS})

    def run_main(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = mpub2txt.main([str(a) for a in args])
        return code, out.getvalue(), err.getvalue()

    def test_default_output_next_to_input(self):
        code, _, _ = self.run_main(self.book)
        self.assertEqual(code, 0)
        self.assertIn("The end.", (self.dir / "book.txt").read_text(encoding="utf-8"))

    def test_stdout(self):
        code, out, _ = self.run_main(self.book, "-o", "-", "--no-metadata")
        self.assertEqual(code, 0)
        self.assertTrue(out.startswith("Cover\n"))

    def test_expands_wildcards_itself(self):
        make_mpub(self.dir, {"metadata.xml": METADATA, **SECTIONS}, name="second.mpub")
        code, _, _ = self.run_main(self.dir / "*.mpub")
        self.assertEqual(code, 0)
        self.assertTrue((self.dir / "book.txt").exists())
        self.assertTrue((self.dir / "second.txt").exists())

    def test_encrypted_book_fails_without_writing_output(self):
        files = dict(EPUB_FILES)
        files.update({name: os.urandom(2048) for name in files if name.endswith(".html")})
        locked = make_mpub(self.dir, files, name="locked.mpub")
        code, _, err = self.run_main(locked)
        self.assertEqual(code, 1)
        self.assertIn("DRM", err)
        self.assertFalse((self.dir / "locked.txt").exists())

    def test_batch_into_directory_and_failure_exit_code(self):
        bad = self.dir / "bad.mpub"
        bad.write_bytes(b"junk")
        out_dir = self.dir / "out"
        code, _, err = self.run_main(self.book, bad, "-o", out_dir)
        self.assertEqual(code, 1)
        self.assertTrue((out_dir / "book.txt").exists())
        self.assertIn("bad.mpub", err)


if __name__ == "__main__":
    unittest.main()
