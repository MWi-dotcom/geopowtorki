/**
 * Buduje geometrie obiektów z Natural Earth (public domain).
 *
 * Wejście: katalog z plikami GeoJSON Natural Earth (domyślnie ./.ne, zmienna NE_DIR),
 *          pobieranymi przez scripts/fetch-ne.sh.
 * Wyjście:
 *   public/data/geo/<kontynent>.json  – geometrie (ładowane leniwie przez aplikację)
 *   src/data/geo-index.json           – typ geometrii, bbox, środek, wielkość (bundlowane)
 *   docs/BRAKI_GEOMETRII.md           – lista obiektów przybliżonych / brakujących
 *
 * Uruchomienie: npm run data:build   (Node ≥ 22.6, --experimental-strip-types)
 */
import fs from 'node:fs';
import path from 'node:path';
import * as turf from '@turf/turf';
import { FEATURES } from '../src/data/material.ts';

type Geo = GeoJSON.Geometry;
type Pos = number[];

const ROOT = path.resolve(import.meta.dirname, '..');
const NE = process.env.NE_DIR ?? path.join(ROOT, '.ne');

const FILES: Record<string, string> = {
  reg: 'ne_10m_geography_regions_polys',
  mar: 'ne_10m_geography_marine_polys',
  cape: 'ne_10m_geography_regions_points',
  peak: 'ne_10m_geography_regions_elevation_points',
  riv: 'ne_10m_rivers_lake_centerlines',
  lake: 'ne_10m_lakes',
  ice: 'ne_10m_antarctic_ice_shelves_polys',
  hist: 'ne_10m_lakes_historic',
};

const layers: Record<string, GeoJSON.Feature[]> = {};
for (const [k, f] of Object.entries(FILES)) {
  layers[k] = JSON.parse(fs.readFileSync(path.join(NE, f + '.geojson'), 'utf8')).features;
}
const nameOf = (p: Record<string, unknown>) => (p.NAME ?? p.name ?? '') as string;

function find(l: string, n: string): GeoJSON.Feature[] {
  return layers[l].filter((f) => nameOf(f.properties as Record<string, unknown>) === n && f.geometry);
}

const round = (x: number) => Math.round(x * 1000) / 1000;
function roundCoords(g: Geo): Geo {
  const r = (c: unknown): unknown => (typeof (c as number[])[0] === 'number' ? (c as number[]).map(round) : (c as unknown[]).map(r));
  if (g.type === 'GeometryCollection') return g;
  return { ...g, coordinates: r(g.coordinates) } as Geo;
}

/** Wszystkie pozycje geometrii (do bbox). */
function positions(g: Geo): Pos[] {
  const acc: Pos[] = [];
  const walk = (c: unknown) => {
    if (typeof (c as number[])[0] === 'number') acc.push(c as Pos);
    else (c as unknown[]).forEach(walk);
  };
  if (g.type !== 'GeometryCollection') walk(g.coordinates);
  return acc;
}

/**
 * bbox odporny na południk 180°: jeśli obiekt „przechodzi” przez 180°,
 * długości ujemne przesuwamy o +360 (MapLibre akceptuje lon > 180 w bounds).
 */
function smartBbox(g: Geo): [number, number, number, number] {
  const ps = positions(g);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ps) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (maxX - minX > 180) {
    let a = Infinity, b = -Infinity;
    for (const [x0] of ps) {
      const x = x0 < 0 ? x0 + 360 : x0;
      a = Math.min(a, x); b = Math.max(b, x);
    }
    if (b - a < maxX - minX) return [round(a), round(minY), round(b), round(maxY)];
  }
  return [round(minX), round(minY), round(maxX), round(maxY)];
}

function combinePolys(fs_: GeoJSON.Feature[]): Geo {
  const polys = fs_.filter((f) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>[];
  if (polys.length === 1) return polys[0].geometry;
  try {
    const u = turf.union(turf.featureCollection(polys));
    if (u) return u.geometry;
  } catch (e) {
    console.warn('  union nieudany – łączę jako MultiPolygon', (e as Error).message);
  }
  const coords: Pos[][][] = [];
  for (const p of polys) {
    if (p.geometry.type === 'Polygon') coords.push(p.geometry.coordinates);
    else coords.push(...p.geometry.coordinates);
  }
  return { type: 'MultiPolygon', coordinates: coords };
}

function combineLines(fs_: GeoJSON.Feature[]): Geo {
  const coords: Pos[][] = [];
  for (const f of fs_) {
    if (f.geometry.type === 'LineString') coords.push(f.geometry.coordinates);
    else if (f.geometry.type === 'MultiLineString') coords.push(...f.geometry.coordinates);
  }
  return coords.length === 1 ? { type: 'LineString', coordinates: coords[0] } : { type: 'MultiLineString', coordinates: coords };
}

function simplify(g: Geo, sizeKm: number): Geo {
  if (g.type === 'Point') return g;
  // tolerancja w stopniach rośnie z wielkością obiektu
  const tol = Math.min(0.05, Math.max(0.004, sizeKm / 60000));
  try {
    return turf.simplify(turf.feature(g), { tolerance: tol, highQuality: false, mutate: false }).geometry;
  } catch {
    return g;
  }
}

function sizeKm(b: [number, number, number, number]) {
  return turf.distance([b[0], b[1]], [b[2], b[3]], { units: 'kilometers' });
}

/** Punkt etykiety wewnątrz obiektu (dla obszarów – największy wielokąt). */
function labelPoint(g: Geo): [number, number] {
  if (g.type === 'Point') return g.coordinates as [number, number];
  if (g.type === 'MultiPolygon') {
    let best = g.coordinates[0], bestA = -1;
    for (const c of g.coordinates) {
      const a = turf.area(turf.polygon(c));
      if (a > bestA) { bestA = a; best = c; }
    }
    const p = turf.pointOnFeature(turf.polygon(best)).geometry.coordinates;
    return [round(p[0]), round(p[1])];
  }
  if (g.type === 'LineString' || g.type === 'MultiLineString') {
    // środek najdłuższej linii
    const lines = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
    let best = lines[0], bestL = -1;
    for (const l of lines) {
      const len = turf.length(turf.lineString(l));
      if (len > bestL) { bestL = len; best = l; }
    }
    const p = turf.along(turf.lineString(best), bestL / 2).geometry.coordinates;
    return [round(p[0]), round(p[1])];
  }
  const p = turf.pointOnFeature(turf.feature(g)).geometry.coordinates;
  return [round(p[0]), round(p[1])];
}

const geoByContinent: Record<string, GeoJSON.Feature[]> = {};
const index: Record<string, unknown> = {};
const approxList: string[] = [];
const errors: string[] = [];

for (const f of FEATURES) {
  let geom: Geo | null = null;
  let approx = false;
  let t: 'point' | 'line' | 'area';

  if (f.src) {
    const found: GeoJSON.Feature[] = [];
    for (const s of f.src) {
      const r = find(s.l, s.n);
      if (!r.length) errors.push(`${f.id}: brak „${s.n}” w warstwie ${s.l}`);
      found.push(...r);
    }
    if (found.length) {
      const gt = found[0].geometry.type;
      if (gt.includes('Polygon')) geom = combinePolys(found);
      else if (gt.includes('LineString')) geom = combineLines(found);
      else geom = found[0].geometry;
    }
  }
  if (geom && f.clip) {
    const clipped = turf.bboxClip(turf.feature(geom) as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>, f.clip);
    // bboxClip potrafi zostawić puste pierścienie – usuwamy je
    const g = clipped.geometry;
    const okRing = (r: Pos[]) => r.length >= 4;
    if (g.type === 'Polygon') geom = { type: 'Polygon', coordinates: g.coordinates.filter(okRing) };
    else geom = { type: 'MultiPolygon', coordinates: g.coordinates.map((p) => p.filter(okRing)).filter((p) => p.length > 0) };
  }
  if (!geom && f.line) {
    geom = { type: 'LineString', coordinates: f.line };
    approx = true;
  }
  if (!geom && f.pt) {
    if (f.r) {
      geom = turf.circle(f.pt, f.r, { units: 'kilometers', steps: 48 }).geometry;
      approx = true;
    } else geom = { type: 'Point', coordinates: f.pt };
  }
  if (!geom) {
    errors.push(`${f.id}: brak geometrii`);
    continue;
  }
  t = geom.type.includes('Polygon') ? 'area' : geom.type.includes('Line') ? 'line' : 'point';
  if (f.line || (f.pt && !f.src)) approxList.push(`- **${f.namePl}** (${f.continent}, ${f.category}) – ${f.line ? 'linia wpisana ręcznie' : f.r ? `okrąg r=${f.r} km wokół punktu ${f.pt}` : `punkt ${f.pt}`}`);

  const b0 = smartBbox(geom);
  const size = Math.round(sizeKm(b0));
  geom = roundCoords(simplify(geom, size));
  const c = labelPoint(geom);

  index[f.id] = { t, b: smartBbox(geom), c, size: Math.max(size, 1), ...(approx ? { approx: true } : {}) };
  (geoByContinent[f.continent] ??= []).push({ type: 'Feature', properties: { id: f.id, ...(approx ? { approx: 1 } : {}) }, geometry: geom });

  if (f.historic) {
    const hs = f.historic.flatMap((s) => find(s.l, s.n));
    if (hs.length) {
      const hg = roundCoords(simplify(combinePolys(hs), size));
      geoByContinent[f.continent].push({ type: 'Feature', properties: { id: f.id, historic: 1 }, geometry: hg });
    } else errors.push(`${f.id}: brak warstwy historycznej`);
  }
}

// współrzędne szczytów z faktów
const peaks: Record<string, [number, number, number]> = {};
for (const f of FEATURES)
  for (const fa of f.facts)
    if (fa.peakRef) {
      const p = find('peak', fa.peakRef)[0];
      if (!p) errors.push(`${f.id}: brak szczytu ${fa.peakRef}`);
      else {
        const [x, y] = (p.geometry as GeoJSON.Point).coordinates;
        peaks[fa.peakRef] = [round(x), round(y), Number((p.properties as Record<string, unknown>).elevation)];
      }
    }

const outGeo = path.join(ROOT, 'public/data/geo');
fs.mkdirSync(outGeo, { recursive: true });
let total = 0;
for (const [k, feats] of Object.entries(geoByContinent)) {
  const s = JSON.stringify({ type: 'FeatureCollection', features: feats });
  fs.writeFileSync(path.join(outGeo, `${k}.json`), s);
  total += s.length;
  console.log(`${k}: ${feats.length} obiektów, ${(s.length / 1024).toFixed(0)} kB`);
}
fs.writeFileSync(path.join(ROOT, 'src/data/geo-index.json'), JSON.stringify({ features: index, peaks }, null, 0));

fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, 'docs/BRAKI_GEOMETRII.md'),
  `# Obiekty bez geometrii w Natural Earth\n\nPoniższe obiekty nie występują w danych Natural Earth (1:10m) albo mają tam\nnieodpowiednie granice. Zostały oznaczone w przybliżeniu (okrąg wokół punktu,\npunkt lub linia wpisana ręcznie) – na mapie rysowane są linią przerywaną.\nPlik generuje \`npm run data:build\`.\n\n${approxList.join('\n')}\n\n## Obiekty złożone z kilku obiektów Natural Earth (suma)\n\n${FEATURES.filter((f) => (f.src?.length ?? 0) > 1)
    .map((f) => `- **${f.namePl}**: ${f.src!.map((s) => s.n).join(', ')}`)
    .join('\n')}\n`,
);

console.log(`Razem: ${(total / 1024).toFixed(0)} kB, obiektów: ${Object.keys(index).length}/${FEATURES.length}`);
if (errors.length) {
  console.error('BŁĘDY:\n' + errors.join('\n'));
  process.exitCode = 1;
}
