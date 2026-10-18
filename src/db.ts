/**
 * Dane użytkownika w IndexedDB (Dexie). Aplikacja działa bez logowania –
 * wszystko zostaje w przeglądarce; eksport/import w Ustawieniach.
 */
import Dexie, { type EntityTable } from 'dexie';
import type { ReviewState } from './core/scheduler';
import { pairKey, type ConfusionPair } from './core/session';
import type { Exam, Skill } from './core/types';

export type LogMode = 'daily' | 'exam' | 'practice' | 'contour';

export interface ReviewLogRow {
  id?: number;
  featureId: string;
  skill: Skill;
  at: number;
  correct: boolean;
  rating: number;
  /** odległość kliknięcia od obiektu (km) – dla „wskaż” */
  distanceKm?: number;
  ms: number;
  answer?: string;
  mode: LogMode;
  confusedWith?: string;
  /** czy odpowiedź zmieniła harmonogram FSRS */
  scheduled: boolean;
}

export interface UserVideo {
  id?: number;
  /** 'feature' albo 'deck' */
  targetType: 'feature' | 'deck';
  targetId: string;
  url: string;
  title: string;
  addedAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

class GeoDB extends Dexie {
  states!: EntityTable<ReviewState, 'key'>;
  logs!: EntityTable<ReviewLogRow, 'id'>;
  confusions!: EntityTable<ConfusionPair, 'key'>;
  exams!: EntityTable<Exam, 'id'>;
  videos!: EntityTable<UserVideo, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor() {
    super('geopowtorki');
    this.version(1).stores({
      states: 'key, featureId, due, introducedAt',
      logs: '++id, featureId, at, [featureId+skill]',
      confusions: 'key, count',
      exams: '++id, date',
      videos: '++id, [targetType+targetId]',
      settings: 'key',
    });
  }
}

export const db = new GeoDB();

export async function loadStates(): Promise<Map<string, ReviewState>> {
  const all = await db.states.toArray();
  return new Map(all.map((s) => [s.key, s]));
}

export async function recordConfusion(a: string, b: string) {
  const key = pairKey(a, b);
  await db.transaction('rw', db.confusions, async () => {
    const ex = await db.confusions.get(key);
    const [x, y] = a < b ? [a, b] : [b, a];
    await db.confusions.put({ key, a: x, b: y, count: (ex?.count ?? 0) + 1, lastAt: Date.now() });
  });
}

/** Eksport wszystkich danych do pliku JSON (kopia zapasowa / przeniesienie na inne urządzenie). */
export async function exportAll() {
  return {
    app: 'geopowtorki',
    version: 1,
    exportedAt: new Date().toISOString(),
    states: await db.states.toArray(),
    logs: await db.logs.toArray(),
    confusions: await db.confusions.toArray(),
    exams: await db.exams.toArray(),
    videos: await db.videos.toArray(),
    settings: await db.settings.toArray(),
  };
}

const reviveDates = (s: ReviewState): ReviewState => ({
  ...s,
  card: { ...s.card, due: new Date(s.card.due), last_review: s.card.last_review ? new Date(s.card.last_review) : undefined },
});

export async function importAll(data: Awaited<ReturnType<typeof exportAll>>) {
  if (data?.app !== 'geopowtorki') throw new Error('To nie jest plik eksportu GeoPowtórek.');
  await db.transaction('rw', [db.states, db.logs, db.confusions, db.exams, db.videos, db.settings], async () => {
    await Promise.all([db.states.clear(), db.logs.clear(), db.confusions.clear(), db.exams.clear(), db.videos.clear(), db.settings.clear()]);
    await db.states.bulkPut(data.states.map(reviveDates));
    await db.logs.bulkPut(data.logs);
    await db.confusions.bulkPut(data.confusions);
    await db.exams.bulkPut(data.exams);
    await db.videos.bulkPut(data.videos);
    await db.settings.bulkPut(data.settings);
  });
}

export async function resetAll() {
  await db.delete();
  location.reload();
}
