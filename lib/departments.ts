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
  guard: '展开蓝图盾，反射敌弹、减伤 45% 并灼伤近敌',
  blades: '旋转长刃，切割身边的敌人',
  wave: '连续扩散冲击环，按环面命中',
  heal: '治疗光场缓慢回血，同时伤害近敌',
  frost: '冻结领域大幅减速，Boss 受到部分减速',
  drones: '多架无人机独立发射追踪弹',
  gravity: '引力场拉近敌人，中心造成更高伤害',
  beam: '旋转贯穿光束，切割整条射线',
  flame: '朝移动方向喷射扇形持续火焰',
  rush: '提高移动速度，碾压近身敌人',
  storm: '闪电连续锁定最近的多个敌人',
  rain: '在敌人位置投放范围轰炸',
  execute: '审判近敌，对低血量目标追加伤害',
  orbit: '多枚轨道卫星绕身碰撞攻击',
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
    return targets
      .slice(0, d.count)
      .map((e) => ({
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
