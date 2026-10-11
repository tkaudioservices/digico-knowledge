---
default-tag: "(file-derived, SD5 unknown, 2026-10)"
---

# Preset library (section `db`)

```
db 00   u32 preset count          (150 in the sample)
entry:
  d7 00   u32 object count        1 for mono, 2 for stereo (one object per leg)
  object count × ( d5 00 01 00 01   u32 n   n × component   footer )   as the live state
  u16-length name
  u16-length category
  u16-length sub-label            usually empty
  u16 0x000E
  f64 TDateTime                   0 on factory FX presets
  6 bytes                         00 00 00 01 00 00 on user presets; 02 1f 4f 01 00 00 on factory FX
```

*(file-derived, SD5 unknown, 2026-10)*: all 150 entries walk, including the two-object stereo
ones.

- The first 34 entries are the factory FX library (delays, choruses, pitch shifters, hall,
  room, plate and non-linear reverbs), each one FX-unit object with category names such as
  `Delays` and `Hall Reverbs`. *(file-derived, SD5 unknown, 2026-10)*
- User presets are whole channel or bus objects (13 components for an input, 8 for an aux,
  11 for a group) with the user's category text. *(file-derived, SD5 unknown, 2026-10)*
- The sub-label held a person's first name on some entries in the sample. **Scrub it** along
  with names and categories before any derivative leaves the private folder.
- The footer `ref` on an FX-unit object inside a snapshot table was 122 on one snapshot and
  -1 elsewhere, which looks like a link to a preset index. *(reasoned, SD5 unknown, 2026-10)*
