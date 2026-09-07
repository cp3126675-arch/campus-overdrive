import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function validateAudio(root = process.cwd()) {
  const dir = join(root, 'public/audio');
  const manifest = JSON.parse(readFileSync(join(dir, 'tracks.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.tracks))
    throw Error('Invalid audio manifest schema');
  const ids = new Set(),
    files = new Set();
  for (const track of manifest.tracks) {
    for (const key of [
      'id',
      'file',
      'title',
      'author',
      'license',
      'source',
      'usage',
    ]) {
      if (typeof track[key] !== 'string' || !track[key].trim())
        throw Error(`Missing audio ${key}`);
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(track.id) || ids.has(track.id))
      throw Error('Invalid or duplicate audio id');
    if (
      !/^[a-z0-9][a-z0-9-]*\.(mp3|ogg|wav)$/.test(track.file) ||
      files.has(track.file)
    )
      throw Error('Invalid or duplicate audio file');
    if (!['CC0-1.0', 'CC-BY-4.0'].includes(track.license))
      throw Error('Discuss nonstandard audio licenses before submission');
    if (
      !['menu', 'battle', 'boss', 'victory', 'defeat'].includes(track.usage) ||
      typeof track.loop !== 'boolean'
    )
      throw Error('Invalid audio usage/loop');
    if (track.source !== 'original') {
      const source = new URL(track.source);
      if (
        !['https:', 'http:'].includes(source.protocol) ||
        source.username ||
        source.password
      )
        throw Error('Invalid audio source URL');
    }
    const file = join(dir, track.file),
      stat = lstatSync(file);
    if (!stat.isFile() || stat.size < 12 || stat.size > 10 * 1024 * 1024)
      throw Error('Audio file must be 12 bytes–10 MiB');
    const data = readFileSync(file),
      ext = track.file.split('.').at(-1);
    const signature =
      ext === 'ogg'
        ? data.subarray(0, 4).toString() === 'OggS'
        : ext === 'wav'
          ? data.subarray(0, 4).toString() === 'RIFF' &&
            data.subarray(8, 12).toString() === 'WAVE'
          : data.subarray(0, 3).toString() === 'ID3' ||
            (data[0] === 0xff && (data[1] & 0xe0) === 0xe0);
    if (!signature)
      throw Error(`File signature disagrees with extension: ${track.file}`);
    ids.add(track.id);
    files.add(track.file);
  }
  for (const name of readdirSync(dir)) {
    if (name === 'README.md' || name === 'tracks.json') continue;
    if (!files.has(name)) throw Error(`Undocumented audio file: ${name}`);
  }
  return manifest.tracks.length;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  console.log(
    `Audio contribution manifest passed (${validateAudio()} tracks). This is not a copyright or listening review.`,
  );
}
