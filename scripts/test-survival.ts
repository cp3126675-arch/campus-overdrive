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
// At maximum attack rate, using dash requires three actual Boss volleys, not merely a timer.
{
  for (const healthRatio of [1, 0.4]) {
    const g = fresh();
    quiet(g);
    g.time = 400;
    g.beginBoss();
    const boss = g.enemies.find((e) => e.kind === 'boss')!;
    boss.hp = boss.maxHp * healthRatio;
    g.invulnerable = 999;
    const uses: number[] = [];
    for (let i = 0; i < 4000; i++) {
      if (g.dash()) uses.push(g.bossVolleyCount);
      g.update(0.01, 0, 0);
    }
    assert(uses.length >= 4, 'dash still has regular opportunities');
    for (let i = 1; i < uses.length; i++)
      assert.equal(
        uses[i] - uses[i - 1],
        3,
        'exactly three volleys between dash uses',
      );
    const remaining = g.dashVolleysRemaining;
    g.togglePause();
    advance(g, 3);
    assert.equal(
      g.dashVolleysRemaining,
      remaining,
      'pausing cannot recharge an attack round',
    );
  }
}
// Feedback applies to both modes and does not invent damage while invincible.
{
  const g = new GameModel(() => 0.4);
  g.start('math', 'shuxue');
  quiet(g);
  g.invulnerable = 0;
  g.damage(20);
  assert.equal(g.hp, 80);
  assert.equal(g.lastHit, 20);
  assert.equal(g.snapshot().hurtTime, 0.9);
  const until = g.hurtUntil;
  g.damage(30);
  assert.equal(g.hurtUntil, until);
  assert.equal(g.lastHit, 20);
  g.start('math', 'shuxue');
  assert.equal(g.hurtUntil, 0, 'new runs reset hit feedback');
  g.eatFood('duck');
  assert.equal(g.lastHit, 12);
  assert(g.snapshot().hurtTime > 0);
}
// Score rewards work, never waiting or repeated recovery merges.
{
  const g = fresh();
  quiet(g);
  g.nextBossAt = 99999;
  advance(g, 10);
  assert.equal(g.score, 0);
  const clearPractice = () => {
    for (let i = 0; i < 20; i++) {
      const e = g.makeEnemy('paper', g.player.x, g.player.y);
      e.year = 4;
      e.hp = 0;
      g.enemies.push(e);
    }
    g.checkKills();
  };
  clearPractice();
  clearPractice();
  assert.equal(g.practiceScore, 300, 'practice is capped until a pass');
  g.onMerge(3, 100, 100);
  assert.equal(g.badgeScore, 240);
  g.onMerge(1, 100, 100);
  g.onMerge(3, 100, 100);
  assert.equal(g.badgeScore, 240, 'recovery merges cannot farm points');
  quiet(g);
  g.time = 35;
  g.nextBossAt = 35;
  g.invulnerable = 999;
  assert(g.beginBoss());
  const firstExam = g.enemies.find((e) => e.kind === 'boss')!.boss;
  g.bossAttack = 9999;
  const before = g.score;
  advance(g, 44);
  assert(g.bossSpawned);
  g.togglePause();
  advance(g, 10);
  g.togglePause();
  assert(g.bossSpawned, 'pause freezes submission deadline');
  advance(g, 1.1);
  assert(!g.bossSpawned);
  assert.equal(g.score, before);
  assert.equal(g.bossesDefeated, 0);
  assert.equal(g.examsTaken, 1);
  assert.equal(g.snapshot().survival!.practiceRemaining, 0);
  g.time = g.nextBossAt;
  assert(g.beginBoss());
  assert.notEqual(g.enemies.find((e) => e.kind === 'boss')!.boss, firstExam);
  g.time += 20;
  g.enemies.find((e) => e.kind === 'boss')!.hp = 0;
  g.checkKills();
  assert.equal(g.examScore, 1250);
  assert.equal(g.bossesDefeated, 1);
  assert.equal(g.snapshot().survival!.practiceRemaining, 300);
  assert.equal(g.score, g.examScore + g.practiceScore + g.badgeScore);
  clearPractice();
  assert.equal(g.practiceScore, 600);
  g.start('math', 'shuxue');
  assert.equal(g.score, 0);
  assert.equal(g.examsTaken, 0);
}
// v0.6.8: full energy absorbs a normal exam hit; one energy still breaks a tier.
{
  for (const seconds of [240, 300, 360])
    for (const amount of [18, 25, 30, 32]) {
      const g = fresh();
      quiet(g);
      g.time = seconds;
      g.inventory = [4];
      g.invulnerable = 0;
      g.hp = 100;
      g.damage(amount, 'boss');
      assert.equal(g.centralLevel, 4);
      assert(g.hp > 0 && g.hp < 100);
      assert.equal(
        g.lastHit,
        100 - g.hp,
        'feedback shows applied exam pressure',
      );
      const before = g.hp;
      g.damage(amount, 'boss');
      assert.equal(
        g.hp,
        before,
        'post-hit immunity still protects against overlapping questions',
      );
      const low = fresh();
      quiet(low);
      low.time = seconds;
      low.inventory = [4];
      low.hp = 1;
      low.invulnerable = 0;
      low.damage(amount, 'boss');
      assert.equal(low.centralLevel, 3);
      assert(Math.abs(low.breakShieldTime - 1.2) < 1e-9);
    }
  const race = new GameModel(() => 0.4);
  race.start('math', 'shuxue');
  race.time = 360;
  race.invulnerable = 0;
  race.damage(25, 'boss');
  assert.equal(race.hp, 75, 'race damage is unchanged');
  const g = fresh();
  quiet(g);
  g.time = 300;
  g.invulnerable = 0;
  g.damage(32, 'course');
  assert.equal(g.lastHit, 294, 'course damage retains its existing curve');
  assert(survivalScaling(4000).bossDamage > survivalScaling(2000).bossDamage);
  assert(survivalScaling(4000).courseHp > survivalScaling(2000).courseHp);
}
// All three actual exam collision paths carry their source, including projectiles after examiner departure.
for (const kind of ['contact', 'projectile', 'area'] as const) {
  const g = fresh();
  quiet(g);
  g.nextBossAt = 99999;
  const received: string[] = [];
  g.damage = (_amount, source) => {
    received.push(source ?? 'course');
  };
  if (kind === 'contact')
    g.enemies.push(g.makeEnemy('boss', g.player.x, g.player.y));
  if (kind === 'projectile') {
    const b = g.makeEnemy('boss', g.player.x, g.player.y - 260);
    b.boss = 'coder';
    g.bossVolley(b);
    const shot = g.shots[0];
    g.shots = [shot];
    shot.x = g.player.x;
    shot.y = g.player.y;
    shot.vx = shot.vy = 0;
  }
  if (kind === 'area')
    g.addHazard('circle', g.player.x, g.player.y, '测试大考', '#fff', {
      warn: 0,
    });
  g.bossAttack = 99999;
  g.update(0.01, 0, 0);
  assert.deepEqual(received, ['boss'], kind + ' uses the exam damage curve');
}
// Late coursework pressure has a bounded batch, with existing budgets and no early-game changes.
{
  const g = fresh();
  g.bossSpawned = true;
  for (const [time, count] of [
    [0, 1],
    [150, 1],
    [179, 1],
    [180, 2],
    [210, 3],
    [2000, 3],
  ]) {
    g.time = time;
    assert.equal(g.courseBatchSize, count);
  }
  g.bossSpawned = false;
  assert(g.courseBatchSize <= 4);
  assert.equal(survivalScaling(120).courseHp, 1);
  const sample = g.makeEnemy('paper', g.player.x, g.player.y);
  sample.year = 4;
  g.time = 0;
  assert.equal(g.courseProjectileSpeed, 145);
  assert.equal(g.courseAttackInterval(sample), 5.8);
  g.time = 300;
  assert.equal(g.courseProjectileSpeed, 260);
  assert(Math.abs(g.courseAttackInterval(sample) - 5.8 / 1.5) < 1e-9);
  g.time = 4000;
  assert.equal(g.courseProjectileSpeed, 260);
  assert(g.courseAttackInterval(sample) >= 5.8 / 1.5);
  g.time = 300;
  g.enemies = [];
  for (let i = 0; i < 100; i++) g.spawnEnemy();
  assert.equal(g.enemies.length, SURVIVAL.maxEnemies);
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
