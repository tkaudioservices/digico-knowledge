---
default-tag: "(file-derived, SD5 unknown, 2026-10)"
---

# Snapshots (section `d2`)

Snapshots are not full copies of the console. The section holds one shared pool of
components, then one table per snapshot that points into the pool, then a trailer with
the snapshot's name and scope. A channel block that is identical in twenty snapshots is
stored once. This is why a 45-snapshot file is 11.75 MB and not 60 MB. *(file-derived, SD5 unknown, 2026-10)*

## Layout

```
d2 00   u16 (0x00D2)   u32 component count
pool:   count × component               (the same record as everywhere else)
list header (see below)
per snapshot:
  table:   d3 00   u32 object count
           object: d5 00 01 00 00   u32 n   n × u32 pool index   footer (as live state)
  trailer: u16 len   name   f64 TDateTime   u16 0x03E0   scope bytes up to the next table
```

- 11,780 pool components and 45 tables in the sample; every table walks and every pool index
  is in range. *(file-derived, SD5 unknown, 2026-10)*
- Tables hold 1347 or 1348 objects, one short of the live state on some snapshots, so the
  object list is per snapshot and not assumed identical. *(file-derived, SD5 unknown, 2026-10)*
- The trailer's name is a u16-length string, so renaming a snapshot changes the file length.
- The u16 after the timestamp is 0x03E0 on all 45 snapshots. *(file-derived, SD5 unknown, 2026-10)*
  What it is remains open.
- The scope bytes run to the next table: 1906 bytes on all but the last snapshot (2700). Mostly
  0xFF with a 32-byte run of zeros at +288 and a few `cf`/`df` bytes later; reads as a recall
  scope bitmask where 0xFF means everything in scope. *(reasoned, SD5 unknown, 2026-10)*
- Around 40 bytes between +1222 and +1510 of the trailer differ between snapshots in small
  values (1–5, 0x14, 0x1a, 0x1d …). Candidates for the per-snapshot settings the console
  shows (crossfade, MIDI, GPO, macro on recall) and possibly the cue number. *(reasoned, SD5 unknown, 2026-10)*

## The list header

Between the end of the pool and the first table: `u32 0`, `u32 1`, `u16 0x0150`, a 32-byte
Pascal name field holding free text, one zero byte, four 72-byte rows (each two copies of
u32 0x7C4873BE then 64 × 0xFF), 16 zero bytes, then `u32 45` = the number of snapshots.
*(file-derived, SD5 unknown, 2026-10)* for the bytes; the purpose of the text field and the
four rows is open.

## Reading a snapshot

For object k in a snapshot's table, its components are `pool[i]` for each listed index i,
and its name and format are in the table footer. The pool components carry the name the
channel had when that snapshot was last stored, so renaming a channel on the desk does not
rewrite old snapshots. *(file-derived, SD5 unknown, 2026-10)*

The component record's `u32` at +58 is 1–45 in the pool and the signed reference after the
parameters is often a small integer; one of them probably links a pool entry back to the
snapshot that created it. *(reasoned, SD5 unknown, 2026-10)*

## Not found

The cue numbers the console displays (1.00, 2.00 …) are not stored as a list of sequential
integers or floats anywhere in the file, in any stride or step tried. See
[`open-questions.md`](open-questions.md) #3.
