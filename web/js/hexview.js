// hexview.js — a windowed hex dump. Renders one page of rows at a time so a multi-megabyte
// file never puts a million nodes in the DOM.
const BYTES_PER_ROW = 16;
const ROWS_PER_PAGE = 48;

export function createHexView(container, bytes) {
  let page = 0;
  const pages = Math.max(1, Math.ceil(bytes.length / (BYTES_PER_ROW * ROWS_PER_PAGE)));
  let highlight = null; // [from, to)

  container.innerHTML = `
    <div class="hex-bar">
      <button type="button" class="btn ghost" data-act="prev" aria-label="Previous page">‹</button>
      <span class="hex-pos"></span>
      <button type="button" class="btn ghost" data-act="next" aria-label="Next page">›</button>
      <label class="hex-goto">Go to <input type="text" inputmode="text" placeholder="0x1A2B or 6699" aria-label="Go to offset"></label>
    </div>
    <pre class="hex" tabindex="0"></pre>`;
  const pre = container.querySelector(".hex");
  const pos = container.querySelector(".hex-pos");
  const input = container.querySelector("input");

  function render() {
    const start = page * BYTES_PER_ROW * ROWS_PER_PAGE;
    const end = Math.min(bytes.length, start + BYTES_PER_ROW * ROWS_PER_PAGE);
    const lines = [];
    for (let off = start; off < end; off += BYTES_PER_ROW) {
      const rowEnd = Math.min(end, off + BYTES_PER_ROW);
      let hex = "", txt = "";
      for (let i = off; i < off + BYTES_PER_ROW; i++) {
        if (i < rowEnd) {
          const b = bytes[i];
          const h = b.toString(16).padStart(2, "0");
          const c = b >= 0x20 && b <= 0x7e ? String.fromCharCode(b).replace("&", "&amp;").replace("<", "&lt;") : "·";
          const hit = highlight && i >= highlight[0] && i < highlight[1];
          hex += hit ? `<mark>${h}</mark>` : h;
          txt += hit ? `<mark>${c}</mark>` : c;
        } else {
          hex += "  ";
          txt += " ";
        }
        hex += i % 8 === 7 ? "  " : " ";
      }
      lines.push(`<span class="off">${off.toString(16).padStart(8, "0")}</span>  ${hex} <span class="txt">${txt}</span>`);
    }
    pre.innerHTML = lines.join("\n") || "(empty file)";
    pos.textContent = `0x${start.toString(16).toUpperCase()} – 0x${Math.max(start, end - 1).toString(16).toUpperCase()}  ·  page ${page + 1} of ${pages}`;
  }

  function goTo(offset, length = 1) {
    if (!Number.isFinite(offset) || offset < 0 || offset >= bytes.length) return;
    highlight = [offset, Math.min(bytes.length, offset + length)];
    page = Math.floor(offset / (BYTES_PER_ROW * ROWS_PER_PAGE));
    render();
    const row = Math.floor((offset % (BYTES_PER_ROW * ROWS_PER_PAGE)) / BYTES_PER_ROW);
    const lineHeight = pre.scrollHeight / Math.max(1, pre.innerHTML.split("\n").length);
    pre.scrollTop = Math.max(0, row * lineHeight - pre.clientHeight / 3);
  }

  container.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "prev" && page > 0) { page--; render(); }
    if (act === "next" && page < pages - 1) { page++; render(); }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const raw = input.value.trim();
    const v = /^0x/i.test(raw) ? parseInt(raw.slice(2), 16) : parseInt(raw, 10);
    goTo(v);
  });

  render();
  return { goTo, render };
}
