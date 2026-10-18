/**
 * Leniwe ładowanie geometrii (public/data/geo/<kontynent>.json).
 * Metadane (typ, bbox, środek) są w bundlu – src/data/geo-index.json.
 */
import type { Feature as GJFeature, Geometry } from 'geojson';
import type { ContinentId, GeoMeta } from '../core/types';
import geoIndex from '../data/geo-index.json';
import { FEATURE_BY_ID } from '../data/material';

export const GEO_META = geoIndex.features as unknown as Record<string, GeoMeta>;
export const PEAKS = geoIndex.peaks as unknown as Record<string, [number, number, number]>;

const cache = new Map<ContinentId, Promise<GJFeature[]>>();
const geomById = new Map<string, Geometry>();
const historicById = new Map<string, Geometry>();

export function loadContinent(c: ContinentId): Promise<GJFeature[]> {
  if (!cache.has(c)) {
    const p = fetch(`${import.meta.env.BASE_URL}data/geo/${c}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Nie udało się wczytać mapy (${c}).`);
        return r.json();
      })
      .then((fc: { features: GJFeature[] }) => {
        for (const f of fc.features) {
          const id = f.properties!.id as string;
          if (f.properties!.historic) historicById.set(id, f.geometry);
          else geomById.set(id, f.geometry);
        }
        return fc.features;
      });
    p.catch(() => cache.delete(c));
    cache.set(c, p);
  }
  return cache.get(c)!;
}

/** Wczytuje geometrie dla podanych obiektów (kontynenty potrzebne do ich wyświetlenia). */
export async function ensureFeatures(ids: string[]): Promise<void> {
  const cs = new Set<ContinentId>();
  for (const id of ids) {
    const f = FEATURE_BY_ID[id];
    if (f) cs.add(f.continent);
  }
  await Promise.all([...cs].map(loadContinent));
}

export const getGeometry = (id: string) => geomById.get(id);
export const getHistoric = (id: string) => historicById.get(id);
export const loadedIds = () => [...geomById.keys()];
