export const DEPARTMENT_RECORD_LIMIT = 10;
export const OVERALL_RECORD_LIMIT = 20;
export const RECORD_STORAGE_KEY = 'campus-records-v1';
const MAX_STORAGE_LENGTH = 500_000;
export interface RunRecord {
  id: string;
  departmentId: string;
  timeMs: number;
  completedAt: number;
  version: string;
}
export interface RecordBook {
  schema: 1;
  departments: Record<string, RunRecord[]>;
  overall: RunRecord[];
}
export const emptyRecordBook = (): RecordBook => ({
  schema: 1,
  departments: {},
  overall: [],
});
export function compareRecords(a: RunRecord, b: RunRecord) {
  return (
    a.timeMs - b.timeMs ||
    a.completedAt - b.completedAt ||
    a.id.localeCompare(b.id)
  );
}
function validRecord(
  value: unknown,
  known: ReadonlySet<string>,
): value is RunRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as RunRecord;
  return (
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    r.id.length <= 100 &&
    typeof r.departmentId === 'string' &&
    known.has(r.departmentId) &&
    Number.isSafeInteger(r.timeMs) &&
    r.timeMs > 0 &&
    Number.isSafeInteger(r.completedAt) &&
    r.completedAt > 0 &&
    typeof r.version === 'string' &&
    /^\d+\.\d+\.\d+$/.test(r.version)
  );
}
function top(records: RunRecord[], limit: number) {
  const seen = new Set<string>();
  return [...records]
    .sort(compareRecords)
    .filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .slice(0, limit);
}
export function addRecord(
  book: RecordBook,
  record: RunRecord,
  known: ReadonlySet<string>,
): RecordBook {
  if (!validRecord(record, known)) return book;
  return {
    schema: 1,
    departments: {
      ...book.departments,
      [record.departmentId]: top(
        [...(book.departments[record.departmentId] || []), record],
        DEPARTMENT_RECORD_LIMIT,
      ),
    },
    // Keep this independently: one department can occupy all twenty overall places.
    overall: top([...book.overall, record], OVERALL_RECORD_LIMIT),
  };
}
export function readRecordBook(
  raw: string | null,
  known: ReadonlySet<string>,
): RecordBook {
  const empty = emptyRecordBook();
  if (!raw || raw.length > MAX_STORAGE_LENGTH) return empty;
  try {
    const value = JSON.parse(raw);
    if (!value || value.schema !== 1) return empty;
    const book = emptyRecordBook();
    if (value.departments && typeof value.departments === 'object') {
      for (const id of known) {
        const list = value.departments[id];
        if (Array.isArray(list))
          book.departments[id] = top(
            list
              .slice(0, 100)
              .filter((r) => validRecord(r, known) && r.departmentId === id),
            DEPARTMENT_RECORD_LIMIT,
          );
      }
    }
    const overall = Array.isArray(value.overall)
      ? value.overall
          .slice(0, 200)
          .filter((r: unknown) => validRecord(r, known))
      : [];
    book.overall = top(
      [...overall, ...Object.values(book.departments).flat()],
      OVERALL_RECORD_LIMIT,
    );
    return book;
  } catch {
    return empty;
  }
}
export interface RecordStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function saveRecord(
  storage: RecordStorage,
  memory: RecordBook,
  record: RunRecord,
  known: ReadonlySet<string>,
) {
  let book = memory;
  try {
    const stored = readRecordBook(storage.getItem(RECORD_STORAGE_KEY), known);
    const departments: Record<string, RunRecord[]> = {};
    for (const id of known) {
      const rows = [
        ...(stored.departments[id] || []),
        ...(memory.departments[id] || []),
      ];
      if (rows.length) departments[id] = top(rows, DEPARTMENT_RECORD_LIMIT);
    }
    book = {
      schema: 1,
      departments,
      overall: top(
        [...stored.overall, ...memory.overall],
        OVERALL_RECORD_LIMIT,
      ),
    };
  } catch {
    /* Storage may be unavailable; retain this session's scores. */
  }
  const previousBest =
    book.departments[record.departmentId]?.[0]?.timeMs ?? null;
  book = addRecord(book, record, known);
  try {
    storage.setItem(RECORD_STORAGE_KEY, JSON.stringify(book));
    return { book, persisted: true, previousBest };
  } catch {
    return { book, persisted: false, previousBest };
  }
}
export function formatRecordTime(ms: number) {
  const centiseconds = Math.floor(ms / 10);
  return `${Math.floor(centiseconds / 6000)
    .toString()
    .padStart(
      2,
      '0',
    )}:${(Math.floor(centiseconds / 100) % 60).toString().padStart(2, '0')}.${(centiseconds % 100).toString().padStart(2, '0')}`;
}
