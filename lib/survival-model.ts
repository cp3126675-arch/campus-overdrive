import {
  GameModel,
  type Major,
  type Enemy,
  type Snapshot,
  clamp,
  cameraView,
  distance,
} from './game-model';
import { EXAM_SCORE, examPoints, badgeStudyPoints } from './survival-score';
import { bossSpec } from './bosses';
import { mergePercent } from './battle-rules';
import type { TextbookId } from './textbooks';
import {
  SURVIVAL,
  SURVIVAL_WORLD,
  survivalZone,
  outsideSurvivalZone,
  survivalScaling,
} from './survival-rules';
export class SurvivalGameModel extends GameModel {
  score = 0;
  practiceScore = 0;
  examScore = 0;
  badgeScore = 0;
  private practiceThisExam = 0;
  private scoredBadgeLevel = 0;
  examsTaken = 0;
  private examStartedAt = 0;
  nextBossAt = SURVIVAL.firstBossAt;
  downgradeCount = 0;
  private shieldUntil = 0;
  private announcedRound = 1;
  private stormFeedback = 0;
  dashVolleysRemaining = 0;
  stormPulseUntil = 0;
  override get world() {
    return SURVIVAL_WORLD;
  }
  override start(major: Major, target: string, departmentId?: string) {
    this.score = this.practiceScore = this.examScore = this.badgeScore = 0;
    this.practiceThisExam =
      this.scoredBadgeLevel =
      this.examsTaken =
      this.examStartedAt =
        0;
    this.nextBossAt = SURVIVAL.firstBossAt;
    this.downgradeCount = 0;
    this.shieldUntil = 0;
    this.announcedRound = 1;
    this.stormFeedback = 0;
    this.dashVolleysRemaining = 0;
    this.hurtUntil = this.stormPulseUntil = 0;
    this.lastHit = 0;
    super.start(major, target, departmentId);
    const dx = this.world.width / 2 - this.player.x,
      dy = this.world.height / 2 - this.player.y;
    this.player.x += dx;
    this.player.y += dy;
    for (const entity of [...this.enemies, ...this.drops]) {
      entity.x += dx;
      entity.y += dy;
    }
    this.view = cameraView(1200, 800, this.player, this.world);
    this.notify('期末周（生存） · 徽章破碎会降阶 · 合成 +20 精力', 7);
    this.broadcast = '安全区即将收缩。徽章就是你的命，合成才能继续撑下去。';
  }
  override get nextBossLevel() {
    return 0;
  }
  override get isFinalBoss() {
    return false;
  }
  override get dropLevel() {
    return Math.min(13, this.centralLevel);
  }
  override get power() {
    return 1 + this.centralLevel * 0.36 + Math.min(this.merges, 30) * 0.07;
  }
  override get weaponTier() {
    return Math.min(3, Math.floor(this.centralLevel / 2));
  }
  get maxHp() {
    return SURVIVAL.maxHp;
  }
  get zone() {
    return survivalZone(this.time);
  }
  get breakShieldTime() {
    return Math.max(0, this.shieldUntil - this.time);
  }
  override damage(amount: number) {
    if (
      this.breakShieldTime > 0 ||
      this.invulnerable > 0 ||
      this.mode !== 'playing'
    )
      return;
    const scaled = Math.ceil(amount * survivalScaling(this.time).damage);
    this.lastHit =
      this.skillTime > 0 && this.department.kind === 'guard'
        ? Math.ceil(scaled * 0.55)
        : scaled;
    this.hurtUntil = this.time + 0.9;
    super.damage(scaled);
  }
  override heal(amount: number, fromMerge = false) {
    if (!fromMerge && this.zone.radius <= 0) return false;
    return super.heal(amount, fromMerge);
  }
  override eatFood(kind: 'goose' | 'duck') {
    if (this.mode !== 'playing') return;
    if (kind === 'goose' && this.zone.radius <= 0) {
      this.feastTime = 5;
      this.chargeSkill(8);
      this.events.push('goose');
      this.notify('鹅腿到手！解题效率加餐 · 安全区消失后仅合成恢复精力', 3);
      this.effect(
        this.player.x,
        this.player.y - 40,
        'text',
        '#baff9b',
        0,
        1.2,
        '鹅腿 · 解题效率加餐',
      );
      return;
    }
    if (kind === 'duck' && this.breakShieldTime > 0) return;
    if (kind === 'duck') {
      this.lastHit = 12;
      this.hurtUntil = this.time + 0.9;
    }
    super.eatFood(kind);
  }
  override get graduationHeal() {
    return 0;
  }
  override onMerge(level: number, x: number, y: number) {
    if (this.mode !== 'playing') return;
    const points = badgeStudyPoints(this.scoredBadgeLevel, level);
    this.scoredBadgeLevel = Math.max(this.scoredBadgeLevel, level);
    this.score += points;
    this.badgeScore += points;
    super.onMerge(level, x, y);
    this.heal(SURVIVAL.mergeHeal - 1, true);
    this.effect(x, y - 65, 'text', '#aaffc9', 0, 1, '合成恢复精力 +20');
    if (level === 14) {
      this.notify('清华解题效率已解锁！留好补给，安全区还在收缩', 4);
    }
  }
  override makeEnemy(
    kind: Enemy['kind'],
    x: number,
    y: number,
    bookId?: TextbookId,
  ) {
    const enemy = super.makeEnemy(kind, x, y, bookId);
    const scaling = survivalScaling(this.time);
    enemy.speed *= scaling.speed;
    if (kind === 'boss') {
      enemy.boss = this.bossOrder[this.examsTaken % this.bossOrder.length];
      enemy.maxHp = Math.round(
        1.25 * (1800 + this.centralLevel * 420) * scaling.hp,
      );
      this.bossMax = enemy.maxHp;
    } else
      enemy.maxHp = Math.round(enemy.maxHp * (1 + this.bossesDefeated * 0.07));
    enemy.hp = enemy.maxHp;
    return enemy;
  }
  override spawnEnemy(kind: Enemy['kind'] = 'paper', credit = 0) {
    if (this.enemies.length >= SURVIVAL.maxEnemies) return;
    const side = Math.floor(this.rng() * 4),
      v = this.view;
    let x =
      side === 0
        ? v.x + 25
        : side === 1
          ? v.x + v.width - 25
          : v.x + 60 + this.rng() * (v.width - 120);
    let y =
      side === 2
        ? v.y + 25
        : side === 3
          ? v.y + v.height - 25
          : v.y + 60 + this.rng() * (v.height - 120);
    if (distance({ x, y }, this.player) < 220) {
      x = v.x * 2 + v.width - x;
      y = v.y * 2 + v.height - y;
    }
    const enemy = this.makeEnemy(
      kind,
      clamp(x, 35, this.world.width - 35),
      clamp(y, 45, this.world.height - 45),
    );
    enemy.credit = credit;
    this.enemies.push(enemy);
  }
  override beginBoss() {
    if (this.time < this.nextBossAt) return false;
    const spawned = super.beginBoss();
    if (spawned) {
      this.examStartedAt = this.time;
      this.examsTaken++;
      if (this.enemies.length > SURVIVAL.maxEnemies)
        this.enemies = [
          ...this.enemies.filter((e) => e.kind === 'boss'),
          ...this.enemies
            .filter((e) => e.kind !== 'boss')
            .slice(0, SURVIVAL.maxEnemies - 1),
        ];
      const boss = this.enemies.find((e) => e.kind === 'boss');
      const spec = bossSpec(boss!.boss!);
      this.notify(`第${this.examsTaken}场大考 · ${spec.name} · 45秒后收卷`, 4);
    }
    return spawned;
  }
  override completeBoss(x: number, y: number) {
    const points = examPoints(
      this.bossesDefeated,
      this.time - this.examStartedAt,
    );
    this.score += points;
    this.examScore += points;
    this.practiceThisExam = 0;
    this.effect(
      this.player.x,
      this.player.y - 80,
      'text',
      '#ffe599',
      0,
      1.5,
      `大考通过 +${points}分`,
    );
    // No finite checkpoint completion or win path in survival.
    this.dashVolleysRemaining = 0;
    this.bossesDefeated++;
    this.bossDead = true;
    this.credits += 4;
    const healed = this.heal(10);
    const level = Math.min(13, this.centralLevel);
    this.spawnDrop(
      clamp(x - 45, 80, this.world.width - 80),
      clamp(y, 90, this.world.height - 90),
      level,
    );
    this.spawnDrop(
      clamp(x + 45, 80, this.world.width - 80),
      clamp(y, 90, this.world.height - 90),
      Math.max(0, level - 1),
    );
    this.round++;
    this.bossRest = 3;
    this.waveTime = 0;
    this.bossSpawned = false;
    this.nextBossAt = this.time + SURVIVAL.bossRest;
    this.spawnClock = 1;
    this.exam = null;
    this.hazards = [];
    this.wallX = null;
    this.wallWarn = false;
    this.shots = this.shots.filter((s) => !s.enemy);
    this.invulnerable = Math.max(this.invulnerable, 1.5);
    this.notify(
      `大考通过 ${this.bossesDefeated} 场！${healed ? '+10 精力 · ' : ''}24 秒后继续`,
      4,
    );
    this.events.push('credit');
  }
  override checkKills() {
    if (this.mode === 'playing') {
      const earned = this.enemies
        .filter((e) => e.kind !== 'boss' && e.hp <= 0)
        .reduce((sum, e) => sum + 10 * e.year, 0);
      const points = Math.min(
        EXAM_SCORE.practiceCap - this.practiceThisExam,
        earned,
      );
      this.practiceThisExam += points;
      this.practiceScore += points;
      this.score += points;
    }
    super.checkKills();
  }
  private collectUnfinishedExam() {
    // Time is up: no pass credit, points, healing or drops; don't reset the practice allowance.
    this.enemies = this.enemies.filter((e) => e.kind !== 'boss');
    this.hazards = [];
    this.shots = this.shots.filter((s) => !s.enemy);
    this.bossSpawned = false;
    this.bossMax = 0;
    this.dashVolleysRemaining = 0;
    this.nextBossAt = this.time + EXAM_SCORE.nextAfterTimeout;
    this.invulnerable = Math.max(this.invulnerable, 1.2);
    this.notify('收卷铃响！本场未通过，不计大考分；8秒后下一场', 5);
  }
  override finish(won: boolean, reason = '') {
    if (won || this.mode !== 'playing') return;
    if (this.hp <= 0 && this.centralLevel > 0) {
      const next = this.centralLevel - 1;
      this.inventory = [next];
      this.hp = this.maxHp;
      this.downgradeCount++;
      this.shieldUntil = this.time + SURVIVAL.breakShield;
      // Dedicated timer: exact 1.2 active seconds, including hit-stop. Other immunity stays independent.
      this.invulnerable = 0;
      this.shake = 8;
      this.effect(this.player.x, this.player.y, 'ring', '#a4f8ff', 125, 0.45);
      this.notify(
        `徽章破碎！降至 Lv.${next + 1} · 同修徽章清空 · 护盾 1.2 秒`,
        3,
      );
      return;
    }
    super.finish(false, reason);
  }
  override dash() {
    if (this.dashVolleysRemaining > 0) return false;
    const used = super.dash();
    const boss = this.enemies.find((e) => e.kind === 'boss');
    if (
      used &&
      this.dashTime > 0 &&
      boss &&
      survivalScaling(this.time).attackRate >= SURVIVAL.attackRateCap
    ) {
      this.dashVolleysRemaining = 3;
      this.dashCooldown = Math.max(
        4,
        this.bossAttack / SURVIVAL.attackRateCap +
          (2 * this.bossAttackInterval(boss)) / SURVIVAL.attackRateCap,
      );
    }
    return used;
  }
  override bossVolley(boss: Enemy) {
    this.dashVolleysRemaining = Math.max(0, this.dashVolleysRemaining - 1);
    const first = this.shots.length;
    super.bossVolley(boss);
    const originals = this.shots.slice(first);
    const extra = Math.floor(
      originals.length * (survivalScaling(this.time).density - 1),
    );
    // Cluster limited extra bullets beside original lanes without filling the authored openings.
    for (let i = 0; i < extra; i++) {
      const source = originals[Math.floor((i * originals.length) / extra)];
      const offset = i % 2 ? -0.022 : 0.022;
      const angle = Math.atan2(source.vy, source.vx) + offset;
      const speed = Math.hypot(source.vx, source.vy);
      this.shots.push({
        ...source,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        baseAngle:
          (source.baseAngle ?? Math.atan2(source.vy, source.vx)) + offset,
        hits: [],
      });
    }
    this.limitProjectiles();
  }
  override castBoss(boss: Enemy) {
    const first = this.hazards.length;
    super.castBoss(boss);
    const strong = boss.boss === 'goosequeue' || boss.boss === 'swim';
    if (strong) {
      for (const h of this.hazards.slice(first)) {
        h.warn += 0.2;
        if (h.shape === 'line') h.width *= 0.85;
      }
    } else if (this.bossCast % 2 === 1) {
      // Extra invigilation for formerly easy examiners; always leave an adjacent lane.
      const v = this.view,
        laneWidth = v.width / 3;
      const current = clamp(
        Math.floor((this.player.x - v.x) / laneWidth),
        0,
        2,
      );
      const gap =
        current === 1 ? (Math.floor(this.bossCast / 2) % 2 ? 0 : 2) : 1;
      const labels: Record<string, string> = {
        coder: '编译限时卷',
        snake: '蛇形附加题',
        bike: '借道补测',
        weishen: '显然加试',
        hotsearch: '小作文抽查',
        final: '毕业材料抽检',
      };
      for (let lane = 0; lane < 3; lane++)
        if (lane !== gap)
          this.addHazard(
            'line',
            v.x + laneWidth * (lane + 0.5),
            v.y + v.height / 2,
            labels[boss.boss!] || '随堂点名',
            bossSpec(boss.boss!).color,
            {
              angle: Math.PI / 2,
              length: v.height + 50,
              width: Math.max(12, laneWidth / 2 - 28),
              warn: 2.1,
              duration: 0.45,
              damage: 23,
              motif: boss.boss,
            },
          );
    }
    // Preserve existing previews; omit newly authored excess, never a shown warning.
    this.hazards.length = Math.min(this.hazards.length, SURVIVAL.maxHazards);
  }
  private limitProjectiles() {
    let count = 0;
    for (const shot of this.shots) if (shot.enemy) count++;
    if (
      count <= SURVIVAL.maxHostileProjectiles &&
      this.shots.length <= SURVIVAL.maxProjectiles
    )
      return;
    const hostile = this.shots
      .filter((s) => s.enemy)
      .slice(-SURVIVAL.maxHostileProjectiles);
    const friendly = this.shots
      .filter((s) => !s.enemy)
      .slice(-(SURVIVAL.maxProjectiles - hostile.length));
    this.shots = [...hostile, ...friendly];
  }
  override update(dt: number, moveX: number, moveY: number) {
    if (
      this.mode !== 'playing' ||
      this.orientationBlocked ||
      !Number.isFinite(dt) ||
      dt <= 0
    ) {
      super.update(dt, moveX, moveY);
      return;
    }
    // Recycle distant ordinary enemies without rewards; keep the battlefield local and bounded.
    this.enemies = this.enemies.filter(
      (e) =>
        e.kind === 'boss' ||
        distance(e, this.player) <
          Math.max(this.view.width, this.view.height) * 1.5,
    );
    const before = this.time;
    const scaling = survivalScaling(this.time);
    if (this.bossSpawned && this.hitstop <= 0) {
      const extra = Math.min(dt, 0.05) * (scaling.attackRate - 1);
      this.bossAttack -= extra;
    }
    // Strength increases even if a player stalls the same 大考 through later pressure rounds.
    for (const enemy of this.enemies) {
      if (enemy.kind !== 'boss') continue;
      const after = survivalScaling(this.time + dt).hp;
      enemy.hp *= after / scaling.hp;
      enemy.maxHp *= after / scaling.hp;
      this.bossMax = enemy.maxHp;
    }
    const activeBoss = this.enemies.find((e) => e.kind === 'boss');
    if (!activeBoss) this.dashVolleysRemaining = 0;
    if (activeBoss && this.dashVolleysRemaining > 0) {
      this.dashCooldown = Math.max(
        this.dashCooldown,
        Math.max(0, this.bossAttack) / scaling.attackRate +
          ((this.dashVolleysRemaining - 1) *
            this.bossAttackInterval(activeBoss)) /
            scaling.attackRate,
      );
    }
    super.update(dt, moveX, moveY);
    this.view.x = clamp(
      this.player.x - this.view.width / 2,
      0,
      this.world.width - this.view.width,
    );
    this.view.y = clamp(
      this.player.y - this.view.height / 2,
      0,
      this.world.height - this.view.height,
    );
    if (this.mode !== 'playing') return;
    if (
      this.bossSpawned &&
      this.time - this.examStartedAt >= EXAM_SCORE.examLimit
    )
      this.collectUnfinishedExam();
    const zone = this.zone;
    if (zone.round > this.announcedRound) {
      this.announcedRound = zone.round;
      this.announce(
        zone.radius > 0
          ? `第 ${zone.round} 轮 · 安全区收缩`
          : '安全区消失 · 仅合成可恢复精力！',
        '#ff997e',
      );
      this.notify(`圈外每秒 −${zone.damagePerSecond} 精力 · 合成 +20`, 4);
    }
    const exposed = Math.max(0, this.time - Math.max(before, this.shieldUntil));
    if (outsideSurvivalZone(this.player, zone) && exposed > 0) {
      const loss = zone.damagePerSecond * exposed;
      // Storm ignores combat/dash immunity, but honours the full badge-break shield.
      this.hp = Math.max(1, this.hp - loss);
      if (loss > 0 && this.time >= this.stormFeedback) {
        this.stormFeedback = this.time + 0.8;
        this.stormPulseUntil = this.time + 0.28;
        this.effect(
          this.player.x,
          this.player.y - 55,
          'text',
          '#ff987f',
          0,
          0.6,
          `圈外 −${zone.damagePerSecond}/秒`,
        );
      }
    }
    this.limitProjectiles();
  }
  override snapshot(): Snapshot {
    return {
      ...super.snapshot(),
      mergeProgress: mergePercent(this.centralLevel),
      survival: {
        score: this.score,
        practiceScore: this.practiceScore,
        examScore: this.examScore,
        badgeScore: this.badgeScore,
        practiceRemaining: EXAM_SCORE.practiceCap - this.practiceThisExam,
        examRemaining: this.bossSpawned
          ? Math.max(0, EXAM_SCORE.examLimit - (this.time - this.examStartedAt))
          : 0,
        examsTaken: this.examsTaken,
        dashVolleysRemaining: this.dashVolleysRemaining,
        maxHp: this.maxHp,
        nextBossIn: Math.max(0, this.nextBossAt - this.time),
        cycle:
          1 +
          Math.floor(
            Math.max(0, this.examsTaken - 1) /
              Math.max(1, this.bossOrder.length),
          ),
        damageScale: survivalScaling(this.time).damage,
        downgradeCount: this.downgradeCount,
        shieldTime: this.breakShieldTime,
        zone: this.zone,
        outsideZone: outsideSurvivalZone(this.player, this.zone),
        hurtTime: Math.max(0, this.hurtUntil - this.time),
        invincibleTime: Math.max(this.breakShieldTime, this.invulnerable),
        stormPulse: Math.max(0, this.stormPulseUntil - this.time),
      },
    };
  }
}
