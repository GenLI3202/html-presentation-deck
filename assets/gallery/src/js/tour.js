/* Camera tour: zoom from an overview slide into each part, then pull back.
   Markup: the overview slide has data-tour. Each item on it has data-tour-to="N" (the 1-based slide number it opens).
   → on the overview dives into the next item not yet covered. → at the end of a part slide pulls back to the
   overview, ticks the item, then dives into the next one. When all are covered, → goes to the slide after the
   last part. ← on a part slide pulls back to the overview only. Other navigation is unchanged.
   Several overview slides can exist; each one keeps its own state. Used by deck.js and presenter.js. */
(function () {
  "use strict";
  const slides = Array.from(document.querySelectorAll("#stage > .slide"));
  const DUR = 950, HOLD = 750;
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const fade = (e, a, b) => clamp01((e - a) / (b - a));
  const wait = ms => new Promise(r => setTimeout(r, reduce() ? 0 : ms));
  const deck = () => window.__deck;
  let busy = false;

  const tours = slides.filter(s => s.hasAttribute("data-tour")).map(ov => {
    const items = Array.from(ov.querySelectorAll("[data-tour-to]"));
    const Q = items.map(c => +c.dataset.tourTo - 1);
    return { ov, OV: slides.indexOf(ov), items, Q, AFTER: Math.max(...Q) + 1, done: new Set() };
  }).filter(t => t.Q.length && t.Q.every(q => slides[q]));
  if (!tours.length) return;

  const tourOf = i => tours.find(t => t.OV === i) || tours.find(t => t.Q.indexOf(i) > -1) || null;
  const nextOf = t => t.Q.find(q => !t.done.has(q));

  function marks(t) {
    const nxt = nextOf(t);
    t.ov.classList.toggle("t-all", t.done.size === t.Q.length);
    t.items.forEach((c, k) => {
      c.classList.toggle("t-done", t.done.has(t.Q[k]));
      c.classList.toggle("t-next", t.done.size > 0 && t.Q[k] === nxt);
    });
  }
  function rectOf(el) {
    const st = document.getElementById("stage"), sr = st.getBoundingClientRect(), sc = sr.width / 1920, r = el.getBoundingClientRect();
    return { x: (r.left - sr.left) / sc, y: (r.top - sr.top) / sc, w: r.width / sc, h: r.height / sc };
  }
  /* World = the overview slide. The part slide sits inside its item, scaled by 1/s.
     e = 0: camera on the overview. e = 1: camera on the part slide. */
  function frame(t, inner, R, s, e) {
    const S = Math.pow(s, e);
    const px = R.x + R.w / 2, py = R.y + R.h / 2;
    const qx = px + (960 - px) * e, qy = py + (540 - py) * e;
    t.ov.style.transform = "translate(" + (qx - S * px) + "px," + (qy - S * py) + "px) scale(" + S + ")";
    const k = S / s;
    inner.style.transform = "translate(" + (qx - k * 960) + "px," + (qy - k * 540) + "px) scale(" + k + ")";
    inner.style.opacity = fade(e, .04, .3);
  }
  function fly(t, qi, from, to) {
    return new Promise(resolve => {
      const inner = slides[qi], R = rectOf(t.items[t.Q.indexOf(qi)]);
      const s = Math.max(1920 / R.w, 1080 / R.h);           // fill the screen with the item: a deep dive
      [t.ov, inner].forEach(el => { el.classList.add("cam"); el.style.transformOrigin = "0 0"; });
      inner.classList.add("cam-in");
      if (reduce()) { frame(t, inner, R, s, to); resolve(); return; }
      const t0 = performance.now();
      let over = false;
      const finish = () => { if (over) return; over = true; clearTimeout(guard); frame(t, inner, R, s, to); resolve(); };
      const guard = setTimeout(finish, DUR + 300);         // rAF stops in a hidden tab; never leave the tour stuck
      const tick = now => {
        if (over) return;
        const p = clamp01((now - t0) / DUR);
        frame(t, inner, R, s, from + (to - from) * ease(p));
        if (p < 1) requestAnimationFrame(tick); else finish();
      };
      frame(t, inner, R, s, from);
      requestAnimationFrame(tick);
    });
  }
  function clear() {
    slides.forEach(el => { el.classList.remove("cam", "cam-in"); el.style.transform = el.style.opacity = el.style.transformOrigin = ""; });
  }
  async function dive(t, qi) {
    busy = true;
    t.ov.classList.add("cam");                               // measure the item on a visible, untransformed overview
    if (window.DeckAnim) window.DeckAnim.enter(slides[qi], "start");
    await fly(t, qi, 0, 1);
    clear();
    deck().show(qi, false, "start");
    busy = false;
  }
  async function pullBack(t, qi, thenNext) {
    busy = true;
    t.ov.classList.add("cam");
    marks(t);
    await fly(t, qi, 1, 0);
    clear();
    deck().show(t.OV, false, "end");
    const nxt = nextOf(t);
    if (thenNext && nxt !== undefined) { await wait(HOLD); busy = false; return dive(t, nxt); }
    busy = false;
  }

  /* Hooks for deck.js. They return true when the tour handled the key. */
  function next(cur) {
    if (busy) return true;
    const pre = tours.find(t => t.OV - 1 === cur);
    if (pre) { pre.done.clear(); marks(pre); return false; }  // a fresh start each time the overview is entered forwards
    const t = tourOf(cur);
    if (!t) return false;
    if (cur === t.OV) {
      const nxt = nextOf(t);
      if (nxt === undefined) { deck().show(t.AFTER, false, "start"); return true; }
      dive(t, nxt); return true;
    }
    t.done.add(cur); pullBack(t, cur, true); return true;
  }
  function prev(cur) {
    if (busy) return true;
    const t = tourOf(cur);
    if (!t || cur === t.OV) return false;
    pullBack(t, cur, false); return true;
  }
  /* For the presenter window: where → goes from slide cur, or null when no tour acts there. */
  function peek(cur) {
    const t = tourOf(cur);
    if (!t) return null;
    const tr = (x, v) => (window.t ? window.t(x, v) : x);
    const n = qi => t.Q.indexOf(qi) + 1;
    if (cur === t.OV) {
      const nxt = nextOf(t);
      return nxt === undefined ? { i: t.AFTER, label: tr("Next slide") } : { i: nxt, label: tr("Zoom into part {n}", { n: n(nxt) }) };
    }
    const nxt = t.Q.find(q => q !== cur && !t.done.has(q));
    return nxt === undefined ? { i: t.OV, label: tr("Pull back to the overview") } : { i: nxt, label: tr("Pull back, then zoom into part {n}", { n: n(nxt) }) };
  }
  tours.forEach(marks);
  window.DeckTour = { next, prev, busy: () => busy, peek };
})();
