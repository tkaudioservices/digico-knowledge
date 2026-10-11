#!/bin/sh
# Export every format/diagrams/*.drawio to web/diagrams/*.svg with the draw.io desktop app.
# macOS path shown; on Linux use `drawio`. Run from the repository root.
set -e
APP="${DRAWIO:-/Applications/draw.io.app/Contents/MacOS/draw.io}"
for f in format/diagrams/*.drawio; do
  out="web/diagrams/$(basename "${f%.drawio}").svg"
  "$APP" --export --format svg --embed-svg-images --border 10 --output "$out" "$f" >/dev/null 2>&1
  echo "$f -> $out"
done
