# SD-series software releases and file format revisions

The version slot in a claim tag is "what the About screen shows". This page lists the releases
DiGiCo publishes and the file-format revisions seen, so that `tools/check_repo.py --tags` has
something to compare against and a header can be read against a real release.

## Releases on DiGiCo's support site

| Release | Date | Offline editor | Notes |
|---------|------|----------------|-------|
| V1742 | July 2024 | yes | *(documented, SD V1742, 2026-10)* [support site listing](https://support.digico.biz/hc/en-gb/search?query=SD+Offline+Software) |
| V1926 | November 2024 | yes, SD5 to SD12 | Macros fire from fader thresholds, meter levels, solos and snapshot recall; MacroOSC; global tap tempo entry. *(documented, SD V1926, 2026-10)* [SD Offline Software V1926](https://support.digico.biz/hc/en-gb/articles/29694649586065-SD-Offline-Software-V1926) |
| V2025 (V20) | March 2025 | yes | Fourier transform.engine control, Mustard Source Expander (Quantum). *(documented, SD V2025, 2026-10)* [SD Console Software V2025](https://support.digico.biz/hc/en-gb/articles/33952872713105-SD-Console-Software-V2025) |
| V2126 (V21) | December 2025 | yes | *(documented, SD V2126, 2026-10)* support site listing |
| V22 | June 2026 | yes | Current at the time of writing. *(documented, SD V22, 2026-10)* support site listing |

DiGiCo's own advice: prepare sessions in the same offline version the console runs; upward
compatibility is normal, downward is not guaranteed. The offline editor is Windows only.
*(documented, n/a, 2026-10)* [DiGiCo user FAQ](https://digico.biz/user-faq/)

## Format revisions seen in files

The two-letter tag at 0x14 and the u16 at 0x22 move together. Across 135 files from an archive
spanning 2013 to 2025 (SD5, SD7, SD8, SD9), every file with a given tag carried the same word at
0x22, and the words are release numbers. *(file-derived, SD various, 2026-10)*

| Tag | 0x22 | Consoles seen | Files | Sections | Offset table | Notes |
|-----|------|---------------|-------|----------|--------------|-------|
| v6 | 573 | SD8 | 1 | | 0x80 | |
| v7 | 634 | SD8 | 1 | | 0x80 | |
| v9 | 726 | SD7 | 26 | | 0x80 | |
| vA | 760 | SD7, SD8 | 21 | 23 | 0x80 | Decodes with the same component and object layout as vK |
| vB | 929 | SD7, SD8, SD9 | 4 | 23 | 0x100 | No `fc`, `e4`, `e5` sections |
| vC | 987 | SD7 | 18 | 23 | 0x100 | As vB |
| vF | 1280 | SD8 | 2 | 25 | 0x100 | Adds `fc` and `e4` |
| vG | 1455 | SD7 | 1 | 25 | 0x100 | As vF |
| vH | 1528 | SD7 | 61 | 26 | 0x100 | Adds `e5` |
| vK | 1926 | SD5 | 1 | 27 | 0x100 | Adds `ee`; macros gain the trigger list |

So 0x22 is the software version that wrote the file, and the tag is the file-format revision
that version writes. *(file-derived, SD various, 2026-10)* The reader finds sections by their
listed type byte, which is why every revision from vA up decodes with one parser; v6 to v9 have
not been tried beyond the header.

Sample rate sits at 0x77 when the table is at 0x100 and at 0x5F when it is at 0x80.
*(file-derived, SD various, 2026-10)*
