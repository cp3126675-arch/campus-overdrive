'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  INPUT_QUERIES,
  listenMedia,
  parseInputMode,
  resolveTouchControls,
  type InputMode,
} from '@/lib/input-mode';
const STORAGE_KEY = 'campus-input-mode';
export function useGameInput() {
  const [mode, setMode] = useState<InputMode>('auto');
  const [touch, setTouch] = useState(false);
  const preference = useRef<InputMode>('auto');
  const syncRef = useRef<() => void>(() => {});
  useEffect(() => {
    try {
      preference.current = parseInputMode(localStorage.getItem(STORAGE_KEY));
    } catch {
      /* Storage can be disabled in embedded browsers. */
    }
    setMode(preference.current);
    let touchObserved = false;
    const queries = INPUT_QUERIES.map((q) => window.matchMedia(q));
    const sync = () =>
      setTouch(
        resolveTouchControls(preference.current, {
          coarse: queries[0].matches,
          fine: queries[1].matches,
          hover: queries[2].matches,
          anyCoarse: queries[3].matches,
          touchPoints: navigator.maxTouchPoints || 0,
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          touchObserved,
        }),
      );
    const observeTouch = () => {
      touchObserved = true;
      sync();
    };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch') observeTouch();
    };
    syncRef.current = sync;
    const cleanups = queries.map((q) => listenMedia(q, sync));
    window.addEventListener('pointerdown', pointer, {
      capture: true,
      passive: true,
    });
    window.addEventListener('touchstart', observeTouch, {
      capture: true,
      passive: true,
    });
    window.addEventListener('resize', sync);
    sync();
    return () => {
      cleanups.forEach((cleanup) => cleanup());
      window.removeEventListener('pointerdown', pointer, true);
      window.removeEventListener('touchstart', observeTouch, true);
      window.removeEventListener('resize', sync);
      syncRef.current = () => {};
    };
  }, []);
  const changeMode = useCallback((value: InputMode) => {
    preference.current = parseInputMode(value);
    setMode(preference.current);
    try {
      localStorage.setItem(STORAGE_KEY, preference.current);
    } catch {
      /* Keep the session choice even if persistence is unavailable. */
    }
    syncRef.current();
  }, []);
  return { mode, touch, changeMode };
}
