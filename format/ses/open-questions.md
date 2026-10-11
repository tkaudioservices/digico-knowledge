# Open questions

Things not yet known about the `.ses` format, and the test that would settle each.

| # | Question | What would settle it | Status |
|---|----------|----------------------|--------|
| 1 | Does the file carry a checksum or signature? | Rename one channel with the reader's `--rename`, open the result in the SD offline software. Opens: no checksum. Refuses: find it. | Open. Needs the offline software installed (x86 app; should run under emulation in an ARM Windows VM). |
| 2 | Are the inferred parameter IDs right? | In the offline software, set one fader, one send and one HPF to known values, save as new, diff against the original. | Open. |
| 3 | Where are snapshot cue numbers (1.00, 2.00 …) stored? | Not found in the file so far. Change one cue number in the software, save, diff. | Open. |
| 4 | How is the output patch encoded? (component type 14, parameter `fe`) | Change one output patch, save, diff. | Open. |
| 5 | Which software versions share this layout? | A second file from a different console or version. | Open. Only one sample so far. |
| 6 | Do two saves of the same show allow a snapshot-by-snapshot diff? | A later version of the same show, scrubbed. | Open. |

Add a row rather than editing one; strike through when settled and link the page that
records the answer.

Added 2026-10-11, from bringing the first session's notes across:

| # | Question | What would settle it | Status |
|---|----------|----------------------|--------|
| 7 | What is the u16 `0x03E0` after every snapshot timestamp? Constant across all 45 in the sample. | Change a per-snapshot setting (crossfade, MIDI, GPO) in the software, save, diff the trailer. | Open. |
| 8 | What are the 32-byte free-text field and the four 72-byte rows in the snapshot list header (before the first table)? | Edit snapshot-list settings and the snapshot notes in the software, save, diff. | Open. |
| 9 | What do the `page` byte and the second list in a macro record mean, and how are action types encoded beyond the four seen? | Build macros of each action type in the software, save, diff. | Open. |
| 10 | What do a fader bank's second label and 16-byte per-fader block control? | Change a bank label, a spill set and a fader's options, save, diff. | Open. |
| 11 | Which header word is the software version? `0x0786` at 0x22 is the candidate. | Save the same session from two software versions, compare the header. | Open. |
| 12 | Which of a component's two trailing references links a pool entry to its snapshot, and what is the u32 at +58? | Store one snapshot twice with one change, diff the pool. | Open. |
| 11a | Update to #11: 0x0786 at 0x22 equals release V1926, current when the sample was saved (29 Nov 2025, between V1926 of Nov 2024 and V2126 of Dec 2025). Treat 0x22 as the writing version until a second file disagrees. | A file saved from V2126 or V22 showing 2126 / 22xx at 0x22. | Narrowed. |
| 11b | Settles #11 and #11a: across 135 files the word at 0x22 is one of 573, 634, 726, 760, 929, 987, 1280, 1455, 1528, 1926, each paired with one format tag (v6 … vK). It is the writing software's version. | | ~~Settled~~ as `file-derived`; see `../versions.md`. |
| 5a | Narrows #5: vA (V760) to vK (V1926) share the component, object, snapshot, preset, bank and macro layouts; only the section list, the table position and the macro trigger list differ. v6 to v9 untested past the header. | Try a v9 file. | Narrowed. |
