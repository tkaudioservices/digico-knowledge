---
default-tag: "(file-derived, SD5 unknown, 2026-10)"
---

# Fader banks (section `f3`)

```
f3 00   u32 bank count            (34 in the sample)
record, 361 bytes:
  +0    u16 record length (0x0169 = 361)
  +2    u16 bank index
  +4    name[16]                  length byte + up to 15 chars, junk after
  +20   6 bytes  (08 02 00 00 00 00 seen)
  +26   8 × 0xFF
  +34   u8 0
  +35   12 × (u8 object index, u8 kind)    the twelve fader assignments
  +59   12 × u32                 pointer-sized values that change per record: memory addresses written out
  +107  12 × 16 bytes            per-fader settings (01 01 00 00 01 02 20 00 23 0d 00 00 23 0d 00 00 seen)
  +299  12 × u8                  0x0C on every fader seen
  +311  label[16]                a second name field; sometimes a default like `Input Channels`, sometimes free text
  +327  RGB                      bank colour
  +330  31 bytes                 zero
```

*(file-derived, SD5 unknown, 2026-10)* for the layout: 34 records at exactly 361 bytes.

- An assignment is `(index, kind)` with the same kind numbers as the live state (1 input, 5
  aux, 6 group, 10 control group …), so a bank resolves to object names by lookup. Kind 0 is
  an empty slot. *(file-derived, SD5 unknown, 2026-10)*
- The 12 u32 values at +59 look like heap addresses (0x0F65…) and differ between banks that
  are otherwise identical. Treat as noise. *(reasoned, SD5 unknown, 2026-10)*
- What the second label and the 16-byte per-fader block control is open.
