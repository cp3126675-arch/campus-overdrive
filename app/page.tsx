/* eslint-disable next/no-img-element -- Original badge assets are also served by the standalone static export. */
'use client';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Bike,
  Sparkles,
  Users,
  Trophy,
  RotateCcw,
  ArrowLeft,
  ChevronRight,
  BookOpen,
  UserRound,
} from 'lucide-react';
import { requestLandscape } from '@/lib/mobile-display';
import { useGameInput } from '@/hooks/use-game-input';
import { type InputMode } from '@/lib/input-mode';
import release from '@/public/version.json';
import { assetUrl } from '@/lib/asset-url';
import { DEPARTMENTS, department, SKILL_RULES } from '@/lib/departments';
import { YEAR_NAMES } from '@/lib/textbooks';
import { badgeWeapon } from '@/lib/badge-weapons';
import { useOnlineScores } from '@/hooks/use-online-scores';
import { useRecords } from '@/hooks/use-records';
import { PlayerNameDialog } from '@/components/player-name-dialog';
import { GameRecords } from '@/components/game-records';
import { formatRecordTime } from '@/lib/records';
import { GameJoystick } from '@/components/game-joystick';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { CampusGame, initialSnapshot, type Snapshot } from '@/lib/game';
const fmt = (seconds: number) => {
  const n = Math.floor(Math.max(0, seconds) * 10);
  return `${Math.floor(n / 600)
    .toString()
    .padStart(
      2,
      '0',
    )}:${Math.floor(n / 10) % 60 < 10 ? '0' : ''}${Math.floor(n / 10) % 60}.${n % 10}`;
};
export default function Home() {
  const stage = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<CampusGame | null>(null);
  const [snap, setSnap] = useState<Snapshot>(initialSnapshot);
  const {
    books: records,
    result: recordResult,
    beginRun,
    latestScore,
  } = useRecords(snap);
  const onlineScores = useOnlineScores(latestScore);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [chooseMajorAfterName, setChooseMajorAfterName] = useState(false);
  const [variant, setVariant] = useState<'race' | 'survival'>('race');
  const [departmentId, setDepartmentId] = useState('d041');
  const [query, setQuery] = useState('');
  const [ready, setReady] = useState(false);
  const [assetError, setAssetError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState({ done: 0, total: 0 });
  const { mode: inputMode, touch: touchControls, changeMode } = useGameInput();
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState(false);
  const launchPending = useRef(false);
  const [muted, setMuted] = useState(false);
  const [menuStep, setMenuStep] = useState<'title' | 'major'>('title');
  const [helpOpen, setHelpOpen] = useState(false);
  const selectionHeading = useRef<HTMLHeadingElement>(null);
  const selected = department(departmentId);
  const matches = DEPARTMENTS.filter((d) =>
    `${d.name} ${d.parent} ${d.joke} ${({ d027: '贵系', d028: '雷系', d026: '无系', d057: '茶园 叉院', d111: '仙院' } as Record<string, string>)[d.id] || ''}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const menu = snap.mode === 'menu';
  const survival = snap.survival;
  const ended = snap.mode === 'won' || snap.mode === 'lost';
  const centralLevel = Math.max(0, ...snap.inventory);
  const central = snap.chain[centralLevel];
  useEffect(() => {
    if (!canvas.current) return;
    const g = new CampusGame(canvas.current, setSnap);
    game.current = g;
    g.load((done, total) => {
      if (game.current === g) setLoadProgress({ done, total });
    })
      .then((failed) => {
        if (game.current === g) setAssetError(failed.length > 0);
      })
      .catch(() => {
        if (game.current === g) setAssetError(true);
      })
      .finally(() => {
        if (game.current === g) {
          setReady(true);
          setLoading(false);
        }
      });
    return () => {
      g.destroy();
      game.current = null;
    };
  }, []);
  useEffect(() => {
    if (menu && menuStep === 'major') selectionHeading.current?.focus();
  }, [menu, menuStep]);
  useLayoutEffect(() => {
    game.current?.setTouchControls(touchControls);
  }, [touchControls]);
  useEffect(() => {
    if (game.current)
      game.current.nickname = onlineScores.identity?.nickname || '';
  }, [onlineScores.identity]);
  useEffect(() => {
    if (game.current) game.current.editingNickname = nameOpen;
    return () => {
      if (game.current) game.current.editingNickname = false;
    };
  }, [nameOpen]);
  const editNickname = () => {
    if (game.current?.model.mode === 'playing') game.current.togglePause();
    setRecordsOpen(false);
    setChooseMajorAfterName(false);
    setNameOpen(true);
  };
  const enterMode = (mode: 'race' | 'survival') => {
    setVariant(mode);
    void requestLandscape(touchControls);
    if (!onlineScores.identity) {
      setChooseMajorAfterName(true);
      setNameOpen(true);
    } else setMenuStep('major');
  };
  const inputPicker = (id: string) => (
    <label className="input-mode-picker" htmlFor={id}>
      操作方式
      <select
        id={id}
        value={inputMode}
        onChange={(e) => changeMode(e.target.value as InputMode)}
      >
        <option value="auto">自动</option>
        <option value="touch">触控</option>
        <option value="keyboard">键鼠</option>
      </select>
    </label>
  );
  const movePlayer = useCallback(
    (x: number, y: number) => game.current?.setMove(x, y),
    [],
  );
  const start = async () => {
    const g = game.current;
    if (!g || !ready || launchPending.current) return;
    if (!onlineScores.identity) {
      setChooseMajorAfterName(true);
      setNameOpen(true);
      return;
    }
    g.nickname = onlineScores.identity.nickname;
    launchPending.current = true;
    setLaunching(true);
    setLaunchError(false);
    setHelpOpen(false);
    setRecordsOpen(false);
    void requestLandscape(touchControls);
    try {
      const missing = await g.prepareDepartment(selected.id, variant);
      if (game.current !== g) return;
      beginRun(selected.id, variant);
      g.start(selected.profile, selected.badge, selected.id, variant);
      if (missing.length) g.model.notify('部分图片暂未载入，已启用备用显示', 4);
      setMenuStep('title');
    } catch {
      setLaunchError(true);
    } finally {
      launchPending.current = false;
      setLaunching(false);
    }
  };
  const toggleSound = () => {
    setMuted(!muted);
    game.current?.setMuted(!muted);
  };
  return (
    <main
      ref={stage}
      className={`challenge ${menu ? 'is-lobby' : 'is-battle'} ${ended ? 'is-ending' : ''} ${touchControls ? 'touch-controls' : 'desktop-controls'}`}
    >
      <canvas
        ref={canvas}
        tabIndex={menu ? -1 : 0}
        aria-label="徽章校园，WASD 或方向键移动，E 合成，空格车神冲刺，Q 院系绝招，P 暂停"
      />
      {menu ? (
        <div
          className={`title-screen ${menuStep === 'major' ? 'choosing-major' : ''}`}
        >
          <img
            className="title-background"
            src={assetUrl('/art/tsinghua-gate-1280.jpg')}
            sizes="(max-width: 1000px) 40vw, 100vw"
            alt="晨光下的清华大学二校门"
            fetchPriority="high"
          />
          <div className="title-shade" />
          <div className="title-tools">
            <Button
              className="player-name-button"
              variant="ghost"
              onClick={editNickname}
              title="设置或修改昵称"
            >
              <UserRound size={16} />
              <span>{onlineScores.identity?.nickname || '设置昵称'}</span>
            </Button>
            {inputPicker('title-input-mode')}
            <Button
              size="icon"
              variant="ghost"
              aria-label={muted ? '开启音效' : '关闭音效'}
              title={muted ? '开启音效' : '关闭音效'}
              onClick={toggleSound}
            >
              {muted ? <VolumeX /> : <Volume2 />}
            </Button>
          </div>
          {menuStep === 'title' ? (
            <section className="title-menu" aria-label="主菜单">
              <span className="title-mode">徽章合成 · 毕业竞速 / 期末周</span>
              <h1>
                合成<span>清华</span>
              </h1>
              <div className="title-rule" />
              <nav className="title-actions" aria-label="游戏菜单">
                <Button
                  className="title-start"
                  onClick={() => enterMode('race')}
                >
                  <Play size={21} fill="currentColor" />
                  竞速模式
                  <ChevronRight className="menu-arrow" size={21} />
                </Button>
                <Button
                  className="title-start survival-start"
                  onClick={() => enterMode('survival')}
                >
                  <Sparkles size={21} />
                  期末周（生存）
                  <ChevronRight className="menu-arrow" size={21} />
                </Button>
                <Button
                  className="title-help"
                  variant="ghost"
                  onClick={() => setHelpOpen(true)}
                >
                  <BookOpen size={19} />
                  操作说明
                </Button>
                <Button
                  className="title-help"
                  variant="ghost"
                  onClick={() => setRecordsOpen(true)}
                >
                  <Trophy size={19} />
                  毕业排行榜
                </Button>
              </nav>
            </section>
          ) : (
            <section className="major-select-screen" aria-label="选择主修">
              <Button
                variant="ghost"
                className="back-to-title"
                disabled={launching}
                onClick={() => setMenuStep('title')}
              >
                <ArrowLeft size={18} />
                返回
              </Button>
              <h2 ref={selectionHeading} tabIndex={-1}>
                选择主修
              </h2>
              <p className="selection-subtitle">
                {variant === 'survival'
                  ? '期末周 · 通过大考，争取更高总分'
                  : '毕业竞速 · 合成清华，挑战更短毕业用时'}
              </p>
              {variant === 'survival' && (
                <p className="survival-rules-note">
                  精力耗尽，徽章降一级并清空同修徽章；补考保护1.2秒。
                  每场大考45秒，按总分排名，拖时间不加分。
                </p>
              )}
              <div className="department-picker">
                <label htmlFor="department-search">查找院系 / 书院</label>
                <input
                  id="department-search"
                  disabled={launching}
                  type="search"
                  placeholder="搜索：计算机、雷系、书院…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <label htmlFor="department-select">
                  {matches.length} 个方向
                </label>
                <select
                  id="department-select"
                  disabled={launching}
                  value={
                    matches.some((d) => d.id === departmentId)
                      ? departmentId
                      : ''
                  }
                  onChange={(e) => setDepartmentId(e.target.value)}
                >
                  <option value="" disabled>
                    {matches.length ? '选择一个方向' : '没有匹配的方向'}
                  </option>
                  {[...new Set(matches.map((d) => d.group))].map((group) => (
                    <optgroup key={group} label={group}>
                      {matches
                        .filter((d) => d.group === group)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.parent ? `${d.parent} / ` : ''}
                            {d.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div
                className="department-loadout"
                aria-live="polite"
                style={{ borderColor: selected.color }}
              >
                <img
                  src={assetUrl(`/badges/${selected.badge}.png`)}
                  alt="初始徽章"
                />
                <div>
                  <b>{selected.name}</b>
                  <p>普攻 · {selected.attack}</p>
                  <p>Q · {selected.skill}</p>
                  <small>{SKILL_RULES[selected.kind]}</small>
                  <em>{selected.joke}</em>
                </div>
              </div>
              <Button
                className="launch-button"
                disabled={!ready || launching}
                onClick={start}
              >
                <Play size={19} />
                {launching
                  ? '正在准备本局教材…'
                  : launchError
                    ? '教材加载失败，点击重试'
                    : ready
                      ? '开始挑战'
                      : `正在加载 ${loadProgress.done}/${loadProgress.total || '…'}`}
              </Button>
              {assetError && (
                <div className="asset-recovery">
                  <output>部分图片暂未载入，可以先开始游戏。</output>
                  <button
                    disabled={loading || launching}
                    onClick={async () => {
                      const g = game.current;
                      if (!g || loading) return;
                      setLoading(true);
                      try {
                        const failed = await g.load((done, total) =>
                          setLoadProgress({ done, total }),
                        );
                        setAssetError(failed.length > 0);
                      } catch {
                        setAssetError(true);
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    {loading
                      ? `重试中 ${loadProgress.done}/${loadProgress.total}`
                      : '重试图片'}
                  </button>
                </div>
              )}
            </section>
          )}
          <footer className="title-footer">
            <span>
              {release.version.includes('-')
                ? '本地候选 · 未发布'
                : '非官方校园游戏'}{' '}
              · v{release.version}
            </span>
            <span className="photo-credit">
              <a
                href="https://commons.wikimedia.org/wiki/File:2019年二校門.jpg"
                target="_blank"
                rel="noreferrer"
              >
                二校门 · 清華匿名學生 / CC0
              </a>
            </span>
          </footer>
          <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
            <DialogContent
              container={stage}
              className="game-guide"
              showCloseButton={false}
            >
              <DialogTitle className="guide-title">操作说明</DialogTitle>
              <DialogDescription className="guide-goal">
                毕业竞速比谁更早完成答辩；期末周比谁拿到更高总分。
              </DialogDescription>
              <dl className="guide-keys">
                <div>
                  <dt>移动</dt>
                  <dd>WASD / 方向键</dd>
                </div>
                <div>
                  <dt>徽章合成</dt>
                  <dd>E</dd>
                </div>
                <div>
                  <dt>车神冲刺</dt>
                  <dd>空格</dd>
                </div>
                <div>
                  <dt>院系绝招</dt>
                  <dd>Q · 充能后使用</dd>
                </div>
                <div>
                  <dt>暂停 / 继续</dt>
                  <dd>P / Esc</dd>
                </div>
              </dl>
              <p className="guide-note">
                中央徽章融合主修自动答题，周围徽章也会独立答题。拾取两枚相同徽章即可合成。课程练习与
                大考按合成进度依次出现；合出最终校徽后，通过最终大考
                才毕业。期末周（生存）循环出现
                大考，安全区不断收缩；精力耗尽时徽章降一级、同修徽章清空，获得
                1.2 秒补考保护，精力恢复满格。合成恢复精力
                +20，最低级徽章破碎才结束。
                圈外压力无视车神冲刺保护，破碎护盾可抵挡。安全区消失后，仅合成可恢复精力，鹅腿保留解题效率加成。90秒后全场圈外，4分钟达到每秒8点压力上限，最低保留1点精力。大考限时45秒，通过得1000分起并重置练习300分额度；首次徽章进阶也计分，时间不加分。两种模式暂停期间均不计时。
              </p>
              <p className="guide-food">
                <span>鹅腿 +24 精力</span>
                <span>鸭腿 −12 精力</span>
              </p>
              <p className="guide-note">
                鹅腿和鸭腿由阿姨补给站抛出，8
                秒后飞走。投放逐渐加快，后期鸭腿更多，可能连续数轮没有鹅腿。补给站本身不恢复精力。触控模式横屏游玩，手机竖放时画面自动旋转。摇杆未显示时，可在首页或暂停菜单将操作方式切换为“触控”。左手拖动摇杆，右手点击技能，可同时操作。松开摇杆即停，答题自动瞄准。
              </p>
              <DialogClose render={<Button className="launch-button" />}>
                返回游戏菜单
              </DialogClose>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <>
          <div className="battle-hud">
            <div
              className={`hp-panel ${snap.hurtTime ? 'is-taking-damage' : ''} ${snap.hp <= 35 ? 'is-critical' : ''}`}
            >
              <div>
                <b>
                  精力 {Math.ceil(snap.hp)}
                  {survival ? ` / ${Math.ceil(survival.maxHp)}` : ''}
                </b>
                <span>
                  {central?.short} Lv.{centralLevel + 1}
                </span>
              </div>
              <div className="hp-track">
                <i style={{ width: `${snap.hp}%` }} />
              </div>
            </div>
            <div className="race-clock">
              <small>
                {survival
                  ? `期末周 · ${survival.score.toLocaleString()} 分`
                  : '毕业用时'}
              </small>
              <strong>{fmt(snap.time)}</strong>
            </div>
            <div className="wave-hud">
              <b>
                {snap.bossHp > 0
                  ? snap.bossName
                  : survival
                    ? `已通过${snap.bossesDefeated}场 · 徽章 ${snap.mergeProgress}%`
                    : `${YEAR_NAMES[snap.year]} · 合成 ${snap.mergeProgress}%`}
              </b>
              <span>
                {survival
                  ? snap.bossHp > 0
                    ? `第${survival.cycle}轮考试 · 距收卷${Math.ceil(survival.examRemaining)}秒`
                    : `${Math.ceil(survival.nextBossIn)} 秒后大考 · 已通过 ${snap.bossesDefeated}`
                  : snap.bossHp > 0
                    ? `大考 ${snap.bossesDefeated + 1}/${snap.totalBosses}`
                    : `下一场大考 ${snap.nextBossProgress}% · 已过 ${snap.bossesDefeated}/${snap.totalBosses}`}
              </span>
              <div className="boss-track">
                <i
                  style={{
                    width: `${snap.bossHp > 0 ? snap.bossHp : snap.mergeProgress}%`,
                  }}
                />
              </div>
            </div>
            <div className="battle-options">
              <Button
                size="icon"
                variant="ghost"
                aria-label={muted ? '开启声音' : '关闭声音'}
                onClick={() => {
                  setMuted(!muted);
                  game.current?.setMuted(!muted);
                }}
              >
                {muted ? <VolumeX /> : <Volume2 />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={ended}
                aria-label={snap.mode === 'paused' ? '继续' : '暂停'}
                onClick={() => game.current?.togglePause()}
              >
                {snap.mode === 'paused' ? <Play /> : <Pause />}
              </Button>
            </div>
          </div>
          {survival && (
            <div
              className={`survival-pressure ${survival.outsideZone ? 'is-exhausted' : ''}`}
            >
              {survival.zone.radius <= 0
                ? `无安全区 · 每秒 −${survival.zone.damagePerSecond} 精力`
                : survival.outsideZone
                  ? `圈外！每秒 −${survival.zone.damagePerSecond} · 跟随箭头进圈`
                  : `安全区内 · ${Math.ceil(survival.zone.nextRoundIn)} 秒后下一轮`}
              <span>
                第 {survival.zone.round} 轮 · 圈外保留1点精力 · 合成 +20
                {survival.invincibleTime > 0 ? ' · 无敌中' : ''}
              </span>
            </div>
          )}
          <div className="quest-hud">
            <span>
              {snap.questTitle} · {snap.questText}
            </span>
            <small>
              学分 {snap.credits}　{Math.ceil(snap.questRemaining)}s
            </small>
          </div>
          {!ended && (
            <div className="battle-toast" aria-live="polite">
              {snap.notice}
            </div>
          )}
          <div className="battle-bottom">
            {touchControls && (
              <GameJoystick
                enabled={snap.mode === 'playing' && !snap.orientationBlocked}
                onMove={movePlayer}
              />
            )}
            <div className="held-badges">
              {snap.inventory.map((lv, i) => (
                <span
                  key={i}
                  title={badgeWeapon(snap.chain[lv].key).name}
                  className={lv === centralLevel ? 'largest' : ''}
                >
                  <img
                    src={assetUrl(`/badges/${snap.chain[lv].key}.png`)}
                    alt={snap.chain[lv].name}
                  />
                  <small>{lv + 1}</small>
                </span>
              ))}
            </div>
            <div className="battle-skills">
              <button
                aria-label="学堂路车神冲刺"
                disabled={snap.mode !== 'playing' || snap.dashCooldown > 0}
                onPointerDown={(e) => {
                  if (e.button === 0) {
                    e.preventDefault();
                    game.current?.dash();
                  }
                }}
                onClick={(e) => {
                  if (e.detail === 0) game.current?.dash();
                }}
              >
                <Bike />
                <b>
                  {survival?.dashVolleysRemaining
                    ? `再躲${survival.dashVolleysRemaining}轮`
                    : snap.dashCooldown > 0
                      ? `${snap.dashCooldown.toFixed(1)}s`
                      : '车神'}
                </b>
                <kbd>SPACE</kbd>
              </button>
              <button
                aria-label="合成相同徽章"
                className={snap.canMerge ? 'ready-merge' : ''}
                disabled={snap.mode !== 'playing' || !snap.canMerge}
                onPointerDown={(e) => {
                  if (e.button === 0) {
                    e.preventDefault();
                    game.current?.merge();
                  }
                }}
                onClick={(e) => {
                  if (e.detail === 0) game.current?.merge();
                }}
              >
                <Sparkles />
                <b>合成</b>
                <kbd>E</kbd>
              </button>
              <button
                aria-label={`${snap.skillName}，充能 ${snap.skillCharge}%`}
                className={snap.skillCharge >= 100 ? 'ready-skill' : ''}
                disabled={
                  snap.mode !== 'playing' ||
                  snap.skillCharge < 100 ||
                  snap.skillTime > 0
                }
                onPointerDown={(e) => {
                  if (e.button === 0) {
                    e.preventDefault();
                    game.current?.skill();
                  }
                }}
                onClick={(e) => {
                  if (e.detail === 0) game.current?.skill();
                }}
              >
                <Users />
                <span className="skill-tooltip">{snap.skillName}</span>
                <b>
                  {snap.skillTime > 0
                    ? '释放中'
                    : snap.skillCharge >= 100
                      ? '院系绝招'
                      : `${snap.skillCharge}%`}
                </b>
                <kbd>Q</kbd>
              </button>
            </div>
          </div>
        </>
      )}
      {snap.mode === 'paused' && !snap.orientationBlocked && (
        <div className="game-modal">
          <section>
            <Pause size={34} />
            <h2>计时暂停</h2>
            <p>徽章和校园都在等你。</p>
            {inputPicker('pause-input-mode')}
            <Button variant="ghost" onClick={editNickname}>
              <UserRound size={16} />
              修改昵称
            </Button>
            <Button
              className="launch-button"
              onClick={() => game.current?.togglePause()}
            >
              <Play />
              继续挑战
            </Button>
            <Button variant="ghost" onClick={() => game.current?.toMenu()}>
              返回主菜单
            </Button>
          </section>
        </div>
      )}
      {ended && snap.endProgress < 1 && (
        <div
          className={`ending-scene ${snap.mode === 'won' ? 'victory' : 'defeat'}`}
          aria-live="polite"
        >
          <div className="ending-emblem">
            <img
              src={assetUrl(
                `/badges/${snap.mode === 'won' ? 'qinghua' : central?.key}.png`,
              )}
              alt=""
            />
          </div>
          <h2>{snap.mode === 'won' ? '最终大考通过' : '挑战结束'}</h2>
          <p>
            {snap.mode === 'won'
              ? '毕业留影，为你定格'
              : '歇一口气，再再修一学期'}
          </p>
        </div>
      )}
      {ended && snap.endProgress >= 1 && (
        <div className="game-modal result-reveal">
          <section>
            {snap.mode === 'won' ? (
              <img
                className="victory-badge"
                src={assetUrl('/badges/qinghua.png')}
                alt="清华大学校徽"
              />
            ) : (
              <Trophy size={42} />
            )}
            <h2>
              {survival
                ? '本周期末周结束'
                : snap.mode === 'won'
                  ? '毕业审核通过！'
                  : '这次差一点。'}
            </h2>
            <small>
              {survival
                ? '期末周总得分'
                : snap.mode === 'won'
                  ? '完整毕业用时'
                  : '本次挑战用时'}
            </small>
            <strong className="result-time">
              {survival ? survival.score.toLocaleString() : fmt(snap.time)}
              {survival ? ' 分' : ''}
            </strong>
            {survival && (
              <small>
                坚持 {fmt(snap.time)} · 大考 {survival.examScore} / 练习{' '}
                {survival.practiceScore} / 进阶 {survival.badgeScore}
              </small>
            )}
            <p>
              {snap.mode === 'won'
                ? '挑战目标：下一次，比这次更快。'
                : snap.endReason}
            </p>
            {recordResult && (snap.mode === 'won' || !!survival) && (
              <output className="record-celebration">
                <b>
                  {recordResult.newBest
                    ? '新纪录！刷新本院系个人最佳'
                    : '本院系个人最佳'}
                </b>
                <strong>
                  {survival
                    ? `${recordResult.bestScore.toLocaleString()} 分`
                    : formatRecordTime(recordResult.bestMs)}
                </strong>
                {!recordResult.persisted && (
                  <small>浏览器未允许保存，本次成绩仅在当前页面保留。</small>
                )}
              </output>
            )}
            <div className="result-stats">
              {snap.forgedAt !== null && (
                <span>
                  校徽合成 <b>{fmt(snap.forgedAt)}</b>
                </span>
              )}
              <span>
                通过大考 <b>{snap.bossesDefeated}</b>
              </span>
              <span>
                合成次数 <b>{snap.merges}</b>
              </span>
              <span>
                最高连对 <b>{snap.bestCombo}</b>
              </span>
            </div>
            {(snap.mode === 'won' || !!survival) && (
              <small className="online-score-status">
                {onlineScores.message ||
                  (onlineScores.identity
                    ? '成绩将在联网后提交全服榜'
                    : '打开排行榜，设置昵称后即可提交全服成绩')}
              </small>
            )}
            {survival && (
              <small className="survival-result-note">
                累计掉阶 {survival.downgradeCount} 次 · 到达循环{' '}
                {survival.cycle}
                <br />
                总分优先，同分用时短者在前；单纯拖时间不加分。
              </small>
            )}
            <Button className="launch-button" onClick={start}>
              <RotateCcw />
              {survival ? '再撑久一点' : '重新计时挑战'}
            </Button>
            <Button variant="ghost" onClick={editNickname}>
              <UserRound size={16} />
              修改昵称
            </Button>
            <Button variant="ghost" onClick={() => setRecordsOpen(true)}>
              <Trophy size={16} />
              {survival ? '查看期末周成绩' : '查看竞速排行'}
            </Button>
            <Button variant="ghost" onClick={() => game.current?.toMenu()}>
              重新选择主修
            </Button>
          </section>
        </div>
      )}
      {nameOpen && (
        <PlayerNameDialog
          online={onlineScores}
          container={stage}
          onClose={() => setNameOpen(false)}
          onSaved={() => {
            setNameOpen(false);
            if (chooseMajorAfterName) {
              game.current?.toMenu();
              setMenuStep('major');
            }
          }}
        />
      )}
      {recordsOpen && (
        <GameRecords
          books={records}
          initialMode={variant}
          online={onlineScores}
          open={recordsOpen}
          onOpenChange={setRecordsOpen}
          container={stage}
          onEditNickname={editNickname}
        />
      )}
    </main>
  );
}
