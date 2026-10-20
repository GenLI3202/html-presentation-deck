/* Presenter window. P (or the toolbar button) opens a second window for the speaker: notes, the current view,
   the next view and timers. Put it on the laptop screen and the deck on the projector.
   The main window owns the state and draws into the presenter window (an about:blank page of the same origin).
   Keys pressed in the presenter window drive the main window. Used by deck.js. */
(function () {
  "use strict";
  const slides = Array.from(document.querySelectorAll("#stage > .slide"));
  const total = slides.length;
  const NAME = "deck-presenter";
  const FWD = ["ArrowLeft", "ArrowRight", "PageUp", "PageDown", " ", "Home", "End", "Escape", "r", "R", "o", "O", "l", "L"];
  const pad = n => String(n).padStart(2, "0");
  const tr = (x, v) => (window.t ? window.t(x, v) : x);
  const langNow = () => (window.I18N ? window.I18N.lang() : "");
  const mmss = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ":" + pad(s % 60); };
  const budget = i => parseFloat(slides[i].dataset.time || 0) * 60000;
  const planTo = i => slides.slice(0, i + 1).reduce((a, s) => a + parseFloat(s.dataset.time || 0) * 60000, 0);
  const store = { get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } } };

  let w = null, cur = -1, t0 = 0, ts = 0, paused = 0, pausedAt = 0, timer = 0;
  const now = () => (pausedAt || Date.now());

  const CSS = `
body{overflow:hidden;background:#0c1116;color:#e8edf2;display:grid;grid-template-rows:auto minmax(0,1fr) auto;height:100vh}
.pr-top{display:flex;align-items:center;gap:22px;padding:12px 20px;border-bottom:1px solid #26313c;background:#10161d}
.pr-pos{display:flex;flex-direction:column;min-width:0;flex:1}
.pr-pos .n{font-family:var(--mono);font-size:13px;letter-spacing:.12em;color:#ff9b88}
.pr-pos b{font-size:20px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pr-clock{display:flex;gap:18px;align-items:flex-end}
.pr-t{display:flex;flex-direction:column;align-items:flex-end}
.pr-t small{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#9fb0c0}
.pr-t b{font-family:var(--num);font-size:38px;line-height:1;font-weight:600;color:#fff;font-variant-numeric:tabular-nums}
.pr-t i{font-style:normal;font-family:var(--mono);font-size:12px;color:#9fb0c0}
.pr-t.warn b{color:#f0b45a} .pr-t.over b{color:#ff7a66}
.pr-btns{display:flex;gap:6px}
.pr-btns button{background:transparent;border:1px solid #3a4856;border-radius:8px;color:#c5d0da;font-size:13px;padding:5px 10px;cursor:pointer}
.pr-btns button:hover{border-color:#8fa0b0;color:#fff}
.pr-main{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:22px;padding:18px 20px;min-height:0}
.pr-left{display:flex;flex-direction:column;gap:16px;min-height:0}
.pr-lab{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9fb0c0;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pr-lab b{color:#ff9b88;font-weight:500}
.pr-box{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:6px;background:var(--paper);box-shadow:0 0 0 2px #26313c}
.pr-cur .pr-box{box-shadow:0 0 0 3px var(--accent)}
.pr-nxt{width:72%}
.pr-stage{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;background:var(--paper);color:var(--ink);font-family:var(--sans);overflow:hidden}
.pr-end{position:absolute;inset:0;display:grid;place-items:center;background:#18212b;color:#9fb0c0;font-size:18px}
.pr-emb{position:absolute;inset:0;display:grid;place-items:center;background:var(--tint);color:var(--ink3);font-family:var(--mono);font-size:30px;letter-spacing:.1em;text-transform:uppercase;border:3px dashed var(--rule)}
.pr-notes{overflow:auto;min-height:0;padding:4px 14px 30px 4px;font-size:var(--pf,22px);line-height:1.5}
.pr-notes .np-say p{font-size:1.1em}
.pr-notes .np-lab,.pr-notes .np-sec{font-size:12px}
.pr-notes .np-cue li{padding-bottom:.45em}
.pr-notes details{margin-top:26px;font-size:.78em;border-top:1px solid #26313c;padding-top:8px}
.pr-notes summary{cursor:pointer;font-family:var(--mono);font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#9fb0c0}
.pr-notes .np-lim li,.pr-notes .np-src li{grid-template-columns:9em 1fr}
.pr-keys{padding:8px 20px;font-family:var(--mono);font-size:12px;color:#7d8e9e;border-top:1px solid #26313c}
`;

  /* ---- small DOM helpers (they build nodes in the presenter document) ---- */
  function el(tag, cls, text) {
    const e = w.document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const q = s => w.document.querySelector(s);

  /* A copy of a slide for a thumbnail. step: a build step to show; undefined keeps the live state. */
  function snap(slide, step) {
    const c = slide.cloneNode(true);
    c.classList.add("on", "b-instant");
    c.classList.remove("cam", "cam-in");
    ["transform", "opacity", "visibility", "z-index"].forEach(p => c.style.removeProperty(p));
    c.classList.remove("tr-leave", "tr-enter");
    c.querySelectorAll("[data-tr]").forEach(e => ["transform", "opacity", "visibility", "transition", "transform-origin"].forEach(p => e.style.removeProperty(p)));
    if (step !== undefined) {
      let n = 0;
      c.querySelectorAll("[data-b]").forEach(e => { n = Math.max(n, +e.dataset.b); e.classList.toggle("in", +e.dataset.b <= step); });
      for (let j = 1; j <= n; j++) c.classList.toggle("st-" + j, j <= step);
    }
    c.querySelectorAll("[data-embed]").forEach(b => { b.replaceChildren(); const p = document.createElement("div"); p.className = "pr-emb"; p.textContent = tr("Interactive view"); b.appendChild(p); });
    const src = slide.querySelectorAll("canvas"), dst = c.querySelectorAll("canvas");
    dst.forEach((d, i) => { try { d.getContext("2d").drawImage(src[i], 0, 0); } catch (e) { /* tainted or empty canvas */ } });
    return w.document.importNode(c, true);
  }
  function thumb(box, node) {
    const st = el("div", "pr-stage");
    if (node) st.appendChild(node);
    box.replaceChildren(st);
    st.style.transform = "scale(" + (box.clientWidth / 1920) + ")";
  }
  function refit() { w.document.querySelectorAll(".pr-box").forEach(b => { const s = b.querySelector(".pr-stage"); if (s) s.style.transform = "scale(" + (b.clientWidth / 1920) + ")"; }); }

  /* ---- notes ---- */
  function chip(tag) { const T = (window.NOTES && window.NOTES.tags) || {}; return el("span", "np-ev " + tag, T[tag] || tag); }
  function notes(i) {
    const n = ((window.NOTES && window.NOTES.slides) || [])[i] || { say: "", cue: [], land: "", limits: [], src: [] };
    const root = el("div");
    const say = (lab, txt, cls) => { const d = el("div", "np-say" + (cls ? " " + cls : "")); d.appendChild(el("span", "np-lab", lab)); d.appendChild(el("p", "", txt)); root.appendChild(d); };
    if (n.say) say(tr("Say"), n.say);
    if (n.cue.length) { root.appendChild(el("h4", "np-sec", tr("Points"))); const ul = el("ul", "np-cue"); n.cue.forEach(t => ul.appendChild(el("li", "", t))); root.appendChild(ul); }
    if (n.land) say(tr("End with"), n.land, "land");
    if (n.limits.length || n.src.length) {
      const d = el("details"); d.open = store.get("pr-backup", "0") === "1";
      d.addEventListener("toggle", () => store.set("pr-backup", d.open ? "1" : "0"));
      d.appendChild(el("summary", "", tr("Limits and sources · for questions")));
      if (n.limits.length) {
        d.appendChild(el("h4", "np-sec", tr("Limits")));
        const ul = el("ul", "np-lim");
        n.limits.forEach(l => { const li = el("li"); li.appendChild(chip(l[0])); li.appendChild(el("span", "", l[1])); ul.appendChild(li); });
        d.appendChild(ul);
      }
      if (n.src.length) {
        d.appendChild(el("h4", "np-sec", tr("Sources")));
        const ul = el("ul", "np-src");
        n.src.forEach(r => {
          const li = el("li"); li.appendChild(chip(r.tag));
          const box = el("span", "np-st");
          if (r.url) { const a = el("a", "", r.title); a.href = r.url; a.target = "_blank"; a.rel = "noopener noreferrer"; box.appendChild(a); }
          else box.appendChild(el("span", "np-nolink", r.title));
          if (r.meta) box.appendChild(el("small", "", r.meta));
          li.appendChild(box); ul.appendChild(li);
        });
        d.appendChild(ul);
      }
      root.appendChild(d);
    }
    if (!root.children.length) root.appendChild(el("p", "np-none", tr("No notes for this slide.")));
    return root;
  }

  /* ---- what → shows next ---- */
  function nextView(i) {
    const A = window.DeckAnim, Z = window.DeckTour, s = slides[i];
    const k = A && A.step ? A.step(s) : 0, n = A && A.steps ? A.steps(s) : 0;
    if (k < n) return { slide: s, step: k + 1, label: tr("Next · build {k} of {n}", { k: k + 1, n }) };
    const z = Z && Z.peek ? Z.peek(i) : null;
    const j = z ? z.i : i + 1;
    if (j >= total) return null;
    const t = slides[j];
    return { slide: t, step: A && A.steps ? A.steps(t) : undefined, label: (z ? z.label : tr("Next slide")) + " · " + pad(j + 1) + " " + (t.dataset.title || "") };
  }

  /* ---- timers ---- */
  function tick() {
    if (!isOpen()) { clearInterval(timer); return; }
    const all = now() - t0 - paused, sl = now() - ts;
    const b = budget(cur), plan = planTo(cur);
    const T = q("#prTot"), S = q("#prSl");
    T.querySelector("b").textContent = mmss(all);
    T.querySelector("i").textContent = tr("plan {t} by end of slide", { t: mmss(plan) });
    T.className = "pr-t" + (all > plan ? " over" : all > plan - b * 0.2 ? " warn" : "");
    S.querySelector("b").textContent = mmss(sl);
    S.querySelector("i").textContent = tr("budget {t}", { t: mmss(b) });
    S.className = "pr-t" + (b && sl > b ? " over" : b && sl > b * 0.8 ? " warn" : "");
    q("#prPause").textContent = tr(pausedAt ? "Resume" : "Pause");
  }

  let shownNotes = [-1, ""];
  function update(force) {
    if (!isOpen()) return;
    const i = (window.__deck && window.__deck.current) ? window.__deck.current() : 0;
    if (i !== cur) { cur = i; ts = now(); q(".pr-notes").scrollTop = 0; }
    if (i !== shownNotes[0] || langNow() !== shownNotes[1] || force) { q(".pr-notes").replaceChildren(notes(i)); shownNotes = [i, langNow()]; }
    w.document.documentElement.lang = langNow() || "en";
    w.document.querySelectorAll("[data-ui]").forEach(e => { e.textContent = tr(e.dataset.ui); });
    const s = slides[i];
    const A = window.DeckAnim, n = A && A.steps ? A.steps(s) : 0;
    q(".pr-pos .n").textContent = pad(i + 1) + " / " + total + " · " + (s.dataset.act || "");
    q(".pr-pos b").textContent = s.dataset.title || "";
    const lab = q(".pr-cur .pr-lab");
    lab.replaceChildren(tr("Now"));
    if (n) { lab.append(" · "); lab.appendChild(el("b", "", tr("build {k} of {n}", { k: A.step(s), n }))); }
    if (A && A.zoomed && A.zoomed()) { lab.append(" · "); lab.appendChild(el("b", "", tr("detail open"))); }
    thumb(q(".pr-cur .pr-box"), snap(s));
    const nx = nextView(i);
    q(".pr-nxt .pr-lab").textContent = nx ? nx.label : tr("End of the talk");
    if (nx) thumb(q(".pr-nxt .pr-box"), snap(nx.slide, nx.step));
    else { const box = q(".pr-nxt .pr-box"); box.replaceChildren(el("div", "pr-end", tr("Last slide"))); }
    tick();
  }

  function build() {
    const d = w.document;
    d.open();
    d.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Presenter · ' + document.title.replace(/</g, "&lt;") + "</title></head><body></body></html>");
    d.close();
    Array.from(document.querySelectorAll('head link[rel="stylesheet"], style')).forEach(n => d.head.appendChild(d.importNode(n, true)));
    const st = d.createElement("style"); st.textContent = CSS; d.head.appendChild(st);
    d.body.innerHTML =
      '<header class="pr-top"><div class="pr-pos"><span class="n"></span><b></b></div>' +
      '<div class="pr-clock"><div class="pr-t" id="prSl"><small data-ui="This slide"></small><b>0:00</b><i></i></div>' +
      '<div class="pr-t" id="prTot"><small data-ui="Total"></small><b>0:00</b><i></i></div></div>' +
      '<div class="pr-btns"><button type="button" id="prPause">Pause</button><button type="button" id="prReset" data-ui="Reset"></button>' +
      '<button type="button" id="prSm" aria-label="Smaller text">A−</button><button type="button" id="prLg" aria-label="Larger text">A+</button></div></header>' +
      '<main class="pr-main"><section class="pr-left"><div class="pr-cur"><div class="pr-lab"></div><div class="pr-box"></div></div>' +
      '<div class="pr-nxt"><div class="pr-lab"></div><div class="pr-box"></div></div></section>' +
      '<section class="pr-notes" aria-label="Speaker notes"></section></main>' +
      '<footer class="pr-keys" data-ui="← → move the deck · Home / End first and last slide · R reference figure on the main screen · O overview · L language · Esc close it"></footer>';
    const notesBox = q(".pr-notes");
    let pf = parseFloat(store.get("pr-font", "22"));
    const font = delta => { pf = Math.max(14, Math.min(40, pf + delta)); notesBox.style.setProperty("--pf", pf + "px"); store.set("pr-font", String(pf)); };
    font(0);
    q("#prSm").onclick = () => font(-2);
    q("#prLg").onclick = () => font(2);
    q("#prPause").onclick = () => { if (pausedAt) { paused += Date.now() - pausedAt; ts += Date.now() - pausedAt; pausedAt = 0; } else pausedAt = Date.now(); tick(); };
    q("#prReset").onclick = () => { t0 = ts = Date.now(); paused = 0; pausedAt = 0; tick(); };
    d.addEventListener("keydown", e => {
      if (FWD.indexOf(e.key) < 0 || !window.__deck) return;
      e.preventDefault();
      window.__deck.key(e);
    });
    w.addEventListener("resize", refit);
  }

  function isOpen() { return !!(w && !w.closed && w.document && w.document.body); }

  /* Returns false when the browser blocks the pop-up or the window is not reachable. */
  function open() {
    if (isOpen()) { w.focus(); return true; }
    let nw = null;
    try { nw = window.open("", NAME, "popup,width=1280,height=800"); } catch (e) { nw = null; }
    if (!nw) return false;
    try { void nw.document.body; } catch (e) { return false; }
    w = nw; cur = -1;
    t0 = ts = Date.now(); paused = 0; pausedAt = 0;
    build();
    update();
    clearInterval(timer); timer = setInterval(tick, 500);
    return true;
  }

  slides.forEach(s => s.addEventListener("slidestep", () => { if (isOpen()) setTimeout(update, 0); }));
  addEventListener("pagehide", () => { if (isOpen()) w.close(); });
  window.DeckPresenter = { open, update, isOpen };
})();
