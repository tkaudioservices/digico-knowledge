// Parity test: the browser scanner and the Python scanner must agree on the shared fixture.
// Run: node web/js/ses.test.mjs   (needs python3 on PATH)
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { scan, decode } from "./ses.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const fixture = join(root, "tools", "tests", "fixture.bin");

const js = await scan(new Uint8Array(readFileSync(fixture)), "fixture.bin");
const py = JSON.parse(execFileSync("python3", [join(root, "tools", "ses_scan.py"), fixture, "--json"], { encoding: "utf8" }));

assert.deepEqual(js.strings, py.strings, "strings differ between JS and Python");
assert.deepEqual(js.datetimes.map((d) => [d.offset, d.iso]), py.datetimes.map((d) => [d.offset, d.iso]), "datetimes differ");
assert.equal(js.identity.size, py.identity.size);
assert.equal(js.identity.sha256, py.identity.sha256);
assert.equal(js.identity.head_hex, py.identity.head_hex);
assert.equal(js.identity.zero_fraction, py.identity.zero_fraction);
console.log("ses.test: JS and Python scanners agree on the fixture");

// Decoder parity: the browser decoder and tools/ses_reader.py must read the synthetic session
// fixture (built by tools/tests/test_ses_reader.py) the same way.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
const sessionFixture = join(root, "tools", "tests", "fixture-session.bin");
const tmp = mkdtempSync(join(tmpdir(), "ses-parity-"));
try {
  const out = join(tmp, "py.json");
  execFileSync("python3", [join(root, "tools", "ses_reader.py"), sessionFixture, "--json", out], { encoding: "utf8" });
  const py = JSON.parse(readFileSync(out, "utf8"));
  const jsd = decode(new Uint8Array(readFileSync(sessionFixture)));
  assert.equal(jsd.recognised, true, jsd.reason);
  assert.equal(jsd.session_name, py.session_name);
  assert.equal(jsd.saved, py.saved);
  assert.deepEqual(jsd.file.section_offsets, py.file.section_offsets);
  assert.deepEqual(jsd.file.section_types, py.file.section_types);
  assert.deepEqual(jsd.objects.map((o) => [o.k, o.idx, o.kind, o.name, o.format, o.ref, o.headline, o.detail, o.component_types]),
    py.objects.map((o) => [o.k, o.idx, o.kind, o.name, o.format, o.ref, o.headline, o.detail, o.components.map((c) => c.type)]), "objects differ");
  assert.equal(jsd.file.version, py.file.version);
  assert.deepEqual(jsd.warnings, py.warnings);
  assert.equal(jsd.snapshot_components, py.snapshot_components.length);
  assert.deepEqual(jsd.snapshots.map((s) => [s.n, s.name, s.saved, s.w, s.objects]),
    py.snapshots.map((s) => [s.n, s.name, s.saved, s.w, s.objects.length]), "snapshots differ");
  assert.deepEqual(jsd.presets.map((p) => [p.name, p.category, p.sub, p.kind, p.format, p.saved, p.objects]),
    py.presets.map((p) => [p.name, p.category, p.sub, p.kind, p.format, p.saved, p.objects.length]), "presets differ");
  assert.deepEqual(jsd.panels, py.panels);
  assert.deepEqual(jsd.fader_banks, py.fader_banks, "fader banks differ");
  assert.deepEqual(jsd.macros, py.macros, "macros differ");
  assert.deepEqual(jsd.sets, py.sets);
  assert.deepEqual(jsd.abc_labels, py.abc_labels);
  assert.equal(jsd.notes, py.notes);
  console.log("ses.test: JS and Python decoders agree on the session fixture");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
