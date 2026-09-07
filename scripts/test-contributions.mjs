import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateAudio } from './check-contributions.mjs';
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'campus-audio-'));
  const dir = join(root, 'public/audio');
  mkdirSync(dir, { recursive: true });
  const track = {
    id: 'battle',
    file: 'battle.mp3',
    title: 'Battle',
    author: 'Contributor',
    license: 'CC-BY-4.0',
    source: 'original',
    usage: 'battle',
    loop: true,
  };
  const save = (tracks) =>
    writeFileSync(
      join(dir, 'tracks.json'),
      JSON.stringify({ schemaVersion: 1, tracks }),
    );
  writeFileSync(
    join(dir, 'battle.mp3'),
    Buffer.concat([Buffer.from('ID3'), Buffer.alloc(20)]),
  );
  try {
    run({ root, dir, track, save });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test('audio-only contribution is accepted with attribution and signature', () =>
  fixture(({ root, track, save }) => {
    save([track]);
    assert.equal(validateAudio(root), 1);
  }));
test('reject missing attribution, path traversal and unsupported license', () =>
  fixture(({ root, track, save }) => {
    for (const patch of [
      { author: '' },
      { file: '../../outside.mp3' },
      { license: 'unknown' },
      { source: 'javascript:alert(1)' },
    ]) {
      save([{ ...track, ...patch }]);
      assert.throws(() => validateAudio(root));
    }
  }));
test('reject fake media, duplicate IDs and unlisted files', () =>
  fixture(({ root, dir, track, save }) => {
    save([track, track]);
    assert.throws(() => validateAudio(root), /duplicate/);
    save([track]);
    writeFileSync(join(dir, 'battle.mp3'), 'not an actual audio file');
    assert.throws(() => validateAudio(root), /signature/);
    save([]);
    assert.throws(() => validateAudio(root), /Undocumented/);
  }));
