import { writeFileSync } from 'node:fs';
import { SurvivalGameModel } from '../lib/survival-model';
import { DEPARTMENTS, department } from '../lib/departments';
import { outsideSurvivalZone } from '../lib/survival-rules';
import { distance, clamp } from '../lib/game-model';
const all = process.argv.includes('--all');
const selected = all
  ? DEPARTMENTS
  : [
      department('d041'),
      department('d027'),
      DEPARTMENTS.find((d) => d.profile === 'arch')!,
      DEPARTMENTS.find((d) => d.kind === 'heal')!,
      DEPARTMENTS.find(
        (d) => d.kind === 'beam' && !['d041', 'd027'].includes(d.id),
      )!,
    ];
const results = [];
for (const d of selected)
  for (const seed of [11, 27, 83]) {
    let s = seed;
    const rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const g = new SurvivalGameModel(rng);
    g.start(d.profile, d.badge, d.id);
    let maxEnemies = 0,
      maxShots = 0;
    for (let frame = 0; frame < 16000 && g.mode === 'playing'; frame++) {
      for (let i = 0; i < 5 && g.canMerge; i++) g.merge();
      const zone = g.zone;
      const targets = g.drops
        .filter((drop) => zone.radius <= 0 || !outsideSurvivalZone(drop, zone))
        .filter(
          (drop) =>
            drop.kind === 'badge' || (drop.kind === 'goose' && g.hp < 85),
        )
        .sort((a, b) => distance(a, g.player) - distance(b, g.player));
      let x = g.world.width / 2 + Math.cos(g.time * 0.2) * 320 - g.player.x,
        y = g.world.height / 2 + Math.sin(g.time * 0.2) * 305 - g.player.y;
      if (targets[0]) {
        x = targets[0].x - g.player.x;
        y = targets[0].y - g.player.y;
      }
      if (
        zone.radius > 0 &&
        outsideSurvivalZone(g.player, {
          ...zone,
          radius: Math.max(0, zone.radius - 25),
        })
      ) {
        x = zone.x - g.player.x;
        y = zone.y - g.player.y;
      }
      const len = Math.hypot(x, y) || 1;
      x /= len;
      y /= len;
      let danger = false;
      for (const enemy of g.enemies) {
        const dist = distance(enemy, g.player) || 1;
        if (dist < 150) {
          const strength = ((150 - dist) / 150) * 3;
          x += ((g.player.x - enemy.x) / dist) * strength;
          y += ((g.player.y - enemy.y) / dist) * strength;
          if (dist < 95) danger = true;
        }
      }
      for (const shot of g.shots) {
        if (!shot.enemy) continue;
        const p = { x: shot.x + shot.vx * 0.2, y: shot.y + shot.vy * 0.2 };
        const dist = distance(p, g.player) || 1;
        if (dist < 75) {
          x += ((g.player.x - p.x) / dist) * 2;
          y += ((g.player.y - p.y) / dist) * 2;
          if (dist < 45) danger = true;
        }
      }
      if (g.skillCharge >= 100 && (g.enemies.length > 5 || g.bossSpawned))
        g.skill();
      g.player.dx = clamp(x, -1, 1);
      g.player.dy = clamp(y, -1, 1);
      if (danger && !g.dashCooldown) g.dash();
      g.update(0.05, x, y);
      g.events.length = 0;
      maxEnemies = Math.max(maxEnemies, g.enemies.length);
      maxShots = Math.max(maxShots, g.shots.length);
    }
    results.push({
      department: d.name,
      kind: d.kind,
      seed,
      seconds: Math.round(g.time * 10) / 10,
      bosses: g.bossesDefeated,
      highest: g.highest,
      downgrades: g.downgradeCount,
      mode: g.mode,
      maxEnemies,
      maxShots,
    });
  }
const times = results.map((r) => r.seconds).sort((a, b) => a - b);
const report = {
  method:
    'Deterministic heuristic bot: seek in-zone drops, move toward safety, avoid nearby threats, merge and use skills. Does not predict AoE; not a human balance or FPS test.',
  runs: results.length,
  min: times[0],
  median: times[Math.floor(times.length / 2)],
  max: times.at(-1),
  inTargetWindow: results.filter((r) => r.seconds >= 300 && r.seconds <= 360)
    .length,
  allEnded: results.every((r) => r.mode === 'lost'),
  results,
};
writeFileSync(
  all
    ? 'outputs/validation/survival-balance-all.json'
    : 'outputs/validation/survival-balance.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
