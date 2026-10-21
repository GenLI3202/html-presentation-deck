/* Deck engine: stage scaling, navigation, notes and sources panel, presenter window, reference-figure viewer, overview, lazy embeds. */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const slides = $$(".slide");
  const total = slides.length;
  let cur = 0;
  const stage = $("#stage"), wrap = $("#stageWrap"), notesEl = $("#notes"), viewer = $("#viewer");
  /* Notes are read live: a language switch (i18n.js) swaps window.NOTES.slides. */
  const NS = () => (window.NOTES && window.NOTES.slides) || [], TAGS = () => (window.NOTES && window.NOTES.tags) || {};
  const t = (s, v) => (window.t ? window.t(s, v) : s);

  /* ---- scaling ---- */
  function fit() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const s = Math.min(w / 1920, h / 1080);
    stage.style.transform = "translate(" + ((w - 1920 * s) / 2) + "px," + ((h - 1080 * s) / 2) + "px) scale(" + s + ")";
  }
  addEventListener("resize", fit);

  /* ---- chrome per slide ---- */
  slides.forEach((s, i) => {
    if (!s.classList.contains("s-title")) {
      const pg = document.createElement("div");
      pg.className = "pg";
      pg.textContent = String(i + 1).padStart(2, "0") + " / " + total;
      s.appendChild(pg);
    }
  });

  /* ---- embeds ---- */
  /* Embed pages come from deck.config.json "embeds" (build.py writes window.DECK_CONFIG). */
  const EMB = (window.DECK_CONFIG && window.DECK_CONFIG.embeds) || {};
  const cache = {};
  /* The single-file build puts the embed pages in window.__EMBED (url → text). Otherwise they are fetched. */
  const INL = window.__EMBED || {};
  const load = url => INL[url] != null ? Promise.resolve(INL[url]) : fetch(url, { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });
  const pageUrl = url => INL[url] != null ? URL.createObjectURL(new Blob([INL[url]], { type: "text/html" })) : url;
  const FWD = "<script>addEventListener('keydown',function(e){var t=e.target&&e.target.tagName;if(/INPUT|TEXTAREA|SELECT/.test(t))return;if(['ArrowLeft','ArrowRight','PageUp','PageDown','Escape','o','O','n','N','p','P','r','R','f','F'].indexOf(e.key)>-1){try{parent.__deck.key(e);e.preventDefault()}catch(x){}}});<\/script>";
  function prepare(txt, css) {
    let t = txt.replace(/<html(\s[^>]*)?>/i, function (m, a) { return '<html' + (a || '') + ' data-theme="light">'; });
    const style = "<style>" + css + "</style>";
    t = /<head[^>]*>/i.test(t) ? t.replace(/<head[^>]*>/i, function (m) { return m + style; }) : style + t;
    return /<\/body>/i.test(t) ? t.replace(/<\/body>/i, FWD + "</body>") : t + FWD;
  }
  function mount(box) {
    if (box.dataset.ready) return;
    box.dataset.ready = "1";
    const def = EMB[box.dataset.embed];
    if (!def) { box.textContent = "Unknown embed: " + box.dataset.embed + ". Add it to deck.config.json."; return; }
    const ld = document.createElement("div");
    ld.className = "loading"; ld.textContent = t("Loading interactive view…");
    box.appendChild(ld);
    const go = txt => {
      const f = document.createElement("iframe");
      f.title = box.dataset.title || t("Interactive view");
      const sc = def.scale || 1;
      if (sc !== 1) { f.style.width = (100 / sc) + "%"; f.style.height = (100 / sc) + "%"; f.style.transformOrigin = "0 0"; f.style.transform = "scale(" + sc + ")"; }
      /* From file:// a Blob page is not reachable (opaque origin), so use srcdoc there. Over http(s) keep the
         Blob URL: in a srcdoc page the map library's worker does not load the GeoJSON sources. */
      if (location.protocol === "file:") f.srcdoc = prepare(txt, def.css);
      else f.src = URL.createObjectURL(new Blob([prepare(txt, def.css)], { type: "text/html" }));
      f.addEventListener("load", () => { ld.remove(); });
      box.appendChild(f);
      const alive = fr => { try { return !!(fr.contentDocument && fr.contentDocument.body && fr.contentDocument.body.children.length); } catch (e) { return false; } };
      setTimeout(() => {
        if (alive(f)) return;
        f.remove();
        const g = document.createElement("iframe");   // second attempt: the published file itself
        g.title = f.title; g.src = pageUrl(def.url); box.appendChild(g);
        setTimeout(() => {
          if (alive(g)) { ld.remove(); return; }
          g.remove(); ld.innerHTML = 'The embedded view was blocked here. <a href="' + def.url + '" target="_blank" rel="noopener">Open it in a new tab</a>.';
          if (!ld.isConnected) box.appendChild(ld);
        }, 4000);
      }, 4000);
    };
    const get = cache[def.url] || (cache[def.url] = load(def.url));
    get.then(go).catch(() => { ld.innerHTML = 'Could not load the interactive view. <a href="' + def.url + '" target="_blank" rel="noopener">Open it in a new tab</a>.'; });
  }
  function prefetch(i) {
    if (!slides[i]) return;
    $$("[data-embed]", slides[i]).forEach(b => { const d = EMB[b.dataset.embed]; if (!cache[d.url]) cache[d.url] = load(d.url).catch(() => ""); });
  }
  function mountFor(i) {
    $$("[data-embed]", slides[i]).forEach(b => { if (!b.hidden) mount(b); });
    prefetch(i + 1);
  }

  /* ---- navigation ---- */
  const P = window.DeckPresenter || { open: () => false, update() {}, isOpen: () => false };
  function presenter() { if (!P.open()) flash(t("The browser blocked the presenter window. Allow pop-ups for this page, or press N for notes here.")); }
  const A = window.DeckAnim || { enter() {}, forward: () => false, back: () => false, zoomed: () => false, zoomClose() {} };
  /* mode: "start" when entered with →, so builds play; anything else shows the slide complete. */
  function show(i, keepHash, mode) {
    i = Math.max(0, Math.min(total - 1, i));
    A.zoomClose(true);
    if (A.recap) A.recap(slides[i]);                            // a recap slide mirrors its source as it is now
    const TR = window.DeckTransition;
    const calm = TR && $("#viewport").dataset.ready && Math.abs(i - cur) === 1 && !ED() && !Z.busy() && slides[cur].classList.contains("on");
    const tok = calm ? TR.before(slides[cur], slides[i], i > cur ? 1 : -1) : (TR && TR.finish(), null);
    cur = i;
    slides.forEach((s, k) => s.classList.toggle("on", k === i));
    if (tok) TR.run(tok);
    $(".progress").style.width = ((i + 1) / total * 100) + "%";
    if (!keepHash) { try { history.replaceState(null, "", "#s" + (i + 1)); } catch (e) { location.hash = "s" + (i + 1); } }
    renderNotes();
    figButton();
    mountFor(i);
    A.enter(slides[i], mode || "end");
    $$("#overview button").forEach((b, k) => b.classList.toggle("cur", k === i));
    const ev = new CustomEvent("slideshow", { detail: { index: i } });
    slides[i].dispatchEvent(ev);
    P.update();
  }
  const Z = window.DeckTour || { next: () => false, prev: () => false, busy: () => false };
  const ED = () => !!(window.DeckEdit && window.DeckEdit.on());   // edit mode: plain steps, every build shown
  const next = () => { if (ED()) { if (cur < total - 1) show(cur + 1, false, "end"); return; } if (Z.busy() || A.forward(slides[cur]) || Z.next(cur)) return; if (cur < total - 1) show(cur + 1, false, "start"); };
  const prev = () => { if (ED()) { show(cur - 1, false, "end"); return; } if (Z.busy() || A.back(slides[cur]) || Z.prev(cur)) return; show(cur - 1, false, "end"); };

  /* ---- notes and sources panel ---- */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function sec(parent, label) { parent.appendChild(el("h4", "np-sec", t(label))); }
  function chip(tag) { return el("span", "np-ev " + tag, TAGS()[tag] || tag); }
  function renderNotes() {
    if (!notesEl.classList.contains("open")) return;
    const s = slides[cur], n = NS()[cur] || { say: "", cue: [], land: "", limits: [], src: [], figs: [] };
    let used = 0, sum = 0;
    slides.forEach((x, k) => { const t = parseFloat(x.dataset.time || 0); sum += t; if (k <= cur) used += t; });
    const root = el("div", "np");
    const head = el("div", "np-h");
    const ttl = el("div", "np-t");
    ttl.appendChild(el("span", "np-n", String(cur + 1).padStart(2, "0") + " / " + total));
    ttl.appendChild(el("b", "", s.dataset.title || ""));
    head.appendChild(ttl);
    const x = el("button", "np-x", t("Close")); x.type = "button"; x.onclick = () => toggleNotes(false);
    head.appendChild(x);
    root.appendChild(head);
    root.appendChild(el("div", "np-meta", t("{act} · {min} min · {used} of {sum} min used", { act: s.dataset.act || "", min: s.dataset.time || "0", used: used.toFixed(1), sum: sum.toFixed(0) })));
    const nid = (e, k) => { e.dataset.neid = "n" + (cur + 1) + "-" + k; return e; };   // ids for the text editor
    if (n.say) { const q = el("div", "np-say"); q.appendChild(el("span", "np-lab", t("Say"))); q.appendChild(nid(el("p", "", n.say), "say")); root.appendChild(q); }
    if (n.cue.length) { sec(root, "Points"); const ul = el("ul", "np-cue"); n.cue.forEach((t, k) => ul.appendChild(nid(el("li", "", t), "cue" + k))); root.appendChild(ul); }
    if (n.land) { const q = el("div", "np-say land"); q.appendChild(el("span", "np-lab", t("End with"))); q.appendChild(nid(el("p", "", n.land), "land")); root.appendChild(q); }
    if (n.limits.length) {
      sec(root, "Limits");
      const ul = el("ul", "np-lim");
      n.limits.forEach((l, k) => { const li = el("li"); li.appendChild(chip(l[0])); li.appendChild(nid(el("span", "", l[1]), "lim" + k)); ul.appendChild(li); });
      root.appendChild(ul);
    }
    if (n.src.length) {
      sec(root, "Sources");
      const ul = el("ul", "np-src");
      n.src.forEach(r => {
        const li = el("li"); li.appendChild(chip(r.tag));
        const box = el("span", "np-st");
        if (r.url) { const a = el("a", "", r.title); a.href = r.url; a.target = "_blank"; a.rel = "noopener noreferrer"; box.appendChild(a); }
        else box.appendChild(el("span", "np-nolink", r.title));
        if (r.meta) box.appendChild(el("small", "", r.meta));
        li.appendChild(box); ul.appendChild(li);
      });
      root.appendChild(ul);
    }
    sec(root, "Reference figures");
    if (n.figs.length) {
      const g = el("div", "np-figs");
      n.figs.forEach((f, i) => {
        const b = el("button", "np-fig"); b.type = "button";
        b.appendChild(el("span", "np-fi", f.k === "embed" ? "↗" : "▣"));
        const t = el("span", "np-ft"); t.appendChild(el("b", "", f.n)); t.appendChild(el("small", "", f.d || ""));
        b.appendChild(t);
        b.onclick = () => openFig(i);
        g.appendChild(b);
      });
      root.appendChild(g);
    } else root.appendChild(el("p", "np-none", t("No reference figure for this slide.")));
    root.appendChild(el("p", "np-keys", t("← → move · R open first figure · O overview · P presenter window · E edit text · L language · N close this panel · F full screen")));
    const host = $("#notes .in");
    const top = host.scrollTop;
    host.replaceChildren(root);
    host.scrollTop = top && host.dataset.slide === String(cur) ? top : 0;
    host.dataset.slide = String(cur);
  }
  function toggleNotes(force) {
    const open = force === undefined ? !notesEl.classList.contains("open") : force;
    notesEl.classList.toggle("open", open);
    $("#bNotes").setAttribute("aria-pressed", open ? "true" : "false");
    renderNotes();
    fit();
  }

  /* ---- reference-figure viewer ---- */
  let figIdx = -1, lastFocus = null;
  const viewerOpen = () => !viewer.hidden;
  function fitFig() {
    const st = $(".vw-stage", viewer), card = $(".vw-card", viewer), fig = $(".vw-fig", card);
    if (!fig) return;
    fig.style.transform = "none";
    const nw = fig.offsetWidth, nh = fig.offsetHeight;
    const aw = st.clientWidth - 40, ah = st.clientHeight - 40;
    const sc = Math.max(0.2, Math.min(aw / nw, ah / nh, 1.8));
    card.style.width = Math.round(nw * sc) + "px";
    card.style.height = Math.round(nh * sc) + "px";
    fig.style.transformOrigin = "0 0";
    fig.style.transform = "scale(" + sc + ")";
  }
  function figNode(f) {
    const fig = el("div", "vw-fig");
    if (f.k === "tpl") {
      const t = document.getElementById(f.t);
      if (!t) return null;
      fig.appendChild(t.content.cloneNode(true));
    } else if (f.k === "clone") {
      const src = $$(f.s, slides[cur])[f.i || 0];
      if (!src) return null;
      const c = src.cloneNode(true);
      c.removeAttribute("id");
      c.style.width = "100%"; c.style.height = "auto"; c.removeAttribute("height");
      fig.appendChild(c);
    }
    return fig;
  }
  function openFig(i) {
    const n = NS()[cur]; if (!n || !n.figs.length) return false;
    i = (i + n.figs.length) % n.figs.length;
    figIdx = i;
    const f = n.figs[i];
    if (viewer.hidden) lastFocus = document.activeElement;
    viewer.hidden = false;
    $(".vw-name", viewer).textContent = f.n;
    $(".vw-desc", viewer).textContent = f.d || "";
    $(".vw-n", viewer).textContent = (i + 1) + " / " + n.figs.length;
    $(".vw-prev", viewer).hidden = $(".vw-next", viewer).hidden = n.figs.length < 2;
    $(".vw-n", viewer).hidden = n.figs.length < 2;
    const card = $(".vw-card", viewer);
    card.replaceChildren(); card.removeAttribute("style"); card.className = "vw-card";
    const link = $(".vw-open", viewer);
    if (f.k === "embed") {
      card.classList.add("embed");
      const box = el("div", "frame"); box.dataset.embed = f.e; box.dataset.title = f.n;
      card.appendChild(box);
      mount(box);
      link.hidden = false; link.href = pageUrl(EMB[f.e].url);
    } else {
      link.hidden = true;
      const fig = figNode(f);
      if (!fig) { card.appendChild(el("p", "vw-miss", t("This figure is not on the slide."))); }
      else { card.appendChild(fig); requestAnimationFrame(fitFig); }
    }
    $(".vw-close", viewer).focus({ preventScroll: true });
    return true;
  }
  function closeFig() {
    viewer.hidden = true; figIdx = -1;
    $(".vw-card", viewer).replaceChildren();
    if (lastFocus && lastFocus.isConnected && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }
  function stepFig(d) { if (figIdx >= 0) openFig(figIdx + d); }
  function flash(msg) {
    const h = $("#hint"); if (!h) return;
    h.textContent = msg; h.style.opacity = 1;
    clearTimeout(flash.t); flash.t = setTimeout(() => { h.style.opacity = 0; }, 2200);
  }
  addEventListener("resize", () => { if (viewerOpen()) fitFig(); });
  $(".vw-close", viewer).onclick = closeFig;
  $(".vw-prev", viewer).onclick = () => stepFig(-1);
  $(".vw-next", viewer).onclick = () => stepFig(1);
  viewer.addEventListener("click", e => { if (e.target.classList.contains("vw-stage")) closeFig(); });

  function toggleOverview(force) {
    const o = $("#overview"); const open = force === undefined ? !o.classList.contains("open") : force;
    o.classList.toggle("open", open);
  }
  function fullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }
  function key(e) {
    const k = e.key;
    if (keysOpen()) { toggleKeys(false); if (e.preventDefault) e.preventDefault(); return; }
    if (k === "?") { toggleKeys(true); if (e.preventDefault) e.preventDefault(); return; }
    if (viewerOpen()) {
      if (k === "Escape") closeFig();
      else if (k === "ArrowRight" || k === "PageDown") stepFig(1);
      else if (k === "ArrowLeft" || k === "PageUp") stepFig(-1);
      else if (k === "f" || k === "F") fullscreen();
      else return;
      if (e.preventDefault) e.preventDefault();
      return;
    }
    if (A.zoomed()) {
      if (["Escape", "ArrowRight", "ArrowLeft", "PageDown", "PageUp", " "].indexOf(k) > -1) { A.zoomClose(); if (e.preventDefault) e.preventDefault(); }
      return;
    }
    if (k === "ArrowRight" || k === "PageDown" || k === " " && !e.shiftKey) { next(); }
    else if (k === "ArrowLeft" || k === "PageUp" || (k === " " && e.shiftKey)) { prev(); }
    else if (k === "Home") show(0);
    else if (k === "End") show(total - 1);
    else if (k === "o" || k === "O") toggleOverview();
    else if (k === "n" || k === "N") toggleNotes();
    else if (k === "p" || k === "P") presenter();
    else if ((k === "e" || k === "E") && window.DeckEdit) window.DeckEdit.toggle();
    else if ((k === "l" || k === "L") && I && I.langs.length > 1) I.toggle();
    else if (k === "r" || k === "R") { if (!openFig(0)) flash(t("No reference figure on this slide")); }
    else if (k === "f" || k === "F") fullscreen();
    else if (k === "Escape") { if ($("#overview").classList.contains("open")) toggleOverview(false); else if (notesEl.classList.contains("open")) toggleNotes(false); }
    else return;
    if (e.preventDefault) e.preventDefault();
  }
  addEventListener("keydown", e => {
    const t = e.target && e.target.tagName;
    if (/INPUT|TEXTAREA|SELECT/.test(t) || (e.target && e.target.isContentEditable)) return;
    key(e);
  });
  addEventListener("hashchange", () => { const m = /^#s(\d+)$/.exec(location.hash); if (m) show(parseInt(m[1], 10) - 1, true); });

  /* ---- buttons / overview ---- */
  $("#bPrev").onclick = prev; $("#bNext").onclick = next; $("#bOv").onclick = () => toggleOverview();
  $("#bNotes").onclick = () => toggleNotes(); $("#bFs").onclick = fullscreen;
  $("#bPres").onclick = presenter;

  /* ---- toolbar: Overview and Full screen always; the rest folds behind ⋯ (remembered); a Reference figures
     button appears only on slides that have figures. The bar shows while the mouse moves and hides at rest. ---- */
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } } };
  function setMore(open) {
    $("#dMore").hidden = !open;
    $("#bMore").setAttribute("aria-expanded", open ? "true" : "false");
    $("#bMore").title = t(open ? "Fewer controls" : "More controls");
    store.set("deck-more", open ? "1" : "0");
  }
  $("#bMore").onclick = () => setMore($("#dMore").hidden);
  setMore(store.get("deck-more") === "1");
  function figButton() {
    const b = $("#bFig"); if (!b) return;
    const n = (NS()[cur] && NS()[cur].figs.length) || 0;
    b.hidden = !n;
    b.textContent = "▣ " + t(n > 1 ? "{n} reference figures" : "{n} reference figure", { n }) + " · R";
    b.title = t("Open the reference figures of this slide (R)");
  }
  $("#bFig").onclick = () => openFig(0);
  let awake = 0;
  const wake = () => { document.body.classList.add("ui-awake"); clearTimeout(awake); awake = setTimeout(() => document.body.classList.remove("ui-awake"), 2500); };
  ["mousemove", "pointerdown", "touchstart"].forEach(ev => addEventListener(ev, wake, { passive: true }));
  wake();

  /* ---- keyboard shortcuts (? key or the Keys button) ---- */
  const keysEl = $("#keys");
  const keysOpen = () => keysEl && !keysEl.hidden;
  function toggleKeys(force) {
    if (!keysEl) return;
    const open = force === undefined ? keysEl.hidden : force;
    if (open) {
      const rows = [["← →", "Move; the next build step first"], ["Home End", "First and last slide"], ["O", "Overview"], ["R", "Reference figures of this slide"],
        ["N", "Notes and sources in this window"], ["P", "Presenter window for a second screen"], ["F", "Full screen"]];
      if (window.DeckEdit) rows.push(["E", "Edit the text"]);
      if (I && I.langs.length > 1) rows.push(["L", "Switch language"]);
      rows.push(["?", "This list"], ["Esc", "Close the top layer"]);
      const box = $(".keys-in", keysEl);
      box.replaceChildren(el("h3", "", t("Keyboard shortcuts")));
      const dl = el("dl");
      rows.forEach(([k, d]) => { const dt = el("dt"); k.split(" ").forEach(x => dt.appendChild(el("kbd", "", x))); dl.appendChild(dt); dl.appendChild(el("dd", "", t(d))); });
      box.appendChild(dl);
      box.appendChild(el("p", "keys-x", t("Press any key or click to close.")));
    }
    keysEl.hidden = !open;
  }
  if (keysEl) keysEl.addEventListener("click", () => toggleKeys(false));
  if ($("#bKeys")) $("#bKeys").onclick = () => toggleKeys(true);
  if ($("#bEdit")) $("#bEdit").onclick = () => { if (window.DeckEdit) window.DeckEdit.toggle(); };
  const fsLabel = () => { $("#bFs").textContent = t(document.fullscreenElement ? "Exit full screen" : "Full screen"); };
  document.addEventListener("fullscreenchange", fsLabel);
  function buildOverview() {
    const ov = $("#overview .grid");
    ov.replaceChildren();
    slides.forEach((s, i) => {
      const b = document.createElement("button");
      const nf = NS()[i] ? NS()[i].figs.length : 0;
      [["n", String(i + 1).padStart(2, "0")], ["a", s.dataset.act || ""], ["t", s.dataset.title || ""], ["f", nf ? "▣ " + t(nf > 1 ? "{n} figures" : "{n} figure", { n: nf }) : ""]]
        .forEach(([c, v]) => { if (v) b.appendChild(el("span", c, v)); });
      b.classList.toggle("cur", i === cur);
      b.onclick = () => { toggleOverview(false); show(i); };
      ov.appendChild(b);
    });
  }
  /* Language switch (i18n.js): L or the button. The engine redraws what it builds itself. */
  const I = window.I18N && window.I18N.langs.length ? window.I18N : null;
  const langLabel = () => { const b = $("#bLang"); if (b && I) b.textContent = I.label(I.next()); };
  if ($("#bLang")) $("#bLang").onclick = () => { if (I) I.toggle(); };
  document.addEventListener("langchange", () => {
    A.zoomClose(true); if (viewerOpen()) closeFig();
    buildOverview(); renderNotes(); figButton(); fsLabel(); langLabel(); P.update();
  });
  $("#overview").addEventListener("click", e => { if (e.target.id === "overview") toggleOverview(false); });

  window.__deck = { key: key, show: show, slides: slides, mount: mount, current: () => cur };
  if (I) I.start();
  buildOverview(); fsLabel(); langLabel();
  fit();
  const m = /^#s(\d+)$/.exec(location.hash);
  show(m ? parseInt(m[1], 10) - 1 : 0, !m);
  setTimeout(() => { const h = $("#hint"); if (h) h.style.opacity = 0; }, 5000);
  $("#viewport").dataset.ready = "1";
})();
