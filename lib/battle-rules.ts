// Discrete badge levels give visible, repeatable checkpoints. Final node is always Lv.15.
export const BOSS_LEVELS = [2, 4, 6, 8, 10, 11, 13, 14] as const;
export const mergePercent = (level: number) =>
  Math.round((Math.min(14, Math.max(0, level)) * 100) / 14);
export const needsLandscape = (touch: boolean, width: number, height: number) =>
  touch && width < height;
export function supplyPolicy(time: number, level: number) {
  const pressure = Math.min(1, Math.max(time / 300, level / 14));
  return {
    interval: 17 - pressure * 11.5,
    gooseChance: pressure < 0.15 ? 1 : Math.max(0.16, 1 - pressure * 0.9),
    ducks: pressure >= 0.65 ? 2 : 1,
  };
}
