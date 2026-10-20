/* Check a built deck: preview.html opened from disk with the network blocked.
   Reports, per slide in its complete state:
     - out:     an element extends past the 1920 × 1080 stage;
     - overlap: body content runs into the .take callout or the .src footer, or the callout into the footer;
     - clipped: a box with overflow hidden or auto has more content than room;
   and for the deck: page errors, console errors, remote requests, notes count, Claude mentions.
   A deck with several languages is checked in each one (Chinese text runs longer or shorter than English);
   text units without a translation are listed as a note, not as an issue.
   Writes contact.png (all slides) into the output folder, and contact-<lang>.png for each other language.
   Run:  NODE_PATH=<dir with puppeteer-core> node check_deck.cjs <deck folder> [output folder]
   Exit code 1 when an issue is found. Set CHROME to the Chrome binary when it is not in the default place. */
const puppeteer = require("puppeteer-core");
const fs = require("fs"), path = require("path"), url = require("url");

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DECK = path.resolve(process.argv[2] || ".");
const OUT = path.resolve(process.argv[3] || DECK);
const FILE = path.join(DECK, "preview.html");
const sleep = ms => new Promise(r => setTimeout(r, ms));

function measure() {
  const slide = document.querySelector("#stage > .slide.on");
  const issues = [];
  const R = e => e.getBoundingClientRect();
  const name = e => e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).join(".") : "");
  const text = e => (e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 50);
  const visible = e => { const r = R(e); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && +cs.opacity !== 0; };
  const all = Array.from(slide.querySelectorAll("*")).filter(e => !e.closest("svg, template, iframe, .zl") || e.tagName.toLowerCase() === "svg");
  for (const e of all) {
    if (!visible(e)) continue;
    const r = R(e);
    if (r.right > 1921 || r.bottom > 1081 || r.left < -1 || r.top < -1) issues.push(["out", name(e), text(e), Math.round(r.right) + "×" + Math.round(r.bottom)]);
  }
  const body = slide.querySelector(":scope > .body"), take = slide.querySelector(":scope > .take"), src = slide.querySelector(":scope > .src");
  const limit = Math.min(take ? R(take).top : 1e9, src ? R(src).top : 1e9);
  if (body) for (const e of body.querySelectorAll("*")) {
    if (e.closest("svg, iframe") && e.tagName.toLowerCase() !== "svg") continue;
    if (!visible(e)) continue;
    if (R(e).bottom > limit + 1) { issues.push(["overlap", name(e), text(e), "bottom " + Math.round(R(e).bottom) + " > " + Math.round(limit)]); break; }
  }
  if (take && src && R(take).bottom > R(src).top + 1) issues.push(["overlap", "take", text(take), "callout runs into the footer"]);
  for (const e of all) {
    if (e.closest(".frame") || !visible(e)) continue;
    const cs = getComputedStyle(e);
    if (!/hidden|auto|scroll|clip/.test(cs.overflow + cs.overflowY)) continue;
    if (e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2) issues.push(["clipped", name(e), text(e), e.scrollHeight + " > " + e.clientHeight]);
  }
  return issues;
}

(async () => {
  if (!fs.existsSync(FILE)) { console.error("No preview.html in " + DECK + ". Run python3 src/build.py first."); process.exit(2); }
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars", "--enable-unsafe-swiftshader"] });
  const problems = [];
  try {
    const pg = await browser.newPage();
    await pg.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    const remote = [], errors = [];
    await pg.setRequestInterception(true);
    pg.on("request", r => { if (/^https?:/.test(r.url())) { remote.push(r.url()); r.abort(); } else r.continue(); });
    pg.on("pageerror", e => errors.push(String(e)));
    pg.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    await pg.goto(url.pathToFileURL(FILE).href + (process.env.DECK_QUERY || ""), { waitUntil: "load" });   // e.g. DECK_QUERY=?lang=zh
    await pg.waitForFunction(() => window.__deck, { timeout: 20000 });
    await pg.evaluate(() => document.fonts.ready);
    await pg.addStyleTag({ content: "#hint,.dctl{display:none!important}" });
    const n = await pg.evaluate(() => window.__deck.slides.length);
    const notes = await pg.evaluate(() => (window.NOTES && window.NOTES.slides.length) || 0);
    if (notes !== n) problems.push(`notes: ${n} slides but ${notes} note entries`);
    const langs = await pg.evaluate(() => (window.I18N && window.I18N.langs) || (window.I18N && window.I18N.lang ? [window.I18N.lang(), window.I18N.lang() === "zh" ? "en" : "zh"] : [""]));
    const source = langs[0];
    const sheets = {}, notesOut = [];
    for (const lang of langs) {
      if (lang) await pg.evaluate(l => window.I18N.apply(l), lang);
      const tag = langs.length > 1 ? "[" + lang + "] " : "";
      const shots = [];
      for (let i = 0; i < n; i++) {
        await pg.evaluate(k => { window.__deck.show(k); if (window.DeckTransition) window.DeckTransition.finish(); }, i);
        const embeds = await pg.evaluate(() => document.querySelectorAll(".slide.on [data-embed]").length);
        await sleep(embeds && lang === source ? 3500 : 400);
        for (const [kind, el, txt, info] of await pg.evaluate(measure)) problems.push(`${tag}slide ${i + 1}: ${kind} ${el} "${txt}" (${info})`);
        shots.push("data:image/jpeg;base64," + Buffer.from(await pg.screenshot({ type: "jpeg", quality: 70 })).toString("base64"));
      }
      sheets[lang === source ? "contact.png" : "contact-" + lang + ".png"] = shots;
      if (lang && lang !== source && await pg.evaluate(() => !!(window.I18N && window.I18N.translated))) {
        const miss = await pg.evaluate(l => {
          const ids = new Set(Array.from(document.querySelectorAll("#stage [data-eid]")).map(e => e.dataset.eid));
          return Array.from(ids).filter(id => !window.I18N.translated(l, id) && /[A-Za-z\u4e00-\u9fff]/.test(window.I18N.getText(window.I18N.source, id) || ""));
        }, lang);
        if (miss.length) notesOut.push(`${lang}: ${miss.length} text units have no translation yet (python3 src/i18n.py todo ${lang}): ${miss.slice(0, 8).join(", ")}${miss.length > 8 ? " …" : ""}`);
      }
    }
    if (langs.length > 1) await pg.evaluate(l => window.I18N.apply(l), source);
    if (remote.length) problems.push("remote requests: " + [...new Set(remote)].slice(0, 5).join(", "));
    errors.forEach(e => problems.push("error: " + e.slice(0, 200)));
    const html = fs.readFileSync(FILE, "utf8");
    const hit = html.replace(/window\.claude\b/g, "window.runtime").match(/claude\.ai|anthropic|\bclaude\b/i);   // the engine's runtime call is exempt
    if (hit) problems.push("Claude mention in preview.html: " + hit[0]);

    /* contact sheets: four slides per row */
    fs.mkdirSync(OUT, { recursive: true });
    for (const [name, shots] of Object.entries(sheets)) {
      const sheet = await browser.newPage();
      const cols = 4, w = 480, h = 270, rows = Math.ceil(shots.length / cols);
      await sheet.setViewport({ width: cols * (w + 12) + 12, height: rows * (h + 34) + 12 });
      await sheet.setContent('<body style="margin:0;padding:6px;background:#222;display:grid;grid-template-columns:repeat(' + cols + ',' + w + 'px);gap:12px 12px;font:14px monospace;color:#ddd">'
        + shots.map((s, i) => '<figure style="margin:0"><img src="' + s + '" width="' + w + '" height="' + h + '" style="display:block"><figcaption>' + (i + 1) + "</figcaption></figure>").join("") + "</body>");
      await sheet.screenshot({ path: path.join(OUT, name), fullPage: true });
      await sheet.close();
    }
    console.log(n + " slides checked" + (langs.length > 1 ? " in " + langs.join(", ") : "") + ". Contact sheets: " + Object.keys(sheets).map(k => path.join(OUT, k)).join(", "));
    notesOut.forEach(x => console.log("note: " + x));
  } finally {
    await browser.close();
  }
  if (problems.length) { console.log(problems.length + " issue(s):\n- " + problems.join("\n- ")); process.exit(1); }
  console.log("No issues.");
})().catch(e => { console.error(e); process.exit(2); });
