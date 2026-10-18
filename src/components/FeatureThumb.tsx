/**
 * Miniatura mapy obiektu: wycinek kafelków reliefu (Web Mercator) + kształt
 * obiektu narysowany w SVG. Bez dodatkowej instancji MapLibre – lekka i szybka.
 */
import { useEffect, useState } from 'react';
import type { Geometry, Position } from 'geojson';
import { ensureFeatures, GEO_META, getGeometry } from '../lib/geo';

const T = 256;
const MAXZ = 5;

function project(lon: number, lat: number, z: number): [number, number] {
  const s = T * 2 ** z;
  const la = Math.max(-85, Math.min(85, lat));
  const x = ((lon + 180) / 360) * s;
  const y = ((1 - Math.log(Math.tan((la * Math.PI) / 180) + 1 / Math.cos((la * Math.PI) / 180)) / Math.PI) / 2) * s;
  return [x, y];
}

function rings(g: Geometry): { kind: 'poly' | 'line' | 'point'; pts: Position[] }[] {
  switch (g.type) {
    case 'Point':
      return [{ kind: 'point', pts: [g.coordinates] }];
    case 'LineString':
      return [{ kind: 'line', pts: g.coordinates }];
    case 'MultiLineString':
      return g.coordinates.map((pts) => ({ kind: 'line' as const, pts }));
    case 'Polygon':
      return g.coordinates.map((pts) => ({ kind: 'poly' as const, pts }));
    case 'MultiPolygon':
      return g.coordinates.flatMap((p) => p.map((pts) => ({ kind: 'poly' as const, pts })));
    default:
      return [];
  }
}

export function FeatureThumb({ id, size = 96, className = '' }: { id: string; size?: number; className?: string }) {
  const [geom, setGeom] = useState<Geometry | undefined>(() => getGeometry(id));
  useEffect(() => {
    if (!geom) ensureFeatures([id]).then(() => setGeom(getGeometry(id)));
  }, [id, geom]);
  const meta = GEO_META[id];
  if (!meta) return null;

  // bbox (z poprawką na 180°) → zoom, przy którym obiekt mieści się w miniaturze
  const [a, b, c, d] = meta.b;
  const wrap = c > 180;
  const lon = (x: number) => (wrap && x < 0 ? x + 360 : x);
  let z = MAXZ;
  for (; z > 0; z--) {
    const [x0, y0] = project(a, d, z);
    const [x1, y1] = project(c, b, z);
    if (Math.max(x1 - x0, y1 - y0) <= size * 0.7) break;
  }
  const [x0, y0] = project(a, d, z);
  const [x1, y1] = project(c, b, z);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const left = cx - size / 2;
  const top = cy - size / 2;
  const n = 2 ** z;

  const tiles: { x: number; y: number; tx: number; ty: number }[] = [];
  for (let tx = Math.floor(left / T); tx <= Math.floor((left + size) / T); tx++)
    for (let ty = Math.floor(top / T); ty <= Math.floor((top + size) / T); ty++) {
      if (ty < 0 || ty >= n) continue;
      tiles.push({ x: tx * T - left, y: ty * T - top, tx: ((tx % n) + n) % n, ty });
    }

  const shapes = geom ? rings(geom) : [];
  const toPath = (pts: Position[], close: boolean) =>
    pts
      .map((p, i) => {
        const [x, y] = project(lon(p[0]), p[1], z);
        return `${i ? 'L' : 'M'}${(x - left).toFixed(1)} ${(y - top).toFixed(1)}`;
      })
      .join('') + (close ? 'Z' : '');

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-lg bg-[#a9c8d9] ${className}`} style={{ width: size, height: size }} aria-hidden>
      {tiles.map((t) => (
        <img
          key={`${t.tx}-${t.ty}-${t.x}`}
          src={`${import.meta.env.BASE_URL}tiles/hyp/${z}/${t.tx}/${t.ty}.webp`}
          alt=""
          loading="lazy"
          className="absolute max-w-none"
          style={{ left: t.x, top: t.y, width: T, height: T }}
        />
      ))}
      <svg className="absolute inset-0" width={size} height={size}>
        {shapes.some((s) => s.kind === 'poly') && (
          <path d={shapes.filter((s) => s.kind === 'poly').map((s) => toPath(s.pts, true)).join(' ')} fill="#b0306a" fillOpacity={0.35} fillRule="evenodd" stroke="#b0306a" strokeWidth={1.4} />
        )}
        {shapes
          .filter((s) => s.kind === 'line')
          .map((s, i) => (
            <path key={i} d={toPath(s.pts, false)} fill="none" stroke="#b0306a" strokeWidth={2.2} strokeLinejoin="round" />
          ))}
        {shapes
          .filter((s) => s.kind === 'point')
          .map((s, i) => {
            const [x, y] = project(lon(s.pts[0][0]), s.pts[0][1], z);
            return <circle key={i} cx={x - left} cy={y - top} r={5} fill="#b0306a" stroke="#fff" strokeWidth={2} />;
          })}
      </svg>
    </div>
  );
}
