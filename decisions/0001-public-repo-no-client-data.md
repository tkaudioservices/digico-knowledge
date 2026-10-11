# 0001: public repo, no client data

**Date:** 2026-10-11

## Decision

`digico-knowledge` is public. In exchange, nothing identifying a client, show, venue,
vessel or person enters it: not raw files, not names inside derived outputs, not commit
messages. Sources are described generically.

## Why

The knowledge (how the format works, how I set up a desk) is worth sharing and benefits
from being linkable. The files it is learnt from belong to productions and are often
confidential. Keeping the two apart by rule, with a check script and an ignore list, is
simpler than deciding case by case.

## Consequences

- `.gitignore` blocks console file types; `tools/check_repo.py` fails if one is tracked.
- `samples/` holds only scrubbed derivatives.
- The banned-word list, if used, is kept out of the repo (gitignored `.banned-names`).
