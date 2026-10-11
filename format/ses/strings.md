---
default-tag: "(file-derived, SD5 unknown, 2026-10)"
---

# How text is stored

Four ways, all Object Pascal habits. *(reasoned, SD5 unknown, 2026-10)* for the attribution
to Delphi; the layouts themselves are file-derived.

## Fixed 32-byte name fields

Channel, bus, socket, snapshot-table, macro and preset-object names sit in 32-byte fields: one
length byte, up to 31 characters, then whatever was in the field before. The bytes past the
length are **junk**, not padding: a field that once held `Input Channels` and now holds
`Soundcheck` reads `Soundchecknels` to a naive string scanner. Only the length byte counts.
*(file-derived, SD5 unknown, 2026-10)*

Fader banks use the same scheme in 16-byte fields (15 characters). *(file-derived, SD5 unknown, 2026-10)*

## u16-length strings

The session name, snapshot names and the three preset labels are a u16 length followed by the
characters, no padding. These are the only variable-length strings seen, and the reason adding
or renaming a snapshot shifts everything after it. *(file-derived, SD5 unknown, 2026-10)*

## Timestamps

`TDateTime` doubles: days since 30 December 1899, fraction of a day for the time, local time
with no zone. Every component record carries one (last change), as do snapshot trailers and
preset entries. The newest component stamp in the live state is, in practice, the save time.
*(file-derived, SD5 unknown, 2026-10)*

## Text blocks

The I/O panel names (section 4) and the notes (section 20) are CRLF-separated text with a u32
length (panels) or the section size (notes). *(file-derived, SD5 unknown, 2026-10)*

## UTF-16

Only in section 25, as fragments (`Button`, a date, a settings phrase) inside 44-byte records.
Best read as memory that was written out, not as session data. *(reasoned, SD5 unknown, 2026-10)*

## For the scanner

A length-prefixed scan that insists the byte after the string is non-printable (as
`tools/ses_scan.py` does) misses nothing important here, because every live name is followed
by either junk that happens to be printable (rare) or zeros. The 32-byte fields mean the
same name appears 14 times per channel in the live state and again in every snapshot that
touches it; counting unique strings understates nothing, counting occurrences overstates
everything.
