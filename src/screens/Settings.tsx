import { useLiveQuery } from 'dexie-react-hooks';
import { HIT_TOLERANCE, toleranceKm, type HitTolerance } from '../core/grading';
import { APP_VERSION, AUTHOR, copyrightLine } from '../data/about';
import { useState } from 'react';
import { FEATURES, FEATURE_BY_ID } from '../data/material';
import { CONTINENTS, DECKS, deckFromId, REGION_KM } from '../data/meta';
import type { ContinentId } from '../core/types';
import { db, exportAll, importAll, resetAll } from '../db';
import { setSetting, useSettings, type Settings } from '../lib/settings';
import { Button, Icon, LinkButton, Page, Section } from '../components/ui';
import { youtubeId } from '../components/Videos';

export function SettingsScreen() {
  const s = useSettings();
  return (
    <Page title="Ustawienia">
      <Section title="Nauka">
        <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
          <p>
            Codzienny zakres: <strong>{s.scope.map((d) => deckFromId(d).name).join('; ')}</strong>{' '}
            <a href="#/partie" className="text-water hover:underline">
              zmień w „Ćwicz partię”
            </a>
          </p>
          <Range label="Nowe obiekty dziennie" value={s.newPerDay} min={3} max={30} onChange={(v) => setSetting('newPerDay', v)} />
          <Range label="Maks. powtórek w sesji" value={s.maxReviews} min={20} max={200} step={10} onChange={(v) => setSetting('maxReviews', v)} />
          <label className="block">
            <span className="font-medium">Jak mocno utrwalać</span>
            <select value={s.retention} onChange={(e) => setSetting('retention', Number(e.target.value))} className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-paper px-3">
              <option value={0.85}>Lżej – mniej powtórek (85%)</option>
              <option value={0.9}>Standard (90%)</option>
              <option value={0.95}>Mocniej – więcej powtórek (95%)</option>
            </select>
            <span className="mt-1 block text-sm text-ink-soft">Prawdopodobieństwo, że w dniu powtórki obiekt będzie jeszcze pamiętany.</span>
          </label>
          <label className="block">
            <span className="font-medium">Tolerancja trafienia na mapie</span>
            <select
              value={s.hitTolerance}
              onChange={(e) => setSetting('hitTolerance', e.target.value as HitTolerance)}
              className="mt-1 block min-h-11 w-full rounded-xl border border-line bg-paper px-3"
            >
              {(Object.keys(HIT_TOLERANCE) as HitTolerance[]).map((k) => (
                <option key={k} value={k}>
                  {HIT_TOLERANCE[k].label}
                </option>
              ))}
            </select>
          </label>
          <ToleranceTable level={s.hitTolerance} scope={s.scope} />
          <Toggle label="Nowe obiekty: wybór z 4 odpowiedzi zamiast wpisywania" on={s.choiceForNew} onChange={(v) => setSetting('choiceForNew', v)} />
        </div>
      </Section>

      <Section title="Wygląd">
        <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
          <fieldset>
            <legend className="font-medium">Motyw</legend>
            <div className="mt-2 flex gap-2">
              {(
                [
                  ['system', 'Jak system'],
                  ['light', 'Jasny'],
                  ['dark', 'Ciemny'],
                ] as [Settings['theme'], string][]
              ).map(([k, l]) => (
                <button
                  key={k}
                  aria-pressed={s.theme === k}
                  onClick={() => setSetting('theme', k)}
                  className={`min-h-10 rounded-full border px-4 text-sm ${s.theme === k ? 'border-water bg-water text-white dark:text-paper' : 'border-line hover:border-water'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </fieldset>
          <Toggle label="Animacje mapy (przelot do obiektu)" on={s.motion} onChange={(v) => setSetting('motion', v)} />
        </div>
      </Section>

      <Section title="Filmy">
        <VideoManager />
      </Section>

      <Section title="Dane">
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-ink-soft">
            Postępy są zapisane tylko w tej przeglądarce. Zrób kopię, żeby przenieść je na inne urządzenie.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                const blob = new Blob([JSON.stringify(await exportAll())], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `geopowtorki-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              Pobierz kopię postępów
            </Button>
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-line bg-surface px-4 font-medium hover:border-water">
              Wczytaj kopię
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    if (!confirm('Wczytanie kopii zastąpi obecne postępy. Kontynuować?')) return;
                    await importAll(JSON.parse(await file.text()));
                    alert('Wczytano kopię postępów.');
                  } catch (err) {
                    alert(`Nie udało się wczytać pliku: ${(err as Error).message}`);
                  }
                }}
              />
            </label>
            <Button variant="danger" onClick={() => confirm('Usunąć wszystkie postępy, sprawdziany i filmy z tej przeglądarki?') && resetAll()}>
              Usuń wszystkie dane
            </Button>
          </div>
        </div>
      </Section>

      <Section title="O aplikacji">
        <p className="mb-2">
          <strong>GeoPowtórki</strong> {APP_VERSION} · autor: <strong>{AUTHOR}</strong>
        </p>
        <p className="mb-2 text-sm text-ink-soft">{copyrightLine()}. Wszelkie prawa zastrzeżone.</p>
        <p className="text-sm text-ink-soft">
          Dane mapy: Natural Earth (domena publiczna). Fonty etykiet: Noto Sans (SIL Open Font License). Powtórki: algorytm FSRS (ts-fsrs, MIT). Szczegóły w pliku ATTRIBUTIONS.md
          w repozytorium.
        </p>
        <LinkButton to="/" className="mt-3">
          Wróć na start
        </LinkButton>
      </Section>
    </Page>
  );
}

function Range({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between font-medium">
        {label} <span className="tabular-nums">{value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-[var(--water)]" />
    </label>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-[var(--water)]" />
    </label>
  );
}

/**
 * Dodawanie filmów: adres jest sprawdzany przed zapisem – musi być poprawnym
 * linkiem YouTube, a miniatura filmu musi się wczytać (nieistniejący film
 * zwraca szary obrazek 120×90). Uczeń/nauczyciel widzi podgląd i potwierdza.
 */
function VideoManager() {
  const videos = useLiveQuery(() => db.videos.toArray(), []) ?? [];
  const [targetType, setTargetType] = useState<'deck' | 'feature'>('deck');
  const [targetId, setTargetId] = useState(DECKS[0].id);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [check, setCheck] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle');
  const id = youtubeId(url);

  const verify = () => {
    if (!id) return setCheck('bad');
    setCheck('checking');
    const img = new Image();
    img.onload = () => setCheck(img.naturalWidth > 120 ? 'ok' : 'bad');
    img.onerror = () => setCheck('bad');
    img.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  };

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm text-ink-soft">
        Przypnij film do partii albo obiektu. Filmy zapisują się w tej przeglądarce; listę dla wszystkich prowadzi się w pliku src/data/videos.ts.
      </p>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (check !== 'ok' || !id) return;
          await db.videos.add({ targetType, targetId, url: `https://www.youtube.com/watch?v=${id}`, title: title.trim() || 'Film', addedAt: Date.now() });
          setUrl('');
          setTitle('');
          setCheck('idle');
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <select
            value={targetType}
            onChange={(e) => {
              const t = e.target.value as 'deck' | 'feature';
              setTargetType(t);
              setTargetId(t === 'deck' ? DECKS[0].id : FEATURES[0].id);
            }}
            className="min-h-11 rounded-xl border border-line bg-paper px-3"
            aria-label="Do czego przypiąć"
          >
            <option value="deck">Partia</option>
            <option value="feature">Obiekt</option>
          </select>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="min-h-11 min-w-0 rounded-xl border border-line bg-paper px-3" aria-label="Partia lub obiekt">
            {targetType === 'deck'
              ? DECKS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))
              : [...FEATURES]
                  .sort((a, b) => a.namePl.localeCompare(b.namePl, 'pl'))
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label ?? f.namePl}
                    </option>
                  ))}
          </select>
        </div>
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setCheck('idle');
          }}
          onBlur={verify}
          placeholder="Adres filmu, np. https://www.youtube.com/watch?v=…"
          className="min-h-11 w-full rounded-xl border border-line bg-paper px-3"
          aria-label="Adres filmu na YouTube"
        />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tytuł (jak w YouTube)" className="min-h-11 w-full rounded-xl border border-line bg-paper px-3" aria-label="Tytuł filmu" />
        {check === 'ok' && id && (
          <div className="flex items-center gap-3 rounded-xl bg-ok/10 p-2 text-sm">
            <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" className="h-14 rounded" />
            Film istnieje. Obejrzyj go przed dodaniem:{' '}
            <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer" className="text-water underline">
              otwórz
            </a>
          </div>
        )}
        {check === 'bad' && <p className="text-sm text-wrong">To nie jest działający link do filmu na YouTube. Skopiuj adres z paska przeglądarki.</p>}
        <div className="flex gap-2">
          <Button type="button" onClick={verify} disabled={!url}>
            Sprawdź link
          </Button>
          <Button type="submit" variant="primary" disabled={check !== 'ok'}>
            Dodaj film
          </Button>
        </div>
      </form>
      {videos.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {videos.map((v) => (
            <li key={v.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="flex-1">
                <strong>{v.title}</strong>
                <span className="block text-ink-soft">{v.targetType === 'deck' ? deckFromId(v.targetId).name : FEATURE_BY_ID[v.targetId]?.namePl}</span>
              </span>
              <button onClick={() => db.videos.delete(v.id!)} className="flex size-9 items-center justify-center rounded-full text-ink-soft hover:bg-sunken hover:text-wrong" aria-label={`Usuń film ${v.title}`}>
                <Icon name="trash" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Konkretne wartości tolerancji dla wybranego poziomu i kontynentu – zamiast
 * samych słów „standardowa / duża”. Liczone tą samą funkcją co ocena kliknięć.
 */
function ToleranceTable({ level, scope }: { level: HitTolerance; scope: string[] }) {
  const first = scope.map((d) => d.split(':')[0]).find((c) => c !== '*') as ContinentId | undefined;
  const [cont, setCont] = useState<ContinentId>(first ?? 'europa');
  const { factor, fingerPx } = HIT_TOLERANCE[level];
  const R = REGION_KM[cont];
  const km = (t: 'point' | 'line' | 'area', approx = false) => Math.round(toleranceKm(t, R, approx) * factor);
  const rows: [string, string, string][] = [
    ['Obszary', 'góry, wyżyny, niziny, kotliny, jeziora, półwyspy, wyspy, morza, ziemie, lodowce', `${km('area')} km od granicy`],
    ['Obszary przybliżone', 'obiekty zaznaczone na mapie okręgiem (np. część nizin)', `${km('area', true)} km od okręgu`],
    ['Rzeki', 'odległość od linii rzeki', `${km('line')} km od linii`],
    ['Punkty', 'przylądki, małe wyspy', `${km('point')} km od punktu`],
  ];
  return (
    <div className="rounded-xl bg-sunken p-3 text-sm">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-ink-soft">Zaliczone trafienie dla:</span>
        <select value={cont} onChange={(e) => setCont(e.target.value as ContinentId)} className="min-h-9 rounded-lg border border-line bg-surface px-2" aria-label="Kontynent">
          {CONTINENTS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <p className="mb-1 text-ink-soft">Kliknięcie wewnątrz obszaru zawsze się liczy; poza nim – do podanej odległości.</p>
      <dl>
        {rows.map(([name, desc, val]) => (
          <div key={name} className="border-t border-line py-1.5 first:border-t-0">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-medium">{name}</dt>
              <dd className="text-right font-semibold">{val}</dd>
            </div>
            <dd className="text-xs text-ink-soft">{desc}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-ink-soft">
        Na ekranie dotykowym trafienie liczy się też wtedy, gdy obiekt jest do <strong>{fingerPx} px</strong> od palca (myszą {fingerPx / 2} px). Przy
        oddalonej mapie to sporo kilometrów, po przybliżeniu – mniej, więc małe obiekty łatwiej wskazać po przybliżeniu. Większe kontynenty mają
        większą tolerancję, bo ich mapa jest w mniejszej skali.
      </p>
    </div>
  );
}
