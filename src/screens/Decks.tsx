import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { countMastery, featureMastery } from '../core/stats';
import type { CategoryId, ContinentId } from '../core/types';
import { CATEGORIES, CONTINENTS, DECKS, deckFeatureIds, deckFromId } from '../data/meta';
import { FEATURE_BY_ID } from '../data/material';
import { db } from '../db';
import { go } from '../lib/router';
import { setSetting, useSettings } from '../lib/settings';
import { Button, MasteryBar, MasteryLegend, Page, Section } from '../components/ui';
import type { ReviewState } from '../core/scheduler';

/** Wybór partii materiału: kontynent × kategoria, cały kontynent albo kategoria wszędzie. */
export function DecksScreen() {
  const settings = useSettings();
  const states = useLiveQuery(() => db.states.toArray(), []);
  const [sel, setSel] = useState<string[]>([]);
  const [kinds, setKinds] = useState({ l: true, n: true, f: true });
  const [limit, setLimit] = useState(30);

  const map = useMemo(() => new Map<string, ReviewState>((states ?? []).map((s) => [s.key, s])), [states]);
  const now = new Date();
  const counts = (deckId: string) => countMastery(deckFeatureIds(deckFromId(deckId)).map((id) => featureMastery(id, map, now)));

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const ids = [...new Set(sel.flatMap((d) => deckFeatureIds(deckFromId(d))))];
  const kindStr = `${kinds.l ? 'l' : ''}${kinds.n ? 'n' : ''}${kinds.f ? 'f' : ''}`;
  const factCount = ids.reduce((a, id) => a + FEATURE_BY_ID[id].facts.length, 0);

  return (
    <Page title="Ćwicz partię">
      <p className="mb-6 max-w-2xl text-ink-soft">
        Zaznacz jedną lub kilka partii. Możesz wybrać cały kontynent albo jedną kategorię na wszystkich kontynentach (np. wszystkie jeziora).
      </p>
      <MasteryLegend />
      <div className="mt-4 space-y-4">
        {CONTINENTS.map((c) => (
          <ContinentRow key={c.id} id={c.id} sel={sel} toggle={toggle} counts={counts} />
        ))}
      </div>

      <Section title="Kategoria na wszystkich kontynentach">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter((k) => DECKS.some((d) => d.categories![0] === k.id)).map((k) => (
            <Chip key={k.id} on={sel.includes(`*:${k.id}`)} onClick={() => toggle(`*:${k.id}`)}>
              {k.name}
            </Chip>
          ))}
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-4 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="font-medium">
            {sel.length ? `${ids.length} obiektów` : 'Nic nie zaznaczono'}
          </span>
          <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <legend className="sr-only">Typy ćwiczeń</legend>
            {(
              [
                ['l', 'Wskaż na mapie'],
                ['n', 'Co to jest?'],
                ['f', `Fakty (${factCount})`],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="flex items-center gap-1.5">
                <input type="checkbox" className="size-4 accent-[var(--water)]" checked={kinds[k]} onChange={(e) => setKinds({ ...kinds, [k]: e.target.checked })} />
                {label}
              </label>
            ))}
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            Pytań
            <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="rounded-lg border border-line bg-surface px-2 py-1">
              {[10, 20, 30, 50, 100].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" disabled={!sel.length || !kindStr} onClick={() => go('/sesja', { type: 'practice', deck: sel.join(','), kinds: kindStr, limit })}>
            Zacznij ćwiczenie
          </Button>
          <Button disabled={!sel.length} onClick={() => go('/kontur', { deck: sel.join(',') })}>
            Mapa konturowa
          </Button>
          <Button disabled={!sel.length} onClick={() => go('/mapa', { deck: sel.join(',') })}>
            Przeglądaj
          </Button>
          <Button
            variant="ghost"
            disabled={!sel.length || sel.join() === settings.scope.join()}
            onClick={async () => {
              await setSetting('scope', sel);
              go('/');
            }}
          >
            Ucz się tego codziennie
          </Button>
        </div>
      </div>
    </Page>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-10 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${on ? 'border-water bg-water text-white dark:text-paper' : 'border-line bg-surface hover:border-water'}`}
    >
      {on && <span aria-hidden>✓ </span>}
      {children}
    </button>
  );
}

function ContinentRow({ id, sel, toggle, counts }: { id: ContinentId; sel: string[]; toggle: (id: string) => void; counts: (deckId: string) => ReturnType<typeof countMastery> }) {
  const c = CONTINENTS.find((x) => x.id === id)!;
  const decks = DECKS.filter((d) => d.continents![0] === id);
  const all = counts(`${id}:*`);
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold">{c.name}</h3>
        <span className="text-sm text-ink-soft">
          {all.mastered}/{all.total} opanowanych
        </span>
        <div className="min-w-24 flex-1">
          <MasteryBar c={all} height="h-2" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip on={sel.includes(`${id}:*`)} onClick={() => toggle(`${id}:*`)}>
          Cały kontynent ({all.total})
        </Chip>
        {decks.map((d) => {
          const k = d.categories![0] as CategoryId;
          const n = counts(d.id);
          return (
            <Chip key={d.id} on={sel.includes(d.id)} onClick={() => toggle(d.id)}>
              {CATEGORIES.find((x) => x.id === k)!.name} <span className="opacity-70">{n.total}</span>
            </Chip>
          );
        })}
      </div>
    </div>
  );
}
