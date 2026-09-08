import assert from 'node:assert/strict';
import { SurvivalGameModel } from '../lib/survival-model';
import { GameModel, MAX_GROUND_BADGES } from '../lib/game-model';
import {
  SURVIVAL,
  survivalZone,
  SURVIVAL_WORLD,
  outsideSurvivalZone,
  survivalScaling,
} from '../lib/survival-rules';
import { drawBadgeBreakShield, drawSurvivalZone } from '../lib/survival-render';
function fresh() {
  const g = new SurvivalGameModel(() => 0.4);
  g.start('math', 'shuxue');
  return g;
}
function quiet(g: GameModel) {
  g.enemies = [];
  g.shots = [];
  g.drops = [];
  g.spawnClock = g.bonusSpawn = g.foodClock = g.attackCooldown = 9999;
}
function advance(g: GameModel, seconds: number) {
  for (let n = 0; n < Math.round(seconds * 100); n++) g.update(0.01, 0, 0);
}
// Shrinking circle has no jumps, never expands and eventually excludes even its centre.
{
  let last = Infinity;
  for (let t = 0; t <= 2000; t += 0.5) {
    const zone = survivalZone(t);
    assert(zone.radius <= last);
    assert(zone.damagePerSecond <= SURVIVAL.stormDamageCap);
    last = zone.radius;
  }
  assert(
    survivalZone(0).radius >=
      Math.hypot(SURVIVAL_WORLD.width / 2, SURVIVAL_WORLD.height / 2),
  );
  assert.equal(survivalZone(15).radius, survivalZone(0).radius);
  assert.equal(survivalZone(40).radius, 1000);
  assert.equal(survivalZone(90).radius, 0);
  assert.equal(survivalZone(240).damagePerSecond, SURVIVAL.stormDamageCap);
  assert.equal(survivalZone(270).radius, 0);
  assert(outsideSurvivalZone({ x: 600, y: 400 }, survivalZone(270)));
  assert(!outsideSurvivalZone({ x: 1200, y: 1376 }, survivalZone(60)));
  const early = survivalScaling(0),
    late = survivalScaling(2000),
    later = survivalScaling(4000);
  assert(
    later.hp > late.hp &&
      later.damage > late.damage &&
      late.damage > early.damage,
  );
  assert.equal(late.attackRate, SURVIVAL.attackRateCap);
  assert.equal(late.density, SURVIVAL.densityCap);
}
// Each badge is one life. Overkill loses exactly one tier and all wingmen.
{
  const g = fresh();
  quiet(g);
  g.inventory = [6, 6, 4, 2];
  g.highest = 6;
  g.hp = 60;
  g.invulnerable = 0;
  g.damage(1);
  assert.equal(g.centralLevel, 6, '60 / 30 are no longer downgrade thresholds');
  g.hp = 30;
  g.invulnerable = 0;
  g.damage(1);
  assert.equal(g.centralLevel, 6);
  g.invulnerable = 0;
  g.damage(100000);
  assert.equal(g.mode, 'playing');
  assert.equal(g.hp, 100);
  assert.deepEqual(g.inventory, [5]);
  assert.equal(g.wingmen.length, 0);
  assert.equal(g.downgradeCount, 1);
  assert.equal(g.breakShieldTime, 1.2);
  g.damage(100000);
  g.eatFood('duck');
  assert.equal(g.hp, 100);
  assert.equal(g.downgradeCount, 1);
  g.hitstop = 9999;
  advance(g, 1.19);
  g.damage(100000);
  assert.equal(g.downgradeCount, 1);
  advance(g, 0.02);
  assert.equal(g.breakShieldTime, 0);
  g.damage(100000);
  assert.deepEqual(g.inventory, [4]);
  assert.equal(g.downgradeCount, 2);
  g.time += 2;
  g.inventory = [0, 0, 0];
  g.hp = 1;
  g.invulnerable = 0;
  g.damage(1000);
  assert.equal(g.mode, 'lost');
  assert.equal(g.hp, 0);
}
// Duck, ordinary damage and storm all use the same one-tier break; merge restores 20.
{
  const g = fresh();
  quiet(g);
  g.inventory = [4, 3];
  g.highest = 4;
  g.hp = 11;
  g.eatFood('duck');
  assert.deepEqual(g.inventory, [3]);
  assert.equal(g.hp, 100);
  g.inventory.push(3);
  g.hp = 50;
  g.merge();
  assert.equal(g.hp, 70);
  assert.equal(g.centralLevel, 4);
  g.inventory = [13, 13];
  g.hp = 50;
  g.merge();
  assert.equal(
    g.hp,
    70,
    'max badge merge has the same heal, not an extra graduation heal',
  );
  assert.equal(g.mode, 'playing');
  g.hp = 99;
  g.eatFood('goose');
  assert.equal(g.hp, 100);
  g.spawnDrop(600, 470);
  assert(g.drops.some((d) => d.kind === 'badge'));
  for (let i = 0; i < 20; i++) g.spawnDrop(600, 470, 12);
  assert(g.drops.filter((d) => d.kind === 'badge').length <= MAX_GROUND_BADGES);
}
// Only the break shield blocks storm. Capacity stays 100, with no forced time limit.
{
  const g = fresh();
  quiet(g);
  g.time = 300;
  g.hp = 100;
  g.invulnerable = 9999;
  g.hitstop = 9999;
  advance(g, 1);
  assert(Math.abs(g.hp - 92) < 0.001);
  g.inventory = [2, 1];
  g.hp = 0.1;
  advance(g, 0.01);
  assert.equal(g.hp, 1, 'storm is non-lethal');
  g.invulnerable = 0;
  g.damage(100);
  assert.deepEqual(g.inventory, [1]);
  assert.equal(g.hp, 100);
  advance(g, 1.19);
  assert.equal(g.hp, 100);
  advance(g, 0.03);
  assert(g.hp < 100);
  assert.equal(g.breakShieldTime, 0);
  g.mode = 'paused';
  const time = g.time,
    hp = g.hp;
  advance(g, 2);
  assert.equal(g.time, time);
  assert.equal(g.hp, hp);
  g.mode = 'playing';
  g.orientationBlocked = true;
  advance(g, 2);
  assert.equal(g.time, time);
  g.orientationBlocked = false;
  g.time = 760;
  g.hp = 100;
  g.update(0.01, 0, 0);
  assert.equal(g.mode, 'playing');
  assert.equal(g.maxHp, 100);
  g.time = 1000;
  g.update(0.01, 0, 0);
  assert.equal(g.mode, 'playing');
  g.hp = 50;
  g.eatFood('goose');
  assert.equal(g.hp, 50, 'final storm blocks food healing');
  assert.equal(g.feastTime, 5);
  g.heal(12);
  assert.equal(g.hp, 50);
  g.inventory = [2, 2];
  g.merge();
  assert.equal(g.hp, 70, 'only merges heal after the circle disappears');
  g.start('math', 'shuxue');
  assert.equal(g.breakShieldTime, 0);
  assert.equal(g.downgradeCount, 0);
  assert.equal(g.zone.round, 1);
}
// Safety is positional, and immunity is frozen while paused.
{
  const g = fresh();
  quiet(g);
  g.time = 70;
  g.hitstop = 9999;
  g.player.x = g.world.width / 2;
  g.player.y = g.world.height / 2;
  advance(g, 1);
  assert.equal(g.hp, 100);
  g.player.x = g.world.width - 100;
  advance(g, 1);
  assert(Math.abs(g.hp - 98) < 0.001);
  g.inventory = [2];
  g.hp = 1;
  g.invulnerable = 0;
  g.damage(1000);
  const shield = g.breakShieldTime;
  g.mode = 'paused';
  advance(g, 2);
  assert.equal(g.breakShieldTime, shield);
}
// Boss order loops; waiting cannot avoid round-based strength increases.
{
  const g = fresh();
  quiet(g);
  assert(!g.beginBoss());
  g.time = 35;
  assert(g.beginBoss());
  assert(!g.beginBoss());
  const order = [...g.bossOrder];
  for (let i = 0; i < order.length * 2 + 2; i++) {
    const boss = g.enemies.find((e) => e.kind === 'boss')!;
    assert.equal(boss.boss, order[i % order.length]);
    g.enemies = [];
    g.completeBoss(500, 400);
    assert.equal(g.mode, 'playing');
    assert(!g.beginBoss());
    g.time += 24;
    assert(g.beginBoss());
    assert.equal(g.enemies.filter((e) => e.kind === 'boss').length, 1);
  }
  g.finish(true);
  assert.equal(g.mode, 'playing');
  g.time = 89.99;
  g.hitstop = 9999;
  const boss = g.enemies.find((e) => e.kind === 'boss')!,
    oldMax = boss.maxHp;
  boss.hp = oldMax * 0.5;
  g.update(0.02, 0, 0);
  assert(boss.maxHp > oldMax);
  assert(Math.abs(boss.hp / boss.maxHp - 0.5) < 0.001);
}
// Density grows to a cap, retaining motif and a finite projectile/hazard budget.
{
  const g = fresh();
  quiet(g);
  g.time = 35;
  g.beginBoss();
  const boss = g.enemies.find((e) => e.kind === 'boss')!;
  boss.boss = 'coder';
  g.shots = [];
  g.bossVolley(boss);
  const first = g.shots.length;
  g.time = 400;
  g.shots = [];
  g.bossVolley(boss);
  const dense = g.shots.length;
  assert(dense > first);
  assert(g.shots.every((shot) => shot.bossSkin === 'coder'));
  g.time = 4000;
  g.shots = [];
  g.bossVolley(boss);
  assert.equal(g.shots.length, dense);
  for (let i = 0; i < 50; i++) {
    g.bossVolley(boss);
    g.castBoss(boss);
  }
  assert(
    g.shots.filter((s) => s.enemy).length <= SURVIVAL.maxHostileProjectiles,
  );
  assert(g.shots.length <= SURVIVAL.maxProjectiles);
  assert(g.hazards.length <= SURVIVAL.maxHazards);
  for (let i = 0; i < 70; i++) g.spawnEnemy();
  assert.equal(g.enemies.length, 48);
}
// World movement/camera/attacks extend past the original 1200×800 arena.
{
  const g = fresh();
  quiet(g);
  g.player.x = 1900;
  g.player.y = 2200;
  g.update(0.05, 1, 1);
  assert(g.player.x > 1900 && g.player.y > 2200);
  assert(g.view.x > 0 && g.view.y > 1000);
  g.spawnDrop(1900, 2200, 2);
  g.update(0.05, 0, 0);
  assert(g.drops[0].x > 1800 && g.drops[0].y > 2100);
  g.shots.push({
    x: 1900,
    y: 2200,
    vx: 5,
    vy: 0,
    damage: 1,
    enemy: false,
    hits: [],
    pierce: 1,
    life: 5,
  });
  g.update(0.05, 0, 0);
  assert(g.shots.length > 0);
  g.time = 35;
  assert(g.beginBoss());
  const boss = g.enemies.find((e) => e.kind === 'boss')!;
  assert(boss.x > 1200 && boss.y > 800);
  g.time = 300;
  g.hp = 1;
  g.hitstop = 9999;
  advance(g, 10);
  assert.equal(g.hp, 1);
  assert.equal(g.mode, 'playing');
  g.invulnerable = 0;
  g.inventory = [0];
  g.damage(100000);
  assert.equal(g.mode, 'lost', 'enemy damage can finish the last badge');
}
// Drawing contracts without browser/visual QA: shield absent at expiry, circle absent at zero.
{
  const calls: { name: string; args: unknown[] }[] = [];
  const context = new Proxy(
    {},
    {
      get:
        (_, name: string) =>
        (...args: unknown[]) =>
          calls.push({ name, args }),
      set: () => true,
    },
  ) as CanvasRenderingContext2D;
  drawBadgeBreakShield(context, 600, 400, 30, 0, false);
  assert.equal(calls.length, 0);
  drawBadgeBreakShield(context, 600, 400, 30, 1.2, false);
  assert(calls.some((c) => c.name === 'quadraticCurveTo'));
  assert.equal(
    calls.filter((c) => c.name === 'save').length,
    calls.filter((c) => c.name === 'restore').length,
  );
  calls.length = 0;
  drawSurvivalZone(
    context,
    survivalZone(270),
    { x: 0, y: 0, width: 1200, height: 800 },
    { x: 600, y: 400 },
  );
  assert(!calls.some((c) => c.name === 'arc'));
  assert(calls.some((c) => c.name === 'fill' && c.args[0] === 'evenodd'));
}
console.log(
  'Survival regressions passed: shrinking zones, badge lives, exact break shield, healing, infinite strength/capped density, looping bosses, budgets, drawing contracts.',
);
