'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEPARTMENTS } from '@/lib/departments';
import {
  emptyRecordBook,
  readRecordBook,
  saveRecord,
  recordStorageKey,
  type RecordBook,
  type RecordStorage,
  type RunRecord,
  type ScoreMode,
} from '@/lib/records';
import type { Snapshot } from '@/lib/game-model';
import release from '@/public/version.json';
const known = new Set(DEPARTMENTS.map((d) => d.id));
const storage: RecordStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
export function useRecords(snapshot: Snapshot) {
  const [books, setBooks] = useState<Record<ScoreMode, RecordBook>>(() => ({
    race: emptyRecordBook(),
    survival: emptyRecordBook(),
  }));
  const current = useRef(books);
  const [latestScore, setLatestScore] = useState<RunRecord | null>(null);
  const active = useRef<{
    id: string;
    departmentId: string;
    mode: ScoreMode;
  } | null>(null);
  const saved = useRef<string | null>(null);
  const [result, setResult] = useState<{
    newBest: boolean;
    bestMs: number;
    persisted: boolean;
  } | null>(null);
  useEffect(() => {
    const load = () => {
      for (const mode of ['race', 'survival'] as const) {
        try {
          current.current = {
            ...current.current,
            [mode]: readRecordBook(
              storage.getItem(recordStorageKey(mode)),
              known,
              mode,
            ),
          };
        } catch {
          /* Keep session scores if storage is disabled. */
        }
      }
      setBooks(current.current);
    };
    const changed = (event: StorageEvent) => {
      if (
        event.key === recordStorageKey('race') ||
        event.key === recordStorageKey('survival')
      )
        load();
    };
    load();
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  const beginRun = useCallback(
    (departmentId: string, mode: ScoreMode = 'race') => {
      active.current = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
        departmentId,
        mode,
      };
      setResult(null);
      setLatestScore(null);
    },
    [],
  );
  useEffect(() => {
    const run = active.current;
    if (!run || saved.current === run.id) return;
    const mode: ScoreMode = snapshot.survival ? 'survival' : 'race';
    if (
      run.mode !== mode ||
      snapshot.mode !== (mode === 'survival' ? 'lost' : 'won')
    )
      return;
    saved.current = run.id;
    const timeMs = Math.max(10, Math.round(snapshot.time * 100) * 10);
    const record: RunRecord = {
      ...run,
      timeMs,
      completedAt: Date.now(),
      version: release.version,
    };
    const next = saveRecord(
      storage,
      current.current[mode],
      record,
      known,
      mode,
    );
    setLatestScore(record);
    current.current = { ...current.current, [mode]: next.book };
    setBooks(current.current);
    setResult({
      newBest:
        next.previousBest === null ||
        (mode === 'survival'
          ? timeMs > next.previousBest
          : timeMs < next.previousBest),
      bestMs: next.book.departments[run.departmentId][0].timeMs,
      persisted: next.persisted,
    });
  }, [snapshot.mode, snapshot.time, snapshot.survival]);
  return { books, result, beginRun, latestScore };
}
