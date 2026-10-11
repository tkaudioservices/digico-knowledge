<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="web/assets/tk-audio-lockup-light.svg">
    <img src="web/assets/tk-audio-lockup.svg" alt="tk Audio Services" width="420">
  </picture>
</p>

# DiGiCo Knowledge

A public knowledge base for DiGiCo SD-series consoles: how the files go together,
how I like a desk set up, and libraries pulled out of real session files, with a
small browser tool that reads a `.ses` file without the file ever leaving your machine.

**Site:** https://tkaudioservices.github.io/digico-knowledge/ (GitHub Pages, built from `web/`)

## What lives here

| Folder | What it holds |
|--------|---------------|
| [`format/`](format/README.md) | The file-format map. What a `.ses` is made of, what each section means, what is confirmed and what is a guess. |
| [`protocols/`](protocols/README.md) | How I like a console set up: naming, snapshots, fader banks, macros, patching, housekeeping. Opinionated and mine. |
| [`libraries/`](libraries/README.md) | Reusable things extracted from files: macro sets, bank layouts, channel templates. JSON, read by the site. |
| [`web/`](web/README.md) | The front end. Static HTML, CSS and JavaScript, no build step. Drop a `.ses` in, see what it holds. |
| [`tools/`](tools/README.md) | Command-line readers and the repo checks. Python, standard library only. |
| [`samples/`](samples/README.md) | Scrubbed outputs from real files. Never the files themselves. |
| [`inbox/`](inbox/README.md) | Raw findings, one dated file each, before they are folded into a topic file. |
| [`decisions/`](decisions/README.md) | Short records of why things are the way they are. |
| [`sessions/`](sessions/README.md) | Provenance: which working session produced which findings. |
| [`templates/`](templates/) | Blank fact note, protocol page and library entry. |

[`CONVENTIONS.md`](CONVENTIONS.md) is the authority on how facts are written and what may be committed.
[`CLAUDE.md`](CLAUDE.md) tells an AI session what to read first and how to file what it learns.

## Status

Started 11 October 2026. The format map is in [`format/ses/`](format/ses/README.md) and, with
diagrams, on the site's [Format page](https://tkaudioservices.github.io/digico-knowledge/format.html).
One decoder runs in `tools/ses_reader.py` and in the site's `web/js/ses.js`, held to one fixture
by `web/js/ses.test.mjs`; it reads SD5, SD7, SD8 and SD9 sessions from software V760 to V1926
(format revisions vA to vK), found by surveying an archive of 135 files. The site shows a decoded
overview, a signal-flow view per channel, tables, and exports to draw.io, CSV and JSON. Nothing is
bench-verified yet: structure is read from files, parameter meanings are inferred.

## Rules in one breath

Facts carry a tier, a software version and a date. Nothing from a client file is committed
without scrubbing. No show, venue, vessel, client or person names, ever. Contradictions are
added beside the old claim, never written over it.

## Licence

Code and documentation are under the [MIT licence](LICENSE). DiGiCo and SD-series are
trademarks of DiGiCo (UK) Ltd; this project is independent and not affiliated.

---

<sub>Made by <a href="https://tkaudioservices.com">tk Audio Services</a>. Audio system design,
engineering and programming for productions where it has to work.</sub>
