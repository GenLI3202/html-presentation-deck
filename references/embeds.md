# Embedding existing interactive pages

Reuse the page the user already has. Do not rebuild it inside the deck.

## Steps

1. Copy the page into `<deck>/embed/` (an English copy for an English deck). Read it in full first.
2. Scan it for Claude mentions and claude.ai links (`grep -i claude`). Remove them from the copy; the build stops
   otherwise. Tell the user when the original also has them.
3. Register it in `deck.config.json`:
   ```json
   "embeds": {
     "map":     { "url": "embed/map_en.html", "scale": 1.25, "css": ".hint,.caption{display:none!important} body{padding:0!important}" },
     "mapfull": { "url": "embed/map_en.html", "scale": 1.0,  "css": "body{padding-block:8px!important}" }
   }
   ```
   - `css` is injected into the page head: hide its own title, captions and footers that the slide already has,
     tighten paddings, fix heights. Use `!important`; the page's own CSS loads later.
   - `scale` > 1 enlarges the page inside the frame (the iframe is sized 1/scale and scaled up). Use it when the
     page was designed for a smaller screen.
   - A second key with `scale` 1 and light CSS serves as the full-size reference figure (`{ k: "embed", e: "mapfull" }`).
4. Place it: `<div class="body"><div class="frame" data-embed="map" data-title="Accessible name"></div></div>`.
5. Build and look at it at 1920×1080. Adjust the CSS until nothing is cut off and nothing duplicates the slide.

## How it loads

- `preview.html`: all embed pages are inlined in `window.__EMBED` (fonts and CDN scripts inlined too).
  From `file://` the engine uses `iframe.srcdoc`; over http(s) it uses a Blob URL. (A srcdoc page over http
  breaks map libraries that load GeoJSON in a worker; a Blob page from file:// is not reachable from the deck.)
- `index.html` (Artifact): pages are fetched from `embed/` at run time. Publish them with the Artifact `files` map.
- Embeds mount when their slide is shown, and the next slide's embeds are prefetched.
- The engine injects a key forwarder, so ← → P R F work while the focus is inside the page.

## Offline inlining (offline.py)

The single file must play with no network. `offline.py` replaces Google Fonts links with inline `@font-face`
(latin and latin-ext subsets, woff2 as data URLs) and CDN `<script src>` (cdnjs, jsdelivr, unpkg) with inline
code. Downloads are cached in `<deck>/vendor/`. The build prints any remote resource that is left.
Pages with their own data (GeoJSON, embedded vector tiles via a custom protocol) need nothing else.

## Snapshots for print

An iframe does not print reliably. The PDF pipeline replaces each embed frame with a captured image and adds
supplement pages for other states (pdf-storyboard.md).
