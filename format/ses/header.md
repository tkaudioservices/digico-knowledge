---
default-tag: "(file-derived, SD5 unknown, 2026-10)"
---

# Header and section table

Source: one 2025 SD5 theatre session, 45 snapshots, 11.75 MB. Offsets are from the start
of the file. Little-endian.

## The first 26 bytes

```
DiGiCo     SD5 .SES vK   \r
```

- `DiGiCo` at 0x00, the console model at 0x0B–0x0E (`SD5 `), `.SES` at 0x0F, a format tag at
  0x14–0x15 (`vK`), then spaces and a carriage return. Only one tag letter has been seen, so
  whether it tracks the software release or the file layout is not known. *(file-derived, SD5 unknown, 2026-10)*

## Header words, 0x1A to 0xFF

Mostly zero. The populated words, read as u16:

| Offset | Value | Reading |
|--------|-------|---------|
| 0x20 | 0x01C8 | Offset of section 0, the session name. Matches the first entry of the offset table. |
| 0x22 | 0x0786 | 1926. Matches DiGiCo's release V1926 (November 2024), which was the console release when this file was saved in November 2025; read as the software version that wrote the file. One file, so still *(reasoned, SD V1926, 2026-10)*. See [`../versions.md`](../versions.md). |
| 0x24 | 0x1008 | Unknown. |
| 0x26 | 0x0064 | 100, the number of input channels in this session's structure. *(reasoned, SD5 unknown, 2026-10)* |
| 0x38–0x6E | small values (7, 29, 11, 1, 4, 1, 9, 6 …) | Session structure counts, probably busses and formats. *(reasoned, SD5 unknown, 2026-10)* |
| 0x77 | f32 48000.0 | Sample rate. *(reasoned, SD5 unknown, 2026-10)* |
| 0x7B, 0x7F, 0x83 | f32 25.0, 1000.0, -20.0 | Look like oscillator or talkback defaults. *(reasoned, SD5 unknown, 2026-10)* |

The float fields sit on odd offsets, so the header is a packed record, not aligned words.

## Section offset table, 0x100 (0x80 before vB)

A zero-terminated list of u32 file offsets, one per section, in file order. 27 entries in the
vK sample; the last entry equals the file length, so each section's size is the gap to the next
entry. *(file-derived, SD5 V1926, 2026-10)*

The u16 at 0x20 is the offset of section 0 and is also the table's first entry, which is how
a reader finds the table: files from vB (V929) onwards keep it at 0x100; vA (V760) and earlier
keep it at 0x80 with a correspondingly shorter header. *(file-derived, SD various, 2026-10)*,
seen across SD5, SD7, SD8 and SD9 files; see [`../versions.md`](../versions.md).

## Section type list, table + 0xA1

One byte per section from section 1 onwards, at 0x1A1 when the table is at 0x100 (0x121 when
it is at 0x80). The vK list: `db f6 fc c9 d2 d3 f3 d4 e4 d9 e8 ea ec ed dd cf f8 f9 fa eb e2
d0 e3 e5 e1 ee`. Older revisions list fewer types (23 in vA to vC, 25 in vF and vG, 26 in vH),
so a section's position changes between revisions while its type byte does not. Readers must
find sections by type. *(file-derived, SD various, 2026-10)*

Each section's first two bytes are usually its type as a u16 (`db 00` …); section 0 carries
`00 00`. Where a listed type is `d4`, `e4`, `d9`, `f9`, `fa` or `eb` the section starts with
other bytes (`27 03`, `80 01`, `46 00`, `80 02`, `90 03`, `f0 00`), so the list is the
authority and the leading bytes are not. *(file-derived, SD various, 2026-10)*

## Sections seen

| # | Tag | Size | Content | Page |
|---|-----|------|---------|------|
| 0 | `00` | 14 | Session name, u16-length string | [`strings.md`](strings.md) |
| 1 | `db` | 816 KB | Preset library | [`presets.md`](presets.md) |
| 2 | `f6` | 10 KB | Repeating 6-byte entries (`21 00 …`), not decoded | |
| 3 | `fc` | 6 | Empty: tag and u32 0 | |
| 4 | `c9` | 130 KB | I/O panel names and socket map | [`patch.md`](patch.md) |
| 5 | `d2` | 9.5 MB | Snapshots | [`snapshots.md`](snapshots.md) |
| 6 | `d3` | 1.2 MB | Live console state | [`live-state.md`](live-state.md) |
| 7 | `f3` | 12 KB | Fader banks | [`fader-banks.md`](fader-banks.md) |
| 8 | `27 03` | 809 | Table of 0xFF with a few 0x01, a flag set | |
| 9 | `80 01` | 386 | Zeros | |
| 10 | `46 00` | 72 | Zeros | |
| 11–13, 15, 16 | `e8 ea ec dd cf` | 6–10 | Empty | |
| 14 | `ed` | 1768 | Nested `e7`/`e6` records of floats (1.0, 0.708); five of them. Monitor or solo levels. *(reasoned, SD5 unknown, 2026-10)* | |
| 17 | `f8` | 6 KB | Macros | [`macros.md`](macros.md) |
| 18 | `80 02` | 642 | 32 × 20 bytes: name[16], RGB, 0. Default names `Set 1`…`Set 32` with the default colour cycle | |
| 19 | `90 03` | 914 | 48 × 19 bytes: name[16], u8 index, u8 letter, 1. Default names `A1`…`A16`, `B1`…`B16`, `C1`…`C16` | |
| 20 | `f0` | 242 | Notes text: 120 empty CRLF lines in the sample | |
| 21–24 | `04 30 0f e5` | 6–50 | Small, not decoded | |
| 25 | `e1` | 1190 | 16 × 44-byte records holding UTF-16 fragments of UI text and a date; looks like uninitialised memory written out | |
| 26 | `04 17` | 5.9 KB | Zeros | |

## Checksum

No field in the header behaves like a checksum, and the structure is a straight record dump,
but this is not evidence. See [`open-questions.md`](open-questions.md) #1.
