# Tools

Command-line side of the project. Python 3.10+, standard library only.

| Script | Purpose |
|--------|---------|
| `ses_reader.py` | The format reader: header, live state, snapshots, fader banks, macros, presets, sockets. Summary, `--json`, `--csv`, `--scrub` for publishable output, experimental `--rename`. Follows `format/ses/`. |
| `ses_scan.py` | Structure-agnostic scan of any binary: identity, recovered strings (plain runs, length-prefixed, UTF-16), candidate `TDateTime` stamps. Mirrors `web/js/ses.js` so the site and the CLI agree. The fallback for files the reader does not recognise. |
| `check_repo.py` | The commit gate: no console files tracked, library JSON valid and indexed, optional banned-word scan, `--tags` for the re-verify list. |
| `tests/` | `python3 -m unittest discover -s tools/tests` |

`ses_reader.py` raises `ValueError` with an offset if a file does not walk; `ses_scan.py`
still works on such a file. The browser decoder in `web/js/ses.js` has not been ported yet;
until it is, the site shows the scanner's view only.

## Usage

```
python3 tools/ses_reader.py path/to/file.ses          # decoded summary
python3 tools/ses_reader.py path/to/file.ses --scrub --csv out.csv   # publishable channel list
python3 tools/ses_scan.py path/to/file.ses            # heuristic summary
python3 tools/ses_scan.py path/to/file.ses --json     # same, as JSON
python3 tools/ses_scan.py path/to/file.ses --strings  # just the strings, one per line
python3 tools/check_repo.py                            # gate
python3 tools/check_repo.py --tags                     # re-verify list
```
