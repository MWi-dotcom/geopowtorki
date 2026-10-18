/**
 * „Przeglądaj mapę” i „Mapa postępów”: wszystkie obiekty kontynentu na mapie,
 * klik pokazuje nazwę, fakty, stan opanowania i filmy.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { featureMastery, MASTERY_LABEL, type Mastery } from '../core/stats';
import { stateKey, type ReviewState } from '../core/scheduler';
import type { ContinentId } from '../core/types';
import { FEATURES, FEATURE_BY_ID } from '../data/material';
import { categoryOne, CONTINENTS, continentName, deckFeatureIds, deckFromId, deckIdsRegion } from '../data/meta';
import { db } from '../db';
import { GeoMap, type MapApi } from '../map/GeoMap';
import { PEAKS } from '../lib/geo';
import { go } from '../lib/router';
import { useSettings } from '../lib/settings';
import { useMapPadding } from '../lib/useMapPadding';
import { Icon, LinkButton, MasteryLegend } from '../components/ui';
import { VideoList } from '../components/Videos';
import { ZoomButtons } from './Session';

export function BrowseScreen({ params, dark }: { params: URLSearchParams; dark: boolean }) {
  const settings = useSettings();
  const deckParam = params.get('deck');
  const [view, setView] = useState<'browse' | 'progress'>(params.get('view') === 'postepy' ? 'progress' : 'browse');
  const [region, setRegion] = useState<ContinentId | 'swiat'>(() => {
    const r = params.get('region') as ContinentId | null;
    if (r) return r;
    if (deckParam) return deckIdsRegion(deckParam.split(','));
    return 'europa';
  });
  const [selected, setSelected] = useState<string | null>(null);
  const mapApi = useRef<MapApi>(null);
  const { panelRef, padding } = useMapPadding();
  const states = useLiveQuery(() => db.states.toArray(), []);
  const map = useMemo(() => new Map<string, ReviewState>((states ?? []).map((s) => [s.key, s])), [states]);

  const ids = useMemo(() => {
    if (deckParam) return [...new Set(deckParam.split(',').flatMap((d) => deckFeatureIds(deckFromId(d))))];
    if (region === 'swiat') return FEATURES.map((f) => f.id);
    return FEATURES.filter((f) => f.continent === region || f.alsoIn?.includes(region)).map((f) => f.id);
  }, [deckParam, region]);

  const progress = useMemo(() => {
    const now = new Date();
    const out: Record<string, Mastery> = {};
    for (const id of ids) out[id] = featureMastery(id, map, now, FEATURE_BY_ID[id].facts.map((f) => stateKey(id, `fact:${f.id}`)));
    return out;
  }, [ids, map]);

  useEffect(() => {
    const api = mapApi.current;
    if (!api) return;
    api.setHighlights(selected ? { [selected]: 'focus' } : {});
    const f = selected ? FEATURE_BY_ID[selected] : null;
    const peak = f?.facts.find((x) => x.peakRef)?.peakRef;
    const p = peak ? PEAKS[peak] : null;
    api.showPeak(p ? [p[0], p[1]] : null, f?.facts.find((x) => x.id === 'szczyt')?.a);
    if (selected) api.flyToFeature(selected);
  }, [selected]);

  const f = selected ? FEATURE_BY_ID[selected] : null;

  return (
    <div className={`fixed inset-0 ${view === 'browse' ? 'browse' : 'browse'}`}>
      <GeoMap
        ref={mapApi}
        className="absolute inset-0"
        region={region}
        mode={view}
        featureIds={ids}
        progress={view === 'progress' ? progress : undefined}
        padding={padding}
        onFeatureClick={setSelected}
        dark={dark}
        motion={settings.motion}
        showHistoric
      />
      <ZoomButtons api={mapApi} />

      <div
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 max-h-[55vh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface/97 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(0,0,0,.12)] backdrop-blur md:inset-auto md:left-4 md:top-4 md:max-h-[calc(100vh-2rem)] md:w-[380px] md:rounded-2xl md:border md:pb-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <button onClick={() => go('/')} className="flex size-9 items-center justify-center rounded-full hover:bg-sunken" aria-label="Wróć">
            <Icon name="back" size={18} />
          </button>
          <div className="flex flex-1 rounded-xl bg-sunken p-1 text-sm" role="tablist">
            {(
              [
                ['browse', 'Przeglądaj'],
                ['progress', 'Postępy'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={view === k}
                onClick={() => setView(k)}
                className={`flex-1 rounded-lg px-3 py-1.5 font-medium ${view === k ? 'bg-surface shadow-sm' : 'text-ink-soft'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!deckParam && (
          <label className="mb-3 block">
            <span className="sr-only">Kontynent</span>
            <select
              value={region}
              onChange={(e) => {
                setSelected(null);
                setRegion(e.target.value as ContinentId);
              }}
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3"
            >
              {CONTINENTS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="swiat">Cały świat</option>
            </select>
          </label>
        )}
        {deckParam && <p className="mb-3 text-sm text-ink-soft">{deckParam.split(',').map((d) => deckFromId(d).name).join('; ')}</p>}

        {view === 'progress' && !f && (
          <div className="mb-3">
            <MasteryLegend compact />
            <p className="mt-2 text-sm text-ink-soft">
              {(['mastered', 'learning', 'due', 'new'] as Mastery[]).map((m) => `${MASTERY_LABEL[m]}: ${Object.values(progress).filter((x) => x === m).length}`).join(' · ')}
            </p>
          </div>
        )}

        {f ? (
          <div className="anim-pop">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-2xl font-semibold leading-tight">{f.label ?? f.namePl}</h2>
                <p className="text-ink-soft">
                  {categoryOne(f.category)} · {continentName(f.continent)}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-sunken" aria-label="Zamknij">
                <Icon name="cross" size={18} />
              </button>
            </div>
            {f.aliases.length > 0 && <p className="mt-1 text-sm text-ink-soft">Też: {f.aliases.join(', ')}</p>}
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-sunken px-3 py-1 text-sm">
              Stan: <strong>{MASTERY_LABEL[featureMastery(f.id, map, new Date())]}</strong>
            </p>
            <SkillDue id={f.id} map={map} />
            {f.facts.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {f.facts.map((x) => (
                  <li key={x.id}>
                    <span className="text-ink-soft">{x.q.replace(/\?$/, '')}:</span>{' '}
                    <strong>
                      {x.a.replace(/;/g, ',')}
                      {x.unit ? ` ${x.unit}` : ''}
                    </strong>
                    {x.needsVerification && <span className="text-warn"> (do weryfikacji)</span>}
                  </li>
                ))}
              </ul>
            )}
            {f.note && <p className="mt-2 text-sm text-ink-soft">{f.note}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <LinkButton variant="primary" to={`/sesja?type=practice&ids=${f.id}&kinds=lnf&limit=10`}>
                Poćwicz ten obiekt
              </LinkButton>
            </div>
            <h3 className="mb-2 mt-5 font-semibold">Filmy</h3>
            <VideoList
              targetType="feature"
              targetIds={[f.id]}
              searchQuery={`${f.namePl} ${['morza', 'rzeki', 'jeziora'].includes(f.category) ? '' : categoryOne(f.category).split(' ')[0]} geografia`.replace(/\s+/g, ' ')}
            />
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Stuknij obiekt na mapie, żeby zobaczyć szczegóły.</p>
        )}
      </div>
    </div>
  );
}

function SkillDue({ id, map }: { id: string; map: Map<string, ReviewState> }) {
  const rows = (['name', 'locate'] as const).map((sk) => [sk, map.get(stateKey(id, sk))] as const);
  if (rows.every(([, s]) => !s)) return null;
  const fmt = (t: number) => {
    const d = Math.round((t - Date.now()) / 86_400_000);
    return d <= 0 ? 'dziś' : d === 1 ? 'jutro' : `za ${d} dni`;
  };
  return (
    <p className="mt-2 text-sm text-ink-soft">
      {rows
        .filter(([, s]) => s)
        .map(([sk, s]) => `${sk === 'name' ? 'Nazwa' : 'Wskazanie'}: powtórka ${fmt(s!.due)}`)
        .join(' · ')}
    </p>
  );
}
