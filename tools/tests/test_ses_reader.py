"""Pins the .ses layout the reader implements (format/ses/) against a synthetic file built
here: one of everything, no names from any real session. This proves the reader and the
written format agree with each other; it does not raise any claim's tier."""
import struct
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import ses_reader  # noqa: E402

TS = 45990.5  # a TDateTime in 2025


def name32(s: str, width: int = 32) -> bytes:
    b = s.encode("latin1")
    return bytes([len(b)]) + b + b"\x00" * (width - 1 - len(b))


def wstr(s: str) -> bytes:
    b = s.encode("latin1")
    return struct.pack("<H", len(b)) + b


def component(typ: int, name: str, params, live: bool = True, ref_b: int = -1) -> bytes:
    """format/ses/components.md: marker, type, name[32], f64, nparams, flags, params, refs."""
    out = b"\xda\x00\x3a\x00" + struct.pack("<I", typ) + name32(name) + struct.pack("<d", TS)
    out += struct.pack("<I", len(params)) + b"\x00" + struct.pack("<I", 0) + (b"\x01" if live else b"\x00")
    out += struct.pack("<I", 0)
    for pid, idx, value in params:
        out += bytes([pid, typ, idx, 0]) + value
    out += struct.pack("<iiI", -1, ref_b, 0)
    return out


def footer(idx: int, kind: int, name: str, fmt: int = 1, ref: int = -1) -> bytes:
    return b"\x27\x00" + bytes([idx, kind]) + name32(name) + struct.pack("<i", ref) + bytes([fmt])


def f32(x: float) -> bytes:
    return struct.pack("<f", x)


def live_object(idx: int, kind: int, name: str, comps, fmt: int = 1) -> bytes:
    return b"\xd5\x00\x01\x00\x01" + struct.pack("<I", len(comps)) + b"".join(comps) + footer(idx, kind, name, fmt)


def build_fixture() -> bytes:
    """A minimal .ses: header, 27 sections in the sample's order, each the smallest valid shape."""
    # input channel "Vox 1" with an input stage, HPF, and an output block
    vox_comps = [
        component(1, "Vox 1", [(0x00, 0, b"\x00\x00\x02\x1c"), (0x00, 1, b"\x00" * 4), (0x01, 0, f32(-3.0))]),
        component(7, "Vox 1", [(0x03, 0, f32(0)), (0x05, 0, f32(25000)), (0x03, 1, f32(1)), (0x05, 1, f32(120))]),
        component(12, "Vox 1", [(0x21, 0, f32(-6.5)), (0x22, 0, f32(1))]),
    ]
    aux_comps = [component(11, "Aux 1", [(0x01, 0, f32(0))]),
                 component(12, "Aux 1", [(0x21, 0, f32(0)), (0x22, 0, f32(0))])]
    socket = component(17, "Lav 3", [(0x84, 0, f32(1))])

    sections = []
    sections.append(b"\x00\x00" + wstr("Test Session"))                                   # 0 name
    preset_obj = live_object(0, 1, "Vox preset", [component(12, "Vox preset", [(0x21, 0, f32(-10))], live=False)])
    sections.append(b"\xdb\x00" + struct.pack("<I", 1) + b"\xd7\x00" + struct.pack("<I", 1) + preset_obj
                    + wstr("Vox preset") + wstr("Vocals") + wstr("") + b"\x0e\x00" + struct.pack("<d", TS)
                    + b"\x00\x00\x00\x01\x00\x00")                                         # 1 presets
    sections.append(b"\xf6\x00" + struct.pack("<I", 0))                                   # 2
    sections.append(b"\xfc\x00" + struct.pack("<I", 0))                                   # 3
    panels = b"Misc\r\nLocal 1-8\r\n"
    sections.append(b"\xc9\x00" + struct.pack("<I", len(panels)) + panels)                # 4 panels
    pool = [component(12, "Vox 1", [(0x21, 0, f32(-20.0)), (0x22, 0, f32(0))], live=False, ref_b=1),
            component(7, "Vox 1", [(0x03, 1, f32(1)), (0x05, 1, f32(90))], live=False, ref_b=1)]
    list_header = (struct.pack("<II", 0, 1) + b"\x50\x01" + name32("Free text") + b"\x00"
                   + (struct.pack("<II", 0x7C4873BE, 0x7C4873BE) + b"\xff" * 64) * 4 + b"\x00" * 16
                   + struct.pack("<I", 1))
    table = (b"\xd3\x00" + struct.pack("<I", 1) + b"\xd5\x00\x01\x00\x00" + struct.pack("<I", 2)
             + struct.pack("<II", 0, 1) + footer(0, 1, "Vox 1"))
    trailer = wstr("Snap A") + struct.pack("<d", TS) + b"\xe0\x03" + b"\xff" * 40
    sections.append(b"\xd2\x00\xd2\x00" + struct.pack("<I", len(pool)) + b"".join(pool) + list_header + table + trailer)  # 5
    sections.append(b"\xd3\x00" + struct.pack("<I", 3)
                    + live_object(0, 1, "Vox 1", vox_comps)
                    + live_object(0, 5, "Aux 1", aux_comps, fmt=2)
                    + live_object(2, 28, "Lav 3", [socket]))                              # 6 live
    bank = bytearray(361)
    bank[0:2] = struct.pack("<H", 361)
    bank[2:4] = struct.pack("<H", 0)
    bank[4:20] = name32("Vocals", 16)
    bank[26:34] = b"\xff" * 8
    bank[35:37] = bytes([0, 1])          # fader 1: input 0
    bank[37:39] = bytes([0, 5])          # fader 2: aux 0
    bank[311:327] = name32("Input Channels", 16)
    bank[327:330] = bytes([0xC6, 0xCD, 0xFF])
    sections.append(b"\xf3\x00" + struct.pack("<I", 1) + bytes(bank))                     # 7 banks
    for tag in (b"\x27\x03", b"\x80\x01", b"\x46\x00", b"\xe8\x00", b"\xea\x00", b"\xec\x00", b"\xed\x00",
                b"\xdd\x00", b"\xcf\x00"):
        sections.append(tag + struct.pack("<I", 0))                                       # 8-16
    action = b"\x14\x00" + b"\xcd\x00\x90\x00" + b"\x00" * 8 + b"\x01\x00\x04\x00" + b"\x00\x00"
    macro = (struct.pack("<H", 1) + name32("Next, >") + bytes([3, 6]) + b"\x1a\xe8\xff\x00"
             + struct.pack("<I", 1) + action + struct.pack("<I", 0))
    sections.append(b"\xf8\x00" + struct.pack("<I", 1) + macro)                           # 17 macros
    sections.append(b"\x80\x02" + name32("Set 1", 16) + b"\xff\x00\x00\x00")              # 18 sets
    sections.append(b"\x90\x03" + name32("A1", 16) + bytes([0, 0x41, 1]))                 # 19 abc
    sections.append(b"\xf0\x00" + b"\r\n" * 3)                                            # 20 notes
    for tag in (b"\x04\x00", b"\x30\x00", b"\x0f\x00", b"\xe5\x00", b"\xe1\x00", b"\x04\x17"):
        sections.append(tag + struct.pack("<I", 0))                                       # 21-26
    assert len(sections) == 27

    head = bytearray(0x1C8)
    head[0:26] = b"DiGiCo     SD5 .SES vK   \r"
    head[0x20:0x22] = struct.pack("<H", 0x1C8)   # first section offset, repeated as the table's first entry
    head[0x22:0x24] = struct.pack("<H", 1926)    # software version; macros carry a trigger list from V1926
    head[0x77:0x7B] = f32(48000.0)
    offsets, pos = [], 0x1C8
    for sec in sections:
        offsets.append(pos)
        pos += len(sec)
    offsets.append(pos)
    for i, off in enumerate(offsets):
        head[0x100 + 4 * i:0x104 + 4 * i] = struct.pack("<I", off)
    head[0x1A1:0x1A1 + 26] = bytes.fromhex("dbf6fcc9d2d3f3d4e4d9e8eaecedddcff8f9faebe2d0e3e5e1ee")
    return bytes(head) + b"".join(sections)


FIXTURE = Path(__file__).with_name("fixture-session.bin")


class ReaderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = build_fixture()
        if not FIXTURE.exists():
            FIXTURE.write_bytes(cls.data)
        cls.ses = ses_reader.Session(cls.data)

    def test_fixture_on_disk_matches_builder(self):
        """web/js/ses.test.mjs decodes this same file, so the two parsers meet on it."""
        self.assertEqual(FIXTURE.read_bytes(), self.data)

    def test_header(self):
        self.assertEqual(self.ses.model, "SD5")
        self.assertEqual(self.ses.format_tag, "vK")
        self.assertEqual(self.ses.version, 1926)
        self.assertEqual(self.ses.table_off, 0x100)
        self.assertEqual(self.ses.warnings, [])
        self.assertEqual(len(self.ses.offs), 28)
        self.assertEqual(self.ses.offs[-1], len(self.data))
        self.assertEqual(self.ses.sample_rate, 48000.0)
        self.assertEqual(self.ses.name, "Test Session")

    def test_live_state(self):
        objs = self.ses.live
        self.assertEqual([o["name"] for o in objs], ["Vox 1", "Aux 1", "Lav 3"])
        self.assertEqual([o["kind"] for o in objs], [1, 5, 28])
        self.assertEqual(objs[1]["fmt"], 2)
        row = self.ses.channel_row(objs[0])
        self.assertEqual(row["fader_dB"], -6.5)
        self.assertTrue(row["mute"])
        self.assertEqual(row["hpf_Hz"], 120)
        self.assertIsNone(row["lpf_Hz"])
        self.assertEqual(row["patch_main"], "input port28:3 Lav 3")
        self.assertEqual(row["patch_alt"], "-")

    def test_snapshots(self):
        self.assertEqual(len(self.ses.flat), 2)
        self.assertEqual(self.ses.snapshot_list_label, "Free text")
        self.assertEqual(self.ses.snapshot_count, 1)
        sn = self.ses.snapshots[0]
        self.assertEqual(sn["name"], "Snap A")
        self.assertEqual(sn["w"], 0x03E0)
        self.assertEqual(sn["objs"][0]["refs"], [0, 1])
        self.assertEqual(self.ses.flat[0]["ref"], 1)

    def test_presets(self):
        p = self.ses.presets[0]
        self.assertEqual((p["name"], p["category"], p["sub"]), ("Vox preset", "Vocals", ""))
        self.assertEqual(len(p["objs"]), 1)

    def test_banks_and_macros(self):
        b = self.ses.banks[0]
        self.assertEqual(b["name"], "Vocals")
        self.assertEqual(b["faders"][:2], [(0, 1), (0, 5)])
        self.assertEqual(self.ses.resolve(0, 5), "Aux 1")
        self.assertEqual(self.ses.resolve(0, 0), "-")
        self.assertEqual(b["label"], "Input Channels")
        self.assertEqual(b["rgb"], "c6cdff")
        m = self.ses.macros[0]
        self.assertEqual((m["idx"], m["page"], m["slot"], m["rgb"], m["name"]), (1, 3, 6, "1ae8ff", "Next, >"))
        self.assertEqual(len(m["actions"]), 1)
        self.assertEqual(m["actions"][0][-12:-4], "01000400")

    def test_misc_sections(self):
        self.assertEqual(self.ses.panels[:2], ["Misc", "Local 1-8"])
        self.assertEqual(self.ses.sets[0]["name"], "Set 1")
        self.assertEqual(self.ses.abc[0], "A1")
        self.assertEqual(self.ses.notes, "\r\n" * 3)

    def test_summary_and_json_run(self):
        text = self.ses.summary()
        self.assertIn("Vox 1", text)
        self.assertIn("Snap A", text)
        js = self.ses.to_json()
        self.assertEqual(js["session_name"], "Test Session")
        self.assertEqual(js["snapshots"][0]["name"], "Snap A")

    def test_scrub_removes_every_name(self):
        ses = ses_reader.Session(self.data)
        ses.scrub()
        text = ses.summary() + str(ses.to_json())
        for leak in ("Vox 1", "Aux 1", "Lav 3", "Snap A", "Vocals", "Next, >", "Test Session", "Free text"):
            self.assertNotIn(leak, text, leak)
        self.assertEqual(ses.live[0]["name"], "IN 01")
        self.assertEqual(ses.snapshots[0]["name"], "Snap 01")
        self.assertEqual(ses.flat[0]["name"], "IN 01")

    def test_rename_rewrites_every_copy(self):
        ses = ses_reader.Session(self.data)
        data, n = ses.rename("Vox 1", "Lead Vox", kind=1)
        self.assertEqual(n, 1 + 3 + 1 + 2)       # footer, 3 live components, snapshot footer, 2 pool entries
        self.assertEqual(len(data), len(self.data))
        again = ses_reader.Session(data)
        self.assertEqual(again.live[0]["name"], "Lead Vox")
        self.assertEqual(again.flat[0]["name"], "Lead Vox")
        self.assertEqual(again.snapshots[0]["objs"][0]["name"], "Lead Vox")


if __name__ == "__main__":
    unittest.main()
