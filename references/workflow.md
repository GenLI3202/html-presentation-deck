# Workflow in detail

Each step ends with a gate. At a gate, send a short list (what, why, options) and wait. Do not build past a gate.

## 0 · Materials

Ask:
- Where are the existing outputs? (insight reports, research HTML pages, figures, data, earlier decks)
- Which of them does this talk use? Which are out of scope?
- May I copy the selected files into one folder, `<deck>/materials/`, and work only from there? This keeps the work
  focused on the key material. Interactive pages that the deck embeds go to `<deck>/embed/` instead.

Then read every selected file in full. Fill `materials/INDEX.md`: file, origin path, kind, slides it feeds,
evidence level, note. Mark company numbers as claims (`m`). Mark your own conclusions as inference (`i`).
Flag conflicts between sources to the user instead of choosing silently.

Ask also: audience, what they know, the decision or belief the talk should produce, total minutes, speaker name,
date, language (default English with STE), and whether the user has terms to keep consistent.

Say once, early: when the talk needs little interaction, a native slide deck (the Slides Artifact type, which also
downloads as .pptx) is faster. This skill pays off when the talk embeds interactive pages, live figures or
reference figures. When the final file must be PowerPoint, polish in HTML first and convert at the end.

## 1 · Storyline

Send one compact proposal:
1. The argument: about three numbered claims, each one sentence.
2. Acts: a name and one line each. The last act is usually "our work" and carries the accent colour.
3. The slide list: number, act, working title, the material it uses, minutes. The minutes add up to the budget.

Rules: one message per slide; titles state the finding, not the topic; a hinge slide connects the world to our
work; each interactive page appears where it proves a claim. Ask the user to approve or change the structure.

For a technology or product-positioning talk, check the storyline against three directions plus feasibility:
- horizontal: competitors and other solutions today;
- vertical: history and future (generations, horizons, standards that are coming);
- lateral: other industries with the same problem, and what they learned;
- feasibility: what it takes, the risks, the first step.
Reviewers ask for these; a gap in one of them is the first question in the room.

Plan disclosure in two layers: the slide carries the claim, the key numbers and a hint ("press R"); the reference
figures (R) carry the depth. Plan the reference figures as answers to the questions the audience will ask
(method, assumptions, model validity, data, details), not as spare figures. A slide that tries to show
everything is the most common reason for a crowded deck.

Prefer a picture to words where a picture names a thing faster: icons for industries, assets and actors,
diagrams for flows, charts for numbers. Choose the chart form for the data and the question; no form is the
default (a waterfall explains a sum of causes, a slope or bar pair a before/after, a line a trend).

## 2 · Slide text

Propose text before any HTML, act by act. Per slide: title, sub (optional), body points, take (optional),
footer sources with evidence tags. Use the ASD-STE100 rules in writing.md. Short phrases, one idea each.
Implement only after the user says "ok" (they often reply "ok, change …"; apply the changes, then build).

## 2b · Second language (only when asked)

Ask early (step 0) whether the talk needs a language switch, for example English and Chinese. If yes:
create the deck with `--translate zh`, write the source language first, and translate only after the source text
is approved. Send the term list first (gate). Then follow languages.md. Translate the notes too.

## 3 · Build

1. `python3 $SK/scripts/init_deck.py <deck> --title "…"` (add `--project-root` for the Browser preview config).
2. Copy embed pages into `embed/` and register each in `deck.config.json` `embeds` (embeds.md). Ask whether the
   embedded pages should take the deck style: it looks better, but rebuilding a page costs time and tokens.
3. Write `src/slides.html` from the approved text. Start from the starter patterns (deck-anatomy.md); the block
   layout (numbered blocks, point-stating headings, dividers, story tracker) is the default for content slides.
   Delete starter slides you do not use; keep `notes.js` in step.
4. Figures: inline SVG on the slide for main figures; `figs_gen.py` for backup figures. Follow the diagram rules
   in notes-figures.md. Mark synthetic or schematic figures as such on the slide.
5. Deck-specific JavaScript (charts, a live model) goes to `src/js/<name>.js` and into `scripts` in the config.
   Deck-specific CSS goes to `src/css/custom.css` with slide-prefixed classes.
6. `python3 src/build.py`, then `check_deck.cjs`. Fix every issue before you show the deck.

## 4 · Notes and sources

Write `notes.js`: one entry per slide (notes-figures.md). Say = the opening line. Points = what to say and what to
click. End with = the bridge to the next slide. Limits = what the slide does not prove, tagged. Sources = keys into
the source table, with working URLs. Check the URLs (`curl -sI`); report 403s as "probably a bot block".
For a light fact check (numbers, titles, dates, URLs), a subagent on a smaller, cheaper model is enough.

## 5 · Motion (gate)

Motion supports the argument; it is not decoration. For each candidate slide, name its content situation and
the matching effect from the table in motion.md (overview → parts: morph + strip; options: spotlight; backup:
zoom detail; part of a picture: gentle zoom; process: builds; new numbers: morph; new act: fade). Give the user
the gallery path (`assets/gallery/preview.html`) so they can try each effect. Live figures stay for points that
dragging proves. Do not propose the camera tour; it can make people dizzy.
Suggest about three slides first, as a sample. Roll out further only when the user asks.
Add click cues to the notes of every slide with motion ("Clicks: press → three times …").

## 6 · Verify

- `check_deck.cjs` must report no issues. Look at `contact.png` yourself, and at the key slides at full size
  (`--slides 3,6`). Read the "align" notes: cards side by side whose numbers or bands sit at different heights.
- Click through: every build step, every zoom (open, Esc, `data-goto`), the tour forwards and backwards,
  the presenter window (P), the reference figures (R), full screen (F), overview (O).
- Open `preview.html` from disk with the network off once (the checker does this).
- Read the notes panel on each slide once. Check the evidence tags against the footer.

## 7 · Deliver (gate)

`preview.html` is always delivered: one file, works offline, double-click to play. Then ask, in one message:
- Publish to a claude.ai Artifact (private link, same URL for updates)?
- Make a PDF handout? (Then step 8.)
- Export a speaker script (A4, one page per slide)?
Tell the user how to present: deck full screen on the projector (F), presenter window on the laptop (P).
Tell them they can fix wording themselves with E (delivery.md, "Editing text in place"), and how the edits come back.
For a bilingual deck, tell them about L and `?lang=zh`, and that an edit in one language never changes the other.

## 8 · PDF handout (gate)

Read pdf-storyboard.md. Send the contents list first: which slides print as they are, which interactive slides
get a snapshot, which get supplement pages and with which states, whether zoom details become pages, whether
the reference-figure appendix and a "how to read" page are wanted. Build only the approved list. Then look at
every page (render with `pdftoppm -r 30`) and check that no page names Claude.
