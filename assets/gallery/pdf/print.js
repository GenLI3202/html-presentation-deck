/* Print layout for the PDF handout. Injected by make_pdf.cjs into preview.html after the deck has loaded.
   Reads window.__SNAPS (captures, id -> data URL), window.__PRINT (deck.config.json "pdf") and window.NOTES.
     frames       [{ slide, selector, shot, alt }]  interactive frames become images of one state
     remove       [selector]                        elements to drop before printing
     supplements  [{ after, title, sub, items: [[shot, caption], …] }]  two images per page after slide "after"
     zoomPages    true: each data-zoom detail becomes a page after its slide; data-goto buttons become links
     howTo        null, or { title, items: [html], note }: a page after slide 1
     appendix     true: one page per template reference figure in notes.js
   Every slide prints in its complete build state. Text follows ASD-STE100. */
(function () {
  "use strict";
  const S = window.__SNAPS || {};
  const C = window.__PRINT || {};
  const NOTES = (window.NOTES && window.NOTES.slides) || [];
  const TAGS = (window.NOTES && window.NOTES.tags) || {};
  const slides = Array.from(document.querySelectorAll("#stage > .slide"));
  const tx = (x, v) => (window.t ? window.t(x, v) : x);
  const tt = x => (x && window.I18N && window.I18N.text ? window.I18N.text(x) : x);   // deck strings: src/i18n/<lang>.txt
  const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  document.documentElement.classList.add("printing");

  /* 1 · every slide complete, with an anchor for internal links */
  slides.forEach((s, i) => {
    s.classList.remove("has-b", "on", "b-instant", "cam", "cam-in", "t-all");
    s.querySelectorAll(".bdots").forEach(d => d.remove());
    s.querySelectorAll(".t-done,.t-next").forEach(e => e.classList.remove("t-done", "t-next"));
    const a = document.createElement("a"); a.id = "p-s" + (i + 1); a.className = "anchor"; s.prepend(a);
  });
  (C.remove || []).forEach(sel => document.querySelectorAll(sel).forEach(e => e.remove()));

  /* 2 · interactive frames become images */
  (C.frames || []).forEach(f => {
    const s = slides[f.slide - 1]; if (!s) return;
    const fr = s.querySelector(f.selector || ".frame"); const src = S[f.shot];
    if (!fr || !src) { console.warn("print: frame on slide " + f.slide + " has no capture " + f.shot); return; }
    fr.replaceChildren();
    const im = new Image(); im.src = src; im.alt = tt(f.alt) || ""; im.className = "snap"; fr.appendChild(im);
  });

  const kick = (n, what) => esc(tx("Slide {n}", { n })) + "<i>·</i>" + what;
  function page(after, kickHtml, title, sub, cls) {
    const s = document.createElement("section");
    s.className = "slide sup " + (cls || "");
    s.innerHTML = '<div class="kick">' + kickHtml + "</div>" + (title ? '<h2 class="ttl">' + esc(title) + "</h2>" : "") + (sub ? '<p class="sub">' + esc(sub) + "</p>" : "");
    after.after(s);
    return s;
  }

  /* 3 · zoom details become pages after their slide */
  const lastAfter = new Map();                             // slide -> last page inserted after it
  const tail = s => lastAfter.get(s) || s;
  if (C.zoomPages) slides.forEach((s, i) => {
    const ids = Array.from(s.querySelectorAll("[data-zoom]")).map(z => z.dataset.zoom);
    ids.forEach((id, k) => {
      const t = document.getElementById(id); if (!t) return;
      const p = page(tail(s), kick(i + 1, esc(tx("Detail {k} of {n}", { k: k + 1, n: ids.length }))), "", "", "zoompage");
      const box = document.createElement("div"); box.className = "sup-zoom"; box.appendChild(t.content.cloneNode(true));
      box.querySelectorAll("[data-goto]").forEach(b => { const a = document.createElement("a"); a.className = b.className || "zgo"; a.href = "#p-s" + b.dataset.goto; a.textContent = b.textContent; b.replaceWith(a); });
      p.appendChild(box);
      lastAfter.set(s, p);
    });
  });

  /* 4 · supplement pages: two large images per page */
  (C.supplements || []).forEach(g => {
    const s = slides[g.after - 1]; if (!s) return;
    const items = (g.items || []).filter(it => S[it[0]]);
    for (let k = 0; k < items.length; k += 2) {
      const part = items.length > 2 ? " · " + tx("{k} of {n}", { k: k / 2 + 1, n: Math.ceil(items.length / 2) }) : "";
      const p = page(tail(s), kick(g.after, esc(tx("Supplement") + part)), tt(g.title), tt(g.sub));
      const body = document.createElement("div"); body.className = "body sup-body";
      items.slice(k, k + 2).forEach(([id, cap]) => {
        const f = document.createElement("figure");
        f.innerHTML = '<img src="' + S[id] + '" alt="' + esc(tt(cap)) + '"><figcaption>' + esc(tt(cap)) + "</figcaption>";
        body.appendChild(f);
      });
      p.appendChild(body);
      lastAfter.set(s, p);
    }
  });

  /* 5 · optional "how to read" page after the title */
  if (C.howTo && slides[0]) {
    const tag = t => '<span class="ev ' + t + '">' + esc(TAGS[t] || t) + "</span>";
    const p = page(slides[0], esc(tx("About this PDF")), tt(C.howTo.title) || tx("How to read this handout"), "", "how");
    const b = document.createElement("div"); b.className = "body";
    b.innerHTML = '<ol class="how-l">' + (C.howTo.items || []).map(t => "<li>" + tt(t) + "</li>").join("") + "</ol>"
      + '<div class="how-tags"><b>' + esc(tx("Evidence tags")) + '</b>' + ["p", "a", "m", "i", "v"].map(tag).join("") + "</div>"
      + (C.howTo.note ? '<p class="how-note">' + esc(tt(C.howTo.note)) + "</p>" : "");
    p.appendChild(b);
  }

  /* 6 · appendix: template reference figures from notes.js (the other kinds are on the slides) */
  if (C.appendix) {
    const stage = document.getElementById("stage"), seen = new Set();
    NOTES.forEach(n => n.figs.forEach(f => {
      if (f.k !== "tpl" || seen.has(f.t)) return;
      seen.add(f.t);
      const t = document.getElementById(f.t); if (!t) return;
      const used = NOTES.map((m, k) => m.figs.some(g => g.t === f.t) ? k + 1 : 0).filter(Boolean);
      const s = document.createElement("section");
      s.className = "slide sup figp";
      s.innerHTML = '<div class="kick">' + esc(tx("Appendix")) + "<i>·</i>" + esc(tx("Reference figure")) + "<i>·</i>" + esc(tx("Slide {n}", { n: used.join(", ") })) + '</div><h2 class="ttl">' + esc(f.n) + '</h2><div class="fig-host"><div class="vw-fig"></div></div>';
      s.querySelector(".vw-fig").appendChild(t.content.cloneNode(true));
      stage.appendChild(s);
      const host = s.querySelector(".fig-host"), fig = s.querySelector(".vw-fig");
      const sc = Math.min(host.clientWidth / fig.offsetWidth, host.clientHeight / fig.offsetHeight, 1.5);
      fig.style.transform = "scale(" + sc + ")";
      host.style.width = Math.round(fig.offsetWidth * sc) + "px";
      host.style.height = Math.round(fig.offsetHeight * sc) + "px";
    }));
  }
  window.__printReady = true;
})();
