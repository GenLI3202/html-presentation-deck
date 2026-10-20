/* Builds and zoom details. Used by deck.js.
   Builds: an element with data-b="n" shows at step n. data-fx sets the motion (up, left, right, push, zoom, fade).
   The slide also gets classes st-1 … st-k, so CSS can animate pseudo-elements. It fires "slidestep" {step, total, instant}.
   Spotlight: an element with data-spot="n" is highlighted at step n and its data-spot siblings are dimmed.
   It stays visible at every step. Add a last build (for example the take) after the last spot, so the complete
   slide (jump, print) shows nothing dimmed.
   Zoom: an element with data-zoom="templateId" opens that template in a card that grows out of the element.
   Strip: slides with the same data-strip="group" get a progress strip (data-strip-label or data-title per slide). */
(function () {
  "use strict";
  const stepOf = new Map();
  const count = s => { let m = 0; s.querySelectorAll("[data-b], [data-spot]").forEach(e => { m = Math.max(m, +(e.dataset.b || e.dataset.spot)); }); return m; };

  function dots(s, n, k) {
    let d = s.querySelector(".bdots");
    if (!d) { d = document.createElement("div"); d.className = "bdots"; d.setAttribute("aria-hidden", "true"); s.appendChild(d); }
    d.replaceChildren(...Array.from({ length: n }, (_, j) => { const i = document.createElement("i"); if (j < k) i.className = "on"; return i; }));
  }
  function set(s, k, instant) {
    const n = count(s);
    k = Math.max(0, Math.min(n, k));
    stepOf.set(s, k);
    s.querySelectorAll("[data-b]").forEach(e => e.classList.toggle("in", +e.dataset.b <= k));
    for (let j = 1; j <= n; j++) s.classList.toggle("st-" + j, j <= k);
    const spots = s.querySelectorAll("[data-spot]");
    const lit = Array.from(spots).some(e => +e.dataset.spot === k);
    spots.forEach(e => { const me = +e.dataset.spot === k; e.classList.toggle("spot-on", me); e.classList.toggle("spot-dim", lit && !me); });
    dots(s, n, k);
    s.dispatchEvent(new CustomEvent("slidestep", { detail: { step: k, total: n, instant: !!instant } }));
  }
  /* mode "start": nothing shown yet (forward entry). mode "end": everything shown (back entry, jump). */
  function enter(s, mode) {
    if (!count(s)) return;
    s.classList.add("b-instant");
    set(s, mode === "start" ? 0 : count(s), true);
    requestAnimationFrame(() => requestAnimationFrame(() => s.classList.remove("b-instant")));
  }
  function forward(s) { const k = stepOf.get(s) || 0; if (k < count(s)) { set(s, k + 1); return true; } return false; }
  function back(s) { const k = stepOf.get(s) || 0; if (k > 0) { set(s, k - 1); return true; } return false; }

  /* ---- zoom ---- */
  const T = { x: 180, y: 110, w: 1560, h: 860 };          // target card on the 1920 × 1080 stage
  let zl = null;
  function stageRect(el) {
    const st = document.getElementById("stage"), sr = st.getBoundingClientRect(), sc = sr.width / 1920, r = el.getBoundingClientRect();
    return { x: (r.left - sr.left) / sc, y: (r.top - sr.top) / sc, w: r.width / sc, h: r.height / sc };
  }
  const flip = f => "translate(" + (f.x - T.x) + "px," + (f.y - T.y) + "px) scale(" + (f.w / T.w) + "," + (f.h / T.h) + ")";
  function zoomOpen(src) {
    const tpl = document.getElementById(src.dataset.zoom);
    if (!tpl || zl) return;
    const from = stageRect(src);
    zl = document.createElement("div");
    zl.className = "zl";
    zl.innerHTML = '<div class="zl-bg"></div><div class="zl-card" role="dialog" aria-modal="true"><div class="zl-in"></div></div>';
    const card = zl.querySelector(".zl-card"), inner = zl.querySelector(".zl-in");
    inner.appendChild(tpl.content.cloneNode(true));
    const x = document.createElement("button");
    x.type = "button"; x.className = "zl-x"; x.textContent = window.t ? window.t("Close · Esc") : "Close · Esc";
    inner.appendChild(x);
    card.setAttribute("aria-label", (inner.querySelector("h3") || {}).textContent || "Details");
    Object.assign(card.style, { left: T.x + "px", top: T.y + "px", width: T.w + "px", height: T.h + "px", transform: flip(from) });
    zl.dataset.from = JSON.stringify(from);
    document.getElementById("stage").appendChild(zl);
    zl.addEventListener("click", e => {
      const g = e.target.closest("[data-goto]");
      if (g) { zoomClose(true); window.__deck.show(+g.dataset.goto - 1); return; }
      if (e.target.closest(".zl-x") || e.target.classList.contains("zl-bg")) zoomClose();
    });
    card.getBoundingClientRect();                         // commit the start state, then animate
    zl.classList.add("open");
    card.style.transform = "none";
    x.focus({ preventScroll: true });
  }
  function zoomClose(now) {
    if (!zl) return;
    const el = zl; zl = null;
    if (now || matchMedia("(prefers-reduced-motion: reduce)").matches) { el.remove(); return; }
    el.classList.remove("open");
    el.querySelector(".zl-card").style.transform = flip(JSON.parse(el.dataset.from));
    setTimeout(() => el.remove(), 480);
  }
  document.addEventListener("click", e => {
    const z = e.target.closest("#stage [data-zoom]");
    if (z && !zl) zoomOpen(z);
  });

  document.querySelectorAll(".slide").forEach(s => { if (s.querySelector("[data-b]")) s.classList.add("has-b"); });

  /* ---- progress strip: Q1 · Q2 · Q3 at the top of each slide of a series ---- */
  const groups = {};
  document.querySelectorAll("#stage > .slide[data-strip]").forEach(s => { (groups[s.dataset.strip] = groups[s.dataset.strip] || []).push(s); });
  Object.values(groups).forEach(list => list.forEach((s, i) => {
    const ol = document.createElement("ol");
    ol.className = "strip"; ol.setAttribute("aria-label", "Progress");
    list.forEach((m, j) => {
      const li = document.createElement("li");
      li.className = j < i ? "done" : j === i ? "now" : "next";
      li.textContent = m.dataset.stripLabel || m.dataset.title || String(j + 1);
      ol.appendChild(li);
    });
    s.appendChild(ol);
  }));
  window.DeckAnim = { enter, forward, back, zoomed: () => !!zl, zoomClose, step: s => stepOf.get(s) || 0, steps: count };
})();
