/* Calm slide transitions between neighbouring slides. The screen stays still; only what changes moves.
   The transition belongs to the boundary: going forward it is the incoming slide's choice, going back the outgoing one.
     data-enter="fade"   cross-fade (a change of act or topic)
     data-enter="push"   a short slide-in, 60 px, with a fade (the next item of a series)
     data-enter="zoom"   a gentle push into one part of a picture: the previous slide grows 12 % around its
                         [data-focus] element and fades; going back reverses it (a detail of a diagram or map)
     data-enter="morph"  or, with no data-enter, automatic when both slides hold elements with the same
                         data-morph key: those elements travel and resize from their old place to the new one,
                         everything else fades (an overview card becoming the next slide's header; the same chart
                         with new numbers)
     data-enter="none"   never animate this boundary
   Jumps (overview, Home, End, links), edit mode, the camera tour and prefers-reduced-motion switch at once.
   Used by deck.js: before(from, to, dir) while the old slide is still shown, then run(token) after the switch. */
(function () {
  "use strict";
  const T = { fade: 420, push: 460, zoom: 560, morph: 650 };
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stage = () => document.getElementById("stage");
  let live = null;

  function rect(el) {
    const sr = stage().getBoundingClientRect(), sc = sr.width / 1920, r = el.getBoundingClientRect();
    return { x: (r.left - sr.left) / sc, y: (r.top - sr.top) / sc, w: r.width / sc, h: r.height / sc };
  }
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  function pairs(from, to) {
    const out = [];
    from.querySelectorAll("[data-morph]").forEach(a => {
      if (!visible(a)) return;
      const b = to.querySelector('[data-morph="' + a.dataset.morph + '"]');
      if (b) out.push([a, b]);
    });
    return out;
  }
  function kind(from, to, dir) {
    const owner = dir > 0 ? to : from;
    const k = owner.dataset.enter;
    if (k === "none") return null;
    if (k && k !== "morph") return T[k] ? k : null;
    return from.querySelector("[data-morph]") && to.querySelector("[data-morph]") ? "morph" : null;
  }

  /* Remember what the old slide looks like, before deck.js switches. */
  function before(from, to, dir) {
    finish();
    if (!from || !to || from === to || reduce() || document.documentElement.classList.contains("printing")) return null;
    const k = kind(from, to, dir);
    if (!k) return null;
    const tok = { k, from, to, dir, touched: [], saved: [] };
    if (k === "morph") {
      tok.pairs = pairs(from, to).map(([a, b]) => ({ a, b, r: rect(a) }));
      if (!tok.pairs.length) tok.k = "fade";
    }
    if (k === "zoom") {
      const f = (dir > 0 ? from : to).querySelector("[data-focus]");
      tok.focus = f && dir > 0 ? rect(f) : null;                  // the overview is shown now only when going forward
    }
    return tok;
  }

  const PROPS = ["transition", "opacity", "transform", "transformOrigin", "visibility"];
  /* Set inline styles for the animation; the first touch saves the author's own values for finish(). */
  function style(tok, el, props) {
    if (tok.touched.indexOf(el) < 0) {
      tok.touched.push(el);
      tok.saved.push([el, PROPS.map(p => el.style[p]), el.hasAttribute("style")]);
      el.setAttribute("data-tr", "");
    }
    Object.assign(el.style, props);
  }
  const commit = el => el.getBoundingClientRect();
  const origin = r => r ? (r.x + r.w / 2) + "px " + (r.y + r.h / 2) + "px" : "50% 50%";

  function run(tok) {
    if (!tok) return;
    const { k, from, to, dir } = tok;
    live = tok;
    from.classList.add("tr-leave");
    to.classList.add("tr-enter");
    if (k === "zoom" && dir < 0) {
      const f = to.querySelector("[data-focus]");
      tok.focus = f ? rect(f) : null;
    }
    const ms = T[k];
    /* The old slide is gone by about half time and the new one appears from about a third: little double image. */
    const out = Math.round(ms * 0.42), inAt = Math.round(ms * 0.32), inFor = ms - inAt;
    const fadeOut = el => style(tok, el, { transition: "opacity " + out + "ms ease", opacity: "0" });
    const fadeIn = el => style(tok, el, { transition: "opacity " + inFor + "ms ease " + inAt + "ms", opacity: "1" });
    if (k === "fade") {
      style(tok, to, { opacity: "0" }); commit(to);
      fadeIn(to); fadeOut(from);
    } else if (k === "push") {
      style(tok, to, { opacity: "0", transform: "translateX(" + (60 * dir) + "px)" }); commit(to);
      style(tok, to, { transition: "opacity " + inFor + "ms ease " + inAt + "ms, transform " + ms + "ms cubic-bezier(.2,.7,.2,1)", opacity: "1", transform: "none" });
      style(tok, from, { transition: "opacity " + out + "ms ease, transform " + ms + "ms ease", opacity: "0", transform: "translateX(" + (-30 * dir) + "px)" });
    } else if (k === "zoom") {
      const o = origin(tok.focus);
      if (dir > 0) {
        style(tok, from, { transformOrigin: o }); style(tok, to, { opacity: "0", transform: "scale(.96)" }); commit(to);
        style(tok, from, { transition: "opacity " + out + "ms ease, transform " + ms + "ms ease-in-out", opacity: "0", transform: "scale(1.12)" });
        style(tok, to, { transition: "opacity " + inFor + "ms ease " + inAt + "ms, transform " + ms + "ms ease-out", opacity: "1", transform: "none" });
      } else {
        style(tok, to, { transformOrigin: o, opacity: "0", transform: "scale(1.12)" }); commit(to);
        style(tok, from, { transition: "opacity " + out + "ms ease, transform " + ms + "ms ease-in", opacity: "0", transform: "scale(.96)" });
        style(tok, to, { transition: "opacity " + inFor + "ms ease " + inAt + "ms, transform " + ms + "ms ease-out", opacity: "1", transform: "none" });
      }
    } else if (k === "morph") {
      morph(tok, ms);
    }
    tok.timer = setTimeout(finish, ms + 140);                       // timers run in hidden tabs; animations need no rAF
  }

  /* Morph: each pair travels together. The old element moves to the new place and fades out; the new element
     starts at the old place and fades in. A colour or shape change is a cross-fade on the way, never a jump.
     When the shape changes a lot, the content of both is hidden on the way, so stretched text is never seen.
     Everything else: the old slide's content fades out first, the new slide's content fades in after. */
  function morph(tok, ms) {
    const { from, to } = tok;
    const ease = "cubic-bezier(.4,0,.2,1)";
    const rest = (root, set) => {
      const list = [];
      const holds = el => Array.from(set).some(x => el === x || el.contains(x));
      (function walk(node) {
        Array.from(node.children).forEach(c => { if (set.has(c)) return; if (holds(c)) walk(c); else list.push(c); });
      })(root);
      return list;
    };
    const A = new Set(tok.pairs.map(p => p.a)), B = new Set(tok.pairs.map(p => p.b));
    const outList = rest(from, A), inList = rest(to, B);
    inList.forEach(el => style(tok, el, { opacity: "0" }));
    const moves = tok.pairs.map(p => {
      const n = rect(p.b);
      if (!n.w || !n.h || !p.r.w || !p.r.h) return null;
      const sx = p.r.w / n.w, sy = p.r.h / n.h;
      const reshape = Math.abs(sx / sy - 1) > 0.15;
      style(tok, p.b, { transformOrigin: "0 0", opacity: "0", transform: "translate(" + (p.r.x - n.x) + "px," + (p.r.y - n.y) + "px) scale(" + sx + "," + sy + ")" });
      style(tok, p.a, { transformOrigin: "0 0" });
      if (reshape) Array.from(p.b.children).forEach(c => style(tok, c, { opacity: "0" }));
      return { p, n, reshape };
    }).filter(Boolean);
    commit(to);
    moves.forEach(({ p, n, reshape }) => {
      const tx = "translate(" + (n.x - p.r.x) + "px," + (n.y - p.r.y) + "px) scale(" + (n.w / p.r.w) + "," + (n.h / p.r.h) + ")";
      style(tok, p.a, { transition: "transform " + ms + "ms " + ease + ", opacity " + Math.round(ms * 0.6) + "ms ease " + Math.round(ms * 0.2) + "ms", transform: tx, opacity: "0" });
      style(tok, p.b, { transition: "transform " + ms + "ms " + ease + ", opacity " + Math.round(ms * 0.6) + "ms ease " + Math.round(ms * 0.2) + "ms", transform: "none", opacity: "1" });
      if (reshape) {
        Array.from(p.a.children).forEach(c => style(tok, c, { transition: "opacity 160ms ease", opacity: "0" }));
        Array.from(p.b.children).forEach(c => style(tok, c, { transition: "opacity 220ms ease " + Math.round(ms * 0.7) + "ms", opacity: "1" }));
      }
    });
    outList.forEach(el => style(tok, el, { transition: "opacity " + Math.round(ms * 0.4) + "ms ease", opacity: "0" }));
    inList.forEach(el => style(tok, el, { transition: "opacity " + Math.round(ms * 0.5) + "ms ease " + Math.round(ms * 0.35) + "ms", opacity: "1" }));
  }

  function finish() {
    const tok = live; if (!tok) return;
    live = null;
    clearTimeout(tok.timer);
    tok.from.classList.remove("tr-leave");
    tok.to.classList.remove("tr-enter");
    tok.saved.forEach(([el, vals, had]) => {
      PROPS.forEach((p, i) => { el.style[p] = vals[i]; });
      el.removeAttribute("data-tr");
      if (!had && !el.getAttribute("style")) el.removeAttribute("style");
    });
  }

  window.DeckTransition = { before, run, finish, busy: () => !!live };
})();
