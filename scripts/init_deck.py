"""Create a new HTML deck from the skill template.

    python3 init_deck.py <deck folder> --title "Deck title" [--lang en|zh] [--translate zh] [--project-root <dir>] [--port 8791]

--lang is the source language (slides.html, notes.js). --translate adds languages with a switch (L key):
it creates src/i18n/<lang>.txt and src/notes_<lang>.js to fill; python3 src/i18n.py todo <lang> lists the work.

Creates <deck folder> with src/, embed/, pdf/, materials/INDEX.md and deck.config.json, then builds once.
With --project-root, adds a "deck" entry to <project-root>/.claude/launch.json for the Browser preview.
The folder must not exist or must be empty.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE = os.path.join(SKILL, "assets", "template")
CJK_SANS = '"IBM Plex Sans","PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif'

INDEX = """# Materials index

Copy only the selected materials into this folder. One row per file.
Evidence: p primary · a academic · m media or company claim · i inference · v to verify · n internal.

| File | Origin (full path) | Kind | Used on slides | Evidence | Note |
|---|---|---|---|---|---|
| | | report / interactive page / figure / data | | | |
"""


TAGS = {"zh": '{ p: "一手", a: "学术", m: "媒体 / 声明", i: "推断", v: "待核实", n: "内部" }',
        "en": '{ p: "Primary", a: "Academic", m: "Media / claim", i: "Inference", v: "To verify", n: "Internal" }'}


def notes_skeleton(deck: str, lang: str) -> None:
    """src/notes_<lang>.js with one empty entry per entry of notes.js (same /* N · Title */ markers)."""
    with open(os.path.join(deck, "src", "notes.js"), encoding="utf8") as f:
        marks = re.findall(r"/\*\s*(\d+\s*·[^*]*?)\s*\*/", f.read())
    body = "\n".join(f"    /* {m} */\n    {{}}," for m in marks)
    text = f"""/* Notes in {lang}, parallel to N in notes.js: same slide order, same "N · Title" marker comments.
   Per entry: say, cue (same count and order), land, limits (the texts only, same order). A missing field shows the
   source text. Sources keep their original titles, so they are not here. figs: figure key -> [name, description]. */
window.NOTES_TR.{lang} = {{
  tags: {TAGS.get(lang, "{}")},
  figs: {{}},
  slides: [
{body}
  ]
}};
"""
    with open(os.path.join(deck, "src", f"notes_{lang}.js"), "w", encoding="utf8") as f:
        f.write(text)


def slug(title: str) -> str:
    s = re.sub(r"[^\w]+", "-", title).strip("-_")
    return s or "Deck"


def add_launch(root: str, deck: str, port: int) -> str:
    path = os.path.join(root, ".claude", "launch.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = {"version": "0.0.1", "configurations": []}
    if os.path.exists(path):
        with open(path, encoding="utf8") as f:
            data = json.load(f)
    name = "deck-" + os.path.basename(os.path.abspath(deck))
    data["configurations"] = [c for c in data.get("configurations", []) if c.get("name") != name]
    data["configurations"].append({
        "name": name, "runtimeExecutable": "python3",
        "runtimeArgs": ["-m", "http.server", str(port), "--directory", os.path.abspath(deck)], "port": port,
    })
    with open(path, "w", encoding="utf8") as f:
        json.dump(data, f, indent=2)
    return name


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("deck")
    ap.add_argument("--title", required=True)
    ap.add_argument("--lang", choices=["en", "zh"], default="en")
    ap.add_argument("--translate", default="", help="comma list of extra languages, for example zh")
    ap.add_argument("--project-root")
    ap.add_argument("--port", type=int, default=8791)
    a = ap.parse_args()

    deck = os.path.abspath(a.deck)
    if os.path.exists(deck) and os.listdir(deck):
        sys.exit(f"init: {deck} is not empty. Pick a new folder.")
    shutil.copytree(TEMPLATE, deck, dirs_exist_ok=True)
    os.makedirs(os.path.join(deck, "materials"), exist_ok=True)
    with open(os.path.join(deck, "materials", "INDEX.md"), "w", encoding="utf8") as f:
        f.write(INDEX)

    cfg_path = os.path.join(deck, "deck.config.json")
    with open(cfg_path, encoding="utf8") as f:
        cfg = json.load(f)
    cfg["title"] = a.title
    extra = [x.strip() for x in a.translate.split(",") if x.strip() and x.strip() != a.lang]
    for x in extra:
        if x not in ("en", "zh"):
            sys.exit(f"init: language {x}: only en and zh have engine strings; add src/i18n/ui_{x}.json first")
    cfg["lang"] = a.lang
    cfg["languages"] = [a.lang] + extra
    cfg["pdf"]["file"] = slug(a.title) + ".pdf"
    cfg["script"]["file"] = slug(a.title) + "-script"
    if a.lang == "zh" or "zh" in extra:
        cfg["tokens"]["--sans"] = CJK_SANS
    with open(cfg_path, "w", encoding="utf8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
        f.write("\n")

    for x in extra:
        with open(os.path.join(deck, "src", "i18n", x + ".txt"), "w", encoding="utf8") as f:
            f.write(f"# {x} translation. Format: id|fingerprint|||text. Fill it from: python3 src/i18n.py todo {x}\n")
        notes_skeleton(deck, x)
    subprocess.run([sys.executable, os.path.join(deck, "src", "figs_gen.py")], check=True)
    subprocess.run([sys.executable, os.path.join(deck, "src", "build.py")], check=True)
    print("deck created:", deck, "· languages:", ", ".join(cfg["languages"]))
    for x in extra:
        print(f"translate: python3 {os.path.join(deck, 'src', 'i18n.py')} todo {x}")
    print("open", os.path.join(deck, "preview.html"), "to play it (no server needed)")
    if a.project_root:
        print("Browser preview config:", add_launch(a.project_root, deck, a.port))


if __name__ == "__main__":
    main()
