# Atrybucje i licencje

Kod aplikacji: © 2026 Marcin Wyrzykowski – patrz [LICENSE](LICENSE).

## Dane i grafika

| Co | Źródło | Licencja |
|---|---|---|
| Geometrie obiektów (góry, niziny, morza, rzeki, jeziora, wyspy, lodowce szelfowe, punkty wysokościowe) | [Natural Earth](https://www.naturalearthdata.com/) – warstwy 1:10m: `geography_regions_polys`, `geography_regions_points`, `geography_regions_elevation_points`, `geography_marine_polys`, `rivers_lake_centerlines`, `lakes`, `lakes_historic`, `antarctic_ice_shelves_polys` (pobierane z [nvkelso/natural-earth-vector](https://github.com/nvkelso/natural-earth-vector)) | Domena publiczna. Atrybucja niewymagana, ale mile widziana: „Made with Natural Earth”. |
| Tło mapy – relief cieniowany z kolorystyką hipsometryczną (`public/tiles/hyp`) | Natural Earth – raster **HYP_50M_SR_W** („Cross Blended Hypso with Shaded Relief and Water”), przeliczony do kafelków XYZ skryptem `scripts/make_tiles.py` | Domena publiczna |
| Fonty etykiet mapy (`public/fonts`, glify PBF) | Noto Sans – Google | SIL Open Font License 1.1 |
| Polskie nazwy obiektów, fakty | Materiał nauczyciela („Zakres materiału 001”), mapowanie nazw na Natural Earth w `src/data/material.ts` | – |

## Biblioteki

| Biblioteka | Po co | Licencja |
|---|---|---|
| [MapLibre GL JS](https://maplibre.org/) | mapa (WebGL, widok globusa – także dla Antarktydy) | BSD-3-Clause |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | algorytm powtórek FSRS | MIT |
| [Turf.js](https://turfjs.org/) | odległości, bufor, punkt w poligonie | MIT |
| [Dexie](https://dexie.org/) + dexie-react-hooks | dane ucznia w IndexedDB | Apache-2.0 |
| [React](https://react.dev/) | interfejs | MIT |
| [Tailwind CSS](https://tailwindcss.com/) | style | MIT |
| [Vite](https://vite.dev/), [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (Workbox) | build, działanie offline | MIT |
| [Vitest](https://vitest.dev/), fake-indexeddb | testy | MIT / Apache-2.0 |

## Filmy

Aplikacja nie zawiera żadnych filmów. Filmy z YouTube dodaje ręcznie
użytkownik (lista w `src/data/videos.ts` lub formularz w Ustawieniach) i są
osadzane przez `youtube-nocookie.com` dopiero po kliknięciu. Prawa do filmów
należą do ich autorów.
