import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const manifest = JSON.parse(readFileSync('lib/asset-manifest.json', 'utf8'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
let total = 0;
for (const [source, record] of Object.entries(manifest)) {
  if (
    !/^\/(art|badges)\/[a-zA-Z0-9/_-]+\.(png|jpe?g)$/.test(source) ||
    !/^\/optimized\/[a-f0-9]{20}\.webp$/.test(record.file)
  )
    throw Error('Invalid delivery asset path');
  const original = readFileSync('public' + source);
  const delivery = readFileSync('public' + record.file);
  if (
    sha(original) !== record.sourceSha256 ||
    sha(delivery) !== record.sha256 ||
    delivery.length !== record.bytes
  )
    throw Error(
      `Stale optimized image: ${source}. Run npm run assets:optimize.`,
    );
  total += delivery.length;
}
const critical = [
  '/art/xuetang-road.jpg',
  '/art/meme-atlas.png',
  '/badges/qinghua.png',
  '/badges/shuxue.png',
];
const criticalBytes = critical.reduce((n, p) => n + manifest[p].bytes, 0);
if (criticalBytes > 600_000 || total > 4_000_000)
  throw Error('Image delivery budget exceeded');
if (process.argv.includes('--export')) {
  const root = 'outputs/GitHub-Pages部署版';
  for (const [source, record] of Object.entries(manifest)) {
    if (existsSync(root + source))
      throw Error('Original image leaked into the delivery package');
    if (sha(readFileSync(root + record.file)) !== record.sha256)
      throw Error(`Missing delivery image: ${record.file}`);
  }
}
console.log(
  `Asset hashes passed: ${Object.keys(manifest).length} encodings, ${total} total bytes, ${critical.length} critical images / ${criticalBytes} bytes.`,
);
