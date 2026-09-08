'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEPARTMENTS } from '@/lib/departments';
import {
  emptyRecordBook,
  readRecordBook,
  saveRecord,
  RECORD_STORAGE_KEY,
  type RecordBook,
  type RecordStorage,
  type RunRecord,
} from '@/lib/records';
import type { Snapshot } from '@/lib/game-model';
import release from '@/public/version.json';
const known = new Set(DEPARTMENTS.map((d) => d.id));
// Lazy access keeps disabled localStorage from throwing before the guarded I/O.
const storage: RecordStorage = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
export function useRecords(snapshot: Snapshot) {
  const [book, setBook] = useState<RecordBook>(emptyRecordBook);
  const current = useRef(book);
  const [latestWin, setLatestWin] = useState<RunRecord | null>(null);
  const active = useRef<{ id: string; departmentId: string } | null>(null);
  const saved = useRef<string | null>(null);
  const [result, setResult] = useState<{
    newBest: boolean;
    bestMs: number;
    persisted: boolean;
  } | null>(null);
  useEffect(() => {
    const load = () => {
      try {
        const next = readRecordBook(storage.getItem(RECORD_STORAGE_KEY), known);
        current.current = next;
        setBook(next);
      } catch {
        /* Session-only records remain available. */
      }
    };
    const changed = (event: StorageEvent) => {
      if (event.key === RECORD_STORAGE_KEY) load();
    };
    load();
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);
  const beginRun = useCallback((departmentId: string) => {
    active.current = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
      departmentId,
    };
    setResult(null);
  }, []);
  useEffect(() => {
    const run = active.current;
    if (snapshot.mode !== 'won' || !run || saved.current === run.id) return;
    saved.current = run.id;
    const timeMs = Math.max(10, Math.round(snapshot.time * 100) * 10);
    const record: RunRecord = {
      ...run,
      timeMs,
      completedAt: Date.now(),
      version: release.version,
    };
    const next = saveRecord(storage, current.current, record, known);
    setLatestWin(record);
    current.current = next.book;
    setBook(next.book);
    setResult({
      newBest: next.previousBest === null || timeMs < next.previousBest,
      bestMs: next.book.departments[run.departmentId][0].timeMs,
      persisted: next.persisted,
    });
  }, [snapshot.mode, snapshot.time]);
  return { book, result, beginRun, latestWin };
}
