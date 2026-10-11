# Format

How DiGiCo files go together. One sub-folder per file type; the session file first because
everything else hangs off it.

| Folder | File type | State |
|--------|-----------|-------|
| [`ses/`](ses/README.md) | `.ses` session | Reader in `tools/ses_reader.py`. Map written, one sample, nothing bench-verified. Writing unverified. |
| `snapshots/` | snapshot export | Not started |
| `macros/` | macro export | Not started |
| `presets/` | channel and FX presets | Not started |

Each page is a set of tagged claims per `CONVENTIONS.md`. Offsets in hex, sizes in decimal,
little-endian unless stated.

[`versions.md`](versions.md) lists the software releases DiGiCo publishes, for the version slot in
claim tags and for reading a file's header word.

[`diagrams/`](diagrams/) holds the draw.io sources for the figures on the site's Format page;
`tools/make_diagrams.py` writes them and `tools/export_diagrams.sh` exports the SVGs.
