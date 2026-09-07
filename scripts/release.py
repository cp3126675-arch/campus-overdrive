#!/usr/bin/env python3
"""Immutable local release archives. Never deploys or resets a checkout."""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / 'outputs/releases'


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def zip_manifest(path):
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None, 'ZIP CRC validation failed'
        files = {}
        for info in z.infolist():
            p = PurePosixPath(info.filename)
            assert not p.is_absolute() and '..' not in p.parts and '\\' not in info.filename, 'Unsafe ZIP path'
            assert (info.external_attr >> 16) & 0o170000 != 0o120000, 'ZIP symlink rejected'
            if info.is_dir():
                continue
            assert info.filename not in files, 'Duplicate ZIP entry'
            files[info.filename] = hashlib.sha256(z.read(info)).hexdigest()
        assert 'index.html' in files, 'Missing game entry'
        return files


def release_dir(version):
    assert re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', version), 'Invalid version'
    return RELEASES / version


def verify(folder):
    folder = Path(folder)
    m = json.loads((folder / 'manifest.json').read_text())
    assert digest(folder / 'campus-game.zip') == m['archiveSha256'], 'Archive checksum mismatch'
    assert zip_manifest(folder / 'campus-game.zip') == m['files'], 'File manifest mismatch'
    assert digest(folder / 'source.tar.gz') == m['sourceSha256'], 'Source checksum mismatch'
    if m.get('validationSha256'):
        assert digest(folder / 'validation.txt') == m['validationSha256'], 'Validation evidence mismatch'
    return m


def snapshot(version, archive, source_ref, deployment_ref=None, evidence=None):
    target = release_dir(version)
    assert not target.exists(), f'Release {version} already exists; choose a new version'
    sha = subprocess.check_output(['git', 'rev-parse', '--verify', source_ref + '^{commit}'], cwd=ROOT, text=True).strip()
    files = zip_manifest(archive)
    RELEASES.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.staging-', dir=RELEASES) as stage:
        stage = Path(stage)
        shutil.copyfile(archive, stage / 'campus-game.zip')
        subprocess.run(['git', 'archive', '--format=tar.gz', '--output=' + str(stage / 'source.tar.gz'), sha], cwd=ROOT, check=True)
        m = dict(version=version, createdAt=datetime.now(timezone.utc).isoformat(), sourceCommit=sha,
                 deploymentCommit=deployment_ref, archiveSha256=digest(stage / 'campus-game.zip'),
                 sourceSha256=digest(stage / 'source.tar.gz'), bytes=(stage / 'campus-game.zip').stat().st_size,
                 files=files)
        if evidence:
            shutil.copyfile(evidence, stage / 'validation.txt')
            m['validationSha256'] = digest(stage / 'validation.txt')
        (stage / 'manifest.json').write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n')
        verify(stage)
        # Refuse to overwrite a version even if a second process created it while staging.
        target.mkdir(exist_ok=False)
        for p in stage.iterdir():
            shutil.copyfile(p, target / p.name)
    return verify(target)


def prepare_rollback(version):
    folder = release_dir(version)
    m = verify(folder)
    root = ROOT / 'outputs/rollback'
    root.mkdir(parents=True, exist_ok=True)
    target = Path(tempfile.mkdtemp(prefix=version + '-', dir=root))
    shutil.copyfile(folder / 'campus-game.zip', target / 'campus-game.zip')
    with zipfile.ZipFile(target / 'campus-game.zip') as z:
        z.extractall(target / 'preview')
    for name, checksum in m['files'].items():
        assert digest(target / 'preview' / name) == checksum
    (target / 'rollback.json').write_text(json.dumps({
        'version': version, 'sourceCommit': m['sourceCommit'],
        'deploymentCommit': m.get('deploymentCommit'), 'archiveSha256': m['archiveSha256'],
        'status': 'prepared only; no checkout or public deployment changed',
    }, ensure_ascii=False, indent=2) + '\n')
    return target


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='command', required=True)
    s = sub.add_parser('snapshot')
    s.add_argument('version'); s.add_argument('--archive', required=True)
    s.add_argument('--source-ref', required=True); s.add_argument('--deployment-ref')
    s.add_argument('--evidence')
    v = sub.add_parser('verify'); v.add_argument('version')
    r = sub.add_parser('prepare-rollback'); r.add_argument('version')
    args = p.parse_args()
    if args.command == 'snapshot':
        m = snapshot(args.version, args.archive, args.source_ref, args.deployment_ref, args.evidence)
        print(json.dumps({k: v for k, v in m.items() if k != 'files'}, ensure_ascii=False, indent=2))
    elif args.command == 'verify':
        m = verify(release_dir(args.version))
        print(f"Verified {m['version']}: {len(m['files'])} files, SHA256 {m['archiveSha256']}")
    else:
        print(prepare_rollback(args.version))


if __name__ == '__main__':
    main()
