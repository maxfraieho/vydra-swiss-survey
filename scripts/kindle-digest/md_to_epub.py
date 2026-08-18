#!/usr/bin/env python3
"""Markdown book directory -> Kindle-compatible EPUB.

Companion to run_md_service.sh (which produces the PDF variant of the
same docs/sdd-book/ directory). Kindle devices/apps and "Send to
Kindle" have accepted EPUB natively since December 2022 — no MOBI/AZW3
conversion step needed.

Usage:
    python3 md_to_epub.py --source /path/to/md/dir --output /path/to/book.epub \
        --title "Book Title" --author "Author Name" [--lang uk]
"""
import argparse
import re
from pathlib import Path

import markdown
from ebooklib import epub


def slug_to_title(filename: str) -> str:
    """Fallback chapter title from filename if the .md has no H1."""
    stem = Path(filename).stem
    stem = re.sub(r"^\d+[-_]?", "", stem)
    return stem.replace("-", " ").replace("_", " ").strip().title()


def extract_title(md_text: str, fallback: str) -> str:
    for line in md_text.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line[2:].strip()
        if line and not line.startswith("#"):
            break
    return fallback


def build_epub(source_dir: Path, output_path: Path, title: str, author: str, lang: str) -> None:
    md_files = sorted(source_dir.glob("*.md"))
    if not md_files:
        raise SystemExit(f"No .md files found in {source_dir}")

    book = epub.EpubBook()
    book.set_identifier(f"urn:vydra-sdd-book:{output_path.stem}")
    book.set_title(title)
    book.set_language(lang)
    book.add_author(author)

    md_converter = markdown.Markdown(extensions=["extra", "tables", "toc"])

    epub_chapters = []
    for i, md_file in enumerate(md_files):
        md_text = md_file.read_text(encoding="utf-8")
        chapter_title = extract_title(md_text, slug_to_title(md_file.name))
        md_converter.reset()
        html_body = md_converter.convert(md_text)

        chapter = epub.EpubHtml(
            title=chapter_title,
            file_name=f"chap_{i:02d}.xhtml",
            lang=lang,
        )
        chapter.content = (
            f"<html><head><title>{chapter_title}</title></head>"
            f"<body>{html_body}</body></html>"
        )
        book.add_item(chapter)
        epub_chapters.append(chapter)

    book.toc = tuple(epub_chapters)
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())

    style = """
    body { font-family: serif; line-height: 1.5; margin: 1em; }
    h1 { page-break-before: always; }
    code { font-family: monospace; background: #f0f0f0; padding: 0 0.2em; }
    pre { background: #f0f0f0; padding: 0.5em; overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #999; padding: 0.3em 0.5em; }
    """
    nav_css = epub.EpubItem(
        uid="style_nav", file_name="style/nav.css", media_type="text/css", content=style
    )
    book.add_item(nav_css)
    for chapter in epub_chapters:
        chapter.add_item(nav_css)

    book.spine = ["nav"] + epub_chapters

    output_path.parent.mkdir(parents=True, exist_ok=True)
    epub.write_epub(str(output_path), book)
    print(f"OK: {output_path} ({output_path.stat().st_size} bytes, {len(epub_chapters)} chapters)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="Directory of .md chapter files")
    parser.add_argument("--output", required=True, help="Output .epub path")
    parser.add_argument("--title", required=True)
    parser.add_argument("--author", default="")
    parser.add_argument("--lang", default="uk")
    args = parser.parse_args()

    build_epub(Path(args.source), Path(args.output), args.title, args.author, args.lang)


if __name__ == "__main__":
    main()
