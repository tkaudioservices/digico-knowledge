# Samples

Scrubbed outputs from real session files. **Never the files themselves**; `.gitignore`
blocks them and `tools/check_repo.py` refuses to pass with one staged.

What may go here: JSON, CSV and text summaries produced by the reader, after every name
has been read and either confirmed generic or replaced. Name each set after its origin,
generically: `sd5-theatre-2025-v1.summary.txt`, not the show.

| Set | Origin | Files |
|-----|--------|-------|
| `sd5-theatre-2025-v1` | A 2025 SD5 theatre session, 45 snapshots, 100 input channels | `.summary.txt` (reader summary), `.channels.csv` (channel and bus list) |

Both were produced with `tools/ses_reader.py --scrub`, which replaces every channel, bus,
socket, snapshot, macro, bank and preset name with a neutral label (`IN 01`, `Snap 12`), then
read through. The equipment words left in (port and panel names such as `RME`, `Waves`,
`Local 1-8`) describe hardware, not the show.
