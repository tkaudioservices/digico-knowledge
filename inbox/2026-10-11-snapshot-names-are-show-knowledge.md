# Snapshot names and fader bank labels carry show knowledge; the scrub must replace them, not filter them

**Tier:** file-derived
**Version:** SD5 unknown
**Date:** 2026-10
**Source:** a 2025 SD5 theatre session, 45 snapshots, 34 fader banks

## What was seen

Snapshot trailers held song titles and act names; fader bank records carry two name fields,
and the second one held free text (a bank purpose) as often as a default like
`Input Channels`. Channel names mixed generic roles (`Kick`, `OH`) with performer codes and
playback-system labels.

## What it probably means

Nothing in a `.ses` can be assumed generic by field. A scrub that keeps "harmless-looking"
names would need a judgement per string; replacing every name with a label and reading the
result is the only method that scales. `tools/ses_reader.py --scrub` does that and leaves
only panel and port-group names (equipment) in place.

## How sure, and what would settle it

Certain for this sample. A banned-word list (`.banned-names`, gitignored) is still worth
keeping for the words that would identify the production if a future scrub misses a field.

## Files or pages this should fold into

- `samples/README.md` (method)
- `CONVENTIONS.md` §4.3
