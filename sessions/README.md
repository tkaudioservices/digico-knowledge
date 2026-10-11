# Sessions

Provenance. One short note per working session that changed what this repo knows: date,
what was looked at (described generically), what was found, where it was filed. Keeps the
inbox honest and lets a claim be traced back to the session that made it.

| Date | Session | Where it went |
|------|---------|---------------|
| 2026-10-10 | First read of a `.ses` sample: reader script and format notes written (private folder, being brought in) | `format/ses/README.md` outline, `open-questions.md` |
| 2026-10-11 | Repository created; conventions, skeleton and the site's structure-agnostic explorer | everywhere |
| 2026-10-11 | Brought the first session's notes across as `format/ses/` pages; reader landed as `tools/ses_reader.py` with a scrub mode and a fixture test; first scrubbed sample; six more open questions | `format/ses/*.md`, `open-questions.md` #7–12, `tools/`, `samples/`, `inbox/` (2 notes) |
| 2026-10-11 (later) | Read the header word 0x22 against DiGiCo's published releases; wrote the release list | `format/versions.md`, `ses/header.md`, `open-questions.md` #11a, `ses/macros.md`, `inbox/` (1 note) |
| 2026-10-11 (evening) | Found 135 more session files in an archive (SD5/7/8/9, 2013–2025, ten format revisions); generalised both decoders to find sections by type and read macros by version; all seven test files decode with parity | `format/versions.md`, `ses/header.md`, `ses/macros.md`, `open-questions.md` #11b, #5a, `tools/`, `web/js/ses.js`, `inbox/` (1 note) |
| 2026-10-11 (night) | Site restyled to the brand sheet; decoded overview, signal-flow view and draw.io/CSV exports; format page with five draw.io diagrams | `web/`, `format/diagrams/`, `tools/make_diagrams.py`, `tools/export_diagrams.sh` |
