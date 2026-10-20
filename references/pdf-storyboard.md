# PDF handout: storyboarding interactive content

A PDF cannot click or drag. Do not flatten an interactive slide into one view and lose the rest. Storyboard it:
show the default state on the slide page, and the key states on supplement pages that follow it.

## Principles

| Live deck | PDF |
|---|---|
| Builds | the slide in its complete state |
| Embed frame | a snapshot of its default state (`frames`) |
| States behind tabs, toggles, sliders, selections | supplement pages after the slide, two large images each, with captions that say which state |
| Zoom details | one page each after the slide; `data-goto` buttons become internal links |
| Live figure (drag, run) | its default state on the slide; a static worked example as a supplement or reference figure |
| Camera tour | nothing extra: the overview and the part slides print in order |
| Reference figures (tpl) | an optional appendix, one page each, labelled with the slides that use them |
| Notes and sources | not in the handout unless the user asks (the speaker script is separate) |

## Gate: the contents list

Before building, send the list and let the user choose, for example:
1. Slides 1–19 in their complete state.
2. Slide 3 map: default view on the slide; supplement with four views (compute share, 2030 share, price, Ireland card).
3. Slide 12: three detail pages.
4. Appendix with 5 reference figures? (yes / no)
5. A "how to read this handout" page after the title? (yes / no)
Never add links to the live deck, Artifact URLs or anything that names Claude.

## Configuration (deck.config.json "pdf")

```json
"pdf": {
  "file": "Title.pdf",
  "loadWait": 1500,
  "captures": [
    { "id": "s3",  "page": "deck", "slide": 3, "wait": 6000, "shot": ".slide.on .frame" },
    { "id": "ex1", "page": "deck", "slide": 7, "steps": [{ "click": "#exRaw" }], "shot": ".slide.on .body" },
    { "id": "mapPrice", "page": "embed/map_en.html", "viewport": [1600, 1000], "steps": [{ "click": "[data-mode=price]", "wait": 2500 }], "shot": "#plate" },
    { "id": "land", "page": "embed/landscape_en.html", "clip": ["#modes", "#matrix"] }
  ],
  "frames": [{ "slide": 3, "selector": ".frame", "shot": "s3", "alt": "Map, default view" }],
  "remove": ["#frB"],
  "hide": [".q3btns"],
  "supplements": [{ "after": 3, "title": "Four views of the live map", "sub": "In the live deck you click the tabs.", "items": [["s3", "Default view."], ["mapPrice", "Industrial price."]] }],
  "zoomPages": true,
  "appendix": true,
  "howTo": { "title": "How to read this handout", "items": ["<b>Slides.</b> …", "<b>Supplement pages.</b> …"], "note": "…" }
}
```

- Captures run in order. Captures in a row with the same `page` share one browser page, so a sequence of
  clicks can walk through states. `steps`: `{click}`, `{eval}`, `{key}`, `{wait}`. Screenshots are at 2× and JPEG.
- `shot` is one element; `clip` is the union of several; neither is the whole viewport.
- Maps and WebGL need a longer `wait` (5–7 s). Set `DUMP=<folder>` to save each capture and look at it.
- `howTo: null` and `appendix: false` switch those pages off.

## Check

`pdfinfo` for the page count; `pdftoppm -r 30 -png` and look at every page; `pdftotext … | grep -ci claude` must be 0.
