"""Fill every <span class="tx" data-tex="…"> in slides.html with KaTeX HTML (idempotent). Run before build.py."""
import html, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figs_gen import tex

P = os.path.join(os.path.dirname(os.path.abspath(__file__)), "slides.html")
s = open(P, encoding="utf-8").read()
pat = re.compile(r'<span class="tx( d)?" data-tex="([^"]*)">.*?</span><!--/tx-->', re.S)
items = [(m.group(1), html.unescape(m.group(2))) for m in pat.finditer(s)]
inl = iter(tex([t for d, t in items if not d], display=False))
dis = iter(tex([t for d, t in items if d], display=True))
def rep(m):
    return '<span class="tx%s" data-tex="%s">%s</span><!--/tx-->' % (m.group(1) or "", m.group(2), next(dis) if m.group(1) else next(inl))
open(P, "w", encoding="utf-8").write(pat.sub(rep, s))
print("formulas:", len(items))
