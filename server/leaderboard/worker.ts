import departments from '../../lib/departments.json';
const known = new Set(departments.map((d) => d.id));
interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
}
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function scoreMode(value: unknown) {
  if (value === undefined || value === null || value === 'race') return 'race';
  if (value === 'survival') return 'survival';
  throw new ApiError(400, '游戏模式无效');
}
const json = (value: unknown, status = 200) => Response.json(value, { status });
async function tokenHash(token: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
}
async function body(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new ApiError(415, '请使用 JSON 提交');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, '提交内容为空');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 2048) {
      await reader.cancel();
      throw new ApiError(413, '提交内容过大');
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data))
      throw new Error();
    return data;
  } catch {
    throw new ApiError(400, '提交内容无效');
  }
}
async function player(request: Request, env: Env) {
  const token =
    request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new ApiError(401, '请先设置参榜昵称');
  const found = await env.DB.prepare(
    'SELECT id, nickname FROM players WHERE token_hash = ?1',
  )
    .bind(await tokenHash(token))
    .first<{ id: string; nickname: string }>();
  if (!found) throw new ApiError(401, '参榜身份已失效，请重新设置昵称');
  return found;
}
function validNickname(value: unknown) {
  const nickname =
    typeof value === 'string' ? value.trim().normalize('NFC') : '';
  if (
    !nickname ||
    Array.from(nickname).length > 16 ||
    Array.from(nickname).some(
      (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
    )
  )
    throw new ApiError(400, '昵称需要 1～16 个字符');
  return nickname;
}
export async function route(request: Request, env: Env) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/health')
    return json({
      ok: true,
      modes: ['race', 'survival'],
      schema: 2,
      nicknameEditing: true,
    });
  if (request.method === 'POST' && url.pathname === '/api/player') {
    const data = await body(request);
    const nickname = validNickname(data.nickname);
    const id = crypto.randomUUID();
    const token = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('');
    await env.DB.prepare(
      'INSERT INTO players(id, token_hash, nickname, created_at) VALUES (?1, ?2, ?3, ?4)',
    )
      .bind(id, await tokenHash(token), nickname, Date.now())
      .run();
    return json({ playerId: id, token, nickname }, 201);
  }
  if (request.method === 'POST' && url.pathname === '/api/player/nickname') {
    const owner = await player(request, env);
    const data = await body(request);
    const nickname = validNickname(data.nickname);
    await env.DB.prepare('UPDATE players SET nickname = ?1 WHERE id = ?2')
      .bind(nickname, owner.id)
      .run();
    return json({ playerId: owner.id, nickname });
  }
  if (request.method === 'GET' && url.pathname === '/api/leaderboard') {
    const mode = scoreMode(url.searchParams.get('mode'));
    const prefix = mode === 'survival' ? 'survival_' : '';
    const direction = mode === 'survival' ? 'DESC' : 'ASC';
    const department = url.searchParams.get('department') || 'all';
    if (department !== 'all' && !known.has(department))
      throw new ApiError(400, '院系无效');
    const select =
      'SELECT b.player_id AS playerId, p.nickname, b.department_id AS departmentId, b.time_ms AS timeMs, b.completed_at AS completedAt FROM ';
    const query =
      department === 'all'
        ? env.DB.prepare(
            select +
              `${prefix}overall_best b JOIN players p ON p.id = b.player_id ORDER BY b.time_ms ${direction}, b.completed_at, b.player_id LIMIT 20`,
          )
        : env.DB.prepare(
            select +
              `${prefix}best_runs b JOIN players p ON p.id = b.player_id WHERE b.department_id = ?1 ORDER BY b.time_ms ${direction}, b.completed_at, b.player_id LIMIT 10`,
          ).bind(department);
    const rows = await query.all();
    return json({ rows: rows.results });
  }
  if (request.method === 'POST' && url.pathname === '/api/scores') {
    const owner = await player(request, env);
    const data = await body(request);
    const mode = scoreMode(data.mode);
    const prefix = mode === 'survival' ? 'survival_' : '';
    const comparison = mode === 'survival' ? '>' : '<';
    if (
      !known.has(data.departmentId) ||
      !Number.isSafeInteger(data.timeMs) ||
      data.timeMs < 1000 ||
      data.timeMs > 604800000 ||
      (mode === 'race'
        ? data.won !== true
        : data.ended !== true || data.won !== false) ||
      typeof data.version !== 'string' ||
      !/^\d+\.\d+\.\d+$/.test(data.version)
    )
      throw new ApiError(
        400,
        mode === 'survival'
          ? '只接受有效的生存结算成绩'
          : '只接受有效的完整通关成绩',
      );
    const now = Date.now();
    await env.DB.batch(
      [`${prefix}best_runs`, `${prefix}overall_best`].map((table) =>
        env.DB.prepare(
          `INSERT INTO ${table}(player_id, department_id, time_ms, completed_at, version) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(${table.endsWith('best_runs') ? 'player_id, department_id' : 'player_id'}) DO UPDATE SET department_id=excluded.department_id, time_ms=excluded.time_ms, completed_at=excluded.completed_at, version=excluded.version WHERE excluded.time_ms ${comparison} ${table}.time_ms`,
        ).bind(owner.id, data.departmentId, data.timeMs, now, data.version),
      ),
    );
    return json({ ok: true });
  }
  throw new ApiError(404, '接口不存在');
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin');
    const allowed = env.ALLOWED_ORIGINS.split(',')
      .map((s) => s.trim())
      .includes(origin || '');
    if (origin && !allowed) return json({ error: '来源不允许' }, 403);
    let response: Response;
    try {
      response =
        request.method === 'OPTIONS'
          ? new Response(null, { status: 204 })
          : await route(request, env);
    } catch (error) {
      response = json(
        {
          error:
            error instanceof ApiError
              ? error.message
              : '榜单服务暂时不可用，请稍后重试',
        },
        error instanceof ApiError ? error.status : 503,
      );
    }
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    if (allowed) {
      headers.set('Access-Control-Allow-Origin', origin!);
      headers.set('Vary', 'Origin');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization',
      );
    }
    return new Response(response.body, { status: response.status, headers });
  },
} satisfies ExportedHandler<Env>;
