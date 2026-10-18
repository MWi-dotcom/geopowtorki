import { describe, expect, it } from 'vitest';
import { Rating, State } from 'ts-fsrs';
import { applyReview, newState, practiceUpdatesSchedule, retrievability, skillsFor, stateKey, type ReviewState } from '../src/core/scheduler';
import {
  buildDailyQueue,
  buildExamPlan,
  buildPracticeQueue,
  confusionPartners,
  daysBetween,
  pairKey,
  pickDistractors,
  requeue,
  seeded,
  spreadOut,
  type ConfusionPair,
} from '../src/core/session';
import { examReadiness, featureMastery, forecast, streak, weakest } from '../src/core/stats';
import { FEATURES, FEATURE_BY_ID } from '../src/data/material';
import { deckFeatureIds, deckFromId } from '../src/data/meta';

const day = (d: number, h = 10) => new Date(2026, 9, d, h, 0, 0);

function put(map: Map<string, ReviewState>, s: ReviewState) {
  map.set(s.key, s);
}

/** Symulacja kilku poprawnych powtórek co termin. */
function learn(featureId: string, skill: 'name' | 'locate', start: Date, times: number, map: Map<string, ReviewState>) {
  let s = newState(featureId, skill, start);
  let now = start;
  for (let i = 0; i < times; i++) {
    s = applyReview(s, Rating.Good, now);
    now = new Date(Math.max(s.due, now.getTime() + 60_000));
  }
  put(map, s);
  return s;
}

describe('FSRS', () => {
  it('pudło skraca termin, dobra odpowiedź go wydłuża', () => {
    const now = day(1);
    const s0 = newState('eu-g-alpy', 'name', now);
    const good = applyReview(s0, Rating.Good, now);
    const again = applyReview(s0, Rating.Again, now);
    expect(good.due).toBeGreaterThan(again.due);
    expect(again.lastCorrect).toBe(false);
    expect(s0.card.state).toBe(State.New); // wejście niezmienione
  });
  it('po kilku powtórkach przechodzi w Review z rosnącym odstępem', () => {
    const m = new Map<string, ReviewState>();
    const s = learn('eu-g-alpy', 'name', day(1), 5, m);
    expect(s.card.state).toBe(State.Review);
    expect(s.due - day(1).getTime()).toBeGreaterThan(5 * 86_400_000);
    expect(retrievability(s, new Date(s.due))).toBeGreaterThan(0.8);
  });
  it('ćwiczenie ponad plan nie zmienia harmonogramu, błąd – zmienia', () => {
    const m = new Map<string, ReviewState>();
    const s = learn('eu-g-alpy', 'name', day(1), 4, m);
    const before = new Date(s.due - 86_400_000 * 2);
    expect(practiceUpdatesSchedule(s, true, before)).toBe(false);
    expect(practiceUpdatesSchedule(s, false, before)).toBe(true);
    expect(practiceUpdatesSchedule(s, true, new Date(s.due + 1))).toBe(true);
    expect(practiceUpdatesSchedule(undefined, true, before)).toBe(true);
  });
  it('umiejętności obiektu: nazwa, wskazanie, fakty', () => {
    expect(skillsFor(FEATURE_BY_ID['eu-g-alpy'])).toEqual(['name', 'locate', 'fact:szczyt', 'fact:wysokosc']);
    expect(skillsFor(FEATURE_BY_ID['eu-g-alpy'], { facts: false })).toEqual(['name', 'locate']);
  });
});

describe('sesja dnia', () => {
  const byId = FEATURE_BY_ID;
  const scope = deckFeatureIds(deckFromId('europa:*'));
  it('bez historii: tylko nowe obiekty (limit), z kartami „Poznaj”', () => {
    const q = buildDailyQueue({ scopeIds: scope, byId, states: new Map(), confusions: [], now: day(1), newLimit: 10, introducedToday: 0, maxReviews: 100, rng: seeded(1) });
    const intros = q.filter((i) => i.kind === 'intro');
    expect(intros.length).toBe(10);
    expect(new Set(q.map((i) => i.featureId)).size).toBe(10);
    // karta „Poznaj” przed pierwszym pytaniem o dany obiekt
    for (const it of intros) {
      const first = q.findIndex((x) => x.featureId === it.featureId);
      expect(q[first].kind).toBe('intro');
    }
  });
  it('limit nowych uwzględnia już wprowadzone dziś', () => {
    const q = buildDailyQueue({ scopeIds: scope, byId, states: new Map(), confusions: [], now: day(1), newLimit: 10, introducedToday: 7, maxReviews: 100, rng: seeded(1) });
    expect(q.filter((i) => i.kind === 'intro').length).toBe(3);
  });
  it('zaległe powtórki przed nowymi + partner z mylonej pary', () => {
    const m = new Map<string, ReviewState>();
    put(m, newState('az-r-ob', 'locate', day(1)));
    put(m, applyReview(newState('az-r-irtysz', 'locate', day(1)), Rating.Good, day(1)));
    m.get(stateKey('az-r-irtysz', 'locate'))!.due = day(30).getTime(); // nie jest due
    const conf: ConfusionPair[] = [{ key: pairKey('az-r-ob', 'az-r-irtysz'), a: 'az-r-ob', b: 'az-r-irtysz', count: 3, lastAt: 0 }];
    const q = buildDailyQueue({ scopeIds: ['az-r-ob', 'az-r-irtysz', 'az-r-lena'], byId, states: m, confusions: conf, now: day(2), newLimit: 5, introducedToday: 0, maxReviews: 100, rng: seeded(2) });
    expect(q[0]).toMatchObject({ featureId: 'az-r-ob', skill: 'locate', reason: 'due' });
    expect(q[1]).toMatchObject({ featureId: 'az-r-irtysz', skill: 'locate', reason: 'confusion' });
    expect(q.some((i) => i.featureId === 'az-r-lena' && i.kind === 'intro')).toBe(true);
  });
  it('spreadOut nie stawia tego samego obiektu dwa razy z rzędu', () => {
    const items = ['a', 'a', 'a', 'b', 'b', 'c'].map((f) => ({ featureId: f, kind: 'question' as const, skill: 'name' as const, reason: 'due' as const }));
    const out = spreadOut(items);
    for (let i = 1; i < out.length - 1; i++) expect(out[i].featureId === out[i - 1].featureId && out[i].featureId === out[i + 1].featureId).toBe(false);
  });
  it('requeue wstawia pytanie kilka pozycji dalej', () => {
    const q = ['a', 'b', 'c', 'd', 'e', 'f'].map((f) => ({ featureId: f, kind: 'question' as const, skill: 'name' as const, reason: 'due' as const }));
    const r = requeue(q, 0, q[0], 3);
    expect(r[4]).toMatchObject({ featureId: 'a', reason: 'retry' });
  });
  it('ćwiczenia swobodne – tylko wybrane typy', () => {
    const q = buildPracticeQueue(deckFeatureIds(deckFromId('europa:rzeki')), byId, { locate: true, name: false, facts: false }, 50, seeded(3));
    expect(q.every((i) => i.skill === 'locate')).toBe(true);
    expect(q.length).toBe(6);
  });
});

describe('tryb przed sprawdzianem', () => {
  const ids = deckFeatureIds(deckFromId('europa:gory')); // 10 obiektów
  it('rozkłada nowe obiekty na dni do sprawdzianu', () => {
    const p = buildExamPlan({ examIds: ids, examDate: day(6), byId: FEATURE_BY_ID, states: new Map(), confusions: [], now: day(1), newLimit: 1, introducedToday: 0, rng: seeded(4) });
    expect(p.daysLeft).toBe(5);
    expect(p.newToday).toBe(2); // ceil(10/5)
    expect(p.fullReview).toBe(false);
  });
  it('zwykły limit jest minimum', () => {
    const p = buildExamPlan({ examIds: ids, examDate: day(30), byId: FEATURE_BY_ID, states: new Map(), confusions: [], now: day(1), newLimit: 4, introducedToday: 0 });
    expect(p.newToday).toBe(4);
  });
  it('ostatni dzień: wszystkie nowe + pełny przegląd', () => {
    const m = new Map<string, ReviewState>();
    learn(ids[0], 'name', day(1), 4, m);
    learn(ids[0], 'locate', day(1), 4, m);
    const p = buildExamPlan({ examIds: ids, examDate: day(21), byId: FEATURE_BY_ID, states: m, confusions: [], now: day(20), newLimit: 2, introducedToday: 0 });
    expect(p.fullReview).toBe(true);
    expect(p.newToday).toBe(ids.length - 1);
    // każdy obiekt ma w kolejce pytanie o nazwę i o wskazanie
    for (const id of ids) {
      expect(p.queue.some((q) => q.featureId === id && q.skill === 'name')).toBe(true);
      expect(p.queue.some((q) => q.featureId === id && q.skill === 'locate')).toBe(true);
    }
  });
  it('obiekty zagrożone w dniu sprawdzianu trafiają do kolejki wcześniej', () => {
    const m = new Map<string, ReviewState>();
    const s = learn(ids[0], 'name', day(1), 2, m); // niska stabilność
    const exam = new Date(s.due + 20 * 86_400_000);
    const now = new Date(s.due - 86_400_000 * 1.5);
    const p = buildExamPlan({ examIds: [ids[0]], examDate: exam, byId: FEATURE_BY_ID, states: m, confusions: [], now, newLimit: 0, introducedToday: 0 });
    expect(p.atRisk).toBeGreaterThan(0);
  });
  it('daysBetween', () => {
    expect(daysBetween(day(1, 23), day(2, 1))).toBe(1);
    expect(daysBetween(day(5), day(5, 20))).toBe(0);
  });
});

describe('dystraktory i pary mylone', () => {
  it('3 różne dystraktory z tej samej kategorii, najpierw mylone', () => {
    const conf: ConfusionPair[] = [{ key: pairKey('np-j-huron', 'np-j-michigan'), a: 'np-j-huron', b: 'np-j-michigan', count: 1, lastAt: 0 }];
    const d = pickDistractors(FEATURE_BY_ID['np-j-huron'], FEATURES, conf, seeded(5));
    expect(d.length).toBe(3);
    expect(d[0].id).toBe('np-j-michigan');
    expect(d.every((f) => f.category === 'jeziora')).toBe(true);
    expect(new Set(d.map((f) => f.namePl)).size).toBe(3);
  });
  it('nie podsuwa obiektu nadrzędnego/podrzędnego', () => {
    for (let i = 0; i < 20; i++) {
      const d = pickDistractors(FEATURE_BY_ID['eu-wy-majorka'], FEATURES, [], seeded(i));
      expect(d.some((f) => f.id === 'eu-wy-baleary')).toBe(false);
    }
  });
  it('confusionPartners', () => {
    const conf: ConfusionPair[] = [
      { key: 'a|b', a: 'a', b: 'b', count: 3, lastAt: 0 },
      { key: 'a|c', a: 'a', b: 'c', count: 1, lastAt: 0 },
    ];
    expect(confusionPartners('a', conf)).toEqual(['b']);
    expect(confusionPartners('b', conf)).toEqual(['a']);
  });
});

describe('statystyki', () => {
  it('stany opanowania', () => {
    const m = new Map<string, ReviewState>();
    expect(featureMastery('eu-g-alpy', m, day(1))).toBe('new');
    put(m, applyReview(newState('eu-g-alpy', 'name', day(1)), Rating.Good, day(1)));
    expect(featureMastery('eu-g-alpy', m, day(1))).toBe('due'); // krok nauki – powtórka jeszcze dziś
    const n = learn('eu-g-ren', 'name', day(1), 7, m);
    learn('eu-g-ren', 'locate', day(1), 7, m);
    const now = new Date(Math.min(n.due, m.get(stateKey('eu-g-ren', 'locate'))!.due) - 3 * 86_400_000);
    expect(['mastered', 'learning']).toContain(featureMastery('eu-g-ren', m, now));
  });
  it('gotowość do sprawdzianu', () => {
    const m = new Map<string, ReviewState>();
    learn('x', 'name', day(1), 6, m);
    learn('x', 'locate', day(1), 6, m);
    expect(examReadiness(['x', 'y'], m, day(1))).toBe(0.5);
    expect(examReadiness([], m, day(1))).toBe(0);
  });
  it('prognoza 7 dni – zaległe liczą się dziś', () => {
    const m = new Map<string, ReviewState>();
    put(m, { ...newState('a', 'name', day(1)), due: day(1).getTime() - 5 * 86_400_000 });
    put(m, { ...newState('b', 'name', day(1)), due: day(3).getTime() });
    put(m, { ...newState('c', 'name', day(1)), due: day(20).getTime() });
    const f = forecast(m.values(), day(1));
    expect(f.length).toBe(7);
    expect(f[0].count).toBe(1);
    expect(f[2].count).toBe(1);
    expect(f.reduce((a, b) => a + b.count, 0)).toBe(2);
  });
  it('seria dni', () => {
    expect(streak(new Set(['2026-10-01', '2026-10-02', '2026-10-03']), day(3))).toBe(3);
    expect(streak(new Set(['2026-10-01', '2026-10-02']), day(3))).toBe(2); // dziś jeszcze bez nauki
    expect(streak(new Set(['2026-10-01']), day(3))).toBe(0);
  });
  it('najsłabsze obiekty', () => {
    const now = day(10);
    const logs = [
      { featureId: 'a', correct: false, at: now.getTime() },
      { featureId: 'a', correct: false, at: now.getTime() },
      { featureId: 'b', correct: true, at: now.getTime() },
      { featureId: 'b', correct: false, at: now.getTime() },
      { featureId: 'c', correct: true, at: now.getTime() },
    ];
    const w = weakest(logs, now);
    expect(w[0].featureId).toBe('a');
    expect(w.some((x) => x.featureId === 'c')).toBe(false);
  });
});
