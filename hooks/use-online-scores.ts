'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  leaderboardEndpoint,
  readIdentity,
  persistIdentity,
  registerPlayer,
  renamePlayer,
  invalidateLeaderboards,
  submitScore,
  type PlayerIdentity,
} from '@/lib/leaderboard-client';
import type { RunRecord } from '@/lib/records';
export function useOnlineScores(score: RunRecord | null) {
  const [identity, setIdentity] = useState<PlayerIdentity | null>(() =>
    typeof window === 'undefined' ? null : readIdentity(),
  );
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [identitySaved, setIdentitySaved] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [configError, setConfigError] = useState('');
  const inFlight = useRef(false);
  const attempted = useRef<string | null>(null);
  const uploaded = useRef<string | null>(null);
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void leaderboardEndpoint()
      .then(() => {
        if (active) setConfigured(true);
      })
      .catch((e) => {
        if (active) setConfigError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== 'campus-player-v1' && event.key !== null) return;
      invalidateLeaderboards();
      setIdentity(readIdentity());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const upload = useCallback(async () => {
    if (
      !identity ||
      !score ||
      !configured ||
      inFlight.current ||
      uploaded.current === score.id
    )
      return;
    inFlight.current = true;
    attempted.current = score.id;
    setBusy(true);
    setMessage('正在提交全服成绩…');
    try {
      await submitScore(identity, score);
      uploaded.current = score.id;
      setUploadedId(score.id);
      setMessage('全服成绩已保存');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '成绩提交失败，可重试',
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [identity, score, configured]);
  useEffect(() => {
    if (
      !busy &&
      score &&
      identity &&
      configured &&
      attempted.current !== score.id
    )
      void upload();
  }, [score, identity, configured, upload, busy]);
  const join = async (nickname: string) => {
    if (!nickname.trim() || inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    try {
      setMessage('正在保存昵称…');
      const next = identity
        ? await renamePlayer(identity, nickname.trim())
        : await registerPlayer(nickname.trim());
      setConfigured(true);
      setConfigError('');
      setIdentitySaved(persistIdentity(next));
      setIdentity(next);
      setMessage(identity ? '昵称已修改，排行榜已同步' : '昵称已设置');
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '昵称设置失败');
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return {
    identity,
    message,
    busy,
    join,
    upload,
    configured,
    configError,
    identitySaved,
    pending: !!score && uploadedId !== score.id,
  };
}
