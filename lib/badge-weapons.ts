export type WeaponPattern =
  | 'lance'
  | 'fan'
  | 'wave'
  | 'homing'
  | 'burst'
  | 'return'
  | 'chain'
  | 'split';
export type BadgeWeapon = {
  name: string;
  joke: string;
  glyph: string;
  pattern: WeaponPattern;
  color: string;
};
// Affectionate fictional campus caricatures, not claims about students.
export const BADGE_WEAPONS: Record<string, BadgeWeapon> = {
  xinya: {
    name: '通识嘴炮',
    joke: '聊着聊着，从柏拉图聊到你精神内耗。',
    glyph: '哲',
    pattern: 'fan',
    color: '#eab7db',
  },
  zhili: {
    name: '万物皆可证',
    joke: '打完再补一句：显然。',
    glyph: '∴',
    pattern: 'lance',
    color: '#83daff',
  },
  rixin: {
    name: '日更万字',
    joke: '昨天的论文，今天就拿来砸你。',
    glyph: '文',
    pattern: 'split',
    color: '#ffbf78',
  },
  tanwei: {
    name: '显微镜开大',
    joke: '你已经小到可以写进实验报告了。',
    glyph: 'μ',
    pattern: 'homing',
    color: '#cda3ff',
  },
  xingjian: {
    name: '行健健身环',
    joke: '体育课没下课，只是把跑圈改成刷题。',
    glyph: '杠',
    pattern: 'return',
    color: '#9aafff',
  },
  weiyang: {
    name: '双学位双倍肝',
    joke: '别人一次交一份，我一次交两条命。',
    glyph: '×2',
    pattern: 'fan',
    color: '#a0e7ff',
  },
  qiuzhen: {
    name: '显然核弹',
    joke: '省略三百页证明，直接得出你没了。',
    glyph: '∀',
    pattern: 'burst',
    color: '#ffa9a9',
  },
  weixian: {
    name: '跨界缝合术',
    joke: '什么都懂一点，所以什么弹都来一点。',
    glyph: 'AI',
    pattern: 'split',
    color: '#c9a7ff',
  },
  xiuzhong: {
    name: '碳中和回旋镖',
    joke: '草稿排放超标？回收再算一次。',
    glyph: '碳',
    pattern: 'return',
    color: '#8ceac4',
  },
  dushi: {
    name: '实干大铁锤',
    joke: '理论先放着，先把这道难题敲定。',
    glyph: '锤',
    pattern: 'burst',
    color: '#82d4ff',
  },
  zhishan: {
    name: '向善劝退书',
    joke: '同学，放下屠刀，接一下判定。',
    glyph: '善',
    pattern: 'wave',
    color: '#ffa882',
  },
  wuqiong: {
    name: '轨道快递',
    joke: '地址写太空，导弹还是能送到你家。',
    glyph: '航',
    pattern: 'homing',
    color: '#9dbdff',
  },
  zijin: {
    name: '紫气东来',
    joke: '不管什么课，先给它卷出紫色特效。',
    glyph: '紫',
    pattern: 'wave',
    color: '#eca5ff',
  },
  ziqiang: {
    name: '再肝一轮',
    joke: '别人下课，我的回旋镖开始第二学位。',
    glyph: '肝',
    pattern: 'return',
    color: '#e8a7ff',
  },
  shuimu: {
    name: '水论文木鱼',
    joke: '功德加一，参考文献加一，弹幕加一。',
    glyph: '鱼',
    pattern: 'chain',
    color: '#9edcde',
  },
  jianyuan: {
    name: '甲方改到爆',
    joke: '最终版_final_真的不改了_炸。',
    glyph: '改',
    pattern: 'burst',
    color: '#ffc58c',
  },
  jixie: {
    name: '螺丝升天',
    joke: '拧一颗螺丝，拧出加特林的气势。',
    glyph: '⚙',
    pattern: 'fan',
    color: '#c2b3ff',
  },
  wuxi: {
    name: '信号不好电一下',
    joke: '无系不是没信号，是把信号全打你了。',
    glyph: 'Ω',
    pattern: 'chain',
    color: '#b2a7ff',
  },
  guixi: {
    name: '递归甩锅',
    joke: '不是我的锅，是下一层调用的锅。',
    glyph: '</>',
    pattern: 'split',
    color: '#87ffda',
  },
  shuxue: {
    name: '显然穿透',
    joke: '剩下的证明留作习题。',
    glyph: '∫',
    pattern: 'lance',
    color: '#e7ff91',
  },
  shengke: {
    name: '细胞有丝分裂',
    joke: '实验没结果，作业先裂成两份。',
    glyph: '胞',
    pattern: 'split',
    color: '#9aebb2',
  },
  gongwu: {
    name: '可控小太阳',
    joke: '报告老师，这次点亮的是绩点。',
    glyph: '☢',
    pattern: 'burst',
    color: '#ffcd75',
  },
  leixi: {
    name: '闭环追着打',
    joke: '误差不归零，导弹不下班。',
    glyph: 'PID',
    pattern: 'homing',
    color: '#d0a5ff',
  },
  tongji: {
    name: '显著性散弹',
    joke: '一枪不显著，多打几枪样本就够了。',
    glyph: 'p<.05',
    pattern: 'fan',
    color: '#d2c3ff',
  },
  chayuan: {
    name: '量子叠加茶',
    joke: '同时在摸鱼和输出，观测后只剩输出。',
    glyph: '茶',
    pattern: 'wave',
    color: '#99c7ff',
  },
  yixue: {
    name: '手术刀点名',
    joke: '同学别动，正在精准切除你的错题。',
    glyph: '✚',
    pattern: 'homing',
    color: '#ffb3ce',
  },
  jingguan: {
    name: '做空难度',
    joke: '现金流为正，作业存量为负。',
    glyph: '¥',
    pattern: 'chain',
    color: '#f5dc8a',
  },
  faxue: {
    name: '法槌一锤定音',
    joke: '我方主张：对方立即原地去世。',
    glyph: '判',
    pattern: 'burst',
    color: '#cab4ff',
  },
  meiyuan: {
    name: '五彩斑斓的黑',
    joke: '甲方说再亮一点，于是整条街亮了。',
    glyph: '墨',
    pattern: 'wave',
    color: '#ffacd9',
  },
  qinghua: {
    name: '二校门毕业炮',
    joke: '二校门盖章，最终 Boss 当场毕业。',
    glyph: '清',
    pattern: 'burst',
    color: '#f4d8ff',
  },
};
export const badgeWeapon = (key: string) =>
  BADGE_WEAPONS[key] || BADGE_WEAPONS.shuxue;
export const MAJOR_MODS = {
  math: '积分穿透',
  cs: '并行追踪',
  arch: '蓝图爆破',
};
export const weaponName = (key: string, major: keyof typeof MAJOR_MODS) =>
  `${badgeWeapon(key).name} · ${MAJOR_MODS[major]}`;
