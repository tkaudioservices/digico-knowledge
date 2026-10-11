# The u16 at 0x22 looks like the software version that wrote the file

**Tier:** reasoned
**Version:** SD V1926
**Date:** 2026-10
**Source:** a 2025 SD5 theatre session, 45 snapshots; DiGiCo's support site release list

## What was seen

The header word at 0x22 is 0x0786 = 1926. The file's newest timestamp is 29 November 2025.
DiGiCo's SD releases around then: V1926 (November 2024), V2025 (March 2025), V2126 (December
2025). No other version-shaped number or string exists in the file.

## What it probably means

0x22 records the console software version that saved the session, as an integer. The console
was still on V1926 in November 2025, which is ordinary for an installed desk.

## How sure, and what would settle it

One file, one coincidence of a four-digit number with a release number; good odds but not
proof. A file saved from V2126 or V22 with 2126 or a 22xx value at 0x22 settles it.

## Files or pages this should fold into

- `format/ses/header.md` (row for 0x22 already updated)
- `format/versions.md`
