import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { daysBetween, isIntroduced, parseDay, dayKey } from '../core/session';
import { examReadiness } from '../core/stats';
import type { ReviewState } from '../core/scheduler';
import { CATEGORIES, CONTINENTS, DECKS, deckFeatureIds, deckFromId } from '../data/meta';
import { db } from '../db';
import { Button, Empty, Icon, LinkButton, Page, Section, plural } from '../components/ui';

export function ExamsScreen() {
  const exams = useLiveQuery(() => db.exams.orderBy('date').toArray(), []);
  const states = useLiveQuery(() => db.states.toArray(), []);
  const map = useMemo(() => new Map<string, ReviewState>((states ?? []).map((s) => [s.key, s])), [states]);
  const now = new Date();
  const upcoming = (exams ?? []).filter((e) => daysBetween(now, parseDay(e.date)) >= 0);
  const past = (exams ?? []).filter((e) => daysBetween(now, parseDay(e.date)) < 0);

  return (
    <Page title="Przed sprawdzianem">
      <p className="mb-6 max-w-2xl text-ink-soft">
        Podaj datę i zakres sprawdzianu. Aplikacja rozłoży nowe obiekty na dni, które zostały, wcześniej powtórzy te, które mógłbyś zapomnieć, a w ostatniej sesji zrobi
        pełny przegląd. Twój zwykły harmonogram powtórek pozostaje bez zmian.
      </p>
      <Section title="Zaplanowane">
        {upcoming.length === 0 ? (
          <Empty>Brak zaplanowanych sprawdzianów – dodaj pierwszy poniżej.</Empty>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {upcoming.map((e) => {
              const ids = [...new Set(e.deckIds.flatMap((d) => deckFeatureIds(deckFromId(d))))];
              const days = daysBetween(now, parseDay(e.date));
              const ready = Math.round(examReadiness(ids, map, parseDay(e.date)) * 100);
              const unseen = ids.filter((id) => !isIntroduced(id, map)).length;
              return (
                <li key={e.id} className="rounded-2xl border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-semibold">{e.name}</p>
                      <p className="text-sm text-ink-soft">{e.deckIds.map((d) => deckFromId(d).name).join('; ')}</p>
                    </div>
                    <button
                      onClick={() => confirm(`Usunąć „${e.name}”?`) && db.exams.delete(e.id!)}
                      className="flex size-9 items-center justify-center rounded-full text-ink-soft hover:bg-sunken hover:text-wrong"
                      aria-label={`Usuń sprawdzian ${e.name}`}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                  <div className="mt-3 flex items-end gap-6">
                    <div>
                      <span className="text-4xl font-semibold tabular-nums">{days}</span>
                      <span className="ml-1 text-ink-soft">{days === 0 ? 'dziś!' : plural(days, 'dzień', 'dni', 'dni')}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-ink-soft">Gotowość {ready}%</p>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken">
                        <div className="h-full rounded-full bg-ok" style={{ width: `${ready}%` }} />
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">
                    {ids.length} obiektów · jeszcze nieznanych: {unseen}
                  </p>
                  <LinkButton variant="primary" className="mt-3 w-full" to={`/sesja?type=exam&exam=${e.id}`}>
                    Plan na dziś
                  </LinkButton>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      <Section title="Dodaj sprawdzian">
        <ExamForm />
      </Section>
      {past.length > 0 && (
        <Section title="Minione">
          <ul className="space-y-1 text-ink-soft">
            {past.map((e) => (
              <li key={e.id} className="flex items-center justify-between">
                <span>
                  {e.name} · {e.date}
                </span>
                <button onClick={() => db.exams.delete(e.id!)} className="text-sm hover:text-wrong">
                  Usuń
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}

function ExamForm() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 7);
  const [name, setName] = useState('Kartkówka z mapy');
  const [date, setDate] = useState(dayKey(tomorrow));
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const count = new Set(sel.flatMap((d) => deckFeatureIds(deckFromId(d)))).size;
  return (
    <form
      className="space-y-4 rounded-2xl border border-line bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!sel.length) return;
        await db.exams.add({ name: name.trim() || 'Sprawdzian', date, deckIds: sel, createdAt: Date.now() });
        setSel([]);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block font-medium">Nazwa</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="min-h-11 w-full rounded-xl border border-line bg-paper px-3" />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium">Data</span>
          <input type="date" required min={dayKey(new Date())} value={date} onChange={(e) => setDate(e.target.value)} className="min-h-11 w-full rounded-xl border border-line bg-paper px-3" />
        </label>
      </div>
      <fieldset>
        <legend className="mb-2 font-medium">Zakres</legend>
        <div className="space-y-3">
          {CONTINENTS.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-1.5">
              <span className="w-full text-sm font-medium text-ink-soft sm:w-40">{c.name}</span>
              <ExamChip on={sel.includes(`${c.id}:*`)} onClick={() => toggle(`${c.id}:*`)}>
                wszystko
              </ExamChip>
              {DECKS.filter((d) => d.continents![0] === c.id).map((d) => (
                <ExamChip key={d.id} on={sel.includes(d.id)} onClick={() => toggle(d.id)}>
                  {CATEGORIES.find((k) => k.id === d.categories![0])!.name.toLowerCase()}
                </ExamChip>
              ))}
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={!sel.length}>
          Zapisz sprawdzian
        </Button>
        <span className="text-sm text-ink-soft">{count ? `${count} obiektów` : 'Wybierz zakres'}</span>
      </div>
    </form>
  );
}

function ExamChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-9 rounded-full border px-3 text-sm ${on ? 'border-water bg-water text-white dark:text-paper' : 'border-line bg-paper hover:border-water'}`}
    >
      {on && '✓ '}
      {children}
    </button>
  );
}
