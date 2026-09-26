# mpub2txt

Converts Mobcast mPub (`.mpub`) e-books to plain text (`.txt`).

An `.mpub` file is a ZIP archive holding a `metadata.xml` (book details and
reading order) plus one HTML file per section under `sections/`. The converter
reads the sections in the order `metadata.xml` lists them and turns the HTML
into readable text. It needs only Python 3.8+ and nothing else.

## Usage

```sh
python3 mpub2txt.py book.mpub                 # writes book.txt next to it
python3 mpub2txt.py book.mpub -o out.txt      # choose the output file
python3 mpub2txt.py book.mpub -o -            # print to the terminal
python3 mpub2txt.py *.mpub -o converted/      # convert many into a folder
python3 mpub2txt.py book.mpub --no-metadata   # leave out the title/author header
```

The output starts with the title, author, publisher, ISBN and publication date
from `metadata.xml` (when present), followed by the text of each section.
Paragraphs are separated by blank lines, list items start with `- `, and
horizontal rules become `* * *`.

Problems such as a section listed in `metadata.xml` but missing from the
archive are printed as warnings; the conversion still goes ahead. The exit code
is `1` if any input could not be converted.

## Limitations

- Only the archive layout described on the
  [MobileRead wiki](https://wiki.mobileread.com/wiki/Mpub) is handled. If
  `metadata.xml` is missing, every HTML file in the archive is read in filename
  order instead.
- Password-protected archives are not supported.
- Images and styling are dropped; only text is kept.

## Tests

```sh
python3 -m unittest discover -s tests
```
