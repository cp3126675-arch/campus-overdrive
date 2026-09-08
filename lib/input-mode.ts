export type InputMode = 'auto' | 'touch' | 'keyboard';
export interface InputCapabilities {
  coarse: boolean;
  fine: boolean;
  hover: boolean;
  anyCoarse: boolean;
  touchPoints: number;
  userAgent: string;
  platform: string;
  touchObserved: boolean;
}
export function parseInputMode(value: unknown): InputMode {
  return value === 'touch' || value === 'keyboard' ? value : 'auto';
}
// Viewport size deliberately does not participate in input detection.
export function resolveTouchControls(mode: InputMode, c: InputCapabilities) {
  if (mode !== 'auto') return mode === 'touch';
  if (c.touchObserved || (c.coarse && !c.hover)) return true;
  const mobile =
    /Android|iPhone|iPad|iPod/i.test(c.userAgent) ||
    (c.platform === 'MacIntel' && c.touchPoints > 1);
  return (c.touchPoints > 0 || c.anyCoarse) && (!c.fine || mobile);
}
export const INPUT_QUERIES = [
  '(pointer: coarse)',
  '(pointer: fine)',
  '(hover: hover)',
  '(any-pointer: coarse)',
] as const;
export function listenMedia(query: MediaQueryList, changed: () => void) {
  if (query.addEventListener) {
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }
  // Older embedded browsers expose only the legacy listener API.
  // oxlint-disable-next-line typescript/no-deprecated
  query.addListener(changed);
  // oxlint-disable-next-line typescript/no-deprecated
  return () => query.removeListener(changed);
}
