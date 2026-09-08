import type { ScoreMode } from './records';
export interface PlayerIdentity {
  playerId: string;
  nickname: string;
  token: string;
}
export interface LeaderboardRow {
  score?: number;
  playerId: string;
  nickname: string;
  departmentId: string;
  timeMs: number;
  completedAt: number;
}
const IDENTITY_KEY = 'campus-player-v1';
let endpoint: Promise<string> | null = null;
export function readIdentity(): PlayerIdentity | null {
  try {
    const p = JSON.parse(localStorage.getItem(IDENTITY_KEY) || 'null');
    return p &&
      typeof p.playerId === 'string' &&
      typeof p.nickname === 'string' &&
      /^[a-f0-9]{64}$/.test(p.token)
      ? p
      : null;
  } catch {
    return null;
  }
}
export function persistIdentity(p: PlayerIdentity) {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}
async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      credentials: 'omit',
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data &&
          typeof data === 'object' &&
          'error' in data &&
          typeof data.error === 'string'
          ? data.error
          : '榜单请求失败',
      );
    return data as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError')
      throw new Error('网络较慢，请稍后重试');
    throw e;
  } finally {
    window.clearTimeout(timeout);
  }
}
export function leaderboardEndpoint() {
  if (!endpoint)
    endpoint = fetchJson<{ apiBase: string }>('./leaderboard.json')
      .then((data) => {
        if (!data.apiBase) throw new Error('全服排行榜尚未开通');
        const url = new URL(data.apiBase);
        const local =
          ['localhost', '127.0.0.1'].includes(location.hostname) &&
          ['localhost', '127.0.0.1'].includes(url.hostname);
        if (url.protocol !== 'https:' && !local)
          throw new Error('榜单服务地址无效');
        return url.origin;
      })
      .catch((error) => {
        endpoint = null;
        throw error;
      });
  return endpoint;
}
export async function registerPlayer(
  nickname: string,
): Promise<PlayerIdentity> {
  const base = await leaderboardEndpoint();
  return fetchJson<PlayerIdentity>(base + '/api/player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname }),
  });
}
export function randomNickname() {
  const values = crypto.getRandomValues(new Uint32Array(2));
  return (
    (values[0] % 2 ? '燕人' : '清人') +
    String(values[1] % 1_000_000).padStart(6, '0')
  );
}
export async function renamePlayer(
  identity: PlayerIdentity,
  nickname: string,
): Promise<PlayerIdentity> {
  const base = await leaderboardEndpoint();
  const next = await fetchJson<{ playerId: string; nickname: string }>(
    base + '/api/player/nickname',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + identity.token,
      },
      body: JSON.stringify({ nickname }),
    },
  );
  if (next.playerId !== identity.playerId || typeof next.nickname !== 'string')
    throw new Error('昵称返回异常，请重试');
  invalidateLeaderboards();
  return { ...identity, nickname: next.nickname };
}
let boardRevision = 0;
export function invalidateLeaderboards() {
  boardRevision++;
  boards.clear();
}
const boards = new Map<string, { at: number; rows: LeaderboardRow[] }>();
export async function getLeaderboard(
  department: string,
  mode: ScoreMode = 'race',
): Promise<LeaderboardRow[]> {
  const key = `${mode}:${department}`;
  const hit = boards.get(key);
  if (hit && Date.now() - hit.at < 30_000) return hit.rows;
  const base = await leaderboardEndpoint();
  const revision = boardRevision;
  const data = await fetchJson<{ rows: LeaderboardRow[] }>(
    base +
      '/api/leaderboard?department=' +
      encodeURIComponent(department) +
      '&mode=' +
      mode +
      (mode === 'survival' ? '&ranking=score' : ''),
  );
  const limit = department === 'all' ? 20 : 10;
  if (!Array.isArray(data.rows)) throw new Error('榜单返回格式异常');
  const rows = data.rows
    .slice(0, limit)
    .filter(
      (r: LeaderboardRow) =>
        r &&
        (mode !== 'survival' ||
          (Number.isSafeInteger(r.score) && r.score! >= 0)) &&
        typeof r.playerId === 'string' &&
        typeof r.nickname === 'string' &&
        typeof r.departmentId === 'string' &&
        Number.isSafeInteger(r.timeMs) &&
        r.timeMs > 0,
    );
  if (revision === boardRevision) boards.set(key, { at: Date.now(), rows });
  return rows;
}
export async function submitScore(
  identity: PlayerIdentity,
  score: {
    departmentId: string;
    timeMs: number;
    version: string;
    mode?: ScoreMode;
    score?: number;
  },
) {
  const base = await leaderboardEndpoint();
  await fetchJson(base + '/api/scores', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + identity.token,
    },
    body: JSON.stringify({
      ...score,
      mode: score.mode ?? 'race',
      ...(score.mode === 'survival' ? { ranking: 'score' } : {}),
      won: score.mode !== 'survival',
      ended: true,
    }),
  });
  invalidateLeaderboards();
}
