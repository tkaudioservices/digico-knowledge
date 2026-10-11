# 0002: static site, client-side only, no build step

**Date:** 2026-10-11

## Decision

The front end in `web/` is plain HTML, CSS and JavaScript (ES modules), served by GitHub
Pages. Files dropped on it are read with the browser's File API and never uploaded. No
framework, no bundler, no CDN, no analytics.

## Why

Session files are confidential; a tool that never sends them anywhere is the only kind
worth offering publicly. A no-build site can be opened from `file://` on a show laptop
with no internet. It also matches the main site's rule (no webfonts, no CDN).

## Consequences

- The parser is written twice: `web/js/ses.js` and `tools/`. Tests keep them in step.
- Libraries are plain JSON copied into the site at deploy time.
- Anything needing a server is a separate project.
