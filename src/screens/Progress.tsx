import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { stateKey, type ReviewState } from '../core/scheduler';
import { dayKey, daysBetween, parseDay, startOfDay } from '../core/session';
import { countMastery, examReadiness, featureMastery, forecast, streak, weakest } from '../core/stats';
import { FEATURES, FEATURE_BY_ID } from '../data/material';
import { CATEGORIES, CONTINENTS, deckFeatureIds, deckFromId } from '../data/meta';
import { db } from '../db';
import { FeatureThumb } from '../components/FeatureThumb';
import { Empty, LinkButton, MasteryBar, MasteryLegend, Page, Section, plural } from '../components/ui';

const WEEKS = 18;
const DOW = ['pn', 'wt', 'śr', 'cz', 'pt', 'sb', 'nd'];

export function ProgressScreen() {
  const data = useLiveQuery(async () => {
    const since = startOfDay(new Date()).getTime() - (WEEKS * 7 + 7) * 86_400_000;
    return {
      states: await db.states.toArray(),
      logs: await db.logs.where('at').above(since).toArray(),
      confusions: await db.confusions.orderBy('count').reverse().limit(8).toArray(),
      exams: await db.exams.orderBy('date').toArray(),
    };
  }, []);
  const now = new Date();
  const map = useMemo(() => new Map<string, ReviewState>((data?.states ?? []).map((s) => [s.key, s])), [data]);
  const mastery = useMemo(() => {
    const out: Record<string, ReturnType<typeof featureMastery>> = {};
    for (const f of FEATURES) out[f.id] = featureMastery(f.id, map, now, f.facts.map((x) => stateKey(f.id, `fact:${x.id}`)));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  if (!data) return <Page title="Postępy">{null}</Page>;

  const perDay = new Map<string, number>();
  for (const l of data.logs) perDay.set(dayKey(l.at), (perDay.get(dayKey(l.at)) ?? 0) + 1);
  const st = streak(new Set(perDay.keys()), now);
  const fc = forecast(map.values(), now, 7);
  const fcMax = Math.max(1, ...fc.map((d) => d.count));
  const weak = weakest(data.logs, now, 8);
  const all = countMastery(Object.values(mastery));
  const exam = data.exams.find((e) => daysBetween(now, parseDay(e.date)) >= 0);

  return (
    <Page title="Postępy" actions={<LinkButton to="/mapa?view=postepy">Mapa postępów</LinkButton>}>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat value={`${all.mastered}/${all.total}`} label="obiektów opanowanych" />
        <Stat value={`${st}`} label={`${plural(st, 'dzień', 'dni', 'dni')} nauki z rzędu`} />
        {exam ? (
          <Stat
            value={`${Math.round(examReadiness([...new Set(exam.deckIds.flatMap((d) => deckFeatureIds(deckFromId(d))))], map, parseDay(exam.date)) * 100)}%`}
            label={`gotowości · ${exam.name}, za ${daysBetween(now, parseDay(exam.date))} dni`}
          />
        ) : (
          <Stat value={`${data.logs.filter((l) => l.at >= startOfDay(now).getTime()).length}`} label="odpowiedzi dziś" />
        )}
      </div>

      <Section title="Kontynenty i kategorie" aside={<MasteryLegend compact />}>
        <div className="space-y-5">
          {CONTINENTS.map((c) => {
            const ids = deckFeatureIds(deckFromId(`${c.id}:*`));
            const cc = countMastery(ids.map((id) => mastery[id]));
            return (
              <details key={c.id} className="group rounded-2xl border border-line bg-surface p-4" open={c.id === 'europa'}>
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="w-44 font-semibold">{c.name}</span>
                  <span className="flex-1">
                    <MasteryBar c={cc} />
                  </span>
                  <span className="w-20 text-right text-sm tabular-nums text-ink-soft">
                    {cc.mastered}/{cc.total}
                  </span>
                </summary>
                <ul className="mt-3 space-y-2 border-t border-line pt-3">
                  {CATEGORIES.map((k) => {
                    const kids = ids.filter((id) => FEATURE_BY_ID[id].category === k.id);
                    if (!kids.length) return null;
                    const kc = countMastery(kids.map((id) => mastery[id]));
                    return (
                      <li key={k.id} className="flex items-center gap-3 text-sm">
                        <a href={`#/mapa?view=postepy&deck=${c.id}:${k.id}`} className="w-44 hover:text-water">
                          {k.name}
                        </a>
                        <span className="flex-1">
                          <MasteryBar c={kc} height="h-2" />
                        </span>
                        <span className="w-20 text-right tabular-nums text-ink-soft">
                          {kc.new ? `${kc.new} nowych` : `${kc.mastered}/${kc.total}`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
        </div>
      </Section>

      <div className="grid gap-8 md:grid-cols-2">
        <Section title="Powtórki – najbliższe 7 dni">
          <div className="flex h-40 items-end gap-2 rounded-2xl border border-line bg-surface p-4" role="img" aria-label={fc.map((d) => `${d.day}: ${d.count}`).join(', ')}>
            {fc.map((d, i) => (
              <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs tabular-nums text-ink-soft">{d.count}</span>
                <div className={`w-full rounded-t-md ${i === 0 ? 'bg-water' : 'bg-water/45'}`} style={{ height: `${(d.count / fcMax) * 100}%`, minHeight: d.count ? 4 : 0 }} />
                <span className="text-xs text-ink-soft">{i === 0 ? 'dziś' : DOW[(parseDay(d.day).getDay() + 6) % 7]}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Kalendarz nauki">
          <Calendar perDay={perDay} now={now} />
        </Section>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Section title="Najsłabsze obiekty">
          {weak.length ? (
            <>
              <ul className="space-y-2">
                {weak.map((w) => {
                  const f = FEATURE_BY_ID[w.featureId];
                  return (
                    <li key={w.featureId} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2">
                      <FeatureThumb id={w.featureId} size={52} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{f.label ?? f.namePl}</p>
                        <p className="text-sm text-ink-soft">
                          {w.wrong} {plural(w.wrong, 'błąd', 'błędy', 'błędów')} na {w.total} prób
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <LinkButton className="mt-3" variant="primary" to={`/sesja?type=practice&ids=${weak.map((w) => w.featureId).join(',')}&kinds=lnf&limit=40`}>
                Poćwicz najsłabsze
              </LinkButton>
            </>
          ) : (
            <Empty>Jeszcze za mało odpowiedzi – tu pojawią się obiekty sprawiające kłopot.</Empty>
          )}
        </Section>

        <Section title="Najczęściej mylone pary">
          {data.confusions.length ? (
            <>
              <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                {data.confusions.map((c) => (
                  <li key={c.key} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1">
                      {FEATURE_BY_ID[c.a]?.namePl} <span className="text-ink-soft">↔</span> {FEATURE_BY_ID[c.b]?.namePl}
                    </span>
                    <span className="text-sm tabular-nums text-ink-soft">{c.count}×</span>
                    <a className="text-sm font-medium text-water hover:underline" href={`#/sesja?type=practice&ids=${c.a},${c.b}&kinds=ln&limit=8`}>
                      Ćwicz parę
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-ink-soft">Pary pomylone co najmniej 2 razy wracają w powtórkach razem.</p>
            </>
          ) : (
            <Empty>Brak pomyłek między obiektami.</Empty>
          )}
        </Section>
      </div>
    </Page>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm text-ink-soft">{label}</p>
    </div>
  );
}

function Calendar({ perDay, now }: { perDay: Map<string, number>; now: Date }) {
  // siatka tygodni (kolumny) × dni tygodnia (wiersze), od poniedziałku
  const end = startOfDay(now);
  const start = new Date(end);
  start.setDate(start.getDate() - (WEEKS - 1) * 7 - ((end.getDay() + 6) % 7));
  const cells: { key: string; n: number; future: boolean }[] = [];
  for (let d = new Date(start); cells.length < WEEKS * 7; d.setDate(d.getDate() + 1)) {
    const k = dayKey(d);
    cells.push({ key: k, n: perDay.get(k) ?? 0, future: d > end });
  }
  const level = (n: number) => (n === 0 ? 'bg-sunken' : n < 10 ? 'bg-lowland/35' : n < 25 ? 'bg-lowland/65' : 'bg-lowland');
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface p-4">
      <div className="grid w-max grid-flow-col grid-rows-7 gap-1" role="img" aria-label="Kalendarz aktywności z ostatnich tygodni">
        {cells.map((c) => (
          <div key={c.key} title={`${c.key}: ${c.n} odpowiedzi`} className={`size-3.5 rounded-[3px] ${c.future ? 'opacity-0' : level(c.n)}`} />
        ))}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-soft">
        mniej <span className="size-3 rounded-[3px] bg-sunken" />
        <span className="size-3 rounded-[3px] bg-lowland/35" />
        <span className="size-3 rounded-[3px] bg-lowland/65" />
        <span className="size-3 rounded-[3px] bg-lowland" /> więcej
      </p>
    </div>
  );
}
