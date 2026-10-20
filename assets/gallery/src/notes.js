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
  const T = {};
  const F = {};

  const N = [
    /* 1 · Title */
    { say: "This deck shows calm transitions. Each one fits one kind of content.", cue: ["Press \u2192 to go through the seven situations."], land: "", limits: [], src: [], figs: [] },
    /* 2 · Index */
    { say: "Pick the effect from the content. The table gives the match.", cue: ["Read the seven rows. The slides follow in the same order."], land: "", limits: [], src: [], figs: [] },
    /* 3 · Overview */
    { say: "An overview with three parts. Each part gets its own slide.", cue: ["Press \u2192. The Q1 card turns into the header of the next slide. Nothing else moves."], land: "Use this when an overview leads to one slide per part.", limits: [], src: [], figs: [] },
    /* 4 · Q1 */
    { say: "The strip at the top shows the part we are in.", cue: ["Press \u2192. The next part slides in a little. We do not go back to the overview in between."], land: "", limits: [], src: [], figs: [] },
    /* 5 · Q2 */
    { say: "Push is for the next item of a series.", cue: ["The strip marks Q1 as done."], land: "", limits: [], src: [], figs: [] },
    /* 6 · Q3 */
    { say: "The last part.", cue: ["Press \u2192. The Q3 header turns back into its card on the overview. All three show done."], land: "", limits: [], src: [], figs: [] },
    /* 7 · Recap */
    { say: "We go back to the overview once, at the end.", cue: ["All parts carry a done mark. Then the talk goes on."], land: "Back once, never back and forth.", limits: [], src: [], figs: [] },
    /* 8 · Options */
    { say: "Three options side by side. The speaker discusses one at a time.", cue: ["Clicks: press \u2192 three times. Each press lights one option and dims the others. Press \u2192 again for the takeaway."], land: "Use this when the audience must compare, not only read.", limits: [], src: [], figs: [] },
    /* 9 · Option B */
    { say: "A fade takes us to the chosen option.", cue: [], land: "", limits: [], src: [], figs: [] },
    /* 10 · Backup */
    { say: "Details for questions stay hidden until someone asks.", cue: ["Click a card. The detail grows out of it. Esc closes it."], land: "Use this for backup facts, not for the main line.", limits: [], src: [], figs: [] },
    /* 11 · Picture */
    { say: "A picture with one marked part.", cue: ["Press \u2192. The view moves a little toward the PCS and the next slide fades in."], land: "Use this when the next slide is a part of this picture.", limits: [], src: [], figs: [] },
    /* 12 · PCS */
    { say: "The part on its own slide.", cue: ["Press \u2190. The view moves back out to the whole picture."], land: "", limits: [], src: [], figs: [] },
    /* 13 · Process */
    { say: "A process that the speaker explains step by step.", cue: ["Clicks: press \u2192 five times. Each press adds one step. Press \u2192 again for the takeaway."], land: "Use builds when the order of the steps matters.", limits: [], src: [], figs: [] },
    /* 14 · 2024 */
    { say: "The same chart, now with 2024 numbers.", cue: ["Press \u2192. The bars and the values move to the 2030 numbers. The layout stays."], land: "Use this when only the numbers change.", limits: [], src: [], figs: [] },
    /* 15 · 2030 */
    { say: "The 2030 numbers.", cue: ["Press \u2190. The bars move back to 2024."], land: "", limits: [], src: [], figs: [] },
    /* 16 · Divider */
    { say: "A new act starts. A fade is enough.", cue: [], land: "", limits: [], src: [], figs: [] },
    /* 17 · Rules */
    { say: "Five rules for motion in a talk.", cue: ["Read the rules. The test: if someone looks away, they still know where they are."], land: "Pick the calmest effect that still tells the story.", limits: [], src: [], figs: [] }
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
