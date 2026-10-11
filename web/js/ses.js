// ses.js — reading DiGiCo session files in the browser.
//
// Two layers:
//   scan(buffer, name)   structure-agnostic heuristics (strings, stamps, identity).
//                        Mirrors tools/ses_scan.py byte for byte; tools/tests pins it.
//   decode(buffer)       the real format decoder. Returns {recognised:false} until the
//                        section map from format/ses/ is wired in. The UI shows whatever
//                        decode() returns under the Structure tab, so this is the seam.
//
// Nothing here uploads anything. The ArrayBuffer never leaves the page.

const PRINTABLE_LO = 0x20, PRINTABLE_HI = 0x7e;
const MIN_RUN = 4;
const MIN_PASCAL = 2;
const MAX_PASCAL = 64;
const DELPHI_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86400000;
const DT_MIN = (Date.UTC(2005, 0, 1) - DELPHI_EPOCH_MS) / DAY_MS;
const DT_MAX = (Date.UTC(2040, 0, 1) - DELPHI_EPOCH_MS) / DAY_MS;

const isPrint = (b) => b >= PRINTABLE_LO && b <= PRINTABLE_HI;
const ascii = (bytes, from, to, step = 1) => {
  let s = "";
  for (let i = from; i < to; i += step) s += String.fromCharCode(bytes[i]);
  return s;
};

export async function identity(bytes, name = "") {
  let sha256 = "";
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let zeros = 0;
  for (let i = 0; i < bytes.length; i++) if (bytes[i] === 0) zeros++;
  const head = bytes.subarray(0, 32);
  return {
    name,
    size: bytes.length,
    sha256,
    head_hex: [...head].map((b) => b.toString(16).padStart(2, "0")).join(" "),
    head_ascii: [...head].map((b) => (isPrint(b) ? String.fromCharCode(b) : ".")).join(""),
    zero_fraction: bytes.length ? Math.round((zeros / bytes.length) * 10000) / 10000 : 0,
  };
}

export function printableRuns(bytes, minRun = MIN_RUN) {
  const out = [];
  let start = null;
  for (let i = 0; i < bytes.length; i++) {
    if (isPrint(bytes[i])) {
      if (start === null) start = i;
    } else if (start !== null) {
      if (i - start >= minRun) out.push({ offset: start, text: ascii(bytes, start, i) });
      start = null;
    }
  }
  if (start !== null && bytes.length - start >= minRun) out.push({ offset: start, text: ascii(bytes, start, bytes.length) });
  return out;
}

function allPrint(bytes, from, to) {
  for (let i = from; i < to; i++) if (!isPrint(bytes[i])) return false;
  return true;
}

export function pascalStrings(bytes, lo = MIN_PASCAL, hi = MAX_PASCAL) {
  const out = [];
  const n = bytes.length;
  for (let i = 0; i < n - 1; i++) {
    const length = bytes[i];
    if (length < lo || length > hi) continue;
    const end = i + 1 + length;
    if (end > n) continue;
    if (allPrint(bytes, i + 1, end) && (end === n || !isPrint(bytes[end]))) {
      out.push({ offset: i, length, text: ascii(bytes, i + 1, end) });
    }
  }
  return out;
}

export function pascal32Strings(bytes, lo = MIN_PASCAL, hi = MAX_PASCAL) {
  const out = [];
  const n = bytes.length;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < n - 4; i++) {
    const length = view.getUint32(i, true);
    if (length < lo || length > hi) continue;
    const end = i + 4 + length;
    if (end > n) continue;
    if (allPrint(bytes, i + 4, end) && (end === n || !isPrint(bytes[end]))) {
      out.push({ offset: i, length, text: ascii(bytes, i + 4, end) });
    }
  }
  return out;
}

export function utf16Runs(bytes, minRun = MIN_RUN) {
  const out = [];
  const n = bytes.length;
  for (const align of [0, 1]) {
    let start = null;
    let i = align;
    for (; i + 1 < n; i += 2) {
      const ok = isPrint(bytes[i]) && bytes[i + 1] === 0;
      if (ok && start === null) start = i;
      if (!ok && start !== null) {
        if ((i - start) / 2 >= minRun) out.push({ offset: start, text: ascii(bytes, start, i, 2) });
        start = null;
      }
    }
    if (start !== null && (i - start) / 2 >= minRun) out.push({ offset: start, text: ascii(bytes, start, i, 2) });
  }
  out.sort((a, b) => a.offset - b.offset);
  return out;
}

export function candidateDatetimes(bytes) {
  const out = [];
  const n = bytes.length;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < n - 8; i++) {
    const v = view.getFloat64(i, true);
    if (!(v >= DT_MIN && v < DT_MAX)) continue;
    if (v === Math.trunc(v)) continue;
    const when = new Date(DELPHI_EPOCH_MS + v * DAY_MS);
    out.push({ offset: i, value: v, iso: when.toISOString().replace(/\.\d{3}Z$/, "Z") });
  }
  return out;
}

export async function scan(buffer, name = "") {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return {
    identity: await identity(bytes, name),
    strings: {
      pascal8: pascalStrings(bytes),
      pascal32: pascal32Strings(bytes),
      runs: printableRuns(bytes),
      utf16: utf16Runs(bytes),
    },
    datetimes: candidateDatetimes(bytes),
    heuristic: true,
  };
}

// ---- the seam for the real decoder -------------------------------------------------
// When the section map lands, this grows into: read the offset table, walk the component
// records, resolve the patch, list snapshots. Keep it returning a plain object the UI can
// render as a tree; keep every claim it relies on tagged in format/ses/.
export function decode(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return {
    recognised: false,
    reason: "The section decoder is not wired in yet. The heuristic scan above still applies.",
    bytes: bytes.length,
    format_notes: "format/ses/README.md",
  };
}
