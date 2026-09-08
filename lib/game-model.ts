import type { SurvivalSnapshot } from './survival-rules';
import { EnemyGrid } from './enemy-grid';
import colleges from './colleges.json';
import {
  department,
  DEFAULT_DEPARTMENTS,
  skillZones,
  skillHits,
} from './departments';
import { BOSS_LEVELS, mergePercent, supplyPolicy } from './battle-rules';
import { TEXTBOOKS, textbook, YEAR_NAMES, type TextbookId } from './textbooks';
import { badgeWeapon, type WeaponPattern } from './badge-weapons';
import {
  BOSSES,
  bossSpec,
  hazardHits,
  type BossId,
  type BossHazard,
} from './bosses';
export type Major = 'math' | 'cs' | 'arch';
export type Mode = 'menu' | 'playing' | 'paused' | 'won' | 'lost';
export type College = (typeof colleges)[number];
export type Snapshot = {
  survival?: SurvivalSnapshot;
  hurtTime: number;
  mode: Mode;
  endProgress: number;
  hp: number;
  credits: number;
  kills: number;
  time: number;
  phase: number;
  broadcast: string;
  questTitle: string;
  questText: string;
  questRemaining: number;
  bossHp: number;
  notice: string;
  inventory: number[];
  chain: College[];
  canMerge: boolean;
  dashCooldown: number;
  merges: number;
  gpa: number;
  endReason: string;
  skillCharge: number;
  skillTime: number;
  combo: number;
  bestCombo: number;
  weaponTier: number;
  feastTime: number;
  round: number;
  bossesDefeated: number;
  mergeProgress: number;
  nextBossProgress: number;
  totalBosses: number;
  orientationBlocked: boolean;
  forgedAt: number | null;
  year: number;
  bossName: string;
  bossTip: string;
  mainWeapon: string;
  skillName: string;
  departmentName: string;
};
export const initialSnapshot: Snapshot = {
  mode: 'menu',
  hurtTime: 0,
  endProgress: 0,
  hp: 100,
  credits: 0,
  kills: 0,
  time: 0,
  phase: 0,
  broadcast: '',
  questTitle: '高数作业：消灭 10 只作业怪',
  questText: '截止前完成，获得 2 学分',
  questRemaining: 35,
  bossHp: 0,
  notice: '',
  inventory: [],
  chain: colleges,
  canMerge: false,
  dashCooldown: 0,
  merges: 0,
  gpa: 0,
  endReason: '',
  skillCharge: 60,
  skillTime: 0,
  combo: 0,
  bestCombo: 0,
  weaponTier: 0,
  feastTime: 0,
  round: 1,
  bossesDefeated: 0,
  mergeProgress: 0,
  nextBossProgress: mergePercent(BOSS_LEVELS[0]),
  totalBosses: BOSS_LEVELS.length,
  orientationBlocked: false,
  forgedAt: null,
  year: 1,
  bossName: '',
  bossTip: '',
  mainWeapon: '',
  skillName: '',
  departmentName: '',
};
export const WORLD = { width: 1200, height: 800 };
export const MAX_GROUND_BADGES = 10;
export const BADGE_LIFETIME = 22;
export const ENDING_SECONDS = 2.6;
export function supplyStation(view: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return { x: view.x + view.width - 65, y: view.y + view.height * 0.72 };
}
export type Enemy = {
  book: TextbookId;
  courseLabel?: string;
  year: number;
  damage: number;
  attackClock: number;
  boss?: BossId;
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  r: number;
  speed: number;
  kind: 'paper' | 'clock' | 'boss';
  hit: number;
  credit: number;
};
export type Shot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  enemy: boolean;
  bossSkin?: BossId;
  bossMotion?: 'serpent' | 'wheel';
  hits: number[];
  pierce: number;
  splash?: number;
  color?: string;
  glyph?: string;
  pattern?: WeaponPattern;
  major?: Major;
  support?: boolean;
  level?: number;
  age?: number;
  baseAngle?: number;
  baseSpeed?: number;
  slow?: number;
  split?: boolean;
};
export type Drop = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  level: number;
  age: number;
  flight?: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    duration: number;
    bend: number;
  };
  kind: 'badge' | 'heal' | 'goose' | 'duck';
};
export type FX = {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  r: number;
  color: string;
  kind: 'ring' | 'text' | 'spark' | 'burst' | 'trail';
  text?: string;
  vx: number;
  vy: number;
};
export const ASSIGNMENTS = [
  { title: '高数作业', kind: 'kills', target: 10, label: '击败作业怪' },
  { title: '院徽实验', kind: 'merges', target: 2, label: '完成徽章合成' },
  {
    title: '小组作业（只有你在做）',
    kind: 'kills',
    target: 18,
    label: '击败作业怪',
  },
  { title: '资料收集报告', kind: 'collected', target: 8, label: '拾取院徽' },
  { title: '合成进阶作业', kind: 'merges', target: 3, label: '完成徽章合成' },
  { title: '期末复习清单', kind: 'kills', target: 22, label: '击败作业怪' },
] as const;
export const clamp = (n: number, a: number, b: number) =>
  Math.min(b, Math.max(a, n));
export const distance = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.hypot(a.x - b.x, a.y - b.y);
export function cameraView(
  width: number,
  height: number,
  player: { x: number; y: number },
  world = WORLD,
) {
  const scale = Math.max(
    Math.max(1, width) / WORLD.width,
    Math.max(1, height) / WORLD.height,
  );
  const w = Math.min(WORLD.width, Math.max(1, width) / scale),
    h = Math.min(WORLD.height, Math.max(1, height) / scale);
  return {
    x: clamp(player.x - w / 2, 0, world.width - w),
    y: clamp(player.y - h / 2, 0, world.height - h),
    width: w,
    height: h,
  };
}
export function findPair(inv: number[], limit = 14): [number, number] | null {
  // E always upgrades the largest available pair first.
  for (let level = limit - 1; level >= 0; level--) {
    const first = inv.indexOf(level);
    const second = inv.indexOf(level, first + 1);
    if (first >= 0 && second >= 0) return [first, second];
  }
  return null;
}
export function buildChain(target: string, rng: () => number): College[] {
  const end =
    colleges.find((c) => c.key === target) ||
    colleges.find((c) => c.key === 'shuxue')!;
  const others = colleges.filter((c) => c.key !== end.key);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  return [
    end,
    ...others.slice(0, 13),
    {
      key: 'qinghua',
      name: '清华大学',
      short: '清华',
      title: '清华',
      color: '#660874',
      image: 'img/round/qinghua.png',
    },
  ];
}
export class GameModel {
  mode: Mode = 'menu';
  orientationBlocked = false;
  bossRest = 0;
  forgedAt: number | null = null;
  endingTime = 0;
  major: Major = 'math';
  departmentId = '';
  volleyIndex = 0;
  get department() {
    return department(this.departmentId || DEFAULT_DEPARTMENTS[this.major]);
  }
  get skillZones() {
    return skillZones(
      this.department,
      this.department.duration - this.skillTime,
      this.player,
      this.enemies
        .filter((e) => distance(e, this.player) < 520)
        .sort((a, b) => distance(a, this.player) - distance(b, this.player)),
    );
  }
  chain: College[] = colleges;
  time = 0;
  hp = 100;
  credits = 0;
  kills = 0;
  merges = 0;
  collected = 0;
  highest = 0;
  inventory: number[] = [];
  player = { x: 600, y: 470, dx: 1, dy: 0 };
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  private enemyGrid = new EnemyGrid<Enemy>();
  drops: Drop[] = [];
  fx: FX[] = [];
  hurtUntil = 0;
  lastHit = 0;
  dashCooldown = 0;
  dashTime = 0;
  invulnerable = 0;
  attackCooldown = 0;
  notice = '';
  noticeTime = 0;
  broadcast = '“老师说了，考试不难。”';
  endReason = '';
  round = 1;
  bossesDefeated = 0;
  waveTime = 0;
  bossMax = 2200;
  bossSpawned = false;
  bossDead = false;
  bossAttack = 3;
  bossRing = 4;
  bossCast = 0;
  bossVolleyCount = 0;
  bossOrder: BossId[] = [];
  hazards: BossHazard[] = [];
  supportCooldown = 0;
  lastYear = 1;
  exam: { x: number; y: number; time: number } | null = null;
  wallX: number | null = null;
  wallCycle = -1;
  wallWarn = false;
  questIndex = 0;
  questDone = false;
  questBase = { kills: 0, merges: 0, collected: 0 };
  passed = 0;
  failed = 0;
  spawnClock = 1;
  bonusSpawn = 10;
  badgeDropCooldown = 0;
  view = { x: 0, y: 0, width: 1200, height: 800 };
  dormCooldown = 0;
  id = 0;
  shake = 0;
  events: string[] = [];
  skillCharge = 60;
  skillTime = 0;
  skillPulse = 0;
  skillUses = 0;
  combo = 0;
  bestCombo = 0;
  comboTime = 0;
  feastTime = 0;
  foodClock = 17;
  supplyArrivalTime = 0;
  get supplyMessage() {
    return this.supplyArrivalTime > 0 ? '鹅腿到了！' : '姨姨，腿腿，饿饿';
  }
  bikeHits = new Set<number>();
  hitstop = 0;
  flash = 0;
  banner = '';
  bannerTime = 0;
  protected rng: () => number;
  get world() {
    return WORLD;
  }
  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }
  start(major: Major, target: string, departmentId?: string) {
    const fresh = new GameModel(this.rng);
    Object.assign(this, fresh);
    this.departmentId = departmentId || '';
    this.major = departmentId ? department(departmentId).profile : major;
    // Shuffle only the regular checkpoints; graduation is always last.
    this.bossOrder = BOSSES.filter(
      (b) => b.id !== 'final' && b.id !== 'hotsearch',
    ).map((b) => b.id);
    for (let i = this.bossOrder.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.bossOrder[i], this.bossOrder[j]] = [
        this.bossOrder[j],
        this.bossOrder[i],
      ];
    }
    this.bossOrder.push('hotsearch', 'final');
    this.chain = buildChain(target, this.rng);
    this.inventory = [0, 0];
    this.mode = 'playing';
    this.notify('操控中央院徽 · E 合成 · 合出清华，再击破最终 Boss', 7);
    this.broadcast = this.department.joke;
    for (let i = 0; i < 2; i++)
      this.spawnDrop(390 + i * 90, 360 + (i % 2) * 100, 0);
    this.enemies.push(
      this.makeEnemy('paper', 780, 460),
      this.makeEnemy('paper', 420, 580),
    );
  }
  toMenu() {
    Object.assign(this, new GameModel(this.rng));
  }
  togglePause() {
    if (this.mode === 'playing') this.mode = 'paused';
    else if (this.mode === 'paused') this.mode = 'playing';
  }
  notify(text: string, seconds = 3) {
    this.notice = text;
    this.noticeTime = seconds;
  }
  effect(
    x: number,
    y: number,
    kind: FX['kind'],
    color: string,
    r = 40,
    life = 0.45,
    text?: string,
  ) {
    this.fx.push({
      x,
      y,
      kind,
      color,
      r,
      life,
      maxLife: life,
      text,
      vx: (this.rng() - 0.5) * 150,
      vy: -35 - this.rng() * 70,
    });
  }
  get phase() {
    return this.bossSpawned ? 2 : this.waveTime >= 25 ? 1 : 0;
  }
  get nextBossLevel(): number | null {
    return BOSS_LEVELS[this.bossesDefeated] ?? null;
  }
  get isFinalBoss() {
    return this.bossesDefeated === BOSS_LEVELS.length - 1;
  }
  get centralLevel() {
    return Math.max(0, ...this.inventory);
  }
  get year() {
    return Math.min(
      4,
      1 + Math.max(Math.floor(this.time / 55), Math.floor(this.highest / 4)),
    );
  }
  get wingmen() {
    const center = this.inventory.indexOf(this.centralLevel);
    const levels = this.inventory.filter((_, i) => i !== center);
    const radius = 57 + this.centralLevel * 0.65;
    return levels.map((level, i) => {
      const angle = this.time * 0.8 + (i * Math.PI * 2) / levels.length;
      return {
        level,
        x: this.player.x + Math.cos(angle) * radius,
        y: this.player.y + Math.sin(angle) * radius,
      };
    });
  }
  get mainWeapon() {
    return `${badgeWeapon(this.chain[this.centralLevel]?.key || 'shuxue').name} × ${this.department.attack}`;
  }
  get power() {
    return 1 + this.highest * 0.36 + Math.min(this.merges, 30) * 0.07;
  }
  get weaponTier() {
    return Math.min(3, Math.floor(this.highest / 2));
  }
  chargeSkill(amount: number) {
    if (this.skillTime <= 0)
      this.skillCharge = Math.min(100, this.skillCharge + amount);
  }
  announce(text: string, color = '#ddbcff') {
    this.banner = text;
    this.bannerTime = 1.5;
    this.flash = 0.16;
    this.shake = 12;
    this.effect(this.player.x, this.player.y, 'burst', color, 250, 0.65);
  }
  skill() {
    if (
      this.mode !== 'playing' ||
      this.orientationBlocked ||
      this.skillCharge < 100 ||
      this.skillTime > 0
    )
      return false;
    this.skillCharge = 0;
    this.skillTime = this.department.duration;
    this.skillPulse = 0;
    this.skillUses++;
    this.invulnerable = Math.max(this.invulnerable, 0.8);
    this.hitstop = 0.07;
    this.events.push('skill');
    this.announce(this.department.skill, this.department.color);
    this.broadcast = this.department.joke;
    this.notify(`${this.department.name} · ${this.department.skill}`, 3);

    return true;
  }
  heal(amount: number, _fromMerge = false) {
    this.hp = Math.min(100, this.hp + amount);
    return true;
  }
  eatFood(kind: 'goose' | 'duck') {
    if (this.mode !== 'playing') return;
    if (kind === 'goose') {
      this.heal(24);
      this.feastTime = 5;
      this.chargeSkill(8);
      this.events.push('goose');
      this.notify('鹅腿 +24 生命！5 秒火力加餐', 3);
      this.effect(this.player.x, this.player.y, 'burst', '#a6ff8b', 100, 0.5);
      this.effect(
        this.player.x,
        this.player.y - 40,
        'text',
        '#baff9b',
        0,
        1.2,
        '鹅腿 +24 · 火力加餐',
      );
    } else {
      // Eating is a choice of pickup; combat invulnerability does not cancel its HP cost.
      this.hp = Math.max(0, this.hp - 12);
      this.lastHit = 12;
      this.hurtUntil = this.time + 0.9;
      this.shake = Math.max(this.shake, 10);
      this.shake = 6;
      this.events.push('hurt');
      this.notify('吃成鸭腿了！生命 -12', 3);
      this.effect(
        this.player.x,
        this.player.y - 40,
        'text',
        '#ff99a5',
        0,
        1.2,
        '鸭腿 -12',
      );
      if (this.hp <= 0)
        this.finish(false, '最后一口吃成鸭腿了。下次认准绿色「鹅腿 +24」！');
    }
  }
  get quest() {
    return ASSIGNMENTS[this.questIndex % ASSIGNMENTS.length];
  }
  get questProgress() {
    return this[this.quest.kind] - this.questBase[this.quest.kind];
  }
  get canMerge() {
    return !!findPair(this.inventory, this.chain.length - 1);
  }
  dash() {
    if (
      this.mode !== 'playing' ||
      this.orientationBlocked ||
      this.dashCooldown > 0
    )
      return false;
    this.dashTime = 0.72;
    this.dashCooldown = 4;
    this.invulnerable = Math.max(this.invulnerable, 0.85);
    this.bikeHits.clear();
    this.notify('学堂路车神！骑车可转向 · 撞穿怪群', 1.4);
    this.events.push('dash');
    this.effect(this.player.x, this.player.y, 'ring', '#a3dffe', 70);
    return true;
  }
  merge() {
    if (this.mode !== 'playing' || this.orientationBlocked) return false;
    const pair = findPair(this.inventory, this.chain.length - 1);
    if (!pair) {
      this.notify('需要两枚相同院徽；靠近地面院徽即可拾取');
      return false;
    }
    const lv = this.inventory[pair[0]] + 1;
    this.inventory.splice(pair[1], 1);
    this.inventory.splice(pair[0], 1);
    this.inventory.push(lv);
    this.onMerge(lv, this.player.x, this.player.y);
    return true;
  }
  get graduationHeal() {
    return 20;
  }
  onMerge(level: number, x: number, y: number) {
    if (this.mode !== 'playing') return;
    this.merges++;
    this.highest = Math.max(this.highest, level);
    this.shake = 10;
    this.hitstop = 0.045;
    this.flash = 0.12;
    this.chargeSkill(16);
    this.effect(x, y, 'burst', '#d7ff8d', 285, 0.7);
    this.effect(x, y, 'ring', '#b794ff', 330, 0.8);
    this.events.push('merge');
    this.effect(x, y, 'ring', '#d7ff8d', 210, 0.7);
    this.effect(
      x,
      y - 40,
      'text',
      '#edffc6',
      0,
      1.25,
      `合成！${this.chain[level].short} Lv.${level + 1}`,
    );
    this.notify(
      level === 13
        ? '距离清华只差最后一次合成！'
        : level === 14
          ? '清华校徽已合成！击败剩余 Boss 和最终审核机才能毕业。'
          : `合成 ${this.chain[level].name} · 攻击提升 + 冲击波`,
      3.4,
    );
    if (level === this.chain.length - 1) {
      this.fireBadge(level, this.player);
      this.effect(x, y - 60, 'text', '#f4d8ff', 0, 1.7, '二校门毕业炮');
      this.forgedAt = this.time;
      this.heal(this.graduationHeal, true);
      this.invulnerable = Math.max(this.invulnerable, 1.5);
      this.drops = this.drops.filter((d) => d.kind !== 'badge');
    }
    for (const e of this.enemies) {
      const d = distance(e, { x, y });
      if (d < 255) {
        e.hp -= 40 + level * 20;
        e.hit = 0.18;
        const scale = 55 / Math.max(d, 1);
        e.x = clamp(e.x + (e.x - x) * scale, 25, this.world.width - 25);
        e.y = clamp(e.y + (e.y - y) * scale, 30, this.world.height - 30);
      }
    }
    this.heal(1, true);
    this.invulnerable = Math.max(this.invulnerable, 0.35);
    this.checkKills();
  }
  makeEnemy(
    kind: Enemy['kind'],
    x: number,
    y: number,
    bookId?: TextbookId,
  ): Enemy {
    // Current-year coursework only: no other majors and no return to easier years.
    const pool = TEXTBOOKS.filter(
      (b) => b.major === this.major && b.year === this.year,
    );
    const book = bookId
      ? textbook(bookId)
      : pool[Math.min(pool.length - 1, Math.floor(this.rng() * pool.length))];
    const maxHp =
      kind === 'boss'
        ? this.bossMax
        : Math.round(
            book.hp *
              (1 +
                Math.min(this.round - 1, 14) * 0.1 +
                this.highest * 0.08 +
                Math.max(0, this.time - 220) / 600) *
              (kind === 'clock' ? 1.65 : 1),
          );
    return {
      id: ++this.id,
      x,
      y,
      book: book.id,
      courseLabel: !Object.values(DEFAULT_DEPARTMENTS).some(
        (id) => id === this.department.id,
      )
        ? `${this.department.subject}${['基础', '方法', '专题', '研究'][book.year - 1]}·${['讲义', '习题', '实验'][this.id % 3]}`
        : undefined,
      year: book.year,
      damage:
        kind === 'boss'
          ? 30
          : book.damage +
            (kind === 'clock' ? 4 : 0) +
            Math.min(8, Math.floor(this.time / 180)),
      attackClock: 2 + this.rng() * 3,
      boss:
        kind === 'boss'
          ? this.bossOrder[this.bossesDefeated] ||
            BOSSES[this.bossesDefeated % BOSSES.length].id
          : undefined,
      hp: maxHp,
      maxHp,
      r: kind === 'boss' ? 60 : (kind === 'clock' ? 22 : 17) * book.size,
      speed:
        kind === 'boss'
          ? 22
          : kind === 'clock'
            ? 85 * book.speed
            : (48 + Math.min(this.round, 12) * 3) * book.speed,
      kind,
      hit: 0,
      credit: 0,
    };
  }
  spawnEnemy(kind: Enemy['kind'] = 'paper', credit = 0) {
    if (this.enemies.length >= 65) return;
    const side = Math.floor(this.rng() * 4);
    let x = side === 0 ? 35 : side === 1 ? 1165 : 100 + this.rng() * 1000;
    let y = side === 2 ? 45 : side === 3 ? 755 : 120 + this.rng() * 560;
    if (distance({ x, y }, this.player) < 200) {
      x = 1200 - x;
      y = 800 - y;
    }
    const enemy = this.makeEnemy(kind, x, y);
    enemy.credit = credit;
    this.enemies.push(enemy);
  }
  get dropLevel() {
    return this.highest;
  }
  spawnDrop(
    x: number,
    y: number,
    level?: number,
    kind: Drop['kind'] = 'badge',
  ) {
    if (kind === 'goose' || kind === 'duck') {
      this.spawnFood(kind);
      return;
    }
    if (kind === 'badge' && this.dropLevel >= 14) return;
    const badges = this.drops.filter((d) => d.kind === 'badge');
    if (badges.length >= MAX_GROUND_BADGES) {
      if (level === undefined) return;
      // A guaranteed reward replaces the oldest badge instead of adding clutter.
      const oldest = badges.reduce((a, b) => (a.age > b.age ? a : b));
      this.drops = this.drops.filter((d) => d.id !== oldest.id);
    }
    const cap = Math.min(Math.max(0, this.dropLevel - 1), 12);
    const chosen = level ?? Math.max(0, cap - (this.rng() < 0.3 ? 1 : 0));
    this.drops.push({
      id: ++this.id,
      x,
      y,
      vx: (this.rng() - 0.5) * 30,
      vy: (this.rng() - 0.5) * 30,
      level: chosen,
      age: 0,
      kind,
    });
  }
  spawnFood(kind: 'goose' | 'duck', lane = 0) {
    if (this.drops.filter((d) => d.flight).length >= 6) return;
    const { x, y, height } = this.view;
    const station = supplyStation(this.view);
    const startX = station.x,
      startY = station.y - 20;
    const endX = x - 75;
    const endY =
      y + height * (kind === 'goose' ? 0.22 : lane % 2 ? 0.78 : 0.48);
    this.drops.push({
      id: ++this.id,
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      age: 0,
      level: 0,
      kind,
      flight: {
        startX,
        startY,
        endX,
        endY,
        duration: 8,
        bend: kind === 'goose' ? -70 : lane % 2 ? 95 : 35,
      },
    });
  }
  throwSupplies() {
    const policy = supplyPolicy(this.time, this.highest);
    const goose = this.rng() < policy.gooseChance;
    if (goose) {
      this.spawnFood('goose');
      this.supplyArrivalTime = 2.8;
      const station = supplyStation(this.view);
      this.effect(
        station.x - 30,
        station.y - 65,
        'text',
        '#bcff9d',
        0,
        2.2,
        '鹅腿到了！',
      );
    } else this.supplyArrivalTime = 0;
    for (let i = 0; i < policy.ducks; i++) this.spawnFood('duck', i);
    this.foodClock = policy.interval;
    this.notify(goose ? '鹅腿到了！' : '这轮全是鸭腿！没有鹅腿', 2);
  }
  beginBoss() {
    if (
      this.mode !== 'playing' ||
      this.bossSpawned ||
      this.nextBossLevel === null ||
      this.highest < this.nextBossLevel
    )
      return false;
    this.bossSpawned = true;
    this.bossMax = Math.round(
      1.25 *
        (this.isFinalBoss
          ? 18000
          : 2000 + this.bossesDefeated * 880 + this.highest * 205),
    );
    this.invulnerable = Math.max(this.invulnerable, 1);
    this.bossCast = 0;
    this.bossVolleyCount = 0;
    this.hazards = [];
    this.bossAttack = 2.5;
    this.bossRing = 3.5;
    this.enemies = this.enemies.filter((e) => e.kind !== 'paper');
    this.enemies.push(
      this.makeEnemy(
        'boss',
        clamp(this.player.x, 240, this.world.width - 240),
        clamp(this.player.y - 260, 140, this.world.height - 150),
      ),
    );
    this.exam = null;
    this.hazards = [];
    this.wallX = null;
    this.wallWarn = false;
    const spec = bossSpec(this.enemies.find((e) => e.kind === 'boss')!.boss!);
    this.announce(`${spec.name} · ${spec.subtitle}`, spec.color);
    this.broadcast = spec.tip;
    this.notify(
      this.isFinalBoss
        ? '最终答辩！击破审核机才算通关'
        : '进度检查点！击破 Boss，解锁下一场挑战',
      5,
    );
    this.events.push('alarm');
    return true;
  }
  completeBoss(x: number, y: number) {
    this.bossesDefeated++;
    this.bossDead = true;
    this.credits += 4;
    this.heal(18);
    this.spawnDrop(
      clamp(x - 45, 80, this.world.width - 80),
      clamp(y, 90, this.world.height - 90),
      this.highest,
    );
    this.spawnDrop(
      clamp(x + 45, 80, this.world.width - 80),
      clamp(y, 90, this.world.height - 90),
      Math.max(0, this.highest - 1),
    );
    this.round++;
    this.bossRest = 3;
    this.waveTime = 0;
    this.bossSpawned = false;
    this.spawnClock = 1;
    this.exam = null;
    this.hazards = [];
    this.wallX = null;
    this.wallWarn = false;
    this.shots = this.shots.filter((s) => !s.enemy);
    this.invulnerable = Math.max(this.invulnerable, 1.5);
    if (this.bossesDefeated === BOSS_LEVELS.length && this.highest >= 14) {
      this.finish(true);
      return;
    }
    this.notify(
      `Boss 击破！${this.bossesDefeated}/${BOSS_LEVELS.length} · 下一节点 ${mergePercent(this.nextBossLevel!)}%`,
      4,
    );
    this.events.push('credit');
  }
  damage(amount: number) {
    if (this.invulnerable > 0 || this.mode !== 'playing') return;
    if (this.skillTime > 0 && this.department.kind === 'guard')
      amount = Math.ceil(amount * 0.55);
    this.lastHit = Math.ceil(amount);
    this.hurtUntil = this.time + 0.9;
    this.hp = Math.max(0, this.hp - amount);
    this.invulnerable = 0.8;
    this.shake = Math.max(this.shake, 10);
    this.hitstop = Math.max(this.hitstop, 0.035);
    this.events.push('hurt');
    this.effect(
      this.player.x,
      this.player.y - 30,
      'text',
      '#ff98a4',
      0,
      0.7,
      `-${amount}`,
    );
    if (this.hp <= 0)
      this.finish(false, '被作业淹没了。多走位，合成冲击波和冲刺都能救命。');
  }
  fireBadge(level: number, origin: { x: number; y: number }, support = false) {
    const near = this.enemies
      .filter((e) => distance(e, origin) < 530)
      .sort((a, b) => distance(a, origin) - distance(b, origin))[0];
    if (!near) return;
    const badge = badgeWeapon(this.chain[level].key);
    // Alternate the central badge's own weapon with the chosen department's projectile.
    // Wingmen retain their individual badge weapons.
    const infused = !support && this.volleyIndex++ % 2 === 1;
    const spec = infused ? this.department : badge,
      pattern = spec.pattern;
    const major = support ? undefined : this.major;
    const angle = Math.atan2(near.y - origin.y, near.x - origin.x);
    const count =
      (pattern === 'fan' ? 3 : pattern === 'split' ? 2 : 1) +
      (major === 'cs' ? 2 : 0) +
      (support ? 0 : this.weaponTier * 2);
    const speed = major === 'arch' ? 365 : pattern === 'homing' ? 390 : 500;
    // Level is the damage input for each badge, including individual wingmen.
    const damage =
      (support ? 10 : major === 'cs' ? 12 : 24) * (1 + level * 0.52);
    for (let i = 0; i < count; i++) {
      const a =
        angle + (i - (count - 1) / 2) * (pattern === 'fan' ? 0.2 : 0.105);
      this.shots.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: pattern === 'return' ? 1.45 : 1.35,
        damage,
        enemy: false,
        hits: [],
        pierce:
          (major === 'math' ? 3 : 1) +
          (pattern === 'lance' ? 3 : 0) +
          (support ? 0 : this.weaponTier),
        splash:
          major === 'arch'
            ? 85 + this.weaponTier * 10
            : pattern === 'burst'
              ? 74
              : !support && this.weaponTier >= 2
                ? 55
                : 0,
        color: spec.color,
        glyph: spec.glyph,
        pattern,
        major,
        support,
        level,
        age: 0,
        baseAngle: a,
        baseSpeed: speed,
      });
    }
    this.effect(
      origin.x,
      origin.y,
      'ring',
      spec.color,
      support ? 20 : 35,
      0.18,
    );
  }
  shoot() {
    this.fireBadge(this.centralLevel, this.player);
    if (this.supportCooldown <= 0) {
      for (const wing of this.wingmen) this.fireBadge(wing.level, wing, true);
      this.supportCooldown = 0.85;
    }
    this.events.push('shot');
  }
  addHazard(
    shape: BossHazard['shape'],
    x: number,
    y: number,
    label: string,
    color: string,
    extra: Partial<BossHazard> = {},
  ) {
    if (shape === 'ring') {
      extra = {
        gapAngle:
          Math.atan2(this.player.y - y, this.player.x - x) +
          (this.bossCast % 2 ? 0.32 : -0.32),
        gapHalfAngle: 0.23,
        ...extra,
      };
    }
    this.hazards.push({
      id: ++this.id,
      shape,
      x,
      y,
      radius: 60,
      angle: 0,
      length: 680,
      width: 17,
      age: 0,
      warn: 1.25,
      duration: 0.5,
      damage: 25,
      label,
      color,
      ...extra,
    });
  }
  castBoss(boss: Enemy) {
    const hazardStart = this.hazards.length;
    const spec = bossSpec(boss.boss!),
      n = this.bossCast++;
    const p = this.player,
      color = spec.color;
    this.effect(
      boss.x,
      boss.y - 85,
      'text',
      color,
      0,
      1.5,
      spec.move.split(' / ')[n % spec.move.split(' / ').length],
    );
    if (boss.boss === 'hotsearch') {
      if (n % 3 === 0) {
        // Two fixed, staggered files: the preview never follows the player.
        for (let i = 0; i < 2; i++)
          this.addHazard(
            'line',
            p.x,
            p.y,
            i ? '十指抛光 · 第二锉' : '磨指甲 · 离开锉面',
            color,
            {
              angle: i ? -Math.PI / 4 : Math.PI / 4,
              length: 560,
              width: 20,
              warn: 1.4 + i * 0.75,
              duration: 0.65,
              damage: 29,
              motif: 'nailfile',
            },
          );
      } else if (n % 3 === 1) {
        for (let i = 0; i < 2; i++)
          this.addHazard(
            'ring',
            boss.x,
            boss.y,
            i ? '妈妈？· 回声二重奏' : '叫妈妈 · 回声启动',
            color,
            {
              radius: 440,
              width: 12,
              warn: 1.3 + i * 1.05,
              duration: 2.5,
              damage: 24,
              motif: 'echo',
            },
          );
      } else {
        const v = this.view,
          laneWidth = v.width / 4,
          gap = Math.floor(n / 3) % 4;
        for (let lane = 0; lane < 4; lane++) {
          if (lane === gap) continue;
          this.addHazard(
            'line',
            v.x + laneWidth * (lane + 0.5),
            v.y + v.height / 2,
            '小作文轰炸 · 找空白栏',
            color,
            {
              angle: Math.PI / 2,
              length: v.height + 80,
              width: Math.max(12, laneWidth / 2 - 24),
              warn: 1.65,
              duration: 0.85,
              damage: 27,
              motif: 'essay',
            },
          );
        }
      }
    } else if (boss.boss === 'final') {
      const gap = n % 4;
      for (let i = 0; i < 4; i++)
        if (i !== gap)
          this.addHazard(
            'circle',
            clamp(p.x + (i % 2 ? 90 : -90), 70, this.world.width - 70),
            clamp(p.y + (i < 2 ? -75 : 75), 70, this.world.height - 70),
            '毕业终审',
            color,
            { radius: 62, warn: 1.5, duration: 0.7, damage: 32 },
          );
      this.addHazard('line', p.x, p.y, '学位答辩 · 最后一问', color, {
        angle: n % 2 ? Math.PI / 2 : 0,
        width: 18,
        warn: 2.1,
        damage: 30,
      });
    } else if (boss.boss === 'coder') {
      const angle = Math.atan2(p.y - boss.y, p.x - boss.x);
      for (let i = -1; i <= 1; i++)
        this.addHazard(
          'line',
          p.x - Math.sin(angle) * i * 85,
          p.y + Math.cos(angle) * i * 85,
          '删库斩 · 离开红线',
          color,
          { angle, width: 14, warn: 1.4 + i * 0.12 },
        );
    } else if (boss.boss === 'snake') {
      for (let i = 0; i < 6; i++)
        this.addHazard(
          'circle',
          clamp(p.x - 180 + i * 72, 65, this.world.width - 65),
          clamp(p.y + Math.sin(i * 1.2 + n) * 75, 65, this.world.height - 65),
          'Chinese Snake · 蛇身封路',
          color,
          { radius: 37, warn: 1.25 + i * 0.2, damage: 25 },
        );
      this.addHazard('line', p.x, p.y, '蛇信扫堂', color, {
        angle: n * 0.75,
        width: 13,
        warn: 2.5,
        damage: 26,
      });
    } else if (boss.boss === 'goosequeue') {
      const v = this.view,
        gap = n % 4;
      for (let i = 0; i < 4; i++)
        if (i !== gap)
          this.addHazard(
            'line',
            v.x + (v.width * (i + 0.5)) / 4,
            v.y + v.height / 2,
            `排队 ${i + 1} 号 · 已售罄`,
            color,
            {
              angle: Math.PI / 2,
              length: v.height + 50,
              width: Math.max(12, v.width / 8 - 28),
              warn: 1.5,
              damage: 26,
            },
          );
      if (n % 2)
        this.addHazard('ring', boss.x, boss.y, '售罄了！', color, {
          radius: 370,
          width: 13,
          warn: 2.3,
          duration: 2.5,
          damage: 25,
        });
    } else if (boss.boss === 'bike') {
      const angle = Math.atan2(p.y - boss.y, p.x - boss.x);
      for (const offset of [-65, 65])
        this.addHazard(
          'line',
          p.x - Math.sin(angle) * offset,
          p.y + Math.cos(angle) * offset,
          '逆行车道 · 快躲开',
          color,
          { angle, width: 22, length: 620, warn: 1.35, damage: 30 },
        );
      this.addHazard(
        'circle',
        clamp(p.x + p.dx * 160, 95, this.world.width - 95),
        clamp(p.y + p.dy * 160, 95, this.world.height - 95),
        '车王冲刺终点',
        color,
        { radius: 48, warn: 1.65, duration: 0.35, damage: 29 },
      );
    } else if (boss.boss === 'weishen') {
      for (const angle of [n * 0.35, n * 0.35 + Math.PI / 2])
        this.addHazard('line', p.x, p.y, '显然 · 建立坐标系', color, {
          angle,
          width: 17,
          warn: 1.4,
          damage: 28,
        });
      for (const side of [-1, 1])
        this.addHazard(
          'circle',
          clamp(p.x + side * 105, 65, this.world.width - 65),
          clamp(p.y - 85, 65, this.world.height - 65),
          '馒头引理',
          color,
          { radius: 55, warn: 2.25, damage: 27 },
        );
    } else if (boss.boss === 'swim') {
      const v = this.view,
        gap = n % 5;
      for (let i = 0; i < 5; i++)
        if (i !== gap)
          this.addHazard(
            'line',
            v.x + v.width / 2,
            v.y + (v.height * (i + 0.5)) / 5,
            '泳道清场 · 50m',
            color,
            {
              angle: 0,
              length: v.width + 50,
              width: Math.max(10, v.height / 10 - 24),
              warn: 1.65,
              damage: 27,
            },
          );
      this.addHazard('ring', boss.x, boss.y, '蝶泳巨浪', color, {
        radius: 460,
        width: 12,
        warn: 2.3,
        duration: 3,
        damage: 25,
      });
    }
    // Link every newly authored danger zone to its Boss; preserve the three Sun motifs.
    for (const h of this.hazards.slice(hazardStart)) h.motif ??= boss.boss;
  }

  bossAttackInterval(boss: Enemy) {
    return boss.hp < boss.maxHp * 0.5 ? 2.5 : 3.8;
  }
  bossVolley(boss: Enemy) {
    const id = boss.boss!,
      spec = bossSpec(id),
      n = this.bossVolleyCount++;
    const aim = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
    const emit = (
      angle: number,
      speed: number,
      glyph: string,
      offset = 0,
      motion?: Shot['bossMotion'],
    ) => {
      this.shots.push({
        x: boss.x - Math.sin(aim) * offset,
        y: boss.y + Math.cos(aim) * offset,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 6,
        damage: 17 + Math.min(this.round, 8),
        enemy: true,
        hits: [],
        pierce: 1,
        color: spec.color,
        glyph,
        bossSkin: id,
        bossMotion: motion,
        age: 0,
        baseAngle: angle,
        baseSpeed: speed,
      });
    };
    if (id === 'coder') {
      for (let i = -3; i <= 3; i++)
        if (i !== (n % 2 ? -1 : 1))
          emit(aim + i * 0.2, 170, ['That’s', 'pity', '404'][(i + 3) % 3]);
    } else if (id === 'snake') {
      for (let i = 0; i < 10; i++)
        emit((i * Math.PI) / 5 + n * 0.22, 155, '蛇', 0, 'serpent');
    } else if (id === 'goosequeue') {
      for (let i = -3; i <= 3; i++)
        if (i !== (n % 2 ? -1 : 1))
          emit(aim + i * 0.18, 150 + Math.abs(i) * 18, `${996 + i}号`, i * 8);
    } else if (id === 'bike') {
      for (const lane of [-1, 1])
        for (let i = 0; i < 3; i++)
          emit(
            aim + (n % 2 ? 1 : -1) * 0.12,
            185 + i * 28,
            '铃',
            lane * (34 + i * 9),
            'wheel',
          );
    } else if (id === 'weishen') {
      for (let axis = 0; axis < 4; axis++)
        for (const side of [-1, 1])
          emit(
            n * 0.3 + (axis * Math.PI) / 2 + side * 0.13,
            160,
            axis % 2 ? '∫' : '显然',
          );
      for (const side of [-1, 1]) emit(aim + side * 0.4, 125, '馒头');
    } else if (id === 'swim') {
      for (let i = -4; i <= 4; i++)
        if (i !== (n % 2 ? -1 : 1))
          emit(aim + i * 0.17, 140 + (4 - Math.abs(i)) * 15, '50m', i * 14);
    } else if (id === 'hotsearch') {
      for (let i = -3; i <= 3; i++)
        if (i !== (n % 2 ? -1 : 1))
          emit(aim + i * 0.21, 165, i % 2 ? '热搜' : '锉');
    } else {
      for (let i = 0; i < 16; i++) {
        if (i === n % 16) continue;
        emit((i * Math.PI) / 8, 155, ['德', '智', '体', '美'][i % 4]);
      }
    }
  }

  checkKills() {
    const dead = this.enemies.filter((e) => e.hp <= 0);
    if (!dead.length) return;
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    for (const e of dead) {
      this.kills++;
      this.combo++;
      this.comboTime = 3.5;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.chargeSkill(4);
      this.effect(
        e.x,
        e.y,
        'burst',
        this.skillTime > 0 ? '#ff94d5' : '#edffc0',
        50 + e.r,
        0.35,
      );
      if (this.combo % 10 === 0) {
        this.events.push('combo');
        this.effect(
          this.player.x,
          this.player.y - 75,
          'text',
          '#ffe194',
          0,
          1,
          `${this.combo} 连破！`,
        );
        this.shake = Math.max(this.shake, 4);
      }
      this.effect(
        e.x,
        e.y,
        'ring',
        e.kind === 'boss' ? '#fdf4a5' : '#c8f29b',
        e.r * 2,
        0.4,
      );
      for (let j = 0; j < 5; j++)
        this.effect(e.x, e.y, 'spark', '#eddeb7', 3, 0.5);
      if (e.kind === 'boss') {
        this.completeBoss(e.x, e.y);
      } else {
        if (e.credit) {
          this.credits += e.credit;
          this.effect(e.x, e.y - 35, 'text', '#d5ffa1', 0, 1.2, '补修 +1 学分');
        }
        if (
          this.badgeDropCooldown <= 0 &&
          this.rng() < (e.kind === 'clock' ? 0.4 : 0.22)
        ) {
          this.spawnDrop(e.x, e.y);
          this.badgeDropCooldown = 0.75;
        }
      }
    }
  }
  evaluateQuest() {
    if (this.questDone) return;
    if (this.questProgress >= this.quest.target) {
      this.questDone = true;
      this.passed++;
      this.credits += 2;
      const healed = this.heal(12);
      this.events.push('credit');
      this.notify(
        healed
          ? '作业已提交！+2 学分 · 生命恢复'
          : '作业已提交！+2 学分 · 圈尽后仅合成回血',
        4,
      );
      this.effect(
        this.player.x,
        this.player.y - 50,
        'text',
        '#e8ffb8',
        0,
        1.4,
        '提交成功 +2 学分',
      );
      this.spawnDrop(
        this.player.x + 65,
        this.player.y,
        Math.max(0, this.highest - 1),
      );
    }
  }
  advanceQuest() {
    if (!this.questDone) {
      this.failed++;
      this.spawnEnemy('clock', 1);
      this.spawnEnemy('clock', 1);
      this.notify('DDL 已过！追债闹钟出动，击败它们可补修学分', 6);
      this.broadcast = '“已读不交？那我亲自过来。”';
      this.events.push('alarm');
    }
    this.questIndex++;
    this.questDone = false;
    this.questBase = {
      kills: this.kills,
      merges: this.merges,
      collected: this.collected,
    };
  }
  finish(won: boolean, reason = '') {
    if (this.mode !== 'playing') return;
    if (
      won &&
      (this.highest < 14 || this.bossesDefeated !== BOSS_LEVELS.length)
    )
      return;
    this.mode = won ? 'won' : 'lost';
    this.endReason = reason;
    this.endingTime = 0;
    this.bannerTime = 0;
    this.effect(
      this.player.x,
      this.player.y,
      'ring',
      won ? '#e6ce8b' : '#ee729c',
      560,
      2.3,
    );
    if (won)
      this.effect(this.player.x, this.player.y, 'burst', '#ddc9ff', 330, 1.8);
    this.events.push(won ? 'win' : 'lose');
    this.exam = null;
    this.hazards = [];
    this.wallX = null;
    this.skillTime = 0;
    this.dashTime = 0;
  }
  update(dt: number, moveX: number, moveY: number) {
    if (
      (this.mode === 'won' || this.mode === 'lost') &&
      Number.isFinite(dt) &&
      dt > 0
    ) {
      const step = Math.min(dt, 0.05);
      this.endingTime = Math.min(ENDING_SECONDS, this.endingTime + dt);
      this.shake = Math.max(0, this.shake - step * 26);
      this.flash = Math.max(0, this.flash - step);
      for (const shot of this.shots) {
        shot.x += shot.vx * step * 0.15;
        shot.y += shot.vy * step * 0.15;
        shot.life -= step;
      }
      this.shots = this.shots.filter((s) => s.life > 0);
      for (const fx of this.fx) {
        fx.life -= step;
        fx.x += fx.vx * step;
        fx.y += fx.vy * step;
      }
      this.fx = this.fx.filter((fx) => fx.life > 0);
      return;
    }
    if (this.mode !== 'playing' || this.orientationBlocked) return;
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.time += dt; // Active elapsed time includes hit-stop and slow frames, but never pause.
    dt = Math.min(dt, 0.05);
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      return;
    }
    this.bossRest = Math.max(0, this.bossRest - dt);
    if (!this.bossSpawned) this.waveTime += dt;
    this.badgeDropCooldown = Math.max(0, this.badgeDropCooldown - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.bannerTime = Math.max(0, this.bannerTime - dt);
    this.comboTime = Math.max(0, this.comboTime - dt);
    if (this.comboTime === 0) this.combo = 0;
    this.feastTime = Math.max(0, this.feastTime - dt);
    this.skillTime = Math.max(0, this.skillTime - dt);
    this.supplyArrivalTime = Math.max(0, this.supplyArrivalTime - dt);
    this.foodClock -= dt;
    if (this.foodClock <= 0) this.throwSupplies();
    this.noticeTime -= dt;
    if (this.noticeTime <= 0) this.notice = '';
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashTime = Math.max(0, this.dashTime - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.dormCooldown = Math.max(0, this.dormCooldown - dt);
    this.shake = Math.max(0, this.shake - dt * 26);
    const len = Math.hypot(moveX, moveY);
    if (len > 0) {
      this.player.dx = moveX / len;
      this.player.dy = moveY / len;
      if (len > 1) {
        moveX /= len;
        moveY /= len;
      }
    }
    if (this.dashTime > 0) {
      moveX = this.player.dx;
      moveY = this.player.dy;
    }
    const speed =
      this.dashTime > 0
        ? 530
        : this.skillTime > 0 && this.department.kind === 'rush'
          ? 340
          : 215;
    const prev = { x: this.player.x, y: this.player.y };
    this.player.x = clamp(
      this.player.x + moveX * speed * dt,
      55,
      this.world.width - 55,
    );
    this.player.y = clamp(
      this.player.y + moveY * speed * dt,
      65,
      this.world.height - 65,
    );
    if (
      this.world === WORLD &&
      (this.player.x < 170 || this.player.x > 1030) &&
      (this.player.y < 145 || this.player.y > 690)
    ) {
      this.player.x = prev.x;
      this.player.y = prev.y;
    }
    if (this.dashTime > 0) {
      this.effect(this.player.x, this.player.y, 'trail', '#83edff', 26, 0.32);
      const dx = this.player.x - prev.x,
        dy = this.player.y - prev.y;
      for (const e of this.enemies) {
        const along = clamp(
          ((e.x - prev.x) * dx + (e.y - prev.y) * dy) /
            (dx * dx + dy * dy || 1),
          0,
          1,
        );
        if (
          !this.bikeHits.has(e.id) &&
          distance(e, { x: prev.x + dx * along, y: prev.y + dy * along }) <
            e.r + 38
        ) {
          this.bikeHits.add(e.id);
          e.hp -= 55 + 24 * this.power;
          e.hit = 0.25;
          this.effect(e.x, e.y, 'burst', '#91edff', 95, 0.4);
          this.effect(e.x, e.y - 28, 'text', '#c4faff', 0, 0.7, '车神碾压');
          this.shake = 5;
          this.events.push('impact');
        }
      }
      this.checkKills();
      if (this.mode !== 'playing') return;
    }
    if (this.skillTime > 0) {
      const d = this.department;
      this.skillPulse -= dt;
      if (this.skillPulse <= 0) {
        this.skillPulse =
          d.kind === 'rain' ? 0.65 : d.kind === 'storm' ? 0.4 : 0.22;
        const zones = this.skillZones;
        if (d.kind === 'drones') {
          for (const z of zones) {
            const target = this.enemies
              .filter((e) => distance(e, z) < 530)
              .sort((a, b) => distance(a, z) - distance(b, z))[0];
            if (!target) continue;
            const a = Math.atan2(target.y - z.y, target.x - z.x);
            this.shots.push({
              x: z.x,
              y: z.y,
              vx: Math.cos(a) * 400,
              vy: Math.sin(a) * 400,
              life: 1.4,
              damage: d.damage * this.power,
              enemy: false,
              hits: [],
              pierce: 1,
              color: d.color,
              glyph: d.glyph,
              pattern: 'homing',
              major: 'cs',
              age: 0,
              baseSpeed: 400,
            });
          }
        } else {
          for (const e of this.enemies)
            if (zones.some((z) => skillHits(z, e))) {
              const multiplier =
                d.kind === 'execute' && e.hp / e.maxHp < 0.3
                  ? 2.7
                  : d.kind === 'rain'
                    ? 2.8
                    : d.kind === 'storm'
                      ? 1.8
                      : d.kind === 'gravity' && distance(e, this.player) < 90
                        ? 1.8
                        : 1;
              e.hp -= d.damage * this.power * multiplier;
              e.hit = 0.2;
              if (d.kind === 'rain' || d.kind === 'storm')
                this.effect(
                  e.x,
                  e.y,
                  'burst',
                  d.color,
                  d.kind === 'rain' ? 55 : 30,
                  0.25,
                );
            }
        }
        if (d.kind === 'heal') this.heal(1.2);
        this.checkKills();
        if (this.mode !== 'playing') return;
      }
      if (d.kind === 'guard')
        for (const s of this.shots)
          if (s.enemy && distance(s, this.player) < 145) {
            s.enemy = false;
            s.vx *= -1.5;
            s.vy *= -1.5;
            s.damage *= 2;
            s.color = d.color;
            s.glyph = d.glyph;
            s.life = 1.2;
            this.effect(s.x, s.y, 'ring', d.color, 25, 0.2);
          }
    }

    if (
      distance(this.player, { x: 145, y: 630 }) < 54 &&
      this.dormCooldown === 0
    ) {
      this.invulnerable = 3;
      this.dormCooldown = 35;
      this.notify('宿舍结界：3 秒无敌，DDL 暂时进不来');
      this.effect(this.player.x, this.player.y, 'ring', '#b6b5ff', 75);
    }
    this.supportCooldown -= dt;
    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0) {
      this.shoot();
      this.attackCooldown =
        (this.major === 'cs' ? 0.25 : 0.36) *
        (this.dashTime > 0 || this.feastTime > 0 ? 0.5 : 1);
    }
    if (this.major === 'arch') {
      for (const e of this.enemies)
        if (distance(e, this.player) < 112) {
          e.hp -= dt * 13 * this.power;
          e.hit = 0.02;
        }
    }
    this.spawnClock -= dt;
    if (this.spawnClock <= 0 && this.enemies.length < 65) {
      const count = this.phase === 2 ? 1 : Math.min(4, 1 + this.round);
      for (let i = 0; i < count; i++)
        this.spawnEnemy(
          this.round > 1 && this.rng() < 0.15 ? 'clock' : 'paper',
          0,
        );
      this.spawnClock =
        this.phase === 2 ? 2.8 : Math.max(0.75, 1.55 - this.round * 0.1);
    }
    this.bonusSpawn -= dt;
    if (this.bonusSpawn <= 0) {
      if (this.drops.filter((d) => d.kind === 'badge').length < 3)
        this.spawnDrop(
          clamp(this.player.x + 100, 100, this.world.width - 100),
          clamp(this.player.y + 70, 110, this.world.height - 110),
        );
      this.bonusSpawn = 10;
    }
    for (const e of this.enemies) {
      const d = distance(e, this.player) || 1;
      let speed = e.speed;
      if (this.major === 'arch' && d < 120) speed *= 0.42;
      if (this.skillTime > 0 && d < this.department.range) {
        if (this.department.kind === 'frost')
          speed *= e.kind === 'boss' ? 0.55 : 0.08;
        if (this.department.kind === 'gravity')
          speed += e.kind === 'boss' ? 25 : 170;
      }
      e.x += ((this.player.x - e.x) / d) * speed * dt;
      e.y += ((this.player.y - e.y) / d) * speed * dt;
      e.hit = Math.max(0, e.hit - dt);
      if (d < e.r + 17) this.damage(e.damage);
      if (e.kind !== 'boss' && e.year >= 3 && d < 390) {
        e.attackClock -= dt;
        if (e.attackClock <= 0) {
          const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
          for (let i = 0; i < (e.year === 4 ? 3 : 1); i++) {
            const a = angle + (e.year === 4 ? (i - 1) * 0.22 : 0);
            this.shots.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(a) * 145,
              vy: Math.sin(a) * 145,
              life: 2.5,
              damage: e.damage,
              enemy: true,
              hits: [],
              pierce: 1,
              color: '#ff758d',
              glyph: e.year === 4 ? '毕' : '考',
            });
          }
          e.attackClock = e.year === 4 ? 5.8 : 7.2;
        }
      }
    }
    if (this.mode !== 'playing') return;
    // Lightweight separation avoids enemies stacking into an unreadable blob.
    for (let i = 0; i < this.enemies.length; i++)
      for (let j = i + 1; j < this.enemies.length; j++) {
        const a = this.enemies[i],
          b = this.enemies[j],
          d = distance(a, b),
          r = (a.r + b.r) * 0.8;
        if (d > 0 && d < r) {
          const f = ((r - d) / d) * 0.2,
            dx = (a.x - b.x) * f,
            dy = (a.y - b.y) * f;
          a.x += dx;
          a.y += dy;
          b.x -= dx;
          b.y -= dy;
        }
      }
    this.enemyGrid.rebuild(this.enemies);
    const collisionRadius = Math.max(8, ...this.enemies.map((e) => e.r + 8));
    const children: Shot[] = [];
    for (const s of this.shots) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.age = (s.age || 0) + dt;
      if (s.enemy && s.bossMotion) {
        const base = s.baseAngle || 0,
          speed = s.baseSpeed || 165;
        const angle =
          base +
          (s.bossMotion === 'serpent'
            ? Math.sin(s.age * 8) * 0.32
            : Math.sin(s.age * 2) * 0.19);
        s.vx = Math.cos(angle) * speed;
        s.vy = Math.sin(angle) * speed;
      }
      if (!s.enemy && s.pattern === 'wave') {
        const a = (s.baseAngle || 0) + Math.sin(s.age * 18) * 0.38;
        s.vx = Math.cos(a) * (s.baseSpeed || 500);
        s.vy = Math.sin(a) * (s.baseSpeed || 500);
      }
      if (!s.enemy && s.pattern === 'return' && s.age > 0.55) {
        const target = this.player,
          a = Math.atan2(target.y - s.y, target.x - s.x);
        s.vx = Math.cos(a) * 460;
        s.vy = Math.sin(a) * 460;
        if (distance(s, target) < 16) s.life = 0;
      }
      if (!s.enemy && (s.major === 'cs' || s.pattern === 'homing')) {
        const target = this.enemyGrid
          .query(s.x, s.y, 150)
          .find((e) => !s.hits.includes(e.id) && distance(s, e) < 150);
        if (target) {
          const angle = Math.atan2(target.y - s.y, target.x - s.x);
          s.vx += (Math.cos(angle) * 500 - s.vx) * dt * 4;
          s.vy += (Math.sin(angle) * 500 - s.vy) * dt * 4;
        }
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.enemy) {
        if (distance(s, this.player) < 22) {
          this.damage(s.damage);
          s.life = 0;
        }
      } else
        for (const e of this.enemyGrid.query(s.x, s.y, collisionRadius)) {
          if (s.life <= 0) break;
          if (!s.hits.includes(e.id) && distance(s, e) < e.r + 8) {
            e.hp -= s.damage;
            e.hit = 0.12;
            s.hits.push(e.id);
            this.effect(s.x, s.y, 'spark', s.color || '#e6fbbc', 4, 0.22);
            if (s.pattern === 'chain') {
              const links = this.enemies
                .filter((o) => o.id !== e.id && distance(e, o) < 150)
                .sort((a, b) => distance(a, e) - distance(b, e))
                .slice(0, 2);
              let previous = e;
              for (const other of links) {
                other.hp -= s.damage * 0.65;
                other.hit = 0.2;
                for (let j = 0; j <= 5; j++)
                  this.effect(
                    previous.x + ((other.x - previous.x) * j) / 5,
                    previous.y + ((other.y - previous.y) * j) / 5,
                    'spark',
                    s.color || '#aaffff',
                    4,
                    0.25,
                  );
                previous = other;
              }
            }
            if (s.pattern === 'split' && !s.split) {
              for (const delta of [-0.5, 0.5]) {
                const angle = Math.atan2(s.vy, s.vx) + delta;
                children.push({
                  ...s,
                  x: e.x,
                  y: e.y,
                  vx: Math.cos(angle) * 440,
                  vy: Math.sin(angle) * 440,
                  damage: s.damage * 0.45,
                  life: 0.65,
                  age: 0,
                  split: true,
                  hits: [e.id],
                  pierce: 2,
                  pattern: 'lance',
                });
              }
              s.split = true;
            }
            if (s.splash) {
              this.effect(e.x, e.y, 'burst', '#ffc67b', s.splash, 0.25);
              for (const other of this.enemies)
                if (other.id !== e.id && distance(e, other) < s.splash) {
                  other.hp -= s.damage * 0.3;
                  other.hit = 0.12;
                }
            }
            if (s.hits.length >= s.pierce) s.life = 0;
          }
        }
    }
    if (this.mode !== 'playing') return;
    this.shots.push(...children);
    this.shots = this.shots.filter(
      (s) =>
        s.life > 0 &&
        s.x > -30 &&
        s.x < this.world.width + 30 &&
        s.y > -30 &&
        s.y < this.world.height + 30,
    );
    for (const d of this.drops) {
      if (this.mode !== 'playing') return;
      d.age += dt;
      const previous = { x: d.x, y: d.y };
      if (d.flight) {
        const f = d.flight,
          progress = Math.min(1, d.age / f.duration);
        d.x = f.startX + (f.endX - f.startX) * progress;
        d.y =
          f.startY +
          (f.endY - f.startY) * progress +
          Math.sin(progress * Math.PI * 2) * f.bend;
      } else {
        d.x = clamp(d.x + d.vx * dt, 70, this.world.width - 70);
        d.y = clamp(d.y + d.vy * dt, 80, this.world.height - 80);
        d.vx *= Math.exp(-dt * 5);
        d.vy *= Math.exp(-dt * 5);
      }
      let dist = distance(d, this.player);
      if (d.flight) {
        // Swept pickup collision remains reliable for fast-moving supply items.
        const dx = d.x - previous.x,
          dy = d.y - previous.y;
        const t = clamp(
          ((this.player.x - previous.x) * dx +
            (this.player.y - previous.y) * dy) /
            (dx * dx + dy * dy || 1),
          0,
          1,
        );
        dist = distance(this.player, {
          x: previous.x + dx * t,
          y: previous.y + dy * t,
        });
      }
      if (!d.flight && dist < 70 && this.inventory.length < 5) {
        d.x += (this.player.x - d.x) * dt * 7;
        d.y += (this.player.y - d.y) * dt * 7;
      }
      if (dist < 29 && d.age > 0.25) {
        if (d.kind === 'goose' || d.kind === 'duck') {
          d.age = 999;
          this.eatFood(d.kind);
          if (this.mode !== 'playing') return;
        } else if (d.kind === 'heal') {
          const healed = this.heal(8);
          d.age = 999;
          this.effect(
            this.player.x,
            this.player.y - 30,
            'text',
            '#a4f3c3',
            0,
            0.8,
            healed ? '+8' : '仅合成可回血',
          );
        } else if (this.inventory.length < 5) {
          this.inventory.push(d.level);
          this.collected++;
          d.age = 999;
          this.events.push('pickup');
          if (this.canMerge)
            this.notify('相同院徽已就位 · 按 E 合成，释放冲击波', 2.5);
        } else {
          const same = this.inventory.indexOf(d.level);
          if (same >= 0 && d.level < this.chain.length - 1) {
            this.inventory[same]++;
            this.collected++;
            d.age = 999;
            this.onMerge(d.level + 1, this.player.x, this.player.y);
          } else {
            const lowest = Math.min(...this.inventory);
            if (!this.canMerge && d.level > lowest) {
              const idx = this.inventory.indexOf(lowest);
              this.inventory[idx] = d.level;
              this.collected++;
              d.level = lowest;
              d.age = 0;
              d.x += this.player.dx * 45;
              d.y += this.player.dy * 45;
              this.notify('换上更高阶院徽，低阶徽章留在地面', 2);
            } else {
              const nd = Math.max(dist, 1);
              d.vx = ((d.x - this.player.x) / nd) * 190;
              d.vy = ((d.y - this.player.y) / nd) * 190;
            }
          }
        }
      }
    }
    this.drops = this.drops.filter((d) =>
      d.flight ? d.age < d.flight.duration : d.age < BADGE_LIFETIME,
    );
    // Only player inventory merges advance the challenge; unattended drops never evolve.
    this.checkKills();
    if (this.mode !== 'playing') return;
    this.evaluateQuest();
    while (this.time >= (this.questIndex + 1) * 35) this.advanceQuest();
    if (!this.bossSpawned && this.waveTime >= 25) {
      const t = (this.waveTime - 25) % 34;
      this.wallWarn = t < 2;
      this.wallX = t < 2 ? 60 : t < 15 ? 60 + (t - 2) * 83 : null;
      const cycle = this.round;
      if (cycle !== this.wallCycle) {
        this.wallCycle = cycle;
        this.notify('DDL 扫描墙来了！看准时机，空格冲过去', 5);
        this.broadcast = '“截止时间不会因为你没写完而改变。”';
        this.events.push('alarm');
      }
      if (
        !this.wallWarn &&
        this.wallX !== null &&
        Math.abs(this.player.x - this.wallX) < 17
      )
        this.damage(14);
    } else {
      this.wallX = null;
      this.wallWarn = false;
    }
    if (this.mode !== 'playing') return;
    if (
      !this.bossSpawned &&
      this.bossRest <= 0 &&
      this.nextBossLevel !== null &&
      this.highest >= this.nextBossLevel
    )
      this.beginBoss();
    const boss = this.enemies.find((e) => e.kind === 'boss');
    if (boss) {
      this.bossAttack -= dt;
      if (this.bossAttack <= 0) {
        this.castBoss(boss);
        this.bossVolley(boss);
        this.bossAttack = this.bossAttackInterval(boss);
      }
    }
    for (const h of this.hazards) {
      const old = h.age;
      h.age += dt;
      if (hazardHits(h, this.player)) this.damage(h.damage);
      if (
        boss?.boss === 'bike' &&
        h.label === '车王冲刺终点' &&
        old < h.warn &&
        h.age >= h.warn
      ) {
        boss.x = h.x;
        boss.y = h.y;
        this.effect(h.x, h.y, 'burst', h.color, 110, 0.4);
      }
      if (this.mode !== 'playing') return;
    }
    this.hazards = this.hazards.filter((h) => h.age < h.warn + h.duration);
    if (this.year !== this.lastYear) {
      this.lastYear = this.year;
      this.notify(`${YEAR_NAMES[this.year]}开学！教材伤害与血量升级`, 4);
    }
    if (this.exam) {
      const exam = this.exam;
      exam.time -= dt;
      if (
        exam.time < 0.5 &&
        (Math.abs(this.player.x - exam.x) < 24 ||
          Math.abs(this.player.y - exam.y) < 24)
      )
        this.damage(18);
      if (exam.time <= 0) this.exam = null;
    }
    for (const f of this.fx) {
      f.life -= dt;
      if (f.kind === 'spark') {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      } else if (f.kind === 'text') f.y -= dt * 27;
    }
    this.fx = this.fx.filter((f) => f.life > 0).slice(-250);
  }
  snapshot(): Snapshot {
    const boss = this.enemies.find((e) => e.kind === 'boss');
    return {
      mode: this.mode,
      endProgress: this.endingTime / ENDING_SECONDS,
      hp: this.hp,
      credits: this.credits,
      kills: this.kills,
      time: this.time,
      phase: this.phase,
      broadcast: this.broadcast,
      questTitle: this.quest.title,
      questText: this.questDone
        ? '已提交 +2 学分'
        : `${this.quest.label} ${Math.min(this.questProgress, this.quest.target)}/${this.quest.target}`,
      questRemaining: Math.max(0, (this.questIndex + 1) * 35 - this.time),
      bossHp: boss ? (boss.hp / boss.maxHp) * 100 : 0,
      notice: this.notice,
      inventory: [...this.inventory],
      chain: this.chain,
      canMerge: this.canMerge,
      dashCooldown: this.dashCooldown,
      hurtTime: Math.max(0, this.hurtUntil - this.time),
      merges: this.merges,
      gpa: Math.min(
        4,
        Math.max(
          0,
          (this.passed / Math.max(1, this.passed + this.failed)) * 2.7 +
            (this.bossDead ? 1 : 0) +
            (this.hp / 100) * 0.3,
        ),
      ),
      endReason: this.endReason,
      skillCharge: this.skillCharge,
      skillTime: this.skillTime,
      combo: this.combo,
      bestCombo: this.bestCombo,
      weaponTier: this.weaponTier,
      feastTime: this.feastTime,
      round: this.round,
      bossesDefeated: this.bossesDefeated,
      mergeProgress: mergePercent(this.highest),
      nextBossProgress: mergePercent(this.nextBossLevel ?? 14),
      totalBosses: BOSS_LEVELS.length,
      orientationBlocked: this.orientationBlocked,
      forgedAt: this.forgedAt,
      year: this.year,
      bossName: boss?.boss ? bossSpec(boss.boss).name : '',
      bossTip: boss?.boss ? bossSpec(boss.boss).tip : '',
      mainWeapon: this.mainWeapon,
      skillName: this.department.skill,
      departmentName: this.department.name,
    };
  }
}
