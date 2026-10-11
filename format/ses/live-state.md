---
default-tag: "(file-derived, SD5 unknown, 2026-10)"
---

# Live state (section `d3`)

The console as it was when the file was saved. One object per channel, bus, socket, FX unit
and graphic EQ, each with its components inline. 1348 objects in the sample; every one walks
with the layout below. *(file-derived, SD5 unknown, 2026-10)*

## Layout

```
d3 00   u32 object count
object: d5 00 01 00 01   u32 n   n × component   footer
footer: 27 00   u8 index   u8 kind   name[32]   i32 ref   u8 format
```

- `d5 00 01 00 01`: the trailing `01` means the components follow inline. Snapshot tables
  use `00` and give indices instead (see [`snapshots.md`](snapshots.md)).
- `index` is the object's number within its kind (channel 1 = 0) and wraps at 256, so it is
  not unique on its own; `(kind, index)` is. *(file-derived, SD5 unknown, 2026-10)*
- `format`: 1 mono, 2 stereo, 3 LCR, 4 on the one object named as a master. *(reasoned, SD5 unknown, 2026-10)* for 3 and 4.
- `ref` is -1 on every live object in the sample.
- The 32-byte name is stored again in each of the object's components, so a channel name
  exists 14 times in the live state alone.

## Object kinds, in file order

| Kind | Objects in the sample | Components per object | What |
|------|-----------------------|-----------------------|------|
| 1 | 100 | 13 | Input channels |
| 5 | 36 | 8 | Aux busses |
| 6 | 17 | 11 | Group busses |
| 7 | 41 | 8 or 11 | The right and centre legs of stereo and LCR busses, as separate objects |
| 8 | 1 | 1 | Monitoring |
| 9 | 3 | 2 | Talkback |
| 10 | 20 | 2 | Control groups |
| 11 | 2 | 4 | Solo busses |
| 12 | 1 | 10 | Talkback input |
| 14 | 10 | 1 | FX units |
| 15 | 24 | 2 | Matrix inputs |
| 16 | 24 | 8 | Matrix outputs |
| 17 | 32 | 1 | Graphic EQs |
| 18 | 1 | 1 | One object, unknown |
| 27–36 | 8, 16, 64, 64, 64, 64, 56, 56, 64, 64 | 1 | Input socket groups: internal sources, local I/O, then one group per port or rack |
| 77–86 | 4, 16, 64, 64, 64, 64, 56, 56, 64, 64 | 1 | Output socket groups, same order |

The input channel count (100) matches the header word at 0x26. The kind numbers are the same
ones used by fader bank entries, input patch values and preset objects, which is what makes
cross-references in the file resolvable. *(file-derived, SD5 unknown, 2026-10)*

The component sequence for an input channel is types 1, 9, 7, 8, 4, 5, 12, 2, 13, 3, 14, 19, 10;
for an aux 11, 9, 8, 4, 5, 12, 14, 10; for a group 11, 9, 8, 4, 5, 12, 2, 3, 14, 19, 10.
*(file-derived, SD5 unknown, 2026-10)*

## Section 2 and the structure

Section 2 (`f6`) holds 6-byte entries that repeat per port, 16 to a block, which looks like
the I/O port configuration (which card is in which slot). Not decoded. *(reasoned, SD5 unknown, 2026-10)*
