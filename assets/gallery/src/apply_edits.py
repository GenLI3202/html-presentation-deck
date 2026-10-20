"""Write text edits back into the sources, then rebuild.

    python3 src/apply_edits.py edits.json [--no-build]

edits.json comes from the deck's "Export" button (preview.html), or from the Artifact's "edits" collection.
Each edit: { eid, lang, kind: html | svg | note, slide, before, after }. The language decides the file:
  source language (deck.config.json "languages"[0], or no lang)  -> slides.html, notes.js
  any other language                                               -> src/i18n/<lang>.txt, src/notes_<lang>.js
An edit applies only when the file still holds its "before" text; otherwise it is reported and skipped.
An edit of the source text puts its translations on the review list (python3 src/i18n.py status).
The old files are copied to <deck>/.edits-backup/<time>/ first.
"""
import argparse
import datetime
import json
import os
import shutil
import subprocess
import sys

import edits
import i18n

SRC = os.path.dirname(os.path.abspath(__file__))
DECK = os.path.dirname(SRC)


def load(path: str) -> list:
    with open(path, encoding="utf8") as f:
        data = json.load(f)
    items = data["edits"] if isinstance(data, dict) else data
    for e in items:
        for k in ("eid", "kind", "before", "after"):
            if k not in e:
                sys.exit(f"apply_edits: an edit has no '{k}': {e}")
    return items


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("edits")
    ap.add_argument("--no-build", action="store_true")
    a = ap.parse_args()
    items = load(a.edits)
    langs = i18n.config()["languages"]
    source = langs[0]
    for e in items:
        e["lang"] = e.get("lang") or source
    unknown = sorted({e["lang"] for e in items} - set(langs))
    if unknown:
        sys.exit(f"apply_edits: languages {unknown} are not in deck.config.json \"languages\" {langs}")

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = os.path.join(DECK, ".edits-backup", stamp)
    os.makedirs(backup, exist_ok=True)
    applied, conflicts = [], []

    def file_edit(path, group, fn):
        if not group:
            return
        if not os.path.exists(path):
            conflicts.extend(f"{e['lang']}:{e['eid']}: {os.path.basename(path)} does not exist" for e in group)
            return
        shutil.copy2(path, backup)
        with open(path, encoding="utf8") as f:
            src = f.read()
        src, ok, bad = fn(src, group)
        with open(path, "w", encoding="utf8") as f:
            f.write(src)
        applied.extend(ok)
        conflicts.extend(bad)

    for lang in langs:
        mine = [e for e in items if e["lang"] == lang]
        text = [e for e in mine if e["kind"] in ("html", "svg")]
        notes = [e for e in mine if e["kind"] == "note"]
        if lang == source:
            file_edit(os.path.join(SRC, "slides.html"), text, edits.apply_slides)
            file_edit(os.path.join(SRC, "notes.js"), notes, edits.apply_notes)
        else:
            if text:
                if os.path.exists(i18n.path_of(lang)):
                    shutil.copy2(i18n.path_of(lang), backup)
                ok, bad = i18n.apply_page_edits(lang, text)
                applied.extend(ok)
                conflicts.extend(bad)
            file_edit(os.path.join(SRC, f"notes_{lang}.js"), notes, edits.apply_notes)
    done = len(items) - len(applied) - len(conflicts)
    print(f"applied {len(applied)} of {len(items)} edits" + (f" ({done} were already in the source)" if done else "") + f"; backup in {backup}")
    for c in conflicts:
        print("  skipped:", c)
    for lang in langs[1:]:
        print("  " + i18n.status(lang).replace("\n", "\n  "))
    if not a.no_build:
        subprocess.run([sys.executable, os.path.join(SRC, "build.py")], check=True)
    sys.exit(1 if conflicts else 0)


if __name__ == "__main__":
    main()
