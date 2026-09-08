// Independent survival rules: race mode keeps its existing checkpoints and damage.
export const SURVIVAL_WORLD = { width: 2400, height: 2752 };
export const SURVIVAL = {
  firstBossAt: 35,
  bossRest: 24,
  maxHp: 100,
  breakShield: 1.2,
  mergeHeal: 20,
  firstShrink: 15,
  roundSeconds: 30,
  shrinkSeconds: 25,
  stormDamageCap: 8,
  attackRateCap: 1.65,
  densityCap: 1.35,
  maxEnemies: 48,
  maxProjectiles: 360,
  maxHostileProjectiles: 90,
  maxHazards: 18,
};
const RADII = [
  Math.hypot(SURVIVAL_WORLD.width / 2, SURVIVAL_WORLD.height / 2),
  1000,
  450,
  0,
];
const STORM_DAMAGE = [0, 1, 2, 3, 4, 5, 6, 7, 8];
export type SurvivalZone = {
  x: number;
  y: number;
  radius: number;
  targetRadius: number;
  round: number;
  nextRoundIn: number;
  damagePerSecond: number;
};
export function survivalZone(seconds: number): SurvivalZone {
  const time = Math.max(0, seconds);
  const elapsed = Math.max(0, time - SURVIVAL.firstShrink);
  const stage =
    time < SURVIVAL.firstShrink
      ? 0
      : 1 + Math.floor(elapsed / SURVIVAL.shrinkSeconds);
  const phase = (elapsed % SURVIVAL.shrinkSeconds) / SURVIVAL.shrinkSeconds;
  const from = RADII[Math.min(Math.max(0, stage - 1), RADII.length - 1)];
  const to = RADII[Math.min(stage, RADII.length - 1)];
  const pressure = Math.floor(time / SURVIVAL.roundSeconds);
  return {
    x: SURVIVAL_WORLD.width / 2,
    y: SURVIVAL_WORLD.height / 2,
    radius: stage === 0 ? RADII[0] : from + (to - from) * phase,
    targetRadius: to,
    round: pressure + 1,
    nextRoundIn: SURVIVAL.roundSeconds - (time % SURVIVAL.roundSeconds),
    damagePerSecond: STORM_DAMAGE[Math.min(pressure, STORM_DAMAGE.length - 1)],
  };
}
export function outsideSurvivalZone(
  point: { x: number; y: number },
  zone: SurvivalZone,
) {
  return (
    zone.radius <= 0 ||
    Math.hypot(point.x - zone.x, point.y - zone.y) > zone.radius
  );
}
export function survivalScaling(seconds: number) {
  const round = ((survivalZone(seconds).round - 1) * 2) / 3;
  return {
    hp: 1 + round * 0.22 + Math.max(0, round - 3) ** 2 * 0.35,
    damage: 0.65 * (1 + round * 0.25 + Math.max(0, round - 3) ** 2 * 0.85),
    speed: Math.min(1.4, 1 + round * 0.025),
    attackRate: Math.min(SURVIVAL.attackRateCap, 1 + round * 0.09),
    density: Math.min(SURVIVAL.densityCap, 1 + round * 0.12),
  };
}
export type SurvivalSnapshot = {
  dashVolleysRemaining: number;
  maxHp: number;
  nextBossIn: number;
  cycle: number;
  damageScale: number;
  downgradeCount: number;
  shieldTime: number;
  zone: SurvivalZone;
  outsideZone: boolean;
  hurtTime: number;
  invincibleTime: number;
  stormPulse: number;
};
