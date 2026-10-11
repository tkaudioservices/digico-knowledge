# web/

The front end. Static, no build step, no dependencies, no CDN. Open `index.html` from disk
or serve the folder; GitHub Pages serves it from `main` via `.github/workflows/pages.yml`,
which also copies `../libraries/` in as `libraries/`.

```
index.html        the reader: drop zone, overview, signal flow, tables, strings, timestamps, hex, export
format.html       the format map in prose with the five diagrams
css/tk.css        tokens and rules from tkaudioservices.com/brand-guidelines, light and dark
js/app.js         UI: intake, tabs, overview tiles, signal-flow SVG, tables, draw.io and CSV exports
js/ses.js         the scanner (heuristic) and the decoder (mirrors tools/ses_reader.py)
js/hexview.js     windowed hex dump
js/ses.test.mjs   parity tests against tools/ses_scan.py and tools/ses_reader.py
diagrams/         SVG exports of format/diagrams/*.drawio (tools/export_diagrams.sh)
assets/           tk Audio Services marks (SVG) and the vendored display face (Oswald 700, OFL)
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

Follows the brand style sheet at tkaudioservices.com/brand-guidelines: paper `#FAFAF7`, sheet
`#F1EFE8`, card `#FFFFFF`, ink `#1B1916`, muted `#5D574E`, line `#E2DDD2`, the one red `#BE1E2D`
(`#E4564B` on the dark ground), no blue. Oswald 700 uppercase for display, the system sans for
body and labels, the system mono for data. Eyebrows track `.22em`, table labels `.12em`,
headings are not tracked. Notes are ink on sheet with a 3px red rule. Radius 3px. The mark in
the header is inlined at 40px (the brand minimum) so its glyphs take `currentColor`; the footer
uses the white knockout lockup on `#131210`. The display face is vendored, not fetched: no CDN.

## Signal flow and draw.io

The Signal flow tab draws the selected channel's path as inline SVG (input socket, trim,
filters, EQ, dynamics, fader, then group routing in ink and aux sends in red with levels) and a
mix overview of inputs, groups, auxes and matrix with the selection's wires. Export writes plain
mxGraph XML (`.drawio`) for the whole mix structure or the selected channel; it opens in draw.io
desktop or app.diagrams.net. The data comes from `detail` on each object in `decode()`.

## Local check

```
node --check js/*.js
node js/ses.test.mjs
python3 -m http.server -d web 8000   # then http://localhost:8000
```
