import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const temp = await mkdtemp(join(tmpdir(), 'campus-scores-'));
const wrangler = 'node_modules/wrangler/bin/wrangler.js';
const config = 'server/leaderboard/wrangler.jsonc';
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
const probe = createServer();
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
let worker;
let output = '';
try {
  const migration = spawnSync(
    process.execPath,
    [
      wrangler,
      'd1',
      'migrations',
      'apply',
      'DB',
      '--local',
      '--config',
      config,
      '--persist-to',
      temp,
    ],
    { env, encoding: 'utf8', timeout: 60_000 },
  );
  assert.equal(migration.status, 0, migration.stderr);
  worker = spawn(
    process.execPath,
    [
      wrangler,
      'dev',
      '--local',
      '--config',
      config,
      '--port',
      String(port),
      '--persist-to',
      temp,
      '--var',
      'ALLOWED_ORIGINS:http://127.0.0.1:3000',
      '--show-interactive-dev-session=false',
    ],
    { env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  worker.stdout.on('data', (b) => {
    output += b;
  });
  worker.stderr.on('data', (b) => {
    output += b;
  });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if (
        (
          await fetch(base + '/api/health', {
            signal: AbortSignal.timeout(500),
          })
        ).ok
      ) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert(ready, output);
  const request = async (
    path,
    data,
    token,
    origin = 'http://127.0.0.1:3000',
  ) => {
    const r = await fetch(base + path, {
      method: data ? 'POST' : 'GET',
      headers: {
        Origin: origin,
        ...(data ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: r.status, headers: r.headers, data: await r.json() };
  };
  assert.equal(
    (await request('/api/leaderboard', null, null, 'https://untrusted.example'))
      .status,
    403,
  );
  assert.equal((await request('/api/player', { nickname: ' ' })).status, 400);
  assert.equal(
    (await request('/api/player', { nickname: 'x'.repeat(2100) })).status,
    413,
  );
  assert.equal((await request('/api/scores', { won: true })).status, 401);
  const players = [];
  for (let i = 0; i < 25; i++) {
    const created = await request('/api/player', { nickname: '测试玩家' + i });
    assert.equal(created.status, 201);
    assert.equal(created.data.token.length, 64);
    players.push(created.data);
    const posted = await request(
      '/api/scores',
      {
        departmentId: 'd001',
        timeMs: 100_000 + i * 1000,
        version: '0.6.2',
        won: true,
      },
      created.data.token,
    );
    assert.equal(posted.status, 200);
  }
  const scores = await request('/api/leaderboard?department=d001');
  assert.equal(scores.data.rows.length, 10);
  assert.equal(
    scores.headers.get('access-control-allow-origin'),
    'http://127.0.0.1:3000',
  );
  assert(!JSON.stringify(scores.data).includes('token'));
  assert.equal(
    (await request('/api/leaderboard')).data.rows.length,
    20,
    'one department can fill the global 20',
  );
  assert.equal(
    (await request('/api/leaderboard?department=unknown')).status,
    400,
  );
  const owner = players[0];
  for (const bad of [
    { timeMs: -1 },
    { won: false },
    { departmentId: 'unknown' },
  ])
    assert.equal(
      (
        await request(
          '/api/scores',
          {
            departmentId: 'd001',
            timeMs: 20000,
            version: '0.6.2',
            won: true,
            ...bad,
          },
          owner.token,
        )
      ).status,
      400,
    );
  await Promise.all(
    [80000, 90000, 70000, 85000].map((timeMs) =>
      request(
        '/api/scores',
        { departmentId: 'd001', timeMs, version: '0.6.2', won: true },
        owner.token,
      ),
    ),
  );
  assert.equal(
    (await request('/api/leaderboard?department=d001')).data.rows[0].timeMs,
    70000,
    'concurrent upserts preserve the fastest score',
  );
  await request(
    '/api/scores',
    {
      departmentId: 'd002',
      timeMs: 60000,
      version: '0.6.2',
      won: true,
      playerId: players[1].playerId,
    },
    owner.token,
  );
  const all = (await request('/api/leaderboard')).data.rows;
  assert.equal(
    all[0].playerId,
    owner.playerId,
    'request body cannot select another player',
  );
  assert.equal(all[0].departmentId, 'd002');
  assert.equal(
    all.filter((r) => r.playerId === owner.playerId).length,
    1,
    'each player appears only once globally',
  );
  assert.equal(
    (await request('/api/leaderboard?department=d001')).data.rows[0].timeMs,
    70000,
    'department best retained after another-department win',
  );
  console.log(
    'Leaderboard HTTP + real local D1 passed: 25 players, department top10, global top20, unique player best, concurrent monotonic upserts, CORS, authentication, validation and bounded responses.',
  );
} finally {
  if (worker && worker.exitCode === null) {
    const exited = new Promise((resolve) => worker.once('exit', resolve));
    worker.kill('SIGTERM');
    const force = setTimeout(() => worker.kill('SIGKILL'), 5000);
    await exited;
    clearTimeout(force);
  }
  await rm(temp, { recursive: true, force: true });
}
