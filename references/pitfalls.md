# Pitfalls already hit

| Symptom | Cause | Fix |
|---|---|---|
| Slider rows on one slide became fixed to the window corner | Deck class `.ctl` clashed with the engine toolbar class | Engine classes are `.dctl .frame .zl .zd .np- .vw- .pr-`; prefix slide classes (`.s7-…`) |
| Red or white SVG text rendered in ink | A global `svg text{fill:…}` rule overrides every fill attribute | Only `svg{fill:var(--ink)}` as an inherited default |
| A zoom detail looked wrong | Template used `.gap`, a slide class with other styles | Unique class names inside templates |
| Camera tour or animation stuck | rAF does not run in a hidden tab (Browser pane hidden) | `setTimeout` guard that finishes the motion; test by polling `DeckTour.busy()` |
| Old version in the Browser pane | Cache | Add `?v=N` to the URL |
| Synthetic key events did nothing | Listener on window; event did not bubble | `new KeyboardEvent("keydown", {key, bubbles: true})` |
| Embed "blocked" message when opened from disk | Blob iframe from file:// has an opaque origin; the alive check cannot read it | srcdoc on file:// (engine does this) |
| Map without country fills over http | srcdoc page over http: the map worker did not load GeoJSON | Blob URL over http (engine does this) |
| Presenter thumbnails had pale text | Slide text inherits the body colour; the presenter body is light on dark | `.pr-stage{color:var(--ink)}` |
| Content ran under the callout | `.body` too tall | `.body.with-take` or a larger `margin-bottom`; run check_deck |
| Card text overflowed | Fixed heights with `flex:1` | `flex:none` on the text card; let the figure card flex |
| Screenshot of a page looked shifted | Emulated viewport larger than the pane | Use the real pane size, or puppeteer at 1920×1080 |
| Overview figure shows wrong positions | Rects measured on a transformed slide | Measure in stage coordinates: (rect − stage rect) / scale |
| A Claude link appeared in the full-size reference view | The embed page header had a claude.ai link that the slide CSS hid | Clean the embed copy; build.py now stops on any Claude mention |
| 403 on a source URL with curl | Bot blocking | Keep the link; tell the user it opens in a browser |
| ⌘A did nothing in a headless test | Shortcuts do not run editing commands in headless Chrome | Select with a Range in page JavaScript, then type |
| build stopped on "claude" after adding a runtime call | The check also saw the engine's `window.claude.use` | The engine call is exempt; keep every other mention out |
| A translation showed on the wrong line after an element was added | Ids shift; repeated identical text matched the wrong copy | i18n.py maps by fingerprint, nearest free position for duplicates; run `i18n.py fix` |
| Notes file failed to load | A `/* N · Title */` marker written inside a block comment closes it | Never write `*/` inside a comment; the markers stand alone |
| People felt dizzy in the camera tour | Whole-screen zoom of 3–4× plus pans, six flights for three parts | Calm effects (motion.md): morph one element, push, fade; zoom at most 12%; back to the overview once |
| A screenshot showed two slides on top of each other | It was taken during a transition | Call `DeckTransition.finish()` after `show()` before measuring or capturing |
| A data morph looked like a jump | An ease-out curve does most of the change in the first 100 ms | Morph uses ease-in-out over 650 ms and cross-fades each pair |
| Interactive content lost in the PDF | One flattened view | Storyboard: snapshot + supplement pages + detail pages |

Working habits that avoid most of these:
- Build and run `check_deck.cjs` after each batch of changes, not at the end.
- Look at `contact.png` and at single slides at full size; do not trust the code alone.
- In the Browser pane, use `preview_start` with the deck's launch config; the Browser pane is often hidden, so
  prefer `read_page` and JavaScript checks over waiting for animations.
- Change the source (`src/`, `embed/`, config), never the outputs (`index.html`, `preview.html`, `figs.html`).
