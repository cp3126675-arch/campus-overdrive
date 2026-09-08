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
  const raceBefore = JSON.stringify(
    (await request('/api/leaderboard')).data.rows,
  );
  for (let i = 0; i < players.length; i++) {
    assert.equal(
      (
        await request(
          '/api/scores',
          {
            mode: 'survival',
            departmentId: 'd001',
            timeMs: 300000 + i * 1000,
            version: '0.6.3',
            ended: true,
            won: false,
          },
          players[i].token,
        )
      ).status,
      200,
    );
  }
  const survivalBoard = async (scope = 'all') =>
    (await request('/api/leaderboard?mode=survival&department=' + scope)).data
      .rows;
  let longest = await survivalBoard();
  assert.equal(longest.length, 20);
  assert.equal(longest[0].timeMs, 324000);
  assert.equal((await survivalBoard('d001')).length, 10);
  for (const bad of [
    { mode: 'unknown' },
    { mode: 'survival', ended: false },
    { mode: 'survival', won: true },
  ]) {
    assert.equal(
      (
        await request(
          '/api/scores',
          {
            mode: 'survival',
            departmentId: 'd001',
            timeMs: 500000,
            version: '0.6.3',
            ended: true,
            won: false,
            ...bad,
          },
          owner.token,
        )
      ).status,
      400,
    );
  }
  assert.equal((await request('/api/leaderboard?mode=unknown')).status, 400);
  await Promise.all(
    [400000, 500000, 420000, 450000].map((timeMs) =>
      request(
        '/api/scores',
        {
          mode: 'survival',
          departmentId: 'd001',
          timeMs,
          version: '0.6.3',
          ended: true,
          won: false,
        },
        owner.token,
      ),
    ),
  );
  assert.equal((await survivalBoard())[0].timeMs, 500000);
  await request(
    '/api/scores',
    {
      mode: 'survival',
      departmentId: 'd002',
      timeMs: 510000,
      version: '0.6.3',
      ended: true,
      won: false,
    },
    owner.token,
  );
  longest = await survivalBoard();
  assert.equal(longest[0].departmentId, 'd002');
  assert.equal(
    longest.filter((row) => row.playerId === owner.playerId).length,
    1,
  );
  assert.equal((await survivalBoard('d001'))[0].timeMs, 500000);
  assert.equal(
    JSON.stringify((await request('/api/leaderboard')).data.rows),
    raceBefore,
    'survival writes must not touch race scores',
  );
  assert(!JSON.stringify(longest).includes('token'));
  // Score-season boards are independent of legacy duration boards.
  const legacyBefore = JSON.stringify(await survivalBoard());
  const scored = async (scope = 'all') =>
    (
      await request(
        '/api/leaderboard?mode=survival&ranking=score&department=' + scope,
      )
    ).data.rows;
  const postScore = (token, score, timeMs, departmentId = 'd001') =>
    request(
      '/api/scores',
      {
        mode: 'survival',
        ranking: 'score',
        score,
        timeMs,
        departmentId,
        version: '0.6.7',
        ended: true,
        won: false,
      },
      token,
    );
  for (let i = 0; i < players.length; i++)
    assert.equal(
      (await postScore(players[i].token, i * 100, 400000 - i * 1000)).status,
      200,
    );
  assert.equal((await scored()).length, 20);
  assert.equal((await scored('d001')).length, 10);
  assert.equal((await scored())[0].score, 2400);
  await Promise.all(
    [
      [5000, 400000],
      [4900, 200000],
      [5000, 300000],
      [4800, 900000],
    ].map(([score, time]) => postScore(owner.token, score, time)),
  );
  assert.equal((await scored())[0].score, 5000);
  assert.equal((await scored())[0].timeMs, 300000);
  await postScore(owner.token, 5000, 290000, 'd002');
  assert.equal((await scored())[0].departmentId, 'd002');
  assert.equal((await scored('d001'))[0].timeMs, 300000);
  assert.equal(
    (await scored()).filter((r) => r.playerId === owner.playerId).length,
    1,
  );
  for (const score of [-1, 1.5, 1000000001, '5000', null])
    assert.equal((await postScore(owner.token, score, 300000)).status, 400);
  assert.equal(
    (await request('/api/leaderboard?mode=race&ranking=score')).status,
    400,
  );
  assert.equal(
    (await request('/api/leaderboard?mode=survival&ranking=invalid')).status,
    400,
  );
  assert.equal(JSON.stringify(await survivalBoard()), legacyBefore);
  assert.equal(
    JSON.stringify((await request('/api/leaderboard')).data.rows),
    raceBefore,
  );
  console.log(
    'Score season: highest score, shorter equal-score run, 10/20 limits, concurrent upserts, department separation, validation and legacy isolation passed.',
  );
  // A nickname belongs to the player, never to a copied score row.
  const paths = [
    '/api/leaderboard?mode=survival&ranking=score',
    '/api/leaderboard?mode=survival&ranking=score&department=d001',
    '/api/leaderboard',
    '/api/leaderboard?department=d001',
    '/api/leaderboard?mode=survival',
    '/api/leaderboard?mode=survival&department=d001',
  ];
  const beforeRename = await Promise.all(
    paths.map(async (path) => (await request(path)).data.rows),
  );
  assert.equal(
    (await request('/api/player/nickname', { nickname: '冒名' })).status,
    401,
  );
  assert.equal(
    (
      await request(
        '/api/player/nickname',
        { nickname: '冒名' },
        '0'.repeat(64),
      )
    ).status,
    401,
  );
  for (const nickname of ['', ' '.repeat(3), 'a'.repeat(17), '非法\n昵称'])
    assert.equal(
      (await request('/api/player/nickname', { nickname }, owner.token)).status,
      400,
    );
  const renamed = await request(
    '/api/player/nickname',
    { nickname: '  清人123456  ', playerId: 'someone-else' },
    owner.token,
  );
  assert.equal(renamed.status, 200);
  assert.deepEqual(renamed.data, {
    playerId: owner.playerId,
    nickname: '清人123456',
  });
  assert(!JSON.stringify(renamed.data).includes('token'));
  for (const [i, path] of paths.entries()) {
    const after = (await request(path)).data.rows;
    assert.deepEqual(
      after,
      beforeRename[i].map((row) =>
        row.playerId === owner.playerId
          ? { ...row, nickname: '清人123456' }
          : row,
      ),
    );
    assert(
      after.some((row) => row.playerId === owner.playerId),
      'owner remains ranked',
    );
  }
  assert.equal(
    (
      await request(
        '/api/player/nickname',
        { nickname: '燕人654321' },
        owner.token,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        '/api/player/nickname',
        { nickname: '燕人654321' },
        owner.token,
      )
    ).status,
    200,
    'retry is idempotent with same identity',
  );
  assert.equal(
    (
      await request(
        '/api/player/nickname',
        { nickname: 'e\u0301' },
        owner.token,
      )
    ).data.nickname,
    'é',
  );
  console.log(
    'Nickname edits passed: authenticated owner only, validation, Unicode normalization, old scores in both modes and scopes keep identity/time/rank and immediately show new name; repeat rename uses original token.',
  );
  console.log(
    'Dual-mode leaderboard HTTP + real local D1 passed: descending survival and ascending race are isolated; 25 players, department top10, global top20, unique player best, concurrent monotonic upserts, CORS, authentication, validation and bounded responses.',
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
