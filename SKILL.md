---
name: html-presentation-deck
description: >-
  Compile existing research outputs (insight reports, interactive HTML pages, charts, data) into a talk delivered
  as an interactive HTML presentation: a single offline file with a 1920×1080 stage, notes and sources panel,
  presenter window, reference figures, builds and zoom transitions; plus optional claude.ai Artifact, PDF
  handout and speaker script. Use whenever the user wants a presentation, talk, group sharing, PPT, slides,
  report-out or deck built from material they already have, wants an HTML deck changed, or asks for a PDF
  version or speaker notes of such a deck, even if they say "PPT" and do not mention HTML. Not for prose
  documents with no talk to give.
---

# HTML presentation deck

Build a talk from material the user already has. The quality comes from two things: mature source material,
and alignment with the user at fixed gates. This skill supplies the engine, the house style and the workflow;
the user supplies the material and the decisions.

The deck is HTML, not PowerPoint: a fixed 1920×1080 stage, one `<section class="slide">` per slide, built by
`src/build.py` from `src/` and `deck.config.json`. Existing interactive pages are embedded, not rebuilt.

## Ground rules (every time)

1. **Stop at each gate.** List what you plan, wait for the user's choice, then build. Never add pages, appendices,
   links, notes or extra deliverables on your own initiative. When you see a useful extra, offer it in one line.
2. **Nothing about Claude in deliverables.** No claude.ai or Artifact links, no session paths, no "made with" lines.
   `build.py` stops when an output or an embed page names Claude; clean the source, do not bypass the check.
3. **Write in ASD-STE100** (English) for slide text and notes, in plain words: no metaphors or slogans, short
   phrases, each number with its scale. Chinese decks use the concise rules in
   [references/writing.md](references/writing.md). Propose text first; implement after the user says "ok".
4. **Compile, do not research.** Use the selected materials. Light gap research is allowed (a missing source link,
   a number check, an evidence tag). Tell the user about every new claim and tag it.
5. **Reuse interactive pages** as embeds with injected CSS. Do not redraw what already exists.
6. **Conclusions stand out:** the `.take` callout (large type on light red), never a dark bar. The closing slide
   gives insights that change what we do (insight → number → decision), not a summary.
7. **Two layers.** The slide carries the claim, the key numbers and "press R"; reference figures carry the depth.
   Content slides use numbered blocks with point-stating headings and dividers; every figure has a caption.

## Workflow and gates

| Step | What you do | Gate: ask the user |
|---|---|---|
| 0 Materials | Ask where the existing outputs are and which ones to use. Suggest copying the selection into `<deck>/materials/` and fill `materials/INDEX.md`. Say that a native Slides Artifact is faster when little interaction is needed. | Locations, scope, copy into one folder? |
| 1 Storyline | Core argument (about 3 claims) → acts → slide list with minutes per slide and the material per slide. Positioning talks: check horizontal, vertical, lateral views and feasibility. Plan the reference figures. | Approve the structure and the time budget. |
| 2 Slide text | Per slide: title (states the finding), sub, body points, take, footer sources + evidence tags. STE. | "ok" per slide or per act, then implement. |
| 2b Languages | Only when the talk needs a second language: term list first, then translate with `i18n.py todo`. | Approve the term list; review the translated deck. |
| 3 Build | `init_deck.py`, write `slides.html`, configure embeds, draw figures, build, run `check_deck.cjs`. | — |
| 4 Notes | `notes.js`: Say / Points / End with / Limits / Sources / reference figures, in STE. | Review the notes of key slides. |
| 5 Motion | Match each candidate slide to its content situation (motion.md table; show the gallery). Start with about three. | Pick the slides and effects. |
| 6 Verify | Checker, contact sheet, click-through of every build, zoom and tour, presenter window. | — |
| 7 Deliver | `preview.html` (single offline file) always. | Also publish an Artifact? Make a PDF handout? Export a speaker script? |
| 8 PDF | Storyboard the interactive slides into a contents list, then configure `pdf` in the config. | Approve the contents list before building it. |

Details per step: [references/workflow.md](references/workflow.md).

## Commands

Set `SK=~/.claude/skills/html-presentation-deck`. Node scripts need `puppeteer-core` and Chrome:
install once with `npm i --prefix <scratch dir> puppeteer-core@23.11.1`, then run with `NODE_PATH=<scratch dir>/node_modules`.

```bash
python3 $SK/scripts/init_deck.py <deck folder> --title "Title" [--lang zh] [--project-root <repo>]
python3 <deck>/src/figs_gen.py                 # after changing reference figures
python3 <deck>/src/build.py                    # writes index.html (Artifact) and preview.html (offline)
node $SK/scripts/check_deck.cjs <deck> <out> [--slides 3,6]   # overflow, overlap, align, errors, network, Claude mentions, contact.png, full-size shots
node <deck>/pdf/make_pdf.cjs                   # PDF handout from deck.config.json "pdf"
node <deck>/pdf/make_script.cjs                # speaker script, A4, one page per slide
python3 <deck>/src/apply_edits.py edits.json   # merge wording edits made in the page (E), then rebuild
python3 <deck>/src/i18n.py todo zh             # bilingual deck: list what to translate or review (status, merge, fix, accept)
```

Publish the Artifact from `index.html` with the Artifact tool and pass the embed files in `files`
(`{"embed/x.html": "<deck>/embed/x.html"}`). Republish to the same URL for every update. To let the owner edit
wording online, declare the `db` and `user` capabilities on the first publish (delivery.md, "Editing text in place").

## Reference files

- [references/workflow.md](references/workflow.md): each step in detail, with the gate questions.
- [references/writing.md](references/writing.md): ASD-STE100 checklist, slide text rules, Chinese rules.
- [references/deck-anatomy.md](references/deck-anatomy.md): files, slide markup, components, tokens, config, keys.
- [references/embeds.md](references/embeds.md): reusing interactive pages; CSS injection; offline inlining.
- [references/notes-figures.md](references/notes-figures.md): notes.js schema, sources, reference figures, diagram rules.
- [references/motion.md](references/motion.md): situation → effect table (morph, push, fade, gentle zoom, spotlight,
  progress strip, builds, zoom details); the gallery deck `assets/gallery/preview.html` shows each one.
- [references/delivery.md](references/delivery.md): presenter window, offline file, Artifact, speaker script.
- [references/pdf-storyboard.md](references/pdf-storyboard.md): how interactive content becomes PDF pages.
- [references/languages.md](references/languages.md): language switch (L): translation files, review, why edits never collide.
- [references/pitfalls.md](references/pitfalls.md): problems already hit and their fixes. Read before debugging.

Reference deck: `assets/gallery/` (17 slides, fake content) shows the motion patterns and the house style.
Read it for patterns; do not copy its content.
