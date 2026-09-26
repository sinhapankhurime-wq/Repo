#!/usr/bin/env python3
"""Convert .mpub e-books to plain text.

An .mpub file is a ZIP archive of HTML files. Two layouts are handled:

  * Mobcast mPub: metadata.xml holds the book details (<head>) and reading
    order (<content>); each <section id="N"> maps to sections/section_NNNN.html.
  * ePub-style: META-INF/container.xml points to an .opf package file whose
    <metadata> holds the book details and whose <spine> gives the reading order.

If neither is present, HTML files are read in natural filename order.
Encrypted (DRM-protected) books are detected and refused rather than
converted into unreadable text.

Only the Python standard library is used.

Usage:
    python3 mpub2txt.py book.mpub                 # writes book.txt
    python3 mpub2txt.py book.mpub -o out.txt
    python3 mpub2txt.py book.mpub -o -            # print to stdout
    python3 mpub2txt.py *.mpub -o converted/      # batch into a directory
"""

import argparse
import codecs
import glob
import html
import posixpath
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile
from html.parser import HTMLParser
from pathlib import Path

HTML_SUFFIXES = (".html", ".htm", ".xhtml")

# Fields read from <head> in metadata.xml, in output order, with their labels.
METADATA_FIELDS = (
    ("title", "Title"),
    ("author", "Author"),
    ("publisher", "Publisher"),
    ("isbn", "ISBN"),
    ("pubdate", "Published"),
    ("language", "Language"),
    ("copyright", "Copyright"),
)

SKIP_TAGS = {"head", "script", "style", "template", "noscript"}
PARAGRAPH_TAGS = {
    "address", "article", "aside", "blockquote", "dl", "figure", "footer",
    "h1", "h2", "h3", "h4", "h5", "h6", "header", "ol", "p", "pre", "section",
    "table", "ul",
}
LINE_TAGS = {"dd", "div", "dt", "figcaption", "tr"}

# Dublin Core elements in an .opf package that fill METADATA_FIELDS.
OPF_FIELDS = (
    ("title", "title"),
    ("author", "creator"),
    ("publisher", "publisher"),
    ("isbn", "identifier"),
    ("pubdate", "date"),
    ("language", "language"),
    ("copyright", "rights"),
)

# Control bytes that never appear in real HTML/XML text (NUL is left out so
# that UTF-16 files without a byte-order mark are not mistaken for encrypted).
_CONTROL_BYTES = bytes(range(1, 32)).translate(None, b"\t\n\f\r") + b"\x7f"

_CHARSET_RE = re.compile(
    rb"""<meta[^>]+charset\s*=\s*["']?([\w.:-]+)"""
    rb"""|<\?xml[^>]+encoding\s*=\s*["']([\w.:-]+)""",
    re.IGNORECASE,
)


def natural_key(name):
    """Sort key that orders 'section_2' before 'section_10'."""
    return [int(part) if part.isdigit() else part.lower()
            for part in re.split(r"(\d+)", name)]


def looks_encrypted(data):
    """True if the bytes look like ciphertext or binary data rather than text.

    Encrypted data is close to random, so roughly 11% of its bytes are control
    characters; genuine HTML in any single-byte or UTF-8 encoding has almost none.
    """
    sample = data[:4096]
    if not sample or sample.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        return False
    controls = len(sample) - len(sample.translate(None, _CONTROL_BYTES))
    return controls > len(sample) * 0.02


def decode_bytes(data):
    """Decode HTML/XML bytes: BOM, then declared charset, then UTF-8, then cp1252."""
    for bom, encoding in ((codecs.BOM_UTF8, "utf-8"),
                          (codecs.BOM_UTF16_LE, "utf-16"),
                          (codecs.BOM_UTF16_BE, "utf-16")):
        if data.startswith(bom):
            return data.decode(encoding, errors="replace").lstrip("﻿")

    match = _CHARSET_RE.search(data[:4096])
    if match:
        declared = (match.group(1) or match.group(2)).decode("ascii")
        try:
            return data.decode(declared)
        except (LookupError, UnicodeDecodeError):
            pass

    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("cp1252", errors="replace")


class _TextExtractor(HTMLParser):
    """Collects readable text from HTML, keeping paragraph and line breaks."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._chunks = []
        self._pending_breaks = 0
        self._prefix = ""
        self._skip_depth = 0
        self._pre_depth = 0
        self._line_has_text = False
        self._row_cells = 0

    def _break(self, count):
        # A pending list-item marker already fixes where the next line starts.
        if not self._prefix:
            self._pending_breaks = max(self._pending_breaks, count)

    def _write(self, text):
        if self._pending_breaks:
            if self._chunks:
                self._chunks.append("\n" * self._pending_breaks)
                self._line_has_text = False
            self._pending_breaks = 0
        if self._prefix:
            self._chunks.append(self._prefix)
            self._prefix = ""
            self._line_has_text = True
        self._chunks.append(text)
        self._line_has_text = True

    def handle_starttag(self, tag, attrs):
        if tag in SKIP_TAGS:
            self._skip_depth += 1
        elif tag == "br":
            if self._pending_breaks or self._prefix:
                self._break(1)
            else:
                self._chunks.append("\n")
                self._line_has_text = False
        elif tag == "hr":
            self._break(2)
            self._write("* * *")
            self._break(2)
        elif tag == "li":
            self._break(1)
            self._prefix = "- "
        elif tag in ("td", "th"):
            if self._row_cells:
                self._write(" | ")
            self._row_cells += 1
        else:
            if tag == "tr":
                self._row_cells = 0
            if tag == "pre":
                self._pre_depth += 1
            if tag in PARAGRAPH_TAGS:
                self._break(2)
            elif tag in LINE_TAGS:
                self._break(1)

    def handle_startendtag(self, tag, attrs):
        # Self-closing tags (<br/>, <hr/>, <img/>) never contain text.
        if tag not in SKIP_TAGS:
            self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS:
            self._skip_depth = max(0, self._skip_depth - 1)
        elif tag == "pre":
            self._pre_depth = max(0, self._pre_depth - 1)
            self._break(2)
        elif tag in PARAGRAPH_TAGS:
            self._break(2)
        elif tag in LINE_TAGS or tag == "li":
            self._break(1)

    def handle_data(self, data):
        if self._skip_depth:
            return
        if self._pre_depth:
            if data:
                self._write(data)
            return
        text = re.sub(r"\s+", " ", data)
        if not self._line_has_text or self._pending_breaks:
            text = text.lstrip()
        if text:
            self._write(text)

    def text(self):
        raw = "".join(self._chunks)
        lines = [line.rstrip() for line in raw.split("\n")]
        return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def html_to_text(markup):
    """Convert an HTML string to plain text."""
    parser = _TextExtractor()
    parser.feed(markup)
    parser.close()
    return parser.text()


class MpubBook:
    """Reads the metadata and section text from an open .mpub ZIP archive."""

    def __init__(self, archive):
        self.archive = archive
        self.warnings = []
        members = [name for name in archive.namelist() if not name.endswith("/")]
        self._members = {name.lower(): name for name in members}
        self._root = self._find_root(members)

    def _find_root(self, members):
        """Directory holding metadata.xml or sections/ (usually the archive root)."""
        candidates = [name for name in members
                      if posixpath.basename(name).lower() == "metadata.xml"]
        if candidates:
            return posixpath.dirname(min(candidates, key=len))
        for name in sorted(members, key=len):
            parts = name.split("/")
            if len(parts) >= 2 and parts[-2].lower() == "sections":
                return "/".join(parts[:-2])
        return ""

    def _member(self, relative_path):
        """Look up an archive member relative to the book root, ignoring case."""
        full = posixpath.join(self._root, relative_path) if self._root else relative_path
        return self._members.get(full.lower())

    def metadata(self):
        """Return (fields, section_ids) from metadata.xml, or ({}, []) if absent."""
        name = self._member("metadata.xml")
        if name is None:
            return {}, []
        raw = self.archive.read(name)
        try:
            root = ET.fromstring(raw)
        except ET.ParseError:
            # metadata.xml can contain HTML entities (&nbsp; etc.) that are not
            # valid XML; fall back to pattern matching.
            return self._metadata_from_text(decode_bytes(raw))

        head = root.find("head")
        fields = {}
        if head is not None:
            for key, _label in METADATA_FIELDS:
                value = head.findtext(key)
                if value and value.strip():
                    fields[key] = " ".join(value.split())
        content = root.find("content")
        sections = content.iter("section") if content is not None else root.iter("section")
        section_ids = [s.get("id").strip() for s in sections if s.get("id")]
        return fields, section_ids

    def _metadata_from_text(self, text):
        self.warnings.append("metadata.xml is not well-formed XML; parsed it leniently")
        fields = {}
        head = re.search(r"<head\b.*?</head>", text, re.IGNORECASE | re.DOTALL)
        head_text = head.group(0) if head else text
        for key, _label in METADATA_FIELDS:
            match = re.search(rf"<{key}\b[^>]*>(.*?)</{key}>", head_text,
                              re.IGNORECASE | re.DOTALL)
            if match:
                value = " ".join(html.unescape(re.sub(r"<[^>]+>", "", match.group(1))).split())
                if value:
                    fields[key] = value
        section_ids = re.findall(r"""<section\b[^>]*\bid\s*=\s*["']?([\w-]+)""",
                                 text, re.IGNORECASE)
        return fields, section_ids

    def _section_path(self, section_id):
        number = f"{int(section_id):04d}" if section_id.isdigit() else section_id
        for suffix in HTML_SUFFIXES:
            name = self._member(f"sections/section_{number}{suffix}")
            if name:
                return name
        return None

    def _section_files(self):
        """All HTML files in sections/ (or anywhere, if there is no sections/)."""
        html_files = [name for name in self._members.values()
                      if name.lower().endswith(HTML_SUFFIXES)]
        prefix = (posixpath.join(self._root, "sections") + "/").lower()
        in_sections = [name for name in html_files if name.lower().startswith(prefix)]
        return sorted(in_sections or html_files, key=natural_key)

    def reading_order(self, section_ids):
        """Archive member names of the sections, in reading order."""
        all_files = self._section_files()
        if not section_ids:
            if all_files:
                self.warnings.append(
                    "no section list in metadata.xml; using filename order")
            return all_files

        ordered = []
        for section_id in section_ids:
            name = self._section_path(section_id)
            if name is None:
                self.warnings.append(f"section {section_id} is listed in "
                                     "metadata.xml but missing from the archive")
            elif name not in ordered:
                ordered.append(name)

        unlisted = [name for name in all_files if name not in ordered]
        if unlisted:
            self.warnings.append(
                f"{len(unlisted)} section file(s) not listed in metadata.xml were "
                f"appended at the end: {', '.join(unlisted)}")
        return ordered + unlisted

    def _opf_name(self):
        """The ePub package (.opf) file named by META-INF/container.xml, if any."""
        container = self._members.get("meta-inf/container.xml")
        if container:
            try:
                root = ET.fromstring(self.archive.read(container))
            except ET.ParseError:
                root = None
            if root is not None:
                for rootfile in root.iterfind(".//{*}rootfile"):
                    name = self._members.get((rootfile.get("full-path") or "").lower())
                    if name:
                        return name
        opf_files = [name for name in self._members.values()
                     if name.lower().endswith(".opf")]
        return min(opf_files, key=len) if opf_files else None

    @staticmethod
    def _isbn(element, value):
        if value.lower().startswith("urn:isbn:"):
            return value[len("urn:isbn:"):]
        schemes = [v.lower() for k, v in element.attrib.items() if k.endswith("scheme")]
        return value if "isbn" in schemes else ""

    def _opf_layout(self, opf_name):
        """Return (fields, section names) from an ePub package file, or None."""
        try:
            root = ET.fromstring(self.archive.read(opf_name))
        except ET.ParseError:
            self.warnings.append(f"{opf_name} is not well-formed XML")
            return None

        fields = {}
        metadata = root.find("{*}metadata")
        for key, tag in OPF_FIELDS:
            values = []
            elements = metadata.iterfind(f".//{{*}}{tag}") if metadata is not None else ()
            for element in elements:
                value = " ".join((element.text or "").split())
                if key == "isbn":
                    value = self._isbn(element, value)
                if value.strip("-– ") and value not in values:
                    values.append(value)
            if values:
                fields[key] = ", ".join(values) if key in ("author", "language") else values[0]

        base = posixpath.dirname(opf_name)
        manifest = {item.get("id"): item.get("href")
                    for item in root.iterfind(".//{*}item")}
        names = []
        for itemref in root.iterfind(".//{*}itemref"):
            href = manifest.get(itemref.get("idref"))
            if not href:
                self.warnings.append(
                    f"reading-order entry {itemref.get('idref')!r} has no file")
                continue
            path = posixpath.normpath(
                posixpath.join(base, urllib.parse.unquote(href.split("#")[0])))
            name = self._members.get(path.lower())
            if name is None:
                self.warnings.append(
                    f"{path} is listed in {opf_name} but missing from the archive")
            elif name not in names:
                names.append(name)
        if not names:
            self.warnings.append(f"{opf_name} has no usable reading order")
            return None
        return fields, names

    def layout(self):
        """Return (metadata fields, section member names in reading order)."""
        if self._member("metadata.xml") is not None:
            fields, section_ids = self.metadata()
            return fields, self.reading_order(section_ids)
        opf_name = self._opf_name()
        if opf_name:
            result = self._opf_layout(opf_name)
            if result:
                return result
        files = self._section_files()
        if files:
            self.warnings.append("no reading order found; using filename order")
        return {}, files

    def to_text(self, include_metadata=True):
        fields, names = self.layout()
        sections = [(name, self.archive.read(name)) for name in names]
        encrypted = [name for name, data in sections if looks_encrypted(data)]
        if encrypted:
            raise ValueError(
                f"{len(encrypted)} of {len(sections)} section files are encrypted "
                "(DRM-protected), so their text cannot be extracted; open the book "
                "in the app or store it came from")

        parts = []
        if include_metadata and fields:
            header = "\n".join(f"{label}: {fields[key]}"
                               for key, label in METADATA_FIELDS if key in fields)
            parts.append(header + "\n\n" + "=" * 40)
        for name, data in sections:
            text = html_to_text(decode_bytes(data))
            if text:
                parts.append(text)
        if not parts:
            raise ValueError("no readable text found in the archive")
        return "\n\n\n".join(parts) + "\n"


def convert_file(path, include_metadata=True):
    """Convert one .mpub file. Returns (text, warnings)."""
    try:
        with zipfile.ZipFile(path) as archive:
            book = MpubBook(archive)
            return book.to_text(include_metadata), book.warnings
    except zipfile.BadZipFile:
        raise ValueError("not a valid .mpub file (it is not a ZIP archive)") from None
    except RuntimeError as exc:  # encrypted members need a password
        raise ValueError(f"cannot read archive: {exc}") from None
    except NotImplementedError as exc:  # unsupported compression method
        raise ValueError(f"cannot read archive: {exc}") from None


def _output_path(input_path, output, many_inputs):
    if output is None:
        return input_path.with_suffix(".txt")
    if output == "-":
        return None
    out = Path(output)
    if out.is_dir() or many_inputs or output.endswith(("/", "\\")):
        return out / (input_path.stem + ".txt")
    return out


def _expand_wildcards(paths):
    """Expand *.mpub-style patterns (Windows shells pass them through unexpanded)."""
    expanded = []
    for raw in paths:
        matches = [] if Path(raw).exists() else sorted(glob.glob(raw))
        expanded.extend(matches or [raw])
    return expanded


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Convert Mobcast mPub (.mpub) e-books to plain text.")
    parser.add_argument("inputs", nargs="+", metavar="FILE", help=".mpub file(s) to convert")
    parser.add_argument("-o", "--output", metavar="PATH",
                        help="output file, directory, or '-' for stdout "
                             "(default: next to each input, with a .txt extension)")
    parser.add_argument("--no-metadata", action="store_true",
                        help="omit the title/author header")
    parser.add_argument("--encoding", default="utf-8",
                        help="encoding of the output text (default: utf-8)")
    args = parser.parse_args(argv)

    args.inputs = _expand_wildcards(args.inputs)
    many = len(args.inputs) > 1
    if many and args.output and args.output != "-" and Path(args.output).is_file():
        parser.error("with several inputs, --output must be a directory or '-'")

    failures = 0
    for raw_path in args.inputs:
        input_path = Path(raw_path)
        try:
            text, warnings = convert_file(input_path, include_metadata=not args.no_metadata)
        except (OSError, ValueError) as exc:
            print(f"error: {input_path}: {exc}", file=sys.stderr)
            failures += 1
            continue
        for warning in warnings:
            print(f"warning: {input_path}: {warning}", file=sys.stderr)

        destination = _output_path(input_path, args.output, many)
        if destination is None:
            sys.stdout.write(text)
            continue
        try:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(text, encoding=args.encoding, errors="replace")
        except (OSError, LookupError) as exc:
            print(f"error: {destination}: {exc}", file=sys.stderr)
            failures += 1
            continue
        print(f"{input_path} -> {destination}", file=sys.stderr)

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
