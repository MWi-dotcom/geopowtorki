/**
 * Układanie kolejki pytań: sesja dnia, tryb „przed sprawdzianem”, ćwiczenia
 * swobodne, dobór dystraktorów i ćwiczenie par mylonych obiektów.
 * Czysta logika – bez IndexedDB i UI (testy w tests/session.test.ts).
 */
import { retrievability, skillKind, skillsFor, stateKey, type ReviewState, type SchedulerSettings } from './scheduler';
import type { Feature, Skill } from './types';

export type QueueReason = 'due' | 'new' | 'confusion' | 'exam-risk' | 'exam-review' | 'practice' | 'retry';

export interface QueueItem {
  featureId: string;
  /** 'intro' = karta „Poznaj obiekt” przed pierwszymi pytaniami */
  kind: 'intro' | 'question';
  skill?: Skill;
  reason: QueueReason;
}

export interface ConfusionPair {
  key: string;
  a: string;
  b: string;
  count: number;
  lastAt: number;
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export type Rng = () => number;
export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Mulberry32 – powtarzalny generator do testów. */
export function seeded(seed: number): Rng {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}
export function startOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(0, 0, 0, 0);
  return e;
}
export function dayKey(d: Date | number): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export function parseDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
/** Liczba dni kalendarzowych od `from` do `to` (lokalnie). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

/** Partnerzy w mylonych parach (min. `minCount` pomyłek). */
export function confusionPartners(featureId: string, pairs: ConfusionPair[], minCount = 2): string[] {
  return pairs
    .filter((p) => p.count >= minCount && (p.a === featureId || p.b === featureId))
    .sort((x, y) => y.count - x.count)
    .map((p) => (p.a === featureId ? p.b : p.a));
}

/**
 * Rozkłada pytania tak, by ten sam obiekt nie pojawiał się dwa razy z rzędu
 * (o ile się da). Zachowuje mniej więcej kolejność wejściową.
 */
export function spreadOut(items: QueueItem[]): QueueItem[] {
  const out: QueueItem[] = [];
  const rest = [...items];
  while (rest.length) {
    const last = out[out.length - 1];
    let idx = rest.findIndex((it) => !last || it.featureId !== last.featureId || it.kind === 'intro' || last.kind === 'intro');
    if (idx < 0) idx = 0;
    out.push(rest.splice(idx, 1)[0]);
  }
  return out;
}

/** Pytania o nowe obiekty: najpierw karty „Poznaj”, potem pytania – w paczkach po 3 obiekty. */
function newBlock(featureIds: string[], byId: Record<string, Feature>, rng: Rng): QueueItem[] {
  const out: QueueItem[] = [];
  for (let i = 0; i < featureIds.length; i += 3) {
    const chunk = featureIds.slice(i, i + 3);
    for (const id of chunk) out.push({ featureId: id, kind: 'intro', reason: 'new' });
    const qs: QueueItem[] = [];
    for (const id of chunk) for (const sk of skillsFor(byId[id])) qs.push({ featureId: id, kind: 'question', skill: sk, reason: 'new' });
    // nazwy i wskazania przed faktami
    const core = shuffle(
      qs.filter((q) => skillKind(q.skill!) !== 'fact'),
      rng,
    );
    const facts = shuffle(
      qs.filter((q) => skillKind(q.skill!) === 'fact'),
      rng,
    );
    out.push(...spreadOut([...core, ...facts]));
  }
  return out;
}

/** Czy obiekt został już wprowadzony (ma jakikolwiek stan). */
export function isIntroduced(featureId: string, states: Map<string, ReviewState>): boolean {
  return states.has(stateKey(featureId, 'name')) || states.has(stateKey(featureId, 'locate'));
}

/** Zaległe stany (due do końca dnia) w zakresie, od najbardziej zaległych. */
export function dueStates(scopeIds: string[], states: Map<string, ReviewState>, now: Date): ReviewState[] {
  const scope = new Set(scopeIds);
  const end = endOfDay(now).getTime();
  return [...states.values()].filter((s) => scope.has(s.featureId) && s.due <= end).sort((a, b) => a.due - b.due);
}

export interface DailyInput {
  /** obiekty z aktywnego zakresu nauki (kolejność = kolejność wprowadzania) */
  scopeIds: string[];
  byId: Record<string, Feature>;
  states: Map<string, ReviewState>;
  confusions: ConfusionPair[];
  now: Date;
  /** limit nowych obiektów dziennie */
  newLimit: number;
  /** ilu nowych obiektów już dziś wprowadzono */
  introducedToday: number;
  maxReviews: number;
  rng?: Rng;
}

/** Dodaje partnera z mylonej pary (ta sama umiejętność) zaraz po pytaniu. */
function withConfusions(items: QueueItem[], have: Set<string>, states: Map<string, ReviewState>, confusions: ConfusionPair[]): QueueItem[] {
  const out: QueueItem[] = [];
  for (const r of items) {
    out.push(r);
    if (r.skill === 'locate' || r.skill === 'name') {
      for (const p of confusionPartners(r.featureId, confusions).slice(0, 1)) {
        const k = stateKey(p, r.skill);
        if (!have.has(k) && states.has(k)) {
          have.add(k);
          out.push({ featureId: p, kind: 'question', skill: r.skill, reason: 'confusion' });
        }
      }
    }
  }
  return out;
}

export function buildDailyQueue(inp: DailyInput): QueueItem[] {
  const rng = inp.rng ?? Math.random;
  const due = dueStates(inp.scopeIds, inp.states, inp.now).slice(0, inp.maxReviews);
  const reviews: QueueItem[] = due.map((s) => ({ featureId: s.featureId, kind: 'question', skill: s.skill, reason: 'due' }));
  const have = new Set(due.map((s) => s.key));
  const withPairs = withConfusions(shuffle(reviews, rng), have, inp.states, inp.confusions);

  const freeNew = Math.max(0, inp.newLimit - inp.introducedToday);
  const newIds = inp.scopeIds.filter((id) => !isIntroduced(id, inp.states)).slice(0, freeNew);

  // Najpierw powtórki (rozgrzewka z tym, co już znane), potem nowe obiekty.
  return [...spreadOut(withPairs), ...newBlock(newIds, inp.byId, rng)];
}

// ---------------------------------------------------------------------------
// Tryb „przed sprawdzianem”
// ---------------------------------------------------------------------------

export interface ExamInput {
  examIds: string[];
  examDate: Date;
  byId: Record<string, Feature>;
  states: Map<string, ReviewState>;
  confusions: ConfusionPair[];
  now: Date;
  newLimit: number;
  introducedToday: number;
  /** próg prawdopodobieństwa przypomnienia w dniu sprawdzianu */
  targetR?: number;
  settings?: SchedulerSettings;
  rng?: Rng;
}

export interface ExamPlan {
  queue: QueueItem[];
  daysLeft: number;
  newToday: number;
  unseen: number;
  atRisk: number;
  fullReview: boolean;
}

/**
 * Plan na dziś przed sprawdzianem:
 *  1. zaległe powtórki z materiału sprawdzianu,
 *  2. nowe obiekty rozłożone równo na dni do sprawdzianu (ceil(nowe / dni)),
 *     ale nie mniej niż zwykły dzienny limit,
 *  3. „zagrożone” – obiekty, których przewidywane R w dniu sprawdzianu < targetR;
 *     powtarzane wcześniej, rozłożone na pozostałe dni (FSRS uwzględnia krótszy
 *     odstęp, więc długoterminowy harmonogram pozostaje poprawny),
 *  4. w ostatniej sesji przed sprawdzianem (i w dniu sprawdzianu) – pełny przegląd
 *     wszystkich obiektów (nazwa + wskazanie); udane odpowiedzi „ponad plan”
 *     nie zmieniają harmonogramu (practiceUpdatesSchedule).
 */
export function buildExamPlan(inp: ExamInput): ExamPlan {
  const rng = inp.rng ?? Math.random;
  const targetR = inp.targetR ?? 0.9;
  const daysLeft = daysBetween(inp.now, inp.examDate);
  const fullReview = daysLeft <= 1;
  const examSet = new Set(inp.examIds);

  const due = dueStates(inp.examIds, inp.states, inp.now);
  const queue: QueueItem[] = due.map((s) => ({ featureId: s.featureId, kind: 'question', skill: s.skill, reason: 'due' }));
  const have = new Set(due.map((s) => s.key));

  const risky: { st: ReviewState; r: number }[] = [];
  for (const st of inp.states.values()) {
    if (!examSet.has(st.featureId) || have.has(st.key)) continue;
    const r = retrievability(st, inp.examDate, inp.settings);
    if (r < targetR) risky.push({ st, r });
  }
  risky.sort((a, b) => a.r - b.r);
  const riskToday = fullReview ? risky.length : Math.ceil(risky.length / Math.max(1, daysLeft));
  for (const { st } of risky.slice(0, riskToday)) {
    queue.push({ featureId: st.featureId, kind: 'question', skill: st.skill, reason: 'exam-risk' });
    have.add(st.key);
  }

  const unseenIds = inp.examIds.filter((id) => !isIntroduced(id, inp.states));
  const perDay = daysLeft > 0 ? Math.ceil(unseenIds.length / daysLeft) : unseenIds.length;
  const newToday = Math.min(unseenIds.length, Math.max(0, Math.max(perDay, inp.newLimit) - inp.introducedToday));
  const newIds = unseenIds.slice(0, newToday);
  for (const id of newIds) for (const sk of skillsFor(inp.byId[id])) have.add(stateKey(id, sk));

  const review: QueueItem[] = [];
  if (fullReview) {
    for (const id of inp.examIds)
      for (const sk of ['name', 'locate'] as Skill[]) {
        const k = stateKey(id, sk);
        if (!have.has(k)) review.push({ featureId: id, kind: 'question', skill: sk, reason: 'exam-review' });
      }
  }

  return {
    queue: [
      ...spreadOut(withConfusions(shuffle(queue, rng), have, inp.states, inp.confusions)),
      ...newBlock(newIds, inp.byId, rng),
      ...spreadOut(shuffle(review, rng)),
    ],
    daysLeft,
    newToday,
    unseen: unseenIds.length,
    atRisk: risky.length,
    fullReview,
  };
}

// ---------------------------------------------------------------------------
// Ćwiczenia swobodne (wybrana partia)
// ---------------------------------------------------------------------------

export function buildPracticeQueue(
  featureIds: string[],
  byId: Record<string, Feature>,
  kinds: { locate: boolean; name: boolean; facts: boolean },
  limit: number,
  rng: Rng = Math.random,
): QueueItem[] {
  const items: QueueItem[] = [];
  for (const id of featureIds) {
    for (const sk of skillsFor(byId[id], kinds)) items.push({ featureId: id, kind: 'question', skill: sk, reason: 'practice' });
  }
  return spreadOut(shuffle(items, rng)).slice(0, limit);
}

/** Wstawia ponownie błędnie rozwiązane pytanie kilka pozycji dalej. */
export function requeue(queue: QueueItem[], index: number, item: QueueItem, gap = 4): QueueItem[] {
  const q = [...queue];
  const pos = Math.min(q.length, index + 1 + gap);
  q.splice(pos, 0, { ...item, reason: 'retry' });
  return q;
}

// ---------------------------------------------------------------------------
// Dystraktory do pytań wielokrotnego wyboru
// ---------------------------------------------------------------------------

/**
 * Dystraktory: najpierw obiekty mylone z danym, potem ta sama kategoria
 * i kontynent, potem ta sama kategoria gdzie indziej, na końcu ten sam kontynent.
 * Pomija obiekty o tej samej nazwie oraz obiekty nadrzędne/podrzędne.
 */
export function pickDistractors(target: Feature, all: Feature[], confusions: ConfusionPair[], rng: Rng = Math.random, n = 3): Feature[] {
  const ok = (f: Feature) => f.id !== target.id && f.namePl !== target.namePl && f.parent !== target.id && target.parent !== f.id;
  const chosen: Feature[] = [];
  const add = (fs: Feature[]) => {
    for (const f of fs) {
      if (chosen.length >= n) return;
      if (ok(f) && !chosen.some((c) => c.id === f.id || c.namePl === f.namePl)) chosen.push(f);
    }
  };
  const byId = Object.fromEntries(all.map((f) => [f.id, f]));
  add(
    confusionPartners(target.id, confusions, 1)
      .map((id) => byId[id])
      .filter(Boolean),
  );
  const inCont = (f: Feature) => f.continent === target.continent || !!f.alsoIn?.includes(target.continent) || !!target.alsoIn?.includes(f.continent);
  add(shuffle(all.filter((f) => f.category === target.category && inCont(f)), rng));
  add(shuffle(all.filter((f) => f.category === target.category && !inCont(f)), rng));
  add(shuffle(all.filter((f) => inCont(f)), rng));
  return chosen;
}
