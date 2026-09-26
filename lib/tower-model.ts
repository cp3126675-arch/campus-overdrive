// 塔防模式模拟：独立于竞速 / 期末周，复用引擎的循环、画布与音效。
// 玩法：
//  - 抽取 13 个专业 + 玩家所选专业 + 清华大学，构成 15 级合成链（等级 1..15）。
//  - 4×4 的 2048 格子里合成专业；长按把选中方块拖到地图：防御点建塔、道路放阻挡、进攻对象/六教用 11 级及以上或清华修复。
//  - 学生从五个园按时间阶段刷新，沿道路前往六教；途中攻击防御塔、阻挡块与进攻对象。
//  - 进攻对象被摧毁会爆炸清场；全部被摧毁则失败。六教首次被攻破爆炸后可被清华修复，再次被攻破则游戏结束。

import {
  DEPARTMENTS,
  department,
  type SkillKind,
} from './departments';
import {
  CELLS,
  GRID_COLS,
  GRID_ROWS,
  DESTINATION,
  SPAWNS,
  TARGETS,
  buildFlowField,
  type TowerCell,
  type SpawnPoint,
} from './tower-map';

export type Mode = 'menu' | 'playing' | 'paused' | 'won' | 'lost';

export interface ChainEntry {
  id: string;
  key: string;
  name: string;
  color: string;
}

/** 学生 Boss 种类：码农出击 / 鹅腿阿姨 / 菌液拉练。 */
export type BossKind = 'coder' | 'ayi' | 'line';

export interface Student {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  garden: string;
  hitFlash: number;
  boss?: BossKind;
  /** 固有攻击力倍率（Boss 更高），普通学生为 1。 */
  atkBase: number;
  /** 鹅腿阿姨增益 / 减损带来的攻击力倍率，默认 1。 */
  auraMul: number;
  /** 增益 / 减损的失效时刻（游戏秒）；0 表示无效果。 */
  auraUntil: number;
  /** 码农出击：下一次释放「That's pity」光波的倒计时。 */
  waveTimer: number;
  /** 鹅腿阿姨：下一次释放食堂光环的倒计时。 */
  auraTimer: number;
  /** 鹅腿阿姨：本个体给的是增益（true）还是减损（false）。 */
  blessed: boolean;
  /** 菌液拉练：所属队列的队首 id；0 表示不属于队列。 */
  lineLeadId: number;
  /** 菌液拉练：是否为队首（歼灭队首即整排全灭）。 */
  lineLead: boolean;
  /** 码农出击：已释放的光波次数（上限 CODER_MAX_WAVES）。 */
  wavesCast: number;
  /** 鹅腿阿姨：已释放的光环次数（上限 AYI_MAX_AURAS）。 */
  aurasCast: number;
  /** 卡死看门狗：无攻击目标时在同一格连续停留的秒数。 */
  stuckTimer: number;
  /** 卡死看门狗：上一个所在格的键。 */
  lastCellKey: string;
}

export type EffectKind = 'beam' | 'spark' | 'explosion' | 'wave' | 'aura';

export interface Effect {
  kind: EffectKind;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  color: string;
  life: number;
  maxLife: number;
  r?: number;
  /** 波面上的闪动文字（如「That's pity」）。 */
  text?: string;
}

/** 学生在画布上的代表色：Boss 各有标识色，增益 / 减损会改变普通学生的颜色。 */
export function studentColor(s: Student): string {
  if (s.boss === 'line') return '#4be07a';
  if (s.boss === 'coder') return '#7fd4ff';
  if (s.boss === 'ayi') return s.blessed ? '#6be08a' : '#8a93a8';
  if (s.auraMul > 1) return '#ffa93d';
  if (s.auraMul < 1) return '#8a93a8';
  return '#ff5d6c';
}

export interface Tower {
  id: number;
  col: number;
  row: number;
  level: number;
  key: string;
  name: string;
  kind: SkillKind;
  hp: number;
  maxHp: number;
  cooldown: number;
  hitFlash: number;
  /** 被码农光波命中后的停机截止时刻（游戏秒）；time < disabledUntil 时不工作。 */
  disabledUntil: number;
}

export interface Blocker {
  id: number;
  col: number;
  row: number;
  level: number;
  hp: number;
  maxHp: number;
  hitFlash: number;
}

export interface Target {
  name: string;
  col: number;
  row: number;
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface Destination {
  col: number;
  row: number;
  hp: number;
  maxHp: number;
  secondHp: number;
  breached: boolean;
  alive: boolean;
  repairable: boolean;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  color: string;
  life: number;
  targetId: number;
}

export interface TowerSnapshot {
  mode: Mode;
  time: number;
  kills: number;
  merges: number;
  grid: number[][];
  chain: ChainEntry[];
  targets: { name: string; hp: number; maxHp: number; alive: boolean; col: number; row: number }[];
  destination: {
    hp: number;
    maxHp: number;
    breached: boolean;
    repairable: boolean;
    alive: boolean;
  };
  towers: {
    col: number;
    row: number;
    level: number;
    key: string;
    name: string;
    hp: number;
    maxHp: number;
    disabled: boolean;
  }[];
  blockers: { col: number; row: number; level: number; hp: number; maxHp: number }[];
  activeGardens: string[];
  spawnPhase: number;
  notice: string;
  endReason: string;
  effects: Effect[];
  bosses: number;
  bossCounts: Record<BossKind, number>;
  lastMove: '' | 'up' | 'down' | 'left' | 'right';
  moveSeq: number;
  mergeCells: number[];
  spawnCell: number;
}

// 世界以“格”为单位，每格 CELL 像素。
export const CELL = 40;
export const WORLD_W = GRID_COLS * CELL;
export const WORLD_H = GRID_ROWS * CELL;

const QINGHUA: ChainEntry = {
  id: 'qinghua',
  key: 'qinghua',
  name: '清华大学',
  color: '#8b1a1a',
};

const REPAIR_LEVEL = 11; // 修复进攻对象所需的最低等级
const STUDENT_ATK = 6; // 学生对结构的每秒伤害
const STUDENT_RANGE = 46; // 攻击范围（约相邻一格）
const STUDENT_BREACH_R = 240; // 路被完全封死时，主动寻敌强拆的半径（像素）
const STUDENT_SPEED = 38;
const STUDENT_HP_BASE = 34;
const STUDENT_HP_STEP = 5.5; // 每 12 秒增加的血量
const BOSS_ATK_MUL = 2.2; // 单体 Boss 对结构的伤害倍率（码农 / 鹅腿阿姨）
const BOSS_GAP = 24; // Boss 之间的平均间隔（秒），随时间略微缩短
// Boss 解锁时间刻意压在中局：真机体验里一局常在一两分钟内分出胜负，
// 若放到 100 秒后，后两种 Boss 会几乎见不到（等于废内容）。
// —— 码农出击：释放「That's pity」光波，命中防御塔使其停机 ——
const CODER_FROM = 60;
const CODER_HP_MUL = 4.2;
const CODER_SPEED = 46;
const CODER_WAVE_INTERVAL = 4.6; // 光波间隔（秒）
const CODER_WAVE_R = 132; // 光波半径（像素）
const CODER_DISABLE_MIN = 3; // 命中后停机 3~5 秒（随机）
const CODER_DISABLE_MAX = 5;
const CODER_MAX_WAVES = 5; // 光波最多释放 5 次，防止码农蹲在刷新点无限放电
// —— 鹅腿阿姨：生成时 60% 增益 / 40% 减损周围学生攻击力 ——
const AYI_FROM = 90;
const AYI_HP_MUL = 6;
const AYI_SPEED = 36;
const AYI_AURA_INTERVAL = 2.4; // 光环间隔（秒）
const AYI_AURA_R = 150; // 光环半径（像素）
const AYI_BUFF_CHANCE = 0.6; // 60% 增益、40% 减损
const AYI_BUFF_MUL = 1.9;
const AYI_DEBUFF_MUL = 0.5;
const AYI_AURA_LIFE = 4.5; // 增益 / 减损持续时间（秒）
const AYI_MAX_AURAS = 3; // 光环最多释放 3 次，随后打烊自爆
const STUCK_CELL_SECONDS = 10; // 无攻击目标且在同一格停留超过该时长 → 自爆清场
// —— 菌液拉练：一排高速高攻学生，歼灭队首即整排全灭 ——
const LINE_FROM = 115;
export const LINE_COUNT = 6; // 菌液拉练一排的数量
const LINE_HP_MUL = 2.6;
const LINE_SPEED = 104; // 高速
const LINE_ATK_MUL = 2.4; // 高攻
const LINE_GAP = 26; // 队列间距（像素）
const EFFECT_CAP = 260; // 特效实例上限，避免无限增长
const TARGET_EXPLODE_R = 92;
const TARGET_EXPLODE_DMG = 150;
const LIUJIAO_EXPLODE_R = 140;
const LIUJIAO_EXPLODE_DMG = 260;
const LIUJIAO_FIRST_MAX = 1400;
const LIUJIAO_SECOND_MAX = 700;
const TARGET_MAX = 900;

const TOWER_BASE_DMG = 9;
const TOWER_DMG_PER_LEVEL = 5.2;
const TOWER_FIRE_BASE = 0.7;
const TOWER_FIRE_MIN = 0.24;
const TOWER_RANGE_BASE = 104;
const TOWER_RANGE_PER_LEVEL = 3;
const TOWER_HP_BASE = 220;
const TOWER_HP_PER_LEVEL = 48;
const TOWER_PROJECTILE_SPEED = 360;

const BLOCKER_HP_BASE = 90;
const BLOCKER_HP_PER_LEVEL = 40;

const REPAIR_TARGET = 160;
const REPAIR_LIUJIAO = 260;

let nextId = 1;

/** 4×4 的空棋盘。 */
function blankGrid(): number[][] {
  return Array.from({ length: 4 }, () => [0, 0, 0, 0]);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class TowerModel {
  mode: Mode = 'menu';
  time = 0;
  kills = 0;
  merges = 0;
  chain: ChainEntry[] = [];
  grid: number[][] = blankGrid();
  /** 上一次移动中发生合成的格序号（行优先 0..15），供 UI 播放合成特效。 */
  mergeCells: number[] = [];
  /** 上一次移动后新生成方块的格序号；-1 表示没有。 */
  spawnCell = -1;
  students: Student[] = [];
  towers: Tower[] = [];
  blockers: Blocker[] = [];
  targets: Target[] = [];
  destination: Destination = {
    col: DESTINATION.col,
    row: DESTINATION.row,
    hp: LIUJIAO_FIRST_MAX,
    maxHp: LIUJIAO_FIRST_MAX,
    secondHp: LIUJIAO_SECOND_MAX,
    breached: false,
    alive: true,
    repairable: true,
  };
  projectiles: Projectile[] = [];
  effects: Effect[] = [];
  lastMove: '' | 'up' | 'down' | 'left' | 'right' = '';
  moveSeq = 0;
  notice = '';
  private noticeTime = 0;
  endReason = '';
  private flow: number[][] = [];
  private blocked = new Set<string>();
  private spawnTimer = 0;
  private bossTimer = 0;
  /** Boss 抽取袋：每轮把已解锁的种类各发一次，避免长期刷同一种。 */
  private bossBag: BossKind[] = [];

  constructor() {
    this.rebuildFlow();
  }

  // ---- 初始化 ----
  start(chosenId: string) {
    this.mode = 'playing';
    this.time = 0;
    this.kills = 0;
    this.merges = 0;
    this.students = [];
    this.towers = [];
    this.blockers = [];
    this.projectiles = [];
    this.effects = [];
    this.notice = '';
    this.endReason = '';
    this.spawnTimer = 0;
    this.bossTimer = BOSS_GAP;
    this.bossBag = [];
    this.blocked.clear();
    this.targets = TARGETS.map((t) => ({
      name: t.name,
      col: t.col,
      row: t.row,
      hp: TARGET_MAX,
      maxHp: TARGET_MAX,
      alive: true,
    }));
    this.destination = {
      col: DESTINATION.col,
      row: DESTINATION.row,
      hp: LIUJIAO_FIRST_MAX,
      maxHp: LIUJIAO_FIRST_MAX,
      secondHp: LIUJIAO_SECOND_MAX,
      breached: false,
      alive: true,
      repairable: true,
    };
    this.buildChain(chosenId);
    this.grid = blankGrid();
    this.mergeCells = [];
    this.spawnCell = -1;
    this.lastMove = '';
    this.moveSeq = 0;
    for (let i = 0; i < 4; i++) this.spawnTile();
    this.rebuildFlow();
  }

  private buildChain(chosenId: string) {
    const chosen = department(chosenId);
    // 等级 1..14 应各自对应一个学院 / 专业 logo，而 126 个专业只共享 29 张 badge，
    // 随机抽取会出现重名 logo；这里按 badge 去重抽取，保证每一级标识唯一。
    const used = new Set<string>([chosen.badge]);
    const pool: (typeof DEPARTMENTS)[number][] = [];
    for (const d of shuffle(DEPARTMENTS)) {
      if (d.id === chosenId || used.has(d.badge)) continue;
      used.add(d.badge);
      pool.push(d);
      if (pool.length >= 13) break;
    }
    this.chain = [
      ...[chosen, ...pool].map<ChainEntry>((d) => ({
        id: d.id,
        key: d.badge,
        name: d.name,
        color: d.color,
      })),
      QINGHUA,
    ];
  }

  toMenu() {
    this.mode = 'menu';
  }

  togglePause() {
    if (this.mode === 'playing') this.mode = 'paused';
    else if (this.mode === 'paused') this.mode = 'playing';
  }

  // ---- 2048 合成 ----
  private spawnLevel(): number {
    // 随时间解锁更高等级的初始方块：保证中后期能合出 11 级及以上（修复）与清华大学（15 级）。
    const t = this.time;
    const base = t < 45 ? 1 : t < 120 ? 2 : t < 210 ? 4 : t < 320 ? 6 : 8;
    const span = t < 45 ? 2 : t < 120 ? 3 : t < 210 ? 4 : t < 320 ? 5 : 6;
    return Math.max(1, Math.min(13, base + Math.floor(Math.random() * span)));
  }

  /** 在随机空格生成一个新方块，返回其格序号（行优先）；棋盘已满返回 -1。 */
  spawnTile(): number {
    const empties: [number, number][] = [];
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) if (this.grid[r][c] === 0) empties.push([r, c]);
    if (!empties.length) return -1;
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    this.grid[r][c] = this.spawnLevel();
    return r * 4 + c;
  }

  /** 滑动并合并，方向 dir 为 'up' | 'down' | 'left' | 'right'。 */
  move2048(dir: 'up' | 'down' | 'left' | 'right') {
    if (this.mode !== 'playing') return;
    const size = 4;
    const prev = this.grid.map((row) => [...row]);
    // 按方向把棋盘拆成 4 条线（每条线的第 0 个位置是滑动方向的最前端）。
    const lines: number[][] = [];
    const coords: [number, number][] = [];
    for (let k = 0; k < size; k++) {
      const line: number[] = [];
      for (let j = 0; j < size; j++) {
        let r: number;
        let c: number;
        if (dir === 'left') {
          r = k;
          c = j;
        } else if (dir === 'right') {
          r = k;
          c = size - 1 - j;
        } else if (dir === 'up') {
          r = j;
          c = k;
        } else {
          r = size - 1 - j;
          c = k;
        }
        line.push(this.grid[r][c]);
        coords.push([r, c]);
      }
      lines.push(line);
    }
    // 逐线合并（从前往后，相邻相等的合成升一级）
    const mergedCells: number[] = [];
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li].filter((v) => v > 0);
      const merged: number[] = [];
      for (let i = 0; i < line.length; i++) {
        if (i + 1 < line.length && line[i] === line[i + 1]) {
          const slot = merged.length;
          merged.push(Math.min(15, line[i] + 1));
          this.merges++;
          const [mr, mc] = coords[li * size + slot];
          mergedCells.push(mr * 4 + mc);
          i++;
        } else {
          merged.push(line[i]);
        }
      }
      while (merged.length < size) merged.push(0);
      for (let j = 0; j < size; j++) {
        const [r, c] = coords[li * size + j];
        this.grid[r][c] = merged[j];
      }
    }
    const changed = JSON.stringify(prev) !== JSON.stringify(this.grid);
    if (!changed) {
      this.mergeCells = [];
      this.spawnCell = -1;
      return;
    }
    this.lastMove = dir;
    this.moveSeq++;
    this.mergeCells = mergedCells;
    this.spawnCell = this.spawnTile();
  }

  // ---- 拖放：建塔 / 阻挡 / 修复 ----
  /** tileIndex 为 0..15 的格子序号（行优先）。 */
  dropTile(tileIndex: number, col: number, row: number): boolean {
    if (this.mode !== 'playing') return false;
    if (col < 0 || row < 0 || col >= GRID_COLS || row >= GRID_ROWS) return false;
    const tr = Math.floor(tileIndex / 4);
    const tc = tileIndex % 4;
    const level = this.grid[tr]?.[tc];
    if (!level) return false;
    const cell: TowerCell = CELLS[row][col];
    let consumed = false;

    if (cell.type === 'tower') {
      const existing = this.towers.find((t) => t.col === col && t.row === row);
      if (existing) {
        existing.level = Math.max(existing.level, level);
        existing.hp = existing.maxHp = TOWER_HP_BASE + existing.level * TOWER_HP_PER_LEVEL;
        this.notify(`${existing.name} 升级至 Lv.${existing.level}`);
      } else {
        const entry = this.chain[level - 1];
        const maxHp = TOWER_HP_BASE + level * TOWER_HP_PER_LEVEL;
        this.towers.push({
          id: nextId++,
          col,
          row,
          level,
          key: entry.key,
          name: entry.name,
          kind: ('beam' as SkillKind), // 视觉用；攻击为统一射线/炮弹
          hp: maxHp,
          maxHp,
          cooldown: 0,
          hitFlash: 0,
          disabledUntil: 0,
        });
        this.notify(`在${cell.name}建塔 Lv.${level}`);
      }
      consumed = true;
    } else if (cell.type === 'road') {
      const existing = this.blockers.find((b) => b.col === col && b.row === row);
      if (existing) {
        existing.level = Math.max(existing.level, level);
        existing.hp = existing.maxHp = BLOCKER_HP_BASE + existing.level * BLOCKER_HP_PER_LEVEL;
      } else {
        const maxHp = BLOCKER_HP_BASE + level * BLOCKER_HP_PER_LEVEL;
        this.blockers.push({
          id: nextId++,
          col,
          row,
          level,
          hp: maxHp,
          maxHp,
          hitFlash: 0,
        });
        this.blocked.add(`${col},${row}`);
        this.rebuildFlow();
      }
      this.notify(level >= 8 ? `坚固阻挡 Lv.${level}` : `放置阻挡 Lv.${level}`);
      consumed = true;
    } else if (cell.type === 'target') {
      const target = this.targets.find((t) => t.col === col && t.row === row);
      if (!target || !target.alive) return false;
      const entry = this.chain[level - 1];
      if (level >= REPAIR_LEVEL || entry.key === 'qinghua') {
        target.hp = Math.min(target.maxHp, target.hp + REPAIR_TARGET);
        this.notify(`修复 ${target.name} +${REPAIR_TARGET}`);
        consumed = true;
      } else {
        this.notify(`修复需 11 级及以上或清华大学`);
      }
    } else if (cell.type === 'destination') {
      if (!this.destination.alive || !this.destination.repairable) return false;
      const entry = this.chain[level - 1];
      if (entry.key === 'qinghua') {
        this.destination.hp = Math.min(this.destination.maxHp, this.destination.hp + REPAIR_LIUJIAO);
        this.notify(`修复六教 +${REPAIR_LIUJIAO}`);
        consumed = true;
      } else {
        this.notify(`修复六教仅可用清华大学`);
      }
    }
    if (consumed) this.grid[tr][tc] = 0;
    return consumed;
  }

  // ---- 寻路 ----
  private rebuildFlow() {
    this.flow = buildFlowField(this.blocked);
  }

  // ---- 主循环 ----
  update(dt: number) {
    if (this.mode !== 'playing') return;
    this.time += dt;
    if (this.noticeTime > 0) {
      this.noticeTime -= dt;
      if (this.noticeTime <= 0) this.notice = '';
    }
    this.spawn(dt);
    this.updateBoss(dt);
    this.updateStudents(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.updateEffects(dt);
    this.cleanup();
    this.checkEnd();
  }

  private activeGardenNames(): string[] {
    const t = this.time;
    if (t < 60) return ['紫荆园'];
    if (t < 120) return ['紫荆园', '桃李园'];
    if (t < 180) return ['丁香园', '听涛园', '清芬园'];
    return ['紫荆园', '桃李园', '丁香园', '听涛园', '清芬园'];
  }

  private spawn(dt: number) {
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const t = this.time;
    // 以“每秒刷新人数”为基准，随批次大小反推间隔，保证压力曲线平滑上升。
    const rate = 0.9 + t / 70;
    const batch = 1 + Math.floor(t / 45);
    this.spawnTimer = Math.max(0.4, batch / rate);
    const gardens = SPAWNS.filter((s) => this.activeGardenNames().includes(s.garden));
    if (!gardens.length) return;
    const hp = STUDENT_HP_BASE + Math.floor(t / 12) * STUDENT_HP_STEP;
    for (let i = 0; i < batch; i++) {
      const s = gardens[Math.floor(Math.random() * gardens.length)];
      this.spawnStudent(s, hp, STUDENT_SPEED);
    }
  }

  /** Boss 调度：每帧推进计时，按解锁时间在三种 Boss 中随机派遣，后期更密集。 */
  private updateBoss(dt: number) {
    this.bossTimer -= dt;
    if (this.bossTimer > 0) return;
    const t = this.time;
    const kinds: BossKind[] = [];
    if (t >= CODER_FROM) kinds.push('coder');
    if (t >= AYI_FROM) kinds.push('ayi');
    if (t >= LINE_FROM) kinds.push('line');
    const gardens = SPAWNS.filter((s) =>
      this.activeGardenNames().includes(s.garden),
    );
    if (!kinds.length || !gardens.length) {
      this.bossTimer = 5;
      return;
    }
    this.bossTimer =
      Math.max(11, BOSS_GAP - t / 60) * (0.75 + Math.random() * 0.5);
    const hp = STUDENT_HP_BASE + Math.floor(t / 12) * STUDENT_HP_STEP;
    const kind = this.pickBossKind(kinds);
    const s = gardens[Math.floor(Math.random() * gardens.length)];
    if (kind === 'line') this.spawnLine(s, hp);
    else this.spawnBossUnit(s, hp, kind);
  }

  /** 抽取袋：把当前已解锁的 Boss 种类各发一次再重新洗牌，保证三种都会登场。 */
  private pickBossKind(kinds: BossKind[]): BossKind {
    this.bossBag = this.bossBag.filter((k) => kinds.includes(k));
    if (!this.bossBag.length) this.bossBag = shuffle(kinds);
    return this.bossBag.shift()!;
  }

  private baseStudent(s: SpawnPoint, hp: number, speed: number): Student {
    return {
      id: nextId++,
      x: s.col * CELL + CELL / 2,
      y: s.row * CELL + CELL / 2,
      hp,
      maxHp: hp,
      speed,
      garden: s.garden,
      hitFlash: 0,
      atkBase: 1,
      auraMul: 1,
      auraUntil: 0,
      waveTimer: 0,
      auraTimer: 0,
      blessed: false,
      lineLeadId: 0,
      lineLead: false,
      wavesCast: 0,
      aurasCast: 0,
      stuckTimer: 0,
      lastCellKey: '',
    };
  }

  private spawnStudent(s: SpawnPoint, hp: number, speed: number) {
    this.students.push(this.baseStudent(s, hp, speed));
  }

  /** 码农出击 / 鹅腿阿姨：单体 Boss，附带一个技能计时器。 */
  private spawnBossUnit(s: SpawnPoint, hp: number, kind: 'coder' | 'ayi') {
    const cfg =
      kind === 'coder'
        ? { hpMul: CODER_HP_MUL, speed: CODER_SPEED }
        : { hpMul: AYI_HP_MUL, speed: AYI_SPEED };
    const st = this.baseStudent(s, hp * cfg.hpMul, cfg.speed);
    st.boss = kind;
    st.atkBase = BOSS_ATK_MUL;
    if (kind === 'coder') {
      st.waveTimer = CODER_WAVE_INTERVAL * (0.5 + Math.random() * 0.5);
      this.notify("码农出击：That's pity！");
    } else {
      st.blessed = Math.random() < AYI_BUFF_CHANCE;
      st.auraTimer = 0.5;
      this.notify(
        st.blessed
          ? '鹅腿阿姨开张：周围学生士气大涨！'
          : '鹅腿阿姨手感不佳：周围学生士气下滑…',
      );
    }
    this.students.push(st);
  }

  /** 菌液拉练：沿来路铺出一列高速高攻学生，歼灭队首即整排溃散。 */
  private spawnLine(s: SpawnPoint, hp: number) {
    const cx = s.col * CELL + CELL / 2;
    const cy = s.row * CELL + CELL / 2;
    const [dx, dy] = this.forwardDir(s.col, s.row);
    const group: Student[] = [];
    const lead = this.baseStudent(s, hp * LINE_HP_MUL, LINE_SPEED);
    lead.boss = 'line';
    lead.lineLead = true;
    lead.atkBase = LINE_ATK_MUL;
    group.push(lead);
    // 边缘刷新点（如听涛园在 col 0）沿来路铺开会越出地图，越界的成员
    // 拿不到 flow 会永久卡死；这里夹回刷新点格内并按固定偏移错开。
    const JITTER: [number, number][] = [
      [0, 0],
      [-9, -9],
      [9, -9],
      [-9, 9],
      [9, 9],
    ];
    for (let i = 1; i < LINE_COUNT; i++) {
      const m = this.baseStudent(s, hp * LINE_HP_MUL, LINE_SPEED);
      m.boss = 'line';
      m.atkBase = LINE_ATK_MUL;
      m.lineLeadId = lead.id;
      const off = LINE_GAP * i;
      let mx = cx - dx * off;
      let my = cy - dy * off;
      const pad = CELL * 0.5;
      if (mx < pad || mx > WORLD_W - pad || my < pad || my > WORLD_H - pad) {
        const [jx, jy] = JITTER[(i - 1) % JITTER.length];
        mx = cx + jx;
        my = cy + jy;
      }
      m.x = mx;
      m.y = my;
      group.push(m);
    }
    this.students.push(...group);
    this.notify(`菌液拉练 ×${LINE_COUNT} 来袭：截断队首即可全歼！`);
  }

  /** 从某格出发的流场前进方向（单位向量），用于把队列铺在来路上。 */
  private forwardDir(col: number, row: number): [number, number] {
    let bestC = col;
    let bestR = row;
    let best = this.flow[row]?.[col] ?? Infinity;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const d = this.flow[row + dy]?.[col + dx] ?? Infinity;
      if (d < best) {
        best = d;
        bestC = col + dx;
        bestR = row + dy;
      }
    }
    const len = Math.hypot(bestC - col, bestR - row);
    if (!len) return [0, 1];
    return [(bestC - col) / len, (bestR - row) / len];
  }

  /** 码农出击的光波：中心扩散的环形波，波面上闪动「That's pity」，
   *  命中范围内的防御塔令其停机 3~5 秒（随机）。 */
  private codeWave(s: Student) {
    let hit = 0;
    for (const tw of this.towers) {
      const d = Math.hypot(tw.col * CELL + CELL / 2 - s.x, tw.row * CELL + CELL / 2 - s.y);
      if (d > CODER_WAVE_R) continue;
      const disable = CODER_DISABLE_MIN + Math.random() * (CODER_DISABLE_MAX - CODER_DISABLE_MIN);
      tw.disabledUntil = Math.max(tw.disabledUntil, this.time + disable);
      hit++;
    }
    if (this.effects.length < EFFECT_CAP)
      this.effects.push({
        kind: 'wave',
        x: s.x,
        y: s.y,
        color: '#7fd4ff',
        life: 0.75,
        maxLife: 0.75,
        r: CODER_WAVE_R,
        text: "That's pity",
      });
    if (hit) this.notify(`码农光波命中 ${hit} 座防御塔，停机 3~5 秒！`);
  }

  /** 鹅腿阿姨的食堂光环：给周围学生增 / 减攻击力。 */
  private ayiAura(s: Student) {
    if (this.effects.length < EFFECT_CAP)
      this.effects.push({
        kind: 'aura',
        x: s.x,
        y: s.y,
        color: s.blessed ? '#6be08a' : '#8a93a8',
        life: 0.6,
        maxLife: 0.6,
        r: AYI_AURA_R,
        text: s.blessed ? '加鸡腿！' : '没胃口…',
      });
    for (const o of this.students) {
      if (o === s || o.hp <= 0) continue;
      if (Math.hypot(o.x - s.x, o.y - s.y) > AYI_AURA_R) continue;
      o.auraMul = s.blessed ? AYI_BUFF_MUL : AYI_DEBUFF_MUL;
      o.auraUntil = this.time + AYI_AURA_LIFE;
    }
  }

  private cellOf(x: number, y: number): [number, number] {
    return [Math.floor(x / CELL), Math.floor(y / CELL)];
  }

  private nearestTarget(x: number, y: number): {
    x: number;
    y: number;
    dmg: (d: number) => void;
    isDestination?: boolean;
    target?: Target;
    tower?: Tower;
    blocker?: Blocker;
  } | null {
    let best: {
      x: number;
      y: number;
      dmg: (d: number) => void;
      isDestination?: boolean;
      target?: Target;
      tower?: Tower;
      blocker?: Blocker;
    } | null = null;
    let bestD = STUDENT_RANGE;
    const consider = (
      sx: number,
      sy: number,
      apply: (d: number) => void,
      extra: object,
    ) => {
      const d = Math.hypot(sx - x, sy - y);
      if (d < bestD) {
        bestD = d;
        best = { x: sx, y: sy, dmg: apply, ...extra };
      }
    };
    for (const tw of this.towers)
      consider(tw.col * CELL + CELL / 2, tw.row * CELL + CELL / 2, (d) => this.damageTower(tw, d), { tower: tw });
    for (const b of this.blockers)
      consider(b.col * CELL + CELL / 2, b.row * CELL + CELL / 2, (d) => this.damageBlocker(b, d), { blocker: b });
    for (const tg of this.targets)
      if (tg.alive)
        consider(tg.col * CELL + CELL / 2, tg.row * CELL + CELL / 2, (d) => this.damageTarget(tg, d), { target: tg });
    if (this.destination.alive)
      consider(
        this.destination.col * CELL + CELL / 2,
        this.destination.row * CELL + CELL / 2,
        (d) => this.damageDestination(d),
        { isDestination: true },
      );
    return best;
  }

  /** 路被完全封死时的强拆目标：优先阻挡块（真正的封路者），其次进攻对象与防御塔。 */
  private nearestStructure(
    x: number,
    y: number,
    radius: number,
  ): { x: number; y: number; dmg: (d: number) => void } | null {
    let best: { x: number; y: number; dmg: (d: number) => void } | null = null;
    let bestD = radius;
    const consider = (sx: number, sy: number, apply: (d: number) => void) => {
      const d = Math.hypot(sx - x, sy - y);
      if (d < bestD) {
        bestD = d;
        best = { x: sx, y: sy, dmg: apply };
      }
    };
    for (const b of this.blockers)
      consider(b.col * CELL + CELL / 2, b.row * CELL + CELL / 2, (d) =>
        this.damageBlocker(b, d),
      );
    if (best) return best;
    bestD = radius;
    for (const tg of this.targets)
      if (tg.alive)
        consider(tg.col * CELL + CELL / 2, tg.row * CELL + CELL / 2, (d) =>
          this.damageTarget(tg, d),
        );
    for (const tw of this.towers)
      consider(tw.col * CELL + CELL / 2, tw.row * CELL + CELL / 2, (d) =>
        this.damageTower(tw, d),
      );
    return best;
  }

  private updateStudents(dt: number) {
    for (const s of this.students) {
      if (s.hitFlash > 0) s.hitFlash -= dt;
      // 鹅腿阿姨的增益 / 减损到期后回归常态。
      if (s.auraUntil > 0 && this.time >= s.auraUntil) {
        s.auraMul = 1;
        s.auraUntil = 0;
      }
      // Boss 技能：码农放光波（至多 5 次）、阿姨开食堂（至多 3 次后打烊自爆）。
      if (s.boss === 'coder') {
        s.waveTimer -= dt;
        if (s.waveTimer <= 0 && s.wavesCast < CODER_MAX_WAVES) {
          s.waveTimer = CODER_WAVE_INTERVAL;
          s.wavesCast++;
          this.codeWave(s);
        }
      } else if (s.boss === 'ayi') {
        s.auraTimer -= dt;
        if (s.auraTimer <= 0 && s.aurasCast < AYI_MAX_AURAS) {
          s.auraTimer = AYI_AURA_INTERVAL;
          s.aurasCast++;
          this.ayiAura(s);
          if (s.aurasCast >= AYI_MAX_AURAS)
            this.selfDestruct(s, '鹅腿阿姨打烊收摊，原地自爆！');
        }
      }
      const attack = this.nearestTarget(s.x, s.y);
      if (attack) {
        attack.dmg(STUDENT_ATK * s.atkBase * s.auraMul * dt);
        if (this.effects.length < EFFECT_CAP)
          this.effects.push({
            kind: 'beam',
            x: s.x,
            y: s.y,
            x2: attack.x,
            y2: attack.y,
            color: studentColor(s),
            life: 0.1,
            maxLife: 0.1,
          });
        continue;
      }
      const [c, r] = this.cellOf(s.x, s.y);
      const here = this.flow[r]?.[c] ?? Infinity;
      if (here === 0) continue; // 已在目的地格，攻击由上面 nearestTarget 处理
      if (!isFinite(here)) {
        // 路被阻挡完全封死：主动走向并强拆最近的封锁结构（优先阻挡块），
        // 拆开后流场重建、队伍自然继续推进；拆墙不算卡死，不触发自爆。
        const breach = this.nearestStructure(s.x, s.y, STUDENT_BREACH_R);
        if (breach) {
          const d = Math.hypot(breach.x - s.x, breach.y - s.y);
          if (d < STUDENT_RANGE) {
            breach.dmg(STUDENT_ATK * s.atkBase * s.auraMul * dt);
            if (this.effects.length < EFFECT_CAP)
              this.effects.push({
                kind: 'beam',
                x: s.x,
                y: s.y,
                x2: breach.x,
                y2: breach.y,
                color: studentColor(s),
                life: 0.1,
                maxLife: 0.1,
              });
          } else {
            const ang = Math.atan2(breach.y - s.y, breach.x - s.x);
            s.x += Math.cos(ang) * s.speed * dt;
            s.y += Math.sin(ang) * s.speed * dt;
          }
          s.lastCellKey = `${c},${r}`;
          s.stuckTimer = 0;
        } else {
          // 封死且周围没有任何可拆结构：仍按卡死看门狗兜底。
          const cellKey = `${c},${r}`;
          if (cellKey !== s.lastCellKey) {
            s.lastCellKey = cellKey;
            s.stuckTimer = 0;
          } else {
            s.stuckTimer += dt;
            if (s.stuckTimer >= STUCK_CELL_SECONDS) this.selfDestruct(s);
          }
        }
        continue;
      }
      // 卡死看门狗：有路可走却停在原格（无攻击目标）→ 自爆清场。
      const cellKey = `${c},${r}`;
      if (cellKey !== s.lastCellKey) {
        s.lastCellKey = cellKey;
        s.stuckTimer = 0;
      } else {
        s.stuckTimer += dt;
        if (s.stuckTimer >= STUCK_CELL_SECONDS) {
          this.selfDestruct(s);
          continue;
        }
      }
      // 选距离更小的相邻格
      let bestC = c,
        bestR = r,
        bestD = here;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nc = c + dx,
          nr = r + dy;
        const d = this.flow[nr]?.[nc] ?? Infinity;
        if (d < bestD) {
          bestD = d;
          bestC = nc;
          bestR = nr;
        }
      }
      if (bestC === c && bestR === r) continue;
      const tx = bestC * CELL + CELL / 2;
      const ty = bestR * CELL + CELL / 2;
      const ang = Math.atan2(ty - s.y, tx - s.x);
      s.x += Math.cos(ang) * s.speed * dt;
      s.y += Math.sin(ang) * s.speed * dt;
    }
  }

  private updateTowers(dt: number) {
    for (const tw of this.towers) {
      if (tw.hitFlash > 0) tw.hitFlash -= dt;
      tw.cooldown -= dt;
      if (this.time < tw.disabledUntil) continue; // 被码农光波命中，停机中
      if (tw.cooldown > 0) continue;
      const cx = tw.col * CELL + CELL / 2;
      const cy = tw.row * CELL + CELL / 2;
      const range = TOWER_RANGE_BASE + tw.level * TOWER_RANGE_PER_LEVEL;
      let target: Student | null = null;
      let bestD = range;
      for (const s of this.students) {
        const d = Math.hypot(s.x - cx, s.y - cy);
        if (d < bestD) {
          bestD = d;
          target = s;
        }
      }
      if (!target) continue;
      const dmg = TOWER_BASE_DMG + tw.level * TOWER_DMG_PER_LEVEL;
      const fireInterval = Math.max(TOWER_FIRE_MIN, TOWER_FIRE_BASE - tw.level * 0.03);
      tw.cooldown = fireInterval;
      const ang = Math.atan2(target.y - cy, target.x - cx);
      const color = this.chain[tw.level - 1]?.color ?? '#ffd866';
      if (this.effects.length < EFFECT_CAP)
        this.effects.push({ kind: 'spark', x: cx, y: cy, color, life: 0.12, maxLife: 0.12, r: 12 });
      this.projectiles.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * TOWER_PROJECTILE_SPEED,
        vy: Math.sin(ang) * TOWER_PROJECTILE_SPEED,
        dmg,
        color,
        life: 1.2,
        targetId: target.id,
      });
    }
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      const target = this.students.find((s) => s.id === p.targetId);
      if (target) {
        if (Math.hypot(target.x - p.x, target.y - p.y) < 11) {
          this.damageStudent(target, p.dmg);
          if (this.effects.length < EFFECT_CAP)
            this.effects.push({ kind: 'spark', x: target.x, y: target.y, color: p.color, life: 0.14, maxLife: 0.14, r: 9 });
          p.life = 0;
        }
      } else {
        p.life = 0;
      }
    }
  }

  private damageStudent(s: Student, d: number) {
    if (s.hp <= 0) return; // 已阵亡，避免重复计入击杀
    s.hp -= d;
    s.hitFlash = 0.12;
    if (s.hp > 0) return;
    this.kills++;
    // 菌液拉练：队首被歼灭时，整排学生立刻溃散。
    if (s.boss === 'line' && s.lineLead) {
      for (const o of this.students) {
        if (o === s || o.hp <= 0 || o.lineLeadId !== s.id) continue;
        o.hp = 0;
        o.hitFlash = 0.2;
        this.kills++;
      }
      if (this.effects.length < EFFECT_CAP)
        this.effects.push({
          kind: 'explosion',
          x: s.x,
          y: s.y,
          color: '#4be07a',
          life: 0.45,
          maxLife: 0.45,
          r: 70,
        });
      this.notify('菌液拉练队首被截断，整排溃散！');
    }
  }

  /** 学生自爆（阿姨打烊 / 卡死看门狗触发）：原地爆炸消失，不计入歼灭数；
   *  菌液拉练队首自爆时整排跟着溃散，避免留下永不溃散的队列。 */
  private selfDestruct(s: Student, msg?: string) {
    if (s.hp <= 0) return;
    s.hp = 0;
    s.hitFlash = 0.2;
    if (s.boss === 'line' && s.lineLead) {
      for (const o of this.students) {
        if (o === s || o.hp <= 0 || o.lineLeadId !== s.id) continue;
        o.hp = 0;
        o.hitFlash = 0.2;
      }
    }
    if (this.effects.length < EFFECT_CAP)
      this.effects.push({
        kind: 'explosion',
        x: s.x,
        y: s.y,
        color: studentColor(s),
        life: 0.45,
        maxLife: 0.45,
        r: s.boss ? 60 : 34,
      });
    if (msg) this.notify(msg);
  }

  private damageTower(tw: Tower, d: number) {
    tw.hp -= d;
    tw.hitFlash = 0.12;
  }

  private damageBlocker(b: Blocker, d: number) {
    b.hp -= d;
    b.hitFlash = 0.12;
  }

  private damageTarget(tg: Target, d: number) {
    tg.hp -= d;
    if (tg.hp <= 0) {
      tg.alive = false;
      this.explode(tg.col * CELL + CELL / 2, tg.row * CELL + CELL / 2, TARGET_EXPLODE_R, TARGET_EXPLODE_DMG);
      this.notify(`${tg.name} 被摧毁，发生爆炸！`);
    }
  }

  private damageDestination(d: number) {
    const d0 = this.destination;
    if (!d0.alive) return;
    if (d0.breached) {
      d0.hp -= d;
      if (d0.hp <= 0) {
        d0.alive = false;
        this.notify('六教被攻破，防线失守！');
      }
      return;
    }
    d0.hp -= d;
    if (d0.hp <= 0) {
      d0.breached = true;
      d0.repairable = false;
      d0.hp = d0.secondHp;
      this.explode(d0.col * CELL + CELL / 2, d0.row * CELL + CELL / 2, LIUJIAO_EXPLODE_R, LIUJIAO_EXPLODE_DMG);
      this.notify('六教首次被攻破，大爆炸！（清华可修复）');
    }
  }

  private explode(x: number, y: number, radius: number, dmg: number) {
    for (const s of this.students) {
      if (Math.hypot(s.x - x, s.y - y) <= radius) this.damageStudent(s, dmg);
    }
    if (this.effects.length < EFFECT_CAP)
      this.effects.push({ kind: 'explosion', x, y, color: '#ff9b3d', life: 0.5, maxLife: 0.5, r: radius });
  }

  private updateEffects(dt: number) {
    for (const e of this.effects) e.life -= dt;
    if (this.effects.length) this.effects = this.effects.filter((e) => e.life > 0);
  }

  private cleanup() {
    this.students = this.students.filter((s) => s.hp > 0);
    const before = this.blockers.length;
    this.blockers = this.blockers.filter((b) => b.hp > 0);
    if (this.blockers.length !== before) {
      this.blocked.clear();
      for (const b of this.blockers) this.blocked.add(`${b.col},${b.row}`);
      this.rebuildFlow();
    }
    this.towers = this.towers.filter((t) => t.hp > 0);
      this.projectiles = this.projectiles.filter((p) => p.life > 0);
      this.effects = this.effects.filter((e) => e.life > 0);
  }

  private checkEnd() {
    if (!this.destination.alive) {
      this.mode = 'lost';
      this.endReason = '目的地（六教）被摧毁，游戏结束。';
      return;
    }
    if (this.targets.length && this.targets.every((t) => !t.alive)) {
      this.mode = 'lost';
      this.endReason = '全部进攻对象被摧毁，游戏结束。';
    }
  }

  notify(msg: string) {
    this.notice = msg;
    this.noticeTime = 3;
  }

  snapshot(): TowerSnapshot {
    const live = this.students.filter((s) => s.hp > 0);
    return {
      mode: this.mode,
      time: this.time,
      kills: this.kills,
      merges: this.merges,
      grid: this.grid.map((r) => [...r]),
      chain: this.chain,
      targets: this.targets.map((t) => ({
        name: t.name,
        hp: t.hp,
        maxHp: t.maxHp,
        alive: t.alive,
        col: t.col,
        row: t.row,
      })),
      destination: {
        hp: this.destination.hp,
        maxHp: this.destination.breached ? this.destination.secondHp : this.destination.maxHp,
        breached: this.destination.breached,
        repairable: this.destination.repairable,
        alive: this.destination.alive,
      },
      towers: this.towers.map((t) => ({
        col: t.col,
        row: t.row,
        level: t.level,
        key: t.key,
        name: t.name,
        hp: t.hp,
        maxHp: t.maxHp,
        disabled: this.time < t.disabledUntil,
      })),
      blockers: this.blockers.map((b) => ({
        col: b.col,
        row: b.row,
        level: b.level,
        hp: b.hp,
        maxHp: b.maxHp,
      })),
      activeGardens: this.activeGardenNames(),
      spawnPhase: this.time < 60 ? 0 : this.time < 120 ? 1 : this.time < 180 ? 2 : 3,
      notice: this.notice,
      endReason: this.endReason,
      effects: this.effects.map((e) => ({ ...e })),
      bosses: live.filter((s) => s.boss).length,
      bossCounts: {
        coder: live.filter((s) => s.boss === 'coder').length,
        ayi: live.filter((s) => s.boss === 'ayi').length,
        line: live.filter((s) => s.boss === 'line').length,
      },
      lastMove: this.lastMove,
      moveSeq: this.moveSeq,
      mergeCells: [...this.mergeCells],
      spawnCell: this.spawnCell,
    };
  }
}
