# Delivery: offline file, presenter window, Artifact, speaker script

## preview.html (always)

One file with everything inlined: slides, engine, embed pages, latin font subsets, CDN scripts. It plays from
disk with no network: double-click it. Send it to colleagues or copy it to a USB stick. About 0.5–4 MB.

How to present (tell the user):
1. Open `preview.html`. Press F on the projector screen (the button changes to "Exit full screen").
2. Press P. A presenter window opens; move it to the laptop screen.
3. Drive the talk from either window: ← → in the presenter window moves the main deck.

## Presenter window (presenter.js)

- Header: slide number, act and title; this-slide timer against its `data-time` budget; total timer against the
  planned time by the end of this slide; amber near the limit, red over it; Pause, Reset, A− / A+ text size.
- Left: the current view (with the build step, for example "build 3 of 6") and the next view (the next build
  step, the next slide, or the next camera-tour move such as "Pull back, then zoom into part 2").
- Right: Say, Points (click cues first), End with; Limits and sources folded for questions.
- Keys forwarded to the deck: arrows, PageUp/PageDown, Space, Home, End, R, O, Esc.
- It is an `about:blank` pop-up drawn by the main window. Tested from file:// and on the hosted Artifact.
  When a browser blocks pop-ups, the deck shows a hint; N opens the notes panel in the same window instead.
- Thumbnails show embeds as a placeholder box.

## Artifact (ask first)

Publish `index.html` with the Artifact tool; pass embed pages in `files`, for example
`{"embed/map_en.html": "<deck>/embed/map_en.html"}`. For each update, republish to the same URL. When the publish
is refused because a published file changed or was not read, read that file with `action: "read"` and `path`,
compare it with the local copy, then publish again. The Artifact is private until the user shares it.

## Editing text in place (E)

The owner can change words without touching the layout. E or the "Edit text" button toggles edit mode.
- Editable: every element with `data-eid` (build.py stamps titles, text, callouts, footers, zoom details and SVG
  labels in `slides.html`) and the notes in the N panel. Enter commits, Esc undoes the field, paste is plain text.
  SVG labels open a small input. A click on a zoom card edits it; the "Details" chip still opens the zoom.
- Not editable: text drawn by scripts (charts), backup figures from `figs_gen.py`, embed pages. Edit their source.
- In edit mode → and ← move one slide with every build shown; the camera tour is off.
- Turn it off per deck with `"editing": false` in `deck.config.json`.

Where edits go, and how they reach the sources:
- **preview.html (local):** this browser's storage; the bar's "Export" saves `edits.json`.
  Merge: `python3 src/apply_edits.py edits.json` (backup in `.edits-backup/`, then rebuild). The page later drops
  stored edits that are already in the source.
- **Artifact:** publish with `capabilities: {"db": {"rules": [{"path": "edits", "read": "view", "write": "admin"}]}, "user": {}}`.
  Edits are saved to the `edits` collection (one document per element) and every viewer sees them; only the owner
  and editors can write. Merge: read them with ArtifactData `list` on collection `edits`, write the documents to a
  JSON list, run `apply_edits.py`, republish `index.html`, then delete the merged documents with one ArtifactData
  `batch`. Tell the user which edits were skipped (the script lists them) and why.
- After any merge, run `check_deck.cjs`: longer words can overflow a box.
- Bilingual decks: every edit carries the language on screen. Source-language edits go to `slides.html` and
  `notes.js`; others to `src/i18n/<lang>.txt` and `src/notes_<lang>.js`. After an English edit, the script lists
  the Chinese lines to review (languages.md).

## Speaker script (ask first)

`node pdf/make_script.cjs` writes `<name>-script.pdf` and `.html`: A4, one page per slide, with Say, Points,
End with, Limits and Sources. No reference figures, no slide images (offer a thumbnail only if the user asks).
A section that is longer than a page is scaled down to fit (not below 80 %); shorten the notes if that happens.
