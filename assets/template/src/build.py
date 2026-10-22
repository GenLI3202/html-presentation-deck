"""Assemble the deck from src/ and deck.config.json.

Outputs (in the deck folder):
  index.html    artifact fragment: fonts from Google Fonts, embed pages fetched from embed/ at run time.
  preview.html  single file for local play: embed pages, fonts and CDN scripts inlined; works offline.

The build stops when:
  - an output or an embed page names Claude or links to claude.ai (shared outputs must not show them);
  - a slide uses an embed key, zoom template or tour target that does not exist.
It warns when the notes count differs from the slide count.
Run:  python3 src/build.py
"""
import html
import json
import os
import re
import sys

import edits
import i18n
import offline

SRC = os.path.dirname(os.path.abspath(__file__))
DECK = os.path.dirname(SRC)
CSS = ["css/base.css", "css/chrome.css", "css/motion.css", "css/custom.css"]
ENGINE_AFTER = ["js/anim.js", "js/transition.js", "js/tour.js", "js/presenter.js", "js/editor.js", "js/deck.js"]   # after the deck scripts
FORBIDDEN = re.compile(r"claude\.ai|anthropic|\bclaude\b", re.I)


def rd(name: str, base: str = SRC) -> str:
    with open(os.path.join(base, name), encoding="utf8") as f:
        return f.read()


def load_config() -> dict:
    cfg = json.loads(rd("deck.config.json", DECK))
    for key in ("title", "fonts"):
        if not cfg.get(key):
            sys.exit(f"build: deck.config.json needs '{key}'")
    cfg.setdefault("lang", "en")
    cfg.setdefault("tokens", {})
    cfg.setdefault("embeds", {})
    cfg.setdefault("scripts", [])
    cfg.setdefault("editing", True)                          # in-place text editing (js/editor.js)
    cfg["languages"] = cfg.get("languages") or [cfg["lang"]]   # first = source; others from src/i18n/<lang>.txt
    cfg["lang"] = cfg["languages"][0]
    return cfg


def esc_script(text: str) -> str:
    return text.replace("</script", "<\\/script")


def css(cfg: dict) -> str:
    tokens = "".join(f"{k}:{v};" for k, v in cfg["tokens"].items())
    parts = [rd(n) for n in CSS]
    used = rd("slides.html") + (rd("figs.html") if os.path.exists(os.path.join(SRC, "figs.html")) else "")
    if 'class="katex' in used:                                # formulas from figs_gen.tex(): fonts inlined, offline
        parts.insert(-1, rd("katex/katex-embedded.css"))
    if tokens:
        parts.insert(1, ":root{" + tokens + "}")
    return "\n".join(parts)


def ui_dict(langs: list) -> dict:
    """Engine strings per language: src/i18n/ui_<lang>.json (English keys)."""
    out = {}
    for lang in langs:
        p = os.path.join(SRC, "i18n", "ui_" + lang + ".json")
        if lang != "en" and os.path.exists(p):
            with open(p, encoding="utf8") as f:
                out[lang] = json.load(f)
        elif lang != "en":
            print(f"build: warning, no src/i18n/ui_{lang}.json: the controls stay in English")
    return out


def body(cfg: dict, tr: dict) -> str:
    engine = [n for n in ENGINE_AFTER if cfg["editing"] or n != "js/editor.js"]
    alt = [f"notes_{lang}.js" for lang in cfg["languages"][1:] if os.path.exists(os.path.join(SRC, f"notes_{lang}.js"))]
    names = alt + ["notes.js", "js/i18n.js"] + [os.path.join("js", n) if not n.startswith("js/") else n for n in cfg["scripts"]] + engine
    conf = {"embeds": cfg["embeds"], "title": cfg["title"]}
    data = lambda name, obj: "<script>window." + name + "=" + esc_script(json.dumps(obj, ensure_ascii=False)) + ";</script>"
    scripts = [data("DECK_CONFIG", conf), data("I18N_DATA", tr), data("I18N_UI", ui_dict(cfg["languages"])),
               "<script>window.NOTES_TR={};</script>"]
    scripts += ["<script>\n" + rd(n) + "\n</script>" for n in names]
    multi = len(cfg["languages"]) > 1
    hint = "← → move · R reference figures · ? all keys"
    figs = rd("figs.html") if os.path.exists(os.path.join(SRC, "figs.html")) else ""
    return f"""<style>
{css(cfg)}
</style>
<div id="viewport">
  <div id="stageWrap">
    <div id="stage">
      <div class="progress"></div>
{edits.stamp(rd("slides.html"))}
    </div>
  </div>
  <aside id="notes" aria-label="Notes and sources"><div class="in"></div></aside>
</div>
{figs}
<div class="dctl" role="toolbar" aria-label="Deck controls">
  <div class="dctl-more" id="dMore" hidden>
    <button type="button" id="bPrev" aria-label="Previous slide">←</button>
    <button type="button" id="bNext" aria-label="Next slide">→</button>
    <button type="button" id="bNotes" aria-pressed="false" data-ui="Notes &amp; sources">Notes &amp; sources</button>
    <button type="button" id="bPres" data-ui="Presenter">Presenter</button>
    {'<button type="button" id="bEdit" aria-pressed="false" data-ui="Edit text">Edit text</button>' if cfg["editing"] else ""}
    {'<button type="button" id="bLang" aria-label="Switch language"></button>' if multi else ""}
    <button type="button" id="bKeys" data-ui="Keys ?">Keys ?</button>
  </div>
  <button type="button" id="bFig" class="dctl-fig" hidden></button>
  <button type="button" id="bOv" data-ui="Overview">Overview</button>
  <button type="button" id="bFs">Full screen</button>
  <button type="button" id="bMore" aria-expanded="false" aria-controls="dMore" aria-label="More controls">⋯</button>
</div>
<div id="keys" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" hidden><div class="keys-in"></div></div>
<div id="viewer" role="dialog" aria-modal="true" aria-label="Reference figure" hidden>
  <div class="vw-bar">
    <div class="vw-t"><span class="vw-k" data-ui="Reference figure">Reference figure</span><b class="vw-name"></b><span class="vw-desc"></span></div>
    <div class="vw-btns">
      <button type="button" class="vw-prev" aria-label="Previous figure">←</button><span class="vw-n"></span><button type="button" class="vw-next" aria-label="Next figure">→</button>
      <a class="vw-open" target="_blank" rel="noopener" hidden data-ui="Open in new tab">Open in new tab</a>
      <button type="button" class="vw-close" data-ui="Close">Close</button>
    </div>
  </div>
  <div class="vw-stage"><div class="vw-card"></div></div>
</div>
<div id="overview" role="dialog" aria-label="Slide overview"><h3 data-ui="Slide overview · click to jump">Slide overview · click to jump</h3><div class="grid"></div></div>
<div id="hint" data-ui="{html.escape(hint)}">{html.escape(hint)}</div>
{chr(10).join(scripts)}
"""


def validate(cfg: dict) -> None:
    """Fail fast on references that would break at run time."""
    slides = re.sub(r"<!--.*?-->", "", rd("slides.html"), flags=re.S)
    figs = rd("figs.html") if os.path.exists(os.path.join(SRC, "figs.html")) else ""
    n_slides = len(re.findall(r'<section\s+class="slide[\s"]', slides))
    errors = []
    for key in sorted(set(re.findall(r'data-embed="([^"]+)"', slides))):
        if key not in cfg["embeds"]:
            errors.append(f"data-embed=\"{key}\" is not in deck.config.json embeds")
    for key, e in cfg["embeds"].items():
        if not os.path.exists(os.path.join(DECK, e["url"])):
            errors.append(f"embed '{key}': file {e['url']} not found")
    for tid in sorted(set(re.findall(r'data-zoom="([^"]+)"', slides))):
        if f'id="{tid}"' not in slides + figs:
            errors.append(f"data-zoom=\"{tid}\": no <template id=\"{tid}\">")
    for n in re.findall(r'data-tour-to="(\d+)"', slides):
        if not 1 <= int(n) <= n_slides:
            errors.append(f"data-tour-to=\"{n}\": the deck has {n_slides} slides")
    if errors:
        sys.exit("build: " + "\n  ".join(["fix these first:"] + errors))
    notes = rd("notes.js")
    n_notes = len(re.findall(r"^\s*/\*\s*\d+\s*·", notes, re.M))
    if n_notes and n_notes != n_slides:
        print(f"build: warning, {n_slides} slides but {n_notes} note entries in notes.js")


def check(name: str, html: str, cfg: dict) -> None:
    """Deck content must not name Claude. The engine's runtime call (window.claude.use, for the Artifact db) is exempt."""
    html = re.sub(r"window\.claude\b", "window.runtime", html)
    hits = sorted(set(m.group(0) for m in FORBIDDEN.finditer(html)))
    for key, e in cfg["embeds"].items():
        hits += sorted(set(e["url"] + ": " + m.group(0) for m in FORBIDDEN.finditer(rd(e["url"], DECK))))
    if hits:
        sys.exit(f"build: {name} names Claude or links to claude.ai: {hits}. Remove them from the sources.")


def embed_map(cfg: dict) -> str:
    """window.__EMBED: every embed page, made offline. JSON with '</' escaped for a script tag."""
    pages = {e["url"]: offline.inline(rd(e["url"], DECK)) for e in cfg["embeds"].values()}
    js = json.dumps(pages, ensure_ascii=False).replace("</", "<\\/").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    return "<script>window.__EMBED=" + js + ";</script>\n"


def main() -> None:
    cfg = load_config()
    validate(cfg)
    out = cfg.get("outputs", {})
    title = "<title>" + cfg["title"].replace("<", "&lt;") + "</title>\n"
    fonts = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="' + cfg["fonts"].replace("&", "&amp;") + '">\n'
    tr = i18n.page_data(cfg)
    frag = title + fonts + body(cfg, tr)
    check("index.html", frag, cfg)
    with open(os.path.join(DECK, out.get("fragment", "index.html")), "w", encoding="utf8") as f:
        f.write(frag)

    head = f'<!doctype html><html lang="{cfg["lang"]}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    single = head + title + "<style>" + offline.font_css(cfg["fonts"]) + "</style></head><body>" + embed_map(cfg) + body(cfg, tr) + "</body></html>"
    left = offline.remote_refs(single)
    if left:
        print("build: warning, preview.html still loads", left)
    check("preview.html", single, {"embeds": {}})
    with open(os.path.join(DECK, out.get("single", "preview.html")), "w", encoding="utf8") as f:
        f.write(single)
    print("built", out.get("fragment", "index.html"), len(frag), "bytes;", out.get("single", "preview.html"), round(len(single) / 1e6, 2), "MB (offline)")


if __name__ == "__main__":
    main()
