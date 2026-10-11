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

// ---- the decoder -------------------------------------------------------------------
// Mirrors tools/ses_reader.py and the pages in format/ses/. Same layout, same names, same
// headline fields, so web/js/ses.test.mjs can hold the two to the same fixture.
// Nothing here uploads anything.

const KIND = { 1: "input", 5: "aux", 6: "group", 7: "bus leg (R/C of stereo/LCR bus)", 8: "monitoring",
  9: "talkback", 10: "control group", 11: "solo", 12: "talkback in", 14: "fx unit", 15: "matrix in",
  16: "matrix out", 17: "graphic eq", 18: "kind 18 (?)" };
const FORMAT = { 1: "mono", 2: "stereo", 3: "LCR", 4: "LCRS (?)" };
export const COMP = { 1: "input stage", 2: "aux sends", 3: "group routing", 4: "eq", 5: "multiband comp / de-esser",
  6: "type 6 (?)", 7: "hpf/lpf", 8: "dynamics x2", 9: "type 9 (?)", 10: "empty", 11: "bus input",
  12: "output: fader, mute, pan (?)", 13: "type 13 (delay?)", 14: "output patch (?)", 15: "graphic eq",
  16: "control group fader", 17: "input port", 18: "output port", 19: "pan / lcr (?)", 21: "fx unit",
  23: "solo (?)", 24: "monitoring (?)", 33: "talkback (?)" };

export function kindName(k) {
  if (k >= 27 && k <= 36) return "input port";
  if (k >= 77 && k <= 86) return "output port";
  return KIND[k] ?? `kind ${k}`;
}

const latin1 = (bytes, from, to) => { let s = ""; for (let i = from; i < to; i++) s += String.fromCharCode(bytes[i]); return s; };
const hexOf = (bytes, from, to) => { let s = ""; for (let i = from; i < to; i++) s += bytes[i].toString(16).padStart(2, "0"); return s; };
const pstr = (bytes, o, width) => latin1(bytes, o + 1, o + 1 + Math.min(bytes[o], width - 1));
const pad2 = (n) => String(n).padStart(2, "0");

export function tdt(x) {
  if (!x || !(x >= 1) || x > 100000) return null;
  const d = new Date(DELPHI_EPOCH_MS + Math.round(x * DAY_MS));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

class Reader {
  constructor(bytes) {
    this.b = bytes;
    this.v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  u8(o) { return this.b[o]; }
  u16(o) { return this.v.getUint16(o, true); }
  u32(o) { return this.v.getUint32(o, true); }
  i32(o) { return this.v.getInt32(o, true); }
  f32(o) { return this.v.getFloat32(o, true); }
  f64(o) { return this.v.getFloat64(o, true); }
  wstr(o) { const ln = this.u16(o); return [latin1(this.b, o + 2, o + 2 + ln), o + 2 + ln]; }
  bytesAt(o, seq) { for (let i = 0; i < seq.length; i++) if (this.b[o + i] !== seq[i]) return false; return true; }

  // format/ses/components.md
  component(o) {
    if (!this.bytesAt(o, [0xda, 0x00, 0x3a, 0x00])) throw new Error(`no component marker at 0x${o.toString(16)}`);
    const type = this.u32(o + 4);
    const n = this.u32(o + 48);
    const c = { off: o, type, name: pstr(this.b, o + 8, 32), ts: this.f64(o + 40), f4: this.u32(o + 58), params: [] };
    let p = o + 62;
    for (let i = 0; i < n; i++) {
      if (this.b[p + 1] !== type) throw new Error(`param/type mismatch at 0x${p.toString(16)}`);
      c.params.push({ id: this.b[p], idx: this.b[p + 2], flag: this.b[p + 3], raw: this.b.subarray(p + 4, p + 8) });
      p += 8;
    }
    c.ref_a = this.i32(p); c.ref = this.i32(p + 4);
    if (this.u32(p + 8) !== 0) throw new Error(`unexpected component trailer at 0x${p.toString(16)}`);
    c.end = p + 12;
    return c;
  }
  footer(o) {
    if (!this.bytesAt(o, [0x27, 0x00])) throw new Error(`no object footer at 0x${o.toString(16)}`);
    return { off: o, idx: this.b[o + 2], kind: this.b[o + 3], name: pstr(this.b, o + 4, 32), ref: this.i32(o + 36), fmt: this.b[o + 40], end: o + 41 };
  }
  liveObject(p) {
    if (!this.bytesAt(p, [0xd5, 0x00, 0x01, 0x00, 0x01])) throw new Error(`no inline object at 0x${p.toString(16)}`);
    const n = this.u32(p + 5); p += 9;
    const comps = [];
    for (let i = 0; i < n; i++) { const c = this.component(p); comps.push(c); p = c.end; }
    const f = this.footer(p); f.comps = comps;
    return f;
  }
}

const param = (c, id, idx = 0) => c.params.find((p) => p.id === id && p.idx === idx)?.raw ?? null;
const pf = (c, id, idx = 0) => { const r = param(c, id, idx); return r ? new DataView(r.buffer, r.byteOffset, 4).getFloat32(0, true) : null; };
const round2 = (x) => Math.round(x * 100) / 100;

export function decode(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  try {
    return decodeSession(bytes);
  } catch (err) {
    return { recognised: false, reason: err.message, bytes: bytes.length, format_notes: "format/ses/README.md" };
  }
}

function decodeSession(bytes) {
  const r = new Reader(bytes);
  if (latin1(bytes, 0, 6) !== "DiGiCo") throw new Error("not a DiGiCo .ses file (no DiGiCo signature in the first bytes)");
  const model = latin1(bytes, 11, 15).trim();
  const format_tag = latin1(bytes, 20, 22);
  const version = r.u16(0x22);                       // software version that wrote the file
  const first = r.u16(0x20);                         // offset of section 0, repeated as the table's first entry
  const table_off = [0x100, 0x80].find((t) => first && r.u32(t) === first);
  if (table_off === undefined) throw new Error(`no section offset table found (first section at 0x${first.toString(16)})`);
  const offs = [];
  for (let o = table_off; r.u32(o) !== 0; o += 4) offs.push(r.u32(o));
  if (offs.length < 10) throw new Error(`section table too short (${offs.length} entries)`);
  // one type byte per section after section 0, at table + 0xa1; sections are found by type, not position
  const types = Array.from(bytes.subarray(table_off + 0xa1, table_off + 0xa1 + offs.length - 2));
  const byType = new Map();
  types.forEach((t, i) => { if (!byType.has(t)) byType.set(t, i + 1); });
  const sec = (t) => {
    const i = t === 0 ? 0 : byType.get(t);
    if (i === undefined) throw new Error(`no section of type 0x${t.toString(16)} in this file`);
    return [offs[i], offs[i + 1]];
  };
  const sample_rate = r.f32(table_off === 0x100 ? 0x77 : 0x5f);
  const warnings = [];
  const attempt = (label, fn) => { try { return fn(); } catch (err) { warnings.push(`${label}: ${err.message}`); return null; } };

  // session name
  const session_name = attempt("name", () => r.wstr(offs[0] + 2)[0]) ?? "";

  // live state (d3)
  const live = [];
  attempt("live", () => {
    const [s] = sec(0xd3);
    if (!r.bytesAt(s, [0xd3, 0x00])) throw new Error("live-state section does not start with d3 00");
    const nobj = r.u32(s + 2);
    let p = s + 6;
    for (let k = 0; k < nobj; k++) { const o = r.liveObject(p); o.k = k; live.push(o); p = o.end; }
  });
  if (!live.length) throw new Error("live state did not parse: " + warnings.join("; "));

  // snapshots (d2)
  const flat = [];
  const snapshots = [];
  let snapshot_list_label = "", snapshot_count = 0;
  attempt("snapshots", () => {
    const [s, e] = sec(0xd2);
    if (!r.bytesAt(s, [0xd2, 0x00])) throw new Error("snapshot section does not start with d2 00");
    const ncomp = r.u32(s + 4);
    let p = s + 8;
    for (let i = 0; i < ncomp; i++) { const c = r.component(p); flat.push(c); p = c.end; }
    snapshot_list_label = pstr(bytes, p + 10, 32);
    const tables = [];
    for (let o = p; o + 11 <= e; o++) {
      if (bytes[o] === 0xd3 && bytes[o + 1] === 0x00 && bytes[o + 6] === 0xd5 && bytes[o + 7] === 0x00 &&
          bytes[o + 8] === 0x01 && bytes[o + 9] === 0x00 && bytes[o + 10] === 0x00) tables.push(o);
    }
    if (tables.length) snapshot_count = r.u32(tables[0] - 4);
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      const nobj = r.u32(t + 2);
      let q = t + 6;
      const objs = [];
      for (let k = 0; k < nobj; k++) {
        if (!r.bytesAt(q, [0xd5, 0x00, 0x01, 0x00, 0x00])) throw new Error(`snapshot table object expected at 0x${q.toString(16)}`);
        const n = r.u32(q + 5);
        const refs = [];
        for (let j = 0; j < n; j++) refs.push(r.u32(q + 9 + 4 * j));
        q += 9 + 4 * n;
        const f = r.footer(q); f.k = k; f.refs = refs; objs.push(f); q = f.end;
      }
      const [name, q2] = r.wstr(q);
      snapshots.push({ n: i + 1, table: t, name, ts: r.f64(q2), w: r.u16(q2 + 8), objs });
    }
  });

  // presets (db)
  const presets = [];
  attempt("presets", () => {
    const [s] = sec(0xdb);
    if (!r.bytesAt(s, [0xdb, 0x00])) throw new Error("preset section does not start with db 00");
    const count = r.u32(s + 2);
    let p = s + 6;
    for (let i = 0; i < count; i++) {
      if (!r.bytesAt(p, [0xd7, 0x00])) break;
      const nobj = r.u32(p + 2); p += 6;
      const objs = [];
      for (let j = 0; j < nobj; j++) { const o = r.liveObject(p); objs.push(o); p = o.end; }
      let name, category, sub;
      [name, p] = r.wstr(p); [category, p] = r.wstr(p); [sub, p] = r.wstr(p);
      const ts = r.f64(p + 2); p += 16;
      presets.push({ name, category, sub, kind: objs[0]?.kind ?? null, fmt: objs[0]?.fmt ?? null, ts, objs });
    }
  });

  // panel names (c9)
  const panels = attempt("panels", () => { const [s] = sec(0xc9); const ln = r.u32(s + 2); return latin1(bytes, s + 6, s + 6 + ln).split("\r\n"); }) ?? [];

  // fader banks (f3), 361-byte records
  const banks = [];
  attempt("banks", () => {
    const [s] = sec(0xf3);
    const count = r.u32(s + 2);
    let p = s + 6;
    for (let i = 0; i < count; i++) {
      const reclen = r.u16(p);
      const faders = [];
      for (let j = 0; j < 12; j++) faders.push([bytes[p + 35 + 2 * j], bytes[p + 36 + 2 * j]]);
      banks.push({ idx: r.u16(p + 2), name: pstr(bytes, p + 4, 16), faders, label: pstr(bytes, p + 311, 16), rgb: hexOf(bytes, p + 327, p + 330) });
      p += reclen;
    }
  });

  // macros (f8); the trigger list after the actions arrived with V1926
  const macros = [];
  attempt("macros", () => {
    const [s, e] = sec(0xf8);
    const count = r.u32(s + 2);
    let p = s + 6;
    const reclist = (p) => {
      const n = r.u32(p); p += 4;
      const items = [];
      for (let i = 0; i < Math.min(n, 4096); i++) {
        const ln = r.u16(p);
        if (ln < 2 || p + ln > e) throw new Error(`bad macro record at 0x${p.toString(16)}`);
        items.push(hexOf(bytes, p + 2, p + ln)); p += ln;
      }
      return [items, p];
    };
    for (let i = 0; i < count && p + 44 <= e; i++) {
      const m = { idx: r.u16(p), page: bytes[p + 34], slot: bytes[p + 35], name: pstr(bytes, p + 2, 32), rgb: hexOf(bytes, p + 36, p + 39) };
      [m.actions, p] = reclist(p + 40);
      m.extra = [];
      if (version >= 1926) [m.extra, p] = reclist(p);
      macros.push(m);
    }
  });

  // sets (f9), A/B/C labels (fa), notes (eb)
  const sets = attempt("sets", () => { const [s, e] = sec(0xf9); const out = []; for (let j = 0; j < Math.floor((e - s - 2) / 20); j++) out.push({ name: pstr(bytes, s + 2 + 20 * j, 16), rgb: hexOf(bytes, s + 18 + 20 * j, s + 21 + 20 * j) }); return out; }) ?? [];
  const abc_labels = attempt("abc", () => { const [s, e] = sec(0xfa); const out = []; for (let j = 0; j < Math.floor((e - s - 2) / 19); j++) out.push(pstr(bytes, s + 2 + 19 * j, 16)); return out; }) ?? [];
  const notes = attempt("notes", () => { const [s, e] = sec(0xeb); return latin1(bytes, s + 2, e); }) ?? "";

  let saved = 0;
  for (const o of live) for (const c of o.comps) if (c.ts > saved) saved = c.ts;

  // ---- views, mirroring ses_reader.channel_row / patch_name / resolve
  const findObj = (kind, idx) => live.find((o) => o.kind === kind && o.idx === idx);
  const patchName = (raw) => {
    if (!raw) return null;
    if (raw[0] === 0 && raw[1] === 0 && raw[2] === 0 && raw[3] === 0) return "-";
    const idx = raw[2], kind = raw[3];
    const o = findObj(kind, idx);
    return o ? `${kindName(kind)}${kind}:${idx + 1} ${o.name}`.trim() : `kind${kind}:${idx + 1}`;
  };
  const resolve = (ch, kind) => { if (kind === 0) return "-"; const o = findObj(kind, ch); return o ? o.name : `${kindName(kind)} ${ch}`; };
  const comp = (o, t) => o.comps.find((c) => c.type === t) ?? null;
  const headline = (o) => {
    const out = comp(o, 12) ?? comp(o, 16);
    const row = { k: o.k, kind: kindName(o.kind), name: o.name, format: FORMAT[o.fmt] ?? o.fmt,
      fader_dB: null, mute: null, hpf_Hz: null, lpf_Hz: null, patch_main: null, patch_alt: null, sends_on: null };
    if (out) { row.fader_dB = round2(pf(out, 0x21) ?? 0); const m = pf(out, 0x22); row.mute = m === null ? null : m !== 0; }
    const flt = comp(o, 7);
    if (flt) {
      if ((pf(flt, 0x03, 1) ?? 0) !== 0) row.hpf_Hz = Math.round(pf(flt, 0x05, 1) ?? 0);
      if ((pf(flt, 0x03, 0) ?? 0) !== 0) row.lpf_Hz = Math.round(pf(flt, 0x05, 0) ?? 0);
    }
    const inp = comp(o, 1);
    if (inp) { row.patch_main = patchName(param(inp, 0x00, 0)); row.patch_alt = patchName(param(inp, 0x00, 1)); }
    const snd = comp(o, 2);
    if (snd) row.sends_on = snd.params.filter((p) => p.id === 0x02 && new DataView(p.raw.buffer, p.raw.byteOffset, 4).getFloat32(0, true) !== 0).length;
    return row;
  };

  const f32v = (raw) => new DataView(raw.buffer, raw.byteOffset, 4).getFloat32(0, true);
  const idxs = (c, pid) => [...new Set(c.params.filter((p) => p.id === pid).map((p) => p.idx))].sort((a, b) => a - b);
  const detail = (o) => {
    const det = { trim_dB: null, hpf: null, lpf: null, eq: [], dyn: [], sends: [], groups: [] };
    const inp = comp(o, 1);
    if (inp) det.trim_dB = pf(inp, 0x01, 0);
    const flt = comp(o, 7);
    if (flt) {
      det.lpf = { on: (pf(flt, 0x03, 0) ?? 0) !== 0, hz: pf(flt, 0x05, 0) };
      det.hpf = { on: (pf(flt, 0x03, 1) ?? 0) !== 0, hz: pf(flt, 0x05, 1) };
    }
    const eq = comp(o, 4);
    if (eq) det.eq = idxs(eq, 0x05).map((b) => ({ band: b, on: (pf(eq, 0x04, b) ?? 0) !== 0, hz: pf(eq, 0x05, b), q: pf(eq, 0x06, b), gain_dB: pf(eq, 0x07, b) }));
    const dyn = comp(o, 8);
    if (dyn) det.dyn = idxs(dyn, 0x01).map((m) => ({ module: m, thr_dB: pf(dyn, 0x01, m), ratio: pf(dyn, 0xe1, m), on: (pf(dyn, 0xe9, m) ?? 0) !== 0 }));
    const snd = comp(o, 2);
    if (snd) det.sends = idxs(snd, 0x01).map((a) => ({ aux: a, dB: pf(snd, 0x01, a), on: (pf(snd, 0x02, a) ?? 0) !== 0, pre: (pf(snd, 0x04, a) ?? 0) !== 0 }));
    const grp = comp(o, 3);
    if (grp) det.groups = grp.params.filter((p) => p.id === 0x09 && f32v(p.raw) !== 0).map((p) => p.idx).sort((a, b) => a - b);
    return det;
  };
  const DETAIL_KINDS = new Set([1, 5, 6, 7, 10, 15, 16]);

  const counts = {};
  for (const o of live) { const k = kindName(o.kind); counts[k] = (counts[k] ?? 0) + 1; }

  return {
    recognised: true,
    file: { model, format_tag, version, size: bytes.length, sample_rate, table_offset: table_off, section_offsets: offs, section_types: types },
    warnings,
    session_name, saved: tdt(saved), counts,
    objects: live.map((o) => ({ k: o.k, idx: o.idx, kind: o.kind, kind_name: kindName(o.kind), name: o.name, format: o.fmt, ref: o.ref,
      headline: headline(o), detail: DETAIL_KINDS.has(o.kind) ? detail(o) : null, component_types: o.comps.map((c) => c.type) })),
    snapshot_components: flat.length,
    snapshot_list_label, snapshot_count,
    snapshots: snapshots.map((s) => ({ n: s.n, name: s.name, saved: tdt(s.ts), w: s.w, objects: s.objs.length })),
    presets: presets.map((p) => ({ name: p.name, category: p.category, sub: p.sub, kind: kindName(p.kind), format: p.fmt, saved: tdt(p.ts), objects: p.objs.length })),
    panels,
    fader_banks: banks.map((b) => ({ idx: b.idx, name: b.name, label: b.label, rgb: b.rgb, faders: b.faders.map(([ch, kind]) => ({ ch, kind, name: resolve(ch, kind) })) })),
    macros, sets, abc_labels, notes,
  };
}
