---
default-tag: "(file-derived, SD5 unknown, 2026-10)"
---

# The `.ses` session file

What is known, in outline. Each heading will become its own page as the notes from the
first reading session are brought across and checked. Until a claim carries its own tag,
the default tag in the front matter applies.

## Shape of the file

- Plain binary with no compression and no container wrapper. Text is readable in a hex
  editor. *(file-derived, SD5 unknown, 2026-10)*
- The layout follows Object Pascal runtime conventions: length-prefixed strings, doubles for
  dates counted from 30 December 1899 (`TDateTime`). *(reasoned, SD5 unknown, 2026-10)*
- A **section offset table** near the start points at the major blocks. *(file-derived, SD5 unknown, 2026-10)*
- Whether the file carries a checksum is **not known**. Only saving a modified file and
  opening it in the offline software will tell. See [`open-questions.md`](open-questions.md).

## Major blocks, as currently understood

| Block | What it holds | Confidence |
|-------|---------------|------------|
| Component records | One record per channel, bus, matrix, control group, FX and graphic EQ: name, format, and parameters | file-derived |
| Live state | The console as it was when saved: fader, mute, HPF/LPF, EQ, dynamics, aux sends, group routing | file-derived |
| Snapshots | Stored as **index tables into a shared component list**, not as full copies; each with a save time | file-derived |
| Fader banks | Bank layouts, which strip sits where | file-derived |
| Macros | Names, colours, raw actions | file-derived |
| Presets | The preset library | file-derived |
| Patch | Input patch resolves to socket names; all socket and panel names present | file-derived |

## What a reader can already extract

Channel, bus, matrix, control-group, FX and GEQ names and formats; fader, mute, HPF/LPF,
EQ, dynamics, aux sends, group routing; input patch resolved to socket names; all socket
and panel names; fader bank layouts; macro names, colours and raw actions; snapshot list
with save times; preset library. *(file-derived, SD5 unknown, 2026-10)*

## Pages to write

- `header.md`: the first bytes, version markers, the offset table
- `components.md`: the component record and its parameter IDs
- `live-state.md`
- `snapshots.md`: the index-table mechanism and the save-time encoding
- `fader-banks.md`
- `macros.md`
- `presets.md`
- `patch.md`: input patch (known) and output patch (open, see below)
- `strings.md`: how text is stored, which the site's string scanner depends on
