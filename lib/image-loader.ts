export interface LoadableImage {
  onload: GlobalEventHandlers['onload'];
  onerror: GlobalEventHandlers['onerror'];
  src: string;
  decoding: string;
}
// Dependency injection lets tests cover a request that never fires either callback.
export class ImageLoader<T extends LoadableImage> {
  private cache = new Map<string, T>();
  private pending = new Map<string, Promise<T>>();
  constructor(
    private create: () => T,
    private timeoutMs = 4500,
    private attempts = 2,
  ) {}
  load(src: string): Promise<T> {
    const cached = this.cache.get(src);
    if (cached) return Promise.resolve(cached);
    const pending = this.pending.get(src);
    if (pending) return pending;
    const work = this.retry(src).finally(() => this.pending.delete(src));
    this.pending.set(src, work);
    return work;
  }
  private async retry(src: string) {
    for (let i = 0; i < this.attempts; i++) {
      try {
        const img = await this.once(src);
        this.cache.set(src, img);
        return img;
      } catch (error) {
        if (i === this.attempts - 1) throw error;
      }
    }
    throw new Error(`无法加载 ${src}`);
  }
  private once(src: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const img = this.create();
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        img.onload = img.onerror = null;
        if (ok) resolve(img);
        else {
          img.src = '';
          reject(new Error(`图片加载超时或失败：${src}`));
        }
      };
      const timer = setTimeout(() => finish(false), this.timeoutMs);
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      img.decoding = 'async';
      img.src = src;
    });
  }
}
export async function loadImageBatch<T>(
  defs: string[][],
  load: (src: string) => Promise<T>,
  accept: (key: string, value: T) => void,
  progress: (done: number, total: number) => void = () => {},
  budgetMs = 12000,
) {
  let cursor = 0,
    done = 0,
    stopped = false;
  const success = new Set<string>();
  const failed: string[] = [];
  progress(0, defs.length);
  let deadline: ReturnType<typeof setTimeout>;
  const timeout = new Promise<string[]>((resolve) => {
    deadline = setTimeout(() => {
      stopped = true;
      resolve(defs.filter(([key]) => !success.has(key)).map(([key]) => key));
    }, budgetMs);
  });
  const work = Promise.all(
    Array.from({ length: Math.min(4, defs.length) }, async () => {
      while (!stopped && cursor < defs.length) {
        const [key, src] = defs[cursor++];
        try {
          accept(key, await load(src));
          success.add(key);
        } catch {
          failed.push(key);
        }
        if (!stopped) progress(++done, defs.length);
      }
    }),
  ).then(() => failed);
  const result = await Promise.race([work, timeout]);
  stopped = true;
  clearTimeout(deadline!);
  return result;
}
