"""Reference figures for the Notes and sources panel. Writes src/figs.html (hidden <template> blocks).

A figure is a function that returns one SVG (or HTML) string. Register it in FIGURES with its template id;
notes.js refers to it with { k: "tpl", t: "<template id>" }.
Style: deck tokens; diagram rules: orthogonal connectors, label gap of 6 px or more, 4 px grid,
max 2 accent groups, legend strip at the bottom, svg with title and desc.
Run:  python3 src/figs_gen.py   (then python3 src/build.py)
"""
import os
from typing import Iterable

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
