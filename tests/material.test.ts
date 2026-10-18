import { describe, expect, it } from 'vitest';
import geoIndex from '../src/data/geo-index.json';
import { FEATURES } from '../src/data/material';
import { DECKS } from '../src/data/meta';

describe('materiał', () => {
  it('unikalne id obiektów i faktów', () => {
    expect(new Set(FEATURES.map((f) => f.id)).size).toBe(FEATURES.length);
    for (const f of FEATURES) expect(new Set(f.facts.map((x) => x.id)).size).toBe(f.facts.length);
  });
  it('każdy obiekt ma geometrię w indeksie', () => {
    const idx = geoIndex.features as Record<string, unknown>;
    for (const f of FEATURES) expect(idx[f.id], f.id).toBeTruthy();
  });
  it('rodzic istnieje i ma tę samą kategorię', () => {
    for (const f of FEATURES.filter((x) => x.parent)) {
      const p = FEATURES.find((x) => x.id === f.parent);
      expect(p, f.id).toBeTruthy();
      expect(p!.category).toBe(f.category);
    }
  });
  it('fakty liczbowe mają tolerancję, fakty typu set – listę', () => {
    for (const f of FEATURES)
      for (const fa of f.facts) {
        if (fa.type === 'number') expect(fa.tolerance).toBeGreaterThan(0);
        if (fa.type === 'set') expect(fa.a.split(';').length).toBeGreaterThan(1);
      }
  });
  it('partie obejmują wszystkie kontynenty', () => {
    expect(new Set(DECKS.map((d) => d.continents![0])).size).toBe(7);
  });
  it('wysokości szczytów zgodne z materiałem (z poprawkami uzgodnionymi z autorem)', () => {
    const h = Object.fromEntries(FEATURES.flatMap((f) => f.facts.filter((x) => x.id === 'wysokosc').map((x) => [f.id, Number(x.a)])));
    expect(h).toMatchObject({
      'eu-g-alpy': 4806,
      'az-g-himalaje': 8848,
      'af-w-wschodnioafrykanska': 5895,
      'au-g-wododzialowe': 2230,
      'an-g-ellswortha': 4892,
      'np-g-alaska': 6194, // aktualny pomiar 6190 – zaliczany jako dokładny
      'az-g-karakorum': 8611,
      'sp-g-andy': 6962,
    });
  });
});
