#!/usr/bin/env python3
"""Write the format diagrams as draw.io files (format/diagrams/*.drawio).

Plain mxGraphModel XML, uncompressed, so they diff in git and open in draw.io for editing by
hand. Labels are plain text with explicit line breaks: draw.io rasterises wrapped or HTML
labels when it exports SVG, and this keeps the exports as real text at a few KB each.
Export with tools/export_diagrams.sh. Brand colours from tkaudioservices.com/brand-guidelines.
"""
import html
import textwrap
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "format" / "diagrams"

SHEET = "rounded=0;html=0;fillColor=#F1EFE8;strokeColor=#1B1916;fontFamily=Helvetica;fontSize=11;fontColor=#1B1916;align=left;spacingLeft=6;verticalAlign=top;spacingTop=2;"
CARD = SHEET.replace("#F1EFE8", "#FFFFFF")
RED = CARD + "strokeColor=#BE1E2D;strokeWidth=2;"
HEAD = "text;html=0;align=left;verticalAlign=middle;fontFamily=Helvetica;fontSize=12;fontStyle=1;fontColor=#BE1E2D;"
LBL = "text;html=0;align=left;verticalAlign=top;fontFamily=Helvetica;fontSize=11;fontColor=#5D574E;"
MONO = "text;html=0;align=left;verticalAlign=top;fontFamily=Courier New;fontSize=10;fontColor=#1B1916;"
WIRE = "edgeStyle=orthogonalEdgeStyle;rounded=0;html=0;strokeColor=#1B1916;endArrow=blockThin;endFill=1;fontFamily=Helvetica;fontSize=10;fontColor=#5D574E;"
REDW = WIRE.replace("#1B1916", "#BE1E2D").replace("fontColor=#5D574E", "fontColor=#8D121C")
DASH = "edgeStyle=orthogonalEdgeStyle;rounded=0;html=0;strokeColor=#5D574E;dashed=1;endArrow=none;"

LINE = 15  # px per text line at 11px


def wrap(text, width=72):
    out = []
    for para in text.split("\n"):
        out.extend(textwrap.wrap(para, width) or [""])
    return "\n".join(out)


def esc(s):
    return html.escape(s, quote=True).replace("\n", "&#xa;")


def vtx(i, value, style, x, y, w, h):
    return f'<mxCell id="{i}" value="{esc(value)}" style="{style}" vertex="1" parent="1"><mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>'


def edge(i, s, t, style, value=""):
    return f'<mxCell id="{i}" value="{esc(value)}" style="{style}" edge="1" parent="1" source="{s}" target="{t}"><mxGeometry relative="1" as="geometry"/></mxCell>'


def box(cells, i, title, body, style, x, y, w, width=72):
    """A titled box sized to its wrapped text. Returns the height used."""
    text = title + ("\n" + wrap(body, width) if body else "")
    lines = text.count("\n") + 1
    h = 8 + LINE * lines
    cells.append(vtx(i, text, style, x, y, w, h))
    return h


def write(name, cells, w, h):
    xml = (f'<mxfile host="digico-knowledge"><diagram id="d" name="{esc(name)}">'
           f'<mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="{w}" pageHeight="{h}">'
           '<root><mxCell id="0"/><mxCell id="1" parent="0"/>\n' + "\n".join(cells) + "\n</root></mxGraphModel></diagram></mxfile>\n")
    (OUT / f"{name}.drawio").write_text(xml)


def file_layout():
    c = [vtx("t", "A .ses FILE, END TO END", HEAD, 20, 10, 400, 20)]
    rows = [
        ("h", "0x000  Signature", "DiGiCo · console · .SES · format tag · CR; 26 bytes", SHEET),
        ("w", "0x01A  Header words", "session structure counts. u16 at 0x20 = offset of section 0. u16 at 0x22 = software version (1926 = V1926). Sample rate as f32 at 0x77.", SHEET),
        ("o", "0x100  Offset table", "one u32 per section, zero-terminated; the last entry is the file length. Before vB (V929) the table sits at 0x80.", RED),
        ("y", "0x1A1  Section types", "one byte per section: db f6 fc c9 d2 d3 f3 d4 e4 d9 e8 ea ec ed dd cf f8 f9 fa eb e2 d0 e3 e5 e1 ee. Find sections by type, never by position: older revisions list fewer.", RED),
        ("s0", "entry 0   section 0", "session name, u16-length string", CARD),
        ("s1", "entry 1   db  presets", "the preset library: whole objects with a name, category, sub-label and timestamp", CARD),
        ("s4", "entry 4   c9  panels", "I/O panel names and the socket map", CARD),
        ("s5", "entry 5   d2  snapshots", "the shared component pool, then one index table and trailer per snapshot", CARD),
        ("s6", "entry 6   d3  live state", "the console as saved: every object with its components inline", CARD),
        ("s7", "entry 7   f3  fader banks", "361-byte records: twelve (index, kind) assignments each", CARD),
        ("s17", "entry 17  f8  macros", "name, page, slot, colour, length-prefixed action records; a trigger list from V1926", CARD),
        ("sx", "entries 18 to 26   f9  fa  eb  …", "sets, A/B/C labels, notes; small or empty sections in between (entry numbers are the vK layout)", CARD),
    ]
    y = 40
    for i, t, b, st in rows:
        y += box(c, i, t, b, st, 20, y, 560) + 8
    write("file-layout", c, 620, y + 20)


def component_record():
    c = [vtx("t", "ONE COMPONENT RECORD: every processing block, everywhere in the file", HEAD, 20, 10, 640, 20)]
    fields = [
        ("+0", "da 00 3a 00", "marker; 0x3a = 58 = length of the fixed part that follows"),
        ("+4", "u32 type", "1 input stage · 2 aux sends · 3 group routing · 4 EQ · 5 multiband · 7 HPF/LPF · 8 dynamics · 12 output (fader, mute) · 14 output patch · 15 graphic EQ · 16 control group · 17/18 socket · 21 FX"),
        ("+8", "name[32]", "length byte + up to 31 chars; bytes past the length are leftovers from before"),
        ("+40", "f64 TDateTime", "last change; days since 30 December 1899"),
        ("+48", "u32 n", "number of parameter records"),
        ("+52", "u8 u32 u8 u32", "flags; the u8 at +57 is 1 in the live state and 0 elsewhere"),
        ("+62", "n × 8 bytes", "id · type · index · flag · 4-byte value (f32 or packed bytes)"),
        ("end", "i32 i32 u32", "two references (−1 when unused) and a zero word"),
    ]
    y = 40
    for i, (o, f, d) in enumerate(fields):
        txt = wrap(d, 60)
        h = 8 + LINE * (txt.count("\n") + 1)
        c.append(vtx(f"f{i}", o, SHEET + "align=center;verticalAlign=middle;", 20, y, 50, h))
        c.append(vtx(f"g{i}", f, CARD + "verticalAlign=middle;", 70, y, 130, h))
        c.append(vtx(f"d{i}", txt, LBL, 210, y + 2, 440, h))
        y += h + 6
    c.append(vtx("p", "a parameter record, bytes as stored:\n00 01 00 00 | 00 00 04 23\nid 0x00  type 1  index 0  flag 0 | value: socket 4 on port group 0x23 = the input patch", MONO, 20, y + 10, 640, 52))
    write("component-record", c, 700, y + 90)


def object_model():
    c = [vtx("t", "THE OBJECT MODEL: live state, section d3 (counts from the SD5 sample)", HEAD, 20, 10, 700, 20)]
    kinds = [
        ("1", "Input channel ×100", "13 components: input stage, 9, filters, dynamics, EQ, multiband, output, sends, 13, routing, patch, pan, empty"),
        ("5", "Aux ×36", "8 components: bus input, 9, dynamics, 8-band EQ, multiband, output, patch, empty"),
        ("6", "Group ×17", "11 components: as an aux, plus sends, routing and pan"),
        ("7", "Bus leg ×41", "the right and centre legs of stereo and LCR busses, as their own objects"),
        ("10", "Control group ×20", "2 components: CG fader and mute, empty"),
        ("14", "FX unit ×10", "1 component: the FX parameters"),
        ("15 / 16", "Matrix in ×24 / out ×24", "2 and 8 components"),
        ("17", "Graphic EQ ×32", "1 component: 32 band gains and on/off"),
        ("27–36", "Input socket groups", "520 sockets: internal sources, local I/O, then one group per port or rack"),
        ("77–86", "Output socket groups", "516 sockets in the same order"),
    ]
    y = 40
    for i, (k, n, d) in enumerate(kinds):
        txt = wrap(d, 62)
        h = 8 + LINE * (txt.count("\n") + 1)
        c.append(vtx(f"k{i}", f"kind {k}", SHEET + "align=center;verticalAlign=middle;", 20, y, 70, h))
        c.append(vtx(f"n{i}", n, CARD + "verticalAlign=middle;", 90, y, 190, h))
        c.append(vtx(f"o{i}", txt, LBL, 290, y + 2, 420, h))
        y += h + 6
    c.append(vtx("f", "object = d5 00 01 00 01 · u32 n · n components inline · footer\nfooter = 27 00 · u8 index · u8 kind · name[32] · i32 ref · u8 format (1 mono, 2 stereo, 3 LCR)", MONO, 20, y + 10, 690, 36))
    write("object-model", c, 740, y + 70)


def snapshots():
    c = [vtx("t", "HOW SNAPSHOTS ARE STORED: section d2", HEAD, 20, 10, 600, 20)]
    c.append(vtx("pool", "Component pool\n11,780 records in the sample; one layout; each stored once", SHEET, 20, 40, 300, 40))
    names = ["Vox 1 · output", "Vox 1 · EQ", "Kick · output", "Kick · output, later"]
    for i, n in enumerate(names):
        c.append(vtx(f"p{i}", n, CARD + "verticalAlign=middle;", 20, 92 + i * 30, 300, 24))
    c.append(vtx("tbl1", "Snapshot 1 table\nobject → pool indices\nVox 1 → [0, 1, …]\nKick → [2, …]", CARD, 400, 40, 230, 68))
    c.append(vtx("tbl2", "Snapshot 2 table\nVox 1 → [0, 1, …]  unchanged, shared\nKick → [3, …]  changed, new entry", CARD, 400, 124, 230, 54))
    c.append(vtx("tr", "Trailer after each table\nu16-length name · f64 time · u16 0x03E0\n~1.9 KB scope mask", SHEET, 400, 194, 230, 54))
    c.append(edge("a", "tbl1", "p0", REDW))
    c.append(edge("b", "tbl1", "p2", REDW))
    c.append(edge("c2", "tbl2", "p1", REDW))
    c.append(edge("d2", "tbl2", "p3", REDW))
    c.append(vtx("why", wrap("A channel block that is identical across twenty snapshots is stored once. That is why 45 snapshots fit in 11.75 MB instead of 60 MB, and why renaming a channel on the desk does not rewrite old snapshots.", 48), LBL, 20, 222, 340, 60))
    write("snapshots", c, 660, 300)


def revisions():
    c = [vtx("t", "FORMAT REVISIONS SEEN, AND WHAT CHANGED", HEAD, 20, 10, 600, 20)]
    revs = [("v6 · V573", "SD8", "table at 0x80"), ("v7 · V634", "SD8", ""), ("v9 · V726", "SD7", ""),
            ("vA · V760", "SD7 SD8", "23 sections\ndecodes"), ("vB · V929", "SD7 SD8 SD9", "table moves\nto 0x100"), ("vC · V987", "SD7", ""),
            ("vF · V1280", "SD8", "25 sections\n+ fc, e4"), ("vG · V1455", "SD7", ""), ("vH · V1528", "SD7", "26 sections\n+ e5"),
            ("vK · V1926", "SD5", "27 sections\n+ ee; macro\ntrigger list")]
    x = 20
    for i, (r, m, n) in enumerate(revs):
        c.append(vtx(f"r{i}", f"{r}\n{m}", RED if i in (0, 3, 4, 9) else CARD, x, 40, 104, 40))
        if n:
            c.append(vtx(f"n{i}", n, LBL, x, 86, 104, 50))
        if i:
            c.append(edge(f"e{i}", f"r{i - 1}", f"r{i}", DASH))
        x += 112
    c.append(vtx("k", wrap("The component, object, snapshot, preset, bank and macro layouts are the same from vA to vK. Only the section list, the table position and the macro trigger list differ, so one reader walks all of them.", 110), LBL, 20, 146, 1100, 36))
    write("revisions", c, 1160, 200)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for fn in (file_layout, component_record, object_model, snapshots, revisions):
        fn()
        print("wrote", fn.__name__)
