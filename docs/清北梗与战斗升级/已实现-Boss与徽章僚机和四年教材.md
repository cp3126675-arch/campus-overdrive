# 已实现：独立 Boss、徽章僚机和四年教材（2026-09-07）

## 战斗内容

- 6 个独立 Boss：码农出击、4+4 特快通道、指鼠为鸭鉴定机、论文复制帝国、毕设外包机甲、署名流水线。每局打乱顺序，完整六场内不重复；与小怪轮次循环，最终合成仍是唯一胜利条件。
- 码农以玩家提供的图片为终端面板，释放 That's pity 字幕弹幕与三条带预警的删库斩；它不是教材放大。
- 4+4 的两轮四枚成绩单印章、传送出口、论文弹幕；食堂鉴定机的扩散圈与餐盘；复制机的有缺口阵列；外包机甲的三连追问；署名工厂的交替横竖传送带。
- 地面攻击有至少 1.1 秒预警；预警不扣血，激活后才判定。Boss 半血后加快施法；击败后清除其敌弹和地面攻击。死亡、胜利、暂停保持原有计时与结算规则。
- 30 个徽章各有具名武器与梗文案，8 类行为：穿透、散射、波动、追踪、爆炸、回旋、连锁、分裂。具体配置见 lib/badge-weapons.ts。
- 中央徽章 = 自己的武器 + 数学穿透 / 计算机并行追踪 / 建筑范围爆破。周围最多 4 枚徽章独立从轨道位置射击，不继承主修；渲染位置和实际发射位置使用同一份模型数据。伤害按每一枚自身等级计算。
- 清华校徽触发毕业炮和结算过渡，合成时立即停止挑战计时。
- 24 本书、每个主修 8 本、每个年级 2 本，实际使用出版社或作者公开封面。只生成当前主修、当前年级的书；每 55 秒或最高徽章达到 Lv.5 / 9 / 13 升级，取更快者。
- 大一基础碰撞伤害 6，大二约 11，大三约 16，大四约 21；厚书、DDL 精英和长期轮次另有小幅加成。大三单发、大四三连远程弹；大四之后继续按轮次和时间增强。
- 年级与数值为游戏编排，不代表学校官方课程安排或教材学术难度。
- 原有手机摇杆、双指技能、横竖屏、安全区、实景运动背景、车神照片、鸭鹅腿规则均保留。菜单增加独立战斗图鉴，战斗中不弹出选择界面。

## 新闻事实与虚构改编

以下均改编违规现象为虚构机器，不使用涉事人照片。没有把网传未经证实的家庭背景或指控加入游戏，也没有将个案概括为全体学生的情况。

1. 2022 西安电子科技大学毕设代做：通报确认购买代码并用于论文实验等学术不端，作出留校察看和取消相关推免资格等处分。虚构为 ZIP 外包机甲。
来源：https://m.thepaper.cn/newsDetail_forward_18342242
2. 2023 江西“鼠头鸭脖”：联合调查组确认异物为鼠类头部，纠正此前结论。虚构为食堂鉴定机。
来源：https://news.southcn.com/node_13461c79b3/d623789993.shtml
3. 2024 华中农业大学黄某某事件：学校通报教师学术不端等问题并作出处分。虚构为论文复制机。
来源：https://edu.cnr.cn/dj/20240206/t20240206_526586523.shtml
4. 2025 肖某董某莹事件：8 月 15 日后续通报明确伪造成绩单、论文抄袭剽窃、不当署名等问题，并纠正了部分有关其他学生的网传说法。仅将核实的问题抽象成学分炼金和复制机制，没有把正常 4+4 医学培养本身设为违规。
来源：https://www.news.cn/politics/20250815/8d08145558824d2b95733e6e77c5993d/c.html
5. 2026 中山大学公布的 2025 年至 2026 年 3 月案件处理信息含买卖论文和虚假署名案例。虚构为署名流水线。网页全文已通过直接 HTTP 请求核对。
来源：https://xuefeng.sysu.edu.cn/gzdt/1421873.htm

## 验证

- TypeScript 与修改文件的 lint 检查通过；静态输出和项目构建另见发布记录。
- 自动化断言覆盖 24 本书、主修隔离、年级递进、碰撞伤害、30 徽章 × 3 主修组合、僚机真实位置与伤害、6 种不同 Boss 攻击、预警无伤/激活伤害与结束清理，以及原有的合成、飞行补给、计时、双指摇杆行为。
- 不修改角色生命或无敌状态的模拟，加上躲避可见预警和靠近敌弹时冲刺的策略，数学 154.6 秒、计算机 110.1 秒、建筑 106.9 秒完成合成；剩余生命分别 69、100、52。
- 旧的模拟走位没有躲避新增攻击时，数学和建筑会死亡。新增攻击确实构成风险，没有为了让旧模拟通过而关闭伤害。
- 未进行浏览器操作、截图视觉测试或手机真机测试。

## 本轮新增封面来源

- ode：https://www.tup.com.cn/booksCenter/book_02465505.html；原图 https://www.tup.com.cn/upload/bigbookimg/024655-05.jpg
- real：https://www.tup.com.cn/booksCenter/book_07170002.html；原图 https://www.tup.com.cn/upload/bigbookimg/071700-02.jpg
- complex：https://www.tup.com.cn/booksCenter/book_09302901.html；原图 https://www.tup.com.cn/upload/bigbookimg/093029-01.jpg
- numerical：https://www.tup.com.cn/booksCenter/book_08980301.html；原图 https://www.tup.com.cn/upload/bigbookimg/089803-01.jpg
- functional：https://www.tup.com.cn/booksCenter/book_02693101.html；原图 https://www.tup.com.cn/upload/bigbookimg/026931-01.jpg
- c：https://www.tup.com.cn/booksCenter/book_09003301.html；原图 https://www.tup.com.cn/upload/bigbookimg/090033-01.jpg
- discrete：https://www.tup.com.cn/booksCenter/book_09590201.html；原图 https://www.tup.com.cn/upload/bigbookimg/095902-01.jpg
- computer：https://www.tup.com.cn/booksCenter/book_03704801.html；原图 https://www.tup.com.cn/upload/bigbookimg/037048-01.jpg
- compiler：https://www.tup.com.cn/booksCenter/book_02631503.html；原图 https://www.tup.com.cn/upload/bigbookimg/026315-03.jpg
- design：https://www.tup.com.cn/booksCenter/book_09303001.html；原图 https://www.tup.com.cn/upload/bigbookimg/093030-01.jpg
- thermal：https://www.tup.com.cn/booksCenter/book_00758202.html；原图 https://www.tup.com.cn/upload/bigbookimg/007582-02.jpg
- structure：https://www.tup.com.cn/booksCenter/book_11186101.html；原图 https://www.tup.com.cn/upload/bigbookimg/111861-01.jpg
- urban：https://www.tup.com.cn/booksCenter/book_05216704.html；原图 https://www.tup.com.cn/upload/bigbookimg/052167-04.jpg
- green：https://www.tup.com.cn/booksCenter/book_06999901.html；原图 https://www.tup.com.cn/upload/bigbookimg/069999-01.jpg
- ml：https://www.tup.com.cn/booksCenter/book_06402703.html；原图 https://www.tup.com.cn/upload/bigbookimg/064027-03.jpg
