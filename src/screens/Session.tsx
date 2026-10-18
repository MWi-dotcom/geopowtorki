/**
 * Ekran sesji: sesja dnia, tryb przed sprawdzianem i ćwiczenia swobodne.
 * Mapa zajmuje cały ekran, pytanie i odpowiedź w panelu (telefon: u dołu).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Position } from 'geojson';
import { AnswerIndex, matchFact, type FactResult, type MatchResult } from '../core/answers';
import { gradeClick, HIT_TOLERANCE, pointerMarginKm, ratingFromOutcome, type Outcome } from '../core/grading';
import { applyReview, newState, practiceUpdatesSchedule, Rating, skillKind, State, stateKey, type ReviewState } from '../core/scheduler';
import {
  buildDailyQueue,
  buildExamPlan,
  buildPracticeQueue,
  pickDistractors,
  requeue,
  shuffle,
  startOfDay,
  type ConfusionPair,
  type ExamPlan,
  type QueueItem,
} from '../core/session';
import type { ContinentId, Fact, Feature } from '../core/types';
import { FEATURES, FEATURE_BY_ID } from '../data/material';
import { categoryOne, continentName, deckFeatureIds, deckFromId, REGION_KM } from '../data/meta';
import { db, loadStates, recordConfusion, type LogMode } from '../db';
import { GeoMap, type MapApi } from '../map/GeoMap';
import { ensureFeatures, GEO_META, getGeometry, PEAKS } from '../lib/geo';
import { go } from '../lib/router';
import { getSettings, isTouchPointer, type Settings } from '../lib/settings';
import { useMapPadding } from '../lib/useMapPadding';
import { FeatureThumb } from '../components/FeatureThumb';
import { Button, Icon, Kbd, LinkButton, Verdict, formatDuration, plural } from '../components/ui';
import { VideoList } from '../components/Videos';

const answerIndex = new AnswerIndex(FEATURES);
const displayName = (f: Feature) => f.label ?? f.namePl;

type SessionType = 'daily' | 'exam' | 'practice';

interface Result {
  item: QueueItem;
  correct: boolean;
  ms: number;
}

interface Feedback {
  kind: 'ok' | 'typo' | 'bad';
  text: React.ReactNode;
  /** czy można poprawić ręcznie („to była literówka”) */
  canCorrect: boolean;
}

interface LastCommit {
  key: string;
  prev: ReviewState | undefined;
  logId: number;
  index: number;
  scheduled: boolean;
}

export function SessionScreen({ params, dark }: { params: URLSearchParams; dark: boolean }) {
  const type = (params.get('type') ?? 'daily') as SessionType;
  const [settings, setSettings] = useState<Settings | null>(null);
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [examPlan, setExamPlan] = useState<ExamPlan | null>(null);
  const [examName, setExamName] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [done, setDone] = useState(false);
  const [mapIds, setMapIds] = useState<string[]>([]);
  const [startedAt] = useState(Date.now());
  const statesRef = useRef<Map<string, ReviewState>>(new Map());
  const confRef = useRef<ConfusionPair[]>([]);
  const retries = useRef<Map<string, number>>(new Map());
  const lastCommit = useRef<LastCommit | null>(null);
  const shownAt = useRef(Date.now());
  const mapApi = useRef<MapApi>(null);
  const [mapReady, setMapReady] = useState(false);
  const { panelRef, padding } = useMapPadding();

  const mode: LogMode = type === 'daily' ? 'daily' : type === 'exam' ? 'exam' : 'practice';

  // --- budowa kolejki ---
  useEffect(() => {
    (async () => {
      const s = await getSettings();
      setSettings(s);
      const states = await loadStates();
      statesRef.current = states;
      confRef.current = await db.confusions.toArray();
      const now = new Date();
      const introducedToday = [...states.values()].filter((x) => x.skill === 'name' && x.introducedAt >= startOfDay(now).getTime()).length;
      let q: QueueItem[] = [];
      if (type === 'daily') {
        const scopeIds = [...new Set(s.scope.flatMap((d) => deckFeatureIds(deckFromId(d))))];
        // zaległe powtórki obejmują wszystko, czego się uczono – nie tylko bieżący zakres
        const allIntroduced = [...new Set([...states.values()].map((x) => x.featureId))];
        q = buildDailyQueue({
          scopeIds: [...new Set([...scopeIds, ...allIntroduced])].sort((a, b) => order(a, scopeIds) - order(b, scopeIds)),
          byId: FEATURE_BY_ID,
          states,
          confusions: confRef.current,
          now,
          newLimit: s.newPerDay,
          introducedToday,
          maxReviews: s.maxReviews,
        });
      } else if (type === 'exam') {
        const exam = await db.exams.get(Number(params.get('exam')));
        if (exam) {
          setExamName(exam.name);
          const ids = [...new Set(exam.deckIds.flatMap((d) => deckFeatureIds(deckFromId(d))))];
          const [y, m, d] = exam.date.split('-').map(Number);
          const plan = buildExamPlan({
            examIds: ids,
            examDate: new Date(y, m - 1, d),
            byId: FEATURE_BY_ID,
            states,
            confusions: confRef.current,
            now,
            newLimit: s.newPerDay,
            introducedToday,
            settings: { retention: s.retention, maxIntervalDays: 180 },
          });
          setExamPlan(plan);
          q = plan.queue;
        }
      } else {
        const ids = params.get('ids')?.split(',').filter((x) => FEATURE_BY_ID[x]) ?? [...new Set((params.get('deck') ?? '').split(',').filter(Boolean).flatMap((d) => deckFeatureIds(deckFromId(d))))];
        const k = params.get('kinds') ?? 'ln';
        q = buildPracticeQueue(ids, FEATURE_BY_ID, { locate: k.includes('l'), name: k.includes('n'), facts: k.includes('f') }, Number(params.get('limit') ?? 30));
      }
      // geometrie całych kontynentów (do wykrywania pomyłek przy klikaniu)
      const conts = new Set(q.map((i) => FEATURE_BY_ID[i.featureId].continent));
      const ids = FEATURES.filter((f) => conts.has(f.continent)).map((f) => f.id);
      await ensureFeatures(ids);
      setMapIds(ids);
      setQueue(q);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const item = queue?.[idx];
  const feature = item ? FEATURE_BY_ID[item.featureId] : null;
  const continent: ContinentId = feature?.continent ?? 'europa';

  // --- przygotowanie mapy dla bieżącego pytania ---
  useEffect(() => {
    const api = mapApi.current;
    if (!api || !mapReady || !item || !feature) return;
    setFeedback(null);
    shownAt.current = Date.now();
    api.showAnswer(null);
    const kind = item.kind === 'intro' ? 'intro' : skillKind(item.skill!);
    const meta = GEO_META[feature.id];
    if (kind === 'locate') {
      api.setHighlights({});
      api.fitRegion(continent);
    } else {
      api.setHighlights({ [feature.id]: kind === 'name' ? 'target' : 'focus' });
      if (meta.size < 700) api.flyToFeature(feature.id);
      else api.fitRegion(continent);
    }
    if (kind === 'intro') {
      const peakFact = feature.facts.find((f) => f.peakRef);
      const p = peakFact?.peakRef ? PEAKS[peakFact.peakRef] : null;
      if (p) api.showPeak([p[0], p[1]], feature.facts.find((f) => f.id === 'szczyt')?.a);
    }
  }, [item, feature, mapReady, continent]);

  const answered = feedback !== null;

  // --- zapis odpowiedzi ---
  const commit = useCallback(
    async (outcome: Outcome, extra: { answer?: string; distanceKm?: number; confusedWith?: string }) => {
      if (!item || !item.skill || !feature || !settings) return;
      const kind = skillKind(item.skill);
      const rating = ratingFromOutcome(outcome, kind);
      const key = stateKey(item.featureId, item.skill);
      const prev = statesRef.current.get(key);
      const now = new Date();
      const forced = item.reason === 'due' || item.reason === 'new' || item.reason === 'exam-risk' || item.reason === 'retry';
      const scheduled = forced || practiceUpdatesSchedule(prev, outcome.correct, now);
      if (scheduled) {
        const next = applyReview(prev ?? newState(item.featureId, item.skill, now), rating, now, { retention: settings.retention, maxIntervalDays: 180 });
        statesRef.current.set(key, next);
        await db.states.put(next);
      }
      const logId = (await db.logs.add({
        featureId: item.featureId,
        skill: item.skill,
        at: now.getTime(),
        correct: outcome.correct,
        rating,
        ms: outcome.ms,
        mode,
        scheduled,
        ...extra,
      })) as number;
      lastCommit.current = { key, prev, logId, index: idx, scheduled };
      if (extra.confusedWith) await recordConfusion(item.featureId, extra.confusedWith);
      setResults((r) => [...r, { item, correct: outcome.correct, ms: outcome.ms }]);
      if (!outcome.correct) {
        const n = retries.current.get(key) ?? 0;
        if (n < 2) {
          retries.current.set(key, n + 1);
          setQueue((q) => requeue(q!, idx, item));
        }
      }
    },
    [item, feature, settings, idx, mode],
  );

  /** „To była literówka” – zalicz jako poprawną z oceną Hard. */
  const correctAsTypo = useCallback(async () => {
    const lc = lastCommit.current;
    if (!lc || !item?.skill || !settings) return;
    const now = new Date();
    // przelicz od stanu sprzed odpowiedzi – jakby od razu była poprawna (Hard)
    const fixed = applyReview(lc.prev ?? newState(item.featureId, item.skill, now), Rating.Hard, now, { retention: settings.retention, maxIntervalDays: 180 });
    statesRef.current.set(lc.key, fixed);
    await db.states.put(fixed);
    await db.logs.update(lc.logId, { correct: true, rating: Rating.Hard, scheduled: true });
    // usuń ponowne pytanie dodane po błędzie
    setQueue((q) => {
      const pos = q!.findIndex((x, i) => i > lc.index && x.reason === 'retry' && x.featureId === item.featureId && x.skill === item.skill);
      return pos >= 0 ? q!.filter((_, i) => i !== pos) : q;
    });
    retries.current.set(lc.key, Math.max(0, (retries.current.get(lc.key) ?? 1) - 1));
    setResults((r) => r.map((x, i) => (i === r.length - 1 ? { ...x, correct: true } : x)));
    setFeedback({ kind: 'typo', text: <>Zaliczone jako literówka. Poprawny zapis: <strong>{displayName(feature!)}</strong>.</>, canCorrect: false });
    lastCommit.current = null;
  }, [item, settings, feature]);

  const next = useCallback(() => {
    if (!queue) return;
    if (idx + 1 >= queue.length) setDone(true);
    else setIdx(idx + 1);
  }, [idx, queue]);

  // --- „Wskaż na mapie” ---
  const onMapClick = useCallback(
    (p: Position, kmPerPx: number) => {
      if (!item || item.kind !== 'question' || item.skill !== 'locate' || answered || !feature) return;
      const level = settings?.hitTolerance ?? 'normal';
      const clickOpts = { factor: HIT_TOLERANCE[level].factor, minKm: pointerMarginKm(level, kmPerPx, isTouchPointer()) };
      const geom = getGeometry(feature.id);
      const meta = GEO_META[feature.id];
      if (!geom) return;
      const regionKm = REGION_KM[feature.continent];
      const res = gradeClick(p, geom, meta.t, regionKm, meta.approx, clickOpts);
      const ms = Date.now() - shownAt.current;
      // w co kliknięto zamiast tego? (ta sama kategoria, ten sam kontynent)
      let other: Feature | undefined;
      if (!res.correct) {
        const cands = FEATURES.filter((f) => f.id !== feature.id && f.category === feature.category && (f.continent === feature.continent || f.alsoIn?.includes(feature.continent)))
          .map((f) => {
            const g = getGeometry(f.id);
            const m = GEO_META[f.id];
            return g ? { f, r: gradeClick(p, g, m.t, regionKm, m.approx, clickOpts), size: m.size } : null;
          })
          .filter((x): x is NonNullable<typeof x> => !!x && x.r.correct)
          .sort((a, b) => a.r.distanceKm - b.r.distanceKm || a.size - b.size);
        other = cands[0]?.f;
      }
      const api = mapApi.current!;
      api.setHighlights({ [feature.id]: res.correct ? 'correct' : 'wrong', ...(other ? { [other.id]: 'other' } : {}) });
      const km = Math.round(res.distanceKm);
      api.showAnswer(p, res.correct ? null : res.nearest, res.correct, res.correct ? undefined : `${km} km`);
      // przy pudle obejmij widokiem także miejsce kliknięcia – uczeń widzi, jak daleko był
      api.flyToFeature(feature.id, other ? [other.id] : [], res.correct ? [] : [p]);
      setFeedback({
        kind: res.correct ? 'ok' : 'bad',
        text: res.correct ? (
          km === 0 ? (
            <>Trafione w {displayName(feature)}.</>
          ) : (
            <>Trafione – {km} km od obiektu, w granicach tolerancji.</>
          )
        ) : (
          <>
            Kliknięcie {km} km od obiektu {displayName(feature)} (tolerancja {Math.round(res.toleranceKm)} km).
            {other && (
              <>
                {' '}
                Wskazano: <strong>{displayName(other)}</strong> (zaznaczone na pomarańczowo).
              </>
            )}
          </>
        ),
        canCorrect: false,
      });
      commit({ correct: res.correct, ms }, { distanceKm: Math.round(res.distanceKm * 10) / 10, confusedWith: other?.id });
    },
    [item, answered, feature, commit, settings],
  );

  // --- klawiatura: Enter = dalej ---
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (answered || item?.kind === 'intro') && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        next();
      }
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, [answered, item, next]);

  if (done || (queue && queue.length === 0)) {
    return <Summary results={results} startedAt={startedAt} type={type} empty={queue?.length === 0} params={params} examPlan={examPlan} />;
  }

  const total = queue?.length ?? 0;
  const progress = total ? idx / total : 0;

  return (
    <div className="fixed inset-0 flex flex-col">
      <GeoMap
        ref={mapApi}
        className="flex-1"
        region={continent}
        mode="exercise"
        featureIds={mapIds}
        padding={padding}
        onMapClick={onMapClick}
        dark={dark}
        motion={settings?.motion}
        onReady={() => setMapReady(true)}
      />
      <ZoomButtons api={mapApi} />

      <div
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 max-h-[58vh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface/97 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(0,0,0,.12)] backdrop-blur md:inset-auto md:left-4 md:top-4 md:max-h-[calc(100vh-2rem)] md:w-[380px] md:rounded-2xl md:border md:pb-4"
      >
        <div className="mb-3 flex items-center gap-3">
          <button onClick={() => (results.length ? setDone(true) : go('/'))} className="flex size-9 items-center justify-center rounded-full hover:bg-sunken" aria-label="Zakończ sesję">
            <Icon name="cross" size={18} />
          </button>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={idx} aria-valuemax={total} aria-label="Postęp sesji">
            <div className="h-full rounded-full bg-water transition-[width]" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="text-sm tabular-nums text-ink-soft">
            {Math.min(idx + 1, total)}/{total}
          </span>
        </div>
        {examPlan && idx === 0 && !answered && (
          <p className="mb-2 rounded-lg bg-sunken px-3 py-2 text-sm text-ink-soft">
            {examName}: {examPlan.daysLeft > 0 ? `${examPlan.daysLeft} ${plural(examPlan.daysLeft, 'dzień', 'dni', 'dni')} do sprawdzianu` : 'sprawdzian dziś'}.
            {examPlan.fullReview ? ' Dziś pełny przegląd całego materiału.' : ` Nowe dziś: ${examPlan.newToday}, zagrożone: ${examPlan.atRisk}.`}
          </p>
        )}
        {!queue || !feature || !item ? (
          <p className="py-6 text-center text-ink-soft">Przygotowuję pytania…</p>
        ) : item.kind === 'intro' ? (
          <Intro feature={feature} onNext={next} />
        ) : item.skill === 'locate' ? (
          <LocatePrompt feature={feature} answered={answered} reason={item.reason} />
        ) : item.skill === 'name' ? (
          <NameQuestion
            key={idx}
            feature={feature}
            state={statesRef.current.get(stateKey(feature.id, 'name'))}
            settings={settings!}
            confusions={confRef.current}
            answered={answered}
            onAnswer={(o, answer, m) => {
              const api = mapApi.current!;
              if (!o.correct && m.otherId) {
                api.setHighlights({ [feature.id]: 'wrong', [m.otherId]: 'other' });
                api.flyToFeature(feature.id, [m.otherId]);
              } else api.setHighlights({ [feature.id]: o.correct ? 'correct' : 'wrong' });
              const other = m.otherId ? FEATURE_BY_ID[m.otherId] : undefined;
              setFeedback({
                kind: !o.correct ? 'bad' : m.kind === 'typo' ? 'typo' : 'ok',
                text: (
                  <>
                    To {categoryOne(feature.category)} <strong>{displayName(feature)}</strong>.
                    {o.correct && m.kind !== 'exact' && <> Poprawny zapis: „{feature.namePl}”.</>}
                    {other && <> {displayName(other)} zaznaczono na pomarańczowo.</>}
                  </>
                ),
                canCorrect: !o.correct && !o.multipleChoice && !!answer.trim() && !other,
              });
              commit(o, { answer, confusedWith: other && other.category === feature.category ? other.id : undefined });
            }}
          />
        ) : (
          <FactQuestion
            key={idx}
            feature={feature}
            fact={feature.facts.find((f) => `fact:${f.id}` === item.skill)!}
            answered={answered}
            onAnswer={(o, answer, r, fact) => {
              const p = fact.peakRef ? PEAKS[fact.peakRef] : null;
              if (p) mapApi.current!.showPeak([p[0], p[1]], fact.id === 'szczyt' ? fact.a : `${fact.a} m n.p.m.`);
              setFeedback({
                kind: !o.correct ? 'bad' : r.kind === 'exact' ? 'ok' : 'typo',
                text: (
                  <>
                    {fact.type === 'number' ? 'Dokładnie: ' : 'Odpowiedź: '}
                    <strong>
                      {r.canonical}
                      {fact.unit ? ` ${fact.unit}` : ''}
                    </strong>
                    .{r.missing?.length ? <> Brakuje: {r.missing.join(', ')}.</> : null}
                    {fact.needsVerification && <span className="mt-1 block text-sm text-ink-soft">Wersja z materiału nauczyciela – do weryfikacji. {feature.note}</span>}
                  </>
                ),
                canCorrect: !o.correct && fact.type !== 'number' && !!answer.trim(),
              });
              commit(o, { answer });
            }}
          />
        )}

        {feedback && (
          <div className="mt-3 space-y-3">
            <Verdict kind={feedback.kind}>{feedback.text}</Verdict>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={next} autoFocus className="flex-1">
                Dalej <Kbd>Enter</Kbd>
              </Button>
              {feedback.canCorrect && (
                <Button variant="ghost" onClick={correctAsTypo}>
                  To była literówka
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function order(id: string, scope: string[]) {
  const i = scope.indexOf(id);
  return i < 0 ? -1 : i;
}

export function ZoomButtons({ api }: { api: React.RefObject<MapApi | null> }) {
  return (
    <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow md:top-4">
      <button className="flex size-11 items-center justify-center hover:bg-sunken" onClick={() => api.current?.zoomBy(1)} aria-label="Przybliż">
        <Icon name="plus" />
      </button>
      <button className="flex size-11 items-center justify-center border-t border-line hover:bg-sunken" onClick={() => api.current?.zoomBy(-1)} aria-label="Oddal">
        <Icon name="minus" />
      </button>
    </div>
  );
}

function SkillTag({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-sm font-medium text-ink-soft">{children}</p>;
}

function FactsList({ feature }: { feature: Feature }) {
  if (!feature.facts.length) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {feature.facts.map((f) => (
        <li key={f.id} className="flex gap-2">
          <span className="text-ink-soft">{f.q.replace(/\?$/, '')}:</span>
          <strong className="font-semibold">
            {f.a.replace(/;/g, ',')}
            {f.unit ? ` ${f.unit}` : ''}
          </strong>
        </li>
      ))}
    </ul>
  );
}

function Intro({ feature, onNext }: { feature: Feature; onNext: () => void }) {
  return (
    <div className="anim-pop">
      <SkillTag>Nowy obiekt · {continentName(feature.continent)}</SkillTag>
      <h2 className="text-2xl font-semibold leading-tight">{displayName(feature)}</h2>
      <p className="text-ink-soft">{categoryOne(feature.category)}</p>
      {feature.aliases.length > 0 && <p className="mt-1 text-sm text-ink-soft">Też: {feature.aliases.slice(0, 3).join(', ')}</p>}
      <FactsList feature={feature} />
      {feature.note && <p className="mt-2 text-sm text-ink-soft">{feature.note}</p>}
      <Button variant="primary" className="mt-4 w-full" onClick={onNext} autoFocus>
        Zapamiętane – dalej <Kbd>Enter</Kbd>
      </Button>
    </div>
  );
}

function LocatePrompt({ feature, answered, reason }: { feature: Feature; answered: boolean; reason: string }) {
  return (
    <div>
      <SkillTag>Wskaż na mapie{reason === 'confusion' ? ' · para mylona' : ''}</SkillTag>
      <h2 className="text-2xl font-semibold leading-tight">{displayName(feature)}</h2>
      <p className="text-ink-soft">
        {categoryOne(feature.category)} · {continentName(feature.continent)}
      </p>
      {!answered && (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
          <Icon name="target" size={18} /> Kliknij lub stuknij w miejsce na mapie. Mapę możesz przesuwać i przybliżać.
        </p>
      )}
    </div>
  );
}

function NameQuestion({
  feature,
  state,
  settings,
  confusions,
  answered,
  onAnswer,
}: {
  feature: Feature;
  state: ReviewState | undefined;
  settings: Settings;
  confusions: ConfusionPair[];
  answered: boolean;
  onAnswer: (o: Outcome, answer: string, m: MatchResult) => void;
}) {
  const learning = !state || state.card.state === State.New || state.card.state === State.Learning || state.card.reps < 2;
  const [choice, setChoice] = useState(settings.choiceForNew && learning);
  const [helped, setHelped] = useState(false);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const start = useRef(Date.now());
  const options = useMemo(() => shuffle([feature, ...pickDistractors(feature, FEATURES, confusions)]), [feature, confusions]);

  const pick = useCallback(
    (f: Feature) => {
      if (answered) return;
      setPicked(f.id);
      const correct = f.id === feature.id || f.namePl === feature.namePl;
      onAnswer(
        { correct, ms: Date.now() - start.current, multipleChoice: true, helped },
        f.namePl,
        { kind: correct ? 'exact' : 'wrong', correct, canonical: feature.namePl, otherId: correct ? undefined : f.id },
      );
    },
    [answered, feature, helped, onAnswer],
  );

  useEffect(() => {
    if (!choice) return;
    const on = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= options.length && !(e.target instanceof HTMLInputElement)) pick(options[n - 1]);
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, [choice, options, pick]);

  const submit = () => {
    if (answered || !text.trim()) return;
    const m = answerIndex.matchFeature(text, feature.id);
    onAnswer({ correct: m.correct, ms: Date.now() - start.current, typo: m.kind === 'typo' }, text, m);
  };

  return (
    <div>
      <SkillTag>Co to jest? · {categoryOne(feature.category)}</SkillTag>
      <h2 className="text-xl font-semibold">Jak nazywa się zaznaczony obiekt?</h2>
      {choice ? (
        <div className="mt-3 grid gap-2">
          {options.map((f, i) => {
            const isRight = f.id === feature.id;
            const state = answered ? (isRight ? 'right' : picked === f.id ? 'wrong' : 'idle') : 'idle';
            return (
              <button
                key={f.id}
                onClick={() => pick(f)}
                disabled={answered}
                className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                  state === 'right' ? 'border-ok bg-ok/12' : state === 'wrong' ? 'border-wrong bg-wrong/12' : 'border-line bg-surface hover:border-water'
                }`}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sunken text-sm font-semibold">{i + 1}</span>
                <span className="flex-1">{displayName(f)}</span>
                {state === 'right' && <Icon name="check" className="text-ok" />}
                {state === 'wrong' && <Icon name="cross" className="text-wrong" />}
              </button>
            );
          })}
        </div>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={answered}
            placeholder="Wpisz nazwę…"
            aria-label="Nazwa obiektu"
            autoComplete="off"
            autoCapitalize="sentences"
            spellCheck={false}
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-lg outline-none focus:border-water"
          />
          <Button type="submit" variant="primary" disabled={answered || !text.trim()}>
            Sprawdź
          </Button>
        </form>
      )}
      {!answered && !choice && (
        <button
          className="mt-2 text-sm text-water hover:underline"
          onClick={() => {
            setHelped(true);
            setChoice(true);
          }}
        >
          Nie pamiętam – pokaż 4 odpowiedzi
        </button>
      )}
      {!answered && choice && !helped && (
        <button className="mt-2 text-sm text-water hover:underline" onClick={() => setChoice(false)}>
          Wolę wpisać nazwę
        </button>
      )}
    </div>
  );
}

function FactQuestion({
  feature,
  fact,
  answered,
  onAnswer,
}: {
  feature: Feature;
  fact: Fact;
  answered: boolean;
  onAnswer: (o: Outcome, answer: string, r: FactResult, fact: Fact) => void;
}) {
  const [text, setText] = useState('');
  const start = useRef(Date.now());
  const submit = () => {
    if (answered || !text.trim()) return;
    const r = matchFact(text, fact);
    onAnswer({ correct: r.correct, ms: Date.now() - start.current, typo: r.kind === 'typo' }, text, r, fact);
  };
  return (
    <div>
      <SkillTag>Fakt · {displayName(feature)}</SkillTag>
      <h2 className="text-xl font-semibold leading-snug">{fact.q}</h2>
      {fact.type === 'set' && <p className="text-sm text-ink-soft">Wpisz wszystkie, rozdzielając przecinkami.</p>}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={answered}
          inputMode={fact.type === 'number' ? 'numeric' : 'text'}
          placeholder={fact.type === 'number' ? 'np. 1234' : 'Odpowiedź…'}
          aria-label="Odpowiedź"
          autoComplete="off"
          spellCheck={false}
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-lg outline-none focus:border-water"
        />
        {fact.unit && <span className="self-center text-sm text-ink-soft">{fact.unit}</span>}
        <Button type="submit" variant="primary" disabled={answered || !text.trim()}>
          Sprawdź
        </Button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Podsumowanie sesji
// ---------------------------------------------------------------------------

function Summary({ results, startedAt, type, empty, params, examPlan }: { results: Result[]; startedAt: number; type: SessionType; empty: boolean; params: URLSearchParams; examPlan: ExamPlan | null }) {
  const [elapsed] = useState(() => Date.now() - startedAt);
  if (empty)
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="hypso h-1.5 w-40 rounded-full" />
        <h1 className="text-2xl font-semibold">{type === 'daily' ? 'Na dziś wszystko powtórzone' : 'Brak pytań w tym zakresie'}</h1>
        <p className="max-w-md text-ink-soft">
          {type === 'daily'
            ? 'Wróć jutro albo poćwicz wybraną partię materiału. Możesz też zwiększyć limit nowych obiektów w ustawieniach.'
            : examPlan
              ? 'Plan na dziś przed sprawdzianem jest wykonany.'
              : 'Wybierz inną partię lub inne typy ćwiczeń.'}
        </p>
        <div className="flex gap-2">
          <LinkButton to="/partie" variant="primary">
            Ćwicz partię
          </LinkButton>
          <LinkButton to="/">Start</LinkButton>
        </div>
      </div>
    );

  // pierwsza odpowiedź na każde pytanie liczy się do wyniku
  const firstByKey = new Map<string, Result>();
  for (const r of results) {
    const k = `${r.item.featureId}|${r.item.skill}`;
    if (!firstByKey.has(k)) firstByKey.set(k, r);
  }
  const firsts = [...firstByKey.values()];
  const correct = firsts.filter((r) => r.correct).length;
  const pct = firsts.length ? Math.round((correct / firsts.length) * 100) : 0;
  const wrongByFeature = new Map<string, number>();
  for (const r of results) if (!r.correct) wrongByFeature.set(r.item.featureId, (wrongByFeature.get(r.item.featureId) ?? 0) + 1);
  const hardest = [...wrongByFeature.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const decks = [...new Set(results.map((r) => `${FEATURE_BY_ID[r.item.featureId].continent}:${FEATURE_BY_ID[r.item.featureId].category}`))];
  const firstDeck = decks[0];

  return (
    <div className="min-h-full">
      <div className="contours border-b border-line bg-surface/70">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <p className="text-ink-soft">{type === 'daily' ? 'Sesja dnia' : type === 'exam' ? 'Przygotowanie do sprawdzianu' : 'Ćwiczenie'} zakończone</p>
          <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <span className="text-6xl font-semibold tabular-nums">{pct}%</span>
              <span className="ml-2 text-ink-soft">poprawnych</span>
            </div>
            <dl className="flex gap-6 text-sm">
              <div>
                <dt className="text-ink-soft">Odpowiedzi</dt>
                <dd className="text-lg font-semibold tabular-nums">{results.length}</dd>
              </div>
              <div>
                <dt className="text-ink-soft">Dobrze za 1. razem</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {correct}/{firsts.length}
                </dd>
              </div>
              <div>
                <dt className="text-ink-soft">Czas</dt>
                <dd className="text-lg font-semibold tabular-nums">{formatDuration(elapsed)}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="hypso h-1" />
      </div>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        {hardest.length > 0 ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Największe trudności</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {hardest.map(([id, n]) => (
                <li key={id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2">
                  <FeatureThumb id={id} size={72} />
                  <div className="min-w-0">
                    <p className="font-semibold">{displayName(FEATURE_BY_ID[id])}</p>
                    <p className="text-sm text-ink-soft">
                      {categoryOne(FEATURE_BY_ID[id].category)} · {n} {plural(n, 'błąd', 'błędy', 'błędów')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <LinkButton variant="primary" to={`/sesja?type=practice&ids=${hardest.map(([id]) => id).join(',')}&kinds=lnf&limit=40`}>
                Powtórz błędy
              </LinkButton>
              <LinkButton to="/">Start</LinkButton>
            </div>
          </section>
        ) : (
          <div className="flex flex-wrap gap-2">
            <p className="w-full text-ink-soft">Bez pomyłek – świetnie.</p>
            <LinkButton variant="primary" to="/">
              Start
            </LinkButton>
            <LinkButton to="/postepy">Zobacz postępy</LinkButton>
          </div>
        )}
        {firstDeck && (
          <section>
            <h2 className="mb-3 text-lg font-semibold">Filmy do tej partii</h2>
            <VideoList targetType="deck" targetIds={[firstDeck, `${firstDeck.split(':')[0]}:*`]} searchQuery={`${deckFromId(firstDeck).name.replace(' – ', ' ')} geografia`} />
          </section>
        )}
        {params.get('type') === 'practice' && (
          <p className="text-sm text-ink-soft">W ćwiczeniach swobodnych poprawne odpowiedzi „ponad plan” nie przesuwają terminów powtórek – błędy tak.</p>
        )}
      </main>
    </div>
  );
}
