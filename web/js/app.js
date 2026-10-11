// app.js — the page. Wires the drop zone to the scanner and the decoder, renders the tabs,
// draws the signal flow, writes the exports, loads libraries. Nothing leaves the browser.
import { scan, decode, kindName } from "./ses.js";
import { createHexView } from "./hexview.js";

const $ = (id) => document.getElementById(id);
const fmtBytes = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;
const hex = (n) => "0x" + n.toString(16).toUpperCase().padStart(6, "0");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = (v, d = 1) => (v === null || v === undefined) ? "" : (typeof v === "number" ? v.toFixed(d) : String(v));
const dB = (v) => v === null || v === undefined ? "" : v <= -149 ? "off" : `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`;
const hz = (v) => v === null || v === undefined ? "" : v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 1 : 2).replace(/\.?0+$/, "")} kHz` : `${Math.round(v)} Hz`;

let state = { bytes: null, result: null, structure: null, hexView: null, name: "", selected: null };

// ---- file intake -------------------------------------------------------------------
const drop = $("drop"), fileInput = $("file"), status = $("status");
$("pick").addEventListener("click", (e) => { e.stopPropagation(); fileInput.click(); });
drop.addEventListener("click", () => fileInput.click());
drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
fileInput.addEventListener("change", () => { if (fileInput.files[0]) load(fileInput.files[0]); fileInput.value = ""; });
for (const ev of ["dragenter", "dragover"]) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("is-over"); });
for (const ev of ["dragleave", "drop"]) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("is-over"); });
drop.addEventListener("drop", (e) => { const f = e.dataTransfer?.files?.[0]; if (f) load(f); });
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => e.preventDefault());
$("clear").addEventListener("click", () => {
  state = { bytes: null, result: null, structure: null, hexView: null, name: "", selected: null };
  $("results").hidden = true; status.textContent = "";
  history.replaceState(null, "", "#reader");
});

async function load(file) {
  status.textContent = `Reading ${file.name} (${fmtBytes(file.size)})…`;
  const t0 = performance.now();
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const structure = decode(bytes);
    const result = await scan(bytes, file.name);
    state = { bytes, result, structure, name: file.name, hexView: null, selected: null };
    render();
    const ms = Math.round(performance.now() - t0);
    status.textContent = structure.recognised
      ? `Decoded ${structure.file.model} session, V${structure.file.version}, in ${ms} ms. Read in your browser only.`
      : `Scanned in ${ms} ms. Not a session this decoder knows (${structure.reason}). Read in your browser only.`;
    $("results").hidden = false;
    $("results").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    status.textContent = `Could not read that file: ${err.message}`;
  }
}

// ---- tabs --------------------------------------------------------------------------
const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
function showTab(name) {
  for (const t of tabs) {
    const on = t.dataset.tab === name;
    t.setAttribute("aria-selected", String(on));
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  }
  if (name === "hex" && state.bytes && !state.hexView) state.hexView = createHexView($("hex"), state.bytes);
}
for (const t of tabs) t.addEventListener("click", () => showTab(t.dataset.tab));
function jumpToHex(offset, length) {
  showTab("hex");
  if (!state.hexView) state.hexView = createHexView($("hex"), state.bytes);
  state.hexView.goTo(offset, length);
}

// ---- rendering ---------------------------------------------------------------------
function render() {
  const { result, structure: st, name } = state;
  const id = result.identity, s = result.strings;
  $("r-name").textContent = st.recognised ? st.session_name || name : name;
  $("r-kick").textContent = st.recognised ? `${st.file.model} session · ${name}` : "File";
  $("o-head").textContent = `${id.head_hex}\n${id.head_ascii}`;

  const decoded = st.recognised;
  for (const t of tabs) if (t.dataset.tab === "flow" || t.dataset.tab === "structure") t.hidden = !decoded;

  if (decoded) {
    const objs = st.objects;
    const n = (k) => objs.filter((o) => o.kind === k).length;
    const sockets = objs.filter((o) => (o.kind >= 27 && o.kind <= 36) || (o.kind >= 77 && o.kind <= 86)).length;
    $("tiles").innerHTML = [
      ["Console", `${st.file.model} <span class="small muted">V${st.file.version} · ${st.file.format_tag}</span>`],
      ["Input channels", n(1)], ["Auxes · groups", `${n(5)} · ${n(6)}`], ["Matrix", `${n(15)}×${n(16)}`],
      ["Snapshots", st.snapshots.length], ["Fader banks", st.fader_banks.length], ["Macros", st.macros.length],
      ["Presets", st.presets.length], ["Sockets", sockets], ["Last change", `<span class="small">${esc(st.saved ?? "unknown")}</span>`],
    ].map(([k, v]) => `<div class="tile"><span class="tile__k">${k}</span><span class="tile__v">${v}</span></div>`).join("");
    const fx = objs.filter((o) => o.kind === 14).map((o) => o.name).join(", ");
    $("ov-decoded").innerHTML = `
      <p><strong>${esc(st.session_name)}</strong> on an ${esc(st.file.model)} running V${st.file.version}, file format ${esc(st.file.format_tag)},
        ${st.file.sample_rate} Hz, ${fmtBytes(st.file.size)}. ${n(1)} input channels, ${n(5)} auxes, ${n(6)} groups,
        ${n(10)} control groups, ${n(14)} FX units${fx ? ` (${esc(fx)})` : ""}, ${n(17)} graphic EQs.
        ${st.snapshots.length} snapshots sharing ${st.snapshot_components.toLocaleString()} stored processing blocks.</p>
      ${st.warnings.length ? `<p class="warn">Some sections did not decode: ${esc(st.warnings.join("; "))}. The rest is shown.</p>` : ""}
      ${renderMixOverview(st, null)}
      <p class="muted small">Session structure: sockets feed input channels; channels route to groups and send to auxes; busses feed the
        matrix and the outputs. Pick a channel under <strong>Signal flow</strong> to see its path with levels.</p>`;
    $("ov-note").innerHTML = `<strong>What is read, what is inferred.</strong> Names, counts, patches and values are read from the file as it
      is laid out. What each parameter <em>means</em> (that 0x21 is the fader, that 0x05 is a frequency) is inferred from the values
      and tagged <code>reasoned</code> in the <a href="format.html">format notes</a> until it is checked in the offline software.`;
  } else {
    $("tiles").innerHTML = [
      ["Size", fmtBytes(id.size)], ["Names (length-prefixed)", (s.pascal8.length + s.pascal32.length).toLocaleString()],
      ["Printable runs", s.runs.length.toLocaleString()], ["Candidate stamps", result.datetimes.length.toLocaleString()],
      ["Zero bytes", `${(id.zero_fraction * 100).toFixed(1)}%`],
    ].map(([k, v]) => `<div class="tile"><span class="tile__k">${k}</span><span class="tile__v">${v}</span></div>`).join("")
      + `<div class="tile tile--wide"><span class="tile__k">SHA-256</span><span class="tile__v small">${id.sha256 || "unavailable (needs https or localhost)"}</span></div>`;
    $("ov-decoded").innerHTML = "";
    $("ov-note").innerHTML = `<strong>Not decoded.</strong> ${esc(st.reason)} Everything on this page is recovered by pattern, not by a
      confirmed format map. If this is a DiGiCo session from a console or version the notes do not cover yet, the
      <a href="https://github.com/tkaudioservices/digico-knowledge/issues" rel="noopener">repository</a> would like to know the console and
      software version (never the file).`;
  }

  // most frequent length-prefixed strings
  const freq = new Map();
  for (const x of [...s.pascal8, ...s.pascal32]) freq.set(x.text, (freq.get(x.text) || 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 40);
  $("o-names").innerHTML = top.length
    ? top.map(([t, c]) => `<li data-text="${esc(t)}">${esc(t)}${c > 1 ? `<b>×${c}</b>` : ""}</li>`).join("")
    : '<li class="muted">none found</li>';
  $("o-names").onclick = (e) => {
    const li = e.target.closest("li[data-text]"); if (!li) return;
    showTab("strings"); $("s-group").value = "pascal8"; $("s-filter").value = li.dataset.text; renderStrings();
  };

  renderStrings();
  renderDates();
  if (decoded) { renderStructure(st); renderFlow(st); }
  $("st-json").textContent = JSON.stringify(st, null, 2);
  state.hexView = null; $("hex").innerHTML = "";
  showTab("overview");
}

function renderStrings() {
  if (!state.result) return;
  const group = $("s-group").value;
  const q = $("s-filter").value.trim().toLowerCase();
  const unique = $("s-unique").checked;
  let rows = state.result.strings[group];
  if (q) rows = rows.filter((r) => r.text.toLowerCase().includes(q));
  if (unique) { const seen = new Set(); rows = rows.filter((r) => !seen.has(r.text) && seen.add(r.text)); }
  $("s-count").textContent = `${rows.length.toLocaleString()} match${rows.length === 1 ? "" : "es"}`;
  const tbody = $("s-table").querySelector("tbody");
  tbody.innerHTML = rows.slice(0, 2000).map((r) =>
    `<tr data-off="${r.offset}" data-len="${r.length ?? r.text.length}"><td class="off">${hex(r.offset)}</td><td class="num">${r.length ?? r.text.length}</td><td class="mono">${esc(r.text)}</td></tr>`
  ).join("");
}
for (const id of ["s-group", "s-filter", "s-unique"]) $(id).addEventListener("input", renderStrings);
$("s-table").addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-off]"); if (!tr) return;
  const group = $("s-group").value;
  const prefix = group === "pascal8" ? 1 : group === "pascal32" ? 4 : 0;
  const mult = group === "utf16" ? 2 : 1;
  jumpToHex(+tr.dataset.off, prefix + (+tr.dataset.len) * mult);
});

function renderDates() {
  const tbody = $("d-table").querySelector("tbody");
  const rows = state.result.datetimes.slice(0, 2000);
  tbody.innerHTML = rows.length
    ? rows.map((d) => `<tr data-off="${d.offset}"><td class="off">${hex(d.offset)}</td><td class="mono">${d.iso.replace("T", " ").replace("Z", "")}</td><td class="num">${d.value.toFixed(6)}</td></tr>`).join("")
    : '<tr><td colspan="3" class="muted">none found</td></tr>';
}
$("d-table").addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-off]"); if (tr) jumpToHex(+tr.dataset.off, 8);
});

// ---- tables ------------------------------------------------------------------------
function table(headers, rows, numCols = new Set()) {
  if (!rows.length) return '<p class="muted small">none</p>';
  const th = headers.map((h, i) => `<th class="${numCols.has(i) ? "num" : ""}">${esc(h)}</th>`).join("");
  const body = rows.map((r) => `<tr>${r.map((c, i) => `<td class="${numCols.has(i) ? "num" : /^0x/.test(String(c)) ? "mono" : ""}">${esc(c ?? "")}</td>`).join("")}</tr>`).join("");
  return `<div class="tablewrap"><table class="data"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
}
const section = (title, inner, open = false) => `<details class="st" ${open ? "open" : ""}><summary>${esc(title)}</summary>${inner}</details>`;

function renderStructure(st) {
  const el = $("st-view");
  const objs = st.objects;
  const byKind = (...kinds) => objs.filter((o) => kinds.includes(o.kind));
  const chRow = (o) => { const h = o.headline; return [o.idx + 1, o.name, h.format, num(h.fader_dB, 2), h.mute ? "MUTE" : "", h.hpf_Hz ?? "", h.lpf_Hz ?? "", h.patch_main ?? "", h.patch_alt ?? "", h.sends_on ?? ""]; };
  const busRow = (o) => { const h = o.headline; return [o.idx + 1, o.name, h.format, num(h.fader_dB, 2), h.mute ? "MUTE" : ""]; };
  const sockets = [...new Set(objs.filter((o) => (o.kind >= 27 && o.kind <= 36) || (o.kind >= 77 && o.kind <= 86)).map((o) => o.kind))]
    .map((k) => { const g = objs.filter((o) => o.kind === k); const named = g.filter((o) => o.name).map((o) => o.name); return [`${k >= 77 ? "out" : "in"} ${k}`, g.length, named.length, named.join(", ")]; });
  el.innerHTML = `
    ${section(`Input channels (${byKind(1).length})`, table(["#", "Name", "Format", "Fader dB", "Mute", "HPF Hz", "LPF Hz", "Input", "Alt input", "Sends on"], byKind(1).map(chRow), new Set([0, 3, 5, 6, 9])), true)}
    ${section(`Aux busses (${byKind(5).length})`, table(["#", "Name", "Format", "Fader dB", "Mute"], byKind(5).map(busRow), new Set([0, 3])))}
    ${section(`Groups (${byKind(6).length})`, table(["#", "Name", "Format", "Fader dB", "Mute"], byKind(6).map(busRow), new Set([0, 3])))}
    ${section(`Matrix (${byKind(15).length} in, ${byKind(16).length} out)`, table(["#", "Name", "Format", "Fader dB", "Mute"], [...byKind(15), ...byKind(16)].map(busRow), new Set([0, 3])))}
    ${section(`Control groups (${byKind(10).length})`, table(["#", "Name", "Fader dB", "Mute"], byKind(10).map((o) => [o.idx + 1, o.name, num(o.headline.fader_dB, 2), o.headline.mute ? "MUTE" : ""]), new Set([0, 2])))}
    ${section(`FX units (${byKind(14).length}) and graphic EQs (${byKind(17).length})`, `<p class="small">${esc(byKind(14).map((o) => o.name).join(", "))}</p><p class="small muted">${esc(byKind(17).map((o) => o.name).join(", "))}</p>`)}
    ${section(`Snapshots (${st.snapshots.length})`, table(["#", "Name", "Last stored", "Objects"], st.snapshots.map((s) => [s.n, s.name, s.saved ?? "", s.objects]), new Set([0, 3])), true)}
    ${section(`Fader banks (${st.fader_banks.length})`, table(["#", "Name", "Label", "Colour", "Faders"], st.fader_banks.map((b) => [b.idx, b.name, b.label, "#" + b.rgb, b.faders.map((f) => f.name).join(", ")]), new Set([0])))}
    ${section(`Macros (${st.macros.length})`, table(["#", "Page", "Slot", "Colour", "Name", "Actions"], st.macros.map((m) => [m.idx, m.page, m.slot, "#" + m.rgb, m.name, m.actions.length]), new Set([0, 1, 2, 5])))}
    ${section(`Presets (${st.presets.length})`, table(["Name", "Category", "Label", "Kind", "Saved"], st.presets.map((p) => [p.name, p.category, p.sub, p.kind, p.saved ?? ""])))}
    ${section(`Sockets (${sockets.reduce((a, r) => a + r[1], 0)})`, table(["Group", "Sockets", "Named", "Names"], sockets, new Set([1, 2])))}
    ${section("Panels, sets, labels, notes", `<p class="small">${esc(st.panels.filter(Boolean).join(", "))}</p><p class="small muted">${esc(st.sets.map((x) => x.name).join(", "))}</p><p class="small muted">${esc(st.abc_labels.join(", "))}</p><pre class="codeblock small">${esc(st.notes.trim() || "(no notes)")}</pre>`)}
  `;
}

// ---- signal flow -------------------------------------------------------------------
const FLOW_KINDS = [1, 5, 6, 15, 16];
const auxList = (st) => st.objects.filter((o) => o.kind === 5);
const groupList = (st) => st.objects.filter((o) => o.kind === 6);
const auxName = (st, a) => auxList(st)[a]?.name ?? `Aux ${a + 1}`;
const groupName = (st, g) => groupList(st)[g]?.name ?? `Group ${g + 1}`;
const feeders = (st, o) => {
  // inputs (and groups) that route to this group / send to this aux
  const inputs = st.objects.filter((x) => x.detail && (x.kind === 1 || x.kind === 6) && x !== o);
  if (o.kind === 6) { const g = groupList(st).indexOf(o); return inputs.filter((x) => x.detail.groups.includes(g)).map((x) => ({ obj: x, label: "" })); }
  if (o.kind === 5) { const a = auxList(st).indexOf(o); return inputs.map((x) => ({ obj: x, s: x.detail.sends.find((s) => s.aux === a) })).filter((r) => r.s && r.s.on && r.s.dB > -149).map((r) => ({ obj: r.obj, label: dB(r.s.dB) })); }
  return [];
};

function renderFlow(st) {
  const el = $("flow-view");
  const list = st.objects.filter((o) => FLOW_KINDS.includes(o.kind) && o.detail);
  if (!state.selected || !list.includes(state.selected)) state.selected = list.find((o) => o.kind === 1) ?? list[0] ?? null;
  const sel = state.selected;
  el.innerHTML = `
    <div class="flow">
      <div class="flow__pick">
        <label class="small muted" for="flow-filter">Channel or bus</label>
        <input type="search" id="flow-filter" class="mono" placeholder="filter by name" autocomplete="off">
        <ul class="flow__list" id="flow-list"></ul>
        <p class="muted small">Inputs, auxes, groups and matrix. Levels are the live state, not a snapshot.</p>
      </div>
      <div>
        <div class="diagram" id="flow-strip"></div>
        <div class="legend"><span>routing</span><span class="send">aux send with level</span><span class="off">off or unpatched</span></div>
        <div class="diagram" id="flow-mix" style="margin-top:1rem"></div>
      </div>
    </div>`;
  const ul = $("flow-list");
  const paint = () => {
    const q = $("flow-filter").value.trim().toLowerCase();
    ul.innerHTML = list.filter((o) => !q || o.name.toLowerCase().includes(q) || kindName(o.kind).includes(q))
      .map((o) => `<li data-k="${o.k}" aria-selected="${o === sel}"><span>${esc(o.name) || "(unnamed)"}</span><span class="k">${esc(kindName(o.kind))} ${o.idx + 1}</span></li>`).join("");
  };
  paint();
  $("flow-filter").addEventListener("input", paint);
  ul.addEventListener("click", (e) => { const li = e.target.closest("li[data-k]"); if (!li) return; state.selected = st.objects[+li.dataset.k]; renderFlow(st); });
  if (sel) {
    $("flow-strip").innerHTML = renderStrip(st, sel);
    $("flow-mix").innerHTML = renderMixOverview(st, sel);
  }
}

function renderStrip(st, o) {
  const d = o.detail, h = o.headline;
  const boxes = [];
  if (o.kind === 1) {
    boxes.push({ t: "Input", l: [h.patch_main ?? "unpatched", h.patch_alt && h.patch_alt !== "-" ? `alt ${h.patch_alt}` : ""], off: !h.patch_main || h.patch_main === "-" });
    boxes.push({ t: "Trim", l: [dB(d.trim_dB)] });
  } else {
    boxes.push({ t: kindName(o.kind), l: [`${feeders(st, o).length} sources`] });
  }
  if (d.hpf || d.lpf) boxes.push({ t: "Filters", l: [`HPF ${d.hpf?.on ? hz(d.hpf.hz) : "off"}`, `LPF ${d.lpf?.on ? hz(d.lpf.hz) : "off"}`], off: !(d.hpf?.on || d.lpf?.on) });
  if (d.eq.length) boxes.push({ t: `EQ ${d.eq.length} band`, l: d.eq.map((b) => `${b.on ? "" : "(off) "}${hz(b.hz)} ${b.gain_dB > 0 ? "+" : ""}${num(b.gain_dB, 1)} dB Q${num(b.q, 1)}`), off: !d.eq.some((b) => b.on && Math.abs(b.gain_dB) > 0.05) });
  if (d.dyn.length) boxes.push({ t: "Dynamics", l: d.dyn.map((m) => `${m.module + 1}: ${m.on ? "" : "(off) "}thr ${num(m.thr_dB, 1)} dB · ${num(m.ratio, 1)}:1`), off: !d.dyn.some((m) => m.on) });
  boxes.push({ t: "Fader", l: [dB(h.fader_dB), h.mute ? "MUTED" : ""], mute: h.mute });
  const W = 150, H = 26 + 14 * Math.max(2, ...boxes.map((b) => b.l.length)), GAP = 34, X0 = 10, Y0 = 36;
  const groups = d.groups.map((g) => ({ name: groupName(st, g), send: false }));
  const sends = d.sends.filter((s) => s.on && s.dB > -149).map((s) => ({ name: auxName(st, s.aux), send: true, label: dB(s.dB) + (s.pre ? " pre" : "") }));
  const outs = [...groups, ...sends];
  const fanX = X0 + boxes.length * (W + GAP), fanH = Math.max(H, outs.length * 20 + 10);
  const totalW = fanX + 240, totalH = Y0 + Math.max(H, fanH) + 20;
  let svg = `<svg viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" role="img" aria-label="Signal path of ${esc(o.name)}">`;
  svg += `<text class="lbl head" x="${X0}" y="18">${esc(o.name)} · ${esc(kindName(o.kind))} ${o.idx + 1} · ${esc(h.format)}</text>`;
  boxes.forEach((b, i) => {
    const x = X0 + i * (W + GAP), y = Y0;
    svg += `<rect class="box ${b.off ? "off" : ""}" x="${x}" y="${y}" width="${W}" height="${H}" rx="3"/>`;
    svg += `<text class="lbl" x="${x + 8}" y="${y + 17}" font-weight="600">${esc(b.t)}</text>`;
    b.l.filter(Boolean).forEach((line, j) => { svg += `<text class="lbl val ${b.mute ? "mute" : ""}" x="${x + 8}" y="${y + 31 + j * 14}">${esc(line)}</text>`; });
    if (i < boxes.length - 1) svg += `<line class="wire ${b.off ? "off" : ""}" x1="${x + W}" y1="${y + H / 2}" x2="${x + W + GAP}" y2="${y + H / 2}"/>`;
  });
  const lastX = X0 + (boxes.length - 1) * (W + GAP) + W, midY = Y0 + H / 2;
  if (!outs.length) svg += `<text class="lbl small" x="${lastX + 12}" y="${midY + 4}">no group routing or active sends</text>`;
  outs.forEach((r, i) => {
    const y = Y0 + 10 + i * 20;
    svg += `<path class="wire ${r.send ? "send" : ""}" d="M${lastX} ${midY} C ${lastX + 40} ${midY}, ${fanX - 40} ${y}, ${fanX} ${y}"/>`;
    svg += `<circle class="pin" cx="${fanX}" cy="${y}" r="2.5"/>`;
    svg += `<text class="lbl" x="${fanX + 8}" y="${y + 4}">${esc(r.name)}${r.label ? ` <tspan class="lbl val">${esc(r.label)}</tspan>` : ""}</text>`;
  });
  svg += "</svg>";
  const fed = feeders(st, o);
  const fedHtml = o.kind === 5 || o.kind === 6 ? `<p class="small" style="margin:.6rem 0 0">Fed by ${fed.length}: ${esc(fed.slice(0, 40).map((f) => f.obj.name + (f.label ? ` (${f.label})` : "")).join(", "))}${fed.length > 40 ? " …" : ""}</p>` : "";
  return svg + fedHtml;
}

function renderMixOverview(st, sel) {
  const cols = [
    { t: "Input channels", items: st.objects.filter((o) => o.kind === 1) },
    { t: "Groups", items: groupList(st) },
    { t: "Auxes", items: auxList(st) },
    { t: "Matrix out", items: st.objects.filter((o) => o.kind === 16) },
  ];
  const rowH = 14, colW = 190, gap = 60, X0 = 10, Y0 = 30;
  const maxRows = Math.max(...cols.map((c) => c.items.length));
  const totalH = Y0 + Math.min(maxRows, 120) * rowH + 20, totalW = X0 + cols.length * (colW + gap);
  const pos = new Map();
  let svg = `<svg viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" role="img" aria-label="Mix structure">`;
  cols.forEach((c, ci) => {
    const x = X0 + ci * (colW + gap);
    svg += `<text class="lbl head" x="${x}" y="18">${esc(c.t)} (${c.items.length})</text>`;
    c.items.slice(0, 120).forEach((o, i) => {
      const y = Y0 + i * rowH;
      pos.set(o, { x, y, w: colW });
      const hot = sel && (o === sel || (sel.detail && ((ci === 1 && sel.detail.groups.includes(i)) || (ci === 2 && sel.detail.sends.some((s) => s.aux === i && s.on && s.dB > -149)))));
      svg += `<rect class="box ${hot ? "" : "card"}" x="${x}" y="${y}" width="${colW}" height="${rowH - 2}" rx="2"/>`;
      svg += `<text class="lbl small" x="${x + 4}" y="${y + 9.5}" ${hot ? 'font-weight="600"' : ""}>${esc(o.name) || "(unnamed)"}</text>`;
    });
    if (c.items.length > 120) svg += `<text class="lbl small" x="${x}" y="${Y0 + 120 * rowH + 10}">… ${c.items.length - 120} more</text>`;
  });
  // wires for the selected channel; without a selection, one faint wire per routing to show density
  const wire = (a, b, cls, label) => {
    const pa = pos.get(a), pb = pos.get(b); if (!pa || !pb) return "";
    const x1 = pa.x + pa.w, y1 = pa.y + (rowH - 2) / 2, x2 = pb.x, y2 = pb.y + (rowH - 2) / 2;
    return `<path class="wire ${cls}" d="M${x1} ${y1} C ${x1 + gap / 2} ${y1}, ${x2 - gap / 2} ${y2}, ${x2} ${y2}"/>` +
      (label ? `<text class="lbl val" x="${x2 - 34}" y="${y2 - 2}">${esc(label)}</text>` : "");
  };
  const inputs = st.objects.filter((o) => o.kind === 1 && o.detail);
  if (sel && sel.detail) {
    for (const g of sel.detail.groups) svg += wire(sel, groupList(st)[g], "", "");
    for (const s of sel.detail.sends) if (s.on && s.dB > -149) svg += wire(sel, auxList(st)[s.aux], "send", dB(s.dB));
    if (sel.kind === 5 || sel.kind === 6) for (const f of feeders(st, sel)) svg += wire(f.obj, sel, sel.kind === 5 ? "send" : "", f.label);
  } else {
    for (const o of inputs) { for (const g of o.detail.groups) svg += wire(o, groupList(st)[g], "faint", ""); }
  }
  svg += "</svg>";
  return `<div class="diagram">${svg}</div>`;
}

// ---- export ------------------------------------------------------------------------
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const base = () => state.name.replace(/\.ses$/i, "");
$("x-json").addEventListener("click", () => { if (state.structure) download(`${base()}.decoded.json`, JSON.stringify({ ...state.structure, scan: state.result }, null, 2), "application/json"); });
$("x-strings").addEventListener("click", () => {
  if (!state.result) return;
  const seen = new Set(); const out = [];
  for (const g of ["pascal8", "pascal32", "runs", "utf16"]) for (const r of state.result.strings[g]) if (!seen.has(r.text)) { seen.add(r.text); out.push(r.text); }
  download(`${base()}.strings.txt`, out.join("\n") + "\n", "text/plain");
});
$("x-csv").addEventListener("click", () => {
  const st = state.structure; if (!st?.recognised) return;
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["index", "kind", "name", "format", "fader_dB", "mute", "hpf_Hz", "lpf_Hz", "patch_main", "patch_alt", "sends_on"]];
  for (const o of st.objects) if ([1, 5, 6, 10, 15, 16].includes(o.kind)) { const h = o.headline; rows.push([o.k, h.kind, o.name, h.format, h.fader_dB, h.mute, h.hpf_Hz, h.lpf_Hz, h.patch_main, h.patch_alt, h.sends_on]); }
  download(`${base()}.channels.csv`, rows.map((r) => r.map(q).join(",")).join("\n") + "\n", "text/csv");
});

// draw.io: plain mxGraph XML, no compression, opens in draw.io desktop and app.diagrams.net
const X = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const BOX = "rounded=0;whiteSpace=wrap;html=1;fillColor=#F1EFE8;strokeColor=#1B1916;fontFamily=Helvetica;fontSize=10;align=left;spacingLeft=4;";
const BOXW = "rounded=0;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#1B1916;fontFamily=Helvetica;fontSize=10;align=left;spacingLeft=4;";
const HEAD = "text;html=1;align=left;verticalAlign=middle;fontFamily=Helvetica;fontSize=11;fontStyle=1;fontColor=#5D574E;";
const WIRE = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#1B1916;endArrow=none;";
const SEND = "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#BE1E2D;endArrow=blockThin;endFill=1;fontSize=9;fontColor=#8D121C;labelBackgroundColor=none;";
function mxfile(name, cells, w = 1654, h = 1169) {
  return `<mxfile host="digico-knowledge" modified="${new Date().toISOString()}" agent="digico-knowledge web reader" version="24.0.0">
<diagram id="d1" name="${X(name)}"><mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${w}" pageHeight="${h}" math="0" shadow="0">
<root><mxCell id="0"/><mxCell id="1" parent="0"/>
${cells.join("\n")}
</root></mxGraphModel></diagram></mxfile>
`;
}
const vtx = (id, value, style, x, y, w, h) => `<mxCell id="${X(id)}" value="${X(value)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
const edge = (id, source, target, style, value = "") => `<mxCell id="${X(id)}" value="${X(value)}" style="${style}" edge="1" parent="1" source="${X(source)}" target="${X(target)}"><mxGeometry relative="1" as="geometry"/></mxCell>`;

function drawioMix(st) {
  const cells = [];
  const inputs = st.objects.filter((o) => o.kind === 1), groups = groupList(st), auxes = auxList(st), mtx = st.objects.filter((o) => o.kind === 16);
  const sockets = [...new Set(inputs.map((o) => o.headline.patch_main).filter((p) => p && p !== "-"))];
  const cols = [["Sockets in use", sockets.map((s, i) => ({ id: `sock_${i}`, name: s }))], ["Input channels", inputs.map((o) => ({ id: `in_${o.k}`, name: o.name, o }))],
    ["Groups", groups.map((o) => ({ id: `grp_${o.k}`, name: o.name, o }))], ["Auxes", auxes.map((o) => ({ id: `aux_${o.k}`, name: o.name, o }))], ["Matrix out", mtx.map((o) => ({ id: `mtx_${o.k}`, name: o.name, o }))]];
  const colX = [40, 320, 620, 900, 1180], W = 180, H = 22, PITCH = 26, Y0 = 60;
  cols.forEach(([title, items], ci) => {
    cells.push(vtx(`h_${ci}`, `${title} (${items.length})`, HEAD, colX[ci], 20, 220, 24));
    items.forEach((it, i) => cells.push(vtx(it.id, it.name || "(unnamed)", ci === 0 ? BOXW : BOX, colX[ci], Y0 + i * PITCH, W, H)));
  });
  let n = 0;
  for (const o of inputs) {
    const si = sockets.indexOf(o.headline.patch_main);
    if (si >= 0) cells.push(edge(`e${n++}`, `sock_${si}`, `in_${o.k}`, WIRE));
    for (const g of o.detail.groups) if (groups[g]) cells.push(edge(`e${n++}`, `in_${o.k}`, `grp_${groups[g].k}`, WIRE));
    for (const s of o.detail.sends) if (s.on && s.dB > -149 && auxes[s.aux]) cells.push(edge(`e${n++}`, `in_${o.k}`, `aux_${auxes[s.aux].k}`, SEND, dB(s.dB)));
  }
  for (const o of groups) for (const g of o.detail?.groups ?? []) if (groups[g] && groups[g] !== o) cells.push(edge(`e${n++}`, `grp_${o.k}`, `grp_${groups[g].k}`, WIRE));
  return mxfile(`${st.session_name} mix structure`, cells, 1500, Y0 + Math.max(...cols.map((c) => c[1].length)) * PITCH + 60);
}

function drawioChannel(st, o) {
  const d = o.detail, h = o.headline, cells = [];
  const steps = [];
  if (o.kind === 1) { steps.push(["Input", `${h.patch_main ?? "unpatched"}${h.patch_alt && h.patch_alt !== "-" ? `<br>alt ${h.patch_alt}` : ""}`]); steps.push(["Trim", dB(d.trim_dB)]); }
  else steps.push([kindName(o.kind), `${feeders(st, o).length} sources`]);
  if (d.hpf || d.lpf) steps.push(["Filters", `HPF ${d.hpf?.on ? hz(d.hpf.hz) : "off"}<br>LPF ${d.lpf?.on ? hz(d.lpf.hz) : "off"}`]);
  if (d.eq.length) steps.push([`EQ`, d.eq.map((b) => `${b.on ? "" : "(off) "}${hz(b.hz)} ${b.gain_dB > 0 ? "+" : ""}${num(b.gain_dB, 1)} dB Q${num(b.q, 1)}`).join("<br>")]);
  if (d.dyn.length) steps.push(["Dynamics", d.dyn.map((m) => `${m.module + 1}: ${m.on ? "" : "(off) "}thr ${num(m.thr_dB, 1)} dB ${num(m.ratio, 1)}:1`).join("<br>")]);
  steps.push(["Fader", `${dB(h.fader_dB)}${h.mute ? "<br><b>MUTED</b>" : ""}`]);
  const W = 170, H = 90, GAP = 50;
  cells.push(vtx("title", `${o.name} · ${kindName(o.kind)} ${o.idx + 1}`, HEAD, 40, 20, 600, 24));
  steps.forEach(([t, body], i) => {
    cells.push(vtx(`s${i}`, `<b>${t}</b><br>${body}`, BOX + "verticalAlign=top;spacingTop=4;", 40 + i * (W + GAP), 60, W, H));
    if (i) cells.push(edge(`w${i}`, `s${i - 1}`, `s${i}`, WIRE));
  });
  const last = `s${steps.length - 1}`, fx = 40 + steps.length * (W + GAP) + 40;
  let y = 60;
  for (const g of d.groups) { cells.push(vtx(`g${g}`, groupName(st, g), BOXW, fx, y, 160, 22)); cells.push(edge(`eg${g}`, last, `g${g}`, WIRE)); y += 28; }
  for (const s of d.sends) if (s.on && s.dB > -149) { cells.push(vtx(`a${s.aux}`, auxName(st, s.aux), BOXW, fx, y, 160, 22)); cells.push(edge(`ea${s.aux}`, last, `a${s.aux}`, SEND, dB(s.dB) + (s.pre ? " pre" : ""))); y += 28; }
  return mxfile(`${o.name} signal path`, cells, fx + 260, Math.max(300, y + 40));
}
$("x-drawio").addEventListener("click", () => { const st = state.structure; if (st?.recognised) download(`${base()}.mix.drawio`, drawioMix(st), "application/xml"); });
$("x-drawio-ch").addEventListener("click", () => { const st = state.structure; if (st?.recognised && state.selected) download(`${base()}.${state.selected.name.replace(/[^\w-]+/g, "_") || "channel"}.drawio`, drawioChannel(st, state.selected), "application/xml"); });

// ---- libraries ---------------------------------------------------------------------
async function loadLibraries() {
  const el = $("lib-cards");
  try {
    const res = await fetch("libraries/index.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const index = await res.json();
    if (!index.libraries?.length) { el.innerHTML = '<p class="muted">No libraries yet.</p>'; return; }
    el.innerHTML = index.libraries.map((l) => `
      <a class="card" href="libraries/${esc(l.file)}" rel="noopener">
        <span class="kind">${esc(l.kind)}</span>
        <h3>${esc(l.title)}</h3>
        <p>${esc(l.summary || "")}</p>
        <span class="card__meta">${esc(l.id)} · JSON</span>
      </a>`).join("");
  } catch (err) {
    el.innerHTML = `<p class="muted">Libraries load when the site is served over HTTP (they live in <code>libraries/</code> in the repository). ${location.protocol === "file:" ? "" : esc(err.message)}</p>`;
  }
}
loadLibraries();
