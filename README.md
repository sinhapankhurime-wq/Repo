# mpub2txt

Converts `.mpub` e-books to plain text (`.txt`). It needs only Python 3.8 or
newer; there is nothing else to install.

## Getting started

1. Install Python 3 from <https://www.python.org/downloads/> if you don't have
   it. (Check with `python3 --version` on macOS/Linux or `py --version` on
   Windows.)
2. Download `mpub2txt.py` from this repository and put it in the same folder as
   your `.mpub` file.
3. Open a terminal (macOS: Terminal; Windows: PowerShell) in that folder and run:

   ```sh
   python3 mpub2txt.py book.mpub      # macOS / Linux
   py mpub2txt.py book.mpub           # Windows
   ```

   This writes `book.txt` next to `book.mpub`.

## More options

```sh
python3 mpub2txt.py book.mpub -o out.txt      # choose the output file
python3 mpub2txt.py book.mpub -o -            # print to the terminal
python3 mpub2txt.py *.mpub -o converted/      # convert many into a folder
python3 mpub2txt.py book.mpub --no-metadata   # leave out the title/author header
```

The output starts with the title, author, publisher, ISBN and publication date
(when the book includes them), followed by the text of each section in reading
order. Paragraphs are separated by blank lines, list items start with `- `, and
horizontal rules become `* * *`.

Problems such as a chapter listed in the book's index but missing from the
file are printed as warnings; the conversion still goes ahead. The exit code is
`1` if any input could not be converted.

## Supported layouts

An `.mpub` file is a ZIP archive of HTML files. Two layouts are recognised:

- **Mobcast mPub** – `metadata.xml` at the top gives the book details and
  reading order; the text is in `sections/section_0000.html`,
  `section_0001.html`, … (described on the
  [MobileRead wiki](https://wiki.mobileread.com/wiki/Mpub)).
- **ePub-style** – `META-INF/container.xml` points to an `.opf` file whose
  `<metadata>` gives the book details and whose `<spine>` gives the reading
  order (for example `OEBPS/book.opf` with `OEBPS/Chapter_1.html`, …). Ordinary
  `.epub` files use this layout too, so they convert as well.

If neither is found, every HTML file in the archive is read in filename order.

## DRM-protected books

Many stores encrypt the chapter files so the book only opens in their own
app. mpub2txt detects this and stops with an error instead of producing
unreadable output:

```
error: book.mpub: 83 of 83 section files are encrypted (DRM-protected), so
their text cannot be extracted; open the book in the app or store it came from
```

It does not try to remove DRM. For such books, read them in the store's app or
ask the seller for a DRM-free copy.

## Other limitations

- Password-protected ZIP archives are not supported.
- Images and styling are dropped; only text is kept.

## Tests

```sh
python3 -m unittest discover -s tests
```
