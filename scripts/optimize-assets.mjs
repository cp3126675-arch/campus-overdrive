// Reproducible delivery encodings. Original photographs stay untouched in public/art.
import sharp from 'sharp';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = {};
await mkdir('public/optimized', { recursive: true });
async function walk(dir) {
  for (const entry of await readdir(join('public', dir), {
    withFileTypes: true,
  })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      await walk(file);
      continue;
    }
    if (!/\.(png|jpe?g)$/i.test(file)) continue;
    const bytes = await readFile(join('public', file));
    const atlas = file.includes('atlas');
    const campusMap = /tsinghua-campus-map/.test(file);
    const size = file.startsWith('badges/')
      ? 128
      : campusMap
        ? 3072
        : /xuetang-road|tsinghua-gate/.test(file)
          ? 1280
          : 512;
    let pipeline = sharp(bytes);
    if (!atlas)
      pipeline = pipeline.resize(size, size, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    const encoded = await pipeline
      .webp({ quality: campusMap ? 90 : atlas ? 86 : 82, effort: 6 })
      .toBuffer();
    const output = `optimized/${hash(encoded).slice(0, 20)}.webp`;
    await writeFile(join('public', output), encoded);
    manifest['/' + file] = {
      file: '/' + output,
      bytes: encoded.length,
      originalBytes: bytes.length,
      sourceSha256: hash(bytes),
      sha256: hash(encoded),
    };
  }
}
await walk('art');
await walk('badges');
await writeFile(
  'lib/asset-manifest.json',
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(
  `Encoded ${Object.keys(manifest).length} original images: ${Object.values(manifest).reduce((n, x) => n + x.originalBytes, 0)} → ${Object.values(manifest).reduce((n, x) => n + x.bytes, 0)} bytes`,
);
