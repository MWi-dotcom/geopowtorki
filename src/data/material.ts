/**
 * MATERIAŁ – mapa fizyczna świata (źródło: materiał nauczyciela, „Zakres materiału 001”).
 *
 * Każdy obiekt: nazwa polska + warianty, kontynent, kategoria, fakty oraz
 * definicja geometrii:
 *   src  – obiekt(y) z Natural Earth (nazwa angielska z warstwy NE),
 *   pt/r – punkt (i promień w km), gdy obiektu brak w danych,
 *   line – linia wpisana ręcznie.
 * Geometrię buduje `npm run data:build` (scripts/build-data.ts).
 *
 * Zasady: nie wymyślamy faktów – wartości pochodzą z materiału nauczyciela.
 * Elementy oznaczone przez nauczyciela [do weryfikacji] mają needsVerification
 * i notatkę z wynikiem sprawdzenia (patrz też docs/ROZBIEZNOSCI.md).
 */
import type { CategoryId, ContinentId, Fact, Feature, GeoSource, NeLayer } from '../core/types';

type Def = Omit<Feature, 'continent' | 'category' | 'aliases' | 'facts' | 'videos' | 'needsVerification'> & {
  aliases?: string[];
  facts?: Fact[];
  needsVerification?: boolean;
};

const out: Feature[] = [];
function group(continent: ContinentId, category: CategoryId, defs: Def[]) {
  for (const d of defs) {
    out.push({
      aliases: [],
      facts: [],
      videos: [],
      needsVerification: false,
      ...d,
      continent,
      category,
    });
  }
}

// ---- skróty ----
const s = (l: NeLayer, ...names: string[]): GeoSource[] => names.map((n) => ({ l, n }));
const reg = (...n: string[]) => s('reg', ...n);
const mar = (...n: string[]) => s('mar', ...n);
const riv = (...n: string[]) => s('riv', ...n);
const lake = (...n: string[]) => s('lake', ...n);

/** Wysokość w dwóch wersjach: nauczyciela (wzorcowa) i aktualnego pomiaru (też zaliczana jako dokładna). */
function twoHeights(teacher: number, current: string, currentLabel: string): Partial<Fact> {
  const n = Number(current.replace(',', '.'));
  return {
    display: `${teacher} m n.p.m. (wersja nauczyciela); ${current} m n.p.m. (${currentLabel})`,
    aliases: [String(n), String(Math.round(n))],
  };
}
/** Tylko pytanie o wysokość dostaje dwie wartości – pytanie o nazwę szczytu zostaje bez zmian. */
const heightOnly = (facts: Fact[], h: Partial<Fact>, nameAliases: string[]) =>
  facts.map((f) => (f.id === 'wysokosc' ? { ...f, ...h } : { ...f, aliases: nameAliases }));

/** Tolerancja wysokości: ok. 0,5% (min. 15 m) – „mała tolerancja” z projektu. */
const heightTol = (h: number) => Math.max(15, Math.round(h * 0.005));

function peak(rangeGen: string, peakName: string, height: number, peakRef: string, opts: Partial<Fact> = {}, peakAliases: string[] = []): Fact[] {
  return [
    { id: 'szczyt', type: 'text', q: `Najwyższy szczyt ${rangeGen}?`, a: peakName, aliases: peakAliases, peakRef, ...opts },
    {
      id: 'wysokosc',
      type: 'number',
      q: `Wysokość szczytu ${peakName} (m n.p.m.)?`,
      a: String(height),
      unit: 'm n.p.m.',
      tolerance: heightTol(height),
      peakRef,
      ...opts,
    },
  ];
}
const city = (river: string, c: string, riverAliases: string[] = []): Fact => ({
  id: `miasto-${c.toLowerCase().replace(/[^a-ząćęłńóśźż]/g, '')}`,
  type: 'text',
  q: `Nad jaką rzeką leży ${c}?`,
  a: river,
  aliases: riverAliases,
});
const countries = (q: string, list: string[], opts: Partial<Fact> = {}): Fact => ({
  id: 'panstwa',
  type: 'set',
  q,
  a: list.join('; '),
  ...opts,
});
const country = (q: string, c: string, aliases: string[] = [], opts: Partial<Fact> = {}): Fact => ({
  id: 'panstwo',
  type: 'text',
  q,
  a: c,
  aliases,
  ...opts,
});


// =====================================================================
// EUROPA
// =====================================================================
group('europa', 'gory', [
  { id: 'eu-g-skandynawskie', namePl: 'Góry Skandynawskie', src: reg('KJØLEN MOUNTAINS') },
  { id: 'eu-g-ural', namePl: 'Ural', label: 'Ural (góry)', aliases: ['Góry Ural'], src: reg('URAL MOUNTAINS') },
  { id: 'eu-g-alpy', namePl: 'Alpy', src: reg('ALPS'), facts: peak('Alp', 'Mont Blanc', 4806, 'Mont Blanc', {}, ['Mount Blanc', 'Mont-Blanc']) },
  { id: 'eu-g-sudety', namePl: 'Sudety', src: reg('Sudetes Mts.') },
  { id: 'eu-g-karpaty', namePl: 'Karpaty', src: reg('CARPATHIAN MOUNTAINS', 'Transylvanian Alps', 'Tatra Mts.') },
  { id: 'eu-g-pireneje', namePl: 'Pireneje', src: reg('PYRENEES') },
  { id: 'eu-g-dynarskie', namePl: 'Góry Dynarskie', aliases: ['Alpy Dynarskie'], src: reg('Dinaric Alps') },
  { id: 'eu-g-balkany', namePl: 'Bałkany', aliases: ['Stara Płanina', 'Góry Bałkańskie'], src: reg('Balkan Mts.') },
  { id: 'eu-g-apeniny', namePl: 'Apeniny', src: reg('APPENNINI') },
  { id: 'eu-g-kaukaz', namePl: 'Kaukaz', aliases: ['Wielki Kaukaz'], src: reg('CAUCASUS MTS.') },
]);
group('europa', 'wyzyny', [
  { id: 'eu-w-masyw-centralny', namePl: 'Masyw Centralny', src: reg('Massif Central') },
  { id: 'eu-w-wolynska', namePl: 'Wyżyna Wołyńska', pt: [25.3, 50.7], r: 90 },
  { id: 'eu-w-podolska', namePl: 'Wyżyna Podolska', pt: [27.0, 49.2], r: 140 },
]);
group('europa', 'niziny', [
  { id: 'eu-n-angielska', namePl: 'Nizina Angielska', pt: [-0.6, 52.3], r: 150 },
  { id: 'eu-n-francuska', namePl: 'Nizina Francuska', pt: [1.2, 47.4], r: 230 },
  { id: 'eu-n-niemiecka', namePl: 'Nizina Niemiecka', pt: [9.8, 52.8], r: 190 },
  { id: 'eu-n-polska', namePl: 'Nizina Polska', aliases: ['Niż Polski'], pt: [19.0, 52.3], r: 220 },
  { id: 'eu-n-polesie', namePl: 'Polesie', aliases: ['Nizina Poleska'], pt: [27.5, 51.9], r: 170 },
  { id: 'eu-n-wschodnioeuropejska', namePl: 'Nizina Wschodnioeuropejska', aliases: ['Nizina Rosyjska'], pt: [42.0, 55.0], r: 650 },
  { id: 'eu-n-wegierska', namePl: 'Wielka Nizina Węgierska', aliases: ['Nizina Węgierska', 'Alföld'], src: reg('Alföld') },
  { id: 'eu-n-padanska', namePl: 'Nizina Padańska', pt: [10.5, 45.1], r: 110 },
  { id: 'eu-n-woloska', namePl: 'Nizina Wołoska', pt: [25.5, 44.2], r: 110 },
  { id: 'eu-n-nadkaspijska', namePl: 'Nizina Nadkaspijska', src: reg('CASPIAN DEPRESSION') },
]);
group('europa', 'rzeki', [
  {
    id: 'eu-r-wolga',
    namePl: 'Wołga',
    src: riv('Volga'),
    facts: [
      { id: 'ujscie', type: 'text', q: 'Do jakiego morza uchodzi Wołga?', a: 'Morze Kaspijskie', aliases: ['Kaspijskie', 'Morza Kaspijskiego', 'Kaspijskiego'] },
      country('Przez jakie państwo płynie Wołga?', 'Rosja'),
    ],
  },
  {
    id: 'eu-r-dunaj',
    namePl: 'Dunaj',
    src: riv('Danube'),
    facts: [
      city('Dunaj', 'Wiedeń'),
      city('Dunaj', 'Bratysława'),
      city('Dunaj', 'Budapeszt'),
      city('Dunaj', 'Belgrad'),
      { id: 'ujscie', type: 'text', q: 'Do jakiego morza uchodzi Dunaj?', a: 'Morze Czarne', aliases: ['Czarne', 'Morza Czarnego', 'Czarnego'] },
    ],
    note: 'Dunaj omija Bukareszt od południa (Bukareszt nie leży nad Dunajem) i uchodzi deltą do Morza Czarnego.',
  },
  { id: 'eu-r-ural', namePl: 'Ural', label: 'Ural (rzeka)', aliases: ['rzeka Ural'], src: riv('Ural') },
  { id: 'eu-r-dniepr', namePl: 'Dniepr', aliases: ['Dnipro'], src: riv('Dnipro'), facts: [city('Dniepr', 'Kijów', ['Dnipro'])] },
  { id: 'eu-r-ren', namePl: 'Ren', src: riv('Rhein', 'Rhine') },
  {
    id: 'eu-r-laba',
    namePl: 'Łaba',
    aliases: ['Elbe', 'Labe'],
    src: riv('Elbe'),
    facts: [countries('Przez jakie państwa płynie Łaba?', ['Czechy', 'Niemcy'])],
  },
]);
group('europa', 'jeziora', [
  { id: 'eu-j-ladoga', namePl: 'Ładoga', aliases: ['Jezioro Ładoga'], src: lake('Lake Ladoga') },
  { id: 'eu-j-onega', namePl: 'Onega', aliases: ['Jezioro Onega', 'Jezioro Onegskie'], src: lake('Lake Onega') },
  { id: 'eu-j-wener', namePl: 'Wener', aliases: ['Wänern', 'Vänern', 'Jezioro Wener'], src: lake('Vänern') },
]);
group('europa', 'polwyspy', [
  { id: 'eu-p-skandynawski', namePl: 'Półwysep Skandynawski', src: reg('SCANDINAVIA') },
  { id: 'eu-p-kolski', namePl: 'Półwysep Kolski', src: reg('KOLA PENINSULA') },
  { id: 'eu-p-jutlandzki', namePl: 'Półwysep Jutlandzki', aliases: ['Jutlandia'], src: reg('JUTLAND') },
  { id: 'eu-p-iberyjski', namePl: 'Półwysep Iberyjski', aliases: ['Półwysep Pirenejski'], src: reg('PENÍNSULA IBÉRICA') },
  { id: 'eu-p-balkanski', namePl: 'Półwysep Bałkański', src: reg('BALKAN PEN.') },
  { id: 'eu-p-peloponez', namePl: 'Peloponez', aliases: ['Półwysep Peloponeski'], src: reg('Pelopónnisos') },
  { id: 'eu-p-krym', namePl: 'Krym', aliases: ['Półwysep Krymski'], src: reg('CRIMEA') },
  {
    id: 'eu-p-azja-mniejsza',
    namePl: 'Azja Mniejsza',
    aliases: ['Anatolia', 'Półwysep Anatolijski'],
    src: reg('ANATOLIA'),
    alsoIn: ['azja'],
    note:
      'Rozległy półwysep na zachodniej granicy Azji (w Turcji), otoczony morzami: Czarnym od północy, Marmara od północnego zachodu, Egejskim od zachodu i Śródziemnym od południa. ' +
      'Od Europy oddzielają go Morze Marmara oraz cieśniny Bosfor i Dardanele. Ma ok. 0,5 mln km² powierzchni – ok. dwóch trzecich terytorium Turcji. ' +
      'W materiale nauczyciela wymieniony przy Europie, dlatego jest w partiach Europy i Azji.',
  },
]);
group('europa', 'wyspy', [
  { id: 'eu-wy-svalbard', namePl: 'Svalbard', aliases: ['Spitsbergen', 'Szpicbergen'], src: reg('SVALBARD') },
  { id: 'eu-wy-nowa-ziemia', namePl: 'Nowa Ziemia', src: reg('NOVAYA ZEMLYA') },
  { id: 'eu-wy-lofoty', namePl: 'Lofoty', src: reg('Lofoten') },
  { id: 'eu-wy-islandia', namePl: 'Islandia', src: reg('ICELAND') },
  { id: 'eu-wy-owcze', namePl: 'Wyspy Owcze', aliases: ['Owcze'], src: reg('Føroyar') },
  { id: 'eu-wy-szetlandy', namePl: 'Szetlandy', aliases: ['Wyspy Szetlandzkie'], src: reg('Shetland Is.') },
  { id: 'eu-wy-orkady', namePl: 'Orkady', src: reg('Orkney Is.') },
  { id: 'eu-wy-baleary', namePl: 'Baleary', aliases: ['Wyspy Balearskie'], src: reg('Balearic Islands') },
  { id: 'eu-wy-ibiza', namePl: 'Ibiza', parent: 'eu-wy-baleary', src: reg('Ibiza') },
  { id: 'eu-wy-majorka', namePl: 'Majorka', aliases: ['Mallorca'], parent: 'eu-wy-baleary', src: reg('Mallorca') },
  { id: 'eu-wy-minorka', namePl: 'Minorka', aliases: ['Menorca'], parent: 'eu-wy-baleary', src: reg('Menorca') },
  { id: 'eu-wy-korsyka', namePl: 'Korsyka', src: reg('Corse') },
  { id: 'eu-wy-sardynia', namePl: 'Sardynia', src: reg('Sardegna') },
  { id: 'eu-wy-sycylia', namePl: 'Sycylia', src: reg('Sicilia') },
  { id: 'eu-wy-malta', namePl: 'Malta', src: reg('Malta') },
  { id: 'eu-wy-kreta', namePl: 'Kreta', src: reg('Crete') },
  { id: 'eu-wy-cyklady', namePl: 'Cyklady', src: reg('Cyclades') },
  { id: 'eu-wy-rodos', namePl: 'Rodos', src: reg('Rhodes') },
]);
group('europa', 'morza', [
  { id: 'eu-m-barentsa', namePl: 'Morze Barentsa', src: mar('Barents Sea') },
  { id: 'eu-m-biale', namePl: 'Morze Białe', src: mar('White Sea') },
  { id: 'eu-m-norweskie', namePl: 'Morze Norweskie', src: mar('Norwegian Sea') },
  { id: 'eu-m-polnocne', namePl: 'Morze Północne', src: mar('North Sea') },
  { id: 'eu-m-baltyckie', namePl: 'Morze Bałtyckie', aliases: ['Bałtyk'], src: mar('Baltic Sea', 'Gulf of Bothnia', 'Gulf of Finland', 'Gulf of Riga') },
  {
    id: 'eu-m-srodziemne',
    namePl: 'Morze Śródziemne',
    src: mar(
      'Mediterranean Sea',
      'Tyrrhenian Sea',
      'Adriatic Sea',
      'Ionian Sea',
      'Aegean Sea',
      'Sea of Crete',
      'Balearic Sea',
      'Ligurian Sea',
      'Alboran Sea',
      'Gulf of Sidra',
      'Golfe du Lion',
    ),
  },
  { id: 'eu-m-tyrrenskie', namePl: 'Morze Tyrreńskie', src: mar('Tyrrhenian Sea') },
  { id: 'eu-m-adriatyckie', namePl: 'Morze Adriatyckie', aliases: ['Adriatyk'], src: mar('Adriatic Sea') },
  { id: 'eu-m-jonskie', namePl: 'Morze Jońskie', src: mar('Ionian Sea') },
  { id: 'eu-m-egejskie', namePl: 'Morze Egejskie', src: mar('Aegean Sea', 'Sea of Crete') },
  { id: 'eu-m-czarne', namePl: 'Morze Czarne', src: mar('Black Sea') },
]);

// =====================================================================
// AZJA
// =====================================================================
group('azja', 'gory', [
  { id: 'az-g-altaj', namePl: 'Ałtaj', src: reg('ALTAY MOUNTAINS') },
  {
    id: 'az-g-tien-szan',
    namePl: 'Tien-Szan',
    aliases: ['Tienszan', 'Tian Shan', 'Tien Szan'],
    src: reg('TIAN SHAN'),
    facts: [countries('W jakich państwach leży Tien-Szan?', ['Kirgistan', 'Chiny'])],
  },
  { id: 'az-g-kunlun', namePl: 'Kunlun', src: reg('KUNLUN MOUNTAINS'), facts: [country('W jakim państwie leży Kunlun?', 'Chiny')] },
  {
    id: 'az-g-pamir',
    namePl: 'Pamir',
    src: reg('PAMIRS'),
    note: 'Pamir leży głównie w Tadżykistanie; obejmuje też Kirgistan, Afganistan i Chiny.',
    facts: [country('W jakim państwie leży głównie Pamir?', 'Tadżykistan', ['Kirgistan'])],
  },
  {
    id: 'az-g-hindukusz',
    namePl: 'Hindukusz',
    src: reg('HINDU KUSH'),
    facts: [country('W jakim państwie leży Hindukusz?', 'Afganistan')],
  },
  {
    id: 'az-g-karakorum',
    namePl: 'Karakorum',
    src: reg('KARAKORAM RA.'),
    note:
      'Karakorum leży na styku trzech państw: Pakistanu (większość obszaru, m.in. Gilgit-Baltistan), Chin (Sinkiang i Tybet) i Indii (Ladakh oraz sporny Aksai Chin). ' +
      'To drugie najwyższe pasmo świata (po Himalajach). K2 (8611 m n.p.m.) – najwyższy szczyt Karakorum i drugi szczyt Ziemi – leży na granicy Pakistanu i Chin. ' +
      'Cztery ośmiotysięczniki: K2, Gaszerbrum I, Gaszerbrum II i Broad Peak.',
    facts: [
      countries('W jakich państwach leży Karakorum?', ['Pakistan', 'Chiny', 'Indie']),
      { id: 'szczyt', type: 'text', q: 'Najwyższy szczyt Karakorum?', a: 'K2', aliases: ['Czogori'], peakRef: 'K2' },
      { id: 'wysokosc', type: 'number', q: 'Wysokość szczytu K2 (m n.p.m.)?', a: '8611', unit: 'm n.p.m.', tolerance: heightTol(8611), peakRef: 'K2' },
    ],
  },
  {
    id: 'az-g-himalaje',
    namePl: 'Himalaje',
    src: reg('HIMALAYAS'),
    note:
      'Nepal – większość najwyższych szczytów (w tym południowa strona Mount Everestu i 8 z 14 ośmiotysięczników). ' +
      'Indie – południowe podnóża Himalajów oraz m.in. Sikkim, Kaszmir, Ladakh i Garhwal. ' +
      'Chiny (Tybet) – północne stoki i północna strona Mount Everestu na Wyżynie Tybetańskiej. ' +
      'Pakistan – najbardziej wysunięta na zachód część łańcucha (z masywem Nanga Parbat). ' +
      'Bhutan – w całości w obrębie Himalajów Wschodnich. ' +
      'Mount Everest: 8848 m n.p.m. (wersja nauczyciela), 8848,86 m n.p.m. (dokładny pomiar Chin i Nepalu z 2020 r.).',
    facts: [
      countries('W jakich państwach leżą Himalaje?', ['Nepal', 'Indie', 'Chiny', 'Pakistan', 'Bhutan']),
      ...heightOnly(
        peak('Himalajów (i Ziemi)', 'Mount Everest', 8848, 'Mount Everest'),
        twoHeights(8848, '8848,86', 'dokładny pomiar z 2020 r.'),
        ['Everest', 'Czomolungma'],
      ),
    ],
  },
  { id: 'az-g-poludniowochinskie', namePl: 'Góry Południowochińskie', aliases: ['Nan Ling'], src: reg('Nan Ling Mts.') },
  {
    id: 'az-g-annamskie',
    namePl: 'Góry Annamskie',
    src: reg('CHAÎNE ANNAMITIQUE'),
    facts: [country('W jakim państwie leżą Góry Annamskie (wg materiału)?', 'Wietnam')],
  },
  { id: 'az-g-zagros', namePl: 'Zagros', aliases: ['Góry Zagros'], src: reg('ZAGROS MOUNTAINS'), facts: [country('W jakim państwie leży Zagros?', 'Iran')] },
  { id: 'az-g-elburs', namePl: 'Elburs', aliases: ['Góry Elburs', 'Alborz'], src: reg('ELBURZ MTS.'), facts: [country('W jakim państwie leży Elburs?', 'Iran')] },
]);
group('azja', 'wyzyny', [
  { id: 'az-w-srodkowosyberyjska', namePl: 'Wyżyna Środkowosyberyjska', src: reg('CENTRAL SIBERIAN PLATEAU') },
  { id: 'az-w-pogorze-kazachskie', namePl: 'Pogórze Kazachskie', aliases: ['Wyżyna Kazachska'], src: reg('KAZAKH UPLAND') },
  { id: 'az-w-mongolska', namePl: 'Wyżyna Mongolska', src: reg('MONGOLIAN PLATEAU') },
  { id: 'az-w-tybetanska', namePl: 'Wyżyna Tybetańska', aliases: ['Tybet'], src: reg('PLATEAU OF TIBET') },
  { id: 'az-w-iranska', namePl: 'Wyżyna Irańska', pt: [57.0, 32.5], r: 550 },
  { id: 'az-w-dekan', namePl: 'Dekan', aliases: ['Wyżyna Dekan'], src: reg('DECCAN PLATEAU') },
]);
group('azja', 'niziny', [
  { id: 'az-n-zachodniosyberyjska', namePl: 'Nizina Zachodniosyberyjska', src: reg('WESTERN SIBERIAN PLAIN') },
  {
    id: 'az-n-turanska',
    namePl: 'Nizina Turańska',
    src: reg('TURAN LOWLAND'),
    facts: [countries('W jakich państwach leży Nizina Turańska?', ['Turkmenistan', 'Uzbekistan', 'Kazachstan'])],
  },
  {
    id: 'az-n-mezopotamska',
    namePl: 'Nizina Mezopotamska',
    aliases: ['Mezopotamia'],
    src: reg('Mesopotamia'),
    facts: [country('W jakim państwie leży Nizina Mezopotamska?', 'Irak')],
  },
  { id: 'az-n-indusu', namePl: 'Nizina Indusu', pt: [70.5, 28.0], r: 330 },
  { id: 'az-n-gangesu', namePl: 'Nizina Gangesu', aliases: ['Nizina Hindustańska'], src: reg('GANGES PLAIN') },
  { id: 'az-n-chinska', namePl: 'Nizina Chińska', aliases: ['Wielka Nizina Chińska'], src: reg('NORTH CHINA PLAIN') },
]);
group('azja', 'kotliny', [
  {
    id: 'az-k-kaszgarska',
    namePl: 'Kotlina Kaszgarska',
    aliases: ['Kotlina Tarymska'],
    src: reg('TARIM BASIN'),
    facts: [
      { id: 'pustynia', type: 'text', q: 'Jaka pustynia leży w Kotlinie Kaszgarskiej?', a: 'Takla Makan', aliases: ['Taklamakan', 'Takla-Makan'] },
      country('W jakim państwie leży Kotlina Kaszgarska?', 'Chiny'),
    ],
  },
]);
group('azja', 'rzeki', [
  { id: 'az-r-mekong', namePl: 'Mekong', src: riv('Mekong', 'Lancang') },
  { id: 'az-r-jangcy', namePl: 'Jangcy', aliases: ['Jangcy Ťiang', 'Chang Jiang', 'Jangtse'], src: riv('Chang Jiang', 'Yangtze', 'Jinsha') },
  { id: 'az-r-huang-he', namePl: 'Huang-He', aliases: ['Huang He', 'Huanghe', 'Żółta Rzeka'], src: riv('Huang') },
  { id: 'az-r-amur', namePl: 'Amur', src: riv('Amur') },
  { id: 'az-r-ob', namePl: 'Ob', src: riv('Ob') },
  { id: 'az-r-irtysz', namePl: 'Irtysz', src: riv('Irtysh') },
  { id: 'az-r-jenisej', namePl: 'Jenisej', src: riv('Yenisey') },
  { id: 'az-r-lena', namePl: 'Lena', src: riv('Lena') },
  { id: 'az-r-indus', namePl: 'Indus', src: riv('Indus') },
  { id: 'az-r-ganges', namePl: 'Ganges', src: riv('Ganges') },
  { id: 'az-r-eufrat', namePl: 'Eufrat', src: riv('Euphrates') },
  { id: 'az-r-tygrys', namePl: 'Tygrys', src: riv('Tigris') },
]);
group('azja', 'jeziora', [
  { id: 'az-j-kaspijskie', namePl: 'Morze Kaspijskie', aliases: ['Kaspijskie'], src: mar('Caspian Sea') },
  { id: 'az-j-bajkal', namePl: 'Bajkał', aliases: ['Jezioro Bajkał'], src: lake('Lake Baikal') },
  { id: 'az-j-balchasz', namePl: 'Bałchasz', aliases: ['Jezioro Bałchasz'], src: lake('Lake Balkhash') },
  {
    id: 'az-j-aralskie',
    namePl: 'Jezioro Aralskie',
    aliases: ['Morze Aralskie', 'Aral'],
    src: lake('North Aral Sea', 'South Aral Sea'),
    historic: s('hist', 'Aral Sea'),
    note: 'Na mapie przerywaną linią zaznaczono dawny zasięg jeziora – w dużej mierze wyschło.',
    facts: [
      { id: 'wyschlo', type: 'text', q: 'Które duże jezioro Azji w dużej mierze wyschło?', a: 'Jezioro Aralskie', aliases: ['Aralskie', 'Morze Aralskie', 'Aral'] },
    ],
  },
]);
group('azja', 'polwyspy', [
  { id: 'az-p-kamczatka', namePl: 'Kamczatka', aliases: ['Półwysep Kamczatka'], src: reg('KAMCHATKA PENINSULA') },
  { id: 'az-p-koreanski', namePl: 'Półwysep Koreański', src: reg('KOREA') },
  { id: 'az-p-malajski', namePl: 'Półwysep Malajski', aliases: ['Malakka'], src: reg('MALAY PENINSULA') },
  { id: 'az-p-indyjski', namePl: 'Półwysep Indyjski', aliases: ['Półwysep Indostan', 'Indostan'], src: reg('INDIA') },
  { id: 'az-p-arabski', namePl: 'Półwysep Arabski', src: reg('ARABIAN PENINSULA') },
]);
group('azja', 'wyspy', [
  { id: 'az-wy-ziemia-polnocna', namePl: 'Ziemia Północna', src: reg('SEVERNAYA ZEMLYA') },
  { id: 'az-wy-sachalin', namePl: 'Sachalin', src: reg('SAKHALIN') },
  { id: 'az-wy-hokkaido', namePl: 'Hokkaido', src: reg('HOKKAIDÖ') },
  { id: 'az-wy-honsiu', namePl: 'Honsiu', aliases: ['Honsiu', 'Honshu', 'Honsziu'], src: reg('HONSHÜ') },
  { id: 'az-wy-tajwan', namePl: 'Tajwan', src: reg('TAIWAN') },
  { id: 'az-wy-archipelag-malajski', namePl: 'Archipelag Malajski', src: reg('MALAY ARCHIPELAGO') },
  { id: 'az-wy-filipiny', namePl: 'Filipiny', parent: 'az-wy-archipelag-malajski', src: reg('PHILIPPINES') },
  { id: 'az-wy-borneo', namePl: 'Borneo', aliases: ['Kalimantan'], parent: 'az-wy-archipelag-malajski', src: reg('BORNEO') },
  { id: 'az-wy-sumatra', namePl: 'Sumatra', parent: 'az-wy-archipelag-malajski', src: reg('SUMATRA') },
  { id: 'az-wy-jawa', namePl: 'Jawa', parent: 'az-wy-archipelag-malajski', src: reg('JAVA') },
  { id: 'az-wy-cejlon', namePl: 'Cejlon', aliases: ['Sri Lanka'], src: reg('SRI LANKA') },
  { id: 'az-wy-malediwy', namePl: 'Malediwy', src: reg('Maldive Islands') },
]);
group('azja', 'morza', [
  { id: 'az-m-karskie', namePl: 'Morze Karskie', src: mar('Kara Sea') },
  { id: 'az-m-beringa', namePl: 'Morze Beringa', alsoIn: ['ameryka-pn'], src: mar('Bering Sea') },
  { id: 'az-m-ochockie', namePl: 'Morze Ochockie', src: mar('Sea of Okhotsk') },
  { id: 'az-m-japonskie', namePl: 'Morze Japońskie', src: mar('Sea of Japan') },
  { id: 'az-m-zolte', namePl: 'Morze Żółte', src: mar('Yellow Sea') },
  { id: 'az-m-poludniowochinskie', namePl: 'Morze Południowochińskie', src: mar('South China Sea') },
  { id: 'az-m-filipinskie', namePl: 'Morze Filipińskie', src: mar('Philippine Sea') },
  { id: 'az-m-celebes', namePl: 'Morze Celebes', src: mar('Celebes Sea') },
  { id: 'az-m-banda', namePl: 'Morze Banda', src: mar('Banda Sea') },
  { id: 'az-m-bengalska', namePl: 'Zatoka Bengalska', src: mar('Bay of Bengal') },
  { id: 'az-m-arabskie', namePl: 'Morze Arabskie', src: mar('Arabian Sea') },
  { id: 'az-m-czerwone', namePl: 'Morze Czerwone', alsoIn: ['afryka'], src: mar('Red Sea') },
]);

// =====================================================================
// AFRYKA
// =====================================================================
group('afryka', 'gory', [
  { id: 'af-g-atlas', namePl: 'Atlas', aliases: ['Góry Atlas'], src: reg('ATLAS MOUNTAINS', 'HAUT ATLAS', 'Moyen Atlas', 'Anti Atlas', 'ATLAS SAHARIEN', 'Atlas Tellien') },
  { id: 'af-g-tibesti', namePl: 'Tibesti', src: reg('TIBESTI MTS.') },
  { id: 'af-g-przyladkowe', namePl: 'Góry Przylądkowe', pt: [21.0, -33.6], r: 180 },
  { id: 'af-g-smocze', namePl: 'Góry Smocze', aliases: ['Drakensberg'], src: reg('DRAKENSBERG') },
]);
group('afryka', 'wyzyny', [
  { id: 'af-w-abisynska', namePl: 'Wyżyna Abisyńska', aliases: ['Wyżyna Etiopska'], src: reg('ETHIOPIAN HIGHLANDS'), facts: [country('W jakim państwie leży Wyżyna Abisyńska?', 'Etiopia')] },
  { id: 'af-w-bie', namePl: 'Wyżyna Bié', aliases: ['Bié', 'Wyżyna Bie', 'Bije'], src: reg('Bié Plateau'), facts: [country('W jakim państwie leży Wyżyna Bié?', 'Angola')] },
  {
    id: 'af-w-wschodnioafrykanska',
    namePl: 'Wyżyna Wschodnioafrykańska',
    pt: [35.5, -3.0],
    r: 550,
    facts: peak('Wyżyny Wschodnioafrykańskiej (i Afryki)', 'Kilimandżaro', 5895, 'Mount Kilimanjaro', {}, ['Kilimanjaro', 'Kibo', 'Uhuru']),
  },
]);
group('afryka', 'kotliny', [
  { id: 'af-k-czadu', namePl: 'Kotlina Czadu', pt: [16.0, 14.0], r: 550, facts: [countries('W jakich państwach leży Kotlina Czadu (wg materiału)?', ['Czad', 'Niger'])] },
  { id: 'af-k-gornego-nilu', namePl: 'Kotlina Górnego Nilu', pt: [31.0, 8.0], r: 380 },
  {
    id: 'af-k-konga',
    namePl: 'Kotlina Konga',
    src: reg('CONGO BASIN'),
    facts: [country('W jakim państwie leży Kotlina Konga?', 'DRK', ['Demokratyczna Republika Konga', 'DR Konga', 'Kongo DR', 'Demokratyczna Republika Kongo'])],
  },
  { id: 'af-k-kalahari', namePl: 'Kotlina Kalahari', aliases: ['Kalahari'], src: reg('KALAHARI DESERT'), facts: [country('W jakim państwie leży Kotlina Kalahari (wg materiału)?', 'Botswana')] },
]);
group('afryka', 'rzeki', [
  { id: 'af-r-nil', namePl: 'Nil', src: riv('Nile') },
  { id: 'af-r-niger', namePl: 'Niger', src: riv('Niger') },
  { id: 'af-r-kongo', namePl: 'Kongo', aliases: ['Zair'], src: riv('Congo') },
  { id: 'af-r-zambezi', namePl: 'Zambezi', src: riv('Zambezi') },
]);
group('afryka', 'jeziora', [
  { id: 'af-j-czad', namePl: 'Czad', label: 'Czad (jezioro)', aliases: ['Jezioro Czad'], src: lake('Lake Chad') },
  { id: 'af-j-wiktorii', namePl: 'Jezioro Wiktorii', aliases: ['Wiktorii', 'Wiktoria'], src: lake('Lake Victoria') },
  { id: 'af-j-tanganika', namePl: 'Tanganika', aliases: ['Jezioro Tanganika'], src: lake('Lake Tanganyika') },
  { id: 'af-j-malawi', namePl: 'Malawi', aliases: ['Jezioro Malawi', 'Niasa'], src: lake('Lake Malawi') },
]);
group('afryka', 'polwyspy', [{ id: 'af-p-somalijski', namePl: 'Półwysep Somalijski', aliases: ['Róg Afryki'], src: reg('SOMALI PENINSULA') }]);
const cape = (dir: string, name: string): Fact => ({
  id: 'kraniec',
  type: 'text',
  q: `Który przylądek to skrajny punkt Afryki na ${dir}?`,
  a: name,
  aliases: [name.replace('Przylądek ', '')],
});
group('afryka', 'przyladki', [
  {
    id: 'af-pr-bialy',
    namePl: 'Przylądek Biały',
    aliases: ['Ras al-Abjad', 'Ras el-Abiad', 'Ras ben Sakka'],
    pt: [9.857, 37.344],
    note: 'Północny kraniec Afryki (Tunezja). Uwaga: inny Przylądek Biały (Ras Nawazibu) leży w Mauretanii.',
    facts: [cape('północy', 'Przylądek Biały')],
  },
  { id: 'af-pr-hafun', namePl: 'Przylądek Hafun', aliases: ['Ras Hafun', 'Hafun'], pt: [51.27, 10.44], facts: [cape('wschodzie', 'Przylądek Hafun')] },
  { id: 'af-pr-igielny', namePl: 'Przylądek Igielny', aliases: ['Agulhas', 'Igielny'], src: s('cape', 'Cape Agulhas'), facts: [cape('południu', 'Przylądek Igielny')] },
  { id: 'af-pr-almadi', namePl: 'Przylądek Almadi', aliases: ['Almadies', 'Pointe des Almadies'], pt: [-17.53, 14.745], facts: [cape('zachodzie', 'Przylądek Almadi')] },
]);
group('afryka', 'wyspy', [
  { id: 'af-wy-kanaryjskie', namePl: 'Wyspy Kanaryjskie', aliases: ['Kanary'], src: reg('ISLAS CANARIAS') },
  { id: 'af-wy-la-palma', namePl: 'La Palma', parent: 'af-wy-kanaryjskie', src: reg('La Palma') },
  { id: 'af-wy-teneryfa', namePl: 'Teneryfa', aliases: ['Tenerife'], parent: 'af-wy-kanaryjskie', src: reg('Tenerife') },
  { id: 'af-wy-madera', namePl: 'Madera', src: reg('Madeira') },
  { id: 'af-wy-seszele', namePl: 'Seszele', src: reg('SEYCHELLES') },
  { id: 'af-wy-madagaskar', namePl: 'Madagaskar', src: reg('MADAGASCAR') },
  { id: 'af-wy-komory', namePl: 'Komory', aliases: ['Wyspy Komory'], src: reg('ARCHIPEL DES COMORES') },
  { id: 'af-wy-sw-tomasza', namePl: 'Wyspy Świętego Tomasza i Książęca', aliases: ['Wyspy Św. Tomasza i Książęca', 'Wyspa Świętego Tomasza i Książęca'], src: reg('São Tomé', 'Príncipe') },
]);
group('afryka', 'morza', [
  { id: 'af-m-adenska', namePl: 'Zatoka Adeńska', src: mar('Gulf of Aden') },
  { id: 'af-m-mozambicki', namePl: 'Kanał Mozambicki', aliases: ['Cieśnina Mozambicka'], src: mar('Mozambique Channel') },
  { id: 'af-m-gwinejska', namePl: 'Zatoka Gwinejska', src: mar('Gulf of Guinea') },
  { id: 'af-m-gibraltarska', namePl: 'Cieśnina Gibraltarska', aliases: ['Gibraltar'], src: mar('Strait of Gibraltar') },
]);

// =====================================================================
// AUSTRALIA I OCEANIA
// =====================================================================
group('australia', 'gory', [
  {
    id: 'au-g-wododzialowe',
    namePl: 'Wielkie Góry Wododziałowe',
    src: reg('GREAT DIVIDING RANGE'),
    note: 'Wysokość Góry Kościuszki: 2230 m n.p.m. (wersja nauczyciela), 2228 m n.p.m. (aktualny pomiar, Geoscience Australia) – obie wartości są zaliczane.',
    facts: heightOnly(
      peak('Wielkich Gór Wododziałowych (i Australii)', 'Góra Kościuszki', 2230, 'Mount Kosciuszko'),
      twoHeights(2230, '2228', 'aktualny pomiar, Geoscience Australia'),
      ['Kościuszko', 'Mount Kosciuszko', 'Kosciuszko'],
    ),
  },
]);
group('australia', 'wyzyny', [
  { id: 'au-w-kimberley', namePl: 'Wyżyna Kimberley', aliases: ['Kimberley'], src: reg('KIMBERLEY PLATEAU') },
  { id: 'au-w-zachodnioaustralijska', namePl: 'Wyżyna Zachodnioaustralijska', src: reg('WESTERN PLATEAU') },
]);
group('australia', 'niziny', [
  { id: 'au-n-nullarbor', namePl: 'Nullarbor', aliases: ['Nizina Nullarbor', 'Równina Nullarbor'], src: reg('NULLARBOR PLAIN') },
  { id: 'au-n-basen-artezyjski', namePl: 'Wielki Basen Artezyjski', src: reg('GREAT ARTESIAN BASIN') },
]);
group('australia', 'rzeki', [
  { id: 'au-r-murray', namePl: 'Murray', src: riv('Murray') },
  { id: 'au-r-darling', namePl: 'Darling', src: riv('Darling') },
]);
group('australia', 'jeziora', [{ id: 'au-j-eyre', namePl: 'Eyre', aliases: ['Jezioro Eyre'], src: lake('Lake Eyre North', 'Lake Eyre South') }]);
group('australia', 'polwyspy', [
  { id: 'au-p-arnhema', namePl: 'Ziemia Arnhema', src: reg('ARNHEM LAND') },
  { id: 'au-p-york', namePl: 'Półwysep York', aliases: ['Jork', 'Półwysep Jork', 'Cape York'], src: reg('CAPE YORK PEN.') },
]);
group('australia', 'wyspy', [
  { id: 'au-wy-nowa-gwinea', namePl: 'Nowa Gwinea', src: reg('NEW GUINEA') },
  { id: 'au-wy-salomona', namePl: 'Wyspy Salomona', src: reg('SOLOMON ISANDS') },
  { id: 'au-wy-nowa-zelandia', namePl: 'Nowa Zelandia', src: reg('NEW ZEALAND') },
  { id: 'au-wy-fidzi', namePl: 'Fidżi', aliases: ['Wyspy Fidżi'], src: reg('FIJI') },
  { id: 'au-wy-tasmania', namePl: 'Tasmania', src: reg('TASMANIA') },
]);
group('australia', 'morza', [
  { id: 'au-m-timor', namePl: 'Morze Timor', src: mar('Timor Sea') },
  { id: 'au-m-arafura', namePl: 'Morze Arafura', src: mar('Arafura Sea') },
  { id: 'au-m-karpentaria', namePl: 'Zatoka Karpentaria', src: mar('Gulf of Carpentaria') },
  { id: 'au-m-koralowe', namePl: 'Morze Koralowe', src: mar('Coral Sea') },
  {
    id: 'au-m-fidzi',
    namePl: 'Morze Fidżi',
    pt: [178.5, -21.5],
    r: 380,
    needsVerification: true,
    note: 'Brak w Natural Earth – zasięg zaznaczony w przybliżeniu (okrąg).',
  },
  { id: 'au-m-tasmana', namePl: 'Morze Tasmana', src: mar('Tasman Sea') },
  { id: 'au-m-wielka-zatoka', namePl: 'Wielka Zatoka Australijska', src: mar('Great Australian Bight') },
]);

// =====================================================================
// ANTARKTYDA
// =====================================================================
group('antarktyda', 'gory', [
  { id: 'an-g-transantarktyczne', namePl: 'Góry Transantarktyczne', src: reg('Transantarctic Mountains') },
  {
    id: 'an-g-ellswortha',
    namePl: 'Góry Ellswortha',
    src: reg('Ellsworth Mountains'),
    facts: peak('Gór Ellswortha (i Antarktydy)', 'Masyw Vinsona', 4892, 'Vinson Massif', {}, ['Vinson', 'Mount Vinson', 'Vinsona']),
  },
]);
group('antarktyda', 'ziemie', [
  { id: 'an-z-krolowej-maud', namePl: 'Ziemia Królowej Maud', src: reg('Queen Maud Land') },
  { id: 'an-z-zachodnia', namePl: 'Antarktyda Zachodnia', src: reg('West Antarctica') },
  { id: 'an-z-wschodnia', namePl: 'Antarktyda Wschodnia', src: reg('East Antarctica') },
  { id: 'an-z-plaskowyz-polarny', namePl: 'Płaskowyż Polarny', aliases: ['Płaskowyż Antarktyczny'], src: reg('Polar Plateau') },
  { id: 'an-z-polwysep', namePl: 'Półwysep Antarktyczny', src: reg('Antarctic Peninsula') },
]);
group('antarktyda', 'lodowce', [
  { id: 'an-l-rossa', namePl: 'Lodowiec Szelfowy Rossa', aliases: ['Lodowiec Rossa'], src: s('ice', 'Ross Ice Shelf') },
  { id: 'an-l-ronne', namePl: 'Lodowiec Szelfowy Ronne', aliases: ['Lodowiec Ronne', 'Lodowiec Szelfowy Filchnera-Ronne'], src: s('ice', 'Ronne Ice Shelf') },
]);
group('antarktyda', 'morza', [
  { id: 'an-m-weddella', namePl: 'Morze Weddella', src: mar('Weddell Sea') },
  { id: 'an-m-rossa', namePl: 'Morze Rossa', src: mar('Ross Sea') },
  { id: 'an-m-amundsena', namePl: 'Morze Amundsena', src: mar('Amundsen Sea') },
]);

// =====================================================================
// AMERYKA PÓŁNOCNA
// =====================================================================
group('ameryka-pn', 'gory', [
  {
    id: 'np-g-kordyliery',
    namePl: 'Kordyliery',
    src: reg(
      'ROCKY MOUNTAINS',
      'COAST MOUNTAINS',
      'COAST RANGES',
      'CASCADE RANGE',
      'SIERRA NEVADA',
      'ALASKA RANGE',
      'MACKENZIE MTS.',
      'BROOKS RANGE',
      'SELWYN MTS.',
      'COLUMBIA MTS.',
      'SIERRA MADRE OCCIDENTAL',
      'SIERRA MADRE ORIENTAL',
      'Sierra Madre del Sur',
    ),
    note: 'Kordyliery to system wielu pasm – na mapie zaznaczono sumę głównych pasm (zasięg przybliżony).',
  },
  { id: 'np-g-nadbrzezne', namePl: 'Góry Nadbrzeżne', src: reg('COAST MOUNTAINS', 'COAST RANGES') },
  { id: 'np-g-skaliste', namePl: 'Góry Skaliste', src: reg('ROCKY MOUNTAINS') },
  {
    id: 'np-g-alaska',
    namePl: 'Góry Alaska',
    aliases: ['Alaska Range', 'Pasmo Alaska'],
    src: reg('ALASKA RANGE'),
    note:
      'Wysokość Denali: 6194 m n.p.m. (wersja nauczyciela), 6190 m n.p.m. (pomiar z 2015 r.) – obie wartości są zaliczane. W 2025 r. władze federalne USA przywróciły nazwę Mount McKinley; stan Alaska używa nazwy Denali. Obie nazwy są zaliczane.',
    facts: heightOnly(
      peak('Gór Alaska (i Ameryki Północnej)', 'Denali', 6194, 'Denali'),
      twoHeights(6194, '6190', 'pomiar z 2015 r.'),
      ['McKinley', 'Mount McKinley', 'Mt McKinley'],
    ),
  },
  { id: 'np-g-appalachy', namePl: 'Appalachy', src: reg('APPALACHIAN MTS.') },
]);
group('ameryka-pn', 'wyzyny', [
  { id: 'np-w-wielkie-rowniny', namePl: 'Wielkie Równiny', src: reg('GREAT PLAINS') },
  { id: 'np-w-wielka-kotlina', namePl: 'Wielka Kotlina', aliases: ['Wielki Basen'], src: reg('GREAT BASIN') },
  { id: 'np-w-kolorado', namePl: 'Wyżyna Kolorado', src: reg('COLORADO PLATEAU') },
  { id: 'np-w-meksykanska', namePl: 'Wyżyna Meksykańska', src: reg('ALTI-PLANICIE MEXICANA') },
]);
group('ameryka-pn', 'niziny', [
  { id: 'np-n-hudsonska', namePl: 'Nizina Hudsońska', aliases: ['Nizina Zatoki Hudsona'], pt: [-86.3, 53.6], r: 330 },
  // Natural Earth ma jedną „Coastal Plain” – dzielimy ją na część nad Zatoką Meksykańską i nad Atlantykiem.
  { id: 'np-n-zatokowa', namePl: 'Nizina Zatokowa', aliases: ['Nizina Nadzatokowa'], src: reg('COASTAL PLAIN'), clip: [-105, 15, -84.2, 40] },
  { id: 'np-n-atlantycka', namePl: 'Nizina Atlantycka', aliases: ['Nizina Nadatlantycka'], src: reg('COASTAL PLAIN'), clip: [-84.2, 15, -60, 50] },
]);
group('ameryka-pn', 'rzeki', [
  { id: 'np-r-missisipi', namePl: 'Missisipi', aliases: ['Mississippi'], src: riv('Mississippi') },
  { id: 'np-r-missouri', namePl: 'Missouri', src: riv('Missouri') },
  { id: 'np-r-mackenzie', namePl: 'Mackenzie', src: riv('Mackenzie') },
  { id: 'np-r-jukon', namePl: 'Jukon', aliases: ['Yukon'], src: riv('Yukon') },
]);
group('ameryka-pn', 'jeziora', [
  { id: 'np-j-gorne', namePl: 'Jezioro Górne', aliases: ['Górne'], src: lake('Lake Superior') },
  { id: 'np-j-michigan', namePl: 'Michigan', aliases: ['Jezioro Michigan'], src: lake('Lake Michigan') },
  { id: 'np-j-huron', namePl: 'Huron', aliases: ['Jezioro Huron'], src: lake('Lake Huron') },
  { id: 'np-j-niedzwiedzie', namePl: 'Wielkie Jezioro Niedźwiedzie', aliases: ['Wielkie Niedźwiedzie'], src: lake('Great Bear Lake') },
  { id: 'np-j-niewolnicze', namePl: 'Wielkie Jezioro Niewolnicze', aliases: ['Wielkie Niewolnicze'], src: lake('Great Slave Lake') },
]);
group('ameryka-pn', 'polwyspy', [
  { id: 'np-p-alaska', namePl: 'Półwysep Alaska', label: 'Alaska (półwysep)', aliases: ['Alaska'], src: reg('ALASKA PENINSULA') },
  { id: 'np-p-labrador', namePl: 'Półwysep Labrador', aliases: ['Labrador'], src: reg('LABRADOR') },
  { id: 'np-p-nowa-szkocja', namePl: 'Nowa Szkocja', aliases: ['Półwysep Nowa Szkocja'], src: reg('Nova Scotia') },
  { id: 'np-p-floryda', namePl: 'Floryda', aliases: ['Półwysep Floryda'], src: reg('FLORIDA') },
  { id: 'np-p-jukatan', namePl: 'Jukatan', aliases: ['Półwysep Jukatan'], src: reg('PEN. DE YUCATÁN') },
  { id: 'np-p-kalifornijski', namePl: 'Półwysep Kalifornijski', aliases: ['Kalifornia Dolna'], src: reg('BAJA CALIFORNIA') },
]);
group('ameryka-pn', 'wyspy', [
  { id: 'np-wy-grenlandia', namePl: 'Grenlandia', src: reg('GREENLAND') },
  { id: 'np-wy-krolowej-elzbiety', namePl: 'Wyspy Królowej Elżbiety', src: reg('QUEEN ELIZABETH ISLANDS') },
  { id: 'np-wy-wiktorii', namePl: 'Wyspa Wiktorii', src: reg('VICTORIA ISLAND') },
  { id: 'np-wy-baffina', namePl: 'Ziemia Baffina', aliases: ['Wyspa Baffina'], src: reg('BAFFIN ISLAND') },
  { id: 'np-wy-bahamy', namePl: 'Bahamy', aliases: ['Wyspy Bahama'], src: reg('BAHAMA ISLANDS') },
  { id: 'np-wy-wielkie-antyle', namePl: 'Wielkie Antyle', src: reg('GREATER ANTILLES') },
  { id: 'np-wy-kuba', namePl: 'Kuba', parent: 'np-wy-wielkie-antyle', src: reg('CUBA') },
  { id: 'np-wy-haiti', namePl: 'Haiti', aliases: ['Hispaniola'], parent: 'np-wy-wielkie-antyle', src: reg('HISPANIOLA') },
  { id: 'np-wy-jamajka', namePl: 'Jamajka', parent: 'np-wy-wielkie-antyle', src: reg('Jamaica') },
  { id: 'np-wy-male-antyle', namePl: 'Małe Antyle', src: reg('LESSER ANTILLES') },
  { id: 'np-wy-gwadelupa', namePl: 'Gwadelupa', parent: 'np-wy-male-antyle', src: s('cape', 'Guadeloupe') },
  { id: 'np-wy-dominika', namePl: 'Dominika', parent: 'np-wy-male-antyle', src: s('cape', 'Dominica') },
  { id: 'np-wy-martynika', namePl: 'Martynika', parent: 'np-wy-male-antyle', src: s('cape', 'Martinique') },
]);
group('ameryka-pn', 'morza', [
  { id: 'np-m-beauforta', namePl: 'Morze Beauforta', src: mar('Beaufort Sea') },
  { id: 'np-m-baffina', namePl: 'Morze Baffina', aliases: ['Zatoka Baffina'], src: mar('Baffin Bay') },
  { id: 'np-m-hudsona', namePl: 'Zatoka Hudsona', src: mar('Hudson Bay') },
  { id: 'np-m-labradorskie', namePl: 'Morze Labradorskie', src: mar('Labrador Sea') },
  { id: 'np-m-sargassowe', namePl: 'Morze Sargassowe', src: mar('Sargasso Sea') },
  { id: 'np-m-meksykanska', namePl: 'Zatoka Meksykańska', aliases: ['Zatoka Amerykańska'], src: mar('Gulf of Mexico') },
  { id: 'np-m-karaibskie', namePl: 'Morze Karaibskie', src: mar('Caribbean Sea') },
]);

// =====================================================================
// AMERYKA POŁUDNIOWA
// =====================================================================
group('ameryka-pd', 'gory', [
  {
    id: 'sp-g-andy',
    namePl: 'Andy',
    src: reg('ANDES'),
    note: 'Wysokość Aconcagui: 6962 m n.p.m. (wersja nauczyciela), 6961 m n.p.m. (nowszy pomiar) – obie wartości są zaliczane.',
    facts: heightOnly(peak('Andów (i Ameryki Południowej)', 'Aconcagua', 6962, 'Cerro Aconcagua'), twoHeights(6962, '6961', 'nowszy pomiar'), ['Akonkagua', 'Cerro Aconcagua']),
  },
]);
group('ameryka-pd', 'wyzyny', [
  { id: 'sp-w-gujanska', namePl: 'Wyżyna Gujańska', src: reg('GUIANA HIGHLANDS') },
  { id: 'sp-w-brazylijska', namePl: 'Wyżyna Brazylijska', src: reg('BRAZILIAN HIGHLANDS') },
  { id: 'sp-w-patagonia', namePl: 'Patagonia', aliases: ['Wyżyna Patagońska'], src: reg('PATAGONIA') },
]);
group('ameryka-pd', 'niziny', [
  { id: 'sp-n-orinoko', namePl: 'Nizina Orinoko', aliases: ['Llanos'], src: reg('LLANOS') },
  { id: 'sp-n-amazonki', namePl: 'Nizina Amazonki', aliases: ['Amazonia'], src: reg('AMAZON BASIN') },
  {
    id: 'sp-n-la-platy',
    namePl: 'Nizina La Platy',
    src: reg('GRAN CHACO', 'PAMPAS', 'Entre Rios'),
    note: 'Zaznaczono Gran Chaco, Pampę i Międzyrzecze (Entre Ríos) – zasięg przybliżony.',
  },
]);
group('ameryka-pd', 'rzeki', [
  { id: 'sp-r-amazonka', namePl: 'Amazonka', src: riv('Amazonas') },
  { id: 'sp-r-parana', namePl: 'Parana', aliases: ['Paraná'], src: riv('Paraná') },
  {
    id: 'sp-r-paragwaj',
    namePl: 'Paragwaj',
    label: 'Paragwaj (rzeka)',
    // Brak w Natural Earth 1:10m – przebieg wpisany ręcznie (przybliżony): źródła w Mato Grosso,
    // Cáceres, Corumbá, Concepción, Asunción, ujście do Parany koło Corrientes.
    line: [
      [-56.45, -14.45],
      [-57.1, -15.4],
      [-57.68, -16.07],
      [-57.75, -17.6],
      [-57.65, -19.0],
      [-57.9, -20.2],
      [-57.87, -21.04],
      [-57.75, -22.3],
      [-57.43, -23.4],
      [-57.35, -24.4],
      [-57.63, -25.28],
      [-58.2, -26.3],
      [-58.6, -27.28],
    ],
    needsVerification: true,
    note: 'Brak rzeki w Natural Earth – przebieg wpisany ręcznie w przybliżeniu.',
  },
  { id: 'sp-r-orinoko', namePl: 'Orinoko', aliases: ['Orinoco'], src: riv('Orinoco') },
]);
group('ameryka-pd', 'jeziora', [
  { id: 'sp-j-titicaca', namePl: 'Titicaca', aliases: ['Jezioro Titicaca', 'Titikaka'], src: lake('Lago Titicaca'), facts: [countries('Na granicy jakich państw leży Titicaca?', ['Peru', 'Boliwia'])] },
]);
group('ameryka-pd', 'przyladki', [
  {
    id: 'sp-pr-horn',
    namePl: 'Przylądek Horn',
    aliases: ['Horn'],
    src: s('cape', 'Cabo de Hornos'),
    facts: [{ id: 'kraniec', type: 'text', q: 'Który przylądek leży na południowym krańcu Ameryki Południowej?', a: 'Przylądek Horn', aliases: ['Horn'] }],
  },
]);
group('ameryka-pd', 'wyspy', [
  { id: 'sp-wy-falklandy', namePl: 'Falklandy', aliases: ['Malwiny', 'Falklandy (Malwiny)'], src: reg('FALKLAND IS.') },
  { id: 'sp-wy-ziemia-ognista', namePl: 'Ziemia Ognista', src: reg('TIERRA DEL FUEGO') },
]);
group('ameryka-pd', 'morza', [
  { id: 'sp-m-magellana', namePl: 'Cieśnina Magellana', src: mar('Estrecho de Magellanes') },
  { id: 'sp-m-drakea', namePl: 'Cieśnina Drake’a', aliases: ["Cieśnina Drake'a", 'Cieśnina Drakea'], src: mar('Drake Passage') },
]);

export const FEATURES: Feature[] = out;
export const FEATURE_BY_ID: Record<string, Feature> = Object.fromEntries(out.map((f) => [f.id, f]));
