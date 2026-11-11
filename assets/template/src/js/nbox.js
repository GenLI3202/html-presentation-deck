/* Note boxes: <textarea class="nbox" data-nk="key" placeholder="Notes from the meeting…" aria-label="Notes">.
   The speaker types into the slide during the meeting; the text is saved about a second after the last key.
   Where it is kept: the Artifact database (collection "notes", one document per box) when the page has the db
   capability; otherwise this browser (localStorage, one entry per deck title); otherwise only until the page closes.
   Keys and clicks inside a box never reach the deck, so typing a space or an arrow does not change the slide. */
(function () {
  "use strict";
  var boxes = Array.prototype.slice.call(document.querySelectorAll("textarea.nbox"));
  if (!boxes.length) return;
  var tr = function (s) { return window.t ? window.t(s) : s; };
  var TITLE = (window.DECK_CONFIG && window.DECK_CONFIG.title) || document.title;
  var LS = "deck-notes:" + TITLE, db = null, timers = {}, local = {};
  try { local = JSON.parse(localStorage.getItem(LS) || "{}") || {}; } catch (e) { local = {}; }
  function status(b, txt) { var s = b.parentNode.querySelector(".nbox-s"); if (s) s.textContent = tr(txt); }
  function save(b) {
    var k = b.dataset.nk, v = b.value, kept = true;
    local[k] = v;
    try { localStorage.setItem(LS, JSON.stringify(local)); } catch (e) { kept = false; }
    if (!db) { status(b, kept ? "saved in this browser" : "not saved · copy the text before you close the page"); return; }
    status(b, "saving…");
    db.collection("notes").doc(k).set({ k: k, text: v, at: new Date().toISOString() })
      .then(function () { status(b, "saved online"); })
      .catch(function () { status(b, kept ? "not saved online · kept in this browser" : "not saved · copy the text before you close the page"); });
  }
  boxes.forEach(function (b) {
    var s = document.createElement("span"); s.className = "nbox-s"; s.setAttribute("aria-live", "polite");
    b.insertAdjacentElement("afterend", s);
    if (local[b.dataset.nk]) b.value = local[b.dataset.nk];
    b.addEventListener("input", function () {
      clearTimeout(timers[b.dataset.nk]); status(b, "…");
      timers[b.dataset.nk] = setTimeout(function () { save(b); }, 700);
    });
    ["keydown", "keyup", "keypress", "click", "pointerdown", "contextmenu"].forEach(function (ev) {
      b.addEventListener(ev, function (e) { e.stopPropagation(); });
    });
  });
  if (window.claude && typeof window.claude.use === "function") {
    window.claude.use("db").then(function (d) {
      if (!d) return;
      db = d;
      return d.collection("notes").get().then(function (snap) {
        var docs = (snap && (snap.docs || snap)) || [];
        Array.prototype.forEach.call(docs, function (doc) {
          var data = typeof doc.data === "function" ? doc.data() : doc, id = (data && data.k) || doc.id;
          boxes.forEach(function (b) {
            if (b.dataset.nk === id && data && typeof data.text === "string" && document.activeElement !== b) { b.value = data.text; status(b, "saved online"); }
          });
        });
      });
    }).catch(function () { /* no database in this view: the browser copy stays in use */ });
  }
})();
