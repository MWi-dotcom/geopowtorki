/**
 * Dopasowanie wpisanych odpowiedzi.
 * Tolerujemy: wielkość liter, brak polskich znaków, myślniki/apostrofy/kropki,
 * drobne literówki (odległość Levenshteina) i pominięcie słowa kategorii
 * („Skandynawskie” zamiast „Góry Skandynawskie”), o ile nie koliduje to
 * z nazwą innego obiektu.
 */
import type { Fact, Feature } from './types';

export type MatchKind = 'exact' | 'accent' | 'typo' | 'wrong';

export interface MatchResult {
  kind: MatchKind;
  /** Czy odpowiedź liczymy jako poprawną (exact/accent/typo). */
  correct: boolean;
  /** Poprawny zapis do pokazania. */
  canonical: string;
  /** Gdy odpowiedź pasuje do innego obiektu – jego id (do wykrywania pomyłek). */
  otherId?: string;
}

const PL: Record<string, string> = { ł: 'l', Ł: 'l' };

/** Normalizacja: małe litery, bez diakrytyków, bez interpunkcji, pojedyncze spacje. */
export function normalize(s: string): string {
  return s
    .replace(/[łŁ]/g, (c) => PL[c])
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[-–—'’`´".,;:!?()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lekka normalizacja – zachowuje polskie znaki (do rozróżnienia exact vs accent). */
function lightNorm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-–—'’`´".,;:!?()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Ile literówek dopuszczamy dla słowa danej długości (po normalizacji, bez spacji). */
export function allowedTypos(len: number): number {
  if (len <= 4) return 0;
  if (len <= 7) return 1;
  return 2;
}

/** Słowa kategorii, które uczeń może pominąć na początku nazwy. */
const CATEGORY_WORDS = [
  'lodowiec szelfowy',
  'gory',
  'gora',
  'pasmo',
  'wyzyna',
  'nizina',
  'kotlina',
  'jezioro',
  'morze',
  'zatoka',
  'polwysep',
  'przyladek',
  'wyspy',
  'wyspa',
  'ciesnina',
  'kanal',
  'lodowiec',
  'rzeka',
  'masyw',
];

export function stripCategory(norm: string): string {
  let s = norm;
  let changed = true;
  while (changed) {
    changed = false;
    for (const w of CATEGORY_WORDS) {
      if (s.startsWith(w + ' ')) {
        s = s.slice(w.length + 1);
        changed = true;
      }
    }
  }
  return s;
}

const compact = (s: string) => s.replace(/ /g, '');

interface Form {
  /** forma do porównań (normalize) */
  norm: string;
  /** forma lekka (z polskimi znakami) */
  light: string;
  /** czy to forma „rdzeń” (bez słowa kategorii) */
  core: boolean;
}

/** Zbiór akceptowanych form dla każdego obiektu – budowany raz dla całego materiału. */
export class AnswerIndex {
  private forms = new Map<string, Form[]>();
  /** forma znormalizowana → id obiektów, które ją akceptują (do wykrywania pomyłek) */
  private owners = new Map<string, Set<string>>();
  private canonical = new Map<string, string>();

  constructor(features: Feature[]) {
    const full = new Map<string, Set<string>>();
    const names = new Map<string, string[]>();
    for (const f of features) {
      const all = [f.namePl, ...f.aliases];
      names.set(f.id, all);
      this.canonical.set(f.id, f.namePl);
      for (const n of all) {
        const k = normalize(n);
        if (!full.has(k)) full.set(k, new Set());
        full.get(k)!.add(f.id);
      }
    }
    // rdzenie: dodajemy tylko, gdy nie kolidują z nazwą innego obiektu
    const cores = new Map<string, Set<string>>();
    for (const [id, all] of names) {
      for (const n of all) {
        const c = stripCategory(normalize(n));
        if (c !== normalize(n) && c.length >= 3) {
          if (!cores.has(c)) cores.set(c, new Set());
          cores.get(c)!.add(id);
        }
      }
    }
    for (const [id, all] of names) {
      const list: Form[] = [];
      for (const n of all) {
        const norm = normalize(n);
        list.push({ norm, light: lightNorm(n), core: false });
        const c = stripCategory(norm);
        if (c !== norm && c.length >= 3) {
          const fullOwners = full.get(c);
          const coreOwners = cores.get(c)!;
          const collides = (fullOwners && [...fullOwners].some((o) => o !== id)) || [...coreOwners].some((o) => o !== id);
          if (!collides) list.push({ norm: c, light: c, core: true });
        }
      }
      this.forms.set(id, list);
      for (const fm of list) {
        if (!this.owners.has(fm.norm)) this.owners.set(fm.norm, new Set());
        this.owners.get(fm.norm)!.add(id);
      }
    }
  }

  /** Dopasowanie nazwy obiektu (ćwiczenie „Co to jest?” i mapa konturowa). */
  matchFeature(input: string, featureId: string): MatchResult {
    const canonical = this.canonical.get(featureId) ?? '';
    const forms = this.forms.get(featureId) ?? [];
    const res = matchForms(input, forms, canonical);
    if (res.kind !== 'wrong') {
      // literówka, która dokładnie pasuje do innego obiektu, to pomyłka, nie literówka
      if (res.kind === 'typo') {
        const other = this.exactOwner(input, featureId);
        if (other) return { kind: 'wrong', correct: false, canonical, otherId: other };
      }
      return res;
    }
    return { ...res, otherId: this.exactOwner(input, featureId) ?? this.typoOwner(input, featureId) };
  }

  /** Id innego obiektu, którego nazwę dokładnie wpisano. */
  private exactOwner(input: string, notId: string): string | undefined {
    const n = normalize(input);
    const owners = this.owners.get(n);
    if (!owners) return undefined;
    // jeśli nazwę ma też obiekt docelowy (np. „Ural” – góry i rzeka), to nie jest pomyłka
    if (owners.has(notId)) return undefined;
    return [...owners][0];
  }

  private typoOwner(input: string, notId: string): string | undefined {
    const n = compact(normalize(input));
    if (n.length < 5) return undefined;
    for (const [form, owners] of this.owners) {
      if (owners.has(notId)) continue;
      const fc = compact(form);
      if (Math.abs(fc.length - n.length) <= 2 && levenshtein(fc, n) <= allowedTypos(fc.length)) return [...owners][0];
    }
    return undefined;
  }

  /** Który obiekt (inny niż notId) ma taką nazwę – np. do wykrycia „pomylił z…”. */
  findByName(input: string): string | undefined {
    const owners = this.owners.get(normalize(input));
    return owners ? [...owners][0] : undefined;
  }
}

function matchForms(input: string, forms: Form[], canonical: string): MatchResult {
  const light = lightNorm(input);
  const norm = normalize(input);
  if (!norm) return { kind: 'wrong', correct: false, canonical };
  if (forms.some((f) => !f.core && f.light === light)) return { kind: 'exact', correct: true, canonical };
  if (forms.some((f) => f.norm === norm)) return { kind: 'accent', correct: true, canonical };
  const n = compact(norm);
  let best = Infinity;
  let bestAllowed = 0;
  for (const f of forms) {
    const fc = compact(f.norm);
    const d = levenshtein(fc, n);
    if (d < best) {
      best = d;
      bestAllowed = allowedTypos(fc.length);
    }
  }
  if (best <= bestAllowed) return { kind: 'typo', correct: true, canonical };
  return { kind: 'wrong', correct: false, canonical };
}

/** Prosta lista form dla faktu tekstowego. */
function factForms(values: string[]): Form[] {
  const list: Form[] = [];
  for (const v of values) {
    const norm = normalize(v);
    list.push({ norm, light: lightNorm(v), core: false });
    const c = stripCategory(norm);
    if (c !== norm && c.length >= 3) list.push({ norm: c, light: c, core: true });
  }
  return list;
}

export interface FactResult extends MatchResult {
  /** dla „set” – brakujące elementy */
  missing?: string[];
  /** dla liczb – odchylenie */
  delta?: number;
}

/** Parsuje liczbę z odpowiedzi typu „4 806 m n.p.m.” lub „4806,5”. */
export function parseNumber(input: string): number | null {
  const cleaned = input
    .replace(/m\s*n\.?\s*p\.?\s*m\.?/gi, '')
    .replace(/\s| /g, '')
    .replace(/[^\d.,-]/g, '')
    .replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Dzieli odpowiedź „Czechy, Niemcy i Polska” na elementy. */
export function splitSet(input: string): string[] {
  return input
    .split(/[,;/\n+]|\s+i\s+|\s+oraz\s+|\s+&\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function matchFact(input: string, fact: Fact): FactResult {
  if (fact.type === 'number') {
    const v = parseNumber(input);
    const target = Number(fact.a);
    if (v === null) return { kind: 'wrong', correct: false, canonical: fact.a };
    const delta = v - target;
    const tol = fact.tolerance ?? 0;
    if (delta === 0) return { kind: 'exact', correct: true, canonical: fact.a, delta };
    if (Math.abs(delta) <= tol) return { kind: 'typo', correct: true, canonical: fact.a, delta };
    return { kind: 'wrong', correct: false, canonical: fact.a, delta };
  }
  if (fact.type === 'set') {
    const required = fact.a.split(';').map((s) => s.trim());
    const parts = splitSet(input);
    const missing: string[] = [];
    let anyTypo = false;
    let anyAccent = false;
    for (const req of required) {
      const forms = factForms([req]);
      let found: MatchResult | null = null;
      for (const p of parts) {
        const r = matchForms(p, forms, req);
        if (r.correct && (!found || rank(r.kind) < rank(found.kind))) found = r;
      }
      if (!found) missing.push(req);
      else if (found.kind === 'typo') anyTypo = true;
      else if (found.kind === 'accent') anyAccent = true;
    }
    const canonical = required.join(', ');
    if (missing.length) return { kind: 'wrong', correct: false, canonical, missing };
    return { kind: anyTypo ? 'typo' : anyAccent ? 'accent' : 'exact', correct: true, canonical, missing: [] };
  }
  return matchForms(input, factForms([fact.a, ...(fact.aliases ?? [])]), fact.a);
}

const rank = (k: MatchKind) => ({ exact: 0, accent: 1, typo: 2, wrong: 3 })[k];
