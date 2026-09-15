// One command starts the real leaderboard worker against an isolated local D1.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const config = 'server/leaderboard/wrangler.local.jsonc';
const wrangler = 'node_modules/wrangler/bin/wrangler.js';
const state = resolve(
  process.env.CAMPUS_DEV_STATE_DIR || '.wrangler/campus-dev',
);
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
function start(args, extraEnv = {}, stdio = 'inherit') {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: { ...env, ...extraEnv },
    stdio,
  });
  children.add(child);
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    children.delete(child);
    if (!stopping) stop(code ?? 1);
  });
  return child;
}
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
      state,
    ],
    { cwd: root, env, stdio: 'inherit', timeout: 60_000 },
  );
  if (migration.status !== 0)
    throw new Error(
      '本地排行榜初始化失败；检查上方错误。无需 Cloudflare 登录。',
    );
  if (!stopping) {
    const probe = createServer();
    await new Promise((ok, fail) => {
      probe.once('error', fail);
      probe.listen(0, '127.0.0.1', ok);
    });
    const port = probe.address().port;
    await new Promise((ok) => probe.close(ok));
    const api = `http://127.0.0.1:${port}`;
    start([
      wrangler,
      'dev',
      '--local',
      '--config',
      config,
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--inspector-port',
      '0',
      '--persist-to',
      state,
      '--show-interactive-dev-session=false',
    ]);
    let ready = false;
    for (let i = 0; i < 150 && !stopping; i++) {
      try {
        if (
          (
            await fetch(api + '/api/health', {
              signal: AbortSignal.timeout(500),
            })
          ).ok
        ) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((ok) => setTimeout(ok, 200));
    }
    if (!ready) throw new Error('本地排行榜未能启动；请检查 Wrangler 输出。');
    console.log(
      `\n本地开发排行榜已就绪。昵称与测试成绩仅保存在 ${state}，不会提交正式榜单。\n`,
    );
    start(
      [
        'node_modules/vite/bin/vite.js',
        '--config',
        'vite.community.config.ts',
        '--host',
        '127.0.0.1',
        '--port',
        '3000',
        '--strictPort',
        ...process.argv.slice(2),
      ],
      { CAMPUS_LOCAL_API: api },
    );
  }
} catch (error) {
  console.error(error.message);
  stop(1);
}
