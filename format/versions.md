# SD-series software releases

The version slot in a claim tag is "what the About screen shows". This page lists the releases
DiGiCo's support site publishes so that `tools/check_repo.py --tags` has something to compare
against, and so a session's header word can be read against a real release number.

| Release | Date | Offline editor | Notes |
|---------|------|----------------|-------|
| V1742 | July 2024 | yes | *(documented, SD V1742, 2026-10)* [support.digico.biz, "SD Offline Software Version V1742"](https://support.digico.biz/hc/en-gb/search?query=SD+Offline+Software) |
| V1926 | November 2024 | yes, SD5 to SD12 | Macros fire from fader thresholds, meter levels, solos and snapshot recall; MacroOSC; global tap tempo entry. *(documented, SD V1926, 2026-10)* [SD Offline Software V1926](https://support.digico.biz/hc/en-gb/articles/29694649586065-SD-Offline-Software-V1926) |
| V2025 (V20) | March 2025 | yes | Fourier transform.engine control, Mustard Source Expander (Quantum). *(documented, SD V2025, 2026-10)* [SD Console Software V2025](https://support.digico.biz/hc/en-gb/articles/33952872713105-SD-Console-Software-V2025) |
| V2126 (V21) | December 2025 | yes | *(documented, SD V2126, 2026-10)* support site search listing |
| V22 | June 2026 | yes | Current at the time of writing. *(documented, SD V22, 2026-10)* support site search listing |

DiGiCo's own advice: prepare sessions in the same offline version the console runs; upward
compatibility is normal, downward is not guaranteed. The offline editor is Windows only.
*(documented, n/a, 2026-10)* [DiGiCo user FAQ](https://digico.biz/user-faq/)

## Reading a file's version

The sample session has 1926 (0x0786) as the u16 at 0x22 and was saved on 29 November 2025,
while V1926 was current from November 2024 until V2025 in March 2025 and V2126 landed in
December 2025. One file, one match: *(reasoned, SD V1926, 2026-10)* that 0x22 is the software
version that wrote the file. See [`ses/header.md`](ses/header.md) and `ses/open-questions.md` #11.
