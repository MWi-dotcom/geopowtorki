import { describe, expect, it } from 'vitest';
import { AnswerIndex, levenshtein, matchFact, normalize, parseNumber, splitSet } from '../src/core/answers';
import { FEATURES, FEATURE_BY_ID } from '../src/data/material';

const idx = new AnswerIndex(FEATURES);

describe('normalizacja', () => {
  it('usuwa polskie znaki, wielkość liter i myślniki', () => {
    expect(normalize('Huang-He')).toBe('huang he');
    expect(normalize('ŁADOGA')).toBe('ladoga');
    expect(normalize('  Góry   Skandynawskie ')).toBe('gory skandynawskie');
    expect(normalize('Cieśnina Drake’a')).toBe('ciesnina drake a');
  });
  it('levenshtein', () => {
    expect(levenshtein('kot', 'kto')).toBe(2);
    expect(levenshtein('alpy', 'alpy')).toBe(0);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('dopasowanie nazw obiektów', () => {
  it('dokładna nazwa i warianty', () => {
    expect(idx.matchFeature('Mont Blanc', 'eu-g-alpy').kind).toBe('wrong'); // to nie nazwa gór
    expect(idx.matchFeature('Alpy', 'eu-g-alpy').kind).toBe('exact');
    expect(idx.matchFeature('Huang He', 'az-r-huang-he').correct).toBe(true);
    expect(idx.matchFeature('Żółta Rzeka', 'az-r-huang-he').kind).toBe('exact');
    expect(idx.matchFeature('zolta rzeka', 'az-r-huang-he').kind).toBe('accent');
    expect(idx.matchFeature('Spitsbergen', 'eu-wy-svalbard').correct).toBe(true);
  });
  it('brak polskich znaków = poprawnie (accent)', () => {
    expect(idx.matchFeature('ladoga', 'eu-j-ladoga').kind).toBe('accent');
    expect(idx.matchFeature('Gory Skandynawskie', 'eu-g-skandynawskie').kind).toBe('accent');
  });
  it('drobne literówki', () => {
    expect(idx.matchFeature('Kaukas', 'eu-g-kaukaz').kind).toBe('typo');
    expect(idx.matchFeature('Skandynawsike', 'eu-g-skandynawskie').kind).toBe('typo');
    expect(idx.matchFeature('Ob', 'az-r-ob').kind).toBe('exact');
    expect(idx.matchFeature('Ab', 'az-r-ob').kind).toBe('wrong'); // krótkie słowa bez tolerancji
  });
  it('pominięcie słowa kategorii', () => {
    expect(idx.matchFeature('Skandynawskie', 'eu-g-skandynawskie').correct).toBe(true);
    expect(idx.matchFeature('Bałtyckie', 'eu-m-baltyckie').correct).toBe(true);
  });
  it('rdzeń kolidujący z innym obiektem nie jest akceptowany', () => {
    // „Orinoko” to rzeka – dla Niziny Orinoko trzeba wpisać pełną nazwę lub „Llanos”
    expect(idx.matchFeature('Orinoko', 'sp-n-orinoko').correct).toBe(false);
    expect(idx.matchFeature('Nizina Orinoko', 'sp-n-orinoko').correct).toBe(true);
  });
  it('wykrywa pomyłkę z innym obiektem', () => {
    const r = idx.matchFeature('Irtysz', 'az-r-ob');
    expect(r.correct).toBe(false);
    expect(r.otherId).toBe('az-r-irtysz');
    expect(idx.matchFeature('Morze Jońskie', 'eu-m-tyrrenskie').otherId).toBe('eu-m-jonskie');
  });
  it('ta sama nazwa (Ural – góry i rzeka) jest poprawna dla obu', () => {
    expect(idx.matchFeature('Ural', 'eu-g-ural').correct).toBe(true);
    expect(idx.matchFeature('Ural', 'eu-r-ural').correct).toBe(true);
  });
});

describe('fakty', () => {
  const alpy = FEATURE_BY_ID['eu-g-alpy'];
  const h = alpy.facts.find((f) => f.id === 'wysokosc')!;
  it('liczby z tolerancją', () => {
    expect(parseNumber('4 806 m n.p.m.')).toBe(4806);
    expect(parseNumber('4806,5')).toBe(4806.5);
    expect(matchFact('4806', h).kind).toBe('exact');
    expect(matchFact('4807', h).kind).toBe('typo');
    expect(matchFact('4807', h).correct).toBe(true);
    expect(matchFact('4600', h).correct).toBe(false);
    expect(matchFact('abc', h).correct).toBe(false);
  });
  it('tekst z wariantami', () => {
    const q = alpy.facts.find((f) => f.id === 'szczyt')!;
    expect(matchFact('Mount Blanc', q).correct).toBe(true);
    expect(matchFact('mont blank', q).kind).toBe('typo');
  });
  it('zbiory – wszystkie elementy, dowolna kolejność', () => {
    const laba = FEATURE_BY_ID['eu-r-laba'].facts[0];
    expect(splitSet('Niemcy i Czechy')).toEqual(['Niemcy', 'Czechy']);
    expect(matchFact('Niemcy, Czechy', laba).correct).toBe(true);
    expect(matchFact('niemcy czechy'.replace(' ', ', '), laba).correct).toBe(true);
    const part = matchFact('Niemcy', laba);
    expect(part.correct).toBe(false);
    expect(part.missing).toEqual(['Czechy']);
  });
  it('miasto nad rzeką', () => {
    const f = FEATURE_BY_ID['eu-r-dunaj'].facts.find((x) => x.q.includes('Budapeszt'))!;
    expect(matchFact('dunaj', f).correct).toBe(true);
    expect(matchFact('Wisła', f).correct).toBe(false);
  });
});

describe('liczby z wartościami alternatywnymi (Denali)', () => {
  it('6190 i 6194 są dokładne, 6170 – w tolerancji', async () => {
    const { FEATURE_BY_ID } = await import('../src/data/material');
    const f = Object.values(FEATURE_BY_ID).find((x) => x.namePl === 'Góry Alaska')!;
    const h = f.facts.find((x) => x.id === 'wysokosc')!;
    expect(matchFact('6190', h).kind).toBe('exact');
    expect(matchFact('6194 m n.p.m.', h).kind).toBe('exact');
    expect(matchFact('6170', h).correct).toBe(true);
    const name = f.facts.find((x) => x.id === 'szczyt')!;
    expect(matchFact('Mount McKinley', name).correct).toBe(true);
    expect(name.display).toBeUndefined();
  });
});
