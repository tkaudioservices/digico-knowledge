// Parity test: the browser scanner and the Python scanner must agree on the shared fixture.
// Run: node web/js/ses.test.mjs   (needs python3 on PATH)
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { scan } from "./ses.js";

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
