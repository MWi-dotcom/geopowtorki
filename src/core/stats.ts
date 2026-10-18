/**
 * Statystyki postępów: stan opanowania obiektu, gotowość do sprawdzianu,
 * prognoza powtórek, seria dni nauki, najsłabsze obiekty.
 */
import { retrievability, State, stateKey, type ReviewState, type SchedulerSettings } from './scheduler';
import { dayKey, endOfDay, startOfDay } from './session';

export type Mastery = 'new' | 'learning' | 'due' | 'mastered';

export const MASTERY_LABEL: Record<Mastery, string> = {
  new: 'Nowe',
  learning: 'W nauce',
  due: 'Do powtórki',
  mastered: 'Opanowane',
};

/** Ile dni stabilności uznajemy za „opanowane”. */
export const MASTERED_STABILITY_DAYS = 14;

/**
 * Stan obiektu na podstawie umiejętności „nazwij” i „wskaż” (fakty pomocniczo):
 *  - new       – jeszcze nie wprowadzony,
 *  - due       – jakaś umiejętność jest do powtórki dziś albo ostatnia odpowiedź była błędna,
 *  - mastered  – nazwa i wskazanie w fazie Review ze stabilnością ≥ 14 dni,
 *  - learning  – pozostałe.
 */
export function featureMastery(featureId: string, states: Map<string, ReviewState>, now: Date, factKeys: string[] = []): Mastery {
  const core = [states.get(stateKey(featureId, 'name')), states.get(stateKey(featureId, 'locate'))].filter(Boolean) as ReviewState[];
  if (!core.length) return 'new';
  const all = [...core, ...(factKeys.map((k) => states.get(k)).filter(Boolean) as ReviewState[])];
  const end = endOfDay(now).getTime();
  if (all.some((s) => s.due <= end || s.lastCorrect === false)) return 'due';
  if (core.length === 2 && core.every((s) => s.card.state === State.Review && s.card.stability >= MASTERED_STABILITY_DAYS)) return 'mastered';
  return 'learning';
}

export interface MasteryCounts {
  new: number;
  learning: number;
  due: number;
  mastered: number;
  total: number;
}
export function countMastery(list: Mastery[]): MasteryCounts {
  const c: MasteryCounts = { new: 0, learning: 0, due: 0, mastered: 0, total: list.length };
  for (const m of list) c[m]++;
  return c;
}

/**
 * Gotowość do sprawdzianu: odsetek obiektów, dla których przewidywane
 * prawdopodobieństwo przypomnienia w dniu sprawdzianu (min. z „nazwij”
 * i „wskaż”) wynosi co najmniej `threshold`.
 */
export function examReadiness(featureIds: string[], states: Map<string, ReviewState>, examDate: Date, threshold = 0.85, s?: SchedulerSettings): number {
  if (!featureIds.length) return 0;
  const at = new Date(startOfDay(examDate).getTime() + 8 * 3600_000); // rano w dniu sprawdzianu
  let ok = 0;
  for (const id of featureIds) {
    const r = Math.min(retrievability(states.get(stateKey(id, 'name')), at, s), retrievability(states.get(stateKey(id, 'locate')), at, s));
    if (r >= threshold) ok++;
  }
  return ok / featureIds.length;
}

/** Prognoza: ile powtórek przypada na każdy z najbliższych `days` dni (zaległe → dziś). */
export function forecast(states: Iterable<ReviewState>, now: Date, days = 7): { day: string; count: number }[] {
  const out = Array.from({ length: days }, (_, i) => {
    const d = new Date(startOfDay(now));
    d.setDate(d.getDate() + i);
    return { day: dayKey(d), count: 0, end: endOfDay(d).getTime() };
  });
  for (const s of states) {
    const idx = out.findIndex((o) => s.due <= o.end);
    if (idx >= 0) out[idx].count++;
  }
  return out.map(({ day, count }) => ({ day, count }));
}

/** Seria: kolejne dni z nauką, kończąca się dziś lub wczoraj. */
export function streak(activeDays: Set<string>, now: Date): number {
  const d = startOfDay(now);
  if (!activeDays.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (activeDays.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export interface LogLike {
  featureId: string;
  correct: boolean;
  at: number;
}

/**
 * Najsłabsze obiekty: wynik = błędy ważone świeżością (nowsze ważą więcej)
 * minus poprawne; tylko obiekty z co najmniej 2 próbami i choć jednym błędem.
 */
export function weakest(logs: LogLike[], now: Date, limit = 10): { featureId: string; wrong: number; total: number; score: number }[] {
  const m = new Map<string, { wrong: number; total: number; score: number }>();
  for (const l of logs) {
    const ageDays = (now.getTime() - l.at) / 86_400_000;
    const w = Math.exp(-ageDays / 21);
    const e = m.get(l.featureId) ?? { wrong: 0, total: 0, score: 0 };
    e.total++;
    if (!l.correct) {
      e.wrong++;
      e.score += w;
    } else e.score -= 0.35 * w;
    m.set(l.featureId, e);
  }
  return [...m.entries()]
    .filter(([, e]) => e.total >= 2 && e.wrong > 0 && e.score > 0)
    .map(([featureId, e]) => ({ featureId, ...e }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
