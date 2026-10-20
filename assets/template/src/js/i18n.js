/* Languages. deck.config.json "languages": the first is the source (slides.html, notes.js); the others come from
   src/i18n/<lang>.txt and src/notes_<lang>.js (window.I18N_DATA and window.NOTES_TR, written by build.py).
   L or the language button cycles the languages; ?lang=zh opens in Chinese; the choice is remembered.
   This file owns what each text unit shows: elements with data-eid (the editor's ids) get their text per language
   from getText(lang, id). The editor changes text only through setText(lang, id, html), so an edit in one language
   never changes another. Text without an id (drawn by scripts) is translated by the free strings and patterns,
   also when a script redraws it. Embedded pages stay as published.
   window.t(s, vars) translates an engine string (window.I18N_UI) into the language on screen; {name} is replaced
   from vars. A "langchange" event fires on document after a switch. */
(function () {
  "use strict";
  const D = window.I18N_DATA || { source: "en", langs: ["en"], tr: {} };
  const UI = window.I18N_UI || {};
  const SRC = D.source, LANGS = D.langs;
  const KEY = "deck-lang:" + ((window.DECK_CONFIG && window.DECK_CONFIG.title) || document.title);
  const SKIP = new Set(["SCRIPT", "STYLE", "IFRAME", "TEMPLATE", "TITLE", "DESC", "title", "desc", "style", "script"]);
  const norm = s => String(s).replace(/\s+/g, " ").trim();
  let lang = SRC, busy = false;

  window.t = function (s, vars) {
    let out = s;
    const u = UI[lang];
    if (u && u[s] != null) out = u[s];
    if (vars) out = String(out).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return out;
  };

  /* ---------- text units with ids ---------- */
  const srcText = {}, kindOf = {};
  function nodes(eid) {
    const sel = '[data-eid="' + eid + '"]';
    const out = Array.from(document.querySelectorAll(sel));
    document.querySelectorAll("template").forEach(t => out.push(...t.content.querySelectorAll(sel)));
    return out;
  }
  function capture() {
    const all = Array.from(document.querySelectorAll("[data-eid]"));
    document.querySelectorAll("template").forEach(t => all.push(...t.content.querySelectorAll("[data-eid]")));
    all.forEach(n => {
      const id = n.getAttribute("data-eid");
      if (id in srcText) return;
      kindOf[id] = n.tagName.toLowerCase() === "text" ? "svg" : "html";
      srcText[id] = kindOf[id] === "svg" ? n.textContent : n.innerHTML;
    });
  }
  const units = l => (D.tr[l] || (D.tr[l] = { units: {}, free: {}, pats: [] })).units;
  function getText(l, id) {
    if (l === SRC) return srcText[id];
    const u = (D.tr[l] || {}).units || {};
    return u[id] != null ? u[id] : srcText[id];
  }
  const translated = (l, id) => l === SRC || ((D.tr[l] || {}).units || {})[id] != null;
  function render(id) {
    const v = getText(lang, id);
    if (v == null) return;
    nodes(id).forEach(n => {
      if (n.isContentEditable && n === document.activeElement) return;   // never under the cursor
      if (kindOf[id] === "svg") { if (n.textContent !== v) n.textContent = v; } else if (n.innerHTML !== v) n.innerHTML = v;
    });
  }
  function setText(l, id, v) {
    if (l === SRC) srcText[id] = v; else units(l)[id] = v;
    if (l === lang) { busy = true; render(id); mo.takeRecords(); busy = false; }
  }

  /* ---------- text without ids: free strings and patterns ---------- */
  const compiled = {};
  function pats(l) {
    if (!compiled[l]) compiled[l] = ((D.tr[l] || {}).pats || []).map(([p, r]) => { try { return [new RegExp(p), r]; } catch (e) { return null; } }).filter(Boolean);
    return compiled[l];
  }
  function lookup(l, s) {
    if (l === SRC || !s) return null;
    const free = (D.tr[l] || {}).free || {};
    if (Object.prototype.hasOwnProperty.call(free, s)) return free[s];
    let out = s, hit = false;
    for (const [re, rep] of pats(l)) if (re.test(out)) { out = out.replace(re, rep); hit = true; }
    if (!hit && UI[l] && UI[l][s] != null) return UI[l][s];   // engine labels inside slides (zoom chips)
    return hit ? out : null;
  }
  const loose = new Map();                          // node -> [source text, shown text]
  function walkLoose(root, fn) {
    if (!root) return;
    for (const n of Array.from(root.childNodes)) {
      if (n.nodeType === 3) { if (n.nodeValue.trim()) fn(n); continue; }
      if (n.nodeType !== 1 || SKIP.has(n.tagName) || n.hasAttribute("data-eid") || n.classList.contains("frame") || n.classList.contains("no-i18n")) continue;
      walkLoose(n, fn);
    }
  }
  function looseTo(root) {
    walkLoose(root, n => {
      const prev = loose.get(n);
      const src = prev && n.nodeValue === prev[1] ? prev[0] : n.nodeValue;
      const z = lookup(lang, norm(src));
      if (z == null) { if (prev && n.nodeValue === prev[1]) n.nodeValue = prev[0]; loose.delete(n); return; }
      if (n.nodeValue !== z) n.nodeValue = z;
      loose.set(n, [src, z]);
    });
  }
  function looseBack() { loose.forEach(([src, z], n) => { if (n.nodeValue === z) n.nodeValue = src; }); loose.clear(); }

  /* ---------- slide attributes, chrome, notes ---------- */
  function attrs() {
    document.querySelectorAll("#stage > .slide").forEach(s => {
      ["title", "act"].forEach(a => {
        const k = "src" + a[0].toUpperCase() + a.slice(1);
        if (s.dataset[k] == null) s.dataset[k] = s.dataset[a] || "";
        const z = lookup(lang, norm(s.dataset[k]));
        s.dataset[a] = z != null ? z : s.dataset[k];
      });
    });
  }
  function chrome() { document.querySelectorAll("[data-ui]").forEach(el => { el.textContent = window.t(el.dataset.ui); }); }
  function notes() {
    const N = window.NOTES; if (!N || !N.langs) return;
    const src = N.langs[lang] || N.langs[SRC];
    N.slides = src.slides; N.tags = src.tags;
  }

  function apply(next, quiet) {
    if (LANGS.indexOf(next) < 0) next = SRC;
    busy = true;
    lang = next;
    Object.keys(srcText).forEach(render);
    const st = document.getElementById("stage");
    if (lang === SRC) looseBack(); else { looseBack(); looseTo(st); document.querySelectorAll("template").forEach(t => looseTo(t.content)); }
    attrs(); chrome(); notes();
    document.documentElement.lang = lang;
    mo.takeRecords();
    busy = false;
    try { localStorage.setItem(KEY, lang); } catch (e) { /* storage blocked */ }
    if (!quiet) document.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
  }
  function toggle() { apply(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]); }

  /* Scripts that redraw text: translate the new text again. Text inside id units is never touched here. */
  const mo = new MutationObserver(list => {
    if (busy || lang === SRC) return;
    busy = true;
    const done = new Set();
    list.forEach(m => {
      let el = m.target.nodeType === 1 ? m.target : m.target.parentNode;
      if (!el || (el.closest && el.closest("[data-eid]"))) return;
      el = (el.closest && el.closest("svg")) || el;
      if (!done.has(el)) { done.add(el); looseTo(el.parentNode || el); }
    });
    mo.takeRecords();
    busy = false;
  });

  capture();                                        // at load: the editor reads the source text before start()
  function start() {
    let want = SRC;
    try { want = localStorage.getItem(KEY) || SRC; } catch (e) { /* storage blocked */ }
    const m = /[?&]lang=([a-z]{2}(?:-[A-Za-z]+)?)\b/.exec(location.search); if (m) want = m[1];
    const st = document.getElementById("stage");
    if (st) mo.observe(st, { childList: true, subtree: true, characterData: true });
    apply(LANGS.indexOf(want) > -1 ? want : SRC, true);
  }
  const label = l => ({ en: "EN", zh: "中文" })[l] || l.toUpperCase();

  window.I18N = {
    start, apply, toggle, getText, setText, translated, label,
    text: s => { const z = lookup(lang, norm(s)); return z != null ? z : s; },   // a free string (PDF titles, captions)
    lang: () => lang, source: SRC, langs: LANGS.slice(),
    kind: id => kindOf[id], next: () => LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]
  };
})();
