"""Translations of a deck: one file per extra language, src/i18n/<lang>.txt.

The deck's first language (deck.config.json "languages"[0]) is the source: slides.html and notes.js.
Every other language has src/i18n/<lang>.txt (slide text) and src/notes_<lang>.js (notes). Lines in <lang>.txt:

    s3-2|9f1c2a|||标题写结论              a text unit: element id | fingerprint of the source text | translation
    =Rules and results|||规则与结果       a free string: slide titles and acts (data-title, data-act), chart labels
    ~^(\\d+) min$|||$1 分钟                 a pattern for text that scripts draw (regex|||replacement)
    # comment, ## slide heading

Ids are the editor's ids (edits.py), so editing and translation never collide:
  - the source text of a unit is edited     -> the fingerprint no longer matches: the translation is kept and
                                               reported as "review" until someone checks it (accept);
  - a unit moved (an element added above it) -> the fingerprint is found at another id: the translation follows it
                                               (fix rewrites the file with the new ids);
  - a translation is edited in the page      -> apply_edits.py rewrites that line only; the source is not touched.

    python3 src/i18n.py status [lang]            coverage, moved, review
    python3 src/i18n.py todo [lang]              write src/i18n/todo_<lang>.txt: units to translate or review
    python3 src/i18n.py merge <todo file>        copy the filled lines of a todo file into <lang>.txt
    python3 src/i18n.py fix [lang]               rewrite <lang>.txt with current ids
    python3 src/i18n.py accept <lang> <id>…      mark reviewed units as current (new fingerprint)
"""
import hashlib
import json
import os
import re
import sys
from typing import Dict, List, Tuple

import edits

SRC = os.path.dirname(os.path.abspath(__file__))
DECK = os.path.dirname(SRC)
DIR = os.path.join(SRC, "i18n")


def fp(text: str) -> str:
    """Fingerprint of a unit's visible source text."""
    return hashlib.sha1(edits.text_of(text).encode("utf8")).hexdigest()[:6]


def config() -> dict:
    with open(os.path.join(DECK, "deck.config.json"), encoding="utf8") as f:
        cfg = json.load(f)
    langs = cfg.get("languages") or [cfg.get("lang", "en")]
    cfg["languages"] = langs
    return cfg


def cfg_source() -> str:
    return config()["languages"][0]


def path_of(lang: str) -> str:
    return os.path.join(DIR, lang + ".txt")


def parse(text: str) -> Tuple[List[list], Dict[str, str], List[list]]:
    """(units [[id, fingerprint, translation]], free strings {source: translation}, patterns [[regex, repl]])."""
    units, free, pats = [], {}, []
    for raw in text.splitlines():
        line = raw.rstrip("\n")
        if line.startswith("#? ") and "|||" in line:             # unplaced: kept, never applied
            continue
        if not line.strip() or line.lstrip().startswith("#") or "|||" not in line:
            continue
        head, val = line.split("|||", 1)
        val = val.strip()
        if head.startswith("="):
            if val:
                free[head[1:].strip()] = val
        elif head.startswith("~"):
            pats.append([head[1:], val])
        else:
            parts = head.strip().split("|")
            if val:
                units.append([parts[0], parts[1] if len(parts) > 1 else "", val])
    return units, free, pats


def unplaced(lang: str) -> list:
    out = []
    for line in read(lang).splitlines():
        if line.startswith("#? ") and "|||" in line:
            head, val = line[3:].split("|||", 1)
            parts = head.split("|")
            out.append((parts[0], parts[1] if len(parts) > 1 else "", val.strip()))
    return out


def read(lang: str) -> str:
    p = path_of(lang)
    if not os.path.exists(p):
        return ""
    with open(p, encoding="utf8") as f:
        return f.read()


def source_units() -> Dict[str, dict]:
    """id -> {slide, text, fp} for every editable element of slides.html."""
    with open(os.path.join(SRC, "slides.html"), encoding="utf8") as f:
        src = f.read()
    out = {}
    for it in edits.scan(src):
        inner = src[it.node.open_end:it.node.close_start]
        out[it.eid] = {"slide": it.slide, "text": edits.text_of(inner), "html": re.sub(r"\s+", " ", inner).strip(), "fp": fp(inner), "kind": it.kind}
    return out


def resolve(lang: str) -> dict:
    """Match the translation file to the current slides.

    Returns {units: {id: translation}, moved: [(old, new)], review: [id], orphan: [id], missing: [id], free, pats}.
    Order of claims: exact (id and fingerprint match), then moved (fingerprint found at one free id), then
    review (same id, other fingerprint: the source was edited)."""
    units, free, pats = parse(read(lang))
    cur = source_units()
    by_fp: Dict[str, List[str]] = {}
    for i, u in cur.items():
        by_fp.setdefault(u["fp"], []).append(i)
    taken: Dict[str, str] = {}
    moved, review, orphan, later = [], [], [], []
    review_fp: Dict[str, str] = {}                                     # new id -> fingerprint at translation time
    for uid, f, val in units:
        if uid in cur and cur[uid]["fp"] == f and uid not in taken:
            taken[uid] = val
        else:
            later.append((uid, f, val))
    pos = lambda i: (int(i[1:].split("-")[0]), int(i.split("-")[1])) if re.match(r"^s\d+-\d+$", i) else (10 ** 6, 0)
    rest = []
    for uid, f, val in sorted(later, key=lambda u: pos(u[0])):
        # moved: the same source text at another id; with duplicates take the nearest free one on the same slide
        free_ids = [i for i in by_fp.get(f, []) if i not in taken] if f else []
        if free_ids:
            s0, k0 = pos(uid)
            best = min(free_ids, key=lambda i: (pos(i)[0] != s0, abs(pos(i)[0] - s0), abs(pos(i)[1] - k0)))
            taken[best] = val
            moved.append((uid, best))
        else:
            rest.append((uid, f, val))
    def shifted(uid: str) -> str:
        """The id this unit would have now, if it moved like its nearest moved neighbour on the same slide."""
        s0, k0 = pos(uid)
        near = [(abs(pos(a)[1] - k0), pos(b)[1] - pos(a)[1]) for a, b in moved if pos(a)[0] == s0 and pos(b)[0] == s0]
        return f"s{s0}-{k0 + min(near)[1]}" if near else uid
    for uid, f, val in rest:
        # review: the source text was edited (its old text exists nowhere any more); follow the slide's shift
        if f in by_fp:
            orphan.append((uid, f, val))
            continue
        for cand in (uid, shifted(uid)):
            if cand in cur and cand not in taken:
                taken[cand] = val
                review.append(cand)
                review_fp[cand] = f
                if cand != uid:
                    moved.append((uid, cand))
                break
        else:
            orphan.append((uid, f, val))
    missing = [i for i in cur if i not in taken and re.search(r"[A-Za-z一-鿿]", cur[i]["text"])]
    return {"units": taken, "moved": moved, "review": review, "review_fp": review_fp, "orphan": orphan, "missing": missing,
            "free": free, "pats": pats, "cur": cur}


def slide_attrs() -> List[Tuple[int, str, str]]:
    """(slide, attribute, text) for data-title and data-act."""
    with open(os.path.join(SRC, "slides.html"), encoding="utf8") as f:
        src = re.sub(r"<!--.*?-->", "", f.read(), flags=re.S)
    out = []
    for n, m in enumerate(re.finditer(r'<section\s+class="slide[^"]*"([^>]*)>', src), 1):
        for a in ("title", "act", "strip-label"):
            v = re.search(r'data-' + a + r'="([^"]*)"', m.group(1))
            if v and v.group(1).strip():
                out.append((n, a, v.group(1)))
    return out


def config_strings() -> List[str]:
    """Deck strings in deck.config.json "pdf": supplement titles, subs, captions, frame alt texts, the how-to page."""
    pdf = config().get("pdf") or {}
    out = []
    for g in pdf.get("supplements") or []:
        out += [g.get("title", ""), g.get("sub", "")] + [it[1] for it in g.get("items", []) if len(it) > 1]
    out += [f.get("alt", "") for f in pdf.get("frames") or []]
    how = pdf.get("howTo") or {}
    out += [how.get("title", ""), how.get("note", "")] + list(how.get("items") or [])
    return [re.sub(r"\s+", " ", x).strip() for x in out if x and x.strip()]


def status(lang: str) -> str:
    r = resolve(lang)
    n = len(r["cur"])
    lines = [f"{lang}: {len(r['units'])} of {n} text units translated"]
    if r["missing"]:
        lines.append(f"  {len(r['missing'])} to translate (python3 src/i18n.py todo {lang})")
    if r["moved"]:
        lines.append(f"  {len(r['moved'])} moved to new ids (python3 src/i18n.py fix {lang}): " + ", ".join(f"{a}→{b}" for a, b in r["moved"][:6]))
    if r["review"]:
        lines.append(f"  {len(r['review'])} to review, the source text changed since translation: " + ", ".join(r["review"][:10]))
    if r["orphan"]:
        lines.append(f"  {len(r['orphan'])} translations match no element (deleted text?), kept as unplaced: " + ", ".join(o[0] for o in r["orphan"][:6]))
    attrs = [t for _, _, t in slide_attrs() if t not in r["free"]]
    if attrs:
        lines.append(f"  {len(set(attrs))} slide titles or acts without a translation")
    pdf = [t for t in config_strings() if t not in r["free"]]
    if pdf:
        lines.append(f"  {len(set(pdf))} PDF handout strings (deck.config.json) without a translation")
    return "\n".join(lines)


def todo(lang: str) -> str:
    r = resolve(lang)
    cur = r["cur"]
    need = sorted(set(r["missing"]) | set(r["review"]), key=lambda i: (cur[i]["slide"], int(i.split("-")[1])))
    out = [f"# Fill in the {lang} text after |||. Keep the inline markup of the source (<b>, <span class=…>).",
           f"# Lines marked REVIEW have a translation whose source changed: check it and correct it.",
           f"# Then run: python3 src/i18n.py merge {os.path.relpath(os.path.join(DIR, 'todo_' + lang + '.txt'), DECK)}"]
    slide = 0
    for i in need:
        if cur[i]["slide"] != slide:
            slide = cur[i]["slide"]
            out.append(f"\n## {slide}")
        out.append(f"# {cfg_source()}: {cur[i]['html']}" + ("   REVIEW" if i in r["review"] else ""))
        out.append(f"{i}|{cur[i]['fp']}|||{r['units'].get(i, '')}")
    attrs = sorted({t for _, _, t in slide_attrs() if t not in r["free"]})
    if attrs:
        out.append("\n## slide titles and acts (overview, notes, presenter)")
        out += [f"={t}|||" for t in attrs]
    pdf = sorted({t for t in config_strings() if t not in r["free"]})
    if pdf:
        out.append("\n## PDF handout strings (deck.config.json pdf)")
        out += [f"={t}|||" for t in pdf]
    path = os.path.join(DIR, "todo_" + lang + ".txt")
    os.makedirs(DIR, exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        f.write("\n".join(out) + "\n")
    return f"{len(need)} units, {len(attrs)} titles or acts and {len(pdf)} PDF strings -> {path}"


def write(lang: str, units: Dict[str, str], cur: Dict[str, dict], free: Dict[str, str], pats: List[list], keep: Dict[str, str] = None, orphan: list = None) -> None:
    """Rewrite <lang>.txt in slide order. keep: id -> fingerprint to keep (units under review).
    orphan: translations that match no element; they are kept as comments, never deleted."""
    keep = keep or {}
    out = [f"# {lang} translation. Format: id|fingerprint|||text. Edit text after |||; run python3 src/i18n.py status {lang}."]
    slide = 0
    for i in sorted(units, key=lambda i: (cur[i]["slide"], int(i.split("-")[1])) if i in cur else (10 ** 6, 0)):
        if i not in cur:
            continue
        if cur[i]["slide"] != slide:
            slide = cur[i]["slide"]
            out.append(f"\n## {slide}")
        out.append(f"{i}|{keep.get(i, cur[i]['fp'])}|||{units[i]}")
    if free:
        out.append("\n## free strings")
        out += [f"={k}|||{v}" for k, v in free.items()]
    if pats:
        out.append("\n## patterns")
        out += [f"~{p}|||{r}" for p, r in pats]
    if orphan:
        out.append("\n## unplaced: their source text is gone. Move a line up (with the right id) or delete it.")
        out += [f"#? {uid}|{f}|||{val}" for uid, f, val in orphan]
    with open(path_of(lang), "w", encoding="utf8") as f:
        f.write("\n".join(out) + "\n")


def fix(lang: str) -> str:
    r = resolve(lang)
    keep = dict(r["review_fp"])                                         # review stays flagged
    write(lang, r["units"], r["cur"], r["free"], r["pats"], keep, r["orphan"] + unplaced(lang))
    return f"{lang}.txt rewritten: {len(r['moved'])} moved, {len(r['review'])} still to review, {len(r['orphan'])} unplaced (kept as comments)"


def accept(lang: str, ids: List[str]) -> str:
    r = resolve(lang)
    keep = {i: f for i, f in r["review_fp"].items() if i not in ids}
    write(lang, r["units"], r["cur"], r["free"], r["pats"], keep, r["orphan"] + unplaced(lang))
    return f"accepted {len([i for i in ids if i in r['review']])}; {len(keep)} still to review"


def merge(todo_path: str) -> str:
    lang = re.sub(r"^todo_|\.txt$", "", os.path.basename(todo_path))
    with open(todo_path, encoding="utf8") as f:
        new_units, new_free, new_pats = parse(f.read())
    r = resolve(lang)
    units = dict(r["units"])
    keep = dict(r["review_fp"])
    for uid, f, val in new_units:
        units[uid] = val
        keep.pop(uid, None)                                             # filled or reviewed now
    free = dict(r["free"], **new_free)
    write(lang, units, r["cur"], free, r["pats"] + [p for p in new_pats if p not in r["pats"]], keep, r["orphan"] + unplaced(lang))
    return f"merged {len(new_units)} units and {len(new_free)} strings into {lang}.txt\n" + status(lang)


def apply_page_edits(lang: str, items: list) -> Tuple[list, list]:
    """Write text edits made in the page in a translated language into <lang>.txt. The source is not touched.
    An edit applies when the page showed what the file holds now (the translation, or the source if none)."""
    import html as _html
    r = resolve(lang)
    units = dict(r["units"])
    keep = dict(r["review_fp"])
    applied, conflicts = [], []
    for e in items:
        uid = e["eid"]
        if uid not in r["cur"]:
            conflicts.append(f"{lang}:{uid}: no such element any more; apply it by hand")
            continue
        now = units.get(uid, r["cur"][uid]["text"])
        new = _html.escape(e["after"], quote=False) if e["kind"] == "svg" else edits.clean(e["after"])
        if edits.text_of(now) == edits.text_of(new):
            continue                                                    # already in the file
        if edits.text_of(now) != edits.text_of(e["before"]):
            conflicts.append(f"{lang}:{uid}: the translation changed since the edit; apply it by hand")
            continue
        units[uid] = new
        keep.pop(uid, None)                                             # the person who edited it reviewed it
        applied.append(f"{lang}:{uid}")
    if applied:
        write(lang, units, r["cur"], r["free"], r["pats"], keep, r["orphan"] + unplaced(lang))
    return applied, conflicts


def page_data(cfg: dict) -> dict:
    """What the page needs: {source, langs, tr: {lang: {units, free, pats}}}. Prints the status of each language."""
    langs = cfg["languages"]
    data = {"source": langs[0], "langs": langs, "tr": {}}
    for lang in langs[1:]:
        r = resolve(lang)
        data["tr"][lang] = {"units": r["units"], "free": r["free"], "pats": r["pats"]}
        print("build: " + status(lang).replace("\n", "\n       "))
    return data


def main(argv: List[str]) -> None:
    cfg = config()
    others = cfg["languages"][1:]
    if not argv or argv[0] in ("-h", "--help"):
        sys.exit(__doc__)
    cmd, args = argv[0], argv[1:]
    lang = args[0] if args else (others[0] if others else None)
    if cmd != "merge" and not lang:
        sys.exit("i18n: the deck has one language. Add one to deck.config.json \"languages\".")
    if cmd == "status":
        print(status(lang))
    elif cmd == "todo":
        print(todo(lang))
    elif cmd == "fix":
        print(fix(lang))
    elif cmd == "accept":
        print(accept(args[0], args[1:]))
    elif cmd == "merge":
        print(merge(args[0]))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
