// app.js — the page. Wires the drop zone to the scanner, renders tabs, loads libraries.
import { scan, decode } from "./ses.js";
import { createHexView } from "./hexview.js";

const $ = (id) => document.getElementById(id);
const fmtBytes = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;
const hex = (n) => "0x" + n.toString(16).toUpperCase().padStart(6, "0");
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let state = { bytes: null, result: null, structure: null, hexView: null, name: "" };

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
  state = { bytes: null, result: null, structure: null, hexView: null, name: "" };
  $("results").hidden = true; status.textContent = "";
  history.replaceState(null, "", "#reader");
});

async function load(file) {
  status.textContent = `Reading ${file.name} (${fmtBytes(file.size)})…`;
  const t0 = performance.now();
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const result = await scan(bytes, file.name);
    state = { bytes, result, structure: null, name: file.name, hexView: null };
    render();
    status.textContent = `${state.structure?.recognised ? "Decoded" : "Scanned"} in ${Math.round(performance.now() - t0)} ms. Read in your browser only.`;
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
  const { result, name } = state;
  const id = result.identity, s = result.strings;
  $("r-name").textContent = name;
  $("t-size").textContent = fmtBytes(id.size);
  $("t-pascal").textContent = (s.pascal8.length + s.pascal32.length).toLocaleString();
  $("t-runs").textContent = s.runs.length.toLocaleString();
  $("t-dates").textContent = result.datetimes.length.toLocaleString();
  $("t-zeros").textContent = `${(id.zero_fraction * 100).toFixed(1)}%`;
  $("t-sha").textContent = id.sha256 || "unavailable (needs https or localhost)";
  $("o-head").textContent = `${id.head_hex}\n${id.head_ascii}`;

  // most frequent length-prefixed strings
  const freq = new Map();
  for (const x of [...s.pascal8, ...s.pascal32]) freq.set(x.text, (freq.get(x.text) || 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 40);
  $("o-names").innerHTML = top.length
    ? top.map(([t, n]) => `<li data-text="${esc(t)}">${esc(t)}${n > 1 ? `<b>×${n}</b>` : ""}</li>`).join("")
    : '<li class="muted">none found</li>';
  $("o-names").onclick = (e) => {
    const li = e.target.closest("li[data-text]"); if (!li) return;
    showTab("strings"); $("s-group").value = "pascal8"; $("s-filter").value = li.dataset.text; renderStrings();
  };

  renderStrings();
  renderDates();
  const structure = decode(state.bytes);
  state.structure = structure;
  renderStructure(structure);
  $("st-json").textContent = JSON.stringify(structure, null, 2);
  state.hexView = null; $("hex").innerHTML = "";
  showTab(structure.recognised ? "structure" : "overview");
}

// ---- structure ---------------------------------------------------------------------
const num = (v, d = 2) => (v === null || v === undefined) ? "" : (typeof v === "number" ? v.toFixed(d) : String(v));
function table(headers, rows) {
  if (!rows.length) return '<p class="muted small">none</p>';
  const th = headers.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = rows.map((r) => `<tr>${r.map((c) => `<td class="${/^[-\d.]+$|^0x/.test(String(c)) ? "mono" : ""}">${esc(String(c ?? ""))}</td>`).join("")}</tr>`).join("");
  return `<div class="tablewrap"><table class="data"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
}
const section = (title, inner, open = false) => `<details class="st" ${open ? "open" : ""}><summary>${esc(title)}</summary>${inner}</details>`;

function renderStructure(st) {
  const el = $("st-view");
  if (!st.recognised) {
    el.innerHTML = `<div class="note"><strong>Not decoded.</strong> ${esc(st.reason)} The heuristic tabs still apply.</div>`;
    return;
  }
  const objs = st.objects;
  const byKind = (...kinds) => objs.filter((o) => kinds.includes(o.kind));
  const chRow = (o) => { const h = o.headline; return [o.idx + 1, o.name, h.format, num(h.fader_dB, 2), h.mute ? "MUTE" : "", h.hpf_Hz ?? "", h.lpf_Hz ?? "", h.patch_main ?? "", h.patch_alt ?? "", h.sends_on ?? ""]; };
  const busRow = (o) => { const h = o.headline; return [o.idx + 1, o.name, h.format, num(h.fader_dB, 2), h.mute ? "MUTE" : ""]; };
  const counts = Object.entries(st.counts).map(([k, v]) => `${v} ${k}`).join(", ");
  const sockets = [...new Set(objs.filter((o) => (o.kind >= 27 && o.kind <= 36) || (o.kind >= 77 && o.kind <= 86)).map((o) => o.kind))]
    .map((k) => { const g = objs.filter((o) => o.kind === k); const named = g.filter((o) => o.name).map((o) => o.name); return [`${k >= 77 ? "out" : "in"} ${k}`, g.length, named.length, named.join(", ")]; });

  el.innerHTML = `
    <div class="st-head">
      <p><strong>${esc(st.session_name)}</strong> · ${esc(st.file.model)} · format ${esc(st.file.format_tag)} · last change ${esc(st.saved ?? "unknown")} · ${st.file.sample_rate} Hz</p>
      <p class="muted small">${esc(counts)} · ${st.snapshots.length} snapshots sharing ${st.snapshot_components.toLocaleString()} stored blocks · ${st.presets.length} presets · ${st.fader_banks.length} fader banks · ${st.macros.length} macros</p>
    </div>
    ${section(`Input channels (${byKind(1).length})`, table(["#", "Name", "Format", "Fader dB", "Mute", "HPF Hz", "LPF Hz", "Input", "Alt input", "Sends on"], byKind(1).map(chRow)), true)}
    ${section(`Aux busses (${byKind(5).length})`, table(["#", "Name", "Format", "Fader dB", "Mute"], byKind(5).map(busRow)))}
    ${section(`Groups (${byKind(6).length})`, table(["#", "Name", "Format", "Fader dB", "Mute"], byKind(6).map(busRow)))}
    ${section(`Matrix (${byKind(15).length} in, ${byKind(16).length} out)`, table(["#", "Name", "Format", "Fader dB", "Mute"], [...byKind(15), ...byKind(16)].map(busRow)))}
    ${section(`Control groups (${byKind(10).length})`, table(["#", "Name", "Fader dB", "Mute"], byKind(10).map((o) => [o.idx + 1, o.name, num(o.headline.fader_dB, 2), o.headline.mute ? "MUTE" : ""])))}
    ${section(`FX units (${byKind(14).length}) and graphic EQs (${byKind(17).length})`, `<p class="small">${esc(byKind(14).map((o) => o.name).join(", "))}</p><p class="small muted">${esc(byKind(17).map((o) => o.name).join(", "))}</p>`)}
    ${section(`Snapshots (${st.snapshots.length})`, table(["#", "Name", "Last stored", "Objects"], st.snapshots.map((s) => [s.n, s.name, s.saved ?? "", s.objects])), true)}
    ${section(`Fader banks (${st.fader_banks.length})`, table(["#", "Name", "Label", "Colour", "Faders"], st.fader_banks.map((b) => [b.idx, b.name, b.label, "#" + b.rgb, b.faders.map((f) => f.name).join(", ")])))}
    ${section(`Macros (${st.macros.length})`, table(["#", "Page", "Slot", "Colour", "Name", "Actions"], st.macros.map((m) => [m.idx, m.page, m.slot, "#" + m.rgb, m.name, m.actions.length])))}
    ${section(`Presets (${st.presets.length})`, table(["Name", "Category", "Label", "Kind", "Saved"], st.presets.map((p) => [p.name, p.category, p.sub, p.kind, p.saved ?? ""])))}
    ${section(`Sockets (${sockets.reduce((a, r) => a + r[1], 0)})`, table(["Group", "Sockets", "Named", "Names"], sockets))}
    ${section("Panels, sets, labels, notes", `<p class="small">${esc(st.panels.filter(Boolean).join(", "))}</p><p class="small muted">${esc(st.sets.map((x) => x.name).join(", "))}</p><p class="small muted">${esc(st.abc_labels.join(", "))}</p><pre class="codeblock small">${esc(st.notes.trim() || "(no notes)")}</pre>`)}
  `;
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
    `<tr data-off="${r.offset}" data-len="${r.length ?? r.text.length}"><td class="off">${hex(r.offset)}</td><td class="mono">${r.length ?? r.text.length}</td><td class="mono">${esc(r.text)}</td></tr>`
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
    ? rows.map((d) => `<tr data-off="${d.offset}"><td class="off">${hex(d.offset)}</td><td class="mono">${d.iso.replace("T", " ").replace("Z", "")}</td><td class="mono">${d.value.toFixed(6)}</td></tr>`).join("")
    : '<tr><td colspan="3" class="muted">none found</td></tr>';
}
$("d-table").addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-off]"); if (tr) jumpToHex(+tr.dataset.off, 8);
});

// ---- export ------------------------------------------------------------------------
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$("x-json").addEventListener("click", () => {
  if (!state.result) return;
  download(`${state.name}.scan.json`, JSON.stringify({ ...state.result, structure: state.structure ?? decode(state.bytes) }, null, 2), "application/json");
});
$("x-strings").addEventListener("click", () => {
  if (!state.result) return;
  const seen = new Set(); const out = [];
  for (const g of ["pascal8", "pascal32", "runs", "utf16"]) for (const r of state.result.strings[g]) if (!seen.has(r.text)) { seen.add(r.text); out.push(r.text); }
  download(`${state.name}.strings.txt`, out.join("\n") + "\n", "text/plain");
});

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
