# Conventions

The authority on how this repository is written. Where the README and this file disagree,
this file wins. It follows the pattern set by the Q-SYS knowledge repo, adjusted for a repo
that is **public**.

## 1. Scope

DiGiCo only. SD-series consoles, their offline software, and the files they read and write
(`.ses` sessions, snapshots, macros, presets, graphic EQ). Behaviour of other platforms a
DiGiCo talks to (Dante, Waves, OSC controllers, Q-SYS, QLab) belongs in that platform's
repo; this repo records only the DiGiCo side of the conversation and links across.

Design decisions for a particular show (cue numbering, which snapshot does what, who
mixes what) are show knowledge and stay out. A fact that only makes sense with a show's
design around it does not belong here.

## 2. Every claim ends in a tag

```
*(tier, version, date)*
```

| Slot | Values |
|------|--------|
| **tier** | `documented` (DiGiCo manual, release notes, or support, with the path or reference), `bench-verified` (observed on a console or in the offline software, with the test described), `file-derived` (read out of a session file and consistent across more than one file or more than one place), `reasoned` (inferred; a guess with an argument) |
| **version** | Console model and software version as the About screen shows them, for example `SD5 V1234` (write what you saw, do not round). `n/a` for claims that do not depend on a release (tooling). `unknown` is allowed and honest. |
| **date** | `YYYY-MM` |

A topic file may carry a default tag in its front matter. Claims that differ carry their own.

**A test in our own tools never raises a tier.** A parser agreeing with itself proves nothing.
Promotion to `bench-verified` needs an observation on a console or in the offline software;
a test then pins the behaviour so the parser cannot drift.

## 3. Contradictions are added, never overwritten

When a new observation disagrees with a recorded claim, write the new claim directly beneath
the old one with its own tag and a one-line note on the disagreement. Resolve by adding a
third line once something settles it. History stays legible.

## 4. The public-repo rules

This repo is public. The session files it learns from are not.

1. **No raw console files are committed.** `.gitignore` blocks them. Do not override it.
2. **No names.** No show, production, venue, vessel, operator, client, company or person
   names from any session file, in prose, examples, sample outputs, commit messages, branch
   names or screenshots. Describe the source generically: "a 2025 SD5 theatre session with
   45 snapshots".
3. **Scrub before you commit a derivative.** A JSON or CSV in `samples/` must have every
   channel, bus, snapshot, macro, socket and preset name either replaced with a neutral
   label (`CH 01`, `Snap 12`) or confirmed generic (`Kick`, `Vox 1`, `Lav 3` are fine).
   Run `python3 tools/check_repo.py` before committing; it blocks raw files and warns on
   the obvious leaks, and it is not a substitute for reading the file yourself.
4. **Genuinely generic names are fine.** Channel names like `Kick In`, `SM58`, `Q-SYS Rec L`
   describe equipment and roles, not people or shows.
5. **The scrub list is not in the repo.** If a list of words that must never appear is
   wanted, it lives in a gitignored `.banned-names` and a repository secret, as the Q-SYS
   repo does. The check script reads the local file if present.

## 5. Where things go

| What | Where |
|------|-------|
| How a file is laid out, byte by byte | `format/ses/` (one page per section) |
| What is not yet known about the format | `format/ses/open-questions.md` |
| How I like a desk set up | `protocols/` |
| Reusable extracted things the site should offer | `libraries/` as JSON, listed in `libraries/index.json` |
| A new raw finding not yet filed | `inbox/YYYY-MM-DD-slug.md` from `templates/fact-note.md` |
| Why a choice was made | `decisions/NNNN-slug.md` |
| Which working session produced what | `sessions/` |

## 6. Writing style

Short sentences. British spelling. Say what was seen, then what it probably means, then
how sure you are. Hex offsets are written `0x1A2B`; byte counts in decimal. Little-endian
unless stated. "Delphi" refers to the Object Pascal runtime conventions the files appear
to follow (length-prefixed strings, `TDateTime` doubles counted from 30 December 1899);
mark it `reasoned` until a release note says so.

## 7. The site is read-only

`web/` reads files in the browser and never uploads them. It has no backend and no build
step. Anything that needs a server is a different project. Libraries the site shows are the
JSON files in `libraries/`, copied into the site at deploy time.

## 8. Re-verify list

Any claim with `version` older than the current software release, or tier `reasoned`, is
on the re-verify list. `python3 tools/check_repo.py --tags` prints it.
