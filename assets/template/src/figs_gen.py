"""Reference figures for the Notes and sources panel. Writes src/figs.html (hidden <template> blocks).

A figure is a function that returns one SVG (or HTML) string. Register it in FIGURES with its template id;
notes.js refers to it with { k: "tpl", t: "<template id>" }.
Style: deck tokens; diagram rules: orthogonal connectors, label gap of 6 px or more, 4 px grid,
max 2 accent groups, legend strip at the bottom, svg with title and desc.
Run:  python3 src/figs_gen.py   (then python3 src/build.py)
"""
import json
import os
import subprocess
from typing import Iterable

KATEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "katex", "katex.min.js")

INK, MUT, SOFT, ACC, ACCT, RULE = "#141b24", "#46515e", "#7a8794", "#c2412d", "#fbe9e5", "#d9dfe5"


def esc(t: str) -> str:
    return t.replace("&", "&amp;").replace("<", "&lt;")


def txt(x: float, y: float, s: str, size: int = 16, fill: str = MUT, weight: int = 400, anchor: str = "start",
        mono: bool = False, ls: str = "", extra: str = "") -> str:
    cls = ' class="m"' if mono else ""
    sp = f' letter-spacing="{ls}"' if ls else ""
    return (f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-weight="{weight}" '
            f'text-anchor="{anchor}"{cls}{sp}{extra}>{esc(s)}</text>')


def box(x: float, y: float, w: float, h: float, name: str, sub: Iterable[str] = (), focal: bool = False,
        dashed: bool = False, tag: str = "", name_size: int = 20) -> str:
    """A node: white mask rect first (hides connectors under it), then the visible box."""
    st, fl, sw = (ACC, ACCT, 2) if focal else (INK, "#fff", 1.5)
    da = ' stroke-dasharray="6 5"' if dashed else ""
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="#fff"/>'
    s += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{fl}" stroke="{st}" stroke-width="{sw}"{da}/>'
    cx, top = x + w / 2, y + (52 if tag else 32)
    if tag:
        s += txt(x + 16, y + 24, tag, 16, ACC if focal else SOFT, 500, mono=True, ls="0.08em")
    s += txt(cx, top, name, name_size, INK, 600, "middle")
    for i, line in enumerate(sub):
        s += txt(cx, top + 26 + i * 22, line, 16, MUT, 400, "middle")
    return s


def svg_open(slug: str, title: str, desc: str, w: int, h: int) -> str:
    return (f'<svg viewBox="0 0 {w} {h}" width="100%" role="img" aria-labelledby="{slug}-title {slug}-desc">'
            f'<title id="{slug}-title">{esc(title)}</title><desc id="{slug}-desc">{esc(desc)}</desc>')


def marker(slug: str) -> str:
    """Arrow heads: #slug-a (grey) and #slug-ac (accent)."""
    return (f'<defs><marker id="{slug}-a" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="10" refX="11" refY="5" orient="auto">'
            f'<polygon points="0 0,12 5,0 10" fill="{MUT}"/></marker>'
            f'<marker id="{slug}-ac" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="10" refX="11" refY="5" orient="auto">'
            f'<polygon points="0 0,12 5,0 10" fill="{ACC}"/></marker></defs>')


def legend(y: int, w: int, items: Iterable[str]) -> str:
    s = f'<line x1="24" y1="{y}" x2="{w - 24}" y2="{y}" stroke="{RULE}" stroke-width="1"/>'
    x = 24
    for it in items:
        s += txt(x, y + 32, it, 16)
        x += 24 + len(it) * 9
    return s


def tex(items: list, display: bool = True) -> list:
    """Render TeX strings to KaTeX HTML at build time (needs node; no runtime script, works offline).
    Use it for formulas in reference figures and on slides; build.py adds the KaTeX CSS when it finds the output.
    Write units and named superscripts with \\mathrm{} (P^{\\mathrm{grid}}), or they render as italic products."""
    js = ("const k=require(process.argv[1]);const a=JSON.parse(require('fs').readFileSync(0,'utf8'));"
          "process.stdout.write(JSON.stringify(a.map(t=>k.renderToString(t,{displayMode:%s,throwOnError:true,output:'html'}))));"
          % ("true" if display else "false"))
    r = subprocess.run(["node", "-e", js, KATEX], input=json.dumps(items), capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


# Line icons: 40×40, stroke only, one colour. Use them where a picture names a thing faster than a word
# (industries, assets, actors, steps). icon("ship", "#2f67a6") → inline SVG; put them in .icrow on a slide.
ICONS = {
    "factory": '<rect x="8" y="6" width="10" height="28" rx="2"/><path d="M8 14h10M8 22h10M22 34V18l8-5v21M4 34h32"/>',
    "chiller": '<path d="M20 4v32M6 12l28 16M6 28l28-16M16 7l4 4 4-4M16 33l4-4 4 4"/>',
    "water": '<path d="M4 12h18a6 6 0 0 1 6 6v3M10 8v8M6 8h8"/><path d="M28 26c-3 4-3 6 0 7s3-3 0-7z" fill="currentColor"/>',
    "ship": '<path d="M4 24h32l-5 9H9zM12 24v-8h14v8M18 16v-7h5v7M4 37c4-2 8 2 12 0s8 2 12 0 8 2 8 0"/>',
    "fan": '<rect x="5" y="5" width="30" height="30" rx="4"/><circle cx="20" cy="20" r="3"/><path d="M20 17c0-6 6-8 7-4M23 20c6 0 8 6 4 7M20 23c0 6-6 8-7 4M17 20c-6 0-8-6-4-7"/>',
    "battery": '<rect x="6" y="11" width="26" height="18" rx="3"/><path d="M32 17h3v6h-3M11 16v8M16 16v8M21 16v8"/>',
    "solar": '<path d="M6 30l5-14h18l5 14zM10 23h20M17 16l-2 14M23 16l2 14M20 4v5M11 7l2 3M29 7l-2 3"/>',
    "grid": '<path d="M20 4l-8 32M20 4l8 32M14 28h12M16 18h8M8 12h24M8 12v4M32 12v4"/>',
    "genset": '<rect x="5" y="14" width="24" height="16" rx="2"/><path d="M29 18h4v8h-4M10 30v4M24 30v4M9 8h8v6M19 17l-4 6h5l-3 5"/>',
    "server": '<rect x="7" y="5" width="26" height="9" rx="2"/><rect x="7" y="16" width="26" height="9" rx="2"/><rect x="7" y="27" width="26" height="9" rx="2"/><path d="M12 9.5h2M12 20.5h2M12 31.5h2"/>',
    "chip": '<rect x="11" y="11" width="18" height="18" rx="2"/><path d="M15 5v6M20 5v6M25 5v6M15 29v6M20 29v6M25 29v6M5 15h6M5 20h6M5 25h6M29 15h6M29 20h6M29 25h6"/>',
    "plug": '<path d="M14 4v8M26 4v8M10 12h20v8a10 10 0 0 1-20 0zM20 30v6"/>',
    "forecast": '<path d="M4 32h32M6 28l8-9 6 5 8-12"/><path d="M28 12l6-4" stroke-dasharray="3 3"/><circle cx="28" cy="12" r="2"/>',
    "clock": '<circle cx="20" cy="20" r="15"/><path d="M20 10v10l7 4"/>',
    "money": '<rect x="4" y="11" width="32" height="18" rx="3"/><circle cx="20" cy="20" r="5"/><path d="M9 16v8M31 16v8"/>',
    "shield": '<path d="M20 4l13 5v9c0 9-6 15-13 18-7-3-13-9-13-18V9zM14 20l4 4 8-9"/>',
    "people": '<circle cx="14" cy="13" r="5"/><circle cx="27" cy="14" r="4"/><path d="M4 34c0-7 4-11 10-11s10 4 10 11M24 23c6 0 10 3 10 10"/>',
    "building": '<path d="M8 36V6h16v30M24 16h8v20M4 36h32M12 11h2M18 11h2M12 17h2M18 17h2M12 23h2M18 23h2M17 36v-6h-4v6"/>',
    "truck": '<path d="M3 10h20v18H3zM23 16h8l6 6v6H23M3 28h34"/><circle cx="10" cy="31" r="3"/><circle cx="30" cy="31" r="3"/>',
    "check": '<rect x="5" y="5" width="30" height="30" rx="4"/><path d="M12 20l6 6 11-12"/>',
}


def icon(name: str, color: str = "#2f67a6", sw: float = 2.5) -> str:
    return (f'<svg class="ico" viewBox="0 0 40 40" aria-hidden="true" style="color:{color}" stroke="currentColor" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</svg>')


# ---------------------------------------------------------------- example: a three-step chain
def fig_example() -> str:
    s = [svg_open("fx", "Three steps from cause to result",
                  "A cause leads to an effect. Our control point acts on the effect. The result follows.", 1200, 300),
         marker("fx")]
    xs = [24, 424, 824]
    for i in range(2):                                         # connectors before nodes, so nodes mask them
        col, mk = (ACC, "fx-ac") if i == 1 else (MUT, "fx-a")
        s.append(f'<path d="M {xs[i] + 352} 120 H {xs[i + 1]}" fill="none" stroke="{col}" stroke-width="2" marker-end="url(#{mk})"/>')
    for i, (nm, sub) in enumerate([("Cause", ["One line"]), ("Our control point", ["One line"]), ("Result", ["One line"])]):
        s.append(box(xs[i], 56, 352, 128, nm, sub, focal=(i == 1), tag=f"STEP {i + 1}"))
    s.append(legend(228, 1200, ["Grey: public practice", "Red: where our work acts"]))
    s.append("</svg>")
    return "".join(s)


FIGURES = [("fig-example", fig_example)]


def main() -> None:
    out = "\n".join(f'<template id="{tid}">{fn()}</template>' for tid, fn in FIGURES) + "\n"
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "figs.html")
    with open(path, "w", encoding="utf8") as f:
        f.write(out)
    print("figs.html", len(out), "bytes")


if __name__ == "__main__":
    main()
