# Languages: one deck, a language switch (L)

A deck can show its text in more than one language. The audience sees one language at a time; L, the language
button or `?lang=zh` switches it. Use it when the same talk goes to two audiences (for example an English group
talk and a Chinese management review), not as a side-by-side bilingual slide.

## Set-up

- `deck.config.json`: `"languages": ["en", "zh"]`. The first is the **source**: `slides.html` and `notes.js`.
- New deck: `init_deck.py <deck> --title "…" --translate zh` creates `src/i18n/zh.txt` and `src/notes_zh.js`.
- Engine strings (buttons, notes panel, presenter window, editor bar, PDF labels) come from
  `src/i18n/ui_zh.json` in the template. Do not translate them per deck.
- Fonts: Latin subsets are inlined; Chinese uses the system fonts (PingFang SC, Microsoft YaHei). The template's
  `--sans` stack already lists them.

## What gets translated where

| Text | Where the translation lives |
|---|---|
| Slide text (every element with an editor id: titles, text, callouts, footers, zoom details, SVG labels) | `src/i18n/zh.txt`: `s3-2|9f1c2a|||中文` |
| Slide titles and acts (`data-title`, `data-act`: overview, notes, presenter, PDF) | `zh.txt` free strings: `=English|||中文` |
| Text that scripts draw (charts, live figures, explorers) | `zh.txt` free strings, or patterns for numbers: `~^(\d+) min$|||$1 分钟` |
| PDF handout strings in `deck.config.json` (supplement titles, captions, how-to page) | `zh.txt` free strings |
| Notes: say, cue, land, limit texts, tag names, figure names | `src/notes_zh.js` (`window.NOTES_TR.zh`), same order and `/* N · Title */` markers as `notes.js` |
| Source titles in the notes | not translated: keep the original title |
| Embedded pages | not translated: they show as published. For a Chinese page, register a second embed key with the Chinese copy and use it on purpose |

## Workflow

1. Agree the term list with the user first (gate): every domain term, abbreviation and code name, with its
   translation or "keep in English". Use it for every line.
2. `python3 src/i18n.py todo zh` writes `src/i18n/todo_zh.txt`: each line to fill shows the source with its
   markup (`# en: Main title<br><span>key phrase</span>`) and an empty slot `s1-2|d0c310|||`.
   Keep the inline markup (`<b>`, `<span class="hl">`, `<i class="inf">`, `<br>`). Keep numbers, units and names.
3. `python3 src/i18n.py merge src/i18n/todo_zh.txt`, then fill `src/notes_zh.js` (empty entries are created).
4. Build, then `check_deck.cjs`: it checks every language and writes `contact-zh.png`; Chinese is shorter or
   longer than English, so look for overflow in both. Its note lists units without a translation.
5. Show the user the Chinese deck (`preview.html?lang=zh`) and its contact sheet.

## Why editing and translation never collide

Every translation is keyed by the editor's element id, plus a fingerprint of the source text at translation time.

| What happens | Result |
|---|---|
| Edit a Chinese line in the page (E in Chinese) | Only `zh.txt` changes; it is marked reviewed |
| Edit an English line in the page (E in English) | Only `slides.html` changes; the Chinese stays and goes on the review list |
| Edit both | Both files change; the Chinese is not on the review list |
| Insert or delete an element (ids shift) | Translations follow their source text by fingerprint; repeated identical text goes to the nearest free position; an edited and shifted line follows its neighbours |
| Source text deleted | Its translation is kept in `zh.txt` under "unplaced", never lost |

Commands: `python3 src/i18n.py status` (coverage, moved, review), `fix` (rewrite `zh.txt` with current ids),
`accept zh <id> …` (mark reviewed lines as current). `build.py` prints the status on every build.

## Exports

`DECK_LANG=zh node pdf/make_pdf.cjs` and `DECK_LANG=zh node pdf/make_script.cjs` write the Chinese handout and
speaker script with the suffix `-zh`. Ask the user which languages they want before building them.
