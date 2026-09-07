export const BOSSES = [
  {
    id: 'coder',
    name: '贵系 · 码农出击',
    subtitle: "That's pity",
    color: '#96ffce',
    glyph: '</>',
    move: '报错连弹 / 删库斩',
    tip: '离开标红的删除线，穿过字幕之间的空隙。',
    source: '',
    year: '图片梗',
    background: '依据玩家提供的图片创作，虚构的报错终端。',
  },
  {
    id: 'snake',
    name: '紫荆蛇园 · Chinese Snake',
    subtitle: '今天的 snack 有点长',
    color: '#c8a4ff',
    glyph: '蛇',
    move: '蛇身封路 / 蛇信扫堂',
    tip: '蛇身落点依次亮起，绕开弯曲的紫色封锁线。',
    source:
      'https://github.com/TsinghuaMemes/TsinghuaMemes/blob/main/new/梗字典.md',
    year: '校园旧梗',
    background:
      '校园梗词典记录紫荆园曾有 Chinese snake 的英文标牌梗。游戏拟物为蛇，不涉及食品安全指控。',
  },
  {
    id: 'goosequeue',
    name: '清北鹅腿抢号王',
    subtitle: '你排到了，鹅腿没了',
    color: '#ffc85d',
    glyph: '号',
    move: '排号长龙 / 售罄震荡',
    tip: '号码牌封住三条队列，找没有排队的一列。',
    source:
      'https://epaper.cqcb.com/attachment/202311/29/e5210d78-0b86-4e8c-bfe3-e332dd2f3740.pdf',
    year: '2023',
    background:
      '改编自清北学生争抢鹅腿的排队热潮，Boss 是虚构的抢号机器，鹅腿阿姨仍是补给 NPC。',
  },
  {
    id: 'bike',
    name: '学堂路逆行车王',
    subtitle: '此路段禁止低速内卷',
    color: '#8beeff',
    glyph: '铃',
    move: '逆行冲刺 / 双车道封路',
    tip: '先离开黄色行车线，车王随后冲到标记终点。',
    source: '',
    year: '玩家指定校园梗',
    background: '学堂路车神的游戏夸张对手；不对应真实事故。',
  },
  {
    id: 'weishen',
    name: '韦神 · 显然试炼',
    subtitle: '一瓶水，两馒头，此题显然',
    color: '#c4f7cb',
    glyph: '∫',
    move: '显然坐标斩 / 馒头落点',
    tip: '坐标轴交叉切割，馒头落点稍后爆发；不要站在交点。',
    source: 'https://news.ifeng.com/c/86fqMAu8BA1',
    year: '2021 · 校园常青梗',
    background:
      '采访中北大教师韦东奕拿着矿泉水和馒头的画面成为数学梗。这里是善意的解题挑战，无负面新闻含义。',
  },
  {
    id: 'swim',
    name: '五道口泳测教练',
    subtitle: '五十米，比四年还长',
    color: '#77d8ff',
    glyph: '50m',
    move: '泳道清场 / 蝶泳巨浪',
    tip: '泳道始终留出一条空道，浪环扩散时用冲刺穿过。',
    source: 'https://www.tsinghua.edu.cn/info/1182/45723.htm',
    year: '2017 · 校园常青梗',
    background:
      '取材于清华游泳测试相关规定的校园记忆；真实规定设有免测等安排。教练与招式为原创。',
  },
  {
    id: 'hotsearch',
    name: '孙宇晨 · 热搜机甲',
    subtitle: '抛光一小时，热搜一整天',
    color: '#ffb6df',
    glyph: '热搜',
    move: '磨指甲交叉斩 / 叫妈妈回声圈 / 小作文轰炸',
    tip: '先离开指甲锉红线；回声圈有两轮，冲刺穿圈；小作文雨留有空白栏。',
    source: 'https://www.thepaper.cn/newsDetail_forward_33966429',
    year: '2026 · 网络梗改编',
    background:
      '以孙宇晨相关网络梗创作的虚构机甲。2026年8月报道记录其承认长文存在虚构内容，景甜方亦有不同回应。“磨指甲”“叫妈妈”仅作为流行梗的机械招式，不代表已核实的私人经历。',
    memeSource:
      'https://www.orientaldaily.com.my/news/entertainment/2026/08/28/843735',
  },
  {
    id: 'final',
    name: '二校门 · 毕业天劫',
    subtitle: '校徽到手，毕业另算',
    color: '#ffd582',
    glyph: '清华',
    move: '二校门镇压 / 四年总复习',
    tip: '躲开盖章区域，再穿过弹幕空隙；击破它才停止计时。',
    source: '',
    year: '最终关',
    background: '游戏原创最终 Boss。合成清华校徽且前置 Boss 全部击败后登场。',
  },
] as const;
export type BossId = (typeof BOSSES)[number]['id'];
export const bossSpec = (id: BossId) => BOSSES.find((b) => b.id === id)!;
export type BossHazard = {
  id: number;
  x: number;
  y: number;
  shape: 'circle' | 'line' | 'ring';
  radius: number;
  angle: number;
  length: number;
  width: number;
  age: number;
  warn: number;
  duration: number;
  damage: number;
  label: string;
  color: string;
  motif?: 'nailfile' | 'echo' | 'essay' | BossId;
};
export function hazardHits(h: BossHazard, p: { x: number; y: number }) {
  if (h.age < h.warn || h.age > h.warn + h.duration) return false;
  const dx = p.x - h.x,
    dy = p.y - h.y;
  if (h.shape === 'circle') return Math.hypot(dx, dy) < h.radius + 12;
  if (h.shape === 'ring') {
    const radius = (h.radius * (h.age - h.warn)) / h.duration;
    return Math.abs(Math.hypot(dx, dy) - radius) < h.width + 12;
  }
  const along = dx * Math.cos(h.angle) + dy * Math.sin(h.angle);
  const across = -dx * Math.sin(h.angle) + dy * Math.cos(h.angle);
  return Math.abs(along) < h.length / 2 + 12 && Math.abs(across) < h.width + 12;
}
