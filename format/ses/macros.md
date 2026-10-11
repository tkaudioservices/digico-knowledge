---
default-tag: "(file-derived, SD5 unknown, 2026-10)"
---

# Macros (section `f8`)

```
f8 00   u32 macro count           (64 in the sample)
record, variable:
  +0    u16 macro index
  +2    name[32]                  the comma in the name splits the two lines of the button label
  +34   u8 page                   0, 3, 4 and 0x8D seen
  +35   u8 slot                   button position
  +36   RGB, then 00              button colour
  +40   u32 n1
        n1 × (u16 length, data)   the actions; every one seen is 20 bytes long
        u32 n2
        n2 × (u16 length, data)   a second list; empty on 63 of 64, one 14-byte entry on the other
```

*(file-derived, SD5 unknown, 2026-10)*: all 64 walk with this shape, including two
30-action routing macros.

## Action records seen

Eighteen data bytes after the length word. Readings are *(reasoned, SD5 unknown, 2026-10)*.

| Bytes | Reading |
|-------|---------|
| `cd 00 90 00 <4 junk> 00 00 00 00 01 00 NN 00 00 00` | Snapshot and transport control. NN: 1 play, 2 record, 4 next, 5 previous, 6 stop, 7 and 8 go to a snapshot |
| `01 00 0e 01 00 CH 01 CH 00 00 00 01 00 00 80 3f 00 00` | Set a control on input channel CH to 1.0. Pairs of these make the mute and unmute macros |
| `ee 02 00 00 00 ee 02 …` | Tap tempo |
| `cb 00 00 00 00 c6 02 … ff ff ff ff` | Show a panel |

The 4 bytes after `90 00` look like a pointer and vary; ignore them when comparing. The
`page` byte groups macros that share a colour scheme, so it may be the macro page or bank.

## Cross-reference

V1926 added macro triggers (fader threshold, meter level, solo, snapshot recall) and MacroOSC.
*(documented, SD V1926, 2026-10)* per the release notes on DiGiCo's support site. The sample was
written by V1926, so the second list in a macro record is a candidate home for those triggers; the
one macro that uses it is the global tap tempo. *(reasoned, SD V1926, 2026-10)*
