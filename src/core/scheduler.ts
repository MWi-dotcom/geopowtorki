/**
 * Warstwa powtórek oparta na FSRS (biblioteka ts-fsrs).
 *
 * Konfiguracja (uzasadnienie w README):
 *  - request_retention 0.9   – 90% szans na przypomnienie w dniu powtórki,
 *  - maximum_interval 180    – najdłużej pół roku przerwy (rok szkolny),
 *  - learning_steps 1m, 10m  – nowe obiekty wracają jeszcze w tej samej sesji,
 *  - relearning_steps 10m    – pomyłka = powtórka za chwilę,
 *  - enable_fuzz             – rozrzut terminów, żeby powtórki się nie kumulowały.
 */
import { createEmptyCard, fsrs, Rating, State, type Card, type FSRS, type Grade } from 'ts-fsrs';
import type { Feature, Skill } from './types';

export interface ReviewState {
  /** `${featureId}|${skill}` */
  key: string;
  featureId: string;
  skill: Skill;
  card: Card;
  /** card.due jako liczba (indeks w IndexedDB) */
  due: number;
  introducedAt: number;
  lastCorrect?: boolean;
}

export const stateKey = (featureId: string, skill: Skill) => `${featureId}|${skill}`;

export interface SchedulerSettings {
  retention: number;
  maxIntervalDays: number;
}
export const DEFAULT_SCHEDULER: SchedulerSettings = { retention: 0.9, maxIntervalDays: 180 };

let cached: { key: string; f: FSRS } | null = null;
export function getFsrs(s: SchedulerSettings = DEFAULT_SCHEDULER): FSRS {
  const key = `${s.retention}|${s.maxIntervalDays}`;
  if (cached?.key !== key) {
    cached = {
      key,
      f: fsrs({
        request_retention: s.retention,
        maximum_interval: s.maxIntervalDays,
        enable_fuzz: true,
        enable_short_term: true,
        learning_steps: ['1m', '10m'],
        relearning_steps: ['10m'],
      }),
    };
  }
  return cached.f;
}

export function newState(featureId: string, skill: Skill, now: Date): ReviewState {
  const card = createEmptyCard(now);
  return { key: stateKey(featureId, skill), featureId, skill, card, due: card.due.getTime(), introducedAt: now.getTime() };
}

/** Zastosuj ocenę – zwraca NOWY stan (nie modyfikuje wejścia). */
export function applyReview(st: ReviewState, rating: Grade, now: Date, s?: SchedulerSettings): ReviewState {
  const { card } = getFsrs(s).next(st.card, now, rating);
  return { ...st, card, due: card.due.getTime(), lastCorrect: rating !== Rating.Again };
}

/** Prawdopodobieństwo przypomnienia w danym momencie (0–1); nowy obiekt = 0. */
export function retrievability(st: ReviewState | undefined, at: Date, s?: SchedulerSettings): number {
  if (!st || st.card.state === State.New) return 0;
  return getFsrs(s).get_retrievability(st.card, at, false);
}

/**
 * Czy powtórkę ćwiczeniową (tryb swobodny, mapa konturowa, pełny przegląd
 * przed sprawdzianem) wpisać do harmonogramu FSRS?
 *  - TAK, gdy element i tak był do powtórki (due) albo jest nowy,
 *  - TAK, gdy odpowiedź była błędna (to prawdziwa informacja o zapominaniu),
 *  - NIE w pozostałych przypadkach – udana „dodatkowa” powtórka nie przesuwa
 *    harmonogramu długoterminowego (zostaje tylko w historii odpowiedzi).
 */
export function practiceUpdatesSchedule(st: ReviewState | undefined, correct: boolean, now: Date): boolean {
  if (!st) return true;
  if (!correct) return true;
  return st.due <= now.getTime();
}

export function skillsFor(f: Feature, include: { locate?: boolean; name?: boolean; facts?: boolean } = {}): Skill[] {
  const { locate = true, name = true, facts = true } = include;
  const out: Skill[] = [];
  if (name) out.push('name');
  if (locate) out.push('locate');
  if (facts) for (const fa of f.facts) out.push(`fact:${fa.id}`);
  return out;
}

export function skillKind(skill: Skill): 'locate' | 'name' | 'fact' {
  return skill === 'locate' ? 'locate' : skill === 'name' ? 'name' : 'fact';
}

export { Rating, State };
export type { Card, Grade };
