# CLAUDE.md

Read first, in this order:

1. `CONVENTIONS.md`: the rules, especially section 4. This repo is **public**.
2. `format/ses/README.md`: what is known about the file format and what is not.
3. `web/README.md` before touching the site. No build step, no frameworks, no CDN.

## Working here

- Facts carry `*(tier, version, date)*`. Do not write an untagged claim.
- Never commit a `.ses` or other console file. Never write a show, venue, vessel, client or
  person name from a session file anywhere in this repo, including commit messages.
- Scrub derived outputs before they land in `samples/`, then run `python3 tools/check_repo.py`.
- Contradictions go beside the old claim, not over it.
- Changes to the parser belong in both places: `web/js/ses.js` (browser) and `tools/`
  (command line). Keep their outputs in step; `tools/tests/` pins the shared heuristics.
- The site must work from `file://` as well as from GitHub Pages: relative paths only.

## End-of-session filing

If the session learnt something about DiGiCo files or consoles, write one
`inbox/YYYY-MM-DD-slug.md` per finding from `templates/fact-note.md`, tiered honestly, with
the source described generically. Add a line to `sessions/` saying what the session did and
where its findings went. TK reviews the inbox; do not fold findings into topic files without
being asked.

## Checks before you push

```
python3 tools/check_repo.py
python3 -m unittest discover -s tools/tests
node --check web/js/*.js
```
