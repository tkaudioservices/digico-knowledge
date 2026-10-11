# A preset entry's third string can hold a person's name, so it must be scrubbed

**Tier:** file-derived
**Version:** SD5 unknown
**Date:** 2026-10
**Source:** a 2025 SD5 theatre session, 150 presets

## What was seen

Each preset entry ends with three u16-length strings (name, category, a third label), then
`0x000E`, a `TDateTime` and six bytes. The third string was empty on 142 of 150 entries. On
the eight entries in one user category it held a first name, apparently the performer the
channel preset was built for.

## What it probably means

The preset dialog has a third free-text field (or the category field is split in two) and
operators use it for who the setting belongs to.

## How sure, and what would settle it

Sure about the bytes. What the field is called in the software would come from saving a
preset with all three fields filled and reading the file back.

## Files or pages this should fold into

- `format/ses/presets.md` (already notes the scrub rule)
- `CONVENTIONS.md` §4.3: add "preset labels" to the list of things to scrub
