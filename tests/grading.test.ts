import { describe, expect, it } from 'vitest';
import { Rating } from 'ts-fsrs';
import { gradeClick, ratingFromOutcome, toleranceKm } from '../src/core/grading';

describe('ocena kliknięć', () => {
  const square = { type: 'Polygon' as const, coordinates: [[[10, 50], [12, 50], [12, 52], [10, 52], [10, 50]]] };
  it('obszar: trafienie w środku = 0 km', () => {
    const r = gradeClick([11, 51], square, 'area', 5500);
    expect(r.correct).toBe(true);
    expect(r.distanceKm).toBe(0);
  });
  it('obszar: tuż obok – w buforze; daleko – pudło', () => {
    expect(gradeClick([12.3, 51], square, 'area', 5500).correct).toBe(true); // ~21 km
    const far = gradeClick([14, 51], square, 'area', 5500);
    expect(far.correct).toBe(false);
    expect(far.distanceKm).toBeGreaterThan(130);
    expect(far.distanceKm).toBeLessThan(150);
  });
  it('linia (rzeka): bufor wokół linii', () => {
    const river = { type: 'LineString' as const, coordinates: [[20, 50], [20, 55]] };
    expect(gradeClick([20.5, 52], river, 'line', 5500).correct).toBe(true); // ~34 km
    expect(gradeClick([22, 52], river, 'line', 5500).correct).toBe(false);
  });
  it('punkt: promień zależny od skali regionu', () => {
    expect(toleranceKm('point', 5500)).toBeCloseTo(137.5);
    expect(toleranceKm('point', 100000)).toBe(250);
    const cape = { type: 'Point' as const, coordinates: [20, -34.8] };
    expect(gradeClick([20.5, -34.5], cape, 'point', 8500).correct).toBe(true);
    expect(gradeClick([25, -34], cape, 'point', 8500).correct).toBe(false);
  });
  it('MultiPolygon i MultiLineString', () => {
    const mp = { type: 'MultiPolygon' as const, coordinates: [square.coordinates, [[[30, 50], [31, 50], [31, 51], [30, 51], [30, 50]]]] };
    expect(gradeClick([30.5, 50.5], mp, 'area', 5500).distanceKm).toBe(0);
    const ml = { type: 'MultiLineString' as const, coordinates: [[[0, 0], [1, 0]], [[5, 5], [6, 5]]] };
    expect(gradeClick([5.5, 5.1], ml, 'line', 5500).correct).toBe(true);
  });
});

describe('ocena FSRS z odpowiedzi', () => {
  it('pudło = Again', () => expect(ratingFromOutcome({ correct: false, ms: 1000 }, 'locate')).toBe(Rating.Again));
  it('literówka / podpowiedź / druga próba = Hard', () => {
    expect(ratingFromOutcome({ correct: true, ms: 1000, typo: true }, 'name')).toBe(Rating.Hard);
    expect(ratingFromOutcome({ correct: true, ms: 1000, helped: true }, 'name')).toBe(Rating.Hard);
    expect(ratingFromOutcome({ correct: true, ms: 1000, attempts: 2 }, 'name')).toBe(Rating.Hard);
  });
  it('szybko = Easy, wolno = Good, wybór z 4 = Good', () => {
    expect(ratingFromOutcome({ correct: true, ms: 2000 }, 'locate')).toBe(Rating.Easy);
    expect(ratingFromOutcome({ correct: true, ms: 20000 }, 'locate')).toBe(Rating.Good);
    expect(ratingFromOutcome({ correct: true, ms: 1000, multipleChoice: true }, 'name')).toBe(Rating.Good);
  });
});
