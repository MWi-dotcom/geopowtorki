/**
 * Typy domenowe aplikacji GeoPowtórki.
 * Ten plik nie zależy od React ani MapLibre – używa go logika w src/core,
 * UI oraz skrypt budujący dane (scripts/build-data.ts).
 */

export type ContinentId =
  | 'europa'
  | 'azja'
  | 'afryka'
  | 'australia'
  | 'antarktyda'
  | 'ameryka-pn'
  | 'ameryka-pd';

export type CategoryId =
  | 'gory'
  | 'wyzyny'
  | 'niziny'
  | 'kotliny'
  | 'rzeki'
  | 'jeziora'
  | 'polwyspy'
  | 'przyladki'
  | 'wyspy'
  | 'morza'
  | 'ziemie'
  | 'lodowce';

export type GeometryType = 'point' | 'line' | 'area';

/** text – jedna odpowiedź; number – liczba z tolerancją; set – lista elementów (wszystkie wymagane). */
export type FactType = 'text' | 'number' | 'set';

export interface Fact {
  /** Unikalne w obrębie obiektu, np. "szczyt", "wysokosc", "miasto-wieden". */
  id: string;
  q: string;
  /** Odpowiedź wzorcowa. Dla typu "set" elementy rozdzielone średnikiem. */
  a: string;
  aliases?: string[];
  type: FactType;
  unit?: string;
  /** Tolerancja dla liczb (w jednostkach odpowiedzi). */
  tolerance?: number;
  needsVerification?: boolean;
  note?: string;
  /** Nazwa punktu wysokościowego w Natural Earth – skrypt danych dopisze współrzędne. */
  peakRef?: string;
}

export interface Video {
  url: string;
  title: string;
}

/** Źródło geometrii w Natural Earth (używane tylko przez scripts/build-data.ts). */
export type NeLayer = 'reg' | 'mar' | 'cape' | 'peak' | 'riv' | 'lake' | 'ice' | 'hist';
export interface GeoSource {
  l: NeLayer;
  /** Wartość pola NAME/name w warstwie Natural Earth. */
  n: string;
}

export interface Feature {
  id: string;
  namePl: string;
  /** Etykieta wyświetlana, gdy nazwa się powtarza (np. „Ural (rzeka)”). */
  label?: string;
  aliases: string[];
  continent: ContinentId;
  /** Obiekty wspólne dla kilku kontynentów w materiale (np. Morze Czerwone). */
  alsoIn?: ContinentId[];
  category: CategoryId;
  facts: Fact[];
  videos: Video[];
  needsVerification: boolean;
  note?: string;
  /** Obiekt nadrzędny (np. Majorka → Baleary). */
  parent?: string;

  // --- definicja geometrii (skrypt danych) ---
  src?: GeoSource[];
  /** Punkt [lon, lat] – gdy brak obiektu w Natural Earth. */
  pt?: [number, number];
  /** Promień (km) obszaru przybliżonego punktem; bez r punkt jest punktem. */
  r?: number;
  /** Przycięcie geometrii z Natural Earth do prostokąta [minLon, minLat, maxLon, maxLat]. */
  clip?: [number, number, number, number];
  /** Linia wpisana ręcznie [lon, lat][]. */
  line?: [number, number][];
  /** Dodatkowa warstwa „dawny zasięg” (np. Jezioro Aralskie). */
  historic?: GeoSource[];
}

/** Metadane geometrii wygenerowane przez skrypt danych (src/data/geo-index.json). */
export interface GeoMeta {
  t: GeometryType;
  /** bbox [minLon, minLat, maxLon, maxLat] */
  b: [number, number, number, number];
  /** punkt etykiety / środek [lon, lat] */
  c: [number, number];
  /** geometria przybliżona (punkt/okrąg lub linia wpisana ręcznie) */
  approx?: boolean;
  /** przybliżona „wielkość” obiektu w km (do tolerancji) */
  size: number;
}

export type Skill = 'locate' | 'name' | `fact:${string}`;

export interface Deck {
  id: string;
  name: string;
  continents?: ContinentId[];
  categories?: CategoryId[];
  featureIds?: string[];
}

export interface Exam {
  id?: number;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  deckIds: string[];
  createdAt: number;
}
