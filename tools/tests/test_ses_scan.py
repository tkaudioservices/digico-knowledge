"""Pins the shared heuristics. The same fixture is used by web/js/ses.test.mjs so the
browser and the command line agree byte for byte."""
import json
import struct
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import ses_scan  # noqa: E402

FIXTURE = Path(__file__).with_name("fixture.bin")


def build_fixture() -> bytes:
    """A small synthetic buffer with one of everything."""
    buf = bytearray(b"\x00" * 16)
    buf += bytes([4]) + b"Kick" + b"\x00"                 # pascal8 at 16
    buf += struct.pack("<I", 5) + b"Vox 1" + b"\x00"      # pascal32 at 22
    buf += b"\x01\x02"
    buf += b"Snare Top" + b"\xff"                         # run at 34 (not length-prefixed)
    buf += "Aux 7".encode("utf-16-le") + b"\x00\x00"      # utf16 at 44
    when = (datetime(2025, 11, 29, 14, 30, 0, tzinfo=timezone.utc) - ses_scan.DELPHI_EPOCH)
    buf += struct.pack("<d", when.days + when.seconds / 86400)  # TDateTime
    buf += struct.pack("<d", 45000.0)                     # bare date, must be ignored
    buf += b"\x00" * 8
    return bytes(buf)


class ScanTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = build_fixture()
        if not FIXTURE.exists():
            FIXTURE.write_bytes(cls.data)
        cls.result = ses_scan.scan(cls.data, "fixture.bin")

    def test_fixture_on_disk_matches_builder(self):
        self.assertEqual(FIXTURE.read_bytes(), self.data)

    def test_pascal8(self):
        texts = [(s["offset"], s["text"]) for s in self.result["strings"]["pascal8"]]
        self.assertIn((16, "Kick"), texts)
        self.assertNotIn("Vox 1", [t for _, t in texts])

    def test_pascal32(self):
        texts = [(s["offset"], s["text"]) for s in self.result["strings"]["pascal32"]]
        self.assertEqual(texts, [(22, "Vox 1")])

    def test_runs(self):
        texts = [s["text"] for s in self.result["strings"]["runs"]]
        self.assertIn("Snare Top", texts)
        self.assertIn("Kick", texts)

    def test_utf16(self):
        texts = [s["text"] for s in self.result["strings"]["utf16"]]
        self.assertEqual(texts, ["Aux 7"])

    def test_datetime(self):
        stamps = self.result["datetimes"]
        self.assertEqual(len(stamps), 1)
        self.assertEqual(stamps[0]["iso"], "2025-11-29T14:30:00Z")

    def test_identity(self):
        ident = self.result["identity"]
        self.assertEqual(ident["size"], len(self.data))
        self.assertEqual(len(ident["sha256"]), 64)

    def test_json_round_trip(self):
        json.dumps(self.result)


if __name__ == "__main__":
    unittest.main()
