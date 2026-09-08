import assert from 'node:assert/strict';
import { GameMusic, musicScene, type MusicMedia } from '../lib/music';
import {
  BOSS_LEVELS,
  mergePercent,
  supplyPolicy,
  needsLandscape,
} from '../lib/battle-rules';
import { BOSSES, hazardHits } from '../lib/bosses';
import { BADGE_WEAPONS } from '../lib/badge-weapons';
import colleges from '../lib/colleges.json';
import { DEPARTMENTS, skillZones, skillHits } from '../lib/departments';
import units from '../docs/research/tsinghua-units-2026-09-07.json';
import { TEXTBOOKS } from '../lib/textbooks';
import { JoystickInput } from '../lib/joystick';
import {
  GameModel,
  buildChain,
  findPair,
  cameraView,
  MAX_GROUND_BADGES,
  BADGE_LIFETIME,
  supplyStation,
} from '../lib/game-model';
function seeded(seed = 321) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function fresh() {
  const g = new GameModel(seeded());
  g.start('math', 'shuxue');
  return g;
}
function quiet(g: GameModel) {
  g.enemies = [];
  g.drops = [];
  g.spawnClock = 100;
  g.bonusSpawn = 100;
  g.foodClock = 100;
  g.attackCooldown = 100;
}
const chain = buildChain('guixi', seeded());
assert.equal(chain.length, 15);
assert.equal(chain[0].key, 'guixi');
assert.equal(chain[14].key, 'qinghua');
assert.equal(new Set(chain.map((c) => c.key)).size, 15);
assert.deepEqual(findPair([0, 0, 4, 4]), [2, 3]);
assert.equal(findPair([14, 14]), null);
const g = fresh();
assert.equal(g.centralLevel, 0);
assert(g.merge());
assert.equal(g.centralLevel, 1);
assert(!g.merge());
g.inventory = [0, 0, 4, 4];
g.merge();
assert.equal(g.centralLevel, 5);
assert(g.inventory.includes(5));

// Reaching Qinghua is not victory: time runs until the final eligible Boss dies.
const win = fresh();
quiet(win);
win.time = 123.456;
win.questIndex = 3;
win.inventory = [13, 13];
win.highest = 13;
win.bossesDefeated = BOSS_LEVELS.length - 1;
win.round = BOSS_LEVELS.length;
assert(win.merge());
assert.equal(win.mode, 'playing');
assert.equal(win.centralLevel, 14);
assert.equal(win.forgedAt, 123.456);
win.finish(true);
assert.equal(win.mode, 'playing');
win.update(0.05, 0, 0);
win.update(0.05, 0, 0);
win.update(0.05, 0, 0);
const final = win.enemies.find((e) => e.kind === 'boss')!;
assert(final);
assert.equal(final.boss, 'final');
assert(win.time > 123.456);
final.hp = 0;
win.checkKills();
assert.equal(win.mode, 'won');
const stopTime = win.time,
  stopped = win.snapshot();
win.update(0.05, 1, 1);
assert(win.snapshot().endProgress > 0);
assert.deepEqual({ ...win.snapshot(), endProgress: 0 }, stopped);
for (let i = 0; i < 60; i++) win.update(0.05, 1, 1);
assert.equal(win.snapshot().endProgress, 1);
assert.equal(win.time, stopTime);
assert(!win.merge());
assert(!win.dash());
assert(!win.skill());
const pickupWin = fresh();
quiet(pickupWin);
pickupWin.inventory = [13, 0, 1, 2, 3];
pickupWin.highest = 13;
pickupWin.spawnDrop(pickupWin.player.x, pickupWin.player.y, 13);
pickupWin.drops[0].age = 1;
pickupWin.update(0.01, 0, 0);
assert.equal(pickupWin.mode, 'playing');
assert.equal(pickupWin.centralLevel, 14);
assert.equal(pickupWin.drops.filter((d) => d.kind === 'badge').length, 0);

// Time cannot spawn a Boss. Progress thresholds queue exactly one encounter each.
const clockOnly = fresh();
quiet(clockOnly);
clockOnly.time = 3600;
clockOnly.waveTime = 999;
clockOnly.questIndex = Math.floor(3600 / 35);
clockOnly.update(0.01, 0, 0);
assert(!clockOnly.bossSpawned);
assert(!clockOnly.beginBoss());
const cycle = fresh();
quiet(cycle);
for (let node = 0; node < BOSS_LEVELS.length; node++) {
  cycle.highest = BOSS_LEVELS[node] - 1;
  cycle.bossRest = 0;
  cycle.update(0.01, 0, 0);
  assert(!cycle.bossSpawned);
  cycle.highest = BOSS_LEVELS[node];
  cycle.inventory = [cycle.highest];
  cycle.update(0.02, 0, 0);
  const boss = cycle.enemies.find((e) => e.kind === 'boss')!;
  assert(boss);
  assert(!cycle.beginBoss());
  assert.equal(cycle.enemies.filter((e) => e.kind === 'boss').length, 1);
  assert.equal(cycle.snapshot().mergeProgress, mergePercent(BOSS_LEVELS[node]));
  cycle.exam = { x: 600, y: 470, time: 1 };
  boss.hp = 0;
  cycle.checkKills();
  assert.equal(cycle.bossesDefeated, node + 1);
  assert.equal(cycle.hazards.length, 0);
  assert.equal(cycle.exam, null);
  assert.equal(cycle.mode, node === BOSS_LEVELS.length - 1 ? 'won' : 'playing');
  cycle.spawnClock = 100;
}
assert.equal(new Set(cycle.bossOrder).size, BOSS_LEVELS.length);
assert.equal(cycle.bossOrder.at(-1), 'final');
const jump = fresh();
quiet(jump);
jump.highest = 14;
jump.inventory = [14];
for (let node = 0; node < BOSS_LEVELS.length; node++) {
  jump.bossRest = 0;
  jump.update(0.02, 0, 0);
  assert.equal(jump.enemies.filter((e) => e.kind === 'boss').length, 1);
  const boss = jump.enemies.find((e) => e.kind === 'boss')!;
  assert.equal(boss.boss, jump.bossOrder[node]);
  boss.hp = 0;
  jump.checkKills();
  if (node < BOSS_LEVELS.length - 1) assert.equal(jump.mode, 'playing');
}
assert.equal(jump.mode, 'won');
const pause = fresh();
pause.togglePause();
const paused = pause.snapshot();
pause.update(30, 1, 1);
assert.deepEqual(pause.snapshot(), paused);
pause.togglePause();
const before = pause.time;
pause.hitstop = 0.05;
pause.update(0.04, 1, 1);
assert(Math.abs(pause.time - before - 0.04) < 1e-8);
pause.hitstop = 0;
pause.update(0.2, 1, 1);
assert(Math.abs(pause.time - before - 0.24) < 1e-8);

// Sparse drops: strict cap, expiry, no unattended merges or evolution on the ground.
const sparse = fresh();
quiet(sparse);
for (let i = 0; i < 60; i++) sparse.spawnDrop(200, 200, 0);
assert.equal(sparse.drops.length, MAX_GROUND_BADGES);
sparse.drops.forEach((d) => {
  d.age = 1;
  d.vx = 0;
  d.vy = 0;
});
sparse.update(0.01, 0, 0);
assert.equal(sparse.highest, 0);
assert.equal(sparse.merges, 0);
assert.equal(sparse.drops.length, MAX_GROUND_BADGES);
sparse.drops.forEach((d) => (d.age = BADGE_LIFETIME - 0.01));
sparse.update(0.02, 0, 0);
assert.equal(sparse.drops.length, 0);
sparse.enemies = Array.from({ length: 30 }, () => {
  const e = sparse.makeEnemy('paper', 200, 200);
  e.hp = 0;
  return e;
});
sparse.checkKills();
assert(
  sparse.drops.length <= 1,
  'a mass kill must not carpet the map with drops',
);
sparse.highest = 13;
sparse.spawnDrop(300, 200);
assert(sparse.drops.every((d) => d.level < 14));

// Food launches from the visible supply station, follows a curved path, ignores magnets, and exits after 8s.
const flight = fresh();
quiet(flight);
flight.view = { x: 300, y: 0, width: 400, height: 800 };
flight.spawnFood('goose');
flight.spawnFood('duck');
const station = supplyStation(flight.view);
assert.equal(flight.drops[0].x, station.x);
assert.equal(flight.drops[0].y, station.y - 20);
assert.equal(flight.drops[1].x, station.x);
assert.equal(flight.drops[1].y, station.y - 20);
assert(flight.drops.every((d) => d.flight!.endX < flight.view.x));
const goose = flight.drops[0],
  duck = flight.drops[1];
flight.player = { x: 100, y: 700, dx: 1, dy: 0 };
for (let i = 0; i < 80; i++) flight.update(0.05, 0, 0);
assert(goose.x > 300 && goose.x < 700);
assert(duck.x > 300 && duck.x < 700);
for (let i = 0; i < 82; i++) flight.update(0.05, 0, 0);
assert.equal(flight.drops.length, 0);
assert.equal(flight.hp, 100);
const eating = fresh();
quiet(eating);
eating.hp = 50;
eating.invulnerable = 10;
eating.spawnFood('goose');
eating.drops[0].flight = {
  startX: 600,
  startY: 470,
  endX: 600,
  endY: 470,
  duration: 8,
  bend: 0,
};
eating.drops[0].x = 600;
eating.drops[0].y = 470;
eating.drops[0].age = 1;
eating.update(0.01, 0, 0);
assert.equal(eating.hp, 74);
assert.equal(eating.drops.length, 0);
eating.update(0.01, 0, 0);
assert.equal(eating.hp, 74);
eating.eatFood('duck');
assert.equal(eating.hp, 62);
eating.eatFood('goose');
assert.equal(eating.hp, 86);
assert.equal(eating.feastTime, 5);
eating.hp = 1;
eating.eatFood('duck');
assert.equal(eating.mode, 'lost');
eating.eatFood('goose');
assert.equal(eating.hp, 0);

// Preserve the three meme combat abilities and final-state safety.
const bike = fresh();
quiet(bike);
bike.enemies = [bike.makeEnemy('boss', 625, 470)];
bike.enemies[0].speed = 0;
assert(bike.dash());
assert(!bike.dash());
bike.update(0.01, 1, 0);
const bossHp = bike.enemies[0].hp;
assert(bossHp < bike.bossMax);
bike.update(0.01, -1, 0);
assert.equal(bike.enemies[0].hp, bossHp);
assert.equal(bike.hp, 100);
assert(bike.player.dx < 0);
const skill = fresh();
quiet(skill);
assert(!skill.skill());
skill.chargeSkill(100);
skill.togglePause();
assert(!skill.skill());
skill.togglePause();
skill.enemies = [
  skill.makeEnemy('paper', 1100, 470),
  skill.makeEnemy('paper', 1070, 470),
];
skill.enemies.forEach((e) => {
  e.hp = 10;
  e.speed = 0;
});
assert(skill.skill());
assert(!skill.skill());
skill.update(0.05, 0, 0);
skill.update(0.05, 0, 0);
for (let i = 0; i < 140; i++) skill.update(0.01, 0, 0);
assert.equal(skill.kills, 2);
assert.equal(skill.skillCharge, 0);
const examDeath = fresh();
quiet(examDeath);
examDeath.hp = 1;
examDeath.exam = { x: 600, y: 470, time: 0.4 };
examDeath.update(0.01, 0, 0);
assert.equal(examDeath.mode, 'lost');
assert.equal(examDeath.exam, null);
const weapon = fresh();
weapon.shoot();
const basic = weapon.shots.length;
weapon.shots = [];
weapon.highest = 4;
weapon.shoot();
assert(weapon.shots.length > basic);
assert(
  weapon.shots.filter((s) => !s.support).every((s) => (s.splash ?? 0) > 0),
);

// Uniform viewport scaling keeps a badge circular on portrait and wide screens.
for (const [w, h] of [
  [390, 844],
  [1920, 1080],
  [844, 390],
]) {
  const v = cameraView(w, h, { x: 600, y: 470 });
  assert(Math.abs(w / v.width - h / v.height) < 1e-8);
  assert(
    v.x >= 0 && v.y >= 0 && v.x + v.width <= 1200 && v.y + v.height <= 800,
  );
}
console.log(
  'Final-Boss victory, progress checkpoints, timer freeze, sparse drops, flying food and viewport assertions passed.',
);

// End-to-end simulations use actual collection, damage and combat; no invulnerability/HP overrides.
for (const major of ['math', 'cs', 'arch'] as const) {
  const s = new GameModel(seeded());
  s.start(
    major,
    major === 'cs' ? 'guixi' : major === 'arch' ? 'jianyuan' : 'shuxue',
  );
  let frames = 0,
    peakDrops = 0;
  while (s.mode === 'playing' && frames++ < 54000) {
    if (s.canMerge) s.merge();
    if (s.skillCharge >= 100) s.skill();
    const near = s.drops
      .filter((d) => d.kind === 'badge' || (d.kind === 'goose' && s.hp < 75))
      .sort(
        (a, b) =>
          Math.hypot(a.x - s.player.x, a.y - s.player.y) -
          Math.hypot(b.x - s.player.x, b.y - s.player.y),
      )[0];
    let x = near ? near.x - s.player.x : Math.cos(s.time * 0.6) * 100,
      y = near ? near.y - s.player.y : Math.sin(s.time * 0.6) * 100;
    for (const e of s.enemies) {
      const d = Math.hypot(e.x - s.player.x, e.y - s.player.y);
      if (d < 95) {
        x += (s.player.x - e.x) * 4;
        y += (s.player.y - e.y) * 4;
      }
    }
    // Follow the same telegraphs a player can see, without changing game state.
    for (const h of s.hazards) {
      if (h.shape === 'line') {
        const dx = s.player.x - h.x,
          dy = s.player.y - h.y;
        const across = -dx * Math.sin(h.angle) + dy * Math.cos(h.angle);
        if (Math.abs(across) < h.width + 55) {
          const sign = across >= 0 ? 1 : -1;
          x -= Math.sin(h.angle) * sign * 450;
          y += Math.cos(h.angle) * sign * 450;
        }
      } else if (h.shape === 'circle') {
        const dx = s.player.x - h.x,
          dy = s.player.y - h.y,
          d = Math.hypot(dx, dy);
        if (d < h.radius + 55) {
          x += (d ? dx / d : 1) * 400;
          y += (d ? dy / d : 0) * 400;
        }
      }
    }
    if (
      s.shots.some(
        (b) => b.enemy && Math.hypot(b.x - s.player.x, b.y - s.player.y) < 65,
      )
    )
      s.dash();
    if (s.exam) {
      if (Math.abs(s.player.x - s.exam.x) < 35)
        x += s.player.x > 600 ? -250 : 250;
      if (Math.abs(s.player.y - s.exam.y) < 35)
        y += s.player.y > 400 ? -250 : 250;
    }
    if (
      s.enemies.some(
        (e) => Math.hypot(e.x - s.player.x, e.y - s.player.y) < 120,
      ) ||
      (s.wallX !== null && Math.abs(s.player.x - s.wallX) < 80)
    )
      s.dash();
    s.update(1 / 60, x, y);
    s.events = [];
    peakDrops = Math.max(
      peakDrops,
      s.drops.filter((d) => d.kind === 'badge').length,
    );
    assert(peakDrops <= MAX_GROUND_BADGES);
    assert(s.inventory.length <= 5);
    assert(s.enemies.length <= 65);
    assert(s.shots.length < 300);
    assert(Number.isFinite(s.hp));
  }
  console.log(major, {
    mode: s.mode,
    time: +s.time.toFixed(1),
    level: s.centralLevel + 1,
    bosses: s.bossesDefeated,
    kills: s.kills,
    merges: s.merges,
    peakDrops,
    hp: Math.round(s.hp),
  });
  assert.notEqual(
    s.mode,
    'playing',
    'simulation should reach a terminal outcome',
  );
  if (s.mode === 'won') assert.equal(s.centralLevel, 14);
}

// Walking into the current station or former heal-zone coordinates grants no HP.
for (const location of [
  supplyStation({ x: 0, y: 0, width: 1200, height: 800 }),
  { x: 1060, y: 630 },
]) {
  const g = fresh();
  quiet(g);
  g.hp = 51;
  g.player.x = location.x;
  g.player.y = location.y;
  for (let i = 0; i < 20; i++) g.update(0.05, 0, 0);
  assert.equal(g.hp, 51);
}
// Major identity changes projectile behavior, not only its color.
for (const major of ['math', 'cs', 'arch'] as const) {
  const g = fresh();
  g.major = major;
  g.shoot();
  assert(g.shots.length > 0);
  if (major === 'math')
    assert(g.shots.filter((s) => !s.support).every((s) => s.pierce >= 3));
  if (major === 'cs') assert(g.shots.length >= 3);
  if (major === 'arch')
    assert(
      g.shots
        .filter((s) => !s.support)
        .every((s) => s.splash! >= 85 && Math.hypot(s.vx, s.vy) < 400),
    );
}
console.log(
  'Ending score freeze, station launch / no healing, and major attacks passed.',
);

// Every book has distinct HP at the same progression; assigned skin and collision size remain stable.
const library = fresh();
const monsters = TEXTBOOKS.map((b) =>
  library.makeEnemy('paper', 800, 400, b.id),
);
assert.equal(monsters.length, 24);
assert.equal(new Set(monsters.map((e) => e.maxHp)).size, 24);
for (const [i, e] of monsters.entries()) {
  assert.equal(e.book, TEXTBOOKS[i].id);
  assert.equal(e.hp, e.maxHp);
  assert(e.r > 0 && e.speed > 0);
}
const seen = new Set(
  Array.from({ length: 300 }, () => library.makeEnemy('paper', 800, 400).book),
);
assert.equal(seen.size, 2);
assert(
  monsters.find((e) => e.book === 'textbook-os')!.speed <
    monsters.find((e) => e.book === 'textbook-network')!.speed,
);
// A second finger cannot hijack or release movement while the first operates the joystick.
const stick = new JoystickInput();
assert(stick.begin(1, 100, 100, 40));
assert(!stick.begin(2, 10, 10, 40));
assert.equal(stick.move(2, 200, 200), null);
assert(!stick.end(2));
assert.deepEqual(stick.move(1, 102, 100), { x: 0, y: 0 });
const diagonal = stick.move(1, 140, 140)!;
assert(Math.abs(diagonal.x - Math.SQRT1_2) < 1e-8);
assert(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-8);
assert(stick.end(1));
assert.equal(stick.move(1, 140, 140), null);
assert(stick.begin(3, 0, 0, 40));
stick.reset();
assert.equal(stick.pointer, null);
// Analog tilt changes speed; diagonal movement never exceeds full movement speed.
const analog = fresh();
quiet(analog);
const startX = analog.player.x;
analog.update(0.05, 0.5, 0);
const half = analog.player.x - startX;
analog.update(0.05, 1, 0);
const full = analog.player.x - startX - half;
assert(Math.abs(full - half * 2) < 1e-8);
console.log(
  '24 book variants, multitouch pointer ownership, release/cancel and analog movement passed.',
);

// Curriculum isolation and strictly increasing year-level contact damage.
for (const major of ['math', 'cs', 'arch'] as const) {
  const game = fresh();
  game.major = major;
  let previousMax = 0;
  for (let year = 1; year <= 4; year++) {
    game.time = (year - 1) * 55;
    const spawn = Array.from({ length: 120 }, () =>
      game.makeEnemy('paper', 800, 400),
    );
    assert(
      spawn.every(
        (e) =>
          TEXTBOOKS.find((b) => b.id === e.book)!.major === major &&
          e.year === year,
      ),
    );
    assert.equal(new Set(spawn.map((e) => e.book)).size, 2);
    assert(Math.min(...spawn.map((e) => e.damage)) > previousMax);
    previousMax = Math.max(...spawn.map((e) => e.damage));
  }
}
// Actual collision damage comes from the book, not its old paper/clock type.
for (const year of [1, 4]) {
  const a = fresh();
  quiet(a);
  a.time = (year - 1) * 55;
  a.questIndex = Math.floor(a.time / 35);
  const e = a.makeEnemy('paper', a.player.x, a.player.y);
  e.speed = 0;
  a.enemies = [e];
  a.questDone = true;
  a.update(0.01, 0, 0);
  assert.equal(a.hp, 100 - e.damage);
}
// Every badge has a named attack; higher-level copies have stronger actual shots.
for (const college of [...colleges, { key: 'qinghua' }]) {
  assert(BADGE_WEAPONS[college.key]);
  for (const major of ['math', 'cs', 'arch'] as const) {
    const a = fresh();
    quiet(a);
    a.major = major;
    a.chain = Array.from({ length: 15 }, () => ({
      ...colleges[0],
      key: college.key,
    }));
    a.enemies = [a.makeEnemy('boss', 800, 470)];
    a.fireBadge(1, a.player);
    const low = a.shots[0].damage;
    a.shots = [];
    a.fireBadge(9, a.player);
    assert(a.shots[0].damage > low);
    assert(
      a.shots.every(
        (s) =>
          s.major === major &&
          s.glyph === a.department.glyph &&
          s.pattern === a.department.pattern,
      ),
    );
  }
}
const wing = fresh();
quiet(wing);
wing.inventory = [3, 1, 2];
wing.enemies = [wing.makeEnemy('boss', 750, 470)];
const origins = wing.wingmen;
wing.shoot();
assert(wing.shots.some((s) => !s.support && s.x === wing.player.x));
for (const origin of origins)
  assert(
    wing.shots.some(
      (s) =>
        s.support &&
        s.x === origin.x &&
        s.y === origin.y &&
        s.level === origin.level,
    ),
  );
assert(wing.shots.filter((s) => s.support).every((s) => s.major === undefined));
const beforeWing = wing.enemies[0].hp;
for (let i = 0; i < 30; i++) wing.update(0.02, 0, 0);
assert(wing.enemies[0].hp < beforeWing);
// Every Boss owns a distinct attack, safe telegraph and damaging active phase.
const signatures = new Set<string>();
for (const def of BOSSES) {
  const a = fresh();
  quiet(a);
  a.highest = BOSS_LEVELS[0];
  a.beginBoss();
  const boss = a.enemies.find((e) => e.kind === 'boss')!;
  boss.boss = def.id;
  a.hazards = [];
  a.castBoss(boss);
  assert(a.hazards.length > 0);
  signatures.add(JSON.stringify(a.hazards.map((h) => [h.shape, h.label])));
  assert(a.hazards.every((h) => h.warn >= 1.1 && !hazardHits(h, a.player)));
  const h = a.hazards[0];
  h.age = h.warn + 0.05;
  if (h.shape !== 'ring') assert(hazardHits(h, { x: h.x, y: h.y }));
  a.bossVolley(boss);
  assert(a.shots.some((s) => s.enemy && s.glyph));
  boss.hp = 0;
  a.checkKills();
  assert.equal(a.hazards.length, 0);
  assert(!a.shots.some((s) => s.enemy));
}
assert.equal(signatures.size, BOSSES.length);
// Sun meme machine is the penultimate checkpoint, with three independently avoidable phases.
assert.equal(fresh().bossOrder.at(-2), 'hotsearch');
assert.equal(BOSSES.length, BOSS_LEVELS.length);
const sun = fresh();
quiet(sun);
sun.highest = BOSS_LEVELS[0];
sun.beginBoss();
const sunBoss = sun.enemies.find((e) => e.kind === 'boss')!;
sunBoss.boss = 'hotsearch';
sun.view = { x: 0, y: 0, width: 1200, height: 800 };
for (let cast = 0; cast < 6; cast++) {
  sun.hazards = [];
  const before = { ...sun.player };
  sun.castBoss(sunBoss);
  const motifs = ['nailfile', 'echo', 'essay'];
  assert(sun.hazards.every((h) => h.motif === motifs[cast % 3]));
  assert(sun.hazards.every((h) => !hazardHits(h, before)));
  if (cast % 3 === 0) {
    assert.equal(sun.hazards.length, 2);
    assert(sun.hazards[1].warn > sun.hazards[0].warn);
    assert.notEqual(sun.hazards[0].angle, sun.hazards[1].angle);
    sun.player.x += 100;
    assert.equal(sun.hazards[0].x, before.x);
  } else if (cast % 3 === 1) {
    assert.equal(sun.hazards.length, 2);
    assert(sun.hazards[1].warn > sun.hazards[0].warn);
    const h = sun.hazards[0];
    h.age = h.warn + h.duration / 2;
    assert(hazardHits(h, { x: h.x + h.radius / 2, y: h.y }));
    assert(!hazardHits(h, { x: h.x, y: h.y }));
  } else {
    assert.equal(sun.hazards.length, 3);
    const gapX = ((Math.floor(cast / 3) % 4) + 0.5) * 300;
    for (const h of sun.hazards) {
      h.age = h.warn + 0.1;
      assert(!hazardHits(h, { x: gapX, y: 400 }));
      assert(hazardHits(h, { x: h.x, y: h.y }));
    }
  }
}
sunBoss.hp = 0;
sun.checkKills();
assert.equal(sun.hazards.length, 0);
const warning = fresh();
quiet(warning);
warning.addHazard(
  'circle',
  warning.player.x,
  warning.player.y,
  'test',
  '#ffffff',
  { warn: 1.2, damage: 19 },
);
for (let i = 0; i < 20; i++) warning.update(0.05, 0, 0);
assert.equal(warning.hp, 100);
for (let i = 0; i < 6; i++) warning.update(0.05, 0, 0);
assert.equal(warning.hp, 81);
warning.finish(false);
assert.equal(warning.hazards.length, 0);
console.log(
  '24 curriculum books, 30 badge x 3 major combinations, real wingmen damage, all unique Boss patterns and warning/cleanup passed.',
);

// Mobile rotation suspends the entire simulation and rejects all combat input.
assert(needsLandscape(true, 390, 844));
assert(!needsLandscape(true, 844, 390));
assert(!needsLandscape(false, 390, 844));
const rotated = fresh();
rotated.orientationBlocked = true;
rotated.skillCharge = 100;
const frozen = JSON.stringify(rotated.snapshot()),
  position = { ...rotated.player };
rotated.update(10, 1, 1);
assert.equal(JSON.stringify(rotated.snapshot()), frozen);
assert.deepEqual(rotated.player, position);
assert(!rotated.merge());
assert(!rotated.dash());
assert(!rotated.skill());
rotated.orientationBlocked = false;
rotated.update(0.05, 1, 0);
assert(rotated.player.x > position.x);
assert(rotated.time > 0);
rotated.togglePause();
rotated.orientationBlocked = true;
rotated.orientationBlocked = false;
rotated.update(1, 1, 0);
assert.equal(rotated.mode, 'paused');
// Frequency accelerates smoothly. Late batches have more ducks even when a goose appears.
let previous = Infinity;
for (let time = 0; time <= 360; time += 15) {
  const p = supplyPolicy(time, 0);
  assert(p.interval <= previous);
  previous = p.interval;
  assert(p.interval >= 5.5);
}
assert(supplyPolicy(0, 14).interval < supplyPolicy(0, 0).interval);
assert.equal(supplyPolicy(0, 0).gooseChance, 1);
assert(supplyPolicy(300, 14).gooseChance < 0.2);
const dry = new GameModel(() => 0.99);
dry.start('math', 'shuxue');
dry.highest = 14;
dry.time = 300;
for (let i = 0; i < 5; i++) {
  dry.drops = [];
  dry.throwSupplies();
  assert.equal(dry.drops.length, 2);
  assert(dry.drops.every((d) => d.kind === 'duck'));
  assert.notEqual(dry.drops[0].flight!.endY, dry.drops[1].flight!.endY);
}
const lucky = new GameModel(() => 0);
lucky.start('math', 'shuxue');
lucky.highest = 14;
lucky.time = 300;
lucky.drops = [];
lucky.throwSupplies();
assert.equal(lucky.drops.filter((d) => d.kind === 'goose').length, 1);
assert.equal(lucky.drops.filter((d) => d.kind === 'duck').length, 2);
console.log(
  'Landscape pause/input guards, checkpoint queues/final gate, accelerated supplies and repeated all-duck batches passed.',
);

// Official directory coverage and end-to-end selection/weapon/ability for every direction.
assert.deepEqual(
  DEPARTMENTS.map((d) => d.name),
  units.units.map((d) => d.name),
);
assert.equal(new Set(DEPARTMENTS.map((d) => d.id)).size, 126);
assert.equal(new Set(DEPARTMENTS.map((d) => d.skill)).size, 126);
assert.equal(new Set(DEPARTMENTS.map((d) => d.kind)).size, 14);
for (const d of DEPARTMENTS) {
  const g = new GameModel(seeded());
  g.start(d.profile, d.badge, d.id);
  quiet(g);
  assert.equal(g.department.name, d.name);
  assert.equal(g.chain[0].key, d.badge);
  const target = g.makeEnemy('boss', g.player.x + 100, g.player.y);
  target.hp = 100000;
  target.maxHp = 100000;
  target.speed = 0;
  g.enemies = [target];
  g.fireBadge(1, g.player);
  const original = g.shots[0];
  g.shots = [];
  g.fireBadge(1, g.player);
  assert.equal(original.glyph, BADGE_WEAPONS[g.chain[1].key].glyph);
  assert(g.shots.every((s) => s.pattern === d.pattern && s.glyph === d.glyph));
  g.shots = [];
  g.skillCharge = 100;
  assert(g.skill());
  assert(!g.skill());
  for (let i = 0; i < 180; i++) g.update(1 / 60, 0, 0);
  assert(target.hp < target.maxHp, `${d.name} skill must inflict real damage`);
  assert.equal(g.snapshot().skillName, d.skill);
  for (const year of [1, 2, 3, 4]) {
    g.time = (year - 1) * 55;
    const e = g.makeEnemy('paper', 100, 100);
    assert.equal(e.year, year);
    if (!['d000', 'd027', 'd041'].includes(d.id))
      assert(e.courseLabel?.startsWith(d.subject));
  }
}
function skillGame(kind: string) {
  const d = DEPARTMENTS.find((d) => d.kind === kind)!;
  const g = new GameModel(seeded());
  g.start(d.profile, d.badge, d.id);
  quiet(g);
  g.skillCharge = 100;
  g.skill();
  g.hitstop = 0;
  return g;
}
const reflector = skillGame('guard');
reflector.shots = [
  {
    x: 650,
    y: 470,
    vx: -100,
    vy: 0,
    life: 3,
    damage: 20,
    enemy: true,
    hits: [],
    pierce: 1,
  },
];
reflector.update(0.01, 0, 0);
assert(!reflector.shots[0].enemy);
assert(reflector.shots[0].vx > 0);
const medic = skillGame('heal');
medic.hp = 50;
medic.update(0.02, 0, 0);
assert(medic.hp > 50);
const frostGame = skillGame('frost');
const fe = frostGame.makeEnemy('paper', 700, 470);
fe.speed = 100;
fe.hp = 999;
frostGame.enemies = [fe];
frostGame.update(0.1, 0, 0);
assert(fe.x > 699);
const gravity = skillGame('gravity');
const ge = gravity.makeEnemy('paper', 750, 470);
ge.speed = 0;
ge.hp = 999;
gravity.enemies = [ge];
gravity.update(0.1, 0, 0);
assert(ge.x < 745);
const rush = skillGame('rush');
const x0 = rush.player.x;
rush.update(0.1, 1, 0);
assert(rush.player.x - x0 > 15);
const laser = DEPARTMENTS.find((d) => d.kind === 'beam')!;
const zones = skillZones(laser, 0, { x: 600, y: 470, dx: 1, dy: 0 }, []);
assert(zones.some((z) => skillHits(z, { x: 900, y: 470, r: 15 })));
assert(!zones.some((z) => skillHits(z, { x: 850, y: 720, r: 15 })));
const wave = DEPARTMENTS.find((d) => d.kind === 'wave')!;
const ring = skillZones(wave, 0.6, { x: 600, y: 470, dx: 1, dy: 0 }, [])[0];
assert(skillHits(ring, { x: 600 + ring.radius, y: 470, r: 10 }));
assert(!skillHits(ring, { x: 600, y: 470, r: 10 }));
for (const id of [
  'fasttrack',
  'canteen',
  'paperclone',
  'outsource',
  'papermill',
])
  assert(!BOSSES.some((b) => String(b.id) === id));
const hard = fresh();
hard.highest = 2;
hard.beginBoss();
assert(hard.bossMax >= 2400);
assert(hard.enemies.find((e) => e.boss)!.damage >= 30);
console.log(
  'All 126 official directions: badge + department weapons, 14 actual skills, reflection/healing/slow/pull/rush, geometry, four-year course themes and Qingbei Boss roster passed.',
);

reflector.invulnerable = 0;
reflector.damage(20);
assert.equal(reflector.hp, 89);

// Supply announcement follows actual goose creation, independently of overwritten battle notices.
const hungry = fresh();
quiet(hungry);
assert.equal(hungry.supplyMessage, '姨姨，腿腿，饿饿');
hungry.foodClock = 4;
hungry.update(0.01, 0, 0);
assert.equal(hungry.supplyMessage, '姨姨，腿腿，饿饿');
hungry.throwSupplies();
assert(hungry.drops.some((d) => d.kind === 'goose'));
assert.equal(hungry.notice, '鹅腿到了！');
assert.equal(hungry.supplyMessage, '鹅腿到了！');
hungry.notify('Boss 登场');
assert.equal(hungry.supplyMessage, '鹅腿到了！');
const arrivalRemaining = hungry.supplyArrivalTime;
hungry.togglePause();
hungry.update(0.05, 0, 0);
assert.equal(hungry.supplyArrivalTime, arrivalRemaining);
hungry.togglePause();
for (let i = 0; i < 60; i++) hungry.update(0.05, 0, 0);
assert.equal(hungry.supplyMessage, '姨姨，腿腿，饿饿');
const ducksOnly = new GameModel(() => 0.99);
ducksOnly.start('math', 'shuxue');
quiet(ducksOnly);
ducksOnly.time = 300;
ducksOnly.throwSupplies();
assert(!ducksOnly.drops.some((d) => d.kind === 'goose'));
assert.notEqual(ducksOnly.notice, '鹅腿到了！');
assert.equal(ducksOnly.supplyMessage, '姨姨，腿腿，饿饿');
const rangedSignatures = new Set<string>();
for (const spec of BOSSES) {
  const g = fresh();
  quiet(g);
  const b = g.makeEnemy('boss', 400, 470);
  b.boss = spec.id;
  g.enemies = [b];
  g.bossVolley(b);
  assert(
    g.shots.every(
      (s) => s.enemy && s.bossSkin === spec.id && Math.hypot(s.vx, s.vy) > 100,
    ),
  );
  rangedSignatures.add(
    JSON.stringify(
      g.shots.map((s) => [s.glyph, s.vx, s.vy, s.x, s.y, s.bossMotion]),
    ),
  );
  const first = g.shots[0],
    before = { x: first.x, y: first.y, vx: first.vx, vy: first.vy };
  g.update(0.05, 0, 0);
  assert(first.x !== before.x || first.y !== before.y);
  if (spec.id === 'snake' || spec.id === 'bike')
    assert(first.vx !== before.vx || first.vy !== before.vy);
  g.castBoss(b);
  assert(g.hazards.every((h) => h.motif && h.warn >= 1.1));
  if (spec.id === 'final') {
    assert.equal(g.shots.length, 15);
    assert(!g.shots.some((s) => Math.abs(Math.atan2(s.vy, s.vx)) < 0.001));
  }
}
// Visible ring arcs and collision share a narrow, fixed opening, including endpoint clearance.
{
  const g = fresh();
  quiet(g);
  g.addHazard('ring', 500, 400, '测试波环', '#fff', {
    radius: 400,
    width: 12,
    warn: 1,
    duration: 2,
  });
  const h = g.hazards[0];
  h.age = 2;
  const gap = h.gapAngle!;
  assert.equal(h.gapHalfAngle, 0.23);
  const point = (a: number) => ({
    x: h.x + Math.cos(a) * 200,
    y: h.y + Math.sin(a) * 200,
  });
  assert(!hazardHits(h, point(gap)));
  assert(
    hazardHits(h, point(gap + 0.22)),
    'visible opening endpoint still requires player-body clearance',
  );
  assert(hazardHits(h, point(gap + 0.5)));
}
assert.equal(rangedSignatures.size, 8);
const rangedHit = fresh();
quiet(rangedHit);
const terminal = rangedHit.makeEnemy('boss', 500, 470);
terminal.boss = 'coder';
terminal.speed = 0;
rangedHit.enemies = [terminal];
rangedHit.bossVolley(terminal);
for (let i = 0; i < 35; i++) rangedHit.update(0.02, 0, 0);
assert(
  rangedHit.hp < 100,
  'Boss projectile must damage the player after travelling across the arena',
);
console.log(
  'Supply waiting/arrival/no-false-goose/pause tests and eight distinct moving Boss volleys, motifs, final gap and ranged damage passed.',
);

// v0.5 regressions exercise the real renderer's image path (not browser/phone visual QA).
const photoModule = await import('../lib/combat-photos');
const { CampusGame } = await import('../lib/game');
const { bossEdgeCue } = await import('../lib/mobile-display');
const { existsSync, statSync } = await import('node:fs');
assert.equal(
  Object.keys(photoModule.DEPARTMENT_BOOK_FAMILY).length,
  DEPARTMENTS.length,
);
let largestBookLoad = 0;
for (const d of DEPARTMENTS) {
  const pool = photoModule.departmentBooks(d.id);
  assert(pool.length >= 2 && pool.length <= 8);
  largestBookLoad = Math.max(
    largestBookLoad,
    pool.reduce((n, p) => n + statSync(`public/art/${p.file}`).size, 0),
  );
  for (const b of TEXTBOOKS.filter((b) => b.major === d.profile)) {
    for (let variant = 0; variant < 2; variant++) {
      const photo = photoModule.enemyBookPhoto(d.id, b.id);
      assert(pool.includes(photo));
      if (['d000', 'd027', 'd041'].includes(d.id))
        assert.equal(
          photo.id,
          b.id,
          'Original book identity must retain its own HP template',
        );
      assert(existsSync(`public/art/${photo.file}`));
      assert(!photo.title.includes('讲义怪'));
    }
  }
}
assert(
  largestBookLoad < 1_500_000,
  'A single department should not load the whole textbook library',
);
const imageCalls: unknown[][] = [];
const paint = new Proxy(
  { drawImage: (...args: unknown[]) => imageCalls.push(args) },
  {
    get(target, prop) {
      return prop === 'drawImage' ? target.drawImage : () => {};
    },
  },
);
const drawModel = fresh();
const assets = new Map<string, object>(
  photoModule.BOOK_PHOTOS.map((p) => [
    p.id,
    { src: p.file, naturalWidth: 600, naturalHeight: 850 },
  ]),
);
for (const [id, p] of Object.entries(photoModule.BOSS_PHOTOS)) {
  assert(existsSync(`public/art/${p.file}`));
  assets.set(`boss-photo-${id}`, {
    src: p.file,
    naturalWidth: 600,
    naturalHeight: 850,
  });
}
const photoDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const thumbnailCalls: unknown[][] = [];
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    createElement: () => ({
      getContext: () => ({
        drawImage: (...args: unknown[]) => thumbnailCalls.push(args),
      }),
    }),
  },
});
const renderer = Object.assign(Object.create(CampusGame.prototype), {
  model: drawModel,
  bookCache: new Map(),
  ctx: paint,
  assets,
  touch: true,
}) as {
  textbookEnemy(e: ReturnType<GameModel['makeEnemy']>): void;
  bossEnemy(e: ReturnType<GameModel['makeEnemy']>): void;
  bookCache: Map<string, HTMLCanvasElement>;
};
for (const d of DEPARTMENTS) {
  drawModel.start(d.profile, d.badge, d.id);
  const enemy = drawModel.makeEnemy('paper', 500, 470);
  imageCalls.length = 0;
  thumbnailCalls.length = 0;
  renderer.textbookEnemy(enemy);
  assert.equal(
    imageCalls.length,
    1,
    `${d.name} must draw a real textbook image, including non-default directions`,
  );
  assert.equal(
    imageCalls[0][0],
    renderer.bookCache.get(photoModule.enemyBookPhoto(d.id, enemy.book).id),
  );
  if (thumbnailCalls.length)
    assert.equal(
      thumbnailCalls[0][0],
      assets.get(photoModule.enemyBookPhoto(d.id, enemy.book).id),
    );
  assert(renderer.bookCache.size <= 12);
}
const repeated = drawModel.makeEnemy('paper', 500, 470);
renderer.textbookEnemy(repeated);
thumbnailCalls.length = 0;
for (let i = 0; i < 1000; i++) renderer.textbookEnemy(repeated);
assert.equal(
  thumbnailCalls.length,
  0,
  'Repeated textbook draws reuse the resized real cover',
);
if (photoDocument) Object.defineProperty(globalThis, 'document', photoDocument);
else Reflect.deleteProperty(globalThis, 'document');
for (const spec of BOSSES) {
  imageCalls.length = 0;
  const enemy = drawModel.makeEnemy('boss', 500, 470);
  enemy.boss = spec.id;
  renderer.bossEnemy(enemy);
  assert(
    imageCalls.some((call) => call[0] === assets.get(`boss-photo-${spec.id}`)),
    `${spec.id} must draw its representative photograph`,
  );
}
for (const [w, h] of [
  [568, 320],
  [667, 375],
  [844, 390],
  [932, 430],
  [1024, 768],
]) {
  const view = cameraView(w, h, { x: 600, y: 470 });
  assert.equal(
    bossEdgeCue(view, {
      x: view.x + view.width / 2,
      y: view.y + view.height / 2,
    }),
    null,
  );
  for (const pos of [
    { x: -50, y: 400 },
    { x: 1250, y: 400 },
    { x: 600, y: -100 },
    { x: 600, y: 900 },
  ]) {
    const cue = bossEdgeCue(view, pos)!;
    assert(cue.x > view.x && cue.x < view.x + view.width);
    assert(cue.y > view.y && cue.y < view.y + view.height);
    assert(Number.isFinite(cue.angle));
  }
  const floating = new JoystickInput();
  floating.begin(42, w * 0.1, h * 0.8, 42);
  assert.deepEqual(floating.move(42, w * 0.1, h * 0.8), { x: 0, y: 0 });
  const moved = floating.move(42, w * 0.1 + 42, h * 0.8)!;
  assert(Math.abs(moved.x - 1) < 1e-10 && moved.y === 0);
  assert.equal(floating.move(99, 0, 0), null);
  floating.reset();
  assert.equal(floating.move(42, w, h), null);
}
console.log(
  `v0.5: ${photoModule.BOOK_PHOTOS.length} real covers, all 126 direction mappings/render paths, 8 Boss pictures, bounded per-department loads and floating joystick/edge cues passed. Largest book preload ${largestBookLoad} bytes. No browser or physical-phone QA claimed.`,
);

// v0.5.1: requests can stall in embedded browsers without either image callback.
const { ImageLoader, loadImageBatch } = await import('../lib/image-loader');
const { EnemyGrid } = await import('../lib/enemy-grid');
const { roundRect } = await import('../lib/canvas-compat');
const { resolveTouchControls, parseInputMode, listenMedia } =
  await import('../lib/input-mode');
let requestCount = 0;
let imageMode: 'stall' | 'ok' | 'fail' = 'stall';
const imageLoader = new ImageLoader(
  () => {
    requestCount++;
    const fake = {
      onload: null as GlobalEventHandlers['onload'],
      onerror: null as GlobalEventHandlers['onerror'],
      decoding: '',
      get src() {
        return '';
      },
      set src(value: string) {
        if (!value || imageMode === 'stall') return;
        const ok = imageMode === 'ok';
        queueMicrotask(() => {
          const cb = ok ? fake.onload : fake.onerror;
          if (cb) Reflect.apply(cb, fake, [new Event(ok ? 'load' : 'error')]);
        });
      },
    };
    return fake;
  },
  5,
  2,
);
await assert.rejects(imageLoader.load('stalled.png'));
assert.equal(
  requestCount,
  2,
  'a request with no callbacks must stop after two attempts',
);
imageMode = 'ok';
const sameA = imageLoader.load('stalled.png');
const sameB = imageLoader.load('stalled.png');
assert.equal(sameA, sameB, 'deduplicate in-flight requests');
assert.equal(await sameA, await sameB);
await imageLoader.load('stalled.png');
assert.equal(
  requestCount,
  3,
  'retry recovers, then successful cache prevents refetch',
);
imageMode = 'fail';
await assert.rejects(imageLoader.load('failed.png'));
assert.equal(requestCount, 5);
const accepted: string[] = [];
const failures = await loadImageBatch(
  [
    ['a', 'ok'],
    ['b', 'bad'],
    ['c', 'ok'],
  ],
  async (src) => {
    if (src === 'bad') throw new Error('offline');
    return src;
  },
  (key) => accepted.push(key),
);
assert.deepEqual(failures, ['b']);
assert.deepEqual(accepted.sort(), ['a', 'c']);
let queuedRequests = 0;
const progressEvents: number[] = [];
const releases: (() => void)[] = [];
const pendingBatch = await loadImageBatch(
  Array.from({ length: 20 }, (_, i) => [String(i), String(i)]),
  () => {
    queuedRequests++;
    return new Promise<void>((resolve) => releases.push(resolve));
  },
  () => {},
  (done) => progressEvents.push(done),
  5,
);
assert.equal(pendingBatch.length, 20);
assert.equal(queuedRequests, 4, 'deadline stops starting queued downloads');
releases.forEach((finish) => finish());
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(
  progressEvents,
  [0],
  'late completion must not update ended progress',
);
assert.deepEqual(
  await loadImageBatch(
    [],
    async () => 0,
    () => {},
  ),
  [],
);

// Compare spatial candidates and exact hit order with the original brute-force loop.
const points = Array.from({ length: 65 }, (_, i) => ({
  id: i,
  x: ((i * 137) % 1300) - 50,
  y: ((i * 97) % 900) - 50,
  r: 15 + (i % 60),
}));
const grid = new EnemyGrid<(typeof points)[number]>();
grid.rebuild(points);
let candidates = 0;
for (let i = 0; i < 1000; i++) {
  const x = ((i * 43) % 1400) - 100,
    y = ((i * 61) % 1000) - 100;
  const near = grid.query(x, y, 82);
  candidates += near.length;
  const hit = (p: (typeof points)[number]) =>
    Math.hypot(p.x - x, p.y - y) < p.r + 8;
  assert.deepEqual(near.filter(hit), points.filter(hit));
  const homingHit = (p: (typeof points)[number]) =>
    p.id % 3 !== 0 && Math.hypot(p.x - x, p.y - y) < 150;
  assert.equal(grid.query(x, y, 150).find(homingHit), points.find(homingHit));
}
assert(
  candidates < 6500,
  'spread-out stress scene must remove at least 90% of candidate distance checks',
);
grid.rebuild([]);
assert.deepEqual(grid.query(0, 0, 100), []);
const pathOps: string[] = [];
const fallbackCtx = new Proxy(
  {},
  {
    get: (_, key) =>
      key === 'roundRect'
        ? undefined
        : (...args: number[]) => {
            assert(args.every(Number.isFinite));
            pathOps.push(String(key));
          },
  },
) as CanvasRenderingContext2D;
roundRect(fallbackCtx, 0, 0, 100, 60, 8);
assert.equal(pathOps.filter((op) => op === 'quadraticCurveTo').length, 4);
let nativeRounded = false;
roundRect(
  {
    roundRect() {
      nativeRounded = true;
    },
  } as unknown as CanvasRenderingContext2D,
  0,
  0,
  10,
  10,
  2,
);
assert(nativeRounded);
// v0.6.1: capabilities and explicit preference, independent of viewport size.
const desktopInput = {
  coarse: false,
  fine: true,
  hover: true,
  anyCoarse: false,
  touchPoints: 0,
  userAgent: 'Windows',
  platform: 'Win32',
  touchObserved: false,
};
const phoneInput = {
  ...desktopInput,
  coarse: true,
  fine: false,
  hover: false,
  anyCoarse: true,
  touchPoints: 5,
  userAgent: 'Android; wv',
};
for (const [width, height] of [
  [400, 840],
  [840, 400],
  [1366, 1024],
]) {
  const device = { ...phoneInput, width, height };
  assert.equal(resolveTouchControls('auto', device), true);
}
assert.equal(
  resolveTouchControls('auto', {
    ...phoneInput,
    coarse: false,
    anyCoarse: false,
  }),
  true,
  'WebView without coarse pointer still has touch points',
);
assert.equal(
  resolveTouchControls('auto', { ...phoneInput, fine: true, hover: true }),
  true,
  'Android with a mouse retains touch access',
);
assert.equal(
  resolveTouchControls('auto', {
    ...desktopInput,
    platform: 'MacIntel',
    touchPoints: 5,
  }),
  true,
  'desktop-UA iPad',
);
assert.equal(resolveTouchControls('auto', desktopInput), false);
assert.equal(
  resolveTouchControls('auto', {
    ...desktopInput,
    touchPoints: 10,
    anyCoarse: true,
  }),
  false,
  'touch laptop initially retains mouse layout',
);
assert.equal(
  resolveTouchControls('auto', { ...desktopInput, touchObserved: true }),
  true,
  'real touch overrides missing capability reports',
);
assert.equal(
  resolveTouchControls('keyboard', { ...phoneInput, touchObserved: true }),
  false,
  'explicit keyboard mode beats touch events',
);
assert.equal(
  resolveTouchControls('touch', desktopInput),
  true,
  'manual fallback without detectable hardware',
);
assert.equal(
  resolveTouchControls('auto', { ...desktopInput, userAgent: 'Android' }),
  false,
  'UA alone is insufficient',
);
assert.equal(parseInputMode('corrupted'), 'auto');
assert.equal(parseInputMode(null), 'auto');
assert.equal(parseInputMode('touch'), 'touch');
let listenerCount = 0;
for (const legacy of [false, true]) {
  const listeners = new Set<() => void>();
  const add = (...args: unknown[]) => listeners.add(args.at(-1) as () => void);
  const remove = (...args: unknown[]) =>
    listeners.delete(args.at(-1) as () => void);
  const query = (legacy
    ? { addListener: add, removeListener: remove }
    : {
        addEventListener: add,
        removeEventListener: remove,
      }) as unknown as MediaQueryList;
  const cleanup = listenMedia(query, () => listenerCount++);
  listeners.forEach((fn) => fn());
  cleanup();
  assert.equal(listeners.size, 0, 'unsubscribe on unmount');
}
assert.equal(listenerCount, 2);
const { readFileSync: readInputFile } = await import('node:fs');
const inputCss = readInputFile('app/globals.css', 'utf8');
assert(
  !inputCss.includes('(pointer: coarse)'),
  'CSS must not independently veto the selected touch mode',
);
assert(
  inputCss.includes('.challenge.touch-controls .movement-stick'),
  'touch mode supplies visible joystick styles',
);
assert(
  inputCss.includes('@media (orientation: portrait)'),
  'portrait rotation remains available for manual touch mode',
);
const inputPage = readInputFile('app/page.tsx', 'utf8');
assert(!inputPage.includes('matchMedia'), 'game UI uses shared mode');
assert(
  inputPage.includes('title-input-mode') &&
    inputPage.includes('pause-input-mode'),
);

// Execute the cached projectile path without a browser; measure expensive sprite builds.
let spriteBuilds = 0,
  spriteBlits = 0;
const spriteContext = new Proxy(
  {},
  {
    get:
      (_, key) =>
      (..._args: unknown[]) => {
        if (key === 'drawImage') spriteBlits++;
      },
  },
);
const originalDocument = Object.getOwnPropertyDescriptor(
  globalThis,
  'document',
);
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: { createElement: () => ({ getContext: () => spriteContext }) },
});
try {
  const cachedRenderer = Object.assign(Object.create(CampusGame.prototype), {
    model: { weaponTier: 3, time: 1 },
    ctx: spriteContext,
    projectileCache: new Map(),
    majorShot: () => {
      spriteBuilds++;
    },
  });
  for (let i = 0; i < 1000; i++)
    cachedRenderer.cachedShot({
      x: i,
      y: i,
      vx: 1,
      vy: i % 3,
      major: 'math',
      color: '#ffffff',
      glyph: '∑',
    });
  assert.equal(spriteBuilds, 1);
  assert.equal(spriteBlits, 1000);
  for (let i = 0; i < 100; i++)
    cachedRenderer.cachedShot({ x: 0, y: 0, vx: 1, vy: 0, glyph: String(i) });
  assert.equal(
    cachedRenderer.projectileCache.size,
    64,
    'sprite memory must remain bounded',
  );
} finally {
  if (originalDocument)
    Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
}
console.log(
  `v0.5.1: stalled/error image recovery, deadline/dedup, roundRect fallback, input modes, sprite cache passed. 1000 shots / 65 spread-out enemies: ${candidates}/65000 collision candidates; same hit and homing order. 1000 same-style shots: 1 sprite build + 1000 blits. These are operation counts, not measured phone FPS.`,
);

// v0.5.2: identical logical controls in physical landscape and portrait-locked webviews.
const { stagePoint, layoutAttributes } = await import('../lib/mobile-display');
for (const [physicalWidth, physicalHeight] of [
  [360, 800],
  [390, 844],
  [412, 915],
  [430, 932],
]) {
  const logicalWidth = physicalHeight,
    logicalHeight = physicalWidth;
  const attrs = layoutAttributes(logicalWidth, logicalHeight);
  assert.equal(attrs['data-layout'], 'landscape');
  assert.equal(attrs['data-height-max-550'], 'true');
  assert.equal(
    needsLandscape(true, logicalWidth, logicalHeight),
    false,
    'portrait phone must no longer pause an already-landscape stage',
  );
  // A 300 x 190 local control rectangle rotated clockwise into screen coordinates.
  const localRect = {
    left: 20,
    top: logicalHeight - 210,
    width: 300,
    height: 190,
  };
  const screenRect = {
    left: physicalWidth - localRect.top - localRect.height,
    right: physicalWidth - localRect.top,
    top: localRect.left,
  };
  for (const [x, y] of [
    [0, 0],
    [300, 190],
    [150, 95],
    [20, 42],
  ]) {
    const physical = {
      x: physicalWidth - (localRect.top + y),
      y: localRect.left + x,
    };
    assert.deepEqual(stagePoint(screenRect, physical.x, physical.y, true), {
      x,
      y,
    });
  }
  const virtualStick = new JoystickInput();
  const center = stagePoint(
    screenRect,
    screenRect.right - 95,
    screenRect.top + 150,
    true,
  );
  virtualStick.begin(1, center.x, center.y, 42);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const p = stagePoint(
      screenRect,
      screenRect.right - (95 + dy * 42),
      screenRect.top + 150 + dx * 42,
      true,
    );
    const actual = virtualStick.move(1, p.x, p.y)!;
    assert(Math.abs(actual.x - dx) < 1e-10 && Math.abs(actual.y - dy) < 1e-10);
  }
  virtualStick.reset();
  assert.equal(virtualStick.move(1, 0, 0), null);
}
assert.deepEqual(stagePoint({ left: 25, top: 50, right: 325 }, 67, 92, false), {
  x: 42,
  y: 42,
});
assert.equal(layoutAttributes(667, 375)['data-width-max-700'], 'true');
assert.equal(layoutAttributes(844, 390)['data-width-max-700'], 'false');
assert.equal(layoutAttributes(700, 550)['data-height-max-550'], 'true');
assert.equal(layoutAttributes(701, 551)['data-width-min-701'], 'true');

// Exercise actual resize integration: bounding rect is rotated, client size is logical.
const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const oldComputedStyle = Object.getOwnPropertyDescriptor(
  globalThis,
  'getComputedStyle',
);
let rotatedStyle = '1';
const stageAttrs: Record<string, string> = {};
const fakeStage = {
  dataset: {} as Record<string, string>,
  setAttribute: (key: string, value: string) => {
    stageAttrs[key] = value;
  },
};
const fakeCanvas = {
  clientWidth: 844,
  clientHeight: 390,
  width: 0,
  height: 0,
  closest: () => fakeStage,
  getBoundingClientRect: () => ({ width: 390, height: 844 }),
};
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { devicePixelRatio: 3, matchMedia: () => ({ matches: true }) },
});
Object.defineProperty(globalThis, 'getComputedStyle', {
  configurable: true,
  value: () => ({ getPropertyValue: () => rotatedStyle }),
});
try {
  const stageRenderer = Object.assign(Object.create(CampusGame.prototype), {
    canvas: fakeCanvas,
    touch: true,
    keys: new Set(['w']),
    move: { x: 1, y: 1 },
    syncOrientation: () => {},
  });
  stageRenderer.resize();
  assert.equal(stageRenderer.width, 844);
  assert.equal(stageRenderer.height, 390);
  assert.equal(fakeCanvas.width, 1266);
  assert.equal(fakeCanvas.height, 585);
  assert.equal(fakeStage.dataset.rotated, 'true');
  assert.equal(stageAttrs['data-layout'], 'landscape');
  assert.deepEqual(stageRenderer.move, { x: 0, y: 0 });
  stageRenderer.setTouchControls(false);
  assert.equal(fakeCanvas.width, 1688, 'keyboard mode updates renderer DPR');
  assert.deepEqual(stageRenderer.move, { x: 0, y: 0 });
  stageRenderer.setTouchControls(true);
  assert.equal(
    fakeCanvas.width,
    1266,
    'manual touch mode updates renderer DPR',
  );
  rotatedStyle = '0';
  stageRenderer.resize();
  assert.equal(
    fakeStage.dataset.rotated,
    'false',
    'physical rotation can preserve canvas dimensions but must update touch transform',
  );
} finally {
  if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (oldComputedStyle)
    Object.defineProperty(globalThis, 'getComputedStyle', oldComputedStyle);
  else Reflect.deleteProperty(globalThis, 'getComputedStyle');
}
console.log(
  'v0.5.2: four portrait-phone dimensions, clockwise coordinate inverse, all joystick directions, logical breakpoints, landscape pause guard and real resize integration passed. Physical phone UX still requires verification.',
);

// v0.6.0: music state, media lifetime and request concurrency stay bounded.
assert.equal(musicScene(49, 'playing'), 'urgent');
assert.equal(musicScene(50, 'playing'), 'battle');
assert.equal(musicScene(0, 'lost'), 'defeat');
assert.equal(musicScene(100, 'won'), 'victory');
assert.equal(musicScene(20, 'paused'), null);
class TestMedia implements MusicMedia {
  src = '';
  preload = '';
  loop = false;
  volume = 0;
  paused = true;
  released = false;
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {}
  removeAttribute() {
    this.released = true;
    this.src = '';
  }
}
const media: TestMedia[] = [];
const music = new GameMusic(() => {
  const m = new TestMedia();
  media.push(m);
  return m;
});
music.update(100, 'playing', 0.1);
assert.equal(media.length, 0, 'No audio download before user interaction');
music.unlock();
await Promise.resolve();
for (let i = 0; i < 60; i++) music.update(100, 'playing', 1 / 60);
assert.equal(media.length, 1);
assert(media[0].volume > 0 && media[0].volume <= 0.3);
music.update(49, 'playing', 0.1);
assert.equal(media.length, 2);
for (let i = 0; i < 120; i++) music.update(49, 'playing', 1 / 60);
assert(media[0].released);
assert(media[1].loop);
music.setMuted(true);
assert(media.every((m) => m.paused && m.volume === 0));
music.setMuted(false);
await Promise.resolve();
music.update(49, 'paused', 0.1);
assert(media[1].paused);
music.update(49, 'playing', 0.1);
await Promise.resolve();
assert(!media[1].paused);
music.update(100, 'won', 0.1);
assert(!media[2].loop);
music.update(0, 'lost', 0.1);
assert(media.filter((m) => !m.released).length <= 2);
music.update(0, 'lost', 0.1, true);
assert(media.every((m) => m.paused));
music.destroy();
await Promise.resolve();
assert(media.every((m) => m.released && m.paused));

let concurrent = 0,
  peakConcurrent = 0;
const limited = new ImageLoader(
  () => ({
    onload: null as GlobalEventHandlers['onload'],
    onerror: null as GlobalEventHandlers['onerror'],
    decoding: '',
    get src() {
      return '';
    },
    set src(value: string) {
      if (!value) return;
      concurrent++;
      peakConcurrent = Math.max(peakConcurrent, concurrent);
      setTimeout(() => {
        concurrent--;
        this.onload?.call({} as GlobalEventHandlers, {} as Event);
      }, 2);
    },
  }),
  100,
  1,
  3,
);
await Promise.all(
  Array.from({ length: 20 }, (_, i) => limited.load(`asset-${i}`)),
);
assert.equal(
  peakConcurrent,
  3,
  'Overlapping critical/background loads share one concurrency limit',
);
console.log(
  'v0.6.0: two-voice streamed music, fade/pause/mute/end/cleanup, cached real covers and global image request bound passed.',
);

const sceneDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const sceneCanvas = { width: 0, height: 0, getContext: () => ({}) };
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: { createElement: () => sceneCanvas },
});
try {
  let paints = 0,
    blits = 0;
  const scenery = Object.assign(Object.create(CampusGame.prototype), {
    canvas: { width: 8000, height: 4000 },
    ctx: {
      drawImage() {
        blits++;
      },
    },
    assets: new Map(),
    model: { bossSpawned: false },
    visualClock: 0,
    sceneryAt: -Infinity,
    sceneryKey: '',
    sceneryBuffer: null,
    drawScenery(_motion: boolean, w: number, h: number) {
      paints++;
      assert(w * h <= 2_000_000);
    },
  });
  for (let i = 0; i < 120; i++) {
    scenery.visualClock = i / 120;
    scenery.cachedScenery(false);
  }
  assert(
    paints <= 30 && paints >= 20,
    'Background paint is capped independently from battle frames',
  );
  assert.equal(blits, 120);
  assert(sceneCanvas.width * sceneCanvas.height <= 2_000_000);
  const before = paints;
  scenery.assets.set('campus', {});
  scenery.cachedScenery(false);
  assert.equal(
    paints,
    before + 1,
    'A newly loaded photo replaces fallback immediately',
  );
  scenery.canvas = { width: 800, height: 400 };
  scenery.cachedScenery(false);
  assert.equal(sceneCanvas.width, 800);
  assert.equal(sceneCanvas.height, 400);
} finally {
  if (sceneDocument)
    Object.defineProperty(globalThis, 'document', sceneDocument);
  else Reflect.deleteProperty(globalThis, 'document');
}
console.log(
  'v0.6.0: background redraw bound, loaded-photo invalidation, resize and 2-megapixel buffer cap passed.',
);

// v0.6.2: bounded local records, independent department/overall rankings.
const {
  emptyRecordBook,
  addRecord,
  readRecordBook,
  saveRecord,
  formatRecordTime,
} = await import('../lib/records');
const recordDepartments = new Set(['d001', 'd002']);
const makeRecord = (id: number, timeMs: number, departmentId = 'd001') => ({
  id: 'run-' + id,
  departmentId,
  timeMs,
  completedAt: 1_780_000_000_000 + id,
  version: '0.6.2',
});
let recordBook = emptyRecordBook();
for (let i = 30; i > 0; i--)
  recordBook = addRecord(
    recordBook,
    makeRecord(i, i * 1000),
    recordDepartments,
  );
assert.equal(recordBook.departments.d001.length, 10);
assert.equal(recordBook.overall.length, 20);
assert.equal(
  recordBook.overall[19].timeMs,
  20_000,
  'same department can occupy ranks 11–20 in overall',
);
assert.equal(recordBook.departments.d001[0].timeMs, 1000);
recordBook = addRecord(
  recordBook,
  makeRecord(31, 500, 'd002'),
  recordDepartments,
);
assert.equal(recordBook.overall[0].departmentId, 'd002');
assert.equal(recordBook.departments.d001.length, 10);
assert.deepEqual(
  addRecord(recordBook, makeRecord(31, 500, 'd002'), recordDepartments),
  recordBook,
  'repeat callbacks do not duplicate a run',
);
assert.deepEqual(
  readRecordBook(JSON.stringify(recordBook), recordDepartments),
  recordBook,
  'refresh preserves both independent leaderboards',
);
assert.deepEqual(
  readRecordBook('{broken', recordDepartments),
  emptyRecordBook(),
);
assert.deepEqual(
  readRecordBook(JSON.stringify({ schema: 99 }), recordDepartments),
  emptyRecordBook(),
);
assert.deepEqual(
  readRecordBook('x'.repeat(500001), recordDepartments),
  emptyRecordBook(),
);
for (const bad of [0, -1, Infinity, NaN])
  assert.deepEqual(
    addRecord(recordBook, makeRecord(50, bad), recordDepartments),
    recordBook,
  );
assert.deepEqual(
  addRecord(recordBook, makeRecord(50, 20, 'unknown'), recordDepartments),
  recordBook,
);
const corrupt = JSON.parse(JSON.stringify(recordBook));
corrupt.departments.d001.push(makeRecord(100, 1, 'd002'), {
  id: 'bad',
  timeMs: 1,
});
assert.deepEqual(
  readRecordBook(JSON.stringify(corrupt), recordDepartments),
  recordBook,
);
const blockedStore = {
  getItem() {
    throw new Error('denied');
  },
  setItem() {
    throw new Error('denied');
  },
};
const sessionScore = saveRecord(
  blockedStore,
  recordBook,
  makeRecord(100, 300),
  recordDepartments,
);
assert.equal(sessionScore.persisted, false);
assert.equal(sessionScore.book.departments.d001[0].timeMs, 300);
assert.equal(sessionScore.previousBest, 1000);
let savedJson = JSON.stringify(recordBook),
  recordWrites = 0;
const scoreStore = {
  getItem() {
    return savedJson;
  },
  setItem(_key: string, text: string) {
    recordWrites++;
    savedJson = text;
  },
};
const olderTab = emptyRecordBook();
const mergedScore = saveRecord(
  scoreStore,
  olderTab,
  makeRecord(101, 200),
  recordDepartments,
);
assert.equal(mergedScore.persisted, true);
assert.equal(
  mergedScore.book.departments.d002[0].id,
  'run-31',
  'saving merges the latest persisted scores from another tab',
);
assert.equal(recordWrites, 1, 'one storage write per completed run');
assert.equal(formatRecordTime(61_230), '01:01.23');
assert.equal(formatRecordTime(600_000), '10:00.00');
const fullDepartments = new Set(DEPARTMENTS.map((d) => d.id));
let fullBook = emptyRecordBook();
let recordId = 500;
for (const id of fullDepartments)
  for (let i = 0; i < 15; i++)
    fullBook = addRecord(
      fullBook,
      makeRecord(recordId++, 5000 + i, id),
      fullDepartments,
    );
assert(Object.values(fullBook.departments).every((rows) => rows.length === 10));
assert.equal(fullBook.overall.length, 20);
assert(
  JSON.stringify(fullBook).length < 250_000,
  '126 department records remain bounded below 250 KB',
);
console.log(
  'v0.6.2: top 10 per department / independent overall 20, deduplication, damaged storage, denied storage, stale-tab merge and bounded 126-department data passed.',
);

// Leaderboard client: bounded responses, cache, auth, invalidation and failure recovery.
const clientGlobalNames = [
  'window',
  'location',
  'localStorage',
  'fetch',
] as const;
const clientGlobals = clientGlobalNames.map(
  (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
);
let boardRequests = 0;
let failBoardRequest = false;
let postedScore: Record<string, unknown> | null = null;
const clientIdentity = {
  playerId: 'test-id',
  nickname: '测试',
  token: 'a'.repeat(64),
};
const clientStore = new Map<string, string>();
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { setTimeout, clearTimeout },
});
Object.defineProperty(globalThis, 'location', {
  configurable: true,
  value: { hostname: 'cp3126675-arch.github.io' },
});
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => clientStore.get(k) || null,
    setItem: (k: string, v: string) => clientStore.set(k, v),
  },
});
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  value: async (url: string, init?: RequestInit) => {
    if (url === './leaderboard.json')
      return Response.json({ apiBase: 'https://scores.example.test' });
    if (url.includes('/api/player/nickname')) {
      assert.equal(init?.method, 'POST');
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        'Bearer ' + clientIdentity.token,
      );
      return Response.json({
        playerId: clientIdentity.playerId,
        nickname: JSON.parse(init!.body as string).nickname,
      });
    }
    if (url.includes('/api/scores')) {
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        'Bearer ' + clientIdentity.token,
      );
      assert.equal(init?.credentials, 'omit');
      assert.equal(typeof init?.body, 'string');
      postedScore = JSON.parse(init!.body as string);
      return Response.json({ ok: true });
    }
    boardRequests++;
    if (failBoardRequest) throw new DOMException('Timed out', 'AbortError');
    return Response.json({
      rows: Array.from({ length: 30 }, (_, i) => ({
        playerId: 'p' + i,
        nickname: '玩家' + i,
        departmentId: 'd001',
        timeMs: 60000 + i * 100,
        completedAt: 1780000000000,
      })),
    });
  },
});
try {
  const client = await import('../lib/leaderboard-client');
  assert.equal(client.readIdentity(), null);
  assert.equal(client.persistIdentity(clientIdentity), true);
  assert.deepEqual(client.readIdentity(), clientIdentity);
  assert.equal((await client.getLeaderboard('all')).length, 20);
  await client.getLeaderboard('all');
  assert.equal(
    boardRequests,
    1,
    'reopening within 30 seconds uses the cached bounded board',
  );
  assert.equal((await client.getLeaderboard('d001')).length, 10);
  await client.submitScore(clientIdentity, {
    departmentId: 'd001',
    timeMs: 60000,
    version: '0.6.2',
  });
  assert.equal((postedScore as Record<string, unknown> | null)?.won, true);
  await client.getLeaderboard('all');
  assert.equal(
    boardRequests,
    3,
    'successful submission invalidates leaderboard cache',
  );
  const beforeRenameRequests = boardRequests;
  const renamedIdentity = await client.renamePlayer(
    clientIdentity,
    '清人123456',
  );
  assert.deepEqual(
    renamedIdentity,
    { ...clientIdentity, nickname: '清人123456' },
    'rename preserves player id and credential',
  );
  assert.equal(client.persistIdentity(renamedIdentity), true);
  assert.deepEqual(client.readIdentity(), renamedIdentity);
  await client.getLeaderboard('all');
  assert.equal(
    boardRequests,
    beforeRenameRequests + 1,
    'rename invalidates previously cached names',
  );
  for (let i = 0; i < 100; i++)
    assert.match(client.randomNickname(), /^(清人|燕人)\d{6}$/);
  failBoardRequest = true;
  await assert.rejects(client.getLeaderboard('d002'), /网络较慢/);
  failBoardRequest = false;
  assert.equal(
    (await client.getLeaderboard('d002')).length,
    10,
    'failed requests are retryable',
  );
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('blocked');
    },
  });
  assert.equal(client.readIdentity(), null);
  assert.equal(client.persistIdentity(clientIdentity), false);
  const beforeMode = boardRequests;
  await client.getLeaderboard('all', 'survival');
  await client.getLeaderboard('all', 'survival');
  assert.equal(
    boardRequests,
    beforeMode + 1,
    'mode-specific cache, no race cache reuse',
  );
  await client.submitScore(clientIdentity, {
    mode: 'survival',
    departmentId: 'd001',
    timeMs: 300000,
    version: '0.6.3',
  });
  assert.equal((postedScore as Record<string, unknown> | null)?.won, false);
  assert.equal((postedScore as Record<string, unknown> | null)?.ended, true);
  assert.equal(
    (postedScore as Record<string, unknown> | null)?.mode,
    'survival',
  );
} finally {
  for (const [name, descriptor] of clientGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
}
console.log(
  'v0.6.2: leaderboard client 10/20 limits, 30-second cache, authenticated score submission, cache invalidation, timeout retry and unavailable identity storage passed.',
);

// v0.6.3: local survival ranking is descending and stored independently.
{
  let survival = emptyRecordBook();
  for (let i = 1; i <= 30; i++)
    survival = addRecord(
      survival,
      { ...makeRecord(100 + i, i * 1000), mode: 'survival' },
      recordDepartments,
      'survival',
    );
  assert.equal(survival.departments.d001.length, 10);
  assert.equal(survival.overall.length, 20);
  assert.equal(survival.overall[0].timeMs, 30000);
  assert.equal(survival.overall[19].timeMs, 11000);
  assert.deepEqual(
    readRecordBook(JSON.stringify(survival), recordDepartments, 'survival'),
    survival,
  );
  assert.equal(
    readRecordBook(JSON.stringify(survival), recordDepartments).overall.length,
    0,
  );
  assert.equal(
    readRecordBook(JSON.stringify(recordBook), recordDepartments, 'survival')
      .overall.length,
    0,
  );
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
  saveRecord(
    storage,
    emptyRecordBook(),
    makeRecord(200, 10000),
    recordDepartments,
  );
  saveRecord(
    storage,
    emptyRecordBook(),
    { ...makeRecord(201, 300000), mode: 'survival' },
    recordDepartments,
    'survival',
  );
  assert.equal(store.size, 2);
  assert.equal(
    readRecordBook(store.get('campus-records-v1')!, recordDepartments)
      .overall[0].timeMs,
    10000,
  );
  assert.equal(
    readRecordBook(
      store.get('campus-survival-records-v1')!,
      recordDepartments,
      'survival',
    ).overall[0].timeMs,
    300000,
  );
}
console.log(
  'v0.6.3: independent survival storage, descending top10/top20 and race isolation passed.',
);
