import type { CategoryId, ContinentId, Deck } from '../core/types';
import { FEATURES } from './material';

export const CONTINENTS: { id: ContinentId; name: string; short: string }[] = [
  { id: 'europa', name: 'Europa', short: 'Europa' },
  { id: 'azja', name: 'Azja', short: 'Azja' },
  { id: 'afryka', name: 'Afryka', short: 'Afryka' },
  { id: 'australia', name: 'Australia i Oceania', short: 'Australia' },
  { id: 'antarktyda', name: 'Antarktyda', short: 'Antarktyda' },
  { id: 'ameryka-pn', name: 'Ameryka Północna', short: 'Am. Pn.' },
  { id: 'ameryka-pd', name: 'Ameryka Południowa', short: 'Am. Pd.' },
];

export const CATEGORIES: { id: CategoryId; name: string; one: string }[] = [
  { id: 'gory', name: 'Góry', one: 'góry' },
  { id: 'wyzyny', name: 'Wyżyny', one: 'wyżyna' },
  { id: 'niziny', name: 'Niziny', one: 'nizina' },
  { id: 'kotliny', name: 'Kotliny', one: 'kotlina' },
  { id: 'rzeki', name: 'Rzeki', one: 'rzeka' },
  { id: 'jeziora', name: 'Jeziora', one: 'jezioro' },
  { id: 'polwyspy', name: 'Półwyspy', one: 'półwysep' },
  { id: 'przyladki', name: 'Przylądki', one: 'przylądek' },
  { id: 'wyspy', name: 'Wyspy', one: 'wyspa / archipelag' },
  { id: 'morza', name: 'Morza, zatoki, cieśniny', one: 'morze / zatoka / cieśnina' },
  { id: 'ziemie', name: 'Ziemie i regiony', one: 'ziemia / region' },
  { id: 'lodowce', name: 'Lodowce szelfowe', one: 'lodowiec szelfowy' },
];

export const continentName = (id: ContinentId) => CONTINENTS.find((c) => c.id === id)!.name;
export const categoryName = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!.name;
export const categoryOne = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!.one;

/**
 * Widoki mapy. Wszystkie kontynenty w rzucie „globe” (MapLibre) – mniejsze
 * zniekształcenia niż Mercator i naturalny widok Antarktydy z nad bieguna.
 */
export type MapView = { bounds: [number, number, number, number] } | { center: [number, number]; zoom: number };
export const VIEWS: Record<ContinentId | 'swiat', MapView> = {
  swiat: { center: [15, 20], zoom: 1.2 },
  europa: { bounds: [-25, 34, 62, 72] },
  azja: { bounds: [26, -11, 180, 78] },
  afryka: { bounds: [-26, -36, 64, 38] },
  australia: { bounds: [110, -48, 182, 0] },
  // globus kompensuje skalę wg szerokości środka widoku (1/cos φ) – dlatego środek
  // nie na samym biegunie i mały zoom (dobrane dla okna ok. 760 px)
  antarktyda: { center: [0, -80], zoom: 0.75 },
  'ameryka-pn': { bounds: [-170, 8, -12, 83] },
  'ameryka-pd': { bounds: [-92, -57, -30, 13] },
};

/** Przybliżona przekątna regionu (km) – do tolerancji kliknięć. */
export const REGION_KM: Record<ContinentId | 'swiat', number> = {
  swiat: 15000,
  europa: 5500,
  azja: 10000,
  afryka: 8500,
  australia: 6500,
  antarktyda: 5500,
  'ameryka-pn': 8500,
  'ameryka-pd': 7500,
};

/** Wszystkie partie: kontynent × kategoria (tylko niepuste). */
export const DECKS: Deck[] = CONTINENTS.flatMap((c) =>
  CATEGORIES.filter((k) => FEATURES.some((f) => (f.continent === c.id || f.alsoIn?.includes(c.id)) && f.category === k.id)).map((k) => ({
    id: `${c.id}:${k.id}`,
    name: `${c.name} – ${k.name.toLowerCase()}`,
    continents: [c.id],
    categories: [k.id],
  })),
);

/** Id partii: "europa:gory", "europa:*" (cały kontynent), "*:jeziora" (kategoria wszędzie), "*:*". */
export function deckFromId(id: string): Deck {
  const [c, k] = id.split(':') as [string, string];
  const continents = c === '*' ? undefined : [c as ContinentId];
  const categories = k === '*' ? undefined : [k as CategoryId];
  const cName = c === '*' ? 'Wszystkie kontynenty' : continentName(c as ContinentId);
  const kName = k === '*' ? 'wszystko' : categoryName(k as CategoryId).toLowerCase();
  return { id, name: `${cName} – ${kName}`, continents, categories };
}

export function deckFeatureIds(deck: Deck): string[] {
  if (deck.featureIds) return deck.featureIds;
  return FEATURES.filter(
    (f) =>
      (!deck.continents || deck.continents.some((c) => f.continent === c || f.alsoIn?.includes(c))) &&
      (!deck.categories || deck.categories.includes(f.category)),
  ).map((f) => f.id);
}

/** Widok mapy dla partii: jeden kontynent → jego widok, inaczej świat. */
export function deckRegion(deck: Deck): ContinentId | 'swiat' {
  return deck.continents?.length === 1 ? deck.continents[0] : 'swiat';
}

export function deckIdsRegion(ids: string[]): ContinentId | 'swiat' {
  const cs = new Set(ids.map((i) => deckFromId(i).continents?.[0] ?? '*'));
  if (cs.size === 1) {
    const c = [...cs][0];
    return c === '*' ? 'swiat' : (c as ContinentId);
  }
  return 'swiat';
}
