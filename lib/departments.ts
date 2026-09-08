import designs from './departments.json';
import type { WeaponPattern } from './badge-weapons';
export type SkillKind =
  | 'guard'
  | 'blades'
  | 'wave'
  | 'heal'
  | 'frost'
  | 'drones'
  | 'gravity'
  | 'beam'
  | 'flame'
  | 'rush'
  | 'storm'
  | 'rain'
  | 'execute'
  | 'orbit';
export type Department = Omit<
  (typeof designs)[number],
  'profile' | 'pattern' | 'kind'
> & {
  profile: 'math' | 'cs' | 'arch';
  pattern: WeaponPattern;
  kind: SkillKind;
};
export const DEPARTMENTS = designs as Department[];
export const DEFAULT_DEPARTMENTS = {
  math: 'd041',
  cs: 'd027',
  arch: 'd000',
} as const;
export const department = (id: string) =>
  DEPARTMENTS.find((d) => d.id === id) ?? DEPARTMENTS[41];
export const SKILL_RULES: Record<SkillKind, string> = {
  guard: '蓝图护航：退回飞来的题目，减轻45%压力并持续解答近处练习',
  blades: '旋转批注长刃，快速处理身边练习',
  wave: '连续扩散知识环，解答环面上的题目',
  heal: '学习光场缓慢恢复精力，同时处理近处练习',
  frost: '冻结DDL，显著放慢题目；大考只受部分影响',
  drones: '多架助教无人机独立追踪答题',
  gravity: '把题目吸入引力场，越靠中心解题越快',
  beam: '贯穿知识光束，扫过整列题目',
  flame: '朝移动方向持续喷出扇形复习火焰',
  rush: '加速赶课，顺路处理身边练习',
  storm: '灵感闪电连续解答最近的多份练习',
  rain: '在题目位置空投范围批注',
  execute: '集中批阅近处练习，对快答完的题目加速收尾',
  orbit: '多枚助学卫星绕身，碰到题目就作答',
};
export type SkillZone = {
  x: number;
  y: number;
  shape: 'circle' | 'line' | 'ring' | 'cone';
  radius: number;
  angle: number;
  width: number;
  length: number;
};
export function skillZones(
  d: Department,
  elapsed: number,
  p: { x: number; y: number; dx: number; dy: number },
  targets: { x: number; y: number }[],
): SkillZone[] {
  const base: SkillZone = {
    x: p.x,
    y: p.y,
    shape: 'circle',
    radius: d.range,
    angle: 0,
    width: 22,
    length: d.range * 2,
  };
  const angle = elapsed * 2.3;
  if (d.kind === 'beam' || d.kind === 'blades')
    return Array.from({ length: d.kind === 'beam' ? 2 : 3 }, (_, i) => ({
      ...base,
      shape: 'line',
      angle: angle + (i * Math.PI) / (d.kind === 'beam' ? 2 : 3),
      length: d.kind === 'beam' ? 1000 : d.range * 1.5,
      width: d.kind === 'beam' ? 20 : 13,
    }));
  if (d.kind === 'orbit' || d.kind === 'drones')
    return Array.from({ length: d.count }, (_, i) => ({
      ...base,
      x: p.x + Math.cos(angle + (i * Math.PI * 2) / d.count) * d.range * 0.55,
      y: p.y + Math.sin(angle + (i * Math.PI * 2) / d.count) * d.range * 0.55,
      radius: d.kind === 'orbit' ? 35 : 17,
    }));
  if (d.kind === 'wave')
    return [
      {
        ...base,
        shape: 'ring',
        radius: 35 + ((elapsed % 1.2) / 1.2) * d.range,
        width: 24,
      },
    ];
  if (d.kind === 'flame')
    return [
      {
        ...base,
        shape: 'cone',
        angle: Math.atan2(p.dy, p.dx),
        width: Math.PI / 3,
      },
    ];
  if (d.kind === 'storm' || d.kind === 'rain')
    return targets.slice(0, d.count).map((e) => ({
      ...base,
      x: e.x,
      y: e.y,
      radius: d.kind === 'storm' ? 25 : 55,
    }));
  return [
    {
      ...base,
      radius: d.kind === 'rush' ? 80 : d.kind === 'guard' ? 135 : d.range,
    },
  ];
}
export function skillHits(
  z: SkillZone,
  e: { x: number; y: number; r: number },
) {
  const dx = e.x - z.x,
    dy = e.y - z.y,
    dist = Math.hypot(dx, dy);
  if (z.shape === 'ring') return Math.abs(dist - z.radius) < z.width + e.r;
  if (z.shape === 'line')
    return (
      Math.abs(dx * Math.cos(z.angle) + dy * Math.sin(z.angle)) <
        z.length / 2 + e.r &&
      Math.abs(-dx * Math.sin(z.angle) + dy * Math.cos(z.angle)) < z.width + e.r
    );
  if (z.shape === 'cone') {
    const a = Math.atan2(dy, dx) - z.angle;
    return (
      dist < z.radius + e.r &&
      Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < z.width / 2
    );
  }
  return dist < z.radius + e.r;
}
