import assert from 'node:assert/strict';
import { TowerModel, CELL, LINE_COUNT, type Student } from '../lib/tower-model';
import { DEPARTMENTS } from '../lib/departments';
import {
  CELLS,
  DESTINATION,
  GRID_COLS,
  GRID_ROWS,
  SPAWNS,
  TARGETS,
  TOWER_SLOTS,
  buildFlowField,
} from '../lib/tower-map';

function fresh() {
  const m = new TowerModel();
  m.start('d041');
  return m;
}
/** 造一个学生放在 (x, y)：血量极高、默认原地，便于观察攻击行为。 */
function student(x: number, y: number, speed = 0): Student {
  return {
    id: 900000 + Math.floor(x + y),
    x,
    y,
    hp: 1e6,
    maxHp: 1e6,
    speed,
    garden: '测试',
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
const finite = (v: number) => Number.isFinite(v);
/** 在固定随机数下跑一段时间，返回新出现的学生数。 */
function sample(t: number, seconds: number) {
  const m = fresh();
  const real = Math.random;
  let total = 0;
  try {
    Math.random = () => 0.99; // 不触发 Boss
    for (let i = 0; i < seconds * 20; i++) {
      m.time = t + i * 0.05;
      const before = m.students.length;
      m.update(0.05);
      const after = m.students.length;
      total += Math.max(0, after - before);
      m.students = [];
    }
  } finally {
    Math.random = real;
  }
  return total;
}

// 地图结构与需求一致：6 列 × 26 行、五个刷新点、三个进攻对象、一个目的地。
{
  assert.equal(GRID_COLS, 6);
  assert.equal(GRID_ROWS, 26);
  assert.equal(CELL, 40);
  assert.deepEqual(DESTINATION, { col: 2, row: 25 });
  assert.equal(SPAWNS.length, 5);
  assert.deepEqual(
    SPAWNS.map((s) => s.garden).sort(),
    ['丁香园', '听涛园', '清芬园', '紫荆园', '桃李园'].sort(),
  );
  assert.equal(TARGETS.length, 3);
  assert.deepEqual(
    TARGETS.map((t) => t.name).sort(),
    ['苏世民书院', '土木馆', '人文楼'].sort(),
  );
  assert.equal(TOWER_SLOTS.length, 11);
  for (const slot of TOWER_SLOTS) assert.equal(CELLS[slot.row][slot.col].type, 'tower');
  assert.equal(CELLS[DESTINATION.row][DESTINATION.col].type, 'destination');
  for (const t of TARGETS) assert.equal(CELLS[t.row][t.col].type, 'target');
}

// 刷新点全部可达六教；空白格不可通行；封死 (2,24) 会切断全部路线。
{
  const flow = buildFlowField(new Set());
  for (const s of SPAWNS)
    assert(finite(flow[s.row][s.col]) && flow[s.row][s.col] > 0, `${s.garden} 必须能到达六教`);
  assert.equal(flow[0][5], Infinity, '空白格不可通行');
  const cut = buildFlowField(new Set([`${DESTINATION.col},${DESTINATION.row - 1}`]));
  for (const s of SPAWNS) assert.equal(cut[s.row][s.col], Infinity);
  const detour = buildFlowField(new Set(['0,23']));
  for (const s of SPAWNS) assert(finite(detour[s.row][s.col]), '侧向道路应可绕行');
}

// 合成链：13 个抽取专业 + 所选专业 + 清华大学 = 15 级。
{
  assert(DEPARTMENTS.length >= 14);
  const m = fresh();
  assert.equal(m.chain.length, 15);
  assert.equal(m.chain[0].id, 'd041');
  assert.equal(m.chain[14].key, 'qinghua');
  assert.equal(m.chain[14].name, '清华大学');
  assert.equal(new Set(m.chain.map((e) => e.id)).size, 15, '链条内不得重复');
  assert.equal(fresh().chain[0].id, 'd041', '所选专业固定为 1 级');
  // 每级一个独立学院 / 专业 logo：126 个专业只共享 29 张 badge，必须去重抽取。
  assert.equal(
    new Set(m.chain.map((e) => e.key)).size,
    15,
    '每一级都应对应独立的学院 / 专业 logo',
  );
  for (let i = 0; i < 8; i++)
    assert.equal(
      new Set(fresh().chain.map((e) => e.key)).size,
      15,
      '任意一局都不应出现重复 logo',
    );
}

// 刷新阶段与需求逐字一致。
{
  const m = fresh();
  const phase = (t: number) => {
    m.time = t;
    const s = m.snapshot();
    return [s.spawnPhase, s.activeGardens.join(',')];
  };
  assert.deepEqual(phase(0), [0, '紫荆园']);
  assert.deepEqual(phase(59.9), [0, '紫荆园']);
  assert.deepEqual(phase(60), [1, '紫荆园,桃李园']);
  assert.deepEqual(phase(119.9), [1, '紫荆园,桃李园']);
  assert.deepEqual(phase(120), [2, '丁香园,听涛园,清芬园']);
  assert.deepEqual(phase(179.9), [2, '丁香园,听涛园,清芬园']);
  assert.deepEqual(phase(180), [3, '紫荆园,桃李园,丁香园,听涛园,清芬园']);
  assert.deepEqual(phase(99999), [3, '紫荆园,桃李园,丁香园,听涛园,清芬园']);
}

// 2048：相邻同等级合成 +1，最高封顶 15，无效移动不计入滑动。
{
  const m = fresh();
  m.grid = [
    [1, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const seq = m.moveSeq;
  m.move2048('left');
  assert.equal(m.grid[0][0], 2);
  assert.equal(m.moveSeq, seq + 1);
  assert.equal(m.lastMove, 'left');
  assert.deepEqual(m.mergeCells, [0], '合并位置供 UI 播放合成特效');
  assert.equal(m.spawnCell >= 0 && m.spawnCell !== 0, true, '新方块位置供 UI 播放新生特效');
  assert.equal(m.snapshot().mergeCells.length, 1);
  assert.equal(m.grid.flat().filter((v) => v > 0).length, 2, '合成后补充一个新方块');
  m.grid = [
    [15, 15, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  m.move2048('left');
  assert.equal(m.grid[0][0], 15, '最高等级封顶为清华大学，不溢出');
  m.grid = [
    [1, 2, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const idle = m.moveSeq;
  m.move2048('left');
  assert.equal(m.moveSeq, idle, '无效移动不触发滑动动画');
  assert.deepEqual(m.mergeCells, []);
  assert.equal(m.spawnCell, -1);
  assert.equal(m.grid[0][0], 1);
  assert.equal(m.grid[0][1], 2);
}

// 拖放：防御点建塔 / 升级，路口放阻挡并改变寻路，空白格拒绝投放。
{
  const m = fresh();
  assert.equal(CELLS[3][1].name, 'C楼');
  m.grid[0][0] = 4;
  assert.equal(m.dropTile(0, 1, 3), true, 'C楼可建塔');
  assert.equal(m.towers.length, 1);
  assert.equal(m.towers[0].col, 1);
  assert.equal(m.towers[0].row, 3);
  assert.equal(m.towers[0].name, m.chain[3].name, '塔以合成出的专业命名');
  assert.equal(m.towers[0].level, 4);
  assert.equal(m.grid[0][0], 0, '建塔消耗方块');
  m.grid[0][0] = 2;
  assert.equal(m.dropTile(0, 1, 3), true);
  assert.equal(m.towers[0].level, 4, '低等级投放不降级');
  assert.equal(m.towers.length, 1, '同一防御点只保留一座塔');
  m.grid[0][0] = 7;
  m.dropTile(0, 1, 3);
  assert.equal(m.towers[0].level, 7, '更高等级可升级');
  assert.equal(m.towers[0].hp, m.towers[0].maxHp);

  m.grid[0][0] = 3;
  assert.equal(m.dropTile(0, 2, 24), true, '道路可放阻挡');
  assert.equal(m.blockers.length, 1);
  assert.equal(m.grid[0][0], 0);

  m.grid[0][0] = 3;
  assert.equal(m.dropTile(0, 5, 0), false);
  assert.equal(m.grid[0][0], 3, '无效投放不消耗方块');
}

// 学生沿道路推进，遇到范围内结构改为攻击。
{
  const m = fresh();
  m.grid[0][0] = 6;
  m.dropTile(0, 1, 3);
  const tower = m.towers[0];
  const before = tower.hp;
  m.students = [student(1 * CELL + CELL / 2, 3 * CELL + CELL / 2)];
  m.update(0.05);
  assert(tower.hp < before, '相邻学生应攻击防御塔');
  assert(m.effects.length > 0, '攻击应产生特效');

  const walker = fresh();
  const flow = buildFlowField(new Set());
  const start = flow[5][2];
  assert(finite(start) && start > 0);
  walker.students = [student(2 * CELL + CELL / 2, 5 * CELL + CELL / 2, 38)];
  for (let i = 0; i < 40; i++) walker.update(0.05);
  const w = walker.students[0];
  const wc = Math.floor(w.x / CELL);
  const wr = Math.floor(w.y / CELL);
  assert(flow[wr][wc] < start, `无目标时应沿最佳路线推进（${start} → ${flow[wr][wc]}）`);
}

// 进攻对象：需 11 级及以上或清华大学修复，且不超过上限。
{
  const m = fresh();
  const { col, row } = TARGETS[0];
  m.targets[0].hp = 100;
  m.grid[0][0] = 5;
  assert.equal(m.dropTile(0, col, row), false, '5 级不可修复');
  assert.equal(m.targets[0].hp, 100);
  assert.equal(m.grid[0][0], 5, '失败的修复不消耗方块');
  m.grid[0][0] = 10;
  assert.equal(m.dropTile(0, col, row), false, '10 级仍不可修复');
  m.grid[0][0] = 11;
  assert.equal(m.dropTile(0, col, row), true, '11 级可修复');
  assert.equal(m.targets[0].hp, 260);
  assert.equal(m.grid[0][0], 0);
  m.grid[0][0] = 15;
  m.targets[0].hp = m.targets[0].maxHp - 10;
  assert.equal(m.dropTile(0, col, row), true, '清华大学可修复');
  assert.equal(m.targets[0].hp, m.targets[0].maxHp, '修复不超过血量上限');
  m.grid[0][0] = 15;
  assert.equal(m.dropTile(0, col, row), true, '满血时仍可投放（不下溢）');
  assert.equal(m.targets[0].hp, m.targets[0].maxHp);
}

// 未攻破时六教只接受清华大学修复。
{
  const m = fresh();
  m.destination.hp = 500;
  m.grid[0][0] = 11;
  assert.equal(m.dropTile(0, DESTINATION.col, DESTINATION.row), false, '11 级不能修六教');
  assert.equal(m.destination.hp, 500);
  m.grid[0][0] = 15;
  assert.equal(m.dropTile(0, DESTINATION.col, DESTINATION.row), true);
  assert.equal(m.destination.hp, 760);
  assert.equal(m.grid[0][0], 0);
  assert(m.notice.includes('六教'));
}

// 六教两阶段：首次攻破大爆炸且此后不可修复；再次攻破即结束。
{
  const m = fresh();
  const cx = DESTINATION.col * CELL + CELL / 2;
  const cy = DESTINATION.row * CELL + CELL / 2;
  m.students = [student(cx, cy)];
  assert.equal(m.destination.hp, 1400);
  m.destination.hp = 0.01;
  m.update(0.05);
  assert.equal(m.destination.breached, true);
  assert.equal(m.destination.repairable, false, '爆炸后不可修复');
  assert.equal(m.destination.hp, m.destination.secondHp);
  assert.equal(m.mode, 'playing');
  assert(m.effects.some((e) => e.kind === 'explosion'), '首次攻破应产生爆炸特效');

  m.grid[0][0] = 11;
  assert.equal(m.dropTile(0, DESTINATION.col, DESTINATION.row), false, '已破后 11 级不能修六教');
  m.grid[0][0] = 15;
  assert.equal(m.dropTile(0, DESTINATION.col, DESTINATION.row), false, '爆炸后清华大学也不能修六教');

  m.destination.hp = 0.01;
  m.update(0.05);
  assert.equal(m.destination.alive, false);
  assert.equal(m.mode, 'lost');
  assert(m.endReason.includes('六教'));
}

// 全部进攻对象被摧毁即失败。
{
  const m = fresh();
  m.targets = m.targets.map((t) => ({ ...t, hp: 0, alive: false }));
  m.update(0.02);
  assert.equal(m.mode, 'lost');
  assert(m.endReason.includes('进攻对象'));
}

// Boss 调度：解锁前不出现；到点后一次派出一整类 Boss。
{
  // 跑满 59 秒（Boss 计时器早已到期多次）也不得出 Boss。
  const early = fresh();
  const real = Math.random;
  try {
    Math.random = () => 0;
    for (let i = 0; i < 20 * 70 && early.time < 59; i++) early.update(0.05);
  } finally {
    Math.random = real;
  }
  assert(early.time >= 59, '未跑到预期时长');
  assert(!early.students.some((s) => s.boss), '60 秒前不出现 Boss');

  // 三种 Boss 都应登场（抽取袋保证每种各发一次，不会长期只刷同一种）。
  const mixed = fresh();
  const real2 = Math.random;
  const seen = new Set<string>();
  let lineGroup: Student[] = [];
  try {
    Math.random = () => 0.42;
    mixed.time = 160; // 三类全部解锁
    for (let i = 0; i < 20 * 200 && seen.size < 3; i++) {
      mixed.update(0.05);
      for (const s of mixed.students) if (s.boss) seen.add(s.boss);
      if (lineGroup.length === 0)
        lineGroup = mixed.students.filter((s) => s.boss === 'line');
      mixed.students = []; // 清场，避免学生打光结构导致提前结束
      if (mixed.mode !== 'playing') break;
    }
  } finally {
    Math.random = real2;
  }
  assert.deepEqual(
    [...seen].sort(),
    ['ayi', 'coder', 'line'],
    '码农出击 / 鹅腿阿姨 / 菌液拉练 都应登场',
  );
  assert.equal(lineGroup.length, LINE_COUNT, '菌液拉练一次生成一整排');
  const lead = lineGroup.find((s) => s.lineLead);
  assert(lead && lineGroup.filter((s) => s.lineLead).length === 1, '整排只有一个队首');
  for (const f of lineGroup)
    if (!f.lineLead) assert.equal(f.lineLeadId, lead.id, '队员都指向队首');
  assert(lead.atkBase > 1 && lead.speed > 60, '拉练学生高速高攻');
}

// 码农出击：光波闪动 That's pity，并让命中范围内的防御塔停机 3~5 秒。
{
  const m = fresh();
  m.grid[0][0] = 15;
  assert.equal(m.dropTile(0, 1, 3), true);
  const tw = m.towers[0];
  const cx = 1 * CELL + CELL / 2;
  const cy = 3 * CELL + CELL / 2;
  const coder: Student = { ...student(cx, cy), boss: 'coder', atkBase: 2.2, waveTimer: 0.01 };
  m.students = [coder];
  m.update(0.05);
  const off = tw.disabledUntil - m.time;
  assert(off >= 3 && off <= 5, `命中后停机应随机 3~5 秒（实际 ${off.toFixed(2)}）`);
  const wave = m.effects.find((e) => e.kind === 'wave');
  assert(wave && wave.text === "That's pity", "光波上应闪动 That's pity");
  m.update(0.4);
  assert.equal(m.projectiles.length, 0, '停机期间防御塔不工作');
  m.time = tw.disabledUntil + 0.01;
  m.students = [coder];
  m.update(0.05);
  assert(m.projectiles.length > 0, '停机结束后防御塔恢复开火');
}

// 鹅腿阿姨：生成时 60% 增益 / 40% 减损周围学生攻击力，且会到期。
{
  const buffed = fresh();
  const ally = student(3 * CELL, 5 * CELL);
  const ayiA: Student = {
    ...student(3 * CELL + 10, 5 * CELL + 10),
    boss: 'ayi',
    blessed: true,
    auraTimer: 0.01,
    atkBase: 2.2,
  };
  buffed.students = [ayiA, ally];
  buffed.update(0.05);
  assert(ally.auraMul > 1, '增益光环应提高周围学生攻击力');
  assert(buffed.effects.some((e) => e.kind === 'aura'), '应产生食堂光环特效');
  buffed.time = ally.auraUntil + 0.01;
  buffed.update(0.05);
  assert.equal(ally.auraMul, 1, '增益到期后回归常态');

  const drained = fresh();
  const victim = student(3 * CELL, 5 * CELL);
  const ayiB: Student = {
    ...student(3 * CELL + 10, 5 * CELL + 10),
    boss: 'ayi',
    blessed: false,
    auraTimer: 0.01,
    atkBase: 2.2,
  };
  drained.students = [ayiB, victim];
  drained.update(0.05);
  assert(victim.auraMul < 1, '减损光环应降低周围学生攻击力');
}

// 菌液拉练：歼灭队首即整排溃散，且整排都计入歼灭数。
{
  const m = fresh();
  m.grid[0][0] = 15;
  assert.equal(m.dropTile(0, 1, 3), true);
  const cx = 1 * CELL + CELL / 2;
  const cy = 3 * CELL + CELL / 2;
  const lead: Student = { ...student(cx, cy - 20), boss: 'line', lineLead: true, atkBase: 2.4, hp: 12, maxHp: 12 };
  // 队员血量极高，测试窗口内不可能被塔单独打死——只有「队首阵亡」这一条路能带走它。
  const mate: Student = {
    ...student(cx, cy - 50),
    boss: 'line',
    lineLeadId: lead.id,
    atkBase: 2.4,
    hp: 1e6,
    maxHp: 1e6,
  };
  m.students = [lead, mate];
  const before = m.kills;
  for (let i = 0; i < 20 && m.students.some((s) => s.id === mate.id); i++)
    m.update(0.05);
  assert(!m.students.some((s) => s.id === lead.id), '队首应被歼灭');
  assert(!m.students.some((s) => s.id === mate.id), '队首阵亡后整排立刻溃散');
  assert(m.kills - before >= 2, '整排学生全部计入歼灭数');
}

// 卡死看门狗：无攻击目标且在同一格停留超过 10 秒的学生自爆清场（不计歼灭数）。
{
  const m = fresh();
  (m as unknown as { spawnTimer: number }).spawnTimer = 1e9; // 冻结自动刷新
  const stuck = student(2 * CELL + CELL / 2, 19 * CELL + CELL / 2); // speed 0，路上无结构
  m.students = [stuck];
  const before = m.kills;
  for (let i = 0; i < 20 * 12 && stuck.hp > 0; i++) m.update(0.05);
  assert.equal(stuck.hp, 0, '卡死学生应在 10 秒后自爆');
  assert(!m.students.some((s) => s.id === stuck.id), '自爆后应离场');
  assert.equal(m.kills, before, '自爆不计入歼灭数');
  assert(m.effects.some((e) => e.kind === 'explosion'), '自爆应产生爆炸特效');

  // 正在围攻结构的学生不算卡死：贴着防御塔打 12 秒也不会被看门狗带走。
  const siege = fresh();
  (siege as unknown as { spawnTimer: number }).spawnTimer = 1e9;
  siege.grid[0][0] = 15;
  assert.equal(siege.dropTile(0, 1, 3), true);
  // 站在 (2,3) 道路格上，与 C楼防御塔相距一格（正常攻击范围内）。
  const attacker = student(2 * CELL + CELL / 2, 3 * CELL + CELL / 2);
  siege.students = [attacker];
  const towerHp = siege.towers[0].hp;
  for (let i = 0; i < 20 * 12; i++) siege.update(0.05);
  assert(
    siege.students.some((s) => s.id === attacker.id),
    '围攻中的学生不受卡死看门狗影响',
  );
  assert(siege.towers[0].hp < towerHp, '围攻应持续造成伤害');
}

// 路被阻挡完全封死时，学生会主动走向并强拆封锁（不再原地发呆）。
{
  const m = fresh();
  (m as unknown as { spawnTimer: number }).spawnTimer = 1e9;
  // 用 4 个阻挡块封死上院区（桃李/紫荆所在区域与下方道路的唯一联系是第 5 行）。
  for (let i = 0; i < 4; i++) m.grid[0][i] = 15;
  assert.equal(m.dropTile(0, 0, 5), true);
  assert.equal(m.dropTile(1, 1, 5), true);
  assert.equal(m.dropTile(2, 2, 5), true);
  assert.equal(m.dropTile(3, 3, 5), true);
  const flow = buildFlowField(new Set(['0,5', '1,5', '2,5', '3,5']));
  assert.equal(flow[0][0], Infinity, '上院区应被完全封死');
  const wall = m.blockers[0]; // (0,5)，距桃李园刷新点约 5 格
  const s = student(CELL / 2, CELL / 2, 38); // 桃李园刷新点中心
  m.students = [s];
  for (let i = 0; i < 20 * 12; i++) m.update(0.05);
  assert(s.y > CELL, '被封死的学生应主动走向封锁线，而不是原地发呆');
  assert(wall.hp < wall.maxHp, '学生应强拆阻挡块');
  assert(m.students.some((k) => k.id === s.id), '拆墙不算卡死，不应被自爆');
}

// 码农出击最多释放 5 次光波，防止蹲点无限放电。
{
  const m = fresh();
  (m as unknown as { spawnTimer: number }).spawnTimer = 1e9;
  m.grid[0][0] = 15;
  assert.equal(m.dropTile(0, 1, 3), true); // 给它一个可围攻的目标，避免被看门狗清掉
  const coder: Student = {
    ...student(1 * CELL + CELL / 2, 4 * CELL + CELL / 2),
    boss: 'coder',
    atkBase: 2.2,
    waveTimer: 0.01,
  };
  m.students = [coder];
  for (let i = 0; i < 20 * 40; i++) m.update(0.05);
  assert.equal(coder.wavesCast, 5, '光波应恰好释放 5 次');
  assert(coder.hp > 0, '围攻中的码农本体不应消失');
  // 上限后再跑一段时间也不得再放电。
  coder.waveTimer = 0.01;
  for (let i = 0; i < 20 * 8; i++) m.update(0.05);
  assert.equal(coder.wavesCast, 5, '达到上限后不得再释放光波');
}

// 鹅腿阿姨最多释放 3 次光环，随后打烊自爆（不计歼灭数）。
{
  const m = fresh();
  (m as unknown as { spawnTimer: number }).spawnTimer = 1e9;
  const ally = student(3 * CELL, 5 * CELL);
  const ayi: Student = {
    ...student(3 * CELL + 10, 5 * CELL + 10),
    boss: 'ayi',
    blessed: true,
    auraTimer: 0.01,
    atkBase: 2.2,
  };
  m.students = [ayi, ally];
  const before = m.kills;
  for (let i = 0; i < 20 * 12 && ayi.hp > 0; i++) m.update(0.05);
  assert.equal(ayi.aurasCast, 3, '光环应恰好释放 3 次');
  assert.equal(ayi.hp, 0, '释放 3 次光环后应自爆');
  assert(!m.students.some((s) => s.id === ayi.id), '自爆后应离场');
  assert.equal(m.kills, before, '自爆不计入歼灭数');
}

// 菌液拉练在边缘刷新点（听涛园等）生成时，队员必须留在地图内，否则会永久卡死。
{
  let groups = 0;
  for (let iter = 0; iter < 600 && groups < 60; iter++) {
    const mm = fresh();
    mm.time = 160; // 三类 Boss 全部解锁
    (mm as unknown as { bossTimer: number }).bossTimer = 0.01;
    mm.update(0.05);
    const line = mm.students.filter((s) => s.boss === 'line');
    if (!line.length) continue;
    groups++;
    for (const f of line)
      assert(
        f.x >= 0 && f.x <= GRID_COLS * CELL && f.y >= 0 && f.y <= GRID_ROWS * CELL,
        `菌液拉练成员生成在地图外 (${f.x.toFixed(1)}, ${f.y.toFixed(1)})，会永久卡死`,
      );
  }
  assert(groups >= 30, `应观测到足够多的菌液拉练队列（实际 ${groups}）`);
}

// 特效到期后必须清理。
{
  const m = fresh();
  m.effects.push({ kind: 'spark', x: 0, y: 0, color: '#fff', life: 0.2, maxLife: 0.2 });
  assert.equal(m.snapshot().effects.length, 1);
  m.update(0.3);
  assert.equal(m.effects.length, 0);
}

// 压力曲线：刷新量随时间单调不减，且后期明显高于开局。
{
  const rates = [0, 60, 120, 180, 300].map((t) => sample(t, 20));
  for (let i = 1; i < rates.length; i++)
    assert(rates[i] >= rates[i - 1], `刷新压力不得下降：${rates.join(',')}`);
  assert(rates[4] > rates[0] * 2, `后期压力应显著高于开局：${rates.join(',')}`);
}

// 完全不建塔必定失守；满级塔可稳住前两分钟——证明难度有上下界。
{
  const doomed = fresh();
  for (let i = 0; i < 20 * 400 && doomed.mode === 'playing'; i++) doomed.update(0.05);
  assert.equal(doomed.mode, 'lost', '完全不建塔必须会失败');
  assert(doomed.endReason.length > 0);

  const held = fresh();
  held.grid[0][0] = 15;
  assert.equal(held.dropTile(0, 1, 3), true);
  for (let i = 0; i < 20 * 120 && held.mode === 'playing'; i++) held.update(0.05);
  assert.equal(held.mode, 'playing', '满级防御应能守住 120 秒');
  assert(held.kills > 50, `满级塔应大量歼灭学生（实际 ${held.kills}）`);
  assert.equal(held.towers.length, 1, '满级塔不应被轻易摧毁');
}

console.log(
  'Tower regressions passed: 6x26 map, five gardens, three targets, unique per-level logos, spawn phases, 2048 merge cap, tower/blocker drop, blocked routing, target and 六教 repair rules, two-stage breach, coder/ayi/line bosses, effect cleanup, rising pressure, and both defence extremes.',
);
