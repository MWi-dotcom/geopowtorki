/**
 * Ocena kliknięć na mapie („Wskaż na mapie”) i mapowanie wyniku na ocenę FSRS.
 *
 * Tolerancja zależy od skali regionu (przekątnej widoku partii), a nie od
 * bieżącego przybliżenia – przybliżenie mapy nie utrudnia zadania.
 *   punkt  – trafienie w promieniu tolerancji,
 *   linia  – trafienie w buforze wokół linii (rzeka),
 *   obszar – trafienie w wielokąt lub w małym buforze wokół niego.
 */
import { booleanPointInPolygon, distance, nearestPointOnLine, point, polygonToLine } from '@turf/turf';
import type { Feature as GJFeature, Geometry, LineString, MultiLineString, MultiPolygon, Polygon, Position } from 'geojson';
import { Rating, type Grade } from 'ts-fsrs';
import type { GeometryType } from './types';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Tolerancja (km) dla danego typu geometrii i wielkości regionu (km). */
export function toleranceKm(type: GeometryType, regionKm: number, approx = false): number {
  if (type === 'point') return clamp(regionKm * 0.025, 50, 250);
  if (type === 'line') return clamp(regionKm * 0.012, 25, 120);
  // obszary przybliżone okręgiem dostają nieco większy bufor
  return clamp(regionKm * (approx ? 0.012 : 0.007), 15, approx ? 90 : 60);
}

export interface ClickResult {
  correct: boolean;
  /** odległość kliknięcia od obiektu (0 = wewnątrz obszaru) */
  distanceKm: number;
  toleranceKm: number;
  /** najbliższy punkt obiektu – do narysowania linii „odległości” */
  nearest: Position;
}

/** Odległość punktu od geometrii (km) i najbliższy punkt geometrii. */
export function distanceToGeometry(click: Position, geom: Geometry): { km: number; nearest: Position } {
  const p = point(click);
  switch (geom.type) {
    case 'Point':
      return { km: distance(p, point(geom.coordinates), { units: 'kilometers' }), nearest: geom.coordinates };
    case 'LineString':
    case 'MultiLineString': {
      const n = nearestPointOnLine(geom as LineString | MultiLineString, p, { units: 'kilometers' });
      return { km: n.properties.pointDistance ?? Infinity, nearest: n.geometry.coordinates };
    }
    case 'Polygon':
    case 'MultiPolygon': {
      if (booleanPointInPolygon(p, geom as Polygon | MultiPolygon)) return { km: 0, nearest: click };
      const lines = polygonToLine(geom as Polygon | MultiPolygon);
      const feats: GJFeature<LineString | MultiLineString>[] = lines.type === 'FeatureCollection' ? lines.features : [lines];
      let best = { km: Infinity, nearest: click as Position };
      for (const l of feats) {
        const n = nearestPointOnLine(l, p, { units: 'kilometers' });
        const d = n.properties.pointDistance ?? Infinity;
        if (d < best.km) best = { km: d, nearest: n.geometry.coordinates };
      }
      return best;
    }
    default:
      return { km: Infinity, nearest: click };
  }
}

export function gradeClick(click: Position, geom: Geometry, type: GeometryType, regionKm: number, approx = false): ClickResult {
  const tol = toleranceKm(type, regionKm, approx);
  const { km, nearest } = distanceToGeometry(click, geom);
  return { correct: km <= tol, distanceKm: km, toleranceKm: tol, nearest };
}

// ---------------------------------------------------------------------------
// Ocena FSRS z wyniku odpowiedzi
// ---------------------------------------------------------------------------

export interface Outcome {
  correct: boolean;
  /** czas odpowiedzi w ms */
  ms: number;
  /** liczba prób (1 = za pierwszym razem) */
  attempts?: number;
  /** odpowiedź z literówką / z tolerancją liczbową */
  typo?: boolean;
  /** uczeń poprosił o podpowiedź (np. 4 opcje zamiast wpisywania) */
  helped?: boolean;
  /** odpowiedź wybierana z 4 opcji (łatwiejsza niż wpisywana) */
  multipleChoice?: boolean;
}

/** Progi „szybkiej” odpowiedzi (ms) – szybka i bezbłędna = Easy. */
export const FAST_MS = { locate: 5000, name: 6000, fact: 8000 };

export function ratingFromOutcome(o: Outcome, kind: 'locate' | 'name' | 'fact'): Grade {
  if (!o.correct) return Rating.Again;
  if (o.typo || o.helped || (o.attempts ?? 1) > 1) return Rating.Hard;
  if (o.multipleChoice) return Rating.Good;
  return o.ms <= FAST_MS[kind] ? Rating.Easy : Rating.Good;
}
