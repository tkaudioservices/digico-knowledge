# Libraries

Reusable things pulled out of real files and scrubbed: macro sets, fader-bank layouts,
channel templates, naming lists. Each library is one JSON file here, validated against
[`schema/library.schema.json`](schema/library.schema.json) and listed in
[`index.json`](index.json). The site copies this folder at deploy time and shows the index
on its Libraries tab.

## Adding one

1. Extract with the reader, write the JSON by hand or from its output.
2. Scrub every name. Read the file, then run `python3 tools/check_repo.py`.
3. Add an entry to `index.json`.
4. Follow [`templates/library-entry.md`](../templates/library-entry.md).

## Shape

```json
{
  "id": "example-macro-set",
  "kind": "macros",
  "title": "Example macro set",
  "console": "SD5",
  "version": "unknown",
  "source": "a 2025 theatre session, scrubbed",
  "extracted": "2026-10",
  "notes": "free text",
  "items": [ { "name": "...", "...": "any fields the kind needs" } ]
}
```

`kind` is one of `macros`, `fader-banks`, `channel-template`, `snapshot-template`, `naming`,
`patch`, `other`. The `items` array is free-form per kind; document a kind's item shape in
this file when it first appears.
