# GeoPowtórki 🌍

Aplikacja webowa do nauki i trwałego zapamiętania **mapy fizycznej świata**
(zakres 1 klasy liceum): góry, wyżyny, niziny, kotliny, rzeki, jeziora,
półwyspy, przylądki, wyspy, morza i cieśniny wszystkich kontynentów –
**272 obiekty i 48 faktów** (wysokości szczytów, miasta nad rzekami, państwa).

Nauka opiera się na **powtórkach rozłożonych w czasie (FSRS)**. Aplikacja
działa w przeglądarce na telefonie i komputerze, **bez logowania i offline**
(PWA); postępy zapisują się lokalnie w przeglądarce.

**Autor:** Marcin Wyrzykowski · © 2026 Marcin Wyrzykowski – patrz [LICENSE](LICENSE).

---

## Co potrafi

- **Powtórz na dziś** – zaległe powtórki + limit nowych obiektów (domyślnie 10).
- **Typy ćwiczeń**
  - *Wskaż na mapie* – klik/stuknięcie na mapie niemej; tolerancja zależna od
    skali (punkt – promień, rzeka – bufor wokół linii, obszar – trafienie w
    wielokąt z małym buforem). Po odpowiedzi „przelot” do obiektu i odległość
    od kliknięcia.
  - *Co to jest?* – podświetlony obiekt, wybór z 4 opcji (klawisze 1–4) albo
    wpisanie nazwy; dystraktory z tej samej kategorii i regionu.
  - *Mapa konturowa* – jak na kartkówce: ponumerowane obiekty, wynik i omówienie na końcu.
  - *Fakty* – np. „Wysokość Mont Blanc?”, „Nad jaką rzeką leży Budapeszt?”.
- **Tolerancja odpowiedzi** – wielkość liter, brak polskich znaków, myślniki,
  drobne literówki (Levenshtein), warianty nazw; wysokości z małą tolerancją.
  Zawsze pokazywany jest poprawny zapis; przycisk „to była literówka”.
- **Przed sprawdzianem** – wybór partii i daty; plan rozkłada materiał do tego
  dnia, a ostatnia sesja to pełny przegląd. Harmonogram długoterminowy nie jest psuty.
- **Mylone pary** (np. Ob/Irtysz, Huron/Michigan) wykrywane z historii odpowiedzi i ćwiczone razem.
- **Przeglądaj mapę** – mapa z etykietami; klik w obiekt: nazwa, fakty, stan opanowania, filmy.
- **Postępy** – kontynenty × kategorie, seria dni, kalendarz aktywności, prognoza
  powtórek na 7 dni, gotowość do sprawdzianu, najsłabsze obiekty, mapa postępów
  (kolor + deseń/ikona – nie tylko kolor).
- **Filmy z YouTube** – kuratorowana lista (`src/data/videos.ts`) lub formularz w
  Ustawieniach; osadzanie przez youtube-nocookie.com dopiero po kliknięciu.
  Bez przypisanego filmu – link do wyszukiwania na YouTube.
- Tryb ciemny, obsługa klawiatury (Enter, 1–4) i gestów, eksport/import postępów.

## Uruchomienie lokalne

Wymagany Node.js 22+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testy (Vitest): powtórki, ocena kliknięć, dopasowanie odpowiedzi, materiał
npm run build      # wersja produkcyjna w dist/
npm run preview    # podgląd wersji produkcyjnej
```

## Publikacja na GitHub Pages

1. Utwórz repozytorium na GitHubie (np. `geopowtorki`) i wypchnij kod:
   ```bash
   git remote add origin https://github.com/<użytkownik>/geopowtorki.git
   git push -u origin main
   ```
2. W repozytorium: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Workflow `.github/workflows/deploy.yml` przy każdym pushu do `main` uruchomi
   testy, zbuduje aplikację i opublikuje ją pod adresem
   `https://<użytkownik>.github.io/<repozytorium>/`.

Ścieżkę bazową ustawia zmienna `BASE_PATH` (workflow robi to automatycznie z
nazwy repozytorium). Routing działa na hashu (`#/mapa`), więc nie trzeba
konfigurować serwera. Wszystkie dane (geometrie, kafelki reliefu, fonty) są w
repozytorium – aplikacja nie korzysta z żadnych zewnętrznych serwerów map.

## Dane

- `src/data/material.ts` – materiał: nazwy polskie + warianty, kategorie, fakty,
  mapowanie na nazwy angielskie z Natural Earth, uwagi `needsVerification`.
- `public/data/geo/*.json` – geometrie per kontynent (ładowane leniwie),
  generowane skryptem:
  ```bash
  bash scripts/fetch-ne.sh     # pobiera warstwy Natural Earth do .ne/
  npm run data:build           # buduje public/data/geo/*.json i docs/BRAKI_GEOMETRII.md
  ```
- `public/tiles/hyp/` – kafelki tła (relief + kolorystyka hipsometryczna,
  zoom 0–5) z rastra Natural Earth HYP_50M_SR_W: `npm run data:tiles -- <plik.tif> public/tiles/hyp`.
- [docs/ROZBIEZNOSCI.md](docs/ROZBIEZNOSCI.md) – rozbieżności z materiałem nauczyciela.
- [docs/BRAKI_GEOMETRII.md](docs/BRAKI_GEOMETRII.md) – obiekty bez geometrii w Natural Earth (przybliżone).
- [ATTRIBUTIONS.md](ATTRIBUTIONS.md) – źródła i licencje.

## Decyzje projektowe

- **MapLibre GL JS zamiast Leaflet** – WebGL (płynne przybliżanie i
  „przeloty” na telefonie), styl wektorowy z wyrażeniami (podświetlenia,
  kolorowanie postępów, desenie) bez przebudowy warstw, a przede wszystkim
  **widok globusa** – dzięki niemu Antarktyda wygląda poprawnie (widok
  biegunowy), czego Leaflet w Mercatorze nie zapewni.
- **FSRS (ts-fsrs)** – retencja docelowa 90% (do zmiany w Ustawieniach),
  maks. odstęp 180 dni (rok szkolny), kroki nauki 1 i 10 min (nowe obiekty
  wracają w tej samej sesji), fuzz. Jednostką powtórki jest para
  *obiekt × umiejętność* (wskaż / nazwij / fakt). Ocena wynika z odpowiedzi:
  pudło → *Again*; trafienie z literówką, po podpowiedzi lub w kolejnej próbie
  → *Hard*; trafienie (lub wybór z 4 opcji) → *Good*; szybkie trafienie bez
  listy opcji → *Easy*.
- **Dane lokalne (IndexedDB, Dexie)** – bez kont; kopia zapasowa przez eksport/import w Ustawieniach.
- **Logika oddzielona od UI** – `src/core/` (powtórki, sesja, ocena, dopasowanie
  odpowiedzi, statystyki) to czyste funkcje testowane w `tests/`.

## Struktura

```
src/
  core/        logika: scheduler (FSRS), session, grading, answers, stats, types
  data/        materiał, partie, filmy, informacje o autorze
  map/         komponent mapy MapLibre i styl
  screens/     ekrany: start, sesja, partie, mapa, konturowa, sprawdzian, postępy, ustawienia
  components/  elementy UI, miniatury mapy, filmy
  lib/         router, ustawienia, ładowanie geometrii
scripts/       budowanie danych z Natural Earth i kafelków tła
tests/         testy Vitest
```

## Autor i licencja

Autor: **Marcin Wyrzykowski**. © 2026 Marcin Wyrzykowski. Wszelkie prawa
zastrzeżone – szczegóły w [LICENSE](LICENSE). Dane Natural Earth są w domenie
publicznej; licencje bibliotek i fontów – w [ATTRIBUTIONS.md](ATTRIBUTIONS.md).
