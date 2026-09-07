import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('release', Path(__file__).with_name('release.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def test_original_bytes_and_rollback(self):
        old_root, old_releases = release.ROOT, release.RELEASES
        with tempfile.TemporaryDirectory() as d:
            release.RELEASES = Path(d) / 'releases'
            archive = Path(d) / 'test.zip'
            with zipfile.ZipFile(archive, 'w') as z:
                z.writestr('index.html', '<h1>old version</h1>')
                z.writestr('assets/game.js', 'original bytes')
            try:
                m = release.snapshot('test', archive, 'HEAD')
                self.assertEqual(m['archiveSha256'], release.digest(archive))
                with self.assertRaises(AssertionError):
                    release.snapshot('test', archive, 'HEAD')
                release.ROOT = Path(d)
                target = release.prepare_rollback('test')
                self.assertEqual(release.digest(target / 'campus-game.zip'), m['archiveSha256'])
                self.assertEqual((target / 'preview/assets/game.js').read_text(), 'original bytes')
                manifest = release.RELEASES / 'test/manifest.json'
                bad = json.loads(manifest.read_text())
                bad['archiveSha256'] = '0' * 64
                manifest.write_text(json.dumps(bad))
                with self.assertRaises(AssertionError):
                    release.prepare_rollback('test')
            finally:
                release.ROOT, release.RELEASES = old_root, old_releases

    def test_unsafe_archive_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            for name in ['../outside', '/absolute', 'assets\\outside']:
                p = Path(d) / 'bad.zip'
                with zipfile.ZipFile(p, 'w') as z:
                    z.writestr('index.html', 'game')
                    z.writestr(name, 'bad')
                with self.assertRaises(AssertionError):
                    release.zip_manifest(p)


if __name__ == '__main__':
    unittest.main()
