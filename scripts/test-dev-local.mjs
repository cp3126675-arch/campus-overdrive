import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const state = await mkdtemp(join(tmpdir(), 'campus-dev-'));
const probe = createServer();
await new Promise((ok) => probe.listen(0, '127.0.0.1', ok));
const port = probe.address().port;
await new Promise((ok) => probe.close(ok));
const base = `http://127.0.0.1:${port}`;
let processHandle;
let output = '';
async function stop() {
  if (
    !processHandle ||
    processHandle.exitCode !== null ||
    processHandle.signalCode !== null
  )
    return;
  const child = processHandle;
  const ended = new Promise((ok) => child.once('exit', ok));
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 8000);
  await ended;
  clearTimeout(timer);
}
async function boot() {
  output = '';
  processHandle = spawn(
    process.execPath,
    ['scripts/dev-local.mjs', '--port', String(port)],
    {
      env: {
        ...process.env,
        CAMPUS_DEV_STATE_DIR: state,
        WRANGLER_SEND_METRICS: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  for (const stream of [processHandle.stdout, processHandle.stderr])
    stream.on('data', (b) => {
      output = (output + b).slice(-16000);
    });
  for (let i = 0; i < 200; i++) {
    if (processHandle.exitCode !== null || processHandle.signalCode !== null)
      throw new Error(output);
    try {
      if (
        (
          await fetch(base + '/api/health', {
            signal: AbortSignal.timeout(500),
          })
        ).ok
      )
        return;
    } catch {}
    await new Promise((ok) => setTimeout(ok, 200));
  }
  throw new Error('Local startup timed out: ' + output);
}
async function request(path, data, token, host = base) {
  const r = await fetch(host + path, {
    method: data ? 'POST' : 'GET',
    headers: {
      Origin: host,
      ...(data ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(5000),
  });
  return { status: r.status, data: await r.json() };
}
try {
  await boot();
  for (const host of [base, `http://localhost:${port}`]) {
    const config = await request('/leaderboard.json', null, null, host);
    assert.equal(config.data.apiBase, host);
    assert.equal((await request('/api/health', null, null, host)).status, 200);
  }
  assert.equal((await request('/api/player', { nickname: ' ' })).status, 400);
  const created = await request('/api/player', { nickname: '本地同学' });
  assert.equal(created.status, 201);
  const identity = created.data;
  for (const mode of ['race', 'survival']) {
    const score = {
      departmentId: 'd001',
      timeMs: 300000,
      version: '0.6.12',
      won: true,
      mode,
      ...(mode === 'survival'
        ? { score: 1200, ranking: 'score', ended: true, won: false }
        : {}),
    };
    assert.equal((await request('/api/scores', score)).status, 401);
    assert.equal(
      (await request('/api/scores', score, identity.token)).status,
      200,
    );
  }
  assert.equal(
    (
      await request(
        '/api/player/nickname',
        { nickname: '改名同学' },
        identity.token,
      )
    ).status,
    200,
  );
  for (const mode of ['race', 'survival']) {
    const board = await request(
      `/api/leaderboard?department=all&mode=${mode}${mode === 'survival' ? '&ranking=score' : ''}`,
    );
    assert.equal(board.data.rows[0].nickname, '改名同学');
    assert.equal(board.data.rows[0].playerId, identity.playerId);
  }
  await stop();
  await boot();
  const saved = await request(
    '/api/leaderboard?department=all&mode=survival&ranking=score',
  );
  assert.equal(saved.data.rows[0].nickname, '改名同学');
  assert.equal(saved.data.rows[0].score, 1200);
  assert.equal(
    JSON.parse(await readFile('public/leaderboard.json', 'utf8')).apiBase,
    'https://campus-overdrive-scores.pages.dev',
  );
  console.log(
    'Local dev integration passed: both loopback hosts, same-origin config, registration, rename, authenticated scores in both modes, restart persistence; production config unchanged.',
  );
} finally {
  await stop();
  await rm(state, { recursive: true, force: true });
}
