import type { FeatureCollection } from 'geojson';
/**
 * Styl mapy: tło rastrowe (Natural Earth – relief + kolory hipsometryczne,
 * kafelki generowane lokalnie, bez etykiet) i warstwy obiektów z materiału.
 */
import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl';

export const COLORS = {
  target: '#b0306a',
  correct: '#1f8a52',
  wrong: '#c8443a',
  other: '#d98a00',
  focus: '#b0306a',
  mastered: '#1f8a52',
  learning: '#c99700',
  due: '#c8443a',
  new: '#7d8a93',
  label: '#18302f',
  labelHalo: 'rgba(250,252,248,0.9)',
};

/** Kolor wg stanu podświetlenia (feature-state "hl"). */
export const hlColor: ExpressionSpecification = [
  'match',
  ['coalesce', ['feature-state', 'hl'], ''],
  'target',
  COLORS.target,
  'focus',
  COLORS.focus,
  'correct',
  COLORS.correct,
  'wrong',
  COLORS.wrong,
  'other',
  COLORS.other,
  '#486a7a',
];

export const statusColor: ExpressionSpecification = [
  'match',
  ['get', 'status'],
  'mastered',
  COLORS.mastered,
  'learning',
  COLORS.learning,
  'due',
  COLORS.due,
  COLORS.new,
];

const hasHl: ExpressionSpecification = ['!=', ['coalesce', ['feature-state', 'hl'], ''], ''];

/** Czapy polarne (od 84,5° do bieguna), w ćwiartkach – bezpieczne dla globusa. */
function polarCaps(): FeatureCollection {
  const features: FeatureCollection['features'] = [];
  for (const [p, a, b] of [['N', 84.5, 90], ['S', -90, -84.5]] as const)
    for (let lon = -180; lon < 180; lon += 90)
      features.push({
        type: 'Feature',
        properties: { p },
        geometry: { type: 'Polygon', coordinates: [[[lon, a], [lon + 90, a], [lon + 90, b], [lon, b], [lon, a]]] },
      });
  return { type: 'FeatureCollection', features };
}

export function absUrl(path: string) {
  // Kafelki i glify muszą mieć pełny adres; nawiasy {z} nie mogą zostać zakodowane.
  return location.origin + import.meta.env.BASE_URL + path;
}

export function buildStyle(dark: boolean): StyleSpecification {
  return {
    version: 8,
    projection: { type: 'globe' },
    glyphs: absUrl('fonts/{fontstack}/{range}.pbf'),
    sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] },
    sources: {
      relief: {
        type: 'raster',
        tiles: [absUrl('tiles/hyp/{z}/{x}/{y}.webp')],
        tileSize: 256,
        maxzoom: 5,
        attribution: 'Natural Earth (public domain)',
      },
      poles: { type: 'geojson', data: polarCaps() },
      feat: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'id' },
      hist: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      labels: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      answer: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      numbers: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': dark ? '#c9d6dc' : '#dfe8ec' } },
      {
        id: 'relief',
        type: 'raster',
        source: 'relief',
        paint: dark ? { 'raster-brightness-max': 0.78, 'raster-saturation': -0.15, 'raster-contrast': 0.05 } : { 'raster-saturation': -0.05 },
      },
      {
        // kafelki Mercatora kończą się na ~85°; na globusie przy biegunach zostaje
        // „rozmazany” krąg – zakrywamy go jednolitą czapą w kolorze lodu / morza
        id: 'poles',
        type: 'fill',
        source: 'poles',
        paint: {
          'fill-antialias': false,
          'fill-color': ['match', ['get', 'p'], 'S', dark ? '#acb2bd' : '#dde5f1', dark ? '#5f84a1' : '#7aa9cf'],
        },
      },
      {
        id: 'hist-line',
        type: 'line',
        source: 'hist',
        layout: { visibility: 'none' },
        paint: { 'line-color': '#2b5d75', 'line-width': 1.6, 'line-dasharray': [2, 2] },
      },
      {
        id: 'area-fill',
        type: 'fill',
        source: 'feat',
        filter: ['==', ['get', 't'], 'area'],
        paint: { 'fill-color': hlColor, 'fill-opacity': ['case', hasHl, 0.38, 0] },
      },
      {
        id: 'area-pattern',
        type: 'fill',
        source: 'feat',
        filter: ['all', ['==', ['get', 't'], 'area'], ['in', ['get', 'status'], ['literal', ['due', 'learning']]]],
        layout: { visibility: 'none' },
        paint: { 'fill-pattern': ['concat', 'pat-', ['get', 'status']], 'fill-opacity': 0.75 },
      },
      {
        id: 'area-line',
        type: 'line',
        source: 'feat',
        filter: ['==', ['get', 't'], 'area'],
        paint: {
          'line-color': hlColor,
          'line-width': ['case', hasHl, 2.2, 1],
          'line-opacity': ['case', hasHl, 0.95, 0],
          'line-dasharray': ['case', ['==', ['get', 'approx'], 1], ['literal', [3, 2]], ['literal', [1, 0]]],
        },
      },
      {
        id: 'line-casing',
        type: 'line',
        source: 'feat',
        filter: ['==', ['get', 't'], 'line'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': 'rgba(255,255,255,0.85)', 'line-width': ['case', hasHl, 6, 0], 'line-opacity': ['case', hasHl, 1, 0] },
      },
      {
        id: 'line',
        type: 'line',
        source: 'feat',
        filter: ['==', ['get', 't'], 'line'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': hlColor, 'line-width': ['case', hasHl, 3.2, 1.6], 'line-opacity': ['case', hasHl, 1, 0] },
      },
      {
        id: 'point',
        type: 'circle',
        source: 'feat',
        filter: ['==', ['get', 't'], 'point'],
        paint: {
          'circle-radius': ['case', hasHl, 8, 5],
          'circle-color': hlColor,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': ['case', hasHl, 1, 0],
          'circle-stroke-opacity': ['case', hasHl, 1, 0],
        },
      },
      {
        id: 'point-status',
        type: 'symbol',
        source: 'feat',
        filter: ['==', ['get', 't'], 'point'],
        layout: { visibility: 'none', 'icon-image': ['concat', 'ico-', ['get', 'status']], 'icon-allow-overlap': true },
      },
      {
        id: 'labels-line',
        type: 'symbol',
        source: 'feat',
        filter: ['==', ['get', 't'], 'line'],
        layout: {
          visibility: 'none',
          'symbol-placement': 'line',
          'text-field': ['get', 'name'],
          'text-font': ['noto-italic'],
          'text-size': 12,
          'symbol-spacing': 400,
        },
        paint: { 'text-color': '#1d5675', 'text-halo-color': COLORS.labelHalo, 'text-halo-width': 1.6 },
      },
      {
        id: 'labels',
        type: 'symbol',
        source: 'labels',
        layout: {
          visibility: 'none',
          'text-field': ['get', 'name'],
          'text-font': ['case', ['==', ['get', 'cat'], 'morza'], ['literal', ['noto-italic']], ['literal', ['noto-regular']]],
          'text-size': ['interpolate', ['linear'], ['get', 'size'], 50, 11, 1500, 13, 4000, 15],
          'text-max-width': 8,
          'text-padding': 2,
          'symbol-sort-key': ['-', 0, ['get', 'size']],
        },
        paint: {
          'text-color': ['case', ['==', ['get', 'cat'], 'morza'], '#1d5675', COLORS.label],
          'text-halo-color': COLORS.labelHalo,
          'text-halo-width': 1.6,
        },
      },
      {
        id: 'answer-line',
        type: 'line',
        source: 'answer',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': '#18302f', 'line-width': 1.8, 'line-dasharray': [2, 1.5] },
      },
      {
        id: 'answer-point',
        type: 'circle',
        source: 'answer',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': ['case', ['==', ['get', 'kind'], 'peak'], 6, 7],
          'circle-color': ['match', ['get', 'kind'], 'ok', COLORS.correct, 'bad', COLORS.wrong, 'peak', '#5a3d23', '#18302f'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5,
        },
      },
      {
        id: 'answer-label',
        type: 'symbol',
        source: 'answer',
        filter: ['has', 'label'],
        layout: { 'text-field': ['get', 'label'], 'text-font': ['noto-bold'], 'text-size': 12, 'text-offset': [0, 1.3], 'text-anchor': 'top' },
        paint: { 'text-color': '#18302f', 'text-halo-color': COLORS.labelHalo, 'text-halo-width': 1.8 },
      },
      {
        id: 'numbers-circle',
        type: 'circle',
        source: 'numbers',
        paint: {
          'circle-radius': 12,
          'circle-color': ['match', ['get', 'state'], 'ok', COLORS.correct, 'bad', COLORS.wrong, 'active', COLORS.target, '#18302f'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      },
      {
        id: 'numbers-text',
        type: 'symbol',
        source: 'numbers',
        layout: { 'text-field': ['to-string', ['get', 'n']], 'text-font': ['noto-bold'], 'text-size': 13, 'text-allow-overlap': true, 'icon-allow-overlap': true },
        paint: { 'text-color': '#ffffff' },
      },
    ],
  };
}

/** Wzory (desenie) do mapy postępów – żeby nie polegać tylko na kolorze. */
export function makePatterns(): Record<string, ImageData> {
  const mk = (size: number, draw: (c: CanvasRenderingContext2D) => void) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d')!;
    draw(c);
    return c.getImageData(0, 0, size, size);
  };
  const stripes = mk(12, (c) => {
    c.strokeStyle = COLORS.due;
    c.lineWidth = 2.5;
    for (const o of [-12, 0, 12]) {
      c.beginPath();
      c.moveTo(o, 12);
      c.lineTo(o + 12, 0);
      c.stroke();
    }
  });
  const dots = mk(10, (c) => {
    c.fillStyle = COLORS.learning;
    c.beginPath();
    c.arc(5, 5, 2.2, 0, Math.PI * 2);
    c.fill();
  });
  const icon = (fill: string, glyph: 'check' | 'dot' | 'bang' | 'ring') =>
    mk(24, (c) => {
      c.beginPath();
      c.arc(12, 12, 10, 0, Math.PI * 2);
      c.fillStyle = glyph === 'ring' ? '#ffffff' : fill;
      c.fill();
      c.lineWidth = 2.5;
      c.strokeStyle = glyph === 'ring' ? fill : '#ffffff';
      c.stroke();
      c.strokeStyle = '#ffffff';
      c.fillStyle = '#ffffff';
      c.lineWidth = 2.6;
      c.lineCap = 'round';
      if (glyph === 'check') {
        c.beginPath();
        c.moveTo(7, 12.5);
        c.lineTo(10.5, 16);
        c.lineTo(17, 8.5);
        c.stroke();
      } else if (glyph === 'dot') {
        c.beginPath();
        c.arc(12, 12, 3.2, 0, Math.PI * 2);
        c.fill();
      } else if (glyph === 'bang') {
        c.beginPath();
        c.moveTo(12, 6.5);
        c.lineTo(12, 13);
        c.stroke();
        c.beginPath();
        c.arc(12, 17, 1.6, 0, Math.PI * 2);
        c.fill();
      }
    });
  return {
    'pat-due': stripes,
    'pat-learning': dots,
    'ico-mastered': icon(COLORS.mastered, 'check'),
    'ico-learning': icon(COLORS.learning, 'dot'),
    'ico-due': icon(COLORS.due, 'bang'),
    'ico-new': icon(COLORS.new, 'ring'),
  };
}
