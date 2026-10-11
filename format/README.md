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
