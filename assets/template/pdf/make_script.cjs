/* Export the speaker script: one A4 page per slide (Say, Points, End with, Limits, Sources). No reference figures.
   Writes <script.file>.pdf and the same content as <script.file>.html (deck.config.json "script").
   Run:  NODE_PATH=<dir with puppeteer-core> node pdf/make_script.cjs        (no server needed)
   Set DECK_LANG=zh for the script in another language of the deck: the files get the suffix -zh. */
const puppeteer = require("puppeteer-core");
const fs = require("fs"), path = require("path"), url = require("url");

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DECK = path.resolve(__dirname, "..");
const CFG = JSON.parse(fs.readFileSync(path.join(DECK, "deck.config.json"), "utf8"));
const LANG = process.env.DECK_LANG || "";
const BASE = path.join(DECK, ((CFG.script && CFG.script.file) || "Deck-script") + (LANG ? "-" + LANG : ""));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  try {
    const pg = await browser.newPage();
    await pg.goto(url.pathToFileURL(path.join(DECK, "preview.html")).href + (LANG ? "?lang=" + encodeURIComponent(LANG) : ""), { waitUntil: "load" });
    await pg.waitForFunction(() => window.NOTES && window.__deck, { timeout: 20000 });
    await pg.addScriptTag({ path: path.join(__dirname, "script.js") });
    await pg.waitForFunction(() => window.__scriptReady === true && document.fonts.status === "loaded", { timeout: 20000 });
    fs.writeFileSync(BASE + ".html", await pg.content());
    await pg.pdf({ path: BASE + ".pdf", format: "A4", printBackground: true, preferCSSPageSize: true });
    const pages = await pg.evaluate(() => document.querySelectorAll(".pg").length);
    console.log("script", pages, "sections ->", BASE + ".pdf", (fs.statSync(BASE + ".pdf").size / 1e6).toFixed(2), "MB");
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
