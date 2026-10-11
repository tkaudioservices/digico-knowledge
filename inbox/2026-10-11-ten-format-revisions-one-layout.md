# Ten format revisions, one component layout: sections move, records do not

**Tier:** file-derived
**Version:** SD various (V760 to V1926)
**Date:** 2026-10
**Source:** 135 session files from one archive: SD5, SD7, SD8 and SD9, saved between 2013 and 2025

## What was seen

Format tags v6, v7, v9, vA, vB, vC, vF, vG, vH and vK, each paired with one value at 0x22
(573, 634, 726, 760, 929, 987, 1280, 1455, 1528, 1926). From vB the offset table is at 0x100;
vA and earlier keep it at 0x80 with the sample-rate float at 0x5F instead of 0x77. The section
list grows from 23 to 27 types across the revisions, so a given section's position moves.
Macro records gain a second list after their actions at V1926.

With sections located by their listed type byte and the macro list keyed on the version word,
one parser walks vA, vB, vC, vF, vG, vH and vK files completely, and the browser and Python
decoders agree on all seven.

## What it probably means

The record formats (component, object footer, snapshot pool and table, preset entry, bank
record, macro record) have been stable since at least V760. New features add sections or
append to records rather than reshaping them.

## How sure, and what would settle it

Sure for the seven files tried. v6, v7 and v9 files exist in the archive and were not walked
past the header; one of each would settle whether the table-at-0x80 layout is the same there.

## Files or pages this should fold into

- `format/versions.md` (written)
- `format/ses/header.md`, `format/ses/macros.md` (updated)
