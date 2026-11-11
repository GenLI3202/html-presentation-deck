# Motion: pick the effect from the content

Motion carries the argument; it is not decoration. The screen stays still and only what changes moves.
Propose the slides and the effects first (gate 5), start with about three, and roll out only when asked.

**Gallery:** `assets/gallery/preview.html` in this skill shows every situation below with fake content
(19 slides). Open it before you propose effects, and send the user its path so they can feel the options.

## Situation → effect

| Content situation | Effect | Markup |
|---|---|---|
| An overview, then one slide per part (questions, work packages) | Morph the item into the part's header; a progress strip on the part slides; push between parts; morph back **once** into a recap overview with done marks | items `data-morph="q1"…`; part slides `data-strip="g" data-strip-label="Q1"`, header `.part-head data-morph="q1"`; parts after the first `data-enter="push"`; recap slide = the overview again with `.done-chip` |
| Options side by side, discussed one by one | Spotlight: the current option lit, the others dimmed; then fade to the chosen option | options `data-spot="1"…"3"`, the take `data-b="4"`; next slide `data-enter="fade"` |
| A card with backup detail for questions | Expand in place (zoom detail) | `data-zoom="tplId"` + `<template id>` |
| One part of a picture gets its own slide | Gentle zoom: the picture grows 12% around the part and fades; ← reverses | the part `data-focus` on the picture slide; the detail slide `data-enter="zoom"` |
| A storyline of four or five sentences that carries the motivation | Sentence focus: all sentences stay on screen; each press lights one and opens its detail (facts, a quote, a picture of the source) in a bubble beside it | sentences `.sn data-spot="n"`; bubbles `.bub data-at="n"`; take `.take.tr data-b="last"` |
| An optimization model or a list where each row needs a reason | Line walk: the full model stays; each press frames one row and shows why it is there | rows `.ln data-spot="n"`; reasons `data-at="n"` |
| One figure (architecture, control loop) explained in an order | Region frame: the figure stays; a frame moves from region to region and the text beside it changes | `.figspot` > figure + `i.fs data-at="n"`; texts `data-at="n"` |
| A process the speaker explains step by step | Builds, one step per press | `data-b="n" data-fx="left"`, `class="stagger"` |
| The same chart with new numbers (year, scenario, case) | Morph: bars, values and labels move and cross-fade to the new values; the layout stays | the same `data-morph` keys on both slides, same layout |
| A new act or topic starts | Fade | `data-enter="fade"` |
| Everything else | No transition | nothing |

Not in the gallery: the **camera tour** (tour.js, `data-tour` / `data-tour-to`). It moves the whole screen,
zooms 3–4×, and flies back and forth; people report dizziness. Use it only when the user asks for it.

## Slide transitions (transition.js)

- They run only between neighbouring slides (→, ←). Jumps (overview, Home, End, links), edit mode, the camera
  tour and `prefers-reduced-motion` switch at once.
- The transition belongs to the boundary: forwards it is the incoming slide's `data-enter`, backwards the
  outgoing one's, so ← plays the same boundary in reverse.
- Without `data-enter`, two neighbouring slides that share `data-morph` keys morph; otherwise no transition.
  `data-enter="none"` turns a boundary off.
- Timing: fade 420 ms, push 460 ms, zoom 560 ms, morph 650 ms. The old slide is gone by about 40% and the new one
  appears from about a third, so there is little double image.
- Morph: each pair travels together; the old element fades out on the way and the new one fades in, so a colour
  or shape change is a cross-fade, never a jump. When the shape changes a lot (a card becomes a wide band), the
  content of both is hidden on the way, so stretched text is never seen. Pair self-contained boxes: cards, bands,
  bars, value labels, a title.

## Builds and spotlight (anim.js)

```html
<div class="card" data-b="1" data-fx="left">…</div>      <!-- visible from step 1 -->
<div class="card" data-spot="2">…</div>                   <!-- always visible; lit at step 2, others dimmed -->
<div class="take" data-b="4" data-fx="push">…</div>
```

- `data-fx`: `up` (default), `left`, `right`, `push`, `zoom`, `fade`. Stagger with `style="--d:.12s"`;
  `class="stagger"` makes the children of a build enter one after another.
- Spotlight: put a last build (usually the take) after the last spot, so the complete slide (jump, print, PDF)
  shows nothing dimmed.
- The take is the last step on every slide that has one (`data-b="1"` when the slide has no other build).
- The slide gets `st-1 … st-k` as steps pass (CSS can animate pseudo-elements) and fires `slidestep`.
- → shows the next step before it changes slide. Forward entry starts at step 0; back or jump shows it complete.

## Panels, sentence focus, line walk, region frame (anim.js)

`data-at="n"` shows an element only at step n; `data-at="0"` shows it before the first step (a hint such as
"Press →"). The panel with the highest n stays on the complete slide. Three patterns use it with `data-spot`:

```html
<!-- sentence focus: left the storyline, right one bubble per sentence -->
<p class="focus-p">
  <span class="sn" data-spot="1"><i>1</i>First sentence of the storyline.</span>
  <span class="sn" data-spot="2"><i>2</i>Second sentence.</span>
</p>
<div class="bubs">
  <div class="bub hint" data-at="0">Press →: one sentence after the other.</div>
  <div class="bub" data-at="1" style="--ay:30px">Detail of sentence 1: facts, a quote, a picture of the source.</div>
  <div class="bub" data-at="2" style="--ay:120px">…</div>
</div>
<div class="take tr" data-b="3" data-fx="fade">…</div>

<!-- region frame: positions in % of the figure box -->
<div class="figspot"><svg>…</svg>
  <i class="fs" data-at="1" style="left:4%;top:12%;width:28%;height:35%"></i>
  <i class="fs" data-at="2" style="left:36%;top:12%;width:28%;height:35%"></i>
</div>
```

- Sentence focus: write the storyline first (four or five sentences: context, problem, rule or duty, gap, our
  work) and agree on it with the user; the bubbles come after. `--ay` is the distance from the top of the bubble
  column to the arrow; set it to the height of the sentence (check on the full-size shot). `.bubs` needs a height
  (a grid cell or `flex:1`).
- When a bubble quotes a source (a law, a standard), quote the words exactly, with the article number, and say in
  the bubble when a word is weaker than people assume. A card set in the style of the source is not a screenshot:
  do not call it one.
- Line walk: put `class="ln" data-spot="n"` on each row; the lit row gets a frame, the others fade, nothing moves.
  Show a repeated element (a matrix, a legend) once, not on both sides of a before/after.
- Region frame: the frame dims the rest of the figure to 28%. A frame does not stay on the complete slide when a
  later step exists, so end with the take (`data-b` = last frame + 1).
- The complete slide (jump, edit mode E, PDF) shows the last panel only. Earlier panels are changed in
  `slides.html`, and they are not in the PDF handout: when their content matters there, put it in the notes or on
  a supplement page (pdf-storyboard.md).
- All three keep every element in place. They count as one motion slide each in the "three to five" rule.

## Progress strip (anim.js)

Slides with the same `data-strip="group"` get a strip at the top right: done items ✓, the current one red,
the next ones plain. Labels: `data-strip-label` or the slide's `data-title`. Bilingual decks list the labels in
`i18n.py todo`.

## Zoom details (anim.js)

```html
<div class="bk" data-zoom="z-gap1"><span class="zchip" aria-hidden="true">Details ⤢</span> …</div>
<template id="z-gap1"><div class="zd"> … <button class="zgo" data-goto="7">Go to Q1 →</button></div></template>
```

A click grows the template into a card (1560 × 860). Esc, a click outside or any navigation key closes it.
Layout classes: `.zd .zd-h .zd-g (.miss/.our/.our.opp) .zt .zd-f .zgo`. In the PDF each detail is a page.

## Live figures

Deck-specific JavaScript in `src/js/<name>.js` (listed in `scripts`): draw into an SVG; drag with pointer
events and `getScreenCTM()` (the stage is scaled); buttons with `data-*`; listen to `slidestep` to run at a step;
keep the geometry of any static version. Hide its buttons in print with `pdf.hide`.

## Rules

- Keep the screen still; move only what changes. Never zoom more than about 12% across the whole screen.
- Do not go back and forth between an overview and its parts: go back once, at the end.
- Motion on three to five slides of a talk, not on every slide.
- The test: if someone looks away, they must still know where they are.
- Animations finish by timers, not rAF (a hidden tab stops rAF). Tests and screenshots call
  `DeckTransition.finish()` after `show()`; check_deck.cjs and make_pdf.cjs do.
