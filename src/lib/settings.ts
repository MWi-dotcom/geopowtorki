import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

export interface Settings {
  /** limit nowych obiektów dziennie */
  newPerDay: number;
  /** maks. liczba powtórek w jednej sesji dnia */
  maxReviews: number;
  /** docelowe prawdopodobieństwo przypomnienia (FSRS) */
  retention: number;
  theme: 'system' | 'light' | 'dark';
  /** partie, z których „Powtórz na dziś” wprowadza nowe obiekty */
  scope: string[];
  /** wybór z 4 opcji dla obiektów jeszcze w nauce */
  choiceForNew: boolean;
  /** animacje mapy */
  motion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 10,
  maxReviews: 80,
  retention: 0.9,
  theme: 'system',
  scope: ['europa:*'],
  choiceForNew: true,
  motion: true,
};

export function useSettings(): Settings {
  const rows = useLiveQuery(() => db.settings.toArray(), []);
  const s: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows ?? []) (s as unknown as Record<string, unknown>)[r.key] = r.value;
  return s;
}

export async function getSettings(): Promise<Settings> {
  const rows = await db.settings.toArray();
  const s: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) (s as unknown as Record<string, unknown>)[r.key] = r.value;
  return s;
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  return db.settings.put({ key, value });
}

export function applyTheme(theme: Settings['theme']) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f1d24' : '#eef2ee');
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
