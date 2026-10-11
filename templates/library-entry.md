# Library entry checklist

Each library is one JSON file in `libraries/` validated against `libraries/schema/library.schema.json`
and listed in `libraries/index.json`.

- [ ] `id` is lower-case, hyphenated, unique
- [ ] `kind` is one of: `macros`, `fader-banks`, `channel-template`, `snapshot-template`, `naming`, `patch`, `other`
- [ ] `source` describes the origin generically, no names
- [ ] `console` and `version` say where it came from (or `unknown`)
- [ ] every item name has been read and is generic
- [ ] `python3 tools/check_repo.py` passes
