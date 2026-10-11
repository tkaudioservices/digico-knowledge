# web/

The front end. Static, no build step, no dependencies, no CDN. Open `index.html` from disk
or serve the folder; GitHub Pages serves it from `main` via `.github/workflows/pages.yml`,
which also copies `../libraries/` in as `libraries/`.

```
index.html        one page, tabs
css/tk.css        tokens from tkaudioservices.com, light and dark
js/app.js         UI: drop zone, tabs, tables, export
js/ses.js         the scanner (heuristic) and the decoder seam
js/hexview.js     windowed hex dump
js/ses.test.mjs   parity test against tools/ses_scan.py
assets/           tk Audio Services marks (SVG, from the live site)
```

## What it does today

Drop a `.ses` (or any file). The page reads it in the browser, decodes it if it is an
SD-series session (Structure tab: channels, busses, snapshots, banks, macros, presets,
sockets), hashes it, recovers strings four ways (length-prefixed 8-bit and 32-bit, plain
runs, UTF-16), lists doubles that read as Delphi `TDateTime` stamps, and shows a hex view
you can jump around from any string. Nothing is uploaded; there is no server to upload to.

## The decoder

`decode()` in `js/ses.js` implements the section map from `format/ses/`: header and offset
table, live state (objects and their components), the snapshot pool and tables, presets, fader
banks, macros, sockets and panels. It returns a plain object the Structure tab renders as
collapsible tables, with the raw JSON behind a disclosure, and `{recognised:false, reason}`
for anything it cannot walk, in which case the heuristic tabs still apply. It mirrors
`tools/ses_reader.py` field for field; `ses.test.mjs` decodes `tools/tests/fixture-session.bin`
with both and compares. Change one, change the other, run the test.

## Branding

Tokens are lifted from the live site's `styles.css`: warm off-white `#fafaf7`, ink
`#1b1916`, brand red `#b41824` (the `mask-icon` red; the SVG marks still carry their own
`#be1e2d` ring and `#ed1c24` rules, which is a known loose end in the brand notes), warm
hairline `#e2ddd2`, dark ground `#131210`. Display type is the condensed system stack the
main site uses; no webfonts. The mark in the header is inlined so its glyphs take
`currentColor` and survive dark mode.

## Local check

```
node --check js/*.js
node js/ses.test.mjs
python3 -m http.server -d web 8000   # then http://localhost:8000
```
