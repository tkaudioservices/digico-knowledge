---
default-tag: "(file-derived, SD5 unknown, 2026-10)"
---

# The component record

Every processing block on every channel, bus, socket, FX unit and graphic EQ is one
"component". The same record appears in the live state, in the preset library and in the
snapshot pool: 17,567 of them parse with one layout in the sample. *(file-derived, SD5 unknown, 2026-10)*

## Layout

Offsets from the 4-byte marker.

| Offset | Size | Field |
|--------|------|-------|
| +0 | 4 | Marker `da 00 3a 00`. The `3a` (58) is the length of the fixed part that follows. |
| +4 | u32 | Component type (table below) |
| +8 | 32 | Name: length byte + up to 31 chars, junk after (see [`strings.md`](strings.md)). A copy of the owning object's name. |
| +40 | f64 | `TDateTime` of the last change |
| +48 | u32 | Number of parameter records |
| +52 | u8, u32, u8, u32 | Flags. The u8 at +57 is 1 in the live state and 0 elsewhere; the u32 at +58 is 0 in the live state and presets and a small number in the snapshot pool *(reasoned, SD5 unknown, 2026-10)*. |
| +62 | n × 8 | Parameter records |
| after | i32, i32, u32 | Two signed references (either may be -1) and a zero word. In the live state both are -1; in the snapshot pool one is usually an index. *(reasoned, SD5 unknown, 2026-10)* for what they point at. |

A parameter record is 8 bytes: `id`, `type` (repeats the component type, a useful sanity
check), `index` (band, send, module or leg number), `flag`, then a 4-byte value that is
an f32 for continuous controls and an integer or packed bytes otherwise. *(file-derived, SD5 unknown, 2026-10)*

## Component types

| Type | Where | Content | Params |
|------|-------|---------|--------|
| 1 | inputs, talkback in | Input stage: trim, patch, flags | 18 |
| 2 | inputs, groups | Aux sends, 12 params per aux | 432 (36 auxes) |
| 3 | inputs, groups | Group routing, one flag per group | 17 |
| 4 | all channels | EQ: 4 bands on inputs, 8 on busses | 51 / 76 |
| 5 | all channels | Multiband compressor and de-esser | 45 |
| 6 | matrix inputs | Unknown | |
| 7 | inputs | HPF and LPF | 4 |
| 8 | all channels | Two dynamics modules | 18 |
| 9 | all channels | Three flags, unknown | 3 |
| 10 | most objects | Empty placeholder | 0 |
| 11 | busses | Bus input stage | 12 |
| 12 | all channels | Output: fader, mute, routing flags | 29 |
| 13 | inputs, groups | Six values; one is 0.001 (a delay?) | 6 |
| 14 | all channels | Output patch and format | 7 |
| 15 | graphic EQs | 32 band gains and on/off | 38 |
| 16 | control groups | Fader and mute | 10 |
| 17 | input sockets | Socket settings | 9 |
| 18 | output sockets | Socket settings | small |
| 19 | inputs, groups | 23 values, two at 0.5: pan or LCR position | 23 |
| 21 | FX units | FX parameters | 14 |
| 23, 24, 33 | solos, monitoring, talkback | | |

Types 1–5, 7, 8, 11, 12, 14–18 and 21 are identified from their values; 6, 9, 13, 19 and the
rest are placeholders until a bench test. *(reasoned, SD5 unknown, 2026-10)*

## Parameters identified

All *(reasoned, SD5 unknown, 2026-10)* unless noted: the readings fit the values (a vocal
channel with a 136 Hz high-pass, a 4:1 compressor and cuts at 206 and 440 Hz) but none has
been changed in the software and diffed.

| Type | Param[index] | Meaning | Note |
|------|--------------|---------|------|
| 1 | `00[0]`, `00[1]` | Main and alt input patch | Value bytes `00 00 <socket> <port group>`; 0 = unpatched. See [`patch.md`](patch.md). |
| 1 | `01[0]` | Input trim or gain, dB | |
| 1 | `12[0]`=1, `11[0]`=3 | Constant on every channel seen | |
| 7 | `03[0]`, `05[0]` | LPF on, LPF Hz | 25000 when off |
| 7 | `03[1]`, `05[1]` | HPF on, HPF Hz | |
| 8 | `01[m]` | Threshold dB, module m = 0 or 1 | |
| 8 | `e1[m]` | Ratio | 4.0, 2.0 seen |
| 8 | `e9[m]`, `e8[m]` | On, format or link | |
| 4 | `04[b]`, `05[b]`, `06[b]`, `07[b]` | Band b on, Hz, Q, gain dB | b = 0–3 inputs, 0–7 busses |
| 4 | `0e[b]`, `11[b]`, `12[b]`, `10[b]` | Dynamic EQ threshold, attack, release, ratio | |
| 5 | `0e[b]`, `10[b]`, `11[b]`, `12[b]` | Band b threshold, ratio, attack, release; b = 0–2 | |
| 5 | `05[0]`, `05[1]` | Crossover Hz | |
| 5 | `05[3]`, `0e[3]`, `0a[3]` | De-esser Hz, threshold, range | |
| 12 | `21[0]` | Fader, dB; -150 is off | |
| 12 | `22[0]` | Mute, 1 = muted | |
| 12 | `04[0]`, `05[0]`, `0b[0]`, `0c[0]` | Routing and mode flags | |
| 2 | `01[a]`, `02[a]` | Send to aux a: level dB (-150 off), on | 36 auxes in the sample |
| 2 | `04[a]`, `0c[a]`, `10[a]` | Pre/post, a second level, and a value of 60 on stereo channels | |
| 3 | `09[g]` | 1 when routed to group g | 17 groups |
| 16 | `21[0]`, `22[0]` | Control group fader dB, mute | |
| 15 | `02[0]`, `07[b]` | Graphic EQ on, band b gain, b = 0–31 | |
| 14 | `fe[0]` | Output patch | Encoding open; see [`patch.md`](patch.md) |
| 21 | `2e`, `0f`, `01`, `00[0..1]` | FX level, pre-delay, mix, input patch | |

## Reading a component in Python

```python
typ   = u32(d, m + 4)
name  = d[m + 9 : m + 9 + d[m + 8]]
n     = u32(d, m + 48)
params = [(d[p], d[p + 2], d[p + 3], d[p + 4:p + 8]) for p in range(m + 62, m + 62 + 8 * n, 8)]
end   = m + 62 + 8 * n + 12
```

`tools/ses_reader.py` does exactly this; the byte at `p + 1` must equal `typ` or the walk is
off the rails.
