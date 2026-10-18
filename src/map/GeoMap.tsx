/**
 * Komponent mapy (MapLibre GL JS). Sterowany imperatywnie przez ref
 * (MapApi) – ćwiczenia zmieniają podświetlenia i znaczniki bez przebudowy stylu.
 *
 * Tryby:
 *  exercise – mapa niema; widoczne tylko podświetlone obiekty,
 *  browse   – wszystkie obiekty zakresu + etykiety, klik pokazuje szczegóły,
 *  progress – obiekty kolorowane wg opanowania (kolor + deseń/ikona),
 *  contour  – mapa konturowa z numerami.
 */
import { AttributionControl, Map as MLMap, setWorkerUrl, type ExpressionSpecification, type GeoJSONSource, type LngLatBoundsLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre v6 ładuje worker jako osobny moduł ES; Vite musi go zbundlować
// i podać adres jawnie, inaczej po buildzie mapa się nie wczytuje.
import mlWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Feature as GJFeature, Position } from 'geojson';
import type { ContinentId } from '../core/types';
import type { Mastery } from '../core/stats';
import { FEATURE_BY_ID } from '../data/material';
import { VIEWS } from '../data/meta';
import { ensureFeatures, GEO_META, getGeometry, getHistoric } from '../lib/geo';
import { prefersReducedMotion } from '../lib/settings';
import { buildStyle, COLORS, hlColor, makePatterns, statusColor } from './style';

export type MapMode = 'exercise' | 'browse' | 'progress' | 'contour';
export type Hl = 'target' | 'focus' | 'correct' | 'wrong' | 'other';

export interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface MapApi {
  setHighlights(h: Record<string, Hl>): void;
  showAnswer(click: Position | null, nearest?: Position | null, ok?: boolean, label?: string): void;
  showPeak(p: Position | null, label?: string): void;
  /** przelot do obiektu; extra – inne obiekty, points – dodatkowe punkty (np. miejsce kliknięcia) do objęcia widokiem */
  flyToFeature(id: string, extra?: string[], points?: Position[]): void;
  fitRegion(region: ContinentId | 'swiat'): void;
  setNumbers(n: { n: number; id: string; state?: 'ok' | 'bad' | 'active' }[]): void;
  zoomBy(d: number): void;
}

interface Props {
  region: ContinentId | 'swiat';
  mode: MapMode;
  featureIds: string[];
  progress?: Record<string, Mastery>;
  padding?: Partial<Padding>;
  onMapClick?: (p: Position) => void;
  onFeatureClick?: (id: string | null) => void;
  motion?: boolean;
  dark: boolean;
  className?: string;
  /** pokaż obszary przybliżone i dawny zasięg jezior w trybie przeglądania */
  showHistoric?: boolean;
  onReady?: () => void;
}

setWorkerUrl(mlWorkerUrl);

/**
 * Widoki zdefiniowane środkiem i zoomem (świat, Antarktyda – widok biegunowy na
 * globusie) są dobrane dla okna ~800 px; na mniejszym ekranie oddalamy mapę,
 * żeby cały kontynent się mieścił.
 */
function scaledZoom(zoom: number, el: HTMLElement, p: Padding): number {
  const w = el.clientWidth - p.left - p.right;
  const h = el.clientHeight - p.top - p.bottom;
  const size = Math.min(w, h);
  if (!(size > 0)) return zoom;
  return Math.max(-1.5, zoom + Math.min(0, Math.log2(size / 760)));
}

const FULL_PAD: Padding = { top: 20, bottom: 20, left: 20, right: 20 };

export const GeoMap = forwardRef<MapApi, Props>(function GeoMap(props, ref) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hlRef = useRef<Record<string, Hl>>({});
  const propsRef = useRef(props);
  propsRef.current = props;

  const pad = (): Padding => ({ ...FULL_PAD, ...propsRef.current.padding });
  const animate = () => propsRef.current.motion !== false && !prefersReducedMotion();

  // --- inicjalizacja (raz na zmianę motywu) ---
  useEffect(() => {
    const view = VIEWS[props.region];
    const map = new MLMap({
      container: box.current!,
      style: buildStyle(props.dark),
      ...('bounds' in view ? { bounds: view.bounds as LngLatBoundsLike, fitBoundsOptions: { padding: pad() } } : { center: view.center, zoom: scaledZoom(view.zoom, box.current!, pad()) }),
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxZoom: 9,
      minZoom: -1.5, // ujemny zoom potrzebny dla widoku Antarktydy na telefonie
      renderWorldCopies: false,
    });
    // na telefonie panel ćwiczeń jest u dołu – atrybucja idzie do góry, żeby nie zasłaniać przycisków
    map.addControl(new AttributionControl({ compact: true }), innerWidth < 768 ? 'top-left' : 'bottom-right');
    map.touchZoomRotate.disableRotation();
    map.keyboard.disable(); // klawiatura służy do odpowiadania (Enter, 1–4)
    mapRef.current = map;
    map.on('load', () => {
      for (const [k, img] of Object.entries(makePatterns())) if (!map.hasImage(k)) map.addImage(k, img, { pixelRatio: k.startsWith('ico') ? 2 : 1 });
      setReady(true);
      propsRef.current.onReady?.();
    });
    map.on('error', (e) => console.warn('Mapa:', e.error?.message));
    map.on('click', (e) => {
      const p = propsRef.current;
      if (p.mode === 'exercise' && p.onMapClick) {
        p.onMapClick([e.lngLat.lng, e.lngLat.lat]);
        return;
      }
      if (p.onFeatureClick) {
        const r = 8;
        const hits = map.queryRenderedFeatures(
          [
            [e.point.x - r, e.point.y - r],
            [e.point.x + r, e.point.y + r],
          ],
          { layers: ['point', 'point-status', 'line', 'area-fill', 'labels'] },
        );
        // najmniejszy obiekt wygrywa (Tyrreńskie zamiast Śródziemnego)
        const ids = [...new Set(hits.map((h) => h.properties?.id as string).filter(Boolean))];
        ids.sort((a, b) => (GEO_META[a]?.size ?? 0) - (GEO_META[b]?.size ?? 0));
        const pointLine = ids.find((id) => GEO_META[id]?.t !== 'area');
        p.onFeatureClick(pointLine ?? ids[0] ?? null);
      }
    });
    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.dark]);

  // --- dane obiektów ---
  const idsKey = props.featureIds.join(',');
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLoading(true);
    ensureFeatures(props.featureIds)
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const feats: GJFeature[] = [];
        const labels: GJFeature[] = [];
        const hist: GJFeature[] = [];
        for (const id of props.featureIds) {
          const g = getGeometry(id);
          const meta = GEO_META[id];
          const f = FEATURE_BY_ID[id];
          if (!g || !meta) continue;
          const name = f.label ?? f.namePl;
          feats.push({ type: 'Feature', geometry: g, properties: { id, t: meta.t, approx: meta.approx ? 1 : 0, name: f.namePl, status: props.progress?.[id] ?? 'new' } });
          if (meta.t !== 'line') labels.push({ type: 'Feature', geometry: { type: 'Point', coordinates: meta.c }, properties: { id, name, size: meta.size, cat: f.category } });
          const h = getHistoric(id);
          if (h) hist.push({ type: 'Feature', geometry: h, properties: { id } });
        }
        const m = mapRef.current;
        (m.getSource('feat') as GeoJSONSource).setData({ type: 'FeatureCollection', features: feats });
        (m.getSource('labels') as GeoJSONSource).setData({ type: 'FeatureCollection', features: labels });
        (m.getSource('hist') as GeoJSONSource).setData({ type: 'FeatureCollection', features: hist });
        applyHl(m, hlRef.current, {});
        setLoading(false);
        setError(null);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, idsKey, props.progress]);

  // --- tryb ---
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    applyMode(m, props.mode, !!props.showHistoric);
  }, [ready, props.mode, props.showHistoric]);

  // --- region ---
  useEffect(() => {
    if (ready) fit(props.region);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.region]);

  function fit(region: ContinentId | 'swiat') {
    const m = mapRef.current;
    if (!m) return;
    const v = VIEWS[region];
    const opts = { padding: pad(), duration: animate() ? 900 : 0 };
    if ('bounds' in v) m.fitBounds(v.bounds as LngLatBoundsLike, opts);
    else m.easeTo({ center: v.center, zoom: scaledZoom(v.zoom, m.getContainer(), pad()), padding: pad(), duration: opts.duration });
  }

  useImperativeHandle(ref, () => ({
    setHighlights(h) {
      const m = mapRef.current;
      const prev = hlRef.current;
      hlRef.current = h;
      if (m && ready) applyHl(m, h, prev);
    },
    showAnswer(click, nearest, ok, label) {
      const m = mapRef.current;
      if (!m || !ready) return;
      const fs: GJFeature[] = [];
      if (click) {
        if (nearest && (nearest[0] !== click[0] || nearest[1] !== click[1]))
          fs.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [click, nearest] }, properties: {} });
        fs.push({ type: 'Feature', geometry: { type: 'Point', coordinates: click }, properties: { kind: ok ? 'ok' : 'bad', ...(label ? { label } : {}) } });
      }
      (m.getSource('answer') as GeoJSONSource).setData({ type: 'FeatureCollection', features: fs });
    },
    showPeak(p, label) {
      const m = mapRef.current;
      if (!m || !ready) return;
      (m.getSource('answer') as GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: p ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { kind: 'peak', label } }] : [],
      });
    },
    flyToFeature(id, extra = [], points = []) {
      const m = mapRef.current;
      const meta = GEO_META[id];
      if (!m || !meta) return;
      let [a, b, c, d] = meta.b;
      for (const e of extra) {
        const x = GEO_META[e]?.b;
        if (x) [a, b, c, d] = [Math.min(a, x[0]), Math.min(b, x[1]), Math.max(c, x[2]), Math.max(d, x[3])];
      }
      for (const [x, y] of points) [a, b, c, d] = [Math.min(a, x), Math.min(b, y), Math.max(c, x), Math.max(d, y)];
      // mały obiekt – nie przybliżaj za mocno; duży – pokaż w całości
      const maxZoom = meta.t === 'point' ? 5 : 6;
      m.fitBounds(
        [
          [a, b],
          [c, d],
        ],
        { padding: pad(), maxZoom, duration: animate() ? 1100 : 0, essential: false },
      );
    },
    fitRegion: fit,
    setNumbers(list) {
      const m = mapRef.current;
      if (!m || !ready) return;
      (m.getSource('numbers') as GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: list
          .filter((x) => GEO_META[x.id])
          .map((x) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: GEO_META[x.id].c }, properties: { n: x.n, id: x.id, state: x.state ?? '' } })),
      });
    },
    zoomBy(d) {
      const m = mapRef.current;
      if (m) m.zoomTo(m.getZoom() + d, { duration: animate() ? 250 : 0 });
    },
  }));

  return (
    <div
      className={
        // pozycjonowanie z zewnątrz (np. „absolute inset-0”) ma pierwszeństwo – inaczej
        // „relative” wygrywa w kolejności CSS i kontener ma wysokość 0
        /\b(absolute|fixed|sticky)\b/.test(props.className ?? '') ? props.className : `relative ${props.className ?? ''}`
      }
    >
      {/* styl inline: CSS MapLibre (.maplibregl-map { position: relative }) leży poza
          warstwami Tailwinda i nadpisałby klasę „absolute” – kontener miałby wysokość 0 */}
      <div ref={box} style={{ position: 'absolute', inset: 0 }} role="application" aria-label="Mapa fizyczna świata" />
      {(loading || !ready) && !error && (
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-surface/90 px-3 py-1 text-sm text-ink-soft shadow">Wczytuję mapę…</div>
      )}
      {error && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-lg bg-surface px-4 py-2 text-sm text-wrong shadow">
          {error} Sprawdź połączenie i odśwież stronę.
        </div>
      )}
    </div>
  );
});

function applyHl(m: MLMap, next: Record<string, Hl>, prev: Record<string, Hl>) {
  for (const id of Object.keys(prev)) if (!(id in next)) m.setFeatureState({ source: 'feat', id }, { hl: null });
  for (const [id, v] of Object.entries(next)) m.setFeatureState({ source: 'feat', id }, { hl: v });
  // dawny zasięg jeziora pokaż razem z podświetleniem
  const hist = m.getLayer('hist-line');
  if (hist) {
    const ids = Object.keys(next);
    if (ids.length) {
      m.setFilter('hist-line', ['in', ['get', 'id'], ['literal', ids]]);
      m.setLayoutProperty('hist-line', 'visibility', 'visible');
    } else if (m.getLayoutProperty('hist-line', 'visibility') === 'visible' && !(m as MLMap & { __browse?: boolean }).__browse) {
      m.setLayoutProperty('hist-line', 'visibility', 'none');
    }
  }
}

const hasHl: ExpressionSpecification = ['!=', ['coalesce', ['feature-state', 'hl'], ''], ''];

function applyMode(m: MLMap, mode: MapMode, historic: boolean) {
  const vis = (id: string, on: boolean) => m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  const browse = mode === 'browse';
  const progress = mode === 'progress';
  (m as MLMap & { __browse?: boolean }).__browse = browse && historic;
  vis('labels', browse);
  vis('labels-line', browse);
  vis('area-pattern', progress);
  vis('point-status', progress);
  vis('numbers-circle', mode === 'contour');
  vis('numbers-text', mode === 'contour');
  if (browse && historic) {
    m.setFilter('hist-line', null);
    vis('hist-line', true);
  }

  if (progress) {
    m.setPaintProperty('area-fill', 'fill-color', ['case', hasHl, hlColor, statusColor]);
    m.setPaintProperty('area-fill', 'fill-opacity', ['case', hasHl, 0.45, ['==', ['get', 'status'], 'new'], 0.12, 0.28]);
    m.setPaintProperty('area-line', 'line-color', ['case', hasHl, hlColor, statusColor]);
    m.setPaintProperty('area-line', 'line-opacity', 0.9);
    m.setPaintProperty('area-line', 'line-width', ['case', hasHl, 2.4, 1.2]);
    m.setPaintProperty('line', 'line-color', ['case', hasHl, hlColor, statusColor]);
    m.setPaintProperty('line', 'line-opacity', 1);
    m.setPaintProperty('line', 'line-width', ['case', hasHl, 4, 2.6]);
    m.setPaintProperty('line', 'line-dasharray', ['case', ['==', ['get', 'status'], 'new'], ['literal', [1, 1.5]], ['==', ['get', 'status'], 'due'], ['literal', [3, 1]], ['literal', [1, 0]]]);
    m.setPaintProperty('point', 'circle-opacity', 0);
    m.setPaintProperty('point', 'circle-stroke-opacity', 0);
  } else if (browse) {
    m.setPaintProperty('area-fill', 'fill-color', hlColor);
    m.setPaintProperty('area-fill', 'fill-opacity', ['case', hasHl, 0.38, 0.05]);
    m.setPaintProperty('area-line', 'line-color', ['case', hasHl, hlColor, '#3d5e6b']);
    m.setPaintProperty('area-line', 'line-opacity', ['case', hasHl, 0.95, 0.35]);
    m.setPaintProperty('area-line', 'line-width', ['case', hasHl, 2.2, 0.8]);
    m.setPaintProperty('line', 'line-color', ['case', hasHl, hlColor, '#2a6f93']);
    m.setPaintProperty('line', 'line-opacity', 0.9);
    m.setPaintProperty('line', 'line-width', ['case', hasHl, 3.4, 1.8]);
    m.setPaintProperty('line', 'line-dasharray', ['literal', [1, 0]]);
    m.setPaintProperty('point', 'circle-opacity', 1);
    m.setPaintProperty('point', 'circle-stroke-opacity', 1);
  } else {
    // exercise / contour – mapa niema
    m.setPaintProperty('area-fill', 'fill-color', hlColor);
    m.setPaintProperty('area-fill', 'fill-opacity', ['case', hasHl, 0.38, 0]);
    m.setPaintProperty('area-line', 'line-color', hlColor);
    m.setPaintProperty('area-line', 'line-opacity', ['case', hasHl, 0.95, 0]);
    m.setPaintProperty('area-line', 'line-width', ['case', hasHl, 2.2, 1]);
    m.setPaintProperty('line', 'line-color', hlColor);
    m.setPaintProperty('line', 'line-opacity', ['case', hasHl, 1, 0]);
    m.setPaintProperty('line', 'line-width', ['case', hasHl, 3.2, 1.6]);
    m.setPaintProperty('line', 'line-dasharray', ['literal', [1, 0]]);
    m.setPaintProperty('point', 'circle-opacity', ['case', hasHl, 1, 0]);
    m.setPaintProperty('point', 'circle-stroke-opacity', ['case', hasHl, 1, 0]);
  }
}

export { COLORS };
