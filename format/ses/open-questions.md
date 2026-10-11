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
