#!/usr/bin/env python3
"""Commit gate for a public repo that learns from private files.

Checks, in order:
  1. no console file (.ses and friends) is tracked by git
  2. every library JSON is valid, matches the shape in the schema (required keys and
     kind), and is listed in libraries/index.json; and every index entry exists
  3. optional: no word from a local .banned-names file appears anywhere tracked
  4. --tags: print the re-verify list (claims tagged reasoned, or with an old version)

Exit code 1 on any failure. Standard library only.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONSOLE_SUFFIXES = {".ses", ".snap", ".mac", ".pre", ".prs", ".dgs"}
KINDS = {"macros", "fader-banks", "channel-template", "snapshot-template", "naming", "patch", "other"}
REQUIRED = ["id", "kind", "title", "source", "extracted", "items"]
TAG_RE = re.compile(r"\*\((documented|bench-verified|file-derived|reasoned),\s*([^,]+?),\s*(\d{4}-\d{2})\)\*")


def tracked_files() -> list[Path]:
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout
    staged = subprocess.run(["git", "diff", "--cached", "--name-only", "-z"], cwd=ROOT,
                            capture_output=True, check=True).stdout
    names = {n for n in (out + staged).decode().split("\0") if n}
    return [ROOT / n for n in sorted(names)]


def check_no_console_files(files: list[Path]) -> list[str]:
    return [f"console file tracked: {p.relative_to(ROOT)}"
            for p in files if p.suffix.lower() in CONSOLE_SUFFIXES]


def check_libraries() -> list[str]:
    errors: list[str] = []
    lib_dir = ROOT / "libraries"
    index_path = lib_dir / "index.json"
    try:
        index = json.loads(index_path.read_text())
    except (OSError, json.JSONDecodeError) as e:
        return [f"libraries/index.json unreadable: {e}"]
    listed = {}
    for entry in index.get("libraries", []):
        for k in ("id", "kind", "title", "file"):
            if k not in entry:
                errors.append(f"index entry missing {k}: {entry}")
        if "file" in entry:
            listed[entry["file"]] = entry
            if not (lib_dir / entry["file"]).exists():
                errors.append(f"index points at a missing file: {entry['file']}")
    for path in sorted(lib_dir.rglob("*.json")):
        rel = path.relative_to(lib_dir).as_posix()
        if rel == "index.json" or rel.startswith("schema/"):
            continue
        try:
            lib = json.loads(path.read_text())
        except json.JSONDecodeError as e:
            errors.append(f"{rel}: invalid JSON: {e}")
            continue
        for k in REQUIRED:
            if k not in lib:
                errors.append(f"{rel}: missing required key {k}")
        if lib.get("kind") not in KINDS:
            errors.append(f"{rel}: kind {lib.get('kind')!r} not in {sorted(KINDS)}")
        if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", str(lib.get("id", ""))):
            errors.append(f"{rel}: id must be lower-case hyphenated")
        if not re.fullmatch(r"\d{4}-\d{2}", str(lib.get("extracted", ""))):
            errors.append(f"{rel}: extracted must be YYYY-MM")
        if not isinstance(lib.get("items"), list) or any("name" not in i for i in lib.get("items", [])):
            errors.append(f"{rel}: items must be a list of objects with a name")
        if rel not in listed:
            errors.append(f"{rel}: not listed in index.json")
        elif listed[rel].get("id") != lib.get("id"):
            errors.append(f"{rel}: id differs from index.json")
    return errors


def check_banned_words(files: list[Path]) -> list[str]:
    banned_path = ROOT / ".banned-names"
    if not banned_path.exists():
        return []
    words = [w.strip() for w in banned_path.read_text().splitlines() if w.strip() and not w.startswith("#")]
    if not words:
        return []
    pattern = re.compile(r"\b(" + "|".join(re.escape(w) for w in words) + r")\b")
    errors = []
    for p in files:
        try:
            text = p.read_text(errors="ignore")
        except OSError:
            continue
        for n, line in enumerate(text.splitlines(), 1):
            if pattern.search(line):
                errors.append(f"banned word in {p.relative_to(ROOT)}:{n}")
    return errors


def reverify_list(files: list[Path]) -> list[str]:
    rows = []
    for p in files:
        if p.suffix != ".md":
            continue
        for n, line in enumerate(p.read_text(errors="ignore").splitlines(), 1):
            for m in TAG_RE.finditer(line):
                tier, version, date = m.groups()
                if tier == "reasoned" or "unknown" in version:
                    rows.append(f"{p.relative_to(ROOT)}:{n}  ({tier}, {version.strip()}, {date})")
    return rows


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--tags", action="store_true", help="print the re-verify list and exit")
    args = ap.parse_args(argv)
    files = tracked_files()
    if args.tags:
        rows = reverify_list(files)
        print("\n".join(rows) if rows else "nothing to re-verify")
        return 0
    errors = check_no_console_files(files) + check_libraries() + check_banned_words(files)
    if errors:
        print("check_repo: FAIL")
        for e in errors:
            print("  -", e)
        return 1
    print(f"check_repo: ok ({len(files)} tracked files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
