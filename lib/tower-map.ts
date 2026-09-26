// 塔防模式地图：来自 工作簿1.xlsx 的 Sheet2（B2:G27，6 列 × 26 行）。
// 坐标：col 0=B … 5=G；row 0 对应表格第 2 行 … row 25 对应第 27 行。
//
// 单元格类型：
//  - empty   不在地图范围内（表格空白）
//  - road    道路（含“&道路”的刷新点/路口，本体仍是路）
//  - spawn   敌人（学生）刷新点，附带 garden 名称
//  - tower   防御点（可建塔 / 也可作为路口阻挡）
//  - target  进攻对象（有血量，被摧毁会爆炸）
//  - destination  目的地：六教（两阶段血量）

export type CellType =
  | 'empty'
  | 'road'
  | 'spawn'
  | 'tower'
  | 'target'
  | 'destination';

export interface TowerCell {
  type: CellType;
  /** 刷新点的园名 */
  garden?: string;
  /** 防御点 / 进攻对象 / 目的地的展示名 */
  name?: string;
}

export const GRID_COLS = 6;
export const GRID_ROWS = 26;

// 原始表格内容（按 B..G 顺序，空字符串为空白）。
const RAW: string[][] = [
  ['敌人刷新点：桃李园&道路', '', '敌人刷新点：紫荆园&道路', '', '', ''],
  ['道路', '道路', '道路', '', '', ''],
  ['道路', '', '道路', '', '', ''],
  ['道路', '防御点：C楼', '道路', '防御点：紫操', '', ''],
  ['道路', '', '道路', '', '', ''],
  ['道路', '道路', '道路', '道路', '道路', ''],
  ['道路', '', '道路', '', '道路', ''],
  ['道路', '防御点：社区服务中心', '道路', '防御点：微型消防站', '道路', ''],
  ['道路', '', '道路', '', '道路', ''],
  ['敌人刷新点：丁香园&道路', '道路', '道路', '道路', '道路', '道路'],
  ['道路', '', '', '', '道路', ''],
  ['道路', '', '', '攻击目标：苏世民书院', '道路', ''],
  ['敌人刷新点：听涛园', '道路', '', '', '道路', ''],
  ['防御点：路口&道路', '道路', '道路', '道路', '防御点：路口&道路', ''],
  ['道路', '敌人刷新点：清芬园&道路', '', '', '道路', ''],
  ['防御点：老环境楼', '道路', '', '防御点：青年交流中心', '道路', ''],
  ['道路', '', '', '', '道路', ''],
  ['道路', '', '防御点：天猫超市', '', '道路', ''],
  ['道路', '', '', '', '道路', ''],
  ['道路', '道路', '道路', '道路', '道路', ''],
  ['道路', '防御点：人文社科图书馆', '', '', '道路', ''],
  ['道路', '', '', '进攻目标：土木馆', '道路', ''],
  ['道路', '进攻目标：人文楼', '', '', '道路', ''],
  ['道路', '道路', '防御点：路口&道路', '道路', '道路', ''],
  ['', '', '道路', '', '', ''],
  ['', '', '目的地：六教', '', '', ''],
];

function parseCell(text: string, col: number, row: number): TowerCell {
  const v = text.trim();
  if (!v) return { type: 'empty' };
  if (v.startsWith('敌人刷新点')) {
    const garden = v.split('：')[1]?.replace('&道路', '').trim() ?? `园${row}`;
    return { type: 'spawn', garden };
  }
  // 表格里同时存在“攻击目标”和“进攻目标”两种写法，都要识别为进攻对象。
  if (v.startsWith('攻击目标') || v.startsWith('进攻目标'))
    return { type: 'target', name: v.split('：')[1]?.trim() ?? `进攻目标${row}` };
  if (v.startsWith('目的地')) return { type: 'destination', name: v.split('：')[1]?.trim() ?? '六教' };
  if (v.startsWith('防御点')) return { type: 'tower', name: v.split('：')[1]?.trim() ?? `防御点${row}` };
  if (v === '道路' || v.includes('道路')) return { type: 'road' };
  return { type: 'road' };
}

export const CELLS: TowerCell[][] = RAW.map((row, r) =>
  row.map((text, c) => parseCell(text, c, r)),
);

/** 六教（目的地）所在格 */
export const DESTINATION = (() => {
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (CELLS[r][c].type === 'destination') return { col: c, row: r };
  return { col: 2, row: 25 };
})();

export interface SpawnPoint {
  col: number;
  row: number;
  garden: string;
}

export const SPAWNS: SpawnPoint[] = (() => {
  const out: SpawnPoint[] = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (CELLS[r][c].type === 'spawn')
        out.push({ col: c, row: r, garden: CELLS[r][c].garden! });
  return out;
})();

export interface TargetDef {
  col: number;
  row: number;
  name: string;
}

export const TARGETS: TargetDef[] = (() => {
  const out: TargetDef[] = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (CELLS[r][c].type === 'target')
        out.push({ col: c, row: r, name: CELLS[r][c].name! });
  return out;
})();

export interface TowerSlot {
  col: number;
  row: number;
  name: string;
}

export const TOWER_SLOTS: TowerSlot[] = (() => {
  const out: TowerSlot[] = [];
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (CELLS[r][c].type === 'tower')
        out.push({ col: c, row: r, name: CELLS[r][c].name! });
  return out;
})();

/**
 * 计算从每个可通行格到目的地的最短距离（BFS），用于学生寻路。
 * blocked 为被阻挡（放置了阻挡块）的格集合，键为 `${col},${row}`。
 * 防御塔所在格仍视为可通行（学生路过并攻击），只有阻挡块阻断路径。
 */
export function buildFlowField(blocked: Set<string>): number[][] {
  const dist: number[][] = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => Infinity),
  );
  const passable = (c: number, r: number) => {
    if (c < 0 || r < 0 || c >= GRID_COLS || r >= GRID_ROWS) return false;
    const t = CELLS[r][c].type;
    if (t === 'empty') return false;
    return !blocked.has(`${c},${r}`);
  };
  const { col: dc, row: dr } = DESTINATION;
  const queue: [number, number][] = [[dc, dr]];
  dist[dr][dc] = 0;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (queue.length) {
    const [c, r] = queue.shift()!;
    for (const [dx, dy] of dirs) {
      const nc = c + dx,
        nr = r + dy;
      if (passable(nc, nr) && dist[nr][nc] === Infinity) {
        dist[nr][nc] = dist[r][c] + 1;
        queue.push([nc, nr]);
      }
    }
  }
  return dist;
}
