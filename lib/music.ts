// Scene selection and 1.2s fades adapted from FreneticWind60's PR #1.
// Stream at most two tracks instead of decoding four complete tracks into memory.
export type MusicScene = 'battle' | 'urgent' | 'victory' | 'defeat';
export interface MusicMedia {
  src: string;
  preload: string;
  loop: boolean;
  volume: number;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
}
export function musicScene(hp: number, mode: string): MusicScene | null {
  if (mode === 'won') return 'victory';
  if (mode === 'lost') return 'defeat';
  return mode === 'playing' ? (hp < 50 ? 'urgent' : 'battle') : null;
}
type Voice = { scene: MusicScene; media: MusicMedia; volume: number };
export class GameMusic {
  private current: Voice | null = null;
  private outgoing: Voice | null = null;
  private desired: MusicScene | null = null;
  private muted = false;
  private unlocked = false;
  private destroyed = false;
  private retry = 0;
  constructor(private create: () => MusicMedia = () => new Audio()) {}
  unlock() {
    if (this.destroyed) return;
    this.unlocked = true;
    if (this.muted) return;
    // Called directly by the start button, before any awaited image request.
    if (!this.current) this.current = this.voice(this.desired || 'battle');
    this.play(this.current);
  }
  private voice(scene: MusicScene): Voice {
    const media = this.create();
    media.preload = 'none';
    media.src = `./audio/pr1-${scene}.mp3`;
    media.loop = scene === 'battle' || scene === 'urgent';
    media.volume = 0;
    return { scene, media, volume: 0 };
  }
  private play(voice: Voice) {
    void voice.media
      .play()
      .then(() => {
        if (
          this.destroyed ||
          this.muted ||
          voice !== this.current ||
          !this.desired
        )
          voice.media.pause();
      })
      .catch(() => {
        this.retry = 3;
      });
  }
  private release(voice: Voice | null) {
    if (!voice) return;
    voice.media.pause();
    voice.media.removeAttribute('src');
    voice.media.load();
  }
  setMuted(value: boolean) {
    this.muted = value;
    if (value) {
      for (const voice of [this.current, this.outgoing])
        if (voice) {
          voice.media.volume = 0;
          voice.volume = 0;
          voice.media.pause();
        }
    } else this.unlock();
  }
  update(hp: number, mode: string, dt: number, hidden = false) {
    if (this.destroyed) return;
    const desired = hidden ? null : musicScene(hp, mode);
    const changed = desired !== this.desired;
    this.desired = desired;
    if (!this.unlocked || this.muted) return;
    if (!desired) {
      this.current?.media.pause();
      this.release(this.outgoing);
      this.outgoing = null;
      return;
    }
    if (this.current?.scene !== desired) {
      this.release(this.outgoing);
      this.outgoing = this.current;
      this.current = this.voice(desired);
      this.play(this.current);
      this.retry = 0;
    } else if (changed) this.play(this.current);
    const step = (Math.min(Math.max(dt, 0), 0.1) * 0.3) / 1.2;
    this.current.volume = Math.min(0.3, this.current.volume + step);
    this.current.media.volume = this.current.volume;
    if (this.outgoing) {
      this.outgoing.volume = Math.max(0, this.outgoing.volume - step);
      this.outgoing.media.volume = this.outgoing.volume;
      if (!this.outgoing.volume) {
        this.release(this.outgoing);
        this.outgoing = null;
      }
    }
    if (this.retry > 0) {
      this.retry -= dt;
      if (this.retry <= 0) this.play(this.current);
    }
  }
  destroy() {
    this.destroyed = true;
    this.release(this.current);
    this.release(this.outgoing);
    this.current = this.outgoing = null;
  }
}
