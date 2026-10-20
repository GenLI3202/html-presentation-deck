/* Edit the words in place, never the layout. E (or the "Edit text" button) toggles edit mode.
   Editable: elements with data-eid (stamped by build.py: titles, text, callouts, footers, zoom details, SVG labels)
   and the notes in the N panel (data-neid). Enter commits, Esc undoes the current field, paste is plain text.
   Every edit belongs to the language on screen. The text goes through i18n.js (setText), so an edit in Chinese
   changes only the Chinese and an edit in English only the English.
   Where edits are kept:
     - on a hosted Artifact that declares the db capability: the "edits" collection, one document per element and
       language, shared by everyone who opens the page; only the owner and editors can write.
     - anywhere else (preview.html from disk): this browser's storage; "Export" downloads edits.json.
   src/apply_edits.py writes edits back: the source language into slides.html and notes.js, other languages into
   src/i18n/<lang>.txt and src/notes_<lang>.js. Used by deck.js. */
(function () {
  "use strict";
  const TITLE = (window.DECK_CONFIG && window.DECK_CONFIG.title) || document.title;
  const KEY = "deck-edits:" + TITLE;
  const KEEP = new Set(["B", "I", "EM", "STRONG", "SPAN", "SMALL", "BR", "SUP", "SUB", "CODE", "MARK"]);
  const NOTE_ID = /^n(\d+)-(say|land|cue(\d+)|lim(\d+))$/;
  const I = window.I18N || null;
  const SRC = I ? I.source : "src";
  const lnow = () => (I ? I.lang() : SRC);
  const tr = (s, v) => (window.t ? window.t(s, v) : s);
  const textOf = h => { const d = document.createElement("div"); d.innerHTML = String(h).replace(/<br\s*\/?>/gi, " "); return d.textContent.replace(/\s+/g, " ").trim(); };
  const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const keyOf = (lang, eid) => lang + "_" + eid;              // also the db document id

  let edits = {};                 // key -> { eid, lang, kind: "html" | "svg" | "note", slide, before, after, at }
  let stale = {};                 // edits whose text in the file changed since (kept, not applied)
  let on = false, mode = "local", db = null, canWrite = true;
  const orig = {};                // key -> the text in the file for that language, before any edit

  /* ---------- stores ---------- */
  const local = {
    load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } },
    flush() { try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, stale, edits))); } catch (e) { flash(tr("This browser blocks storage: export your edits before you close the page.")); } }
  };
  const queue = {};               // one write at a time per document
  function dbWrite(k, fn) {
    queue[k] = (queue[k] || Promise.resolve()).then(fn).catch(err => {
      if (err && err.code === "invalid_argument") { canWrite = false; setOn(false); flash(tr("You can view this deck but not edit it.")); }
      else flash(tr("Could not save the edit ({code}). Try again.", { code: (err && err.code) || "error" }));
    });
  }
  function save(k) {
    if (mode === "db") { const e = edits[k]; dbWrite(k, () => db.collection("edits").doc(k).set(e)); }
    else local.flush();
  }
  function remove(k) {
    delete edits[k]; delete stale[k];
    if (mode === "db") dbWrite(k, () => db.collection("edits").doc(k).delete());
    else local.flush();
  }

  /* ---------- reading and writing text ---------- */
  function nodes(eid) {
    const sel = '[data-eid="' + eid + '"]';
    const out = Array.from(document.querySelectorAll(sel));
    document.querySelectorAll("template").forEach(t => out.push(...t.content.querySelectorAll(sel)));
    return out;
  }
  function noteRef(eid, lang) {
    const m = NOTE_ID.exec(eid); if (!m) return null;
    const N = window.NOTES || {};
    const set = (N.langs && N.langs[lang] ? N.langs[lang].slides : N.slides) || [];
    const n = set[+m[1] - 1]; if (!n) return null;
    if (m[2] === "say" || m[2] === "land") return { get: () => n[m[2]], set: v => { n[m[2]] = v; } };
    if (m[3] != null && n.cue[+m[3]] != null) return { get: () => n.cue[+m[3]], set: v => { n.cue[+m[3]] = v; } };
    if (m[4] != null && n.limits[+m[4]]) return { get: () => n.limits[+m[4]][1], set: v => { n.limits[+m[4]][1] = v; } };
    return null;
  }
  function read(eid, kind, lang) {
    if (kind === "note") { const r = noteRef(eid, lang); return r ? r.get() : null; }
    if (I) return I.getText(lang, eid);
    const n = nodes(eid)[0]; if (!n) return null;
    return kind === "svg" ? n.textContent : n.innerHTML;
  }
  function write(eid, kind, lang, v) {
    if (kind === "note") { const r = noteRef(eid, lang); if (r) r.set(v); return; }
    if (I) { I.setText(lang, eid, v); return; }
    nodes(eid).forEach(n => { if (kind === "svg") n.textContent = v; else if (n !== document.activeElement) n.innerHTML = v; });
  }
  /* Marks show the edits of the language on screen. */
  function marks() {
    document.querySelectorAll(".edited").forEach(n => n.classList.remove("edited"));
    const L = lnow();
    Object.values(edits).forEach(e => { if (e.lang === L && e.kind !== "note") nodes(e.eid).forEach(n => n.classList.add("edited")); });
  }
  /* Apply stored edits: drop the ones already in the file, keep the ones whose file text changed as stale. */
  function adopt(list) {
    list.forEach(e => {
      if (!e || !e.eid) return;
      e.lang = e.lang || SRC;
      const k = keyOf(e.lang, e.eid);
      if (orig[k] == null) orig[k] = read(e.eid, e.kind, e.lang);
      const file = orig[k];
      if (file == null) { stale[k] = e; return; }
      if (textOf(file) === textOf(e.after)) { if (canWrite) remove(k); return; }     // merged already
      if (textOf(file) !== textOf(e.before)) { stale[k] = e; return; }
      edits[k] = e; write(e.eid, e.kind, e.lang, e.after);
    });
    marks(); bar();
  }

  /* Keep inline formatting only, with its class; never copy the live DOM's other attributes. */
  function clean(el) {
    const walk = n => Array.from(n.childNodes).map(c => {
      if (c.nodeType === 3) return esc(c.nodeValue);
      if (c.nodeType !== 1) return "";
      if (!KEEP.has(c.tagName)) return walk(c);
      const tag = c.tagName.toLowerCase();
      if (tag === "br") return "<br>";
      const cls = c.getAttribute("class") ? ' class="' + c.getAttribute("class").replace(/"/g, "").replace(/\bedited\b/, "").trim() + '"' : "";
      return "<" + tag + (cls === ' class=""' ? "" : cls) + ">" + walk(c) + "</" + tag + ">";
    }).join("");
    return walk(el).replace(/ /g, " ").trim();
  }

  /* ---------- edit mode ---------- */
  const editable = root => root.querySelectorAll("#stage [data-eid]:not(text), .zl [data-eid]:not(text), #notes [data-neid]");
  function arm(root) {
    if (!on) return;
    editable(root || document).forEach(el => { if (!el.hasAttribute("contenteditable")) el.setAttribute("contenteditable", "plaintext-only"); });
  }
  function disarm() { document.querySelectorAll("[contenteditable]").forEach(el => el.removeAttribute("contenteditable")); }
  function setOn(v) {
    if (v && !canWrite) { flash(tr("You can view this deck but not edit it.")); return; }
    on = v;
    if (!on && document.activeElement && document.activeElement.isContentEditable) document.activeElement.blur();
    document.body.classList.toggle("editing", on);
    if (on) {
      const d = window.__deck, A = window.DeckAnim;
      if (d && A) A.enter(d.slides[d.current()], "end");      // every build visible, so every text can be edited
      arm();
    } else { disarm(); closeSvg(); }
    bar();
  }
  const watch = new MutationObserver(muts => { if (on) muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) arm(n.parentNode || document); })); });

  document.addEventListener("focusin", e => {
    const el = e.target;
    if (!on || !el.isContentEditable || el.dataset.start != null) return;
    el.dataset.start = el.innerHTML;
  });
  document.addEventListener("keydown", e => {
    const el = e.target;
    if (!el.isContentEditable) return;
    if (e.key === "Enter") { e.preventDefault(); el.blur(); }
    else if (e.key === "Escape") { e.preventDefault(); if (el.dataset.start != null) el.innerHTML = el.dataset.start; el.blur(); }
    e.stopPropagation();
  }, true);
  document.addEventListener("paste", e => {
    if (!e.target.isContentEditable) return;
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData).getData("text/plain").replace(/\s*\n\s*/g, " ");
    document.execCommand("insertText", false, t);
  }, true);
  document.addEventListener("focusout", e => {
    const el = e.target;
    if (!el.isContentEditable || el.dataset.start == null) return;
    const start = el.dataset.start; delete el.dataset.start;
    if (el.dataset.neid) commit(el.dataset.neid, "note", +el.dataset.neid.slice(1).split("-")[0], el.textContent.replace(/\s+/g, " ").trim(), textOf(start));
    else if (el.dataset.eid) commit(el.dataset.eid, "html", slideOf(el), clean(el), start);
  });
  /* In edit mode a click on text edits it: it must not open a zoom, follow a link or jump. */
  document.addEventListener("click", e => {
    if (!on) return;
    const t = e.target;
    const svg = t.closest && t.closest("text[data-eid]");
    if (svg) { e.stopPropagation(); e.preventDefault(); openSvg(svg); return; }
    if (t.closest("[contenteditable]") || (t.closest("[data-zoom]") && !t.closest(".zchip"))) { e.stopPropagation(); e.preventDefault(); }
  }, true);

  function slideOf(el) {
    const s = el.closest("#stage > .slide");
    if (s) return Array.from(document.querySelectorAll("#stage > .slide")).indexOf(s) + 1;
    const m = /^s(\d+)-/.exec(el.dataset.eid || ""); return m ? +m[1] : 0;
  }
  function commit(eid, kind, slide, after, startValue) {
    const lang = lnow(), k = keyOf(lang, eid);
    if (orig[k] == null) orig[k] = kind === "note" || !I ? startValue : read(eid, kind, lang);   // i18n still holds the file text
    const prev = edits[k];
    const before = prev ? prev.before : (kind === "note" ? textOf(orig[k]) : orig[k]);
    write(eid, kind, lang, after);
    if (textOf(after) === textOf(orig[k])) { if (prev) remove(k); }
    else { edits[k] = { eid, lang, kind, slide, before, after, at: new Date().toISOString() }; save(k); }
    marks(); bar();
    if (window.DeckPresenter) window.DeckPresenter.update(true);
  }

  /* SVG labels: a small input over the label */
  let svgBox = null;
  function openSvg(t) {
    closeSvg();
    const r = t.getBoundingClientRect();
    const eid = t.dataset.eid, start = t.textContent;
    svgBox = document.createElement("input");
    svgBox.className = "ed-svg"; svgBox.value = start;
    Object.assign(svgBox.style, { left: Math.max(4, r.left - 6) + "px", top: Math.max(4, r.top - 6) + "px", width: Math.max(160, r.width + 40) + "px" });
    document.body.appendChild(svgBox);
    svgBox.focus(); svgBox.select();
    const done = keep => {
      if (!svgBox) return;
      const v = svgBox.value.replace(/\s+/g, " ").trim();
      closeSvg();
      if (keep && v && v !== start) commit(eid, "svg", slideOf(t), v, start);
    };
    svgBox.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") done(true); else if (e.key === "Escape") done(false); });
    svgBox.addEventListener("blur", () => done(true));
  }
  function closeSvg() { if (svgBox) { const b = svgBox; svgBox = null; b.remove(); } }

  /* ---------- the bar at the top in edit mode ---------- */
  let barEl = null, armed = false;
  function bar() {
    if (!barEl) {
      barEl = document.createElement("div");
      barEl.id = "edbar"; barEl.setAttribute("role", "status");
      barEl.innerHTML = '<b class="ed-t"></b><span class="ed-lang"></span><span class="ed-n"></span><span class="ed-where"></span>'
        + '<button type="button" class="ed-exp"></button><button type="button" class="ed-dis"></button><button type="button" class="ed-done"></button>';
      document.body.appendChild(barEl);
      barEl.querySelector(".ed-done").onclick = () => setOn(false);
      barEl.querySelector(".ed-exp").onclick = exportEdits;
      barEl.querySelector(".ed-dis").onclick = discard;
    }
    const n = Object.keys(edits).length, s = Object.keys(stale).length;
    const q = c => barEl.querySelector(c);
    barEl.hidden = !on;
    q(".ed-t").textContent = tr("Edit text");
    q(".ed-lang").textContent = I && I.langs.length > 1 ? tr("editing {lang}", { lang: I.label(lnow()) }) : "";
    q(".ed-n").textContent = tr(n === 1 ? "{n} change" : "{n} changes", { n }) + (s ? " · " + tr("{n} no longer match the file", { n: s }) : "");
    q(".ed-where").textContent = tr(mode === "db" ? "saved to this Artifact" : "saved in this browser");
    q(".ed-exp").textContent = tr("Export");
    q(".ed-exp").hidden = mode === "db" || !(n + s);
    q(".ed-dis").hidden = !(n + s);
    q(".ed-dis").textContent = tr(armed ? "Click again to discard" : "Discard all");
    q(".ed-done").textContent = tr("Done · E");
    const btn = document.getElementById("bEdit");
    if (btn) { btn.setAttribute("aria-pressed", on ? "true" : "false"); btn.hidden = !canWrite; }
  }
  function exportEdits() {
    const all = Object.values(Object.assign({}, stale, edits));
    const blob = new Blob([JSON.stringify({ deck: TITLE, exported: new Date().toISOString(), edits: all }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "edits.json";
    document.body.appendChild(a); a.click(); a.remove();
    flash(tr("edits.json saved. Merge it with: python3 src/apply_edits.py edits.json"));
  }
  function discard() {
    if (!armed) { armed = true; bar(); setTimeout(() => { armed = false; bar(); }, 3000); return; }
    Object.keys(Object.assign({}, stale, edits)).forEach(remove);
    Promise.all(Object.values(queue)).then(() => location.reload());
  }
  function flash(msg) {
    const h = document.getElementById("hint"); if (!h) return;
    h.textContent = msg; h.style.opacity = 1;
    clearTimeout(flash.t); flash.t = setTimeout(() => { h.style.opacity = 0; }, 3500);
  }

  /* ---------- start ---------- */
  adopt(Object.values(local.load()));
  watch.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("langchange", () => { closeSvg(); marks(); bar(); if (on) arm(); });
  if (window.claude && typeof window.claude.use === "function") {
    window.claude.use("db").then(async d => {
      if (!d) return;
      const user = await window.claude.use("user").catch(() => null);
      db = d; mode = "db";
      if (user && typeof user.canEdit === "function") canWrite = !!(await user.canEdit());
      Object.keys(edits).forEach(k => { const e = edits[k]; if (orig[k] != null) write(e.eid, e.kind, e.lang, orig[k]); });   // browser edits do not belong to the Artifact
      edits = {}; stale = {};
      const snap = await db.collection("edits").get();
      adopt(snap.docs.map(x => x.data()));
      if (window.__deck) window.__deck.show(window.__deck.current(), true);
    }).catch(() => { /* stay local */ });
  }
  window.DeckEdit = { toggle: () => setOn(!on), on: () => on, edits: () => Object.values(edits) };
})();
