# Rozbieżności i elementy do weryfikacji w materiale

Źródło materiału: „Zakres materiału 001” (materiał nauczyciela).
Zasada: **w aplikacji domyślnie obowiązuje wersja nauczyciela.** Poniżej wynik
sprawdzenia; fakty, które mogą się różnić od innych źródeł, mają w danych
`needsVerification: true`, a w aplikacji uczeń widzi przy nich notatkę.

## Elementy oznaczone przez nauczyciela [do weryfikacji]

| Obiekt | Wersja nauczyciela | Wynik sprawdzenia | Co robi aplikacja |
|---|---|---|---|
| Pamir | leży w Kirgistanie | Pamir leży głównie w **Tadżykistanie**; obejmuje też Kirgistan, Afganistan i Chiny. | Pytanie o państwo przyjmuje „Kirgistan” (wersja nauczyciela), z notatką. |
| Karakorum | Tadżykistan / Chiny; K2 | Karakorum leży w **Pakistanie, Indiach (Kaszmir) i Chinach** – nie w Tadżykistanie (tam jest Pamir). K2 – zgadza się. | Odpowiedź wg nauczyciela, z notatką. **Warto dopytać nauczyciela – wygląda na pomyłkę.** |
| Himalaje | Nepal, Bhutan; Mount Everest 8848 m | Himalaje leżą też w Indiach, Chinach i Pakistanie. Wysokość Everestu wg pomiaru Chin i Nepalu z 2020 r.: 8848,86 m – 8848 m jest poprawne po zaokrągleniu. | Akceptowane 8848 m (z tolerancją), notatka o pozostałych państwach. |
| Góry Alaska | Denali / McKinley 6194 m | 6194 m to dawna wartość; pomiar z 2015 r. podaje ok. 6190 m. W 2025 r. władze federalne USA przywróciły nazwę Mount McKinley, stan Alaska używa nazwy Denali. | Przyjmowane obie nazwy; 6194 m z tolerancją obejmującą 6190 m. |
| Dunaj | „Buka*” (niejasny zapis) | Nie da się jednoznacznie odczytać. Możliwe, że chodzi o **Bukareszt** – ale Bukareszt **nie leży nad Dunajem** (leży nad Dâmboviţą). | Nie zamieniono na pytanie. **Do wyjaśnienia z nauczycielem.** |

## Inne uwagi z weryfikacji (bez zmiany wersji nauczyciela)

- **Góra Kościuszki** – Geoscience Australia podaje 2228 m n.p.m.; 2230 m to wartość zaokrąglona. Obie mieszczą się w tolerancji.
- **Aconcagua** – w źródłach 6961–6962 m n.p.m., zależnie od pomiaru; obie wartości są akceptowane.
- **Azja Mniejsza** – w materiale wymieniona przy Europie; geograficznie półwysep leży w Azji. W aplikacji jest w partii „Europa – półwyspy”, z notatką.
- **Przylądek Biały** – chodzi o północny kraniec Afryki (Tunezja). Uwaga: inny Przylądek Biały (Ras Nawazibu) leży w Mauretanii.
- **Jezioro Aralskie** – na mapie przerywaną linią zaznaczono dawny zasięg (warstwa „historic lakes” z Natural Earth), żeby było widać, że w dużej mierze wyschło.

## Obiekty z przybliżoną geometrią

Pełna lista obiektów, których brakuje w Natural Earth albo mają tam złe
granice (oznaczone okręgiem, punktem lub linią wpisaną ręcznie), jest w
[BRAKI_GEOMETRII.md](BRAKI_GEOMETRII.md). Plik generuje `npm run data:build`.
Na mapie takie obiekty rysowane są linią przerywaną. Najbardziej warto
dorysować prawdziwe granice nizin europejskich (Angielska, Francuska,
Niemiecka, Polska, Padańska, Wołoska) – teraz są to okręgi.
