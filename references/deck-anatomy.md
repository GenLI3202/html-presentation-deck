# Deck anatomy

## Files

```
<deck>/
  deck.config.json      title, lang, fonts, tokens, embeds, deck scripts, outputs, pdf, script
  src/slides.html       all slides (edit this)
  src/notes.js          notes and sources, one entry per slide (edit this)
  src/figs_gen.py       backup figures → src/figs.html (generated; do not edit figs.html)
  src/css/base.css      house style and components (do not change per deck)
  src/css/chrome.css    toolbar, notes panel, viewer, overview (engine)
  src/css/motion.css    builds, zoom details, camera tour (engine)
  src/css/custom.css    deck-specific styles (edit this)
  src/js/anim.js transition.js tour.js presenter.js deck.js   engine; deck-specific scripts also go to src/js/
  src/build.py offline.py                        build
  src/katex/            KaTeX for figs_gen.tex() (MIT; CSS with inlined fonts, added only when a formula is used)
  src/js/editor.js src/edits.py src/apply_edits.py   in-place text editing and write-back
  src/js/i18n.js src/i18n.py src/i18n/        languages: <lang>.txt, ui_<lang>.json; src/notes_<lang>.js
  embed/                interactive pages the deck embeds
  materials/            the selected source material and INDEX.md (not published)
  pdf/                  make_pdf.cjs print.js print.css make_script.cjs script.js
  vendor/               download cache for fonts and CDN scripts (made by the first build)
  index.html            output: Artifact fragment
  preview.html          output: offline single file
```

## Slide markup

```html
<section class="slide" data-title="Short title for overview and notes" data-act="2 · The grid reacts" data-time="2">
  <div class="kick">Act 2<i>·</i>The grid reacts</div>
  <h2 class="ttl">The title states the finding</h2>
  <p class="sub">Optional context line.</p>
  <div class="body with-take"> … </div>          <!-- with-take when the slide has a .take -->
  <div class="take"><span class="tk-l">Label</span><p>Conclusion with <b>key words</b>.</p></div>
  <div class="src"><b>Sources</b><span>…</span><span class="ev p">Primary</span><span class="ev i">Inference</span></div>
</section>
```

- The first slide has class `on`. `data-time` is minutes; the presenter window and the notes panel use it.
- `.body` fills the space between the title and the footer. Use `margin-bottom` on `.body` (84 px default,
  220 px with `.with-take`) to keep it clear of the callout and footer. Override with an inline style when the
  callout is taller.
- Page numbers are added by the engine. Do not write them.

## Components (base.css)

| Pattern | Classes | Use |
|---|---|---|
| Title slide | `.s-title` `.main h1 span` `.tag` `.who` `.pull` | slide 1 |
| Argument + route | `.argue ol li .n`, `.route .grp(.our) .g-l .act .a-h em .a-d` | slide 2 |
| Embed | `.frame[data-embed]`, `.tabs` | interactive pages |
| Cards | `.card(.flat)`, `.grid2`, `.grid3`, `.fill` | general |
| Break / gap cards | `.bk(.main/.opp) .bk-top .bk-our .tag`, `.brk` number disc, `.zchip` | finding above, our work below |
| Question slides | `.qd .qd-left .qd-right`, `.ly.mot/.mea/.opp .ly-h .ly-c`, `.inf` | Motivation · Measures · Opportunity |
| Chain | `.chain span(.hot) small`, `i` arrows | cause → effect sequences |
| Timeline | `.tline .tl-i(.hot) b` | dates, next steps |
| Columns | `.col h3` | overview items (morph sources) |
| Part header | `.part-head(.opp) b span`, `.done-chip` | the header an overview item morphs into; done marks on a recap |
| Callout | `.take .tk-l p b .tk-s` | the conclusion |
| Footer | `.src b`, `.ev.p/.a/.m/.i/.v/.n` | sources and evidence tags |
| Notes in place | `.gapnote b`, `.pill(.red)`, `.label`, `.num`, `.hl`, `.mut`, `.ste` | details |
| Blocks (default) | `.cols` / `.rows` > `.blk(.our)` > `.blk-k b` + `h3.blk-h`, `.sepT`, `.figcap`; `.story span(.on)` | numbered blocks with dividers; header tracker |
| Key numbers | `.kpis .kpi(.red/.amb) .v small .l` | numbers above a figure |
| Reading help | `ol.readlist li b`, `.insbox b` | "how to read it" beside a figure |
| Insight cards | `.icards article .ic-top .ic-n h3 em ul.ic-why .ic-num(i, small) p .ic-dec b p` | conclusion slide |
| Icons | `.icrow div svg.ico b span`; `figs_gen.icon(name, colour)` | things named by a picture |

Starter slide 4 shows the block layout; starter slide 10 shows the insight cards.
Formulas: `figs_gen.tex([...])` renders KaTeX at build time; build.py adds the KaTeX CSS (fonts inlined) only
when the output uses it. Icons: `figs_gen.ICONS` holds 40×40 line icons; add new ones in the same style.

Type scale on the 1920 stage: title 60, sub 28, body 24–28, small 21, footer 16. Do not go below 16 px.

## Tokens

`base.css` defines `--paper --ink --ink2 --ink3 --rule --tint --tint2 --accent --accent-soft --amber
--amber-soft --ok --ground --d1…--d4 --sans --mono --num`. Put deck colours in `deck.config.json` `tokens`
(for example `"--d1": "#2f67a6"`). Use the domain colours for the domain (compute, power, cooling, grid …);
use the accent only for our work and key messages.

## deck.config.json

```json
{
  "title": "…", "lang": "en", "fonts": "<Google Fonts css2 URL>",
  "tokens": { "--d1": "#2f67a6" },
  "embeds": { "map": { "url": "embed/map_en.html", "scale": 1.25, "css": "…" } },
  "scripts": ["charts.js"],
  "outputs": { "fragment": "index.html", "single": "preview.html" },
  "pdf": { … see pdf-storyboard.md … },
  "script": { "file": "Title-script" }
}
```

`scripts` run after `notes.js` and before the engine, in the order listed. `"languages": ["en", "zh"]` adds the
language switch; the first entry is the source language (languages.md). `"editing": false` removes the text editor.
`slides.html` must be well-formed (close every element): the editor's ids come from a strict parse.

## Keys and controls

← → Space PageUp PageDown Home End move · O overview · N notes panel (same window) · P presenter window ·
E edit text · L language · R first reference figure · F full screen (button shows "Exit full screen") · Esc closes the top layer.
? shows every shortcut. The toolbar (`.dctl`, bottom right) shows while the mouse moves and hides at rest: Overview, Full screen and ⋯ (the other controls fold behind it; the choice is remembered). On a slide with reference figures a red "▣ N reference figures · R" button appears; the presenter window lists them at the top of the notes. Keys pressed inside an embed are forwarded.

## Engine hooks

`window.__deck = { key, show(i, keepHash, mode), slides, mount, current }`; `show(i, false, "start")` enters with
builds at step 0, any other mode shows the slide complete. `window.DeckAnim = { enter, forward, back, zoomed,
zoomClose, step, steps }`. `window.DeckTour = { next, prev, busy, peek }`. `window.DeckPresenter = { open,
update, isOpen }`. Each slide fires `slideshow` on entry and `slidestep` on a build step.
