import catalog from './book-photos.json';
import { TEXTBOOKS, type TextbookId } from './textbooks';
import type { BossId } from './bosses';
export type BookPhoto = {
  id: string;
  title: string;
  file: string;
  crop: number;
};
export const BOOK_PHOTOS: BookPhoto[] = [
  ...TEXTBOOKS.map((b) => ({
    id: b.id,
    title: b.short,
    file: b.file,
    crop: b.crop,
  })),
  ...catalog.photos,
];
const photos = new Map(BOOK_PHOTOS.map((p) => [p.id, p]));
// Every playable direction is explicitly assigned. Stages are fictional combat pacing.
const assignments: Record<string, number[]> = {
  arch: [0, 1, 2, 3, 4, 93],
  civil: [5, 6, 8],
  water: [7],
  ocean: [9],
  traffic: [10],
  environment: [11, 12, 13, 14, 64, 112],
  mechanical: [15, 16, 21, 113, 117, 120],
  instrument: [17],
  energy: [18, 59],
  vehicle: [19],
  industrial: [20, 72, 118],
  aerospace: [22, 24, 58, 115],
  physics: [23, 40, 42, 56, 105, 107, 108, 109, 116],
  electronic: [25, 26, 32],
  cs: [27, 30, 31, 33, 57, 63, 111],
  control: [28],
  chip: [29],
  materials: [34, 102],
  electric: [35],
  nuclear: [36, 38],
  chemistry: [37, 43],
  safety: [39],
  math: [41, 47, 60, 110, 124],
  earth: [44],
  astronomy: [45],
  psychology: [46],
  biology: [48],
  medicine: [49, 50, 52],
  pharmacy: [51],
  biomedical: [53, 61],
  health: [54, 55],
  design: [62, 92, 119],
  politics: [65, 74, 84, 85, 103, 114],
  management: [66, 70, 71, 73],
  accounting: [67],
  economics: [68, 86],
  finance: [69, 89],
  marx: [75],
  chinese: [76, 77, 104, 106, 125],
  history: [78, 79],
  philosophy: [80],
  language: [81, 123],
  sociology: [82, 83],
  law: [87],
  journalism: [88],
  art: [90, 91, 122],
  craft: [98],
  ceramics: [94],
  clothing: [96],
  visual: [95, 97],
  fineart: [99, 100],
  education: [101],
  sport: [121],
};
export const DEPARTMENT_BOOK_FAMILY = Object.fromEntries(
  Object.entries(assignments).flatMap(([family, ids]) =>
    ids.map((id) => [`d${String(id).padStart(3, '0')}`, family]),
  ),
);
const bookPools = new Map<string, BookPhoto[]>();
export function departmentBooks(id: string): BookPhoto[] {
  const cached = bookPools.get(id);
  if (cached) return cached;
  const family = DEPARTMENT_BOOK_FAMILY[id];
  if (!family) throw new Error(`Missing textbook family: ${id}`);
  if (family === 'math' || family === 'cs' || family === 'arch') {
    const pool = TEXTBOOKS.filter((b) => b.major === family).map((b) =>
      photos.get(b.id)!,
    );
    bookPools.set(id, pool);
    return pool;
  }
  const ids = catalog.families[family as keyof typeof catalog.families];
  const pool = [...new Set(ids)].map((key) => photos.get(key)!);
  bookPools.set(id, pool);
  return pool;
}
const enemyPhotos = new Map<string, BookPhoto>();
export function enemyBookPhoto(
  departmentId: string,
  bookId: TextbookId,
): BookPhoto {
  const key = departmentId + bookId;
  const cached = enemyPhotos.get(key);
  if (cached) return cached;
  const pool = departmentBooks(departmentId);
  const stats = TEXTBOOKS.find((b) => b.id === bookId)!;
  const variant =
    TEXTBOOKS.filter((b) => b.major === stats.major).indexOf(stats) % 2;
  if (pool.length === 8) {
    const photo = pool[(stats.year - 1) * 2 + (variant % 2)];
    enemyPhotos.set(key, photo);
    return photo;
  }
  // The year's main text alternates with a related text, both with genuine covers.
  const photo = pool[(stats.year - 1 + (variant % 2)) % pool.length];
  enemyPhotos.set(key, photo);
  return photo;
}
export const BOSS_PHOTOS: Record<
  BossId,
  {
    file: string;
    width: number;
    height: number;
    caption: string;
    radius: number;
  }
> = {
  coder: {
    file: 'coder-pity.png',
    width: 204,
    height: 72,
    caption: "码农出击 · That's pity",
    radius: 8,
  },
  snake: {
    file: 'photos/boss-snake.jpg',
    width: 174,
    height: 104,
    caption: 'Chinese Snake',
    radius: 9,
  },
  goosequeue: {
    file: 'photos/boss-goosequeue.jpg',
    width: 104,
    height: 139,
    caption: '鹅腿抢号 · 前面还有999位',
    radius: 6,
  },
  bike: {
    file: 'bike-photo.jpg',
    width: 176,
    height: 118,
    caption: '学堂路车神 · 借过！',
    radius: 18,
  },
  weishen: {
    file: 'photos/boss-weishen.jpg',
    width: 96,
    height: 139,
    caption: '两馒头一瓶水 · 显然',
    radius: 6,
  },
  swim: {
    file: 'photos/boss-swim.jpg',
    width: 174,
    height: 98,
    caption: '50m 泳测 · 下一个',
    radius: 26,
  },
  sunshine: {
    file: 'photos/boss-sunshine.jpg',
    width: 58,
    height: 100,
    caption: '阳光长跑',
    radius: 6,
  },
  hotsearch: {
    file: 'photos/boss-hotsearch.jpg',
    width: 136,
    height: 126,
    caption: '热搜 #1 · 指甲锉已就位',
    radius: 12,
  },
  final: {
    file: 'tsinghua-gate-1280.jpg',
    width: 216,
    height: 144,
    caption: '清华二校门 · 毕业天劫',
    radius: 4,
  },
};
