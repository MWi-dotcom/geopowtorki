/**
 * Mapa konturowa (tryb sprawdzianu): mapa z ponumerowanymi obiektami,
 * uczeń wpisuje nazwy, wynik i omówienie na końcu – jak na kartkówce.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnswerIndex, type MatchResult } from '../core/answers';
import { ratingFromOutcome } from '../core/grading';
import { applyReview, newState, practiceUpdatesSchedule, stateKey } from '../core/scheduler';
import { shuffle } from '../core/session';
import type { ContinentId } from '../core/types';
import { FEATURES, FEATURE_BY_ID } from '../data/material';
import { CATEGORIES, CONTINENTS, DECKS, deckFeatureIds, deckFromId, deckIdsRegion } from '../data/meta';
import { db, loadStates, recordConfusion } from '../db';
import { GeoMap, type MapApi } from '../map/GeoMap';
import { go } from '../lib/router';
import { getSettings, useSettings } from '../lib/settings';
import { useMapPadding } from '../lib/useMapPadding';
import { Button, Icon, LinkButton, Page } from '../components/ui';
import { ZoomButtons } from './Session';

const idx = new AnswerIndex(FEATURES);

export function ContourScreen({ params, dark }: { params: URLSearchParams; dark: boolean }) {
  const deck = params.get('deck');
  if (!deck) return <ContourSetup />;
  return <ContourTest key={params.toString()} deckIds={deck.split(',')} count={Number(params.get('n') ?? 10)} dark={dark} />;
}

function ContourSetup() {
  const [cont, setCont] = useState<ContinentId | '*'>('europa');
  const [cats, setCats] = useState<string[]>([]);
  const [n, setN] = useState(10);
  const available = CATEGORIES.filter((k) => DECKS.some((d) => d.categories![0] === k.id && (cont === '*' || d.continents![0] === cont)));
  const deckIds = cats.length ? cats.map((k) => `${cont}:${k}`) : [`${cont}:*`];
  const total = new Set(deckIds.flatMap((d) => deckFeatureIds(deckFromId(d)))).size;
  return (
    <Page title="Mapa konturowa">
      <p className="mb-6 max-w-2xl text-ink-soft">
        Na mapie pojawią się ponumerowane obiekty. Wpisz ich nazwy, a na końcu zobaczysz wynik i omówienie – jak na kartkówce z mapy.
      </p>
      <div className="max-w-xl space-y-5">
        <label className="block">
          <span className="mb-1 block font-medium">Kontynent</span>
          <select
            value={cont}
            onChange={(e) => {
              setCont(e.target.value as ContinentId);
              setCats([]);
            }}
            className="min-h-11 w-full rounded-xl border border-line bg-surface px-3"
          >
            {CONTINENTS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="*">Wszystkie kontynenty</option>
          </select>
        </label>
        <fieldset>
          <legend className="mb-1 font-medium">Kategorie (bez zaznaczenia = wszystkie)</legend>
          <div className="flex flex-wrap gap-2">
            {available.map((k) => {
              const on = cats.includes(k.id);
              return (
                <button
                  key={k.id}
                  aria-pressed={on}
                  onClick={() => setCats(on ? cats.filter((x) => x !== k.id) : [...cats, k.id])}
                  className={`min-h-10 rounded-full border px-3.5 text-sm ${on ? 'border-water bg-water text-white dark:text-paper' : 'border-line bg-surface hover:border-water'}`}
                >
                  {on && '✓ '}
                  {k.name}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="block">
          <span className="mb-1 block font-medium">Liczba obiektów</span>
          <select value={n} onChange={(e) => setN(Number(e.target.value))} className="min-h-11 rounded-xl border border-line bg-surface px-3">
            {[5, 10, 15, 20].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <span className="ml-3 text-sm text-ink-soft">z {total} w wybranym zakresie</span>
        </label>
        <Button variant="primary" onClick={() => go('/kontur', { deck: deckIds.join(','), n })}>
          Rozpocznij
        </Button>
      </div>
    </Page>
  );
}

interface Row {
  id: string;
  answer: string;
  result?: MatchResult;
}

function ContourTest({ deckIds, count, dark }: { deckIds: string[]; count: number; dark: boolean }) {
  const settings = useSettings();
  const region = deckIdsRegion(deckIds);
  const pool = useMemo(() => [...new Set(deckIds.flatMap((d) => deckFeatureIds(deckFromId(d))))], [deckIds]);
  const [rows, setRows] = useState<Row[]>(() => {
    // bez par rodzic–dziecko i bez powtórzonych nazw (np. Ural góry/rzeka)
    const out: string[] = [];
    for (const id of shuffle(pool)) {
      if (out.length >= count) break;
      const f = FEATURE_BY_ID[id];
      if (out.some((o) => FEATURE_BY_ID[o].namePl === f.namePl || FEATURE_BY_ID[o].parent === id || f.parent === o)) continue;
      out.push(id);
    }
    return out.map((id) => ({ id, answer: '' }));
  });
  const [checked, setChecked] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [started] = useState(Date.now());
  const mapApi = useRef<MapApi>(null);
  const [ready, setReady] = useState(false);
  const { panelRef, padding } = useMapPadding();

  // obiekty kontynentu (do wykrycia pomyłek) – mapa pokazuje tylko numery
  const mapIds = useMemo(() => {
    const conts = new Set(rows.map((r) => FEATURE_BY_ID[r.id].continent));
    return FEATURES.filter((f) => conts.has(f.continent)).map((f) => f.id);
  }, [rows]);

  useEffect(() => {
    if (!ready) return;
    mapApi.current?.setNumbers(
      rows.map((r, i) => ({ n: i + 1, id: r.id, state: checked ? (r.result?.correct ? 'ok' : 'bad') : active === i ? 'active' : undefined })),
    );
  }, [rows, checked, active, ready]);

  useEffect(() => {
    if (!ready || active === null) return;
    const id = rows[active].id;
    if (checked) {
      mapApi.current?.setHighlights({ [id]: rows[active].result?.correct ? 'correct' : 'wrong' });
      mapApi.current?.flyToFeature(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, checked, ready]);

  async function check() {
    const results = rows.map((r) => ({ ...r, result: idx.matchFeature(r.answer, r.id) }));
    setRows(results);
    setChecked(true);
    setActive(null);
    mapApi.current?.fitRegion(region);
    // zapis: umiejętność „nazwij”; harmonogram zmienia się tylko dla zaległych/nowych lub przy błędzie
    const s = await getSettings();
    const states = await loadStates();
    const now = new Date();
    const ms = Math.round((Date.now() - started) / Math.max(1, rows.length));
    for (const r of results) {
      const m = r.result!;
      const key = stateKey(r.id, 'name');
      const prev = states.get(key);
      const outcome = { correct: m.correct, ms, typo: m.kind === 'typo' };
      const rating = ratingFromOutcome(outcome, 'name');
      const scheduled = practiceUpdatesSchedule(prev, m.correct, now);
      if (scheduled) await db.states.put(applyReview(prev ?? newState(r.id, 'name', now), rating, now, { retention: s.retention, maxIntervalDays: 180 }));
      await db.logs.add({ featureId: r.id, skill: 'name', at: now.getTime(), correct: m.correct, rating, ms, mode: 'contour', scheduled, answer: r.answer, confusedWith: m.otherId });
      if (m.otherId && FEATURE_BY_ID[m.otherId].category === FEATURE_BY_ID[r.id].category) await recordConfusion(r.id, m.otherId);
    }
  }

  const score = rows.filter((r) => r.result?.correct).length;

  return (
    <div className="fixed inset-0">
      <GeoMap
        ref={mapApi}
        className="absolute inset-0"
        region={region}
        mode="contour"
        featureIds={mapIds}
        padding={padding}
        dark={dark}
        motion={settings.motion}
        onReady={() => setReady(true)}
      />
      <ZoomButtons api={mapApi} />
      <div
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 max-h-[50vh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface/97 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(0,0,0,.12)] backdrop-blur md:inset-auto md:left-4 md:top-4 md:max-h-[calc(100vh-2rem)] md:w-[380px] md:rounded-2xl md:border md:pb-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => go('/kontur')} className="flex size-9 items-center justify-center rounded-full hover:bg-sunken" aria-label="Wróć">
            <Icon name="back" size={18} />
          </button>
          <h1 className="flex-1 font-semibold">Mapa konturowa</h1>
          {checked && (
            <span className="rounded-full bg-sunken px-3 py-1 font-semibold tabular-nums">
              {score}/{rows.length}
            </span>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!checked) check();
          }}
        >
          <ol className="space-y-2">
            {rows.map((r, i) => {
              const f = FEATURE_BY_ID[r.id];
              const res = r.result;
              return (
                <li key={r.id} className="flex items-start gap-2">
                  <span
                    className={`mt-2 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${
                      checked ? (res?.correct ? 'bg-ok' : 'bg-wrong') : active === i ? 'bg-target' : 'bg-ink'
                    } dark:text-paper`}
                  >
                    {i + 1}
                  </span>
                  {checked ? (
                    <button type="button" onClick={() => setActive(i)} className={`min-h-11 flex-1 rounded-xl border px-3 py-1.5 text-left ${active === i ? 'border-water' : 'border-line'}`}>
                      <span className="flex items-center gap-1.5">
                        <Icon name={res?.correct ? 'check' : 'cross'} size={16} className={res?.correct ? 'text-ok' : 'text-wrong'} />
                        <strong>{f.label ?? f.namePl}</strong>
                      </span>
                      {(!res?.correct || res.kind !== 'exact') && (
                        <span className="block text-sm text-ink-soft">
                          Twoja odpowiedź: {r.answer.trim() || '—'}
                          {res?.kind === 'typo' && ' (literówka – zaliczone)'}
                          {res?.otherId && ` – to ${FEATURE_BY_ID[res.otherId].namePl}`}
                        </span>
                      )}
                    </button>
                  ) : (
                    <input
                      value={r.answer}
                      onFocus={() => setActive(i)}
                      onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
                      aria-label={`Obiekt numer ${i + 1}`}
                      autoComplete="off"
                      spellCheck={false}
                      className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 outline-none focus:border-water"
                    />
                  )}
                </li>
              );
            })}
          </ol>
          {!checked ? (
            <Button type="submit" variant="primary" className="mt-4 w-full">
              Sprawdź
            </Button>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <p className="w-full text-sm text-ink-soft">Stuknij pozycję, żeby zobaczyć obiekt na mapie.</p>
              <LinkButton variant="primary" to={`/kontur?deck=${deckIds.join(',')}&n=${count}&r=${Date.now()}`}>
                Nowa mapa
              </LinkButton>
              {rows.some((r) => !r.result?.correct) && (
                <LinkButton to={`/sesja?type=practice&ids=${rows.filter((r) => !r.result?.correct).map((r) => r.id).join(',')}&kinds=ln&limit=30`}>Powtórz błędy</LinkButton>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
