# Illustrations (optional)

Use an illustration when a slide is all text and a picture can show *who* or *where* before the words do (the
actors of a case, a site, a value chain). Do not use one for data, exact diagrams or icons: draw those
(notes-figures.md).

## Who draws it

The separate skill `codex-imagegen` (Codex CLI, built-in image generation, needs a ChatGPT plan, uses the user's
quota). Offer it in one line at the storyline gate when a slide would gain from a picture.
- Skill installed and `codex features list` shows `image_generation … true`: use it in "called by a skill" mode.
- Otherwise: say that this deck can get illustrations drawn by Codex with a ChatGPT subscription and the
  `codex-imagegen` skill; write the prompt by the same rules (below) and give it to the user to paste into ChatGPT,
  with `<deck>/img/` as the place to save the result.

## What the deck passes to codex-imagegen

1. **Slot:** measure the box the picture will fill on the 1920×1080 stage (for example the free top of a column
   above the longest build text). Its width ÷ height is the image ratio; ask for at least twice its pixel size.
2. **Zones:** list the slide's spotlight steps first; one band or corner per step, so a highlight never cuts
   another group. Name the empty zones that will hold overlays (an arrow, a model box).
3. **Theme:** the deck folder (`style_brief.py --deck <deck>`), so colours and line weight follow this deck's
   tokens. A deck may fix its picture style in `deck.config.json` → `"illustration"`. After a theme change,
   regenerate from the saved prompt with the new style paragraph.
4. **No text in the picture:** labels, lines and arrows are HTML/SVG on top: sharp, editable, translatable.

## Placing and spotlighting

- Files: `<deck>/img/<name>.png` and `<name>.prompt.txt`.
- Markup: a positioned box with the `<img>` and an overlay `<svg viewBox="0 0 W H">` in image pixels for labels,
  lines and frames, using the zone rectangles that codex-imagegen hands back (measure them if it did not).
- Spotlight: per build step, dim the picture with an even-odd mask that leaves that step's rectangles open (one
  step may open several, for example three parties in three places) and frame them in `--accent`; the slide text
  uses `data-spot` with the same step. arch.js shows the one-rectangle version.
- Check with `check_deck.cjs` and step through every build (motion.md).
