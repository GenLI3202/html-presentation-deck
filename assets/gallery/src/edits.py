"""Editable text: stable ids for text elements, and writing edits back to the sources.

build.py stamps data-eid on every editable element of slides.html. The page (js/editor.js) lets the owner change
the words of those elements and of the notes, never the layout. apply_edits.py writes the changes back here.

Editable element ("text leaf"): it has its own text, and everything inside it is inline (b, i, em, strong, span,
small, br, sup, sub, code, mark, a). The outermost such element wins. SVG <text> counts too (kind "svg").
Ids are per slide, in document order: s<slide>-<k>. Template content inside a slide (zoom details) is included.
Text that a script draws at run time (charts) and backup figures from figs_gen.py have no id: edit their source.
"""
import html
import re
from html.parser import HTMLParser
from typing import List, Optional

INLINE = {"b", "i", "em", "strong", "span", "small", "br", "sup", "sub", "code", "mark", "a"}
SKIP = {"script", "style", "title", "desc", "textarea", "option"}
VOID = {"br", "img", "input", "meta", "link", "hr", "wbr", "source", "col", "area", "base", "embed", "param", "track"}


class Node:
    __slots__ = ("tag", "attrs", "start", "open_end", "close_start", "children", "text", "parent", "slide")

    def __init__(self, tag: str, attrs: dict, start: int, open_end: int, parent: Optional["Node"]):
        self.tag, self.attrs, self.start, self.open_end = tag, attrs, start, open_end
        self.close_start = open_end
        self.children: List["Node"] = []
        self.text = False
        self.parent = parent
        self.slide = parent.slide if parent else 0


class _Tree(HTMLParser):
    """Element tree with source offsets. The source must be well-formed (every non-void element closed)."""

    def __init__(self, src: str):
        super().__init__(convert_charrefs=False)
        self.src = src
        self.lines = [0]
        for m in re.finditer("\n", src):
            self.lines.append(m.end())
        self.root = Node("#root", {}, 0, 0, None)
        self.stack = [self.root]
        self.slides = 0

    def _off(self) -> int:
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def handle_starttag(self, tag, attrs):
        start = self._off()
        raw = self.get_starttag_text() or ""
        node = Node(tag, dict(attrs), start, start + len(raw), self.stack[-1])
        if tag == "section" and "slide" in (node.attrs.get("class") or "").split():
            self.slides += 1
            node.slide = self.slides
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        start = self._off()
        raw = self.get_starttag_text() or ""
        node = Node(tag, dict(attrs), start, start + len(raw), self.stack[-1])
        self.stack[-1].children.append(node)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        pos = self._off()
        top = self.stack[-1]
        if top.tag != tag:
            line = self.src.count("\n", 0, pos) + 1
            raise ValueError(f"edits: line {line}: </{tag}> closes <{top.tag}>. Close every element in slides.html.")
        top.close_start = pos
        self.stack.pop()

    def handle_data(self, data):
        if data.strip():
            self.stack[-1].text = True

    def handle_entityref(self, name):
        self.stack[-1].text = True

    def handle_charref(self, name):
        self.stack[-1].text = True


def _all_inline(n: Node, svg: bool) -> bool:
    allowed = {"tspan"} if svg else INLINE
    return all(c.tag in allowed and _all_inline(c, svg) for c in n.children)


def _editable(n: Node) -> Optional[str]:
    if n.tag in SKIP or n.attrs.get("aria-hidden") == "true" or not n.slide:
        return None
    if n.tag == "text":
        return "svg" if (n.text or n.children) and _all_inline(n, True) else None
    if n.text and _all_inline(n, False):
        return "html"
    return None


class Item:
    __slots__ = ("eid", "kind", "slide", "node")

    def __init__(self, eid: str, kind: str, slide: int, node: Node):
        self.eid, self.kind, self.slide, self.node = eid, kind, slide, node


def scan(src: str) -> List[Item]:
    """All editable elements of slides.html, in order, with their ids."""
    t = _Tree(src)
    t.feed(src)
    t.close()
    if len(t.stack) != 1:
        raise ValueError(f"edits: <{t.stack[-1].tag}> is never closed")
    out: List[Item] = []
    count = {}

    def walk(n: Node):
        for c in n.children:
            kind = _editable(c)
            if kind:
                count[c.slide] = count.get(c.slide, 0) + 1
                out.append(Item(f"s{c.slide}-{count[c.slide]}", kind, c.slide, c))
            elif c.tag not in SKIP:
                walk(c)

    walk(t.root)
    return out


def stamp(src: str) -> str:
    """slides.html with data-eid on every editable element (for the build output only)."""
    items = scan(src)
    parts, last = [], 0
    for it in sorted(items, key=lambda i: i.node.start):
        cut = it.node.open_end - (2 if src[it.node.open_end - 2:it.node.open_end] == "/>" else 1)
        parts.append(src[last:cut])
        parts.append(f' data-eid="{it.eid}"')
        last = cut
    parts.append(src[last:])
    return "".join(parts)


def text_of(fragment: str) -> str:
    """Visible text of an HTML fragment, whitespace collapsed (used to compare 'before' values)."""
    no_tags = re.sub(r"<br\s*/?>", " ", fragment)
    no_tags = re.sub(r"<[^>]+>", "", no_tags)
    return re.sub(r"\s+", " ", html.unescape(no_tags)).strip()


class _Clean(HTMLParser):
    """Keep inline tags only, with their class; drop every other attribute and tag (their text stays)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out: List[str] = []
        self.open: List[str] = []
        self.drop = 0                                          # inside script or style: drop the text too

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.drop += 1
            return
        if tag not in INLINE or tag == "a":
            return
        if tag == "br":
            self.out.append("<br>")
            return
        cls = dict(attrs).get("class")
        self.out.append(f'<{tag} class="{html.escape(cls)}">' if cls else f"<{tag}>")
        self.open.append(tag)

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.drop = max(0, self.drop - 1)
            return
        if tag in self.open:
            while self.open:
                t = self.open.pop()
                self.out.append(f"</{t}>")
                if t == tag:
                    break

    def handle_data(self, data):
        if not self.drop:
            self.out.append(html.escape(data, quote=False))


def clean(fragment: str) -> str:
    c = _Clean()
    c.feed(fragment)
    c.close()
    while c.open:
        c.out.append(f"</{c.open.pop()}>")
    return "".join(c.out).strip()


def apply_slides(src: str, edits: list) -> tuple:
    """Write slide edits into slides.html. Returns (new source, applied ids, conflicts)."""
    items = scan(src)
    by_id = {i.eid: i for i in items}
    plan, conflicts = [], []
    for e in edits:
        it = by_id.get(e["eid"])
        inner = (lambda i: src[i.node.open_end:i.node.close_start])
        if it and text_of(inner(it)) == text_of(e["after"]):
            continue                                           # already in the source
        if not it or text_of(inner(it)) != text_of(e["before"]):
            same = [i for i in items if i.slide == e.get("slide") and text_of(inner(i)) == text_of(e["before"])]
            it = same[0] if len(same) == 1 else None
        if not it:
            conflicts.append(e["eid"] + ": the source text changed since the edit; apply it by hand")
            continue
        new = html.escape(e["after"], quote=False) if it.kind == "svg" else clean(e["after"])
        plan.append((it.node.open_end, it.node.close_start, new, e["eid"]))
    plan.sort(key=lambda p: p[0], reverse=True)
    for a, b, new, _ in plan:
        src = src[:a] + new + src[b:]
    return src, [p[3] for p in plan], conflicts


NOTE_ID = re.compile(r"^n(\d+)-(say|land|cue(\d+)|lim(\d+))$")
JS_STRING = re.compile(r'"((?:[^"\\\n]|\\.)*)"')


def apply_notes(src: str, edits: list) -> tuple:
    """Write note edits into notes.js: find the entry by its '/* N ·' marker, then the string equal to 'before'."""
    import json
    applied, conflicts = [], []
    for e in edits:
        m = NOTE_ID.match(e["eid"])
        if not m:
            conflicts.append(e["eid"] + ": not a note id")
            continue
        n = int(m.group(1))
        head = re.search(r"/\*\s*" + str(n) + r"\s*·", src)
        if not head:
            conflicts.append(e["eid"] + f": no entry marked /* {n} · in notes.js")
            continue
        nxt = re.search(r"/\*\s*\d+\s*·|\n\s*\];", src[head.end():])
        end = head.end() + (nxt.start() if nxt else len(src) - head.end())
        block = src[head.end():end]
        hit = None
        for s in JS_STRING.finditer(block):
            try:
                val = json.loads('"' + s.group(1) + '"')
            except ValueError:
                continue
            norm = re.sub(r"\s+", " ", val).strip()
            if norm == re.sub(r"\s+", " ", e["after"]).strip():
                hit = "done"
                break
            if norm == re.sub(r"\s+", " ", e["before"]).strip():
                hit = s
                break
        if hit == "done":
            continue                                           # already in the source
        if not hit:
            conflicts.append(e["eid"] + ": this file has no such note text (changed since the edit, or not translated yet); apply it by hand")
            continue
        a, b = head.end() + hit.start(), head.end() + hit.end()
        src = src[:a] + json.dumps(e["after"], ensure_ascii=False) + src[b:]
        applied.append(e["eid"])
    return src, applied, conflicts
