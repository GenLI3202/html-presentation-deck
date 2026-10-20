/* Notes and sources, one entry per slide in slide order. Mark each entry with a comment of the form  N · Title  (build.py counts them).
   Writing rules: ASD-STE100. Short sentences (max 20 words). Active voice. One idea per sentence. Plain text only.
   Entry: say = opening line, cue = points and click cues, land = closing line, limits = [tag, text],
          src = keys of T, figs = keys of F.
   Click cues: start the first cue with "Clicks: …" on a slide with builds, zoom details or a tour.
   Figure kinds: tpl (hidden <template id>, made by figs_gen.py), clone (copy of a figure on the slide),
                 embed (full-size interactive page; the key must be in deck.config.json "embeds"). */
(function () {
  "use strict";

  /* Evidence tags: same codes as the .ev chips in the slide footers. n = internal document. */
  const TAG = { p: "Primary", a: "Academic", m: "Media / claim", i: "Inference", v: "To verify", n: "Internal" };

  /* Sources: key -> [tag, title, publisher and date, url]. No url = no public link. Check each url before use. */
  const T = {
    srcA: ["p", "Title of a primary document", "Publisher · 2026", "https://example.org/a"],
    srcB: ["a", "Title of a paper", "Authors · venue 2026", "https://example.org/b"],
    internal: ["n", "Team report, section 3", "Internal · 2026"]
  };

  /* Reference figures: key -> { k: kind, n: name, d: one-line description, plus t (template id), s + i (selector
     and index of the on-slide figure to clone) or e (embed key). */
  const F = {
    detail: { k: "tpl", t: "fig-example", n: "Example reference figure", d: "A backup figure for questions" },
    full: { k: "embed", e: "examplefull", n: "Example page, full screen", d: "The interactive page as published" }
  };

  const N = [
    /* 1 · Title */
    { say: "Open with the one sentence the audience must remember.", cue: [], land: "", limits: [], src: [], figs: [] },
    /* 2 · Argument */
    {
      say: "This is the argument in three steps.",
      cue: ["Read the three claims. Then show the route: three acts.", "Explain the evidence tags in the footer."],
      land: "Keep the main line in mind.",
      limits: [], src: [], figs: []
    },
    /* 3 · Embedded page */
    {
      say: "Start with the finding. Then show it on the page.",
      cue: ["Move the slider. The red bars show the load that the grid sees."],
      land: "",
      limits: [["i", "The chart is a synthetic example."]],
      src: ["srcA"], figs: ["full"]
    },
    /* 4 · Rules */
    {
      say: "Three rules, one result each.",
      cue: ["Clicks: press → three times. Each press shows one rule. Press → again for the takeaway."],
      land: "The three rules ask for the same capability.",
      limits: [["i", "The result column is my inference."]],
      src: ["srcA"], figs: ["detail"]
    },
    /* 5 · Gaps */
    {
      say: "The public work stops in two places.",
      cue: ["Click a card to open its detail. Esc closes it. The button jumps to the matching question."],
      land: "Our work targets both gaps.",
      limits: [["i", "“Gap” means: not found in the sources searched."]],
      src: ["srcB"], figs: []
    },
    /* 6 · Questions */
    {
      say: "Two questions follow from the gaps.",
      cue: ["Press →. The Q1 card turns into the header of the next slide. Q1 → Q2 slides in; the strip shows where we are."],
      land: "", limits: [], src: [], figs: []
    },
    /* 7 · Q1 */
    {
      say: "Q1 in one sentence.",
      cue: ["Clicks: press → three times: motivation, measures, opportunity."],
      land: "", limits: [], src: ["internal"], figs: []
    },
    /* 8 · Q2 */
    { say: "Q2 in one sentence.", cue: ["Clicks: press → once. The chain enters from left to right."], land: "", limits: [], src: [], figs: [] },
    /* 9 · Next steps */
    {
      say: "Close with the ask.",
      cue: ["Read the timeline from left to right. Stop at the key milestone."],
      land: "One clear request to the room.",
      limits: [["v", "Check all dates before external use."]],
      src: [], figs: []
    }
  ];

  /* Resolve keys once, so the deck code reads plain objects. An unknown key is an error. */
  const out = N.map(function (n) {
    return {
      say: n.say, cue: n.cue || [], land: n.land || "", limits: n.limits || [],
      src: (n.src || []).map(function (k) { const s = T[k]; if (!s) throw new Error("Unknown source " + k); return { tag: s[0], title: s[1], meta: s[2], url: s[3] || "" }; }),
      figs: (n.figs || []).map(function (k) { const f = F[k]; if (!f) throw new Error("Unknown figure " + k); return Object.assign({ key: k }, f); })
    };
  });

  /* Other languages (src/notes_<lang>.js sets window.NOTES_TR[lang]): same slide order; say, cue, land, the limit
     texts, tag names and figure names. Sources keep their original titles. A missing field falls back to the source.
     Every language gets its own arrays, so an edit in one language cannot change another. */
  const langs = {};
  const tr = window.NOTES_TR || {};
  Object.keys(tr).forEach(function (lang) {
    const Z = tr[lang] || {};
    langs[lang] = {
      tags: Object.assign({}, TAG, Z.tags || {}),
      slides: out.map(function (o, i) {
        const z = (Z.slides || [])[i] || {};
        return Object.assign({}, o, {
          say: z.say != null ? z.say : o.say,
          cue: o.cue.map(function (c, k) { return (z.cue || [])[k] != null ? z.cue[k] : c; }),
          land: z.land != null ? z.land : o.land,
          limits: o.limits.map(function (l, k) { return [l[0], (z.limits || [])[k] != null ? z.limits[k] : l[1]]; }),
          figs: o.figs.map(function (f) { const t = (Z.figs || {})[f.key]; return t ? Object.assign({}, f, { n: t[0], d: t[1] }) : f; })
        });
      })
    };
  });
  const SRC = (window.I18N_DATA && window.I18N_DATA.source) || "en";
  langs[SRC] = { slides: out, tags: TAG };
  window.NOTES = { slides: out, tags: TAG, langs: langs };
})();
