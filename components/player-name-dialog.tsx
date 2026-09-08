'use client';
import { useState, type RefObject } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { randomNickname } from '@/lib/leaderboard-client';
import type { useOnlineScores } from '@/hooks/use-online-scores';

export function PlayerNameDialog({
  online,
  container,
  onClose,
  onSaved,
}: {
  online: ReturnType<typeof useOnlineScores>;
  container: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(online.identity?.nickname || '');
  const [error, setError] = useState('');
  const editing = !!online.identity;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !online.busy) onClose();
      }}
    >
      <DialogContent
        container={container}
        className="player-name-dialog"
        showCloseButton={false}
      >
        <div className="records-heading">
          <DialogTitle>
            {editing ? '换个昵称，继续开卷' : '同学，怎么称呼？'}
          </DialogTitle>
          <DialogClose
            disabled={online.busy}
            render={<Button variant="ghost" size="sm" />}
          >
            返回
          </DialogClose>
        </div>
        <DialogDescription>
          {editing
            ? '修改后，竞速和生存榜上的旧成绩都会显示新昵称。'
            : '先给自己取个昵称。它会跟着徽章，也会出现在排行榜上，之后随时能改。'}
        </DialogDescription>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (online.busy) return;
            const value = name.trim().normalize('NFC');
            if (
              !value ||
              Array.from(value).length > 16 ||
              Array.from(value).some(
                (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
              )
            ) {
              setError('请输入1～16个字符的昵称');
              return;
            }
            setError('');
            if (await online.join(value)) onSaved();
          }}
        >
          <label htmlFor="player-name">你的昵称</label>
          <input
            id="player-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            disabled={online.busy}
            autoComplete="off"
            placeholder="输入昵称，或试试随机"
          />
          <div className="player-name-actions">
            <Button
              type="button"
              variant="outline"
              disabled={online.busy}
              onClick={() => {
                setName(randomNickname());
                setError('');
              }}
            >
              随机昵称
            </Button>
            <Button type="submit" disabled={online.busy || !name.trim()}>
              {online.busy ? '保存中…' : editing ? '保存昵称' : '就叫这个'}
            </Button>
          </div>
          <output aria-live="polite">{error || online.message}</output>
        </form>
        <small>身份保存在当前浏览器。昵称公开展示；改名不影响成绩。</small>
      </DialogContent>
    </Dialog>
  );
}
