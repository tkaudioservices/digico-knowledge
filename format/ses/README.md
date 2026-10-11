---
default-tag: "(file-derived, SD5 unknown, 2026-10)"
---

# The `.ses` session file

What is known, from one 2025 SD5 theatre session (45 snapshots, 11.75 MB). Every page below
carries the default tag in its front matter; claims that differ carry their own. Nothing has
been checked in the offline software yet, so nothing is `bench-verified`.

## Shape of the file

- Plain binary with no compression and no container wrapper. Text is readable in a hex
  editor. *(file-derived, SD5 unknown, 2026-10)*
- The layout follows Object Pascal runtime conventions: length-prefixed strings, doubles for
  dates counted from 30 December 1899 (`TDateTime`). *(reasoned, SD5 unknown, 2026-10)*
- A **section offset table** at 0x100 points at 27 sections; each starts with a 2-byte type
  tag. *(file-derived, SD5 unknown, 2026-10)*
- Whether the file carries a checksum is **not known**. Only saving a modified file and
  opening it in the offline software will tell. See [`open-questions.md`](open-questions.md).

## Pages

| Page | Covers |
|------|--------|
| [`header.md`](header.md) | The first 0x1C8 bytes, the offset table, the section list |
| [`strings.md`](strings.md) | Fixed 32-byte name fields, u16-length strings, timestamps |
| [`components.md`](components.md) | The component record and the parameter IDs identified so far |
| [`live-state.md`](live-state.md) | Section `d3`: objects, kinds, counts |
| [`snapshots.md`](snapshots.md) | Section `d2`: the shared pool, index tables, trailers |
| [`fader-banks.md`](fader-banks.md) | Section `f3`: 361-byte bank records |
| [`macros.md`](macros.md) | Section `f8`: macro records and the action encodings seen |
| [`presets.md`](presets.md) | Section `db`: the preset library |
| [`patch.md`](patch.md) | Sockets, panel names, the input patch encoding, the open output patch |

## Major blocks, in one table

| Block | What it holds | Confidence |
|-------|---------------|------------|
| Component records | One record per processing block: type, name, timestamp, parameters | file-derived |
| Live state | The console as saved: 1348 objects with inline components | file-derived |
| Snapshots | Index tables into a shared component pool, each with a name, save time and scope mask | file-derived |
| Fader banks | 34 banks of 12 `(index, kind)` assignments, two labels and a colour | file-derived |
| Macros | 64 records: name, page, slot, colour, length-prefixed action records | file-derived |
| Presets | 150 entries: whole objects plus name, category, sub-label, timestamp | file-derived |
| Patch | Input patch as `(socket, port group)`; all socket and panel names present | file-derived |

## What a reader can extract today

Channel, bus, matrix, control-group, FX and GEQ names and formats; fader, mute, HPF/LPF,
EQ, dynamics, aux sends, group routing; input patch resolved to socket names; all socket
and panel names; fader bank layouts; macro names, colours and raw actions; snapshot list
with save times; preset library. `tools/ses_reader.py` does all of this; the parameter
meanings it prints are `reasoned` until the tests in `open-questions.md` are run.
*(file-derived, SD5 unknown, 2026-10)*

## What writing would involve

- Names in fixed 32-byte fields can be rewritten in place. The reader's `--rename` does
  this for a channel or bus, touching every stored copy (live components, footer, and the
  snapshot pool entries its tables point at): 130 copies for one input channel in the sample.
  Untested on a console.
- Numeric parameters can be rewritten in place once their IDs are confirmed.
- Anything that changes length (snapshot names, adding snapshots, macros, presets) means
  rewriting the offset table and every count after the change.
