'use client';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DEPARTMENTS } from '@/lib/departments';
import {
  formatRecordTime,
  type RecordBook,
  type ScoreMode,
} from '@/lib/records';
import { getLeaderboard, type LeaderboardRow } from '@/lib/leaderboard-client';
import type { useOnlineScores } from '@/hooks/use-online-scores';
const names = new Map(DEPARTMENTS.map((d) => [d.id, d.name]));
export function GameRecords({
  books,
  initialMode,
  online,
  open,
  onOpenChange,
  container,
}: {
  books: Record<ScoreMode, RecordBook>;
  initialMode: ScoreMode;
  online: ReturnType<typeof useOnlineScores>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: RefObject<HTMLElement | null>;
}) {
  const [mode, setMode] = useState<ScoreMode>(initialMode);
  const book = books[mode];
  const [scope, setScope] = useState('all');
  const [view, setView] = useState<'online' | 'local'>('online');
  const [response, setResponse] = useState<{
    key: string;
    rows: LeaderboardRow[];
    error: string;
  }>({ key: '', rows: [], error: '' });
  const [retry, setRetry] = useState(0);
  const [nickname, setNickname] = useState('');
  const available = useMemo(
    () =>
      view === 'online'
        ? DEPARTMENTS
        : DEPARTMENTS.filter((d) => (book.departments[d.id]?.length || 0) > 0),
    [book, view],
  );
  const localRows =
    scope === 'all' ? book.overall : book.departments[scope] || [];
  const requestKey = `${mode}:${scope}:${retry}:${online.message}`;
  const loading = online.configured && response.key !== requestKey;
  const rows = response.key === requestKey ? response.rows : [];
  const error = response.key === requestKey ? response.error : '';
  useEffect(() => {
    if (!open || view !== 'online' || !online.configured) return;
    let active = true;
    void getLeaderboard(scope, mode)
      .then((rows) => {
        if (active) setResponse({ key: requestKey, rows, error: '' });
      })
      .catch((e) => {
        if (active)
          setResponse({ key: requestKey, rows: [], error: e.message });
      });
    return () => {
      active = false;
    };
  }, [open, view, scope, mode, requestKey, online.configured]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        container={container}
        className="records-dialog"
        showCloseButton={false}
      >
        <div className="records-heading">
          <DialogTitle>
            {mode === 'survival'
              ? '生存排行榜 · 越久越强'
              : '竞速排行榜 · 越快越强'}
          </DialogTitle>
          <DialogClose render={<Button variant="ghost" size="sm" />}>
            关闭
          </DialogClose>
        </div>
        <DialogDescription>
          {view === 'online'
            ? '每人只取最佳成绩 · 院系前10名 / 总榜前20名'
            : '本机挑战历史 · 竞速与生存分别记录'}
        </DialogDescription>
        <div className="records-tabs" aria-label="排行榜模式">
          {(['race', 'survival'] as const).map((value) => (
            <Button
              key={value}
              variant={mode === value ? 'default' : 'ghost'}
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setScope('all');
              }}
            >
              {value === 'survival' ? '生存 · 最长时间' : '竞速 · 最短时间'}
            </Button>
          ))}
        </div>
        <div className="records-tabs">
          <Button
            variant={view === 'online' ? 'default' : 'ghost'}
            aria-pressed={view === 'online'}
            onClick={() => {
              setView('online');
              setScope('all');
            }}
          >
            全服排行
          </Button>
          <Button
            variant={view === 'local' ? 'default' : 'ghost'}
            aria-pressed={view === 'local'}
            onClick={() => {
              setView('local');
              setScope('all');
            }}
          >
            本机纪录
          </Button>
        </div>
        {view === 'online' && (
          <div className="records-identity">
            {!online.configured ? (
              <p>{online.configError || '正在连接榜单…'}</p>
            ) : online.identity ? (
              <span>
                参榜昵称：{online.identity.nickname}
                <small> · 身份保存在此浏览器</small>
              </span>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void online.join(nickname);
                }}
              >
                <label htmlFor="score-nickname">参榜昵称</label>
                <input
                  id="score-nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={32}
                  placeholder="1～16个字符"
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  disabled={online.busy || !nickname.trim()}
                >
                  加入排行榜
                </Button>
              </form>
            )}
            {!!online.message && <output>{online.message}</output>}
            {!online.identitySaved && (
              <small>浏览器不允许保存身份，刷新后需要重新设置昵称。</small>
            )}
            {online.identity && online.pending && (
              <Button
                variant="ghost"
                disabled={online.busy}
                onClick={() => void online.upload()}
              >
                重试提交成绩
              </Button>
            )}
          </div>
        )}
        <label className="records-filter">
          查看榜单
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">全部院系 · 前20名</option>
            {available.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · 前10名
              </option>
            ))}
          </select>
        </label>
        <div className="records-scroll">
          {view === 'online' ? (
            loading ? (
              <p>正在读取排行榜…</p>
            ) : error ? (
              <p>
                {error}{' '}
                <Button variant="ghost" onClick={() => setRetry((n) => n + 1)}>
                  重试
                </Button>
              </p>
            ) : rows.length ? (
              <table>
                <thead>
                  <tr>
                    <th>排名</th>
                    <th>玩家</th>
                    <th>{mode === 'survival' ? '存活时间' : '通关用时'}</th>
                    <th>主修</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={r.playerId}
                      className={i === 0 ? 'record-first' : undefined}
                    >
                      <td>{i === 0 ? '🏆' : i + 1}</td>
                      <td>
                        {r.nickname}
                        {r.playerId === online.identity?.playerId
                          ? '（我）'
                          : ''}
                      </td>
                      <td>{formatRecordTime(r.timeMs)}</td>
                      <td>{names.get(r.departmentId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="records-empty">
                {online.configured
                  ? '还没有参榜成绩，留下你的第一条纪录！'
                  : '全服榜开通后将在这里显示玩家成绩。'}
              </p>
            )
          ) : localRows.length ? (
            <table>
              <thead>
                <tr>
                  <th>排名</th>
                  <th>{mode === 'survival' ? '存活时间' : '通关用时'}</th>
                  <th>主修</th>
                  <th>日期</th>
                </tr>
              </thead>
              <tbody>
                {localRows.map((r, i) => (
                  <tr
                    key={r.id}
                    className={i === 0 ? 'record-first' : undefined}
                  >
                    <td>{i === 0 ? '🏆' : i + 1}</td>
                    <td>{formatRecordTime(r.timeMs)}</td>
                    <td>{names.get(r.departmentId)}</td>
                    <td>
                      {new Date(r.completedAt).toLocaleDateString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="records-empty">
              {mode === 'survival'
                ? '还没有生存纪录。完成一次生存挑战，留下你的成绩！'
                : '还没有通关纪录。击败最终 Boss，留下你的第一个成绩！'}
            </p>
          )}
        </div>
        <p className="records-footnote">
          {view === 'online'
            ? '昵称与最佳成绩公开展示；换浏览器或清除数据会创建新的参榜身份。'
            : '本机纪录保存在当前浏览器，清除网站数据后会丢失。'}
        </p>
      </DialogContent>
    </Dialog>
  );
}
