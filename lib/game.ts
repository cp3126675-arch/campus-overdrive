import { drawSurvivalZone, drawBadgeBreakShield } from './survival-render';
import { SurvivalGameModel } from './survival-model';
import colleges from './colleges.json';
import { assetUrl } from './asset-url';
import { GameMusic } from './music';
import { needsLandscape } from './battle-rules';
import { ImageLoader, loadImageBatch } from './image-loader';
import { roundRect } from './canvas-compat';
import { bossEdgeCue, layoutAttributes } from './mobile-display';
import { textbook, YEAR_NAMES } from './textbooks';
import { BOSS_PHOTOS, departmentBooks, enemyBookPhoto } from './combat-photos';
import { badgeWeapon } from './badge-weapons';
import { bossSpec } from './bosses';
import {
  GameModel,
  type Major,
  type Snapshot,
  initialSnapshot,
  clamp,
  cameraView,
  BADGE_LIFETIME,
  ENDING_SECONDS,
  supplyStation,
  type Enemy,
  type Shot,
} from './game-model';
export { initialSnapshot };
export type { Major, Snapshot };
const rects = {
  paper: [655, 25, 575, 505],
  clock: [20, 580, 600, 635],
  boss: [630, 545, 615, 705],
};
interface ToolContext {
  registerTool(
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ): void | Promise<void>;
}
export class CampusGame {
  model: GameModel = new GameModel();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private emit: (s: Snapshot) => void;
  private keys = new Set<string>();
  private move = { x: 0, y: 0 };
  private assets = new Map<string, HTMLImageElement>();
  private raf = 0;
  private last = 0;
  private emitClock = 0;
  private visualClock = 0;
  private sceneryClock = 0;
  private scenerySpeed = 1;
  private observer: ResizeObserver;
  private destroyed = false;
  private muted = false;
  private audio: AudioContext | null = null;
  private music = new GameMusic();
  private abort = new AbortController();
  private width = 900;
  private height = 540;
  private touch = false;
  constructor(c: HTMLCanvasElement, emit: (s: Snapshot) => void) {
    this.canvas = c;
    this.ctx = c.getContext('2d')!;
    this.emit = emit;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(c);
    window.addEventListener('resize', this.viewportResize);
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.registerTools();
  }
  private imageLoader = new ImageLoader(() => new Image());
  async load(progress?: (done: number, total: number) => void) {
    // Only four essentials block entry; late-game portraits are fetched near their encounter.
    return this.loadImages(
      [
        ['campus', '/art/xuetang-road.jpg'],
        ['memes', '/art/meme-atlas.png'],
        ['qinghua', '/badges/qinghua.png'],
        ['shuxue', '/badges/shuxue.png'],
      ],
      progress,
    );
  }
  async prepareDepartment(id: string, variant: 'race' | 'survival' = 'race') {
    this.unlockAudio();
    return this.loadImages([
      ...departmentBooks(id).map((p) => [p.id, `/art/${p.file}`]),
      ...(variant === 'survival'
        ? [['campus-map', '/art/tsinghua-campus-map.jpg']]
        : []),
    ]);
  }
  private async loadImages(
    defs: string[][],
    progress?: (done: number, total: number) => void,
  ) {
    return loadImageBatch(
      defs.filter(([key]) => !this.assets.has(key)),
      (src) => this.imageLoader.load(assetUrl(src)),
      (key, img) => {
        if (!this.destroyed) this.assets.set(key, img);
      },
      progress,
    );
  }
  private resourceClock = 0;
  private resourceRetry = new Map<string, number>();
  private resourcePending = new Set<string>();
  private streamAssets() {
    const m = this.model;
    if (m.mode === 'menu') return;
    const ids = new Set([
      ...m.inventory,
      m.centralLevel + 1,
      m.centralLevel + 2,
    ]);
    const defs: string[][] = [...ids].flatMap((i) =>
      m.chain[i] ? [[m.chain[i].key, `/badges/${m.chain[i].key}.png`]] : [],
    );
    defs.push(['bike-photo', '/art/bike-photo.jpg']);
    if (m instanceof SurvivalGameModel)
      defs.push(['campus-map', '/art/tsinghua-campus-map.jpg']);
    const next =
      m.bossOrder[
        m instanceof SurvivalGameModel
          ? m.bossesDefeated % m.bossOrder.length
          : m.bossesDefeated
      ];
    if (next) {
      const photo = BOSS_PHOTOS[next];
      defs.push([`boss-photo-${next}`, `/art/${photo.file}`]);
    }
    // Retry failed critical assets and this department's covers without blocking play.
    defs.push(
      ['campus', '/art/xuetang-road.jpg'],
      ['memes', '/art/meme-atlas.png'],
    );
    defs.push(
      ...departmentBooks(m.department.id).map((p) => [p.id, `/art/${p.file}`]),
    );
    for (const [key, src] of defs) {
      if (
        this.assets.has(key) ||
        this.resourcePending.has(key) ||
        (this.resourceRetry.get(key) || 0) > this.visualClock
      )
        continue;
      this.resourcePending.add(key);
      void this.imageLoader
        .load(assetUrl(src))
        .then((img) => {
          if (!this.destroyed) this.assets.set(key, img);
        })
        .catch(() => this.resourceRetry.set(key, this.visualClock + 20))
        .finally(() => this.resourcePending.delete(key));
    }
  }
  setTouchControls(touch: boolean) {
    this.touch = touch;
    this.resize();
  }
  private viewportResize = () => this.resize();
  private resize() {
    const r = {
      width: this.canvas.clientWidth,
      height: this.canvas.clientHeight,
    };
    const stage = this.canvas.closest<HTMLElement>('.challenge');
    if (stage) {
      for (const [key, value] of Object.entries(
        layoutAttributes(r.width, r.height),
      ))
        stage.setAttribute(key, value);
      stage.dataset.rotated = String(
        getComputedStyle(stage).getPropertyValue('--game-rotated').trim() ===
          '1',
      );
    }
    this.keys.clear();
    this.move = { x: 0, y: 0 };
    this.width = r.width;
    this.height = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, this.touch ? 1.5 : 2);
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.syncOrientation();
  }
  private syncOrientation() {
    const blocked =
      (this.model.mode === 'playing' || this.model.mode === 'paused') &&
      needsLandscape(this.touch, this.width, this.height);
    if (this.model.orientationBlocked !== blocked) {
      this.model.orientationBlocked = blocked;
      this.keys.clear();
      this.move = { x: 0, y: 0 };
      this.last = performance.now();
      this.emit(this.model.snapshot());
    }
  }
  start(
    major: Major,
    target: string,
    departmentId?: string,
    variant: 'race' | 'survival' = 'race',
  ) {
    if (this.model instanceof SurvivalGameModel !== (variant === 'survival'))
      this.model =
        variant === 'survival' ? new SurvivalGameModel() : new GameModel();
    this.unlockAudio();
    this.keys.clear();
    this.move = { x: 0, y: 0 };
    this.projectileCache.clear();
    this.bookCache.clear();
    this.model.start(major, target, departmentId);
    this.streamAssets();
    this.syncOrientation();
    this.sceneryClock = 0;
    this.scenerySpeed = 1;
    this.last = performance.now();
    this.emit(this.model.snapshot());
    this.canvas.focus({ preventScroll: true });
  }
  toMenu() {
    this.keys.clear();
    this.move = { x: 0, y: 0 };
    this.model.toMenu();
    this.music.update(this.model.hp, this.model.mode, 0);
    this.emit(this.model.snapshot());
  }
  togglePause() {
    if (this.model.orientationBlocked) return;
    this.model.togglePause();
    this.music.update(this.model.hp, this.model.mode, 0);
    this.last = performance.now();
    this.keys.clear();
    this.move = { x: 0, y: 0 };
    this.emit(this.model.snapshot());
    if (this.model.mode === 'playing')
      this.canvas.focus({ preventScroll: true });
  }
  setMove(x: number, y: number) {
    this.move = this.model.orientationBlocked
      ? { x: 0, y: 0 }
      : { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }
  dash() {
    this.unlockAudio();
    this.model.dash();
  }
  merge() {
    this.unlockAudio();
    this.model.merge();
    this.emit(this.model.snapshot());
  }
  skill() {
    this.unlockAudio();
    this.model.skill();
    this.emit(this.model.snapshot());
  }
  setMuted(v: boolean) {
    this.muted = v;
    this.music.setMuted(v);
    if (!v) this.unlockAudio();
  }
  private unlockAudio() {
    this.music.unlock();
    try {
      if (!this.audio) this.audio = new AudioContext();
      if (this.audio.state === 'suspended')
        void this.audio.resume().catch(() => {});
    } catch {}
  }
  private keydown = (e: KeyboardEvent) => {
    if (this.model.orientationBlocked) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    const k = e.key.toLowerCase();
    if (
      [
        'w',
        'a',
        's',
        'd',
        'arrowup',
        'arrowdown',
        'arrowleft',
        'arrowright',
        ' ',
        'e',
        'q',
        'p',
        'escape',
      ].includes(k) &&
      this.model.mode !== 'menu'
    ) {
      e.preventDefault();
      this.keys.add(k);
      if (!e.repeat) {
        if (k === ' ') this.dash();
        if (k === 'e') this.merge();
        if (k === 'q') this.skill();
        if (k === 'p' || k === 'escape') this.togglePause();
      }
    }
  };
  private keyup = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  private blur = () => {
    this.keys.clear();
    this.move = { x: 0, y: 0 };
    if (this.model.mode === 'playing') {
      this.model.togglePause();
      this.music.update(this.model.hp, this.model.mode, 0);
      this.emit(this.model.snapshot());
    }
  };
  private visibility = () => {
    if (document.hidden) this.blur();
  };
  private frame = (now: number) => {
    if (this.destroyed) return;
    const dt = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    this.visualClock += dt;
    const x =
      (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) -
      (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0) +
      this.move.x;
    const y =
      (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) -
      (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0) +
      this.move.y;
    this.model.view = cameraView(
      this.width,
      this.height,
      this.model.player,
      this.model.world,
    );
    this.model.update(dt, x, y);
    this.model.view = cameraView(
      this.width,
      this.height,
      this.model.player,
      this.model.world,
    );
    if (this.model.mode === 'playing' && !this.model.orientationBlocked) {
      const step = Math.min(dt, 0.05);
      const pace =
        this.model.dashTime > 0 ? 3.4 : this.model.bossSpawned ? 1.8 : 1;
      this.scenerySpeed +=
        (pace - this.scenerySpeed) * (1 - Math.exp(-step * 5));
      this.sceneryClock += step * this.scenerySpeed;
    }
    // A burst may emit dozens of identical sounds; one per type/frame is enough.
    for (const event of new Set(this.model.events.splice(0))) this.sound(event);
    this.resourceClock += dt;
    if (this.resourceClock >= 1) {
      this.resourceClock = 0;
      this.streamAssets();
    }
    this.music.update(this.model.hp, this.model.mode, dt, document.hidden);
    this.drawClock += dt;
    if (
      this.model.mode === 'playing' ||
      (this.model.endingTime > 0 && this.model.endingTime < ENDING_SECONDS) ||
      this.drawClock >= 0.1
    ) {
      this.drawClock = 0;
      this.draw();
    }
    this.emitClock += dt;
    if (this.emitClock > 0.1) {
      this.emitClock = 0;
      this.emit(this.model.snapshot());
    }
    this.raf = requestAnimationFrame(this.frame);
  };
  private drawClock = 0;
  private sound(kind: string) {
    if (this.muted || !this.audio || this.audio.state !== 'running') return;
    const ac = this.audio;
    const o = ac.createOscillator(),
      g = ac.createGain();
    const t = ac.currentTime;
    const specs: Record<string, [number, number, number]> = {
      shot: [500, 170, 0.025],
      pickup: [800, 1100, 0.07],
      merge: [220, 980, 0.34],
      dash: [120, 650, 0.3],
      impact: [180, 40, 0.12],
      skill: [100, 1400, 0.65],
      goose: [550, 1150, 0.25],
      combo: [450, 1300, 0.2],
      hurt: [120, 45, 0.15],
      credit: [650, 1250, 0.3],
      alarm: [400, 150, 0.45],
      win: [540, 1600, 0.8],
      lose: [170, 50, 0.65],
    };
    const [f, end, d] = specs[kind] || [400, 500, 0.1];
    o.type = ['hurt', 'impact'].includes(kind)
      ? 'sawtooth'
      : kind === 'skill'
        ? 'triangle'
        : 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(end, t + d);
    g.gain.setValueAtTime(kind === 'shot' ? 0.015 : 0.055, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g);
    g.connect(ac.destination);
    o.start();
    o.stop(t + d);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  private circle(
    x: number,
    y: number,
    r: number,
    fill: string,
    stroke?: string,
    width = 2,
  ) {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = width;
      c.stroke();
    }
  }
  private text(
    s: string,
    x: number,
    y: number,
    size = 16,
    color = '#fff',
    align: CanvasTextAlign = 'center',
  ) {
    const c = this.ctx;
    c.font = `600 ${size}px system-ui, "PingFang SC", sans-serif`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.strokeStyle = '#132329b8';
    c.lineWidth = 4;
    c.strokeText(s, x, y);
    c.fillStyle = color;
    c.fillText(s, x, y);
  }
  private badge(key: string, x: number, y: number, r: number, glow = false) {
    const c = this.ctx,
      img = this.assets.get(key);
    c.save();
    if (glow) {
      c.shadowColor = '#d5b4ff';
      c.shadowBlur = 16;
    }
    this.circle(x, y, r + 2, '#ffffffed', '#bda5e4', 2);
    if (img) c.drawImage(img, x - r, y - r, r * 2, r * 2);
    else
      this.text(
        colleges.find((b) => b.key === key)?.short || '清华',
        x,
        y,
        Math.max(10, r * 0.45),
        '#513975',
      );
    c.restore();
  }
  private sprite(
    type: keyof typeof rects,
    x: number,
    y: number,
    h: number,
    flip = false,
    hit = false,
  ) {
    const img = this.assets.get('atlas');
    if (!img) return;
    const c = this.ctx,
      [sx, sy, sw, sh] = rects[type],
      w = (h * sw) / sh;
    c.save();
    c.translate(x, y);
    if (flip) c.scale(-1, 1);
    if (hit) c.filter = 'brightness(1.7)';
    c.drawImage(img, sx, sy, sw, sh, -w / 2, -h * 0.8, w, h);
    c.restore();
  }
  private memeSprite(
    cell: number,
    x: number,
    y: number,
    w: number,
    h: number,
    flip = false,
  ) {
    const img = this.assets.get('memes');
    if (!img) return;
    const c = this.ctx;
    const [sx, sy, sw, sh] = [
      [140, 0, 590, 616],
      [915, 8, 522, 608],
      [132, 624, 630, 348],
      [974, 704, 422, 233],
    ][cell];
    const scale = Math.min(w / sw, h / sh);
    w = sw * scale;
    h = sh * scale;
    c.save();
    c.translate(x, y);
    if (flip) c.scale(-1, 1);
    c.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
    c.restore();
  }
  private bossEnemy(e: Enemy) {
    const c = this.ctx,
      m = this.model,
      spec = bossSpec(e.boss!);
    c.save();
    c.globalAlpha = Math.max(0, 1 - m.endingTime / 1.2);
    c.translate(e.x, e.y);
    c.shadowColor = e.hit > 0 ? '#fff' : spec.color;
    c.shadowBlur = e.hit > 0 ? 28 : 16;
    const box = (
      x: number,
      y: number,
      w: number,
      h: number,
      fill = '#152338',
    ) => {
      c.fillStyle = fill;
      c.strokeStyle = spec.color;
      c.lineWidth = 2;
      c.beginPath();
      roundRect(c, x, y, w, h, 7);
      c.fill();
      c.stroke();
    };
    const gear = (x: number, y: number, r: number) => {
      c.save();
      c.translate(x, y);
      c.rotate(m.time * 1.5);
      c.strokeStyle = spec.color;
      c.lineWidth = 5;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        c.beginPath();
        c.moveTo(Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65);
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        c.stroke();
      }
      this.circle(0, 0, r * 0.65, '#152338', spec.color, 3);
      c.restore();
    };
    if (e.boss === 'coder') {
      gear(-72, 40, 25);
      gear(72, 40, 25);
      box(-101, -50, 202, 93, '#101815');
      const img = this.assets.get('coder-pity');
      if (img) c.drawImage(img, -95, -40, 190, 66);
      box(-56, 47, 112, 20);
      this.text('ERROR 404', 0, 56, 12, spec.color);
      for (let i = 0; i < 3; i++)
        this.text(
          ['{', ';', '}'][i],
          -78 + i * 78,
          -64 - Math.sin(m.time * 3 + i) * 7,
          20,
          spec.color,
        );
    } else if (e.boss === 'snake') {
      // A visibly articulated snake under the infamous canteen sign.
      for (let i = 7; i >= 0; i--) {
        const x = -85 + i * 23,
          y = Math.sin(m.time * 3 + i * 0.7) * 22;
        this.circle(x, y, i === 0 ? 29 : 21, '#6d439c', spec.color, 3);
        if (i === 0) {
          this.circle(x - 7, y - 7, 4, '#fff');
          this.circle(x + 7, y - 7, 4, '#fff');
          c.strokeStyle = '#ff87bd';
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(x, y + 10);
          c.lineTo(x - 6, y + 33);
          c.lineTo(x - 14, y + 39);
          c.moveTo(x - 6, y + 33);
          c.lineTo(x + 3, y + 39);
          c.stroke();
        }
      }
      box(-94, -76, 188, 31, '#e1c2ff');
      this.text('紫荆园 Chinese Snake', 0, -60, 14, '#44224f');
    } else if (e.boss === 'goosequeue') {
      box(-51, -52, 102, 108, '#493224');
      box(-38, -39, 76, 56, '#241d1c');
      this.text('鹅腿', 0, -23, 24, '#ffd587');
      this.text('已售罄', 0, 1, 18, '#ff867a');
      this.text('下一位：999', 0, 36, 12, '#ffe5a9');
      c.fillStyle = '#ffe575';
      c.beginPath();
      c.arc(0, -59, 35, Math.PI, 0);
      c.fill();
      for (let i = 0; i < 4; i++) {
        const a = m.time * 0.8 + (i * Math.PI) / 2;
        const x = Math.cos(a) * 85,
          y = Math.sin(a) * 58;
        box(x - 16, y - 22, 32, 42, '#ffedc1');
        this.text(String(996 + i), x, y, 12, '#493224');
      }
    } else if (e.boss === 'bike') {
      const bob = Math.sin(m.time * 8) * 4;
      for (const x of [-61, 61]) {
        gear(x, 38 + bob, 35);
        this.circle(x, 38 + bob, 36, '#0b283822', spec.color, 3);
      }
      c.strokeStyle = '#ffcf64';
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(-61, 38 + bob);
      c.lineTo(-21, -16 + bob);
      c.lineTo(27, 38 + bob);
      c.lineTo(-61, 38 + bob);
      c.moveTo(-21, -16 + bob);
      c.lineTo(47, -16 + bob);
      c.lineTo(61, 38 + bob);
      c.moveTo(47, -16 + bob);
      c.lineTo(41, -35 + bob);
      c.lineTo(59, -35 + bob);
      c.stroke();
      box(-46, -73, 92, 30, '#ffe48e');
      this.text('学堂路', 0, -57, 19, '#173644');
      this.text('逆行 / 超速内卷', 0, 90, 13, spec.color);
    } else if (e.boss === 'weishen') {
      box(-30, -53, 60, 102, '#25564a');
      this.text('显然', 0, -17, 20, '#fff');
      this.text('∫ ∑ ∞', 0, 15, 17, spec.color);
      // Two buns and a mineral-water bottle make the reference readable at a glance.
      for (const x of [-70, 70]) {
        this.circle(x, 20, 29, '#fff0ce', '#dfcba5', 2);
        this.text('馒头', x, 22, 12, '#786345');
      }
      box(-80, -64, 26, 51, '#c6f5ffaa');
      box(-74, -75, 14, 12, '#589cec');
      this.text('水', -67, -39, 13, '#174e61');
      for (let i = 0; i < 4; i++) {
        const a = m.time * 0.5 + (i * Math.PI) / 2;
        this.text(
          ['∫', '∑', '∀', 'QED'][i],
          Math.cos(a) * 100,
          Math.sin(a) * 78,
          19,
          spec.color,
        );
      }
    } else if (e.boss === 'swim') {
      c.save();
      c.scale(1, 0.6);
      this.circle(0, 0, 83, '#235369', spec.color, 4);
      c.restore();
      for (let y = -30; y <= 30; y += 20) {
        c.strokeStyle = '#94e9ff';
        c.lineWidth = 3;
        c.beginPath();
        for (let x = -72; x <= 72; x += 8) {
          const yy = y + Math.sin(x * 0.08 + m.time * 4) * 5;
          if (x === -72) c.moveTo(x, yy);
          else c.lineTo(x, yy);
        }
        c.stroke();
      }
      box(-31, -60, 62, 55, '#ffd366');
      this.text('50m', 0, -32, 24, '#224e66');
      this.circle(0, 11, 18, '#e0faff', '#fff', 3);
      this.text('哨', 0, 12, 14, '#226587');
      box(-69, 53, 138, 24, '#1d4f72');
    } else if (e.boss === 'hotsearch') {
      // The fictional machine carries a publicly reported portrait on its screen.
      c.save();
      c.rotate(m.time * 0.4);
      this.circle(0, 0, 76, '#321a3888', spec.color, 2);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        this.circle(
          Math.cos(a) * 76,
          Math.sin(a) * 76,
          8,
          '#ffd679',
          '#fff2ba',
          2,
        );
      }
      c.restore();
      box(-43, -58, 86, 113, '#281b35');
      box(-33, -43, 66, 62, '#101622');
      this.text('热搜 #1', 0, -24, 15, '#ffb6df');
      this.text(
        ['磨指甲', '叫妈妈', '小作文'][Math.floor(m.time / 2) % 3],
        0,
        1,
        16,
        '#fff4e7',
      );
      this.text('流量拉满', 0, 37, 13, '#ffd679');
      for (const side of [-1, 1]) {
        // Long, serrated nail files visibly rub against the machine's metal claws.
        c.save();
        c.translate(side * 73, Math.sin(m.time * 8) * side * 10);
        c.rotate(side * 0.38);
        box(-11, -59, 22, 110, '#e1d9e9');
        c.strokeStyle = '#8b6c9c';
        c.lineWidth = 2;
        for (let y = -47; y < 37; y += 8) {
          c.beginPath();
          c.moveTo(-8, y);
          c.lineTo(8, y + 7);
          c.stroke();
        }
        box(-12, 40, 24, 27, '#ab3c86');
        c.restore();
        c.fillStyle = '#ce6bb0';
        c.strokeStyle = '#ffd3ed';
        c.beginPath();
        c.moveTo(side * 35, 45);
        c.lineTo(side * 86, 30);
        c.lineTo(side * 86, 70);
        c.closePath();
        c.fill();
        c.stroke();
        for (let i = 0; i < 3; i++) {
          const t = (m.time * 4 + i) % 3;
          this.circle(
            side * (49 + t * 10),
            -5 - t * 13,
            2 + (3 - t),
            '#fff1b5',
          );
        }
      }
      this.text('梗改编机甲', 0, 80, 12, '#ffdcf0');
    } else if (e.boss === 'final') {
      // Three open arches, four white pillars and the university nameplate.
      c.shadowColor = '#ffe0a3';
      c.shadowBlur = 22;
      for (const x of [-84, -30, 30, 84]) box(x - 9, -37, 18, 104, '#eae4dc');
      box(-101, -59, 202, 23, '#f8efe2');
      box(-59, -82, 118, 29, '#fff3dc');
      this.text('清華大學', 0, -67, 23, '#694831');
      c.strokeStyle = '#fff3dc';
      c.lineWidth = 10;
      for (const x of [-57, 0, 57]) {
        c.beginPath();
        c.arc(x, 10, x === 0 ? 23 : 18, Math.PI, 0);
        c.stroke();
      }
      box(-108, 65, 216, 13, '#ddc9a7');
      for (let i = 0; i < 4; i++) {
        const a = m.time * 0.6 + (i * Math.PI) / 2;
        this.text(
          ['德', '智', '体', '美'][i],
          Math.cos(a) * 119,
          Math.sin(a) * 90,
          20,
          spec.color,
        );
      }
    }
    const photo = BOSS_PHOTOS[e.boss!];
    const image = this.assets.get(`boss-photo-${e.boss}`);
    if (image) {
      const { width: w, height: h, radius } = photo;
      c.save();
      c.shadowBlur = 0;
      c.fillStyle = '#0b101c';
      c.strokeStyle = e.hit > 0 ? '#fff' : spec.color;
      c.lineWidth = e.hit > 0 ? 5 : 3;
      c.beginPath();
      roundRect(c, -w / 2 - 3, -h / 2 - 3, w + 6, h + 6, radius);
      c.fill();
      c.stroke();
      c.beginPath();
      roundRect(c, -w / 2, -h / 2, w, h, radius);
      c.clip();
      // Contain the complete representative picture: faces, signs and watermarks stay visible.
      const fit = Math.min(w / image.naturalWidth, h / image.naturalHeight);
      const iw = image.naturalWidth * fit,
        ih = image.naturalHeight * fit;
      c.drawImage(image, -iw / 2, -ih / 2, iw, ih);
      c.restore();
      c.shadowBlur = 0;
      this.text(photo.caption, 0, h / 2 + 18, 12, spec.color);
    }
    c.shadowBlur = 0;
    this.text(spec.name, 0, -102, 19, '#fff2e4');
    if (e.hp < e.maxHp * 0.5)
      this.text('二阶段 · 火力全开', 0, 102, 14, '#ff91a8');
    c.restore();
  }
  private bossProjectile(s: Shot) {
    const c = this.ctx,
      id = s.bossSkin!,
      t = s.age || 0;
    c.save();
    c.translate(s.x, s.y);
    c.strokeStyle = '#ff718c';
    c.lineWidth = 2;
    c.fillStyle = '#391b2b';
    c.shadowColor = s.color || '#ff718c';
    c.shadowBlur = 8;
    if (id === 'bike') {
      c.rotate(t * 8);
      this.circle(0, 0, 13, '#142534', '#ff718c', 2);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
        c.stroke();
      }
    } else if (id === 'snake') {
      c.rotate(Math.atan2(s.vy, s.vx));
      for (let i = 3; i >= 0; i--)
        this.circle(
          -i * 6,
          Math.sin(t * 9 + i) * 3,
          i ? 4 : 7,
          '#9969bc',
          '#ff718c',
          1.5,
        );
      this.circle(2, -3, 2, '#fff');
      this.circle(2, 3, 2, '#fff');
    } else if (id === 'swim') {
      c.rotate(Math.atan2(s.vy, s.vx));
      c.strokeStyle = '#ff718c';
      c.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.arc(-i * 6, 0, 9 + i * 3, -Math.PI / 3, Math.PI / 3);
        c.stroke();
      }
    } else if (id === 'weishen' && s.glyph === '馒头') {
      this.circle(0, 0, 13, '#ffe9be', '#ff718c', 2);
      c.strokeStyle = '#aa824f';
      for (let x = -5; x <= 5; x += 5) {
        c.beginPath();
        c.moveTo(x, -8);
        c.lineTo(x - 2, -1);
        c.stroke();
      }
    } else if (id === 'hotsearch' && s.glyph === '锉') {
      c.rotate(t * 5);
      c.fillStyle = '#ded1df';
      c.beginPath();
      roundRect(c, -5, -20, 10, 40, 4);
      c.fill();
      c.stroke();
      for (let y = -13; y < 10; y += 6) {
        c.beginPath();
        c.moveTo(-4, y);
        c.lineTo(4, y + 4);
        c.stroke();
      }
    } else if (id === 'final') {
      c.fillStyle = '#efd49b';
      c.fillRect(-15, -12, 30, 5);
      c.fillRect(-15, -7, 5, 20);
      c.fillRect(10, -7, 5, 20);
      c.strokeRect(-15, -12, 30, 25);
      this.text(s.glyph || '清华', 0, 2, 12, '#fff2ca');
    } else {
      const ticket = id === 'goosequeue',
        w = ticket ? 32 : id === 'coder' ? 42 : 29;
      c.fillStyle = ticket ? '#ffdfa0' : '#261c35';
      c.beginPath();
      roundRect(c, -w / 2, -13, w, 26, ticket ? 1 : 5);
      c.fill();
      c.stroke();
      if (ticket) {
        c.setLineDash([2, 3]);
        c.beginPath();
        c.moveTo(-w / 2 + 5, -7);
        c.lineTo(w / 2 - 5, -7);
        c.stroke();
      }
      this.text(
        s.glyph || '考',
        0,
        ticket ? 3 : 0,
        11,
        ticket ? '#733236' : '#fff0ec',
      );
    }
    c.restore();
  }
  private drawBossHazards() {
    const c = this.ctx,
      m = this.model;
    const labels = new Set<string>();
    for (const h of m.hazards) {
      const active = h.age >= h.warn;
      c.save();
      c.translate(h.x, h.y);
      c.strokeStyle = active ? '#fff1d9' : h.color;
      c.fillStyle = active ? h.color + '99' : h.color + '18';
      c.lineWidth = active ? 4 : 2;
      c.setLineDash(active ? [] : [9, 7]);
      if (h.shape === 'line') {
        c.rotate(h.angle);
        c.fillRect(-h.length / 2, -h.width, h.length, h.width * 2);
        c.strokeRect(-h.length / 2, -h.width, h.length, h.width * 2);
        if (h.motif === 'nailfile') {
          c.setLineDash([]);
          c.strokeStyle = active ? '#fff9e9' : h.color;
          for (let x = -h.length / 2 + 10; x < h.length / 2 - 10; x += 22) {
            c.beginPath();
            c.moveTo(x, -h.width + 3);
            c.lineTo(x + 14, h.width - 3);
            c.stroke();
          }
        } else if (h.motif === 'essay') {
          c.setLineDash([]);
          for (let x = -h.length / 2 + 30; x < h.length / 2 - 20; x += 75) {
            const shift = active ? (m.time * 95) % 40 : 0;
            c.strokeRect(
              x + shift,
              -h.width + 8,
              45,
              Math.max(8, h.width * 2 - 16),
            );
          }
        }
      } else if (h.shape === 'circle') {
        c.beginPath();
        c.arc(0, 0, h.radius, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        if (!active) {
          c.setLineDash([]);
          c.beginPath();
          c.arc(
            0,
            0,
            h.radius + 5,
            -Math.PI / 2,
            -Math.PI / 2 + (Math.PI * 2 * h.age) / h.warn,
          );
          c.stroke();
        }
      } else {
        const radius = active
          ? (h.radius * (h.age - h.warn)) / h.duration
          : h.radius;
        c.lineWidth = active ? h.width * 2 : 2;
        c.beginPath();
        c.arc(0, 0, Math.max(1, radius), 0, Math.PI * 2);
        c.stroke();
        if (h.motif === 'echo') {
          for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2 + m.time * 0.2;
            this.text(
              '妈妈？',
              Math.cos(a) * radius,
              Math.sin(a) * radius,
              active ? 18 : 13,
              '#ffe2f3',
            );
          }
        }
      }
      if (h.motif && !['nailfile', 'echo', 'essay'].includes(h.motif)) {
        c.setLineDash([]);
        c.strokeStyle = active ? '#fff2c7' : h.color;
        c.lineWidth = 2;
        const mark =
          (
            {
              coder: '404',
              snake: '蛇',
              goosequeue: '售罄',
              bike: '➜',
              weishen: h.shape === 'circle' ? '馒头' : '∫',
              swim: '≈',
              final: '清華',
            } as Record<string, string>
          )[h.motif] || '';
        if (h.shape === 'line') {
          for (let x = -h.length / 2 + 35; x < h.length / 2 - 20; x += 85) {
            if (h.motif === 'swim') {
              c.beginPath();
              for (let j = 0; j <= 50; j += 5) {
                const y =
                  Math.sin(j * 0.15 + (active ? m.time * 5 : 0)) *
                  Math.min(9, h.width * 0.6);
                if (j === 0) c.moveTo(x + j, y);
                else c.lineTo(x + j, y);
              }
              c.stroke();
            } else this.text(mark, x, 0, Math.min(19, h.width * 1.1), h.color);
          }
        } else if (h.shape === 'circle') {
          if (h.motif === 'weishen') {
            this.circle(
              0,
              0,
              h.radius * 0.55,
              active ? '#ffe7bbaa' : '#ffe7bb18',
              h.color,
              2,
            );
          }
          if (h.motif === 'snake') {
            this.circle(-h.radius * 0.25, -5, 4, '#fff');
            this.circle(h.radius * 0.25, -5, 4, '#fff');
          }
          this.text(mark, 0, 12, 18, h.color);
        } else {
          const radius = active
            ? (h.radius * (h.age - h.warn)) / h.duration
            : h.radius;
          for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            this.text(
              mark,
              Math.cos(a) * radius,
              Math.sin(a) * radius,
              15,
              h.color,
            );
          }
        }
      }
      c.restore();
      if (!labels.has(h.label))
        this.text(
          h.label,
          clamp(h.x, m.view.x + 65, m.view.x + m.view.width - 65),
          clamp(h.y - 35, m.view.y + 105, m.view.y + m.view.height - 90),
          12,
          active ? '#fff7df' : h.color,
        );
      labels.add(h.label);
    }
  }
  private bookCache = new Map<string, HTMLCanvasElement>();
  private coverBitmap(id: string, img: HTMLImageElement, crop: number) {
    let bitmap = this.bookCache.get(id);
    if (!bitmap) {
      bitmap = document.createElement('canvas');
      bitmap.width = 144;
      bitmap.height = 200;
      const ctx = bitmap.getContext('2d');
      if (!ctx) return img;
      const sx = img.naturalWidth * crop;
      ctx.drawImage(
        img,
        sx,
        0,
        img.naturalWidth - sx,
        img.naturalHeight,
        0,
        0,
        144,
        200,
      );
      if (this.bookCache.size >= 12)
        this.bookCache.delete(this.bookCache.keys().next().value!);
      this.bookCache.set(id, bitmap);
    }
    return bitmap;
  }
  private textbookEnemy(e: Enemy) {
    const c = this.ctx,
      m = this.model;
    const book = textbook(e.book);
    const cover = enemyBookPhoto(m.department.id, e.book);
    const img = this.assets.get(cover.id);
    const boss = e.kind === 'boss',
      urgent = e.kind === 'clock';
    const h = boss ? 135 : (urgent ? 88 : 68) * book.size;
    const w = h * 0.72;
    const color = book.color;
    c.save();
    c.globalAlpha = Math.max(0, 1 - m.endingTime / 1.2);
    c.translate(e.x, e.y);
    c.rotate(
      Math.sin(m.time * (urgent ? 7 : 3) + e.id) * (boss ? 0.045 : 0.12),
    );
    c.shadowColor = e.hit > 0 ? '#ffffff' : color;
    c.shadowBlur = e.hit > 0 ? 15 : this.touch ? 0 : 5;
    if (boss) {
      for (let i = 2; i >= 1; i--) {
        c.fillStyle = i === 2 ? '#bcd0e6' : '#e4e9f1';
        c.fillRect(-w / 2 + i * 8, -h / 2 - i * 5, w, h);
      }
    }
    c.fillStyle = '#f1e6cf';
    c.fillRect(-w / 2 + 4, -h / 2 + 4, w, h);
    // The crop is applied once to the reusable bitmap, preserving the real front cover.
    if (img)
      c.drawImage(
        this.coverBitmap(cover.id, img, cover.crop),
        -w / 2,
        -h / 2,
        w,
        h,
      );
    if (!img) this.text(cover.title.slice(0, 5), 0, 0, 10, '#382c42');
    c.shadowBlur = 0;
    c.strokeStyle = color;
    c.lineWidth = boss ? 3 : 1.5;
    c.strokeRect(-w / 2, -h / 2, w, h);
    // Eyes sit below the cover, leaving the real book untouched.
    c.fillStyle = '#251329';
    c.fillRect(-w * 0.28, h * 0.44, w * 0.56, h * 0.12);
    c.fillStyle = '#ff779b';
    c.fillRect(-w * 0.22, h * 0.47, w * 0.14, 3);
    c.fillRect(w * 0.08, h * 0.47, w * 0.14, 3);
    if (
      !this.touch ||
      urgent ||
      e.hit > 0 ||
      Math.hypot(e.x - m.player.x, e.y - m.player.y) < 220
    )
      this.text(
        `${YEAR_NAMES[e.year]}·${cover.title.length > 12 ? cover.title.slice(0, 11) + '…' : cover.title}`,
        0,
        -h / 2 - 20,
        11,
        '#fff4d9',
      );
    if (urgent || boss)
      this.text(
        boss ? '期末 · 全书必考' : 'DDL',
        0,
        h / 2 + 17,
        boss ? 17 : 12,
        '#ffcadc',
      );
    c.restore();
  }
  private projectileCache = new Map<string, HTMLCanvasElement>();
  private cachedShot(s: Shot) {
    const key = [
      s.major,
      s.glyph,
      s.color,
      s.pattern,
      s.support,
      this.model.weaponTier,
      Math.floor(this.model.time * 8) % 4,
    ].join('|');
    let sprite = this.projectileCache.get(key);
    if (!sprite) {
      sprite = document.createElement('canvas');
      sprite.width = 224;
      sprite.height = 96;
      const ctx = sprite.getContext('2d');
      if (!ctx) {
        this.majorShot(s);
        return;
      }
      const original = this.ctx;
      ctx.translate(144, 48);
      try {
        this.ctx = ctx;
        this.majorShot({ ...s, x: 0, y: 0, vx: 1, vy: 0 });
      } finally {
        this.ctx = original;
      }
      if (this.projectileCache.size >= 64)
        this.projectileCache.delete(this.projectileCache.keys().next().value!);
      this.projectileCache.set(key, sprite);
    }
    const c = this.ctx;
    c.save();
    c.translate(s.x, s.y);
    c.rotate(Math.atan2(s.vy, s.vx));
    c.drawImage(sprite, -144, -48);
    c.restore();
  }
  private majorShot(s: Shot) {
    const c = this.ctx,
      m = this.model;
    const colors = { math: '#e7ff90', cs: '#77ffdf', arch: '#a9c8ff' };
    const color = s.color || colors[m.major];
    c.save();
    c.translate(s.x, s.y);
    c.rotate(Math.atan2(s.vy, s.vx));
    c.shadowColor = color;
    c.shadowBlur = 18;
    const length = s.support ? 25 : 38 + m.weaponTier * 12;
    if (s.support) c.scale(0.76, 0.76);
    c.strokeStyle = color;
    c.lineWidth = 3;
    if (s.major === 'math') {
      c.beginPath();
      for (let i = 0; i <= 20; i++) {
        const x = -length + (i / 20) * length;
        const y = Math.sin((i / 20) * Math.PI * 2 - m.time * 12) * 8;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
      c.strokeStyle = '#fffbd7';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-length, 0);
      c.lineTo(12, 0);
      c.stroke();
      this.text(s.glyph || '∫', 4, 0, 20 + m.weaponTier * 2, '#fffde5');
    } else if (s.major === 'cs') {
      c.strokeStyle = '#62ffe188';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-length, 0);
      c.lineTo(8, 0);
      c.stroke();
      for (let i = 0; i < 3; i++)
        this.text(
          Math.floor(s.x + s.y + i) % 2 ? '1' : '0',
          -12 - i * 13,
          i % 2 ? 5 : -5,
          13,
          '#81eed4',
        );
      c.fillStyle = '#092c27';
      c.fillRect(-10, -12, 29, 24);
      c.strokeStyle = color;
      c.strokeRect(-10, -12, 29, 24);
      this.text(s.glyph || '</>', 4, 0, 14, '#e6fff5');
    } else if (s.major === 'arch') {
      c.fillStyle = '#152b57';
      c.fillRect(-18, -11, 36, 22);
      c.strokeRect(-18, -11, 36, 22);
      c.beginPath();
      c.moveTo(-18, -11);
      c.lineTo(-8, -20);
      c.lineTo(27, -20);
      c.lineTo(18, -11);
      c.moveTo(27, -20);
      c.lineTo(27, 2);
      c.lineTo(18, 11);
      c.moveTo(-18, 0);
      c.lineTo(-length, 0);
      c.stroke();
      c.strokeStyle = '#f4f6ff';
      c.beginPath();
      c.moveTo(-12, -7);
      c.lineTo(12, 7);
      c.moveTo(-12, 7);
      c.lineTo(12, -7);
      c.stroke();
    }
    // Badge identity sits on top of the chosen major's attack layer.
    if (s.pattern === 'return') {
      c.save();
      c.rotate(m.time * 16);
      c.strokeStyle = color;
      c.lineWidth = 4;
      c.beginPath();
      c.arc(0, 0, 21, 0.3, Math.PI * 1.6);
      c.stroke();
      c.restore();
    } else if (s.pattern === 'burst') {
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.strokeRect(-18, -18, 36, 36);
    } else if (s.pattern === 'chain') {
      c.beginPath();
      c.moveTo(-34, 0);
      c.lineTo(-23, -12);
      c.lineTo(-13, 9);
      c.lineTo(0, -5);
      c.stroke();
    } else if (s.pattern === 'split') {
      c.beginPath();
      c.moveTo(-28, -15);
      c.lineTo(6, 0);
      c.lineTo(-28, 15);
      c.stroke();
    } else if (s.pattern === 'homing') {
      this.circle(0, 0, 17, '#00000000', color, 2);
    }
    if (!s.major || s.major === 'arch')
      this.text(s.glyph || '✦', 0, 0, 16, color);
    c.restore();
  }
  private majorAura(t: number) {
    const c = this.ctx,
      m = this.model;
    c.save();
    c.translate(m.player.x, m.player.y);
    if (m.major === 'arch') {
      c.strokeStyle = '#92b9ff88';
      c.fillStyle = '#537cff10';
      c.fillRect(-80, -80, 160, 160);
      c.lineWidth = 1;
      for (let i = -80; i <= 80; i += 20) {
        c.beginPath();
        c.moveTo(i, -80);
        c.lineTo(i, 80);
        c.moveTo(-80, i);
        c.lineTo(80, i);
        c.stroke();
      }
      c.strokeStyle = '#c5d7ff';
      c.shadowColor = '#91baff';
      c.shadowBlur = 12;
      c.lineWidth = 3;
      const angle = t * 0.45;
      for (let i = 0; i < 4; i++) {
        const a = angle + (i * Math.PI) / 2,
          x = Math.cos(a) * 104,
          y = Math.sin(a) * 104;
        c.strokeRect(x - 12, y - 18, 24, 36);
        c.beginPath();
        c.moveTo(x - 12, y - 18);
        c.lineTo(x, y - 30);
        c.lineTo(x + 12, y - 18);
        c.stroke();
      }
      this.circle(0, 0, 112, '#8aaaff08', '#93b6ff77', 2);
    } else {
      c.rotate(t * 0.5);
      c.setLineDash(m.major === 'math' ? [28, 12] : [5, 12]);
      this.circle(
        0,
        0,
        58,
        '#00000000',
        m.major === 'math' ? '#e6ff9a88' : '#70ffd388',
        2,
      );
      c.setLineDash([]);
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        this.text(
          m.major === 'math' ? ['∑', 'π', '∫'][i] : ['{ }', '01', '</>'][i],
          Math.cos(a) * 59,
          Math.sin(a) * 59,
          15,
          m.major === 'math' ? '#f0ffb7' : '#acffe3',
        );
      }
    }
    c.restore();
  }
  private sceneryBuffer: HTMLCanvasElement | null = null;
  private sceneryAt = -Infinity;
  private sceneryKey = '';
  private cachedScenery(reducedMotion: boolean) {
    if (this.model instanceof SurvivalGameModel && this.model.mode !== 'menu') {
      this.drawScenery(reducedMotion);
      return;
    }
    const w = this.canvas.width,
      h = this.canvas.height;
    const factor = Math.min(1, Math.sqrt(2_000_000 / Math.max(1, w * h)));
    const bw = Math.max(1, Math.floor(w * factor));
    const bh = Math.max(1, Math.floor(h * factor));
    const key = `${w}:${h}:${this.model.bossSpawned}:${this.assets.has('campus')}:${reducedMotion}`;
    const needsPaint =
      key !== this.sceneryKey || this.visualClock - this.sceneryAt >= 1 / 30;
    if (!this.sceneryBuffer)
      this.sceneryBuffer = document.createElement('canvas');
    if (needsPaint) {
      if (this.sceneryBuffer.width !== bw || this.sceneryBuffer.height !== bh) {
        this.sceneryBuffer.width = bw;
        this.sceneryBuffer.height = bh;
      }
      const ctx = this.sceneryBuffer.getContext('2d');
      if (!ctx) {
        this.drawScenery(reducedMotion);
        return;
      }
      const destination = this.ctx;
      this.ctx = ctx;
      try {
        this.drawScenery(reducedMotion, bw, bh);
      } finally {
        this.ctx = destination;
      }
      this.sceneryAt = this.visualClock;
      this.sceneryKey = key;
    }
    this.ctx.drawImage(this.sceneryBuffer, 0, 0, w, h);
  }
  private drawScenery(
    reducedMotion: boolean,
    w = this.canvas.width,
    h = this.canvas.height,
  ) {
    const c = this.ctx;
    const bg = this.assets.get('campus');
    if (this.model instanceof SurvivalGameModel && this.model.mode !== 'menu') {
      const map = this.assets.get('campus-map'),
        v = this.model.view,
        world = this.model.world;
      c.save();
      c.fillStyle = '#253047';
      c.fillRect(0, 0, w, h);
      if (map)
        c.drawImage(
          map,
          (v.x / world.width) * map.naturalWidth,
          (v.y / world.height) * map.naturalHeight,
          (v.width / world.width) * map.naturalWidth,
          (v.height / world.height) * map.naturalHeight,
          0,
          0,
          w,
          h,
        );
      c.fillStyle = '#10192c66';
      c.fillRect(0, 0, w, h);
      c.restore();
      return;
    }
    c.save();
    c.fillStyle = '#172632';
    c.fillRect(0, 0, w, h);
    if (bg) {
      const progress = reducedMotion ? 0.35 : this.sceneryClock / 10;
      const phase = progress % 1;
      // Overlap two forward-moving shots; neither the image edge nor a wrap is visible.
      const drawShot = (age: number, alpha: number) => {
        const cover = Math.max(w / bg.naturalWidth, h / bg.naturalHeight);
        const zoom = 1.07 + age * 0.48;
        const dw = bg.naturalWidth * cover * zoom;
        const dh = bg.naturalHeight * cover * zoom;
        const parallaxX = reducedMotion
          ? 0
          : ((this.model.player.x - 600) / 600) * 0.07;
        const parallaxY = reducedMotion
          ? 0
          : ((this.model.player.y - 400) / 400) * 0.05;
        // Advance toward the tree-lined road vanishing point on every screen size.
        const anchorX = clamp(0.5 + parallaxX, 0, 1);
        const anchorY = clamp(0.52 - age * 0.12 + parallaxY, 0, 1);
        c.globalAlpha = alpha;
        c.drawImage(bg, -(dw - w) * anchorX, -(dh - h) * anchorY, dw, dh);
      };
      if (reducedMotion) drawShot(phase, 1);
      else {
        const fade = clamp(phase / 0.22, 0, 1);
        if (fade < 1) drawShot(phase + 1, 1);
        drawShot(phase, fade * fade * (3 - 2 * fade));
      }
    }
    c.globalAlpha = 1;
    c.fillStyle = '#0713278c';
    c.fillRect(0, 0, w, h);
    const shade = c.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.14,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.72,
    );
    shade.addColorStop(0, '#07132700');
    shade.addColorStop(1, this.model.bossSpawned ? '#390921ad' : '#060e26b8');
    c.fillStyle = shade;
    c.fillRect(0, 0, w, h);
    c.restore();
  }
  private draw() {
    const c = this.ctx,
      m = this.model,
      t = this.visualClock;
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const view = m.view;
    const scale = this.canvas.width / view.width;
    c.setTransform(1, 0, 0, 1, 0, 0);
    this.cachedScenery(reducedMotion);
    c.setTransform(scale, 0, 0, scale, -view.x * scale, -view.y * scale);
    c.save();
    if (m.shake > 0 && !reducedMotion) {
      c.translate(
        Math.sin(t * 150) * m.shake,
        Math.cos(t * 130) * m.shake * 0.5,
      );
    }
    this.zone(145, 630, 49, '#c8b9ff', m.dormCooldown, '宿舍 · 无敌 3s');
    const station = supplyStation(view);
    this.circle(station.x, station.y + 8, 33, '#132639aa', '#e5c77b99', 2);
    this.memeSprite(1, station.x, station.y - 15, 106, 74);
    this.text('鹅腿阿姨', station.x, station.y + 37, 13, '#fff0c9');
    this.text(m.supplyMessage, station.x, station.y + 54, 11, '#dacbaf');
    if (m.mode === 'menu') {
      for (let i = 0; i < 8; i++) {
        const x = 230 + i * 106,
          y = 350 + Math.sin(i * 1.6) * 145;
        this.badge(
          colleges[(i * 3 + 2) % colleges.length].key,
          x,
          y + Math.sin(t + i) * 5,
          22,
          true,
        );
      }
      this.badge('qinghua', 610, 470, 55, true);
      this.sprite('paper', 830, 480, 78);
      this.sprite('clock', 350, 300, 88);
      c.restore();
      return;
    }
    if (m instanceof SurvivalGameModel)
      drawSurvivalZone(c, m.zone, view, m.player);
    if (m.skillTime > 0) {
      const d = m.department;
      for (const z of m.skillZones) {
        c.save();
        c.translate(z.x, z.y);
        c.rotate(z.angle);
        c.shadowColor = d.color;
        c.shadowBlur = 18;
        c.strokeStyle = d.color;
        c.fillStyle = d.color + '18';
        c.lineWidth = 3;
        if (z.shape === 'line') {
          c.lineWidth = z.width * 2;
          c.strokeStyle = d.color + '44';
          c.beginPath();
          c.moveTo(-z.length / 2, 0);
          c.lineTo(z.length / 2, 0);
          c.stroke();
          c.lineWidth = 6;
          c.strokeStyle = d.color;
          c.stroke();
          c.lineWidth = 2;
          c.strokeStyle = '#fff';
          c.stroke();
          for (let x = -z.length / 2 + 40; x < z.length / 2; x += 90)
            this.text(d.glyph, x, -18, 18, d.color);
        } else if (z.shape === 'cone') {
          c.beginPath();
          c.moveTo(0, 0);
          c.arc(0, 0, z.radius, -z.width / 2, z.width / 2);
          c.closePath();
          c.fill();
          c.stroke();
          for (let i = 0; i < 8; i++) {
            const t = (m.time * 2 + i / 8) % 1,
              a = ((i % 3) - 1) * 0.3;
            this.text(
              d.glyph,
              Math.cos(a) * z.radius * t,
              Math.sin(a) * z.radius * t,
              17 + t * 12,
              d.color,
            );
          }
        } else {
          if (z.shape === 'ring') {
            c.lineWidth = z.width * 2;
            c.strokeStyle = d.color + '66';
          }
          c.beginPath();
          c.arc(0, 0, z.radius, 0, Math.PI * 2);
          if (z.shape !== 'ring') c.fill();
          c.stroke();
          if (d.kind === 'storm') {
            c.beginPath();
            c.moveTo(-8, -95);
            c.lineTo(15, -55);
            c.lineTo(-9, -36);
            c.lineTo(0, 0);
            c.lineWidth = 6;
            c.strokeStyle = '#fff9bc';
            c.stroke();
          }
          if (d.kind === 'rain') {
            this.text(d.glyph, 0, -55 + ((m.time * 140) % 50), 23, d.color);
          }
          if (d.kind === 'gravity') {
            for (let i = 0; i < 3; i++) {
              c.rotate(m.time * 0.01 + 1);
              c.beginPath();
              c.ellipse(
                0,
                0,
                z.radius * (0.3 + i * 0.2),
                z.radius * 0.2,
                0,
                0,
                Math.PI * 2,
              );
              c.stroke();
            }
          }
          if (d.kind === 'orbit' || d.kind === 'drones')
            this.text(d.glyph, 0, 0, 22, '#fff');
          else if (d.kind !== 'storm' && d.kind !== 'rain')
            for (let i = 0; i < 4; i++) {
              const a = m.time + (i * Math.PI) / 2;
              this.text(
                d.glyph,
                Math.cos(a) * z.radius * 0.8,
                Math.sin(a) * z.radius * 0.8,
                20,
                d.color,
              );
            }
        }
        c.restore();
      }
      if (!this.touch)
        this.text(d.skill, m.player.x, m.player.y - 100, 15, d.color);
    }
    if (m.wallX !== null) {
      const x = m.wallX;
      const grad = c.createLinearGradient(x - 30, 0, x + 30, 0);
      grad.addColorStop(0, '#ff346900');
      grad.addColorStop(0.5, m.wallWarn ? '#ff617944' : '#ff3566aa');
      grad.addColorStop(1, '#ff346900');
      c.fillStyle = grad;
      c.fillRect(x - 30, view.y, 60, view.height);
      c.strokeStyle = m.wallWarn ? '#ffbd8b' : '#ff6189';
      c.lineWidth = m.wallWarn ? 3 : 5;
      c.setLineDash(m.wallWarn ? [12, 12] : []);
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, m.world.height);
      c.stroke();
      c.setLineDash([]);
      for (let y = 175; y < 780; y += 110)
        this.text(
          m.wallWarn ? 'DDL 即将扫描' : 'DDL ▶',
          clamp(x + 36, 75, 1125),
          y,
          16,
          '#ffceda',
        );
    }
    if (m.exam) {
      const e = m.exam,
        active = e.time < 0.5;
      c.fillStyle = active ? '#f75a9ccc' : '#e4487930';
      c.fillRect(e.x - 24, 0, 48, m.world.height);
      c.fillRect(0, e.y - 24, m.world.width, 48);
      c.strokeStyle = active ? '#ffc5e5' : '#ee6288';
      c.lineWidth = 3;
      c.setLineDash(active ? [] : [12, 8]);
      c.beginPath();
      c.moveTo(e.x, 0);
      c.lineTo(e.x, m.world.height);
      c.moveTo(0, e.y);
      c.lineTo(m.world.width, e.y);
      c.stroke();
      c.setLineDash([]);
      this.text(
        active ? '坐标斩！' : '离开红色坐标线',
        600,
        650,
        22,
        '#ffe1ed',
      );
    }
    this.drawBossHazards();
    for (const d of m.drops) {
      c.globalAlpha = d.flight ? 1 : clamp((BADGE_LIFETIME - d.age) / 3, 0, 1);
      if (d.kind === 'goose' || d.kind === 'duck') {
        const goose = d.kind === 'goose',
          color = goose ? '#b8ff86' : '#ff718f';
        this.circle(d.x, d.y, 26, goose ? '#174128dd' : '#48152bdd', color, 2);
        this.memeSprite(
          goose ? 2 : 3,
          d.x,
          d.y - 4 + Math.sin(t * 3) * 2,
          74,
          50,
        );
        this.text(goose ? '鹅腿 +24' : '鸭腿 -12', d.x, d.y + 36, 16, color);
        if (d.flight && d.flight.duration - d.age < 2.5)
          this.text('即将飞走', d.x, d.y + 54, 12, color);
      } else if (d.kind === 'heal') {
        this.circle(d.x, d.y, 13, '#225c47', '#d2ffb8');
        this.text('+', d.x, d.y, 24, '#e0ffc5');
      } else {
        this.circle(d.x, d.y + 8, 22, '#193d3330');
        this.badge(
          m.chain[d.level].key,
          d.x,
          d.y + Math.sin(t * 3 + d.id) * 2,
          19,
          true,
        );
        this.text(`${d.level + 1}`, d.x + 16, d.y + 15, 13, '#eaffbf');
      }
      c.globalAlpha = 1;
    }
    this.majorAura(m.time);
    for (const s of m.shots) {
      if (
        s.x < view.x - 90 ||
        s.x > view.x + view.width + 90 ||
        s.y < view.y - 90 ||
        s.y > view.y + view.height + 90
      )
        continue;
      if (s.enemy && s.bossSkin) {
        this.bossProjectile(s);
      } else if (s.enemy) {
        const width = Math.max(20, (s.glyph?.length || 1) * 7);
        c.save();
        c.fillStyle = '#4c1029';
        c.strokeStyle = '#ff728c';
        c.lineWidth = 2;
        c.beginPath();
        roundRect(c, s.x - width / 2 - 4, s.y - 11, width + 8, 22, 5);
        c.fill();
        c.stroke();
        this.text(s.glyph || '考', s.x, s.y, 11, '#fff0ef');
        c.restore();
      } else this.cachedShot(s);
    }
    const entities = [
      ...m.enemies.map((e) => ({ y: e.y, enemy: e })),
      { y: m.player.y, enemy: null },
    ].sort((a, b) => a.y - b.y);
    for (const entity of entities) {
      const e = entity.enemy;
      if (e) {
        if (
          e.x < view.x - 160 ||
          e.x > view.x + view.width + 160 ||
          e.y < view.y - 160 ||
          e.y > view.y + view.height + 160
        )
          continue;
        this.circle(e.x, e.y + 8, e.r * 0.9, '#18233044');
        if (e.kind === 'boss') this.bossEnemy(e);
        else this.textbookEnemy(e);
        if (e.kind !== 'boss') {
          const book = textbook(e.book);
          const barWidth = 30 + book.hp * 0.5;
          const y = e.y - ((e.kind === 'clock' ? 88 : 68) * book.size) / 2 - 10;
          c.save();
          c.globalAlpha = Math.max(0, 1 - m.endingTime / 1.2);
          c.fillStyle = '#101626';
          c.fillRect(e.x - barWidth / 2 - 1, y - 1, barWidth + 2, 7);
          c.fillStyle = book.color;
          c.fillRect(
            e.x - barWidth / 2,
            y,
            barWidth * Math.max(0, e.hp / e.maxHp),
            5,
          );
          const segments = Math.ceil(book.hp / 20);
          c.fillStyle = '#0b162b';
          for (let i = 1; i < segments; i++)
            c.fillRect(
              e.x - barWidth / 2 + (barWidth * i) / segments,
              y,
              1.5,
              5,
            );
          c.restore();
        }
      } else {
        const p = m.player;
        const level = m.centralLevel;
        const radius = 29 + level * 0.65;
        this.circle(p.x, p.y + 10, radius, '#111f3544');
        if (m.invulnerable > 0)
          this.circle(p.x, p.y, radius + 9, '#ddffff12', '#d5fcffaa', 3);
        for (const wing of m.wingmen) {
          const spec = badgeWeapon(m.chain[wing.level].key);
          c.save();
          c.strokeStyle = spec.color + '55';
          c.lineWidth = 1;
          c.setLineDash([3, 7]);
          c.beginPath();
          c.moveTo(p.x, p.y);
          c.lineTo(wing.x, wing.y);
          c.stroke();
          c.restore();
          this.badge(
            m.chain[wing.level].key,
            wing.x,
            wing.y,
            12 + wing.level * 0.25,
            true,
          );
        }
        if (m.dashTime > 0) {
          const photo = this.assets.get('bike-photo');
          const elapsed = 0.72 - m.dashTime;
          const opacity =
            0.88 * Math.min(1, elapsed / 0.08) * Math.min(1, m.dashTime / 0.16);
          if (photo) {
            c.save();
            c.globalAlpha = opacity;
            c.beginPath();
            roundRect(c, p.x - 116, p.y - 92, 232, 174, 18);
            c.clip();
            c.drawImage(photo, p.x - 116, p.y - 92, 232, 174);
            c.restore();
          }
          this.circle(p.x, p.y, radius + 14, '#72eaff11', '#83ecff', 4);
          this.text('学堂路车神', p.x, p.y - radius - 35, 18, '#aeedff');
        }
        c.save();
        if (m.invulnerable > 0 && m.dashTime <= 0 && Math.sin(t * 30) < 0)
          c.globalAlpha = 0.7;
        this.badge(m.chain[level].key, p.x, p.y, radius, true);
        c.restore();
        if (m instanceof SurvivalGameModel)
          drawBadgeBreakShield(
            c,
            p.x,
            p.y,
            radius,
            Math.max(m.breakShieldTime, m.invulnerable),
            reducedMotion,
          );
        if (
          m instanceof SurvivalGameModel &&
          Math.max(m.breakShieldTime, m.invulnerable) > 0
        ) {
          this.text(
            m.breakShieldTime > 0 ? '无敌护盾' : '战斗无敌',
            p.x,
            p.y - radius - 44,
            23,
            '#edffff',
          );
        }
        if (m instanceof SurvivalGameModel && m.hurtUntil > m.time)
          this.text(
            `−${m.lastHit}`,
            p.x + 55,
            p.y - radius - 30 - (0.5 - (m.hurtUntil - m.time)) * 60,
            34,
            '#ff6d80',
          );
        this.text(`Lv.${level + 1}`, p.x, p.y + radius + 19, 15, '#e1ffad');
        this.circle(p.x, p.y, 3, '#ffffff', '#49526b', 1);
      }
    }
    let decorativeCount = 0;
    for (const f of m.fx) {
      if (
        f.kind !== 'text' &&
        f.kind !== 'ring' &&
        ++decorativeCount > (this.touch ? 70 : 120)
      )
        continue;
      if (
        f.x < view.x - 150 ||
        f.x > view.x + view.width + 150 ||
        f.y < view.y - 150 ||
        f.y > view.y + view.height + 150
      )
        continue;
      const age = 1 - f.life / f.maxLife;
      c.save();
      c.globalAlpha = f.life / f.maxLife;
      if (f.kind === 'trail') {
        c.strokeStyle = f.color;
        c.lineWidth = 5;
        c.shadowColor = f.color;
        c.shadowBlur = 12;
        c.beginPath();
        c.ellipse(f.x, f.y, f.r, 10, 0, 0, Math.PI * 2);
        c.stroke();
      } else if (f.kind === 'burst') {
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = f.color;
        c.lineWidth = 4 * (1 - age) + 1;
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6 + f.x;
          const inner = f.r * age * 0.5,
            outer = f.r * (0.3 + age * 0.7);
          c.beginPath();
          c.moveTo(f.x + Math.cos(a) * inner, f.y + Math.sin(a) * inner);
          c.lineTo(f.x + Math.cos(a) * outer, f.y + Math.sin(a) * outer);
          c.stroke();
        }
        this.circle(f.x, f.y, Math.max(1, 24 * (1 - age)), f.color);
      } else if (f.kind === 'ring') {
        c.strokeStyle = f.color;
        c.lineWidth = (1 - age) * 9 + 1;
        c.beginPath();
        c.arc(f.x, f.y, Math.max(1, f.r * age), 0, Math.PI * 2);
        c.stroke();
      } else if (f.kind === 'text')
        this.text(f.text || '', f.x, f.y, 21, f.color);
      else this.circle(f.x, f.y, f.r, f.color);
      c.restore();
    }
    if (m.dashCooldown > 0) {
      c.strokeStyle = '#b6cdff';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(
        m.player.x,
        m.player.y,
        45 + m.centralLevel * 0.65,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * (1 - m.dashCooldown / 4),
      );
      c.stroke();
    }
    if (m.flash > 0 && !reducedMotion) {
      c.fillStyle = `rgba(220,205,255,${m.flash * 0.6})`;
      c.fillRect(view.x, view.y, view.width, view.height);
    }
    if (m.bannerTime > 0) {
      c.save();
      c.globalAlpha = Math.min(1, m.bannerTime * 2);
      c.fillStyle = '#180f36cc';
      const bw = Math.min(view.width - 80, 540);
      const by = view.y + (this.touch ? 115 : 130);
      c.fillRect(view.x + (view.width - bw) / 2, by, bw, 38);
      this.text(
        m.banner,
        view.x + view.width / 2,
        view.y + (this.touch ? 134 : 149),
        Math.min(19, view.width / 30),
        '#ffe4ff',
      );
      c.restore();
    }
    const offscreenBoss = m.enemies.find((e) => e.boss);
    const cue =
      offscreenBoss && (this.touch || m instanceof SurvivalGameModel)
        ? bossEdgeCue(view, offscreenBoss)
        : null;
    if (cue && offscreenBoss?.boss) {
      c.save();
      c.translate(cue.x, cue.y);
      this.circle(0, 0, 22, '#191020dd', bossSpec(offscreenBoss.boss).color, 2);
      c.rotate(cue.angle);
      c.fillStyle = '#ffe1e5';
      c.beginPath();
      c.moveTo(12, 0);
      c.lineTo(-7, -9);
      c.lineTo(-7, 9);
      c.closePath();
      c.fill();
      c.restore();
      this.text('BOSS', cue.x, cue.y + 34, 13, '#ffe1e5');
    }
    if (m.combo >= 3) {
      this.text(
        `${m.combo} 连破`,
        view.x + view.width - 85,
        view.y + 270,
        28,
        '#ffe298',
      );
      this.text(
        m.combo >= 20 ? '作业？已清空。' : '继续清场！',
        view.x + view.width - 85,
        view.y + 300,
        15,
        '#fff0c4',
      );
      c.fillStyle = '#ffe298';
      c.fillRect(
        view.x + view.width - 138,
        view.y + 322,
        (106 * m.comboTime) / 3.5,
        3,
      );
    }
    if (m.feastTime > 0)
      this.text(
        `鹅腿火力 ×2 · ${Math.ceil(m.feastTime)}s`,
        m.player.x,
        m.player.y + 80,
        17,
        '#beff97',
      );
    if (m.hp < 25) {
      const cx = view.x + view.width / 2,
        cy = view.y + view.height / 2;
      const grad = c.createRadialGradient(
        cx,
        cy,
        180,
        cx,
        cy,
        Math.max(view.width, view.height) * 0.56,
      );
      grad.addColorStop(0, '#b4001d00');
      grad.addColorStop(1, '#ca123d80');
      c.fillStyle = grad;
      c.fillRect(view.x, view.y, view.width, view.height);
    }
    if (m instanceof SurvivalGameModel && m.mode === 'playing') {
      const impact = Math.max(0, (m.hurtUntil - m.time) / 0.5);
      const storm = Math.max(0, (m.stormPulseUntil - m.time) / 0.28);
      if (impact > 0 || storm > 0) {
        c.save();
        c.strokeStyle =
          impact > 0
            ? `rgba(255,49,87,${0.85 * impact})`
            : `rgba(255,136,70,${0.6 * storm})`;
        c.lineWidth = impact > 0 ? 14 : 7;
        c.strokeRect(view.x + 7, view.y + 7, view.width - 14, view.height - 14);
        c.restore();
      }
    }
    c.restore();
  }
  private zone(
    x: number,
    y: number,
    r: number,
    color: string,
    cooldown: number,
    label: string,
  ) {
    const c = this.ctx;
    c.save();
    c.setLineDash([6, 8]);
    this.circle(x, y, r, color + '15', color + '99');
    c.setLineDash([]);
    this.text(
      cooldown > 0 ? `${Math.ceil(cooldown)}s 后恢复` : label,
      x,
      y + r + 20,
      14,
      cooldown > 0 ? '#d1d9d6' : color,
    );
    c.restore();
  }
  private registerTools() {
    const context = (document as Document & { modelContext?: ToolContext })
      .modelContext;
    if (!context?.registerTool) return;
    const add = (tool: Parameters<ToolContext['registerTool']>[0]) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: this.abort.signal }),
        ).catch(() => {});
      } catch {}
    };
    add({
      name: 'read_campus_game',
      description:
        'Read current visible campus game state, player coordinates, enemies and nearby dropped badges.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => ({
        ...this.model.snapshot(),
        player: this.model.player,
        enemies: this.model.enemies.map((e) => ({
          kind: e.kind,
          x: e.x,
          y: e.y,
          hp: e.hp,
        })),
        nearbyBadges: this.model.drops.map((d) => ({
          x: d.x,
          y: d.y,
          level: d.level,
          kind: d.kind,
        })),
      }),
    });
    add({
      name: 'control_campus_game',
      description:
        'During an existing semester, use the same merge, dash, pause and resume actions as the game controls. Does not start or reset a semester.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['merge', 'dash', 'skill', 'pause', 'resume'],
          },
        },
        required: ['action'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input) => {
        if (
          !input ||
          typeof input !== 'object' ||
          !('action' in input) ||
          !['merge', 'dash', 'skill', 'pause', 'resume'].includes(
            String(input.action),
          )
        )
          throw Error('Invalid action');
        const a = String(input.action);
        if (a === 'merge' || a === 'dash' || a === 'skill') {
          if (this.model.mode !== 'playing')
            throw Error('Start or resume the game first');
          const done =
            a === 'merge'
              ? this.model.merge()
              : a === 'dash'
                ? this.model.dash()
                : this.model.skill();
          this.emit(this.model.snapshot());
          return { performed: done, ...this.model.snapshot() };
        }
        if (
          (a === 'pause' && this.model.mode === 'playing') ||
          (a === 'resume' && this.model.mode === 'paused')
        )
          this.togglePause();
        return this.model.snapshot();
      },
    });
  }
  destroy() {
    this.destroyed = true;
    this.music.destroy();
    this.projectileCache.clear();
    this.assets.clear();
    this.bookCache.clear();
    this.sceneryBuffer = null;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.abort.abort();
    window.removeEventListener('resize', this.viewportResize);
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.visibility);
    if (this.audio) void this.audio.close().catch(() => {});
  }
}
