# Tools

Command-line side of the project. Python 3.10+, standard library only.

| Script | Purpose |
|--------|---------|
| `ses_scan.py` | Structure-agnostic scan of any binary: identity, recovered strings (plain runs, length-prefixed, UTF-16), candidate `TDateTime` stamps. Mirrors `web/js/ses.js` so the site and the CLI agree. |
| `check_repo.py` | The commit gate: no console files tracked, library JSON valid and indexed, optional banned-word scan, `--tags` for the re-verify list. |
| `tests/` | `python3 -m unittest discover -s tools/tests` |

The full `.ses` reader written in the first session (summary, `--json`, `--csv`,
experimental `--rename`) is being brought in as `ses_reader.py`. When it lands, the
heuristics in `ses_scan.py` stay as the fallback for files the reader does not recognise.

## Usage

```
python3 tools/ses_scan.py path/to/file.ses            # summary
python3 tools/ses_scan.py path/to/file.ses --json     # same, as JSON
python3 tools/ses_scan.py path/to/file.ses --strings  # just the strings, one per line
python3 tools/check_repo.py                            # gate
python3 tools/check_repo.py --tags                     # re-verify list
```
