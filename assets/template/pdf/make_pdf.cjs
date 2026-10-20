/* Build the PDF handout (1920 × 1080 pages) from deck.config.json "pdf".
   1. Captures: open a page (the deck or an embed file), run steps, take a screenshot. Captures in a row with the
      same "page" share one browser page, so state carries over (click a tab, capture, click the next tab, …).
      { id, page: "deck" | "embed/x.html", viewport: [w, h], slide: N (deck only), wait: ms,
        steps: [{ click: sel } | { eval: "js" } | { key: "ArrowRight" } | { wait: ms }],
        shot: sel  |  clip: [sel, …] (union of their boxes)  |  neither (the whole viewport) }
   2. Print: load preview.html, inject print.css and print.js, print every page.
   Run:  NODE_PATH=<dir with puppeteer-core> node pdf/make_pdf.cjs        (no server needed)
   Set DUMP=<folder> to also save each capture as a JPEG for checking.
   Set DECK_LANG=zh for a handout in another language of the deck: the file gets the suffix -zh. */
const puppeteer = require("puppeteer-core");
const fs = require("fs"), path = require("path"), url = require("url");

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DECK = path.resolve(__dirname, "..");
const CFG = JSON.parse(fs.readFileSync(path.join(DECK, "deck.config.json"), "utf8"));
const PDF = CFG.pdf || {};
const LANG = process.env.DECK_LANG || "";
const OUT = path.join(DECK, (PDF.file || "Deck.pdf").replace(/\.pdf$/i, "") + (LANG ? "-" + LANG : "") + ".pdf");
const Q = LANG ? "?lang=" + encodeURIComponent(LANG) : "";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fileUrl = p => url.pathToFileURL(path.join(DECK, p)).href;

async function shot(target, opt = {}) {
  const b = await target.screenshot({ type: "jpeg", quality: 90, ...opt });
  return "data:image/jpeg;base64," + Buffer.from(b).toString("base64");
}
async function union(page, sels) {
  return page.evaluate(ss => {
    const r = ss.map(s => { const e = document.querySelector(s); if (!e) throw new Error("clip: no element " + s); return e.getBoundingClientRect(); });
    const x = Math.min(...r.map(a => a.left)), y = Math.min(...r.map(a => a.top));
    return { x, y, width: Math.max(...r.map(a => a.right)) - x, height: Math.max(...r.map(a => a.bottom)) - y };
  }, sels);
}
async function step(page, s) {
  if (s.click) { await page.click(s.click); await sleep(s.wait || 700); }
  else if (s.eval) { await page.evaluate(s.eval); await sleep(s.wait || 700); }
  else if (s.key) { await page.keyboard.press(s.key); await sleep(s.wait || 700); }
  else if (s.wait) await sleep(s.wait);
}

async function captures(browser) {
  const S = {};
  let page = null, open = null;
  for (const c of PDF.captures || []) {
    const where = c.page || "deck";
    if (where !== open) {
      if (page) await page.close();
      page = await browser.newPage();
      const [w, h] = c.viewport || (where === "deck" ? [1920, 1080] : [1600, 1000]);
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
      await page.goto(fileUrl(where === "deck" ? "preview.html" : where) + (where === "deck" ? Q : ""), { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await sleep(PDF.loadWait || 1500);
      open = where;
    }
    if (where === "deck" && c.slide) { await page.evaluate(n => { window.__deck.show(n - 1); if (window.DeckTransition) window.DeckTransition.finish(); }, c.slide); await sleep(600); }
    for (const s of c.steps || []) await step(page, s);
    if (c.wait) await sleep(c.wait);
    try {
      if (c.shot) { const el = await page.$(c.shot); if (!el) throw new Error("no element " + c.shot); S[c.id] = await shot(el); }
      else if (c.clip) S[c.id] = await shot(page, { clip: await union(page, c.clip) });
      else S[c.id] = await shot(page);
    } catch (e) { console.warn("capture " + c.id + " failed: " + e.message); }
  }
  if (page) await page.close();
  return S;
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--hide-scrollbars", "--enable-unsafe-swiftshader"] });
  try {
    const S = await captures(browser);
    if (process.env.DUMP) for (const [k, v] of Object.entries(S)) fs.writeFileSync(path.join(process.env.DUMP, k + ".jpg"), Buffer.from(v.split(",")[1], "base64"));
    const pr = await browser.newPage();
    await pr.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await pr.goto(fileUrl("preview.html") + Q, { waitUntil: "load" });
    await pr.waitForFunction(() => window.__deck, { timeout: 20000 });
    await pr.evaluate(() => document.fonts.ready);
    await sleep(PDF.loadWait || 1500);
    await pr.addStyleTag({ path: path.join(__dirname, "print.css") });
    if (PDF.hide && PDF.hide.length) await pr.addStyleTag({ content: ".printing " + PDF.hide.join(",.printing ") + "{display:none!important}" });
    await pr.evaluate((snaps, cfg) => { window.__SNAPS = snaps; window.__PRINT = cfg; }, S, PDF);
    await pr.addScriptTag({ path: path.join(__dirname, "print.js") });
    await pr.waitForFunction(() => window.__printReady === true, { timeout: 20000 });
    await pr.evaluate(() => Promise.all(Array.from(document.images).map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))));
    const pages = await pr.evaluate(() => document.querySelectorAll("#stage > .slide").length);
    await pr.pdf({ path: OUT, width: "1920px", height: "1080px", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    console.log("pages", pages, "->", OUT, (fs.statSync(OUT).size / 1e6).toFixed(1), "MB");
    console.log("captured", Object.keys(S).join(" ") || "nothing");
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
