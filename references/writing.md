# Writing rules

## ASD-STE100 for slide text and notes (English)

- One idea per sentence. Max 20 words per sentence in notes, fewer on slides.
- Active voice. Present tense for facts. Imperative for instructions ("Press →", "Read the verbs").
- No contractions. No idioms. No "may" for possibility: use "can". No "should" for advice to the audience.
- One word for one meaning, every time. Agree the key terms with the user and keep them (for example
  "compute rack" for the GPU rack and "battery rack" for the rack inside the storage system; never plain "rack").
- Define an abbreviation once; use it the same way after that.
- Numbers with units and a source. Ranges as "60–150 s". Company numbers are claims: tag them `m`.
- Lists: parallel form; each item starts the same way.

## Plain words first

The audience is often a manager and often not a native speaker. Clear beats clever.
- No metaphors, slogans or aphorisms ("the site sets the value, not the algorithm", "the product is a price").
  Write the literal claim: "The site decides the value of EMPC".
- Short phrases beat long sentences. Plain, even spoken words are fine. Long text that sounds detailed but says
  little is the worst case.
- Explain each technical term at its first use, in a few words. The audience is not a peer group.
- Give each absolute number its scale: the case size, or a share ("71 EUR/day = 12% of the saving on a 12 MW
  campus"). Without it, the number means nothing.
- Design slides use symbols or orders of magnitude (Δt, H; 15 min, 1 h, 24–48 h), not the parameters of one case.

## Slide text

- Title = the finding, in one line, ideally under 70 characters. Not "Market overview" but
  "Compute is moving. Grid connection is the bottleneck."
- Sub = context or the question, one sentence.
- Body = short phrases, not paragraphs. Bold the key word, not whole sentences.
- Blocks: each block has a heading that states its point (deck-anatomy.md, "Blocks").
- Every figure and table has a one-sentence caption (`.figcap`). Axes say what the value is a share of, the unit,
  and where 100% is.
- The conclusion slide gives insights, not a summary. An insight is a plain claim that changes what we do; test:
  would the audience act differently after it? Pattern: insight → the number behind it → our decision
  (insight cards). Mark one key word per insight in red; keep the decision band as the strong red element.
- Take = the conclusion, one sentence, key words in `<b>` (red). Optional `tk-s` line for a consequence.
- Footer `.src` = small-print sources, then the evidence tags that apply. Keep it on every content slide.
- Our work and key messages use the accent colour. Opportunity uses amber. Do not use more than two accent
  groups on one slide.
- Internal names and code names are allowed when the audience knows them.

## Notes text

- Say: what the speaker says first, one or two sentences.
- Points: the order of explanation; click cues first ("Clicks: press → five times. Each press shows …").
- End with: one sentence that bridges to the next slide.
- Limits: what the slide does not prove, each with a tag (`i` inference, `v` to verify, `m` claim).
- Keep notes short. They are a prompt for the speaker, not a script to read.

## Translating a deck (languages.md)

- Translate meaning, not words; keep each line about as long as the source, or shorter, because the layout is fixed.
- Keep the inline markup, numbers, units, names and evidence tags of the source line.
- Use the agreed term list for every line. Keep source titles in their original language.

## Chinese decks (lang zh)

- 一句一意，句子短（建议不超过 25 字）；主动句；不用口语和成语。
- 术语与用户约定后全篇统一；中英混排时英文术语首次出现给中文释义。
- 标题写结论，不写主题；数字带单位和来源；公司口径标注为“公司声明”。
- 字体：正文用系统中文字体（PingFang SC / Microsoft YaHei），只内联拉丁字体子集。
