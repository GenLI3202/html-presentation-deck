"""Make an HTML page work offline: inline Google Fonts (latin subsets) and CDN scripts.

Downloads go to <deck>/vendor/ once and are reused, so only the first build needs the network.
Chinese text uses the system CJK fonts (PingFang SC, Microsoft YaHei); only the latin subsets are inlined.
"""
import base64
import hashlib
import os
import re
import urllib.request

VENDOR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "vendor")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
# Keep the subsets an English talk needs. A Chinese talk needs the numbered CJK subsets too.
KEEP = {"latin", "latin-ext"}
FONT_LINK = re.compile(r'<link[^>]+href="(https://fonts\.googleapis\.com/css2\?[^"]+)"[^>]*>', re.I)
PRECONNECT = re.compile(r'<link[^>]+rel="preconnect"[^>]+href="https://fonts\.(googleapis|gstatic)\.com"[^>]*>\s*', re.I)
CDN_SCRIPT = re.compile(r'<script([^>]*)\ssrc="(https://(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com)/[^"]+)"([^>]*)>\s*</script>', re.I)


def fetch(url: str) -> bytes:
    """Return the bytes at url, from the vendor cache when present."""
    os.makedirs(VENDOR, exist_ok=True)
    name = hashlib.sha1(url.encode()).hexdigest()[:16] + "_" + re.sub(r"[^A-Za-z0-9._-]", "_", url.split("/")[-1].split("?")[0])[-40:]
    path = os.path.join(VENDOR, name)
    if not os.path.exists(path):
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
        except OSError as e:
            raise SystemExit(f"offline: cannot download {url}: {e}. Connect once to fill vendor/.") from e
        with open(path, "wb") as f:
            f.write(data)
    with open(path, "rb") as f:
        return f.read()


def font_css(url: str) -> str:
    """Google Fonts CSS with the kept subsets and the woff2 files as data URLs."""
    css = fetch(url).decode("utf8")
    out = []
    for label, block in re.findall(r"/\*\s*([^*]+?)\s*\*/\s*(@font-face\s*{[^}]+})", css):
        if label not in KEEP:
            continue
        def data_url(m):
            b64 = base64.b64encode(fetch(m.group(1))).decode()
            return "url(data:font/woff2;base64," + b64 + ")"
        out.append(re.sub(r"url\((https://[^)]+)\)", data_url, block))
    if not out:
        raise SystemExit(f"offline: no latin font faces found in {url}")
    return "\n".join(out)


def script_text(url: str) -> str:
    return fetch(url).decode("utf8").replace("</script", "<\\/script")


def inline(html: str) -> str:
    """Inline fonts and CDN scripts of one page. Other links (source links) are not touched."""
    html = PRECONNECT.sub("", html)
    html = FONT_LINK.sub(lambda m: "<style>" + font_css(m.group(1).replace("&amp;", "&")) + "</style>", html)
    return CDN_SCRIPT.sub(lambda m: "<script" + m.group(1) + m.group(3) + ">" + script_text(m.group(2)) + "</script>", html)


def remote_refs(html: str) -> list:
    """Remaining resource URLs that the page loads (not plain hyperlinks)."""
    found = re.findall(r'<(?:script|link|img|iframe)[^>]+(?:src|href)="(https?://[^"]+)"', html, re.I)
    found += re.findall(r"url\((https?://[^)]+)\)", html)
    return sorted(set(found))
