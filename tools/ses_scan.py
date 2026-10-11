#!/usr/bin/env python3
"""Structure-agnostic scan of a DiGiCo session file (or any binary).

Works before the format is understood and keeps working as a fallback afterwards.
The heuristics here are mirrored in web/js/ses.js; tools/tests pins them.

Nothing in this file knows a show name. Nothing in this file should.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

PRINTABLE = set(range(0x20, 0x7F))
MIN_RUN = 4            # shortest run of printable bytes worth reporting
MIN_PASCAL = 2         # shortest length-prefixed string worth reporting
MAX_PASCAL = 64        # a channel name or longer label; above this it is probably not a string
DELPHI_EPOCH = datetime(1899, 12, 30, tzinfo=timezone.utc)
# TDateTime window: 1 Jan 2005 .. 31 Dec 2039, as days since the Delphi epoch.
DT_MIN = (datetime(2005, 1, 1, tzinfo=timezone.utc) - DELPHI_EPOCH).days
DT_MAX = (datetime(2040, 1, 1, tzinfo=timezone.utc) - DELPHI_EPOCH).days


def identity(data: bytes, name: str = "") -> dict:
    return {
        "name": name,
        "size": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "head_hex": data[:32].hex(" "),
        "head_ascii": "".join(chr(b) if b in PRINTABLE else "." for b in data[:32]),
        "zero_fraction": round(data.count(0) / len(data), 4) if data else 0.0,
    }


def printable_runs(data: bytes, min_run: int = MIN_RUN) -> list[dict]:
    """Runs of printable ASCII, the classic `strings` view."""
    out, start = [], None
    for i, b in enumerate(data):
        if b in PRINTABLE:
            if start is None:
                start = i
        elif start is not None:
            if i - start >= min_run:
                out.append({"offset": start, "text": data[start:i].decode("ascii")})
            start = None
    if start is not None and len(data) - start >= min_run:
        out.append({"offset": start, "text": data[start:].decode("ascii")})
    return out


def pascal_strings(data: bytes, lo: int = MIN_PASCAL, hi: int = MAX_PASCAL) -> list[dict]:
    """Length-prefixed strings: one length byte N followed by N printable bytes, and the
    byte after is not printable (so the string ends where the length says it does).
    That trailing test removes most false hits inside ordinary text."""
    out = []
    n = len(data)
    for i in range(n - 1):
        length = data[i]
        if length < lo or length > hi:
            continue
        end = i + 1 + length
        if end > n:
            continue
        chunk = data[i + 1:end]
        if all(b in PRINTABLE for b in chunk) and (end == n or data[end] not in PRINTABLE):
            out.append({"offset": i, "length": length, "text": chunk.decode("ascii")})
    return out


def pascal32_strings(data: bytes, lo: int = MIN_PASCAL, hi: int = MAX_PASCAL) -> list[dict]:
    """Strings with a 32-bit little-endian length prefix, as a Delphi TStream writer emits."""
    out = []
    n = len(data)
    for i in range(0, n - 4):
        length = struct.unpack_from("<I", data, i)[0]
        if length < lo or length > hi:
            continue
        end = i + 4 + length
        if end > n:
            continue
        chunk = data[i + 4:end]
        if all(b in PRINTABLE for b in chunk) and (end == n or data[end] not in PRINTABLE):
            out.append({"offset": i, "length": length, "text": chunk.decode("ascii")})
    return out


def utf16_runs(data: bytes, min_run: int = MIN_RUN) -> list[dict]:
    """Printable UTF-16LE runs (ASCII range only), at both byte alignments."""
    out = []
    n = len(data)
    for align in (0, 1):
        start = None
        i = align
        while i + 1 < n:
            ok = data[i] in PRINTABLE and data[i + 1] == 0
            if ok and start is None:
                start = i
            if not ok and start is not None:
                count = (i - start) // 2
                if count >= min_run:
                    out.append({"offset": start, "text": data[start:i:2].decode("ascii")})
                start = None
            i += 2
        if start is not None and (i - start) // 2 >= min_run:
            out.append({"offset": start, "text": data[start:i:2].decode("ascii")})
    out.sort(key=lambda s: s["offset"])
    return out


def candidate_datetimes(data: bytes) -> list[dict]:
    """Doubles that read as a plausible Delphi TDateTime (2005..2039) with a time part."""
    out = []
    n = len(data)
    for i in range(0, n - 8):
        v = struct.unpack_from("<d", data, i)[0]
        if not (DT_MIN <= v < DT_MAX):
            continue
        frac = v - int(v)
        if frac == 0.0:
            continue  # a bare date is too easy to hit by accident
        when = DELPHI_EPOCH + timedelta(days=v)
        out.append({"offset": i, "value": v, "iso": when.strftime("%Y-%m-%dT%H:%M:%SZ")})
    return out


def scan(data: bytes, name: str = "") -> dict:
    return {
        "identity": identity(data, name),
        "strings": {
            "pascal8": pascal_strings(data),
            "pascal32": pascal32_strings(data),
            "runs": printable_runs(data),
            "utf16": utf16_runs(data),
        },
        "datetimes": candidate_datetimes(data),
        "heuristic": True,
    }


def summarise(result: dict) -> str:
    ident = result["identity"]
    s = result["strings"]
    lines = [
        f"File:      {ident['name'] or '(stdin)'}",
        f"Size:      {ident['size']} bytes",
        f"SHA-256:   {ident['sha256']}",
        f"Head:      {ident['head_hex']}",
        f"           {ident['head_ascii']}",
        f"Zeros:     {ident['zero_fraction'] * 100:.1f}%",
        "",
        f"Length-prefixed strings (8-bit):  {len(s['pascal8'])}",
        f"Length-prefixed strings (32-bit): {len(s['pascal32'])}",
        f"Printable runs:                   {len(s['runs'])}",
        f"UTF-16 runs:                      {len(s['utf16'])}",
        f"Candidate TDateTime stamps:       {len(result['datetimes'])}",
    ]
    if result["datetimes"]:
        lines.append("")
        lines.append("First stamps:")
        for d in result["datetimes"][:10]:
            lines.append(f"  0x{d['offset']:08X}  {d['iso']}")
    if s["pascal8"]:
        lines.append("")
        lines.append("First length-prefixed strings:")
        for p in s["pascal8"][:25]:
            lines.append(f"  0x{p['offset']:08X}  {p['text']}")
    lines.append("")
    lines.append("All of the above is heuristic. See format/ses/README.md for what is confirmed.")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("file", type=Path)
    ap.add_argument("--json", action="store_true", help="emit the full scan as JSON")
    ap.add_argument("--strings", action="store_true", help="emit recovered strings, one per line")
    args = ap.parse_args(argv)

    data = args.file.read_bytes()
    result = scan(data, args.file.name)
    if args.json:
        json.dump(result, sys.stdout, indent=2)
        sys.stdout.write("\n")
    elif args.strings:
        seen = set()
        for group in ("pascal8", "pascal32", "runs", "utf16"):
            for s in result["strings"][group]:
                if s["text"] not in seen:
                    seen.add(s["text"])
                    print(s["text"])
    else:
        print(summarise(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
