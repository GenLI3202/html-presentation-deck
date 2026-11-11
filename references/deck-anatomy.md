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
  src/js/anim.js transition.js tour.js presenter.js nbox.js deck.js   engine; deck-specific scripts also go to src/js/
  src/tex_fill.py       fills <span class="tx" data-tex> on the slides with KaTeX HTML
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
  <div class="take" data-b="1" data-fx="fade"><span class="tk-l">Key point</span><p>Conclusion with <b>key words</b>.</p></div>
  <div class="src"><b>Sources</b><span>…</span><span class="ev p">Primary</span><span class="ev i">Inference</span></div>
</section>
```

- The first slide has class `on`. `data-time` is minutes; the presenter window and the notes panel use it.
- `.body` fills the space between the title and the footer. Use `margin-bottom` on `.body` (84 px default,
  220 px with `.with-take`) to keep it clear of the callout and footer. Override with an inline style when the
  callout is taller.
- Page numbers are added by the engine. Do not write them.
- The take is the last build step of its slide (`data-b` = the number of steps before it + 1, `data-fx="fade"`),
  so the speaker brings it in with one press. Two places: the bottom band (default; `.body.with-take`), or the
  top-right card `class="take tr"` (640 px wide, at the right of the title; no `with-take`). Use `.take.tr` when
  the body needs the full height or the bottom band would cover content. Keep the title short enough that it ends
  left of the card, and start the body below it (a `.sub` line, or `margin-top` on `.body`); check_deck reports
  both. Vary the place over the deck.
- Labels are words a listener understands: "Key point", "Next", "Ask", "Why it is hard". Not "So": in the
  uppercase mono label it reads as "S0".

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
| Callout | `.take(.tr) .tk-l p b .tk-s` | the conclusion; `.tr` = card at the top right |
| Note box | `textarea.nbox[data-nk]` | notes typed into the slide during the meeting (see below) |
| Sentence focus | `.focus-p .sn[data-spot] i`, `.bubs .bub(.hint)[data-at]` | a storyline, one sentence at a time (motion.md) |
| Line walk | `.ln[data-spot]` | rows of a model or a list, framed one at a time (motion.md) |
| Region frame | `.figspot i.fs[data-at]` | one figure, one region at a time (motion.md) |
| Footer | `.src b`, `.ev.p/.a/.m/.i/.v/.n` | sources and evidence tags |
| Notes in place | `.gapnote b`, `.pill(.red)`, `.label`, `.num`, `.hl`, `.mut`, `.ste` | details |
| Blocks (default) | `.cols` / `.rows` > `.blk(.our)` > `.blk-k b` + `h3.blk-h`, `.sepT`, `.figcap`; `.story span(.on)` | numbered blocks with dividers; header tracker |
| Key numbers | `.kpis .kpi(.red/.amb) .v small .l` | numbers above a figure |
| Reading help | `ol.readlist li b`, `.insbox b` | "how to read it" beside a figure |
| Insight cards | `.icards article .ic-top .ic-n h3 em ul.ic-why .ic-num(i, small) p .ic-dec b p` | conclusion slide |
| Icons | `.icrow div svg.ico b span`; `figs_gen.icon(name, colour)` | things named by a picture |

Starter slide 4 shows the block layout; starter slide 10 shows the insight cards.
Formulas: `figs_gen.tex([...])` renders KaTeX at build time; build.py adds the KaTeX CSS (fonts inlined) only
when the output uses it. On a slide, write `<span class="tx" data-tex="x_i \le b">…</span><!--/tx-->` (`tx d`
for display style; keep the closing marker) and run `python3 src/tex_fill.py` before `build.py`: it fills every
such span with the KaTeX HTML and can be run again after each change. Icons: `figs_gen.ICONS` holds 40×40 line icons; add new ones in the same style.

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

## Note boxes (nbox.js)

```html
<h3>Which journal?</h3><p>Background in one or two lines.</p>
<textarea class="nbox" data-nk="p2-journal" placeholder="Notes from the meeting…" aria-label="Notes"></textarea>
```

Use them on slides that end in a question to the room (open points, decisions to take): the speaker clicks the
box and types the answer during the meeting. `data-nk` is the key of the box: unique in the deck, and stable (do
not derive it from the slide number, which changes). The text is saved about a second after the last key and a
status line under the box says where: "saved in this browser" (preview.html: localStorage, per deck title) or
"saved online" (Artifact with the db capability, collection `notes`; delivery.md). Keys and clicks in a box do not
reach the deck. One question per slide with a large box (`flex:1` in a column) works better than six small ones.
The PDF handout prints the box as it is on the build machine (empty, with the placeholder): notes typed in a
browser or saved online are not in it.

## Keys and controls

← → Space PageUp PageDown Home End move · O overview · N notes panel (same window) · P presenter window ·
E edit text · L language · R first reference figure · F full screen (button shows "Exit full screen") · Esc closes the top layer.
? shows every shortcut. The toolbar (`.dctl`, bottom right) shows while the mouse moves and hides at rest: Overview, Full screen and ⋯ (the other controls fold behind it; the choice is remembered). On a slide with reference figures a red "▣ N reference figures · R" button appears; the presenter window lists them at the top of the notes. Keys pressed inside an embed are forwarded.

**Mouse.** A left click on the slide goes to the next build step or slide (same as →). A right click opens the quick menu (next, previous, first, last, reference figures, overview, notes, presenter, full screen, edit text, shortcuts); Shift + right click keeps the browser menu. The click never fires on interactive content: links, buttons, inputs, `[data-zoom]`, `[data-goto]`, `[data-tour-to]`, `.zl`, `.frame` and embed iframes, and it does nothing while text is selected, on the click that clears a selection, at the end of a drag (more than 6 px), while a layer (overview, reference figure, shortcuts, zoom, edit mode) is open, or just after a menu closes. To exclude a custom control, add it to `INTERACTIVE_SEL` in `src/js/deck.js`. The key forwarder inside an embed also forwards the right click (the menu opens at the pointer) and closes the menu on any click in the embed.

## Engine hooks

`window.__deck = { key, show(i, keepHash, mode), slides, mount, current }`; `show(i, false, "start")` enters with
builds at step 0, any other mode shows the slide complete. `window.DeckAnim = { enter, forward, back, zoomed,
zoomClose, step, steps }`. `window.DeckTour = { next, prev, busy, peek }`. `window.DeckPresenter = { open,
update, isOpen }`. Each slide fires `slideshow` on entry and `slidestep` on a build step.
