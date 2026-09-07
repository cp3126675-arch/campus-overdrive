export const TOUCH_QUERY = '(pointer: coarse) and (hover: none)';
export const usesTouchControls = (coarse: boolean, hover: boolean) =>
  coarse && !hover;
// Logical coordinates are measured before the optional 90-degree CSS rotation.
export function stagePoint(
  rect: { left: number; top: number; right: number },
  x: number,
  y: number,
  rotated: boolean,
) {
  return rotated
    ? { x: y - rect.top, y: rect.right - x }
    : { x: x - rect.left, y: y - rect.top };
}
export function layoutAttributes(
  width: number,
  height: number,
): Record<string, string> {
  return {
    'data-layout': width >= height ? 'landscape' : 'portrait',
    ...Object.fromEntries(
      [600, 680, 700, 900].map((n) => [
        `data-width-max-${n}`,
        String(width <= n),
      ]),
    ),
    'data-width-min-701': String(width >= 701),
    'data-height-max-550': String(height <= 550),
  };
}
// Browser orientation locking is optional; CSS provides a landscape stage regardless.
export function bossEdgeCue(
  view: { x: number; y: number; width: number; height: number },
  boss: { x: number; y: number },
) {
  if (
    boss.x >= view.x + 35 &&
    boss.x <= view.x + view.width - 35 &&
    boss.y >= view.y + 85 &&
    boss.y <= view.y + view.height - 45
  )
    return null;
  const x = Math.max(view.x + 40, Math.min(view.x + view.width - 40, boss.x));
  const y = Math.max(
    view.y + 110,
    Math.min(view.y + view.height - 170, boss.y),
  );
  return { x, y, angle: Math.atan2(boss.y - y, boss.x - x) };
}
export async function requestLandscape() {
  if (!window.matchMedia(TOUCH_QUERY).matches) return;
  try {
    if (
      !document.fullscreenElement &&
      document.documentElement.requestFullscreen
    )
      await document.documentElement.requestFullscreen();
  } catch {
    /* The landscape stage remains available without browser fullscreen. */
  }
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (value: string) => Promise<void>;
    };
    await orientation?.lock?.('landscape');
  } catch {
    /* CSS rotation already provides the complete landscape game. */
  }
}
