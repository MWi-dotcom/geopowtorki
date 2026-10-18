/**
 * Kuratorowana lista filmów edukacyjnych z YouTube.
 *
 * ZASADA: nie wpisujemy adresów „z pamięci”. Każdy link dodaje człowiek po
 * obejrzeniu filmu i sprawdzeniu, że działa i pasuje do tematu.
 * Filmy można też dodawać w aplikacji (Ustawienia → Filmy) – trafiają wtedy
 * tylko do tej przeglądarki; tutaj wpisujemy te, które mają być dla wszystkich.
 *
 * target: 'deck'    – id partii, np. 'azja:gory', 'europa:*'
 *         'feature' – id obiektu z src/data/material.ts, np. 'az-g-himalaje'
 *
 * Przykład wpisu:
 *   { target: 'deck', id: 'azja:gory', url: 'https://www.youtube.com/watch?v=XXXXXXXXXXX', title: 'Góry Azji' },
 */
export interface CuratedVideo {
  target: 'feature' | 'deck';
  id: string;
  url: string;
  title: string;
}

export const CURATED_VIDEOS: CuratedVideo[] = [];
