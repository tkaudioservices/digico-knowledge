import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import check_repo  # noqa: E402


class CheckRepoTests(unittest.TestCase):
    def test_libraries_valid(self):
        self.assertEqual(check_repo.check_libraries(), [])

    def test_console_suffix_detection(self):
        fake = [check_repo.ROOT / "samples" / "show.SES", check_repo.ROOT / "README.md"]
        errs = check_repo.check_no_console_files(fake)
        self.assertEqual(len(errs), 1)
        self.assertIn("show.SES", errs[0])

    def test_tag_regex(self):
        m = check_repo.TAG_RE.search("Plain binary. *(file-derived, SD5 unknown, 2026-10)*")
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), "file-derived")


if __name__ == "__main__":
    unittest.main()
