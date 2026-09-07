'use client';
import { useCallback, useEffect, useRef, type PointerEvent } from 'react';
import { stagePoint } from '@/lib/mobile-display';
import { JoystickInput } from '@/lib/joystick';
export function GameJoystick({
  enabled,
  onMove,
}: {
  enabled: boolean;
  onMove: (x: number, y: number) => void;
}) {
  const input = useRef(new JoystickInput());
  const pad = useRef<HTMLButtonElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const origin = useRef<HTMLSpanElement>(null);
  const reset = useCallback(() => {
    const id = input.current.pointer;
    input.current.reset();
    if (id !== null && pad.current?.hasPointerCapture(id))
      pad.current.releasePointerCapture(id);
    if (thumb.current) thumb.current.style.transform = 'translate(0, 0)';
    if (origin.current) {
      origin.current.style.left = '';
      origin.current.style.top = '';
    }
    pad.current?.classList.remove('is-dragging');
    onMove(0, 0);
  }, [onMove]);
  useEffect(() => {
    if (!enabled) reset();
    window.addEventListener('resize', reset);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('resize', reset);
      window.removeEventListener('blur', reset);
      reset();
    };
  }, [enabled, reset]);
  const point = (e: PointerEvent<HTMLButtonElement>) =>
    stagePoint(
      e.currentTarget.getBoundingClientRect(),
      e.clientX,
      e.clientY,
      e.currentTarget.closest<HTMLElement>('.challenge')?.dataset.rotated ===
        'true',
    );
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const p = point(e);
    const next = input.current.move(e.pointerId, p.x, p.y);
    if (!next) return;
    e.preventDefault();
    if (thumb.current)
      thumb.current.style.transform = `translate(${next.x * 72}%, ${next.y * 72}%)`;
    onMove(next.x, next.y);
  };
  const end = (e: PointerEvent<HTMLButtonElement>) => {
    if (input.current.end(e.pointerId)) reset();
  };
  return (
    <button
      ref={pad}
      type="button"
      className="movement-stick"
      disabled={!enabled}
      aria-label="左侧区域任意位置按住拖动移动，松手停止"
      onPointerDown={(e) => {
        if (!enabled || e.button !== 0) return;
        const p = point(e);
        if (!input.current.begin(e.pointerId, p.x, p.y, 42)) return;
        e.preventDefault();
        if (origin.current) {
          origin.current.style.left = `${p.x}px`;
          origin.current.style.top = `${p.y}px`;
        }
        e.currentTarget.classList.add('is-dragging');
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <span className="stick-origin" ref={origin} aria-hidden="true">
        <span className="stick-cross" />
        <span className="stick-thumb" ref={thumb} />
      </span>
      <span className="stick-label">拖动移动</span>
    </button>
  );
}
