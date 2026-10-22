# Notes, sources and reference figures

## notes.js

One entry per slide, in slide order, each marked with a comment `/* N · Title */` (build.py counts them and warns
on a mismatch; check_deck.cjs fails on one).

```js
const TAG = { p: "Primary", a: "Academic", m: "Media / claim", i: "Inference", v: "To verify", n: "Internal" };
const T = { key: [tag, "Title", "Publisher · date", "https://…"] };     // no URL = no public link
const F = { key: { k: "tpl", t: "fig-id", n: "Name", d: "One line" } };  // see figure kinds below
const N = [
  /* 3 · Pressure */
  { say: "…", cue: ["Clicks: …", "…"], land: "…", limits: [["i", "…"]], src: ["key"], figs: ["key"] },
];
```

An unknown source or figure key throws on load, so a typo shows at once.

The notes panel (N) shows, per slide: number and title, act, minutes and minutes used so far, Say, Points,
End with, Limits, Sources (linked, tagged), Reference figures (buttons). The presenter window (P) shows the same
notes in large type, with Limits and Sources folded.

## Sources

- Each source once in `T`, referenced by key. Title as published, publisher and date in the meta field.
- Check every URL before delivery (`curl -sIL -o /dev/null -w "%{http_code}"`). A 403 is often a bot block;
  say so instead of deleting the source.
- The slide footer carries the short form; the notes carry the full list.

## Reference figures (R key, or the buttons in the notes)

| Kind | Fields | Use |
|---|---|---|
| `tpl` | `t`: template id | a backup figure made by `figs_gen.py` into `src/figs.html` |
| `clone` | `s`: selector, `i`: index | an enlarged copy of a figure already on the slide |
| `embed` | `e`: embed key | the full interactive page (register a full-size key in `embeds`) |

Reference figures are the second layer of the talk: the slide shows the claim and the key numbers, the
reference figures answer the questions (method, assumptions, model validity and sensitivity, data, details,
the full interactive page). Use them generously, and point to them on the slide ("press R"). Agree the list
with the user. Formulas: `tex()` in figs_gen.py (KaTeX at build time, offline). The viewer scales each figure to the screen; arrows step
through the figures of the slide; Esc closes.

## Diagram rules (slide SVGs and figs_gen.py)

- Deck tokens for colour; at most two accent groups (accent red for our work, amber for opportunity).
- Orthogonal connectors (H/V paths). Draw connectors first, then nodes with a white mask rect, so lines never
  cross text.
- Labels keep 6 px or more from lines and boxes. Positions on a 4 px grid.
- A legend strip at the bottom when the figure uses more than one line or fill style.
- `role="img"` with `<title>` and `<desc>` (figs_gen.py `svg_open`). Mark synthetic figures "synthetic" on the slide.
- Set colours with `fill` attributes. The global rule `svg{fill:var(--ink)}` is only a default; never style
  `svg text` globally (it overrides every fill attribute).
- Text in SVG uses `font-family` from the deck (`.m` class for mono). Keep text 16 px or larger on the stage.
