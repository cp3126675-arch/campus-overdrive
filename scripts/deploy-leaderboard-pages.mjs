import {
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  copyFile,
  rm,
} from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const wrangler = resolve(root, 'node_modules/wrangler/bin/wrangler.js');
const stage = await mkdtemp(join(tmpdir(), 'campus-leaderboard-pages-'));
function run(args, cwd = root) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    cwd,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Wrangler failed: ' + result.status);
}
try {
  run([
    'deploy',
    '--dry-run',
    '--config',
    'server/leaderboard/wrangler.jsonc',
    '--outdir',
    join(stage, 'bundle'),
  ]);
  const config = JSON.parse(
    await readFile(
      resolve(root, 'server/leaderboard/pages/wrangler.jsonc'),
      'utf8',
    ),
  );
  delete config.$schema;
  for (const db of config.d1_databases) delete db.migrations_dir;
  await writeFile(
    join(stage, 'wrangler.jsonc'),
    JSON.stringify(config, null, 2),
  );
  await mkdir(join(stage, 'public'));
  await copyFile(
    join(stage, 'bundle/worker.js'),
    join(stage, 'public/_worker.js'),
  );
  for (const name of ['index.html', '_routes.json']) {
    await copyFile(
      resolve(root, 'server/leaderboard/pages/public', name),
      join(stage, 'public', name),
    );
  }
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (commit.status !== 0) throw new Error('Cannot identify source commit');
  // Isolated staging avoids an unrelated Vite-generated .wrangler/deploy redirect.
  run(
    [
      'pages',
      'deploy',
      '--project-name',
      config.name,
      '--branch',
      'main',
      '--commit-hash',
      commit.stdout.trim(),
      '--commit-dirty=true',
    ],
    stage,
  );
} finally {
  await rm(stage, { recursive: true, force: true });
}
