/* Speaker script: one A4 page per slide with Say, Points, End with, Limits and Sources. No reference figures.
   Injected by make_script.cjs into preview.html. It replaces the page with the script document. */
(function () {
  "use strict";
  const slides = Array.from(document.querySelectorAll("#stage > .slide"));
  const NS = (window.NOTES && window.NOTES.slides) || [];
  const TAGS = (window.NOTES && window.NOTES.tags) || {};
  const esc = t => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const pad = n => String(n).padStart(2, "0");
  const tx = (x, v) => (window.t ? window.t(x, v) : x);
  const lang = document.documentElement.lang || "en";
  const fonts = Array.from(document.head.querySelectorAll("style")).map(s => s.textContent).filter(t => t.indexOf("@font-face") > -1).join("\n");
  const title = document.title;
  let plan = 0;
  const total = slides.reduce((a, s) => a + parseFloat(s.dataset.time || 0), 0);

  const pages = slides.map((s, i) => {
    const n = NS[i] || { say: "", cue: [], land: "", limits: [], src: [] };
    const t = parseFloat(s.dataset.time || 0);
    plan += t;
    const tag = k => '<span class="ev ' + k + '">' + esc(TAGS[k] || k) + "</span>";
    return '<section class="pg">'
      + '<header><div class="k">' + pad(i + 1) + " / " + slides.length + " · " + esc(s.dataset.act || "") + "</div>"
      + "<h2>" + esc(s.dataset.title || "") + "</h2>"
      + '<div class="tm">' + esc(tx("{t} min · plan {plan} of {total} min by the end of this slide", { t: t.toFixed(1), plan: plan.toFixed(1), total: total.toFixed(0) })) + "</div></header>"
      + (n.say ? '<div class="say"><b>' + tx("Say") + "</b><p>" + esc(n.say) + "</p></div>" : "")
      + (n.cue.length ? '<h3>' + tx("Points") + '</h3><ul class="cue">' + n.cue.map(c => "<li>" + esc(c) + "</li>").join("") + "</ul>" : "")
      + (n.land ? '<div class="say land"><b>' + tx("End with") + "</b><p>" + esc(n.land) + "</p></div>" : "")
      + (n.limits.length ? '<h3>' + tx("Limits") + '</h3><ul class="tl">' + n.limits.map(l => "<li>" + tag(l[0]) + "<span>" + esc(l[1]) + "</span></li>").join("") + "</ul>" : "")
      + (n.src.length ? '<h3>' + tx("Sources") + '</h3><ul class="tl src">' + n.src.map(r => "<li>" + tag(r.tag) + "<span>" + esc(r.title) + (r.meta ? " <small>" + esc(r.meta) + "</small>" : "") + "</span></li>").join("") + "</ul>" : "")
      + "</section>";
  });

  const css = `
@page{size:A4;margin:16mm 17mm 16mm}
:root{--ink:#141b24;--ink2:#46515e;--ink3:#7a8794;--rule:#d9dfe5;--accent:#c2412d;--accent-soft:#fbe9e5;--amber:#9a5b00}
*{box-sizing:border-box}
html,body{margin:0;background:#fff;color:var(--ink);font-family:"IBM Plex Sans","Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif;font-size:12.5pt;line-height:1.45}
.pg{width:176mm;break-after:page;page-break-after:always}
.pg:last-child{break-after:auto}
header{border-bottom:2px solid var(--ink);padding-bottom:7pt;margin-bottom:12pt}
.k{font-family:"IBM Plex Mono",Menlo,monospace;font-size:9pt;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
h2{margin:3pt 0 2pt;font-size:19pt;line-height:1.2;font-weight:600}
.tm{font-family:"IBM Plex Mono",Menlo,monospace;font-size:9pt;color:var(--ink3)}
.say{margin:10pt 0;padding:8pt 12pt;background:var(--accent-soft);border-left:4pt solid var(--accent);border-radius:0 6pt 6pt 0}
.say b,h3{display:block;font-family:"IBM Plex Mono",Menlo,monospace;font-size:8.5pt;letter-spacing:.14em;text-transform:uppercase;font-weight:500}
.say b{color:var(--accent)}
.say p{margin:3pt 0 0;font-size:14pt;font-weight:500;line-height:1.4}
h3{color:var(--ink3);margin:13pt 0 5pt}
ul{margin:0;padding-left:14pt}
.cue li{margin-bottom:5pt}
.tl{list-style:none;padding:0;font-size:10.5pt}
.tl li{display:grid;grid-template-columns:30mm 1fr;gap:6pt;align-items:baseline;margin-bottom:4pt}
.tl small{color:var(--ink3)}
.ev{justify-self:start;font-family:"IBM Plex Mono",Menlo,monospace;font-size:7.5pt;letter-spacing:.06em;text-transform:uppercase;padding:0 6pt;border:1pt solid currentColor;border-radius:99px;white-space:nowrap}
.ev.m{color:var(--ink3)} .ev.i{border-style:dashed} .ev.v{color:var(--amber)} .ev.n{border-style:dotted}
`;
  const html = '<!doctype html><html lang="' + lang + '"><head><meta charset="utf-8"><title>' + esc(title) + " · " + esc(tx("Speaker script")) + "</title><style>" + fonts + css + "</style></head><body>" + pages.join("") + "</body></html>";
  document.open();
  document.write(html);
  document.close();
  /* A section that is taller than the A4 text area is scaled down to fit one page (not below 80 %). */
  const LIMIT = 265 * 96 / 25.4;
  document.fonts.ready.then(() => {
    document.querySelectorAll(".pg").forEach(p => {
      const h = p.offsetHeight;
      if (h > LIMIT) p.style.zoom = String(Math.max(0.8, LIMIT / h * 0.98));
    });
    window.__scriptReady = true;
  });
})();
