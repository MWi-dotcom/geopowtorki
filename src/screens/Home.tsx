import { useLiveQuery } from 'dexie-react-hooks';
import { copyrightLine } from '../data/about';
import { dueStates, isIntroduced, parseDay, daysBetween, startOfDay } from '../core/session';
import { examReadiness, streak } from '../core/stats';
import { deckFeatureIds, deckFromId } from '../data/meta';
import { db } from '../db';
import { useSettings } from '../lib/settings';
import { Icon, plural } from '../components/ui';
import { go } from '../lib/router';
import type { ReviewState } from '../core/scheduler';

const NAV: { to: string; title: string; desc: string; icon: string }[] = [
  { to: '/partie', title: 'Ćwicz partię', desc: 'Wybierz kontynent i kategorię', icon: 'layers' },
  { to: '/kontur', title: 'Mapa konturowa', desc: 'Jak na kartkówce – ponumerowane obiekty', icon: 'target' },
  { to: '/mapa', title: 'Przeglądaj mapę', desc: 'Nazwy, fakty, filmy, stan opanowania', icon: 'map' },
  { to: '/sprawdzian', title: 'Przed sprawdzianem', desc: 'Plan powtórek do wybranej daty', icon: 'calendar' },
  { to: '/postepy', title: 'Postępy', desc: 'Kontynenty, seria dni, prognoza', icon: 'flame' },
];

/** Pasek reliefu świata z kafelków (zoom 2) – tło nagłówka. */
function ReliefBand() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-[48%]">
        {[0, 1, 2, 3].map((x) => (
          <div key={x} className="flex flex-col">
            {[1, 2].map((y) => (
              <img key={y} src={`${base}tiles/hyp/2/${x}/${y}.webp`} alt="" className="size-[256px] max-w-none" />
            ))}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-paper/10 via-paper/30 to-paper" />
    </div>
  );
}

export function Home() {
  const settings = useSettings();
  const data = useLiveQuery(async () => {
    const states = await db.states.toArray();
    const exams = await db.exams.orderBy('date').toArray();
    const since = startOfDay(new Date()).getTime() - 400 * 86_400_000;
    const days = new Set<string>();
    await db.logs
      .where('at')
      .above(since)
      .each((l) => {
        const d = new Date(l.at);
        days.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      });
    return { states, exams, days };
  }, []);

  const now = new Date();
  const map = new Map<string, ReviewState>((data?.states ?? []).map((s) => [s.key, s]));
  const due = dueStates([...new Set((data?.states ?? []).map((s) => s.featureId))], map, now).length;
  const scopeIds = [...new Set(settings.scope.flatMap((d) => deckFeatureIds(deckFromId(d))))];
  const unseen = scopeIds.filter((id) => !isIntroduced(id, map)).length;
  const introducedToday = (data?.states ?? []).filter((s) => s.skill === 'name' && s.introducedAt >= startOfDay(now).getTime()).length;
  const newToday = Math.min(unseen, Math.max(0, settings.newPerDay - introducedToday));
  const st = data ? streak(data.days, now) : 0;
  const exam = data?.exams.find((e) => daysBetween(now, parseDay(e.date)) >= 0);
  const examIds = exam ? [...new Set(exam.deckIds.flatMap((d) => deckFeatureIds(deckFromId(d))))] : [];
  const readiness = exam ? Math.round(examReadiness(examIds, map, parseDay(exam.date)) * 100) : 0;
  const examDays = exam ? daysBetween(now, parseDay(exam.date)) : 0;
  const nothing = data && due === 0 && newToday === 0;

  return (
    <div className="min-h-full">
      <header className="relative overflow-hidden">
        <ReliefBand />
        <div className="relative mx-auto flex max-w-5xl items-center justify-between px-4 pt-4">
          <span className="rounded-full bg-surface/85 px-3 py-1 text-lg font-semibold tracking-tight shadow-sm backdrop-blur">GeoPowtórki</span>
          <a href="#/ustawienia" className="flex size-11 items-center justify-center rounded-full bg-surface/85 shadow-sm backdrop-blur hover:bg-surface" aria-label="Ustawienia">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
            </svg>
          </a>
        </div>
        <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-24 sm:pt-32">
          <p className="max-w-md text-balance text-lg text-ink">
            {nothing ? 'Dzisiejsze powtórki zrobione. Możesz poćwiczyć dowolną partię.' : 'Mapa fizyczna świata – kilka minut dziennie.'}
          </p>
          <button
            onClick={() => go('/sesja', { type: 'daily' })}
            disabled={!!nothing}
            className="mt-4 flex w-full max-w-md items-center justify-between gap-4 rounded-2xl bg-water px-6 py-5 text-left text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-water-deep disabled:translate-y-0 disabled:opacity-60 dark:text-paper"
          >
            <span>
              <span className="block text-2xl font-semibold">Powtórz na dziś</span>
              <span className="block text-white/85 dark:text-paper/80">
                {data ? (
                  <>
                    {due} {plural(due, 'powtórka', 'powtórki', 'powtórek')} · {newToday} {plural(newToday, 'nowy obiekt', 'nowe obiekty', 'nowych obiektów')}
                  </>
                ) : (
                  'Wczytuję…'
                )}
              </span>
            </span>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13l10.5-6.5L8 5.5z" />
            </svg>
          </button>
          <p className="mt-3 text-sm text-ink-soft">
            Uczysz się: {settings.scope.map((d) => deckFromId(d).name).join('; ')} ·{' '}
            <a href="#/ustawienia" className="text-water underline-offset-2 hover:underline">
              zmień
            </a>
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 pb-12 md:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
            <span className={`flex size-12 items-center justify-center rounded-full ${st > 0 ? 'bg-upland/20 text-mountain' : 'bg-sunken text-ink-soft'}`}>
              <Icon name="flame" size={24} />
            </span>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {st} {plural(st, 'dzień', 'dni', 'dni')}
              </p>
              <p className="text-sm text-ink-soft">{st > 0 ? 'nauki z rzędu' : 'Zacznij serię – zrób dzisiejsze powtórki'}</p>
            </div>
          </div>

          {exam ? (
            <a href={`#/sesja?type=exam&exam=${exam.id}`} className="block rounded-2xl border border-line bg-surface p-4 hover:border-water">
              <p className="text-sm text-ink-soft">Najbliższy sprawdzian</p>
              <p className="text-lg font-semibold">{exam.name}</p>
              <p className="mt-1 tabular-nums">
                {examDays === 0 ? 'Dziś!' : `za ${examDays} ${plural(examDays, 'dzień', 'dni', 'dni')}`} · gotowość {readiness}%
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken">
                <div className="h-full rounded-full bg-ok" style={{ width: `${readiness}%` }} />
              </div>
              <p className="mt-3 font-medium text-water">Przygotuj się na dziś</p>
            </a>
          ) : (
            <a href="#/sprawdzian" className="block rounded-2xl border border-dashed border-line p-4 text-ink-soft hover:border-water">
              Masz sprawdzian z mapy? Dodaj datę, a aplikacja rozplanuje powtórki.
            </a>
          )}
        </div>

        <nav aria-label="Tryby nauki">
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {NAV.map((n) => (
              <li key={n.to}>
                <a href={`#${n.to}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-sunken">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-sunken text-water">
                    <Icon name={n.icon} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium">{n.title}</span>
                    <span className="block text-sm text-ink-soft">{n.desc}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-6 pt-2 text-center text-xs text-ink-soft md:text-left">
        GeoPowtórki · {copyrightLine()} ·{' '}
        <a href="#/ustawienia" className="underline hover:text-water">
          o aplikacji
        </a>
      </footer>
    </div>
  );
}
