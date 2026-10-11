---
default-tag: "(file-derived, SD5 unknown, 2026-10)"
---

# Patching

## Sockets are objects

Every input and output socket is a live-state object of kind 27–36 (inputs) or 77–86
(outputs), one component of type 17 or 18, with the socket's name in the usual 32-byte
field. Group order in the sample: 8 internal sources (oscillators, noise, talk mic), 16 local
I/O, then 64, 64, 64, 64, 56, 56, 64, 64 for the ports and racks. Outputs mirror it with 4
internal (headphones), 16 local, then the same port sizes. *(file-derived, SD5 unknown, 2026-10)*

## Panel names (section `c9`)

A u32 length and a CRLF text block listing the I/O panel pages in order: eight fixed pages
(`Misc`, `Graphic EQs`, `Effects`, `Channels`, `Groups`, `Auxes`, `Matrix`, `Solos`), then one
name per eight sockets (`Local 1-8`, `Local aes`, then the port and rack names in blocks of
eight), with blank lines where a block is unused. After the text, eight u32 values and then a
table of `(u8 socket offset, u8 port group, u16 0)` entries mapping each panel page to a
group and its first socket (`00 1C`, `08 1C`, `00 1D`, `08 1D` … `38 1D`). *(file-derived, SD5 unknown, 2026-10)*
for the text; *(reasoned, SD5 unknown, 2026-10)* for the map.

## Input patch

Component type 1, parameter `00`, index 0 for the main input and 1 for the alt input. The
4-byte value is `00 00 <socket index> <port group kind>`; zero means unpatched. Resolving
`(kind, index)` against the socket objects gives the socket name, and the readings make
sense throughout the sample: drum channels land on the rack whose sockets are named for
drums, a vocal channel's main input is a radio-mic socket and its alt input a playback
socket. *(file-derived, SD5 unknown, 2026-10)* for the encoding, since it resolves for
all 100 inputs.

FX returns use the same field with the port group set to 14, the FX-unit kind, and the
index selecting the unit. *(file-derived, SD5 unknown, 2026-10)*

## Output patch

Component type 14, parameter `fe`, carries a non-zero value on busses that have an output
(0x1454, 0x2854 seen as u32), but the two bytes do not resolve to an output socket group the
way the input encoding does. Open; see [`open-questions.md`](open-questions.md) #4.
